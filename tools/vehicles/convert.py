# v25: køretøjerne fra spilleren (tools/vehicles/src) → spilklare GLB'er til intro-cutscenen
#   maxxpro : MAXXPRO_MODIFIED (OBJ, ingen teksturer) – SWAT's pansrede MRAP. Bagrampen (trappen) bliver noden 'tailgate' (lukket = lodret).
#   gaz     : gazOld.blend (GAZ-53-ladvogn, teksturerne mangler) – hijackernes lastbil. Ladets bagsmæk skæres fri som 'tailgate'.
#   Fælles: målfast skala, fremad = -Y (glTF +Z), jorden i z = 0, hjul som egne noder (wheel_fl/fr/rl/rr, origo i navet),
#   decimering, og procedurale PBR-materialer (lak med snavs, rust, regnstriber, træ, gummi, krom) der bages sammen med AO
#   til ét farveatlas pr. køretøj. Mål og nøglepunkter skrives til public/assets/vehicles/<id>.json (bruges af intro.js).
# Kør:  blender -b --factory-startup -P tools/vehicles/convert.py -- [maxxpro gaz] [--render DIR]
import bpy, bmesh, sys, os, math, json
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(HERE, 'src'); OUT = os.path.join(ROOT, 'public', 'assets', 'vehicles'); CACHE = os.path.join(HERE, 'cache')
os.makedirs(OUT, exist_ok=True); os.makedirs(CACHE, exist_ok=True)
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
RENDER = ARGS[ARGS.index('--render') + 1] if '--render' in ARGS else None
IDS = [a for i, a in enumerate(ARGS) if not a.startswith('--') and (i == 0 or ARGS[i - 1] != '--render')] or ['maxxpro', 'gaz']
FONT = '/System/Library/Fonts/Supplemental/Arial Black.ttf'

def lin(h):
    c = [((h >> s) & 255) / 255 for s in (16, 8, 0)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

def activate(ob):
    bpy.context.view_layer.update()
    for o in bpy.context.view_layer.objects: o.select_set(False)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)

def select(obs):
    activate(obs[0])
    for o in obs[1:]: o.select_set(True)

def join(obs, name):
    obs = [o for o in obs if o]; select(obs); bpy.ops.object.join(); obs[0].name = name; obs[0].data.name = name; return obs[0]

def apply_all(obs):
    select(obs); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

def tris(o): return sum(len(p.vertices) - 2 for p in o.data.polygons)

def bbox(obs):
    mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
    for o in obs:
        for v in o.data.vertices:
            w = o.matrix_world @ v.co; mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
    return mn, mx

def set_origin(ob, p):
    p = Vector(p); ob.data.transform(Matrix.Translation(ob.location - p)); ob.location = p

def decimate(ob, target):
    n = tris(ob)
    if n <= target: return
    m = ob.modifiers.new('dec', 'DECIMATE'); m.ratio = max(0.02, target / n); m.use_collapse_triangulate = True
    activate(ob); bpy.ops.object.modifier_apply(modifier=m.name)
    print('  decimeret %-14s %7d → %7d' % (ob.name, n, tris(ob)))

def smooth_by_angle(ob, deg=40):
    for p in ob.data.polygons: p.use_smooth = True
    try:
        activate(ob); bpy.ops.object.shade_auto_smooth(angle=math.radians(deg))
    except Exception:
        try: ob.data.set_sharp_from_angle(angle=math.radians(deg))
        except Exception as e: print('auto smooth', e)

def separate_faces(ob, pred, name):
    """flyt flader hvor pred(center, normal) er sand over i et nyt objekt"""
    bm = bmesh.new(); bm.from_mesh(ob.data)
    sel = [f for f in bm.faces if pred(ob.matrix_world @ f.calc_center_median(), f.normal)]
    if not sel: bm.free(); return None
    me2 = bpy.data.meshes.new(name); bm2 = bmesh.new()
    vm = {}
    for f in sel:
        vs = []
        for v in f.verts:
            if v not in vm: vm[v] = bm2.verts.new(v.co)
            vs.append(vm[v])
        try:
            nf = bm2.faces.new(vs); nf.material_index = f.material_index; nf.smooth = f.smooth
        except ValueError: pass
    bm2.to_mesh(me2); bm2.free()
    bmesh.ops.delete(bm, geom=sel, context='FACES_ONLY'); bm.to_mesh(ob.data); bm.free()
    o2 = bpy.data.objects.new(name, me2); bpy.context.scene.collection.objects.link(o2); o2.matrix_world = ob.matrix_world.copy()
    for m in ob.data.materials: me2.materials.append(m)
    return o2

# ======================================================================================= procedurale materialer
#   hvert materiale: (basisfarve, ruhed, metal, 'kind'). kind styrer det procedurale lag der bages ind i atlasset.
MATS = {}
def pmat(name, col, rough, metal=0.0, kind='paint', emit=None, alpha=None, coat=0.0):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*lin(col), 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if coat: b.inputs['Coat Weight'].default_value = coat; b.inputs['Coat Roughness'].default_value = 0.25
    if emit: b.inputs['Emission Color'].default_value = (*lin(emit[0]), 1); b.inputs['Emission Strength'].default_value = emit[1]
    if alpha is not None:
        b.inputs['Alpha'].default_value = alpha
        try: m.surface_render_method = 'BLENDED'
        except Exception: pass
    m['kind'] = 'none' if (emit or alpha is not None) else kind; m['col'] = col
    MATS[name] = m; return m

def _n(nt, t, **kw):
    n = nt.nodes.new(t)
    for k, v in kw.items():
        if k in n.inputs: n.inputs[k].default_value = v
        else: setattr(n, k, v)
    return n

def proc_color(nt, kind, col, ao):
    """byg node-grafen for materialets farve (lineær RGB) inkl. AO-faktoren 'ao' – returnerer output-socket"""
    L = nt.links.new
    geo = _n(nt, 'ShaderNodeNewGeometry'); tc = _n(nt, 'ShaderNodeTexCoord')
    sep = _n(nt, 'ShaderNodeSeparateXYZ'); L(geo.outputs['Position'], sep.inputs[0])
    base = _n(nt, 'ShaderNodeRGB'); base.outputs[0].default_value = (*lin(col), 1)
    def noise(scale, detail=6, rough=0.6, src=None):
        nz = _n(nt, 'ShaderNodeTexNoise', Scale=scale, Detail=detail, Roughness=rough); L((src or tc.outputs['Object']), nz.inputs['Vector']); return nz.outputs['Fac']
    def mrange(v, a, b, c, d):
        r = _n(nt, 'ShaderNodeMapRange', **{'From Min': a, 'From Max': b, 'To Min': c, 'To Max': d}); r.clamp = True; L(v, r.inputs['Value']); return r.outputs['Result']
    def mix(a, b, f, mode='MIX'):
        m = _n(nt, 'ShaderNodeMix', data_type='RGBA', blend_type=mode); L(f, m.inputs['Factor']) if not isinstance(f, float) else None
        if isinstance(f, float): m.inputs['Factor'].default_value = f
        L(a, m.inputs['A']) if not isinstance(a, tuple) else None; L(b, m.inputs['B']) if not isinstance(b, tuple) else None
        if isinstance(a, tuple): m.inputs['A'].default_value = a
        if isinstance(b, tuple): m.inputs['B'].default_value = b
        return m.outputs['Result']
    c = base.outputs[0]
    if kind in ('paint', 'paint_old'):
        old = kind == 'paint_old'
        c = mix(c, mix(c, (0.0, 0.0, 0.0, 1), 0.35), mrange(noise(4.0), 0.35, 0.75, 0.0, 0.5 if old else 0.3))           # ujævn falmet lak
        # regnstriber: lodret strakt bølge/støj (mørkere og lysere løb ned ad pladerne)
        mp = _n(nt, 'ShaderNodeMapping'); mp.inputs['Scale'].default_value = (14.0, 14.0, 0.7); L(tc.outputs['Object'], mp.inputs['Vector'])
        c = mix(c, mix(c, (0.0, 0.0, 0.0, 1), 0.5), mrange(noise(3.0, 4, 0.5, mp.outputs['Vector']), 0.5, 0.8, 0.0, 0.35))
        # snavs nedefra (vejsnavs og stænk op ad siderne)
        dirt = (*lin(0x3a3226), 1)
        f = mrange(sep.outputs['Z'], 0.2, 1.1, 0.6, 0.0); g = mrange(noise(9.0, 8, 0.7), 0.3, 0.7, 0.3, 1.1)
        fm = _n(nt, 'ShaderNodeMath', operation='MULTIPLY'); L(f, fm.inputs[0]); L(g, fm.inputs[1])
        c = mix(c, dirt, fm.outputs[0])
        # rust/afskalning i hulninger og kanter (lav AO) – kun den gamle lastbil rigtigt meget
        rust = (*lin(0x5a2e16), 1); inv = mrange(ao, 0.2, 0.6, 0.8 if old else 0.4, 0.0)
        rn = mrange(noise(22.0, 10, 0.75), 0.45, 0.65, 0.0, 1.0); rm = _n(nt, 'ShaderNodeMath', operation='MULTIPLY'); L(inv, rm.inputs[0]); L(rn, rm.inputs[1])
        c = mix(c, rust, rm.outputs[0])
        if old:                                                                                                          # store afskallede pletter med bart metal/rust
            pp = mrange(noise(2.2, 3, 0.5), 0.66, 0.69, 0.0, 0.7); c = mix(c, (*lin(0x4a2a18), 1), pp)
    elif kind == 'wood':
        mp = _n(nt, 'ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1.0, 30.0, 1.0); L(tc.outputs['Object'], mp.inputs['Vector'])
        w = _n(nt, 'ShaderNodeTexWave', wave_type='BANDS', bands_direction='X'); w.inputs['Scale'].default_value = 3.0; w.inputs['Distortion'].default_value = 6.0; w.inputs['Detail'].default_value = 4
        L(mp.outputs['Vector'], w.inputs['Vector'])
        c = mix(c, mix(c, (0.0, 0.0, 0.0, 1), 0.55), mrange(w.outputs['Fac'], 0.2, 0.9, 0.0, 0.6))
        c = mix(c, (*lin(0x6d6a62), 1), mrange(noise(1.5), 0.4, 0.8, 0.0, 0.55))                                        # gråt, udvasket træ
        c = mix(c, (*lin(0x231d16), 1), mrange(sep.outputs['Z'], 0.6, 1.3, 0.5, 0.0))
    elif kind == 'rubber':
        c = mix(c, (*lin(0x4b4237), 1), mrange(noise(12.0), 0.45, 0.8, 0.0, 0.22))                                       # støv i slidbanen
    elif kind == 'metal':
        c = mix(c, (*lin(0x4a2a18), 1), mrange(noise(16.0, 10, 0.7), 0.5, 0.7, 0.0, 0.6))
    # AO ganges på
    aom = _n(nt, 'ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY'); aom.inputs['Factor'].default_value = 1.0
    L(c, aom.inputs['A']); cc = _n(nt, 'ShaderNodeCombineColor'); L(ao, cc.inputs[0]); L(ao, cc.inputs[1]); L(ao, cc.inputs[2]); L(cc.outputs[0], aom.inputs['B'])
    return aom.outputs['Result']

def bake_atlas(objs, vid, size=2048):
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.cycles.use_denoising = False
    try:
        pr = bpy.context.preferences.addons['cycles'].preferences; pr.compute_device_type = 'METAL'; pr.get_devices()
        for d in pr.devices: d.use = True
        sc.cycles.device = 'GPU'
    except Exception as e: print('GPU', e)
    im = bpy.data.images.new(vid + '_col', size, size)
    for o in objs:
        activate(o); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=math.radians(55), island_margin=0.002); bpy.ops.object.mode_set(mode='OBJECT')
    select(objs); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(margin=0.002); bpy.ops.object.mode_set(mode='OBJECT')
    # midlertidigt: hvert materiale udsender sin procedurale farve × AO (eller sin flade farve, for glas/lys)
    saved = {}
    for m in MATS.values():
        nt = m.node_tree; out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'); saved[m.name] = out.inputs['Surface'].links[0].from_socket
        ao = _n(nt, 'ShaderNodeAmbientOcclusion', samples=24); ao.inputs['Distance'].default_value = 0.4
        mx_ = _n(nt, 'ShaderNodeMath', operation='MAXIMUM'); mx_.inputs[1].default_value = 0.3; nt.links.new(ao.outputs['AO'], mx_.inputs[0])
        pw = _n(nt, 'ShaderNodeMath', operation='POWER'); pw.inputs[1].default_value = 1.25; nt.links.new(mx_.outputs[0], pw.inputs[0])
        col = proc_color(nt, m['kind'] if m['kind'] != 'none' else 'flat', m['col'], pw.outputs[0])
        em = _n(nt, 'ShaderNodeEmission'); nt.links.new(col, em.inputs['Color']); nt.links.new(em.outputs[0], out.inputs['Surface'])
        tn = _n(nt, 'ShaderNodeTexImage'); tn.image = im; nt.nodes.active = tn; m['_tn'] = tn.name
    select(objs); sc.render.bake.margin = 4; bpy.ops.object.bake(type='EMIT')
    im.filepath_raw = os.path.join(CACHE, vid + '_col.png'); im.file_format = 'PNG'; im.save()
    # tilbage til PBR – farven kommer nu fra atlasset (glas og lys beholder deres egen farve)
    for m in MATS.values():
        nt = m.node_tree; out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'); nt.links.new(saved[m.name], out.inputs['Surface'])
        if m['kind'] == 'none': continue
        b = nt.nodes['Principled BSDF']; nt.links.new(nt.nodes[m['_tn']].outputs['Color'], b.inputs['Base Color'])

def text(name, s, size, m, loc, rot, ext=0.003):
    cu = bpy.data.curves.new(name, 'FONT'); cu.body = s; cu.size = size; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.extrude = ext
    if os.path.exists(FONT): cu.font = bpy.data.fonts.load(FONT, check_existing=True)
    to = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(to); to.location = loc; to.rotation_euler = rot
    activate(to); bpy.ops.object.convert(target='MESH'); ob = bpy.context.view_layer.objects.active
    ob.data.materials.clear(); ob.data.materials.append(m); return ob

def surface_x(y, z, side, objs):
    """sidefladens x ved (y, z) via stråle udefra (side = +1/−1)"""
    dg = bpy.context.evaluated_depsgraph_get()
    hit, loc, nor, *_ = bpy.context.scene.ray_cast(dg, Vector((side * 5, y, z)), Vector((-side, 0, 0)))
    return (loc.x, nor) if hit else (None, None)

# ======================================================================================= MaxxPro (SWAT)
def build_maxxpro():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.obj_import(filepath=os.path.join(SRC, 'maxxpro.obj'))
    obs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    S = 6.4 / 7.66
    for o in obs: o.matrix_world = Matrix.Rotation(math.pi, 4, 'Z') @ Matrix.Scale(S, 4) @ o.matrix_world   # fremad −Y (glTF +Z)
    apply_all(obs)
    mn, mx = bbox([o for o in obs if not o.name.startswith('Cube.024')])
    off = Vector((-(mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, -bbox([o for o in obs if o.name.startswith('Plane.00')])[0].z))
    for o in obs: o.location += off
    apply_all(obs)
    paint = pmat('swat_paint', 0x1b2129, 0.42, 0.25, 'paint', coat=0.35); black = pmat('swat_black', 0x0e0f10, 0.6, 0.0, 'metal')
    chrome = pmat('chrome', 0x9aa0a6, 0.18, 1.0, 'flat'); glass = pmat('swat_glass', 0x0a1014, 0.05, 0.0, 'flat', alpha=0.55)
    tire = pmat('tire', 0x151515, 0.88, 0.0, 'rubber'); rim = pmat('swat_rim', 0x2b2d2f, 0.45, 0.6, 'metal')
    white = pmat('decal', 0xd8d8d2, 0.45, 0.0, 'flat', emit=(0x000000, 0.0)); lamp = pmat('lamp_in', 0xffd8a0, 0.5, emit=(0xffcf8a, 6.0))
    red = pmat('strobe_r', 0xff2010, 0.4, emit=(0xff1a0a, 14.0)); blue = pmat('strobe_b', 0x2040ff, 0.4, emit=(0x2a48ff, 14.0))
    head = pmat('headlight', 0xfff4e0, 0.2, emit=(0xfff0d8, 10.0))
    MAP = {'blastic': paint, 'blastic.001': paint, 'blastic.002': black, 'blastic.004': black, 'mirror': chrome, 'mirror.002': chrome,
           'glass': glass, 'black': black, 'Material.000': rim}
    wheels, body, ramp = [], [], None
    for o in obs:
        for i, sl in enumerate(o.material_slots):
            nm = sl.material.name if sl.material else ''
            if o.name.startswith('Plane.00'): sl.material = tire if nm.startswith('blastic') else rim
            else: sl.material = MAP.get(nm, paint)
        if o.name.startswith('Plane.00'): wheels.append(o)
        elif o.name.startswith('Cube.024'): ramp = o
        else: body.append(o)
    body = join(body, 'body')
    # hjul: origo i navet, navngivet efter position (venstre = +x i three.js når man kører mod +Z → −x her er højre)
    W = []
    for w in wheels:
        a, b = bbox([w]); c = (a + b) / 2; set_origin(w, c)
        front = c.y < 0; left = c.x > 0
        w.name = 'wheel_' + ('f' if front else 'r') + ('l' if left else 'r'); decimate(w, 5200); smooth_by_angle(w, 50); W.append(w)
    wheelR = (bbox([W[0]])[1].z - bbox([W[0]])[0].z) / 2
    # bagrampen: hængslet ved dørtærsklen (øverste kant), lukket = drejet op til lodret
    ra, rb = bbox([ramp])
    hinge = Vector((0, ra.y, rb.z)) if abs(ra.y) < abs(rb.y) else Vector((0, rb.y, rb.z))
    set_origin(ramp, hinge)
    tip_y = rb.y if abs(rb.y) > abs(ra.y) else ra.y; ang = math.atan2(rb.z - ra.z, abs(tip_y - hinge.y))   # hældning under vandret
    # lukket: drej om x så rampen står lodret op fra hængslet (spidsen peger +z)
    rot_closed = (math.pi / 2 + ang)
    ramp.data.transform(Matrix.Rotation(rot_closed if hinge.y > 0 else -rot_closed, 4, 'X'))
    ramp.name = 'tailgate'; decimate(ramp, 2500)
    open_ang = rot_closed                                                                       # så meget drejes den ned i intro'en
    decimate(body, 70000); smooth_by_angle(body, 35)
    bmn, bmx = bbox([body])
    # indvendigt loftslys (tændes når rampen går ned), politistrober bag gitteret, forlygter
    def plate(name, c, s, m):
        bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts: v.co = Vector((v.co.x * s[0], v.co.y * s[1], v.co.z * s[2]))
        me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
        ob.location = c; me.materials.append(m); return ob
    door_top = hinge.z + 1.75
    li = plate('lights_inner', (0, hinge.y - 1.2 * (1 if hinge.y > 0 else -1), min(door_top, bmx.z - 0.5)), (0.5, 1.6, 0.03), lamp)
    fy = bmn.y + 0.05
    strobes = [plate('strobe_l', (0.55, fy, 0.95), (0.16, 0.03, 0.05), red), plate('strobe_r', (-0.55, fy, 0.95), (0.16, 0.03, 0.05), blue)]
    # dekaler: POLICE på siderne + SWAT bagpå rampen
    dec = []
    for side in (1, -1):
        y0, z0 = (bmn.y + bmx.y) / 2 + 0.6, 1.45
        x, nor = surface_x(y0, z0, side, [body])
        if x is not None:
            dec.append(text('dec_police', 'POLICE', 0.36, white, (x + side * 0.004, y0, z0), (math.pi / 2, 0, math.pi / 2 if side > 0 else -math.pi / 2)))
    qa, qb = bbox([ramp])
    sw = text('dec_swat', 'SWAT', 0.3, white, (0, qb.y + 0.004, hinge.z + 1.0), (math.pi / 2, 0, math.pi))
    sw.parent = ramp
    sw.matrix_parent_inverse = ramp.matrix_world.inverted()
    body = join([body] + strobes, 'body')
    for d in dec: d.parent = body
    objs = [body, ramp, li] + W
    meta = dict(len=round(bmx.y - bmn.y, 2), wid=round(bmx.x - bmn.x, 2), height=round(bmx.z, 2), wheelR=round(wheelR, 3),
                rearY=round(hinge.z, 2), rear=-round(abs(hinge.y), 2), tailOpen=round(open_ang, 3), seats=None)
    return objs + dec + [sw], meta

# ======================================================================================= GAZ-53 (hijackere)
def build_gaz():
    bpy.ops.wm.open_mainfile(filepath=os.path.join(SRC, 'gaz.blend'))
    for o in list(bpy.data.objects):
        if o.type != 'MESH': bpy.data.objects.remove(o)
    obs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in obs:
        if o.parent: o.parent = None
    for o in obs:
        for mo in list(o.modifiers):
            activate(o)
            try: bpy.ops.object.modifier_apply(modifier=mo.name)
            except Exception: o.modifiers.remove(mo)
    S = 6.4 / 9.36
    for o in obs: o.matrix_world = Matrix.Rotation(math.pi / 2, 4, 'Z') @ Matrix.Scale(S, 4) @ o.matrix_world      # front (−x) → −y
    apply_all(obs)
    mn, mx = bbox(obs)
    big = [o for o in obs if o.name in ('Circle.016', 'Circle.020', 'Circle.021', 'Circle.402')]
    off = Vector((-(mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, -bbox(big)[0].z))
    for o in obs: o.location += off
    apply_all(obs)
    cab = pmat('gaz_paint', 0x5a6a3e, 0.62, 0.15, 'paint_old', coat=0.08); wood = pmat('gaz_wood', 0x5e4a33, 0.85, 0.0, 'wood')
    frame = pmat('gaz_frame', 0x1a1a18, 0.7, 0.3, 'metal'); tire = pmat('tire', 0x161514, 0.9, 0.0, 'rubber'); rim = pmat('gaz_rim', 0x3f4630, 0.6, 0.3, 'paint_old')
    chrome = pmat('chrome', 0x9aa0a6, 0.25, 1.0, 'flat'); glass = pmat('gaz_glass', 0x141a16, 0.06, 0.0, 'flat', alpha=0.6)
    lens = pmat('gaz_lens', 0xe8e0c8, 0.2, emit=(0xffe2b0, 5.0)); bumper = pmat('gaz_bumper', 0x23241f, 0.55, 0.5, 'metal')
    # materialer efter navn (teksturerne mangler) – lakken på førerhus/skærme, træ på ladet, sort chassis
    # efter teksturnavnene i materialerne (kabina.tga = lak, cargo.tga = ladet, chassis*.tga = ramme, tire2.tga = hjul, lights.tga = lygter …)
    MAP = {'Material.006': cab, 'Material.015': wood, 'Material.010': wood, 'Material.012': frame, 'Material.008': frame, 'Material.011': frame,
           'Material.016': cab, 'Material.013': bumper, 'Material.014': chrome, 'Material.003': bumper, 'Material.002': lens, 'Material.009': lens,
           'Material.007': frame, 'Material.005': cab, 'Material.001': glass, '_': frame, 'Glass': glass, 'GlassFlintMedium': glass}
    OBJ = {'kabina.011': cab}                                                     # dørpanelet deler materiale med ruderne
    TIRES = {'Circle.016': 'wheel_fl', 'Circle.020': 'wheel_fr', 'Circle.402': 'wheel_rl', 'Circle.021': 'wheel_rr'}
    wheels = {}
    for o in obs:
        for sl in o.material_slots:
            nm = sl.material.name if sl.material else ''
            sl.material = OBJ.get(o.name) or MAP.get(nm, glass if 'Default' in nm or 'Glass' in nm else frame)
    # hjul: dæk + fælge/nav der sidder i dækkets akse samles til én node
    for tn, wn in TIRES.items():
        t = bpy.data.objects[tn]; a, b = bbox([t]); c = (a + b) / 2; R = (b.z - a.z) / 2
        for sl in t.material_slots: sl.material = tire
        parts = [t]
        for o in [x for x in bpy.context.scene.objects if x.type == 'MESH' and x.name not in wheels.values() and not x.name.startswith('wheel_')]:
            if o is t or o.name in TIRES or o.name == 'Circle.019': continue
            oa, ob_ = bbox([o]); oc = (oa + ob_) / 2
            if (oc - c).length < R * 0.55 and (ob_.x - oa.x) < 0.45 and max(ob_.y - oa.y, ob_.z - oa.z) < R * 2.05 and abs(oc.z - c.z) < R * 0.25 and abs(oc.x - c.x) < 0.3:
                for sl in o.material_slots: sl.material = rim
                parts.append(o)
        print('  hjul', wn, [(o.name, tris(o)) for o in parts])
        w = join(parts, wn); set_origin(w, c); wheels[wn] = w
    rest = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name not in wheels]
    body = join(rest, 'body')
    bmn, bmx = bbox([body])
    # bagsmækken: ladets bageste plade (flader inden for 6 cm af den bageste kant over ladets bund)
    wood_i = [i for i, m in enumerate(body.data.materials) if m == wood]
    hist = {}
    for p in body.data.polygons:
        if p.material_index in wood_i and p.normal.z > 0.9 and p.center.y > 0:
            k = round(p.center.z / 0.02); hist[k] = hist.get(k, 0) + p.area
    bed_floor = max(hist, key=hist.get) * 0.02 if hist else None
    print('  ladets bund', bed_floor)
    rear_y = max(v.co.y for v in body.data.vertices)
    tg = separate_faces(body, lambda c, n: c.y > rear_y - 0.07 and c.z > (bed_floor or 1.0) - 0.15 and abs(c.x) < (bmx.x - bmn.x) / 2 - 0.02, 'tailgate')
    print('  bagsmæk', tg and tris(tg))
    if tg:
        decimate(tg, 3000)
        ta, tb = bbox([tg]); set_origin(tg, (0, tb.y, ta.z))
    for w in wheels.values(): decimate(w, 4200); smooth_by_angle(w, 50)
    decimate(body, 60000); smooth_by_angle(body, 35)
    objs = [body] + list(wheels.values()) + ([tg] if tg else [])
    wr = (bbox([wheels['wheel_fl']])[1].z - bbox([wheels['wheel_fl']])[0].z) / 2
    bf = bed_floor or 1.2
    # pladser på ladet (lokale koordinater i three.js: x, y, z = Blender x, z, −y)
    by0 = rear_y - 0.5
    seats = [[0.55, bf, -(by0 - 0.3)], [-0.55, bf, -(by0 - 0.9)], [0.0, bf, -(by0 - 1.5)], [0.5, 0.0, -(bmn.y + 2.0)], [-0.5, 0.0, -(bmn.y + 2.0)]]
    meta = dict(len=round(bmx.y - bmn.y, 2), wid=round(bmx.x - bmn.x, 2), height=round(bmx.z, 2), wheelR=round(wr, 3), bedY=round(bf, 2),
                rear=-round(rear_y, 2), rearY=round(bf, 2), tailOpen=1.5, seats=[[round(v, 2) for v in s] for s in seats])
    return objs, meta

def render(vid, objs, outdir):
    os.makedirs(outdir, exist_ok=True); sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 64; sc.view_settings.view_transform = 'AgX'
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.42, 0.47, 0.55, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.7
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun); sun.data.energy = 3.5; sun.rotation_euler = (0.9, 0.2, 0.8)
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=14); me = bpy.data.meshes.new('g'); bm.to_mesh(me); g = bpy.data.objects.new('ground', me); sc.collection.objects.link(g)
    me.materials.append(pmat('Ground', 0x6f6a60, 0.95, kind='flat'))
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 38
    for i, (p, t) in enumerate((((-7.0, -8.0, 2.6), (0, 0, 1.2)), ((7.0, 6.5, 2.4), (0, 0.8, 1.3)), ((-2.5, 9.5, 1.7), (0, 2.6, 1.3)), ((8.5, -1.0, 6.0), (0, 0, 0.8)))):
        cam.location = p; cam.rotation_euler = (Vector(t) - Vector(p)).to_track_quat('-Z', 'Y').to_euler()
        sc.render.resolution_x = 960; sc.render.resolution_y = 600; sc.render.resolution_percentage = 100; sc.render.filepath = os.path.join(outdir, '%s_%d.png' % (vid, i)); bpy.ops.render.render(write_still=True)

def export(vid, objs):
    for o in bpy.context.view_layer.objects: o.select_set(False)
    for o in objs: o.select_set(True)
    path = os.path.join(OUT, vid + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_image_format='JPEG', export_jpeg_quality=88, export_yup=True, export_apply=True)
    print('EXPORT', path, round(os.path.getsize(path) / 1e6, 2), 'MB')

for vid in IDS:
    MATS.clear()
    objs, meta = build_maxxpro() if vid == 'maxxpro' else build_gaz()
    MATS_USED = set()
    for o in objs:
        for s in o.material_slots:
            if s.material: MATS_USED.add(s.material.name)
    for k in list(MATS):
        if k not in MATS_USED: del MATS[k]
    meshes = [o for o in objs if o.type == 'MESH']
    print('TRIS', vid, sum(tris(o) for o in meshes), meta)
    bake_atlas([o for o in meshes if not o.name.startswith('dec_')], vid, 2048)
    json.dump(meta, open(os.path.join(OUT, vid + '.json'), 'w'), indent=1)
    if RENDER: render(vid, meshes, RENDER)
    if '--noexport' not in ARGS: export(vid, meshes)
