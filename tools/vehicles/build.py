# v22: køretøjer til intro-cutscenen (modelleret proceduralt i Blender, eget arbejde/CC0)
#   swat_truck : pansret SWAT-køretøj (BearCat-stil): skråt panser, skudsikre ruder, lysbjælke, rambuk, to bagdøre (animeres), bænke inde i rummet
#   technical  : slidt pickup (Hilux-stil) med lad, bagsmæk (animeres), styrtbøjle, reservehjul og dunke
#   Noder spillet bruger: wheel_fl/fr/rl/rr (drejer om egen x-akse), door_l/door_r/tailgate (hængsel = nodens origo), lights_* (emissive)
#   Fremad = -Y i Blender (= +Z i glTF/three.js).  Teksturer: smart-UV + bagt AO/snavs (Cycles) ganget på lakfarven.
# Kør:  blender -b --factory-startup -P tools/vehicles/build.py -- [swat_truck technical] [--render DIR] [--noexport]
import bpy, bmesh, sys, os, math, random
import numpy as np
from mathutils import Vector, Matrix, Euler

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'assets', 'vehicles'); os.makedirs(OUT, exist_ok=True)
CACHE = os.path.join(ROOT, 'tools', 'vehicles', 'cache'); os.makedirs(CACHE, exist_ok=True)
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
RENDER = ARGS[ARGS.index('--render') + 1] if '--render' in ARGS else None
IDS = [a for i, a in enumerate(ARGS) if not a.startswith('--') and (i == 0 or ARGS[i - 1] != '--render')] or ['swat_truck', 'technical']
FONT = '/System/Library/Fonts/Supplemental/Arial Black.ttf'

def lin(h):
    c = [((h >> s) & 255) / 255 for s in (16, 8, 0)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

MATS = {}
def mat(name, col, r=0.5, metal=0.0, emit=None, alpha=None, coat=0.0):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*lin(col), 1); b.inputs['Roughness'].default_value = r; b.inputs['Metallic'].default_value = metal
    if coat: b.inputs['Coat Weight'].default_value = coat
    if emit: b.inputs['Emission Color'].default_value = (*lin(emit[0]), 1); b.inputs['Emission Strength'].default_value = emit[1]
    if alpha is not None: b.inputs['Alpha'].default_value = alpha; m.blend_method = 'BLEND' if hasattr(m, 'blend_method') else None
    m['bake'] = 0 if emit or alpha is not None else 1
    MATS[name] = m; return m

def link(ob):
    bpy.context.scene.collection.objects.link(ob); return ob

def obj_from_bm(name, bm, m=None, smooth=False):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = link(bpy.data.objects.new(name, me))
    if m: me.materials.append(m)
    for p in me.polygons: p.use_smooth = smooth
    return ob

def activate(ob):
    bpy.context.view_layer.update()
    for o in bpy.context.view_layer.objects: o.select_set(False)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)

def mod_apply(ob, typ, **kw):
    m = ob.modifiers.new(typ.lower(), typ)
    for k, v in kw.items(): setattr(m, k, v)
    activate(ob); bpy.ops.object.modifier_apply(modifier=m.name)

def box(name, c, s, m, bev=0.02, seg=2, rot=(0, 0, 0)):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co = Vector((v.co.x * s[0], v.co.y * s[1], v.co.z * s[2]))
    ob = obj_from_bm(name, bm, m); ob.location = c; ob.rotation_euler = rot
    if bev: mod_apply(ob, 'BEVEL', width=bev, segments=seg, limit_method='ANGLE')
    return ob

def prism(name, prof, x0, x1, m, bev=0.02, seg=2):
    """ekstruderet profil: prof = [(y, z), ...] i YZ-planet (sidebillede), fra x0 til x1"""
    bm = bmesh.new()
    a = [bm.verts.new((x0, y, z)) for y, z in prof]; b = [bm.verts.new((x1, y, z)) for y, z in prof]
    bm.faces.new(a[::-1]); bm.faces.new(b)
    n = len(prof)
    for i in range(n): bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ob = obj_from_bm(name, bm, m)
    if bev: mod_apply(ob, 'BEVEL', width=bev, segments=seg, limit_method='ANGLE')
    return ob

def cyl(name, c, r, h, m, axis='X', seg=32, bev=0.0, r2=None):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    ob = obj_from_bm(name, bm, m, smooth=True)
    ob.rotation_euler = {'X': (0, math.pi / 2, 0), 'Y': (math.pi / 2, 0, 0), 'Z': (0, 0, 0)}[axis]; ob.location = c
    activate(ob); bpy.ops.object.transform_apply(rotation=True)
    if bev: mod_apply(ob, 'BEVEL', width=bev, segments=2, limit_method='ANGLE')
    for p in ob.data.polygons: p.use_smooth = True
    return ob

def join(obs, name):
    obs = [o for o in obs if o]
    activate(obs[0])
    for o in obs[1:]: o.select_set(True)
    bpy.ops.object.join(); obs[0].name = name; return obs[0]

def text(name, s, size, m, loc, rot, ext=0.004):
    cu = bpy.data.curves.new(name, 'FONT'); cu.body = s; cu.size = size; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.extrude = ext
    if os.path.exists(FONT): cu.font = bpy.data.fonts.load(FONT, check_existing=True)
    to = link(bpy.data.objects.new(name, cu)); to.location = loc; to.rotation_euler = rot
    activate(to); bpy.ops.object.convert(target='MESH'); ob = bpy.context.view_layer.objects.active
    ob.data.materials.clear(); ob.data.materials.append(m); return ob

def set_origin(ob, p):
    """flyt objektets origo (hængsel/akse) til p uden at flytte geometrien"""
    p = Vector(p); ob.data.transform(Matrix.Translation(-(p - ob.location))); ob.location = p

def wheel(name, c, R, W, tire, rim, hub, spokes=8):
    """dæk med slidbaneblokke, fælg med huller og bolte – drejer om x"""
    parts = []
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=48, radius1=R, radius2=R, depth=W)
    t = obj_from_bm(name + '_t', bm, tire, smooth=True); t.rotation_euler = (0, math.pi / 2, 0)
    activate(t); bpy.ops.object.transform_apply(rotation=True)
    mod_apply(t, 'BEVEL', width=W * 0.28, segments=4, limit_method='ANGLE', angle_limit=math.radians(40))
    parts.append(t)
    for i in range(30):                                                         # slidbane: skrå blokke rundt om dækket
        a = i / 30 * math.pi * 2
        for k, off in enumerate((-W * 0.22, W * 0.22)):
            b = box(name + '_tb', (off, math.cos(a + k * 0.1) * (R + 0.008), math.sin(a + k * 0.1) * (R + 0.008)), (W * 0.36, 0.05, 0.022), tire, bev=0.006, seg=1,
                    rot=(a + k * 0.1 + math.pi / 2, 0, 0.35 * (1 if k else -1)))
            parts.append(b)
    rr = R * 0.62
    parts.append(cyl(name + '_rim', (W * 0.08, 0, 0), rr, W * 0.82, rim, seg=32, bev=0.012))
    parts.append(cyl(name + '_dish', (W * 0.45, 0, 0), rr * 0.86, 0.03, rim, seg=32, bev=0.006))
    parts.append(cyl(name + '_hub', (W * 0.48, 0, 0), rr * 0.32, 0.07, hub, seg=20, bev=0.01))
    for i in range(spokes):                                                     # bolte
        a = i / spokes * math.pi * 2
        parts.append(cyl(name + '_bolt', (W * 0.52, math.cos(a) * rr * 0.45, math.sin(a) * rr * 0.45), 0.013, 0.04, hub, seg=8))
    for i in range(6):                                                          # huller i fælgen (mørke)
        a = i / 6 * math.pi * 2 + 0.3
        parts.append(cyl(name + '_hole', (W * 0.465, math.cos(a) * rr * 0.68, math.sin(a) * rr * 0.68), rr * 0.13, 0.012, mat('Hole', 0x0b0b0c, 0.9), seg=12))
    w = join(parts, name)
    set_origin(w, (0, 0, 0)); w.location = c
    return w

def mirror_x(ob, name):
    o2 = ob.copy(); o2.data = ob.data.copy(); o2.name = name; link(o2)
    o2.data.transform(Matrix.Scale(-1, 4, (1, 0, 0))); o2.location = (-ob.location.x, ob.location.y, ob.location.z)
    bm = bmesh.new(); bm.from_mesh(o2.data); bmesh.ops.reverse_faces(bm, faces=bm.faces[:]); bm.to_mesh(o2.data); bm.free()
    return o2

# ======================================================================================= SWAT-køretøj
def build_swat():
    paint = mat('Paint', 0x3d4c63, 0.45, 0.2, coat=0.4)
    trim = mat('Trim', 0x2a2d32, 0.6, 0.2)
    steel = mat('Steel', 0x8a8e93, 0.35, 0.85)
    glass = mat('Glass', 0x0d1418, 0.06, 0.1)
    tire = mat('Tire', 0x141414, 0.9)
    rim = mat('Rim', 0x22252a, 0.4, 0.7)
    hub = mat('Hub', 0x8a8d90, 0.3, 0.9)
    head = mat('Headlight', 0xffffff, 0.1, emit=(0xfff3dc, 6.0))
    tail = mat('Taillight', 0xff2010, 0.2, emit=(0xff1a0a, 4.0))
    red = mat('LightRed', 0xff2020, 0.2, emit=(0xff1010, 8.0))
    blue = mat('LightBlue', 0x2050ff, 0.2, emit=(0x1840ff, 8.0))
    white = mat('Decal', 0xe8eaec, 0.6)
    inner = mat('Interior', 0x26282c, 0.85)
    L, Wd = 6.1, 2.42
    yF, yB = -L / 2, L / 2
    parts = []
    # skærm/chassis-ramme + undervogn
    parts.append(box('frame', (0, 0.1, 0.62), (Wd * 0.86, L * 0.92, 0.32), trim, bev=0.03))
    # motorhjelm (skrå front) + kabine/kasse som profiler set fra siden
    hood = [(yF, 0.78), (yF, 1.38), (yF + 0.25, 1.62), (yF + 1.35, 1.72), (yF + 1.35, 0.78)]
    parts.append(prism('hood', hood, -Wd / 2 + 0.06, Wd / 2 - 0.06, paint, bev=0.05, seg=3))
    cab = [(yF + 1.3, 0.78), (yF + 1.3, 1.72), (yF + 1.95, 2.62), (yB - 0.05, 2.68), (yB, 2.6), (yB, 0.78)]
    parts.append(prism('body', cab, -Wd / 2, Wd / 2, paint, bev=0.06, seg=3))
    # forrude (to skrå paneler) og sideruder
    for sx in (-1, 1):
        g = box('wind', (sx * 0.5, yF + 1.64, 2.18), (0.86, 0.04, 0.92), glass, bev=0.01, rot=(math.atan2(0.65, 0.9) - math.pi / 2 + math.pi / 2 * 0 + 0.0, 0, 0))
        g.rotation_euler = (-math.atan2(0.65, 0.9), 0, 0); parts.append(g)
        parts.append(box('swin', (sx * (Wd / 2 + 0.002), yF + 2.45, 2.1), (0.02, 0.62, 0.42), glass, bev=0.005))
        parts.append(box('swin2', (sx * (Wd / 2 + 0.002), yF + 3.35, 2.1), (0.02, 0.52, 0.36), glass, bev=0.005))
        for yy in (yF + 3.9, yF + 4.6):                                          # skydeporte
            parts.append(cyl('port', (sx * (Wd / 2 + 0.01), yy, 1.85), 0.045, 0.03, trim, seg=16))
        # dørhåndtag, trin, gribehåndtag
        parts.append(box('handle', (sx * (Wd / 2 + 0.03), yF + 2.05, 1.62), (0.03, 0.22, 0.04), steel, bev=0.01))
        parts.append(box('step', (sx * (Wd / 2 - 0.05), yF + 2.3, 0.62), (0.22, 0.7, 0.05), steel, bev=0.01))
        parts.append(box('rail', (sx * (Wd / 2 + 0.03), yF + 2.75, 1.95), (0.025, 0.025, 0.55), steel, bev=0.008))
        parts.append(box('mirror', (sx * (Wd / 2 + 0.22), yF + 1.45, 2.05), (0.08, 0.14, 0.28), trim, bev=0.02))
        parts.append(box('marm', (sx * (Wd / 2 + 0.1), yF + 1.45, 2.05), (0.2, 0.03, 0.03), trim, bev=0.005))
        # forlygter, baglygter
        parts.append(box('hl', (sx * 0.86, yF - 0.005, 1.22), (0.3, 0.04, 0.14), head, bev=0.01))
        parts.append(box('tl', (sx * 1.02, yB + 0.004, 1.15), (0.16, 0.03, 0.26), tail, bev=0.008))
        # hjulkasser (skærme)
        for yy in (yF + 1.05, yB - 1.25):
            parts.append(box('fender', (sx * (Wd / 2 - 0.02), yy, 1.22), (0.16, 1.3, 0.08), trim, bev=0.02))
        # "POLICE" på siden + "SWAT"
        parts.append(text('txt', 'POLICE', 0.42, white, (sx * (Wd / 2 + 0.006), yF + 4.2, 1.35), (math.pi / 2, 0, sx * math.pi / 2)))
        parts.append(text('txt2', 'SWAT', 0.24, white, (sx * (Wd / 2 + 0.006), yF + 2.45, 1.55), (math.pi / 2, 0, sx * math.pi / 2)))
    # rambuk + kofanger, grill, nummerplade
    parts.append(box('ram', (0, yF - 0.22, 0.85), (Wd * 0.94, 0.22, 0.3), trim, bev=0.03))
    for sx in (-0.7, 0, 0.7): parts.append(box('ramv', (sx, yF - 0.3, 1.0), (0.12, 0.12, 0.6), trim, bev=0.02))
    parts.append(box('grill', (0, yF - 0.01, 1.08), (1.1, 0.04, 0.4), trim, bev=0.01))
    for i in range(7): parts.append(box('slat', (0, yF - 0.035, 0.92 + i * 0.05), (1.04, 0.02, 0.015), steel, bev=0.003))
    # tag: lysbjælke, luge, antenner
    parts.append(box('lbbase', (0, yF + 2.05, 2.69), (1.5, 0.3, 0.06), trim, bev=0.01))
    for i in range(6):
        parts.append(box('lb', (-0.62 + i * 0.248, yF + 2.05, 2.77), (0.22, 0.24, 0.1), red if i < 3 else blue, bev=0.02))
    parts.append(box('hatch', (0, yF + 3.8, 2.72), (0.8, 0.8, 0.08), paint, bev=0.02))
    parts.append(cyl('hatchring', (0, yF + 3.8, 2.78), 0.36, 0.05, trim, axis='Z', seg=32))
    for sx in (-0.9, 0.9): parts.append(cyl('ant', (sx, yB - 0.5, 3.2), 0.008, 1.0, trim, axis='Z', seg=8))
    # bagende: kofanger med trin, lygte over døre, indvendigt rum (mørkt) + bænke
    parts.append(box('rbump', (0, yB + 0.15, 0.72), (Wd * 0.9, 0.32, 0.18), trim, bev=0.02))
    parts.append(box('rstep', (0, yB + 0.32, 0.55), (1.2, 0.3, 0.05), steel, bev=0.01))
    parts.append(box('inner', (0, yB - 1.5, 1.72), (Wd - 0.16, 2.9, 1.8), inner, bev=0.0))
    for sx in (-1, 1):
        parts.append(box('bench', (sx * (Wd / 2 - 0.35), yB - 1.4, 1.18), (0.42, 2.4, 0.12), mat('Seat', 0x2b2e33, 0.7), bev=0.02))
        parts.append(box('back', (sx * (Wd / 2 - 0.12), yB - 1.4, 1.6), (0.08, 2.4, 0.6), mat('Seat', 0x2b2e33, 0.7), bev=0.02))
    parts.append(box('rlamp', (0, yB - 0.02, 2.62), (0.5, 0.06, 0.06), head, bev=0.01))
    body = join(parts, 'body')
    # bagdøre: to plader med rude og håndtag, hængsel ved yderkanten
    doors = []
    for sx, nm in ((-1, 'door_l'), (1, 'door_r')):
        dp = [box(nm + 'p', (sx * 0.555, yB + 0.035, 1.72), (1.08, 0.07, 1.78), paint, bev=0.025)]
        dp.append(box(nm + 'w', (sx * 0.555, yB + 0.075, 2.18), (0.5, 0.02, 0.34), glass, bev=0.006))
        dp.append(box(nm + 'h', (sx * 0.16, yB + 0.09, 1.62), (0.04, 0.04, 0.24), steel, bev=0.008))
        for zz in (1.05, 2.4): dp.append(box(nm + 'hinge', (sx * 1.1, yB + 0.07, zz), (0.06, 0.06, 0.16), steel, bev=0.008))
        dp.append(text(nm + 't', 'SWAT', 0.2, white, (sx * 0.555, yB + 0.072, 1.45), (math.pi / 2, 0, math.pi)))
        d = join(dp, nm); set_origin(d, (sx * 1.1, yB + 0.035, 1.72)); doors.append(d)
    # indvendig rød lampe (synlig når dørene åbnes)
    lamp = box('lights_inner', (0, yB - 1.5, 2.6), (0.6, 0.12, 0.04), mat('InnerLamp', 0xff3020, 0.2, emit=(0xff2a14, 5.0)), bev=0.01)
    wheels = []
    tire_m, rim_m, hub_m = tire, rim, hub
    for nm, x, y in (('wheel_fl', -1.0, yF + 1.05), ('wheel_fr', 1.0, yF + 1.05), ('wheel_rl', -1.0, yB - 1.25), ('wheel_rr', 1.0, yB - 1.25)):
        w = wheel(nm, (0, 0, 0), 0.5, 0.36, tire_m, rim_m, hub_m)
        if x > 0: w.data.transform(Matrix.Scale(-1, 4, (1, 0, 0))); bm = bmesh.new(); bm.from_mesh(w.data); bmesh.ops.reverse_faces(bm, faces=bm.faces[:]); bm.to_mesh(w.data); bm.free()
        w.location = (x, y, 0.5); wheels.append(w)
    return [body] + doors + [lamp] + wheels

# ======================================================================================= hijackernes pickup (technical)
def build_technical():
    paint = mat('Paint', 0xd9d4c8, 0.55, 0.15, coat=0.15)
    rust = mat('Rust', 0x6a3a22, 0.9)
    trim = mat('Trim', 0x1a1b1d, 0.65)
    chrome = mat('Chrome', 0xb8bcc0, 0.2, 0.95)
    steel = mat('Steel', 0x4a4d50, 0.45, 0.8)
    glass = mat('Glass', 0x10171b, 0.06, 0.1)
    tire = mat('Tire', 0x161616, 0.92)
    rim = mat('Rim', 0x9a9c9e, 0.35, 0.8)
    hub = mat('Hub', 0x6a6d70, 0.4, 0.8)
    head = mat('Headlight', 0xffffff, 0.1, emit=(0xfff0d0, 5.0))
    tail = mat('Taillight', 0xff2010, 0.2, emit=(0xff1a0a, 3.0))
    can = mat('Jerrycan', 0x4f5a2e, 0.6)
    L, Wd = 5.25, 1.86
    yF, yB = -L / 2, L / 2
    parts = []
    parts.append(box('frame', (0, 0.05, 0.55), (Wd * 0.8, L * 0.9, 0.2), trim, bev=0.02))
    # forende/motorhjelm og kabine i én profil, ladet for sig
    front = [(yF, 0.62), (yF, 1.08), (yF + 0.12, 1.2), (yF + 1.35, 1.26), (yF + 1.38, 0.62)]
    parts.append(prism('front', front, -Wd / 2, Wd / 2, paint, bev=0.06, seg=3))
    cab = [(yF + 1.35, 0.62), (yF + 1.35, 1.26), (yF + 1.95, 1.84), (yF + 3.0, 1.86), (yF + 3.05, 1.26), (yF + 3.05, 0.62)]
    parts.append(prism('cab', cab, -Wd / 2 + 0.02, Wd / 2 - 0.02, paint, bev=0.05, seg=3))
    # rude-paneler
    ws = box('wind', (0, yF + 1.66, 1.56), (Wd - 0.22, 0.03, 0.78), glass, bev=0.01); ws.rotation_euler = (-math.atan2(0.6, 0.58), 0, 0); parts.append(ws)
    parts.append(box('rwin', (0, yF + 3.06, 1.55), (Wd - 0.4, 0.03, 0.38), glass, bev=0.01))
    for sx in (-1, 1):
        parts.append(box('swin', (sx * (Wd / 2 - 0.015), yF + 2.45, 1.52), (0.02, 1.0, 0.42), glass, bev=0.008))
        parts.append(box('door_line', (sx * (Wd / 2 - 0.015), yF + 1.95, 1.0), (0.02, 0.01, 0.62), trim, bev=0.0))
        parts.append(box('door_line2', (sx * (Wd / 2 - 0.015), yF + 3.0, 1.0), (0.02, 0.01, 0.62), trim, bev=0.0))
        parts.append(box('handle', (sx * (Wd / 2 + 0.005), yF + 2.75, 1.12), (0.03, 0.16, 0.035), chrome, bev=0.008))
        parts.append(box('mirror', (sx * (Wd / 2 + 0.15), yF + 1.75, 1.3), (0.06, 0.12, 0.2), trim, bev=0.02))
        parts.append(box('hl', (sx * 0.66, yF - 0.004, 1.0), (0.32, 0.04, 0.12), head, bev=0.012))
        parts.append(box('tl', (sx * (Wd / 2 - 0.05), yB + 0.005, 1.0), (0.1, 0.04, 0.3), tail, bev=0.008))
        parts.append(box('flare', (sx * (Wd / 2 + 0.02), yF + 0.75, 0.82), (0.1, 1.1, 0.12), trim, bev=0.03))
        parts.append(box('flare2', (sx * (Wd / 2 + 0.02), yB - 0.85, 0.82), (0.1, 1.1, 0.12), trim, bev=0.03))
        # rustpletter
        for i in range(5):
            rr = random.Random(i * 7 + (sx > 0)); parts.append(box('rust', (sx * (Wd / 2 + 0.002), yF + 0.6 + rr.random() * 4.0, 0.68 + rr.random() * 0.3), (0.01, 0.1 + rr.random() * 0.2, 0.05 + rr.random() * 0.08), rust, bev=0.0))
    # grill + kofangere
    parts.append(box('grill', (0, yF - 0.01, 0.95), (1.0, 0.03, 0.26), trim, bev=0.01))
    for i in range(5): parts.append(box('gslat', (0, yF - 0.03, 0.86 + i * 0.045), (0.96, 0.015, 0.012), chrome, bev=0.002))
    parts.append(box('fbump', (0, yF - 0.06, 0.68), (Wd + 0.04, 0.16, 0.16), chrome, bev=0.03))
    parts.append(box('rbump', (0, yB + 0.06, 0.66), (Wd, 0.14, 0.12), steel, bev=0.02))
    # ladet: bund + sider (tailgate separat)
    parts.append(box('bedfloor', (0, yF + 4.15, 0.72), (Wd - 0.06, 2.15, 0.06), steel, bev=0.01))
    for sx in (-1, 1): parts.append(box('bedside', (sx * (Wd / 2 - 0.03), yF + 4.15, 1.0), (0.06, 2.18, 0.56), paint, bev=0.02))
    parts.append(box('bedfront', (0, yF + 3.1, 1.0), (Wd - 0.06, 0.06, 0.56), paint, bev=0.02))
    # styrtbøjle, reservehjul, dunke
    for sx in (-1, 1):
        parts.append(cyl('rb_up', (sx * (Wd / 2 - 0.12), yF + 3.25, 1.62), 0.035, 1.25, steel, axis='Z', seg=12))
        parts.append(cyl('rb_brace', (sx * (Wd / 2 - 0.12), yF + 3.7, 1.45), 0.028, 1.0, steel, axis='Y', seg=12))
    parts.append(cyl('rb_top', (0, yF + 3.25, 2.24), 0.035, Wd - 0.24, steel, axis='X', seg=12))
    parts.append(box('lightbar', (0, yF + 3.25, 2.3), (0.9, 0.12, 0.1), trim, bev=0.02))
    for i in range(4): parts.append(cyl('spot', (-0.33 + i * 0.22, yF + 3.18, 2.3), 0.04, 0.03, head, axis='Y', seg=16))
    sp = wheel('spare', (0, 0, 0), 0.38, 0.26, tire, rim, hub); sp.rotation_euler = (0, math.pi / 2, 0); sp.location = (0, yF + 3.35, 1.03)
    activate(sp); bpy.ops.object.transform_apply(rotation=True, location=True); parts.append(sp)
    for i, x in enumerate((-0.62, -0.38)):
        parts.append(box('can', (x, yB - 0.4, 0.98), (0.17, 0.34, 0.46), can, bev=0.03))
        parts.append(box('canh', (x, yB - 0.4, 1.24), (0.12, 0.05, 0.05), can, bev=0.01))
    body = join(parts, 'body')
    tg = [box('tgp', (0, yB - 0.03, 1.0), (Wd - 0.06, 0.06, 0.56), paint, bev=0.02)]
    tg.append(box('tgh', (0, yB + 0.005, 1.18), (0.3, 0.02, 0.05), chrome, bev=0.008))
    tgo = join(tg, 'tailgate'); set_origin(tgo, (0, yB - 0.03, 0.72))
    wheels = []
    for nm, x, y in (('wheel_fl', -0.82, yF + 0.82), ('wheel_fr', 0.82, yF + 0.82), ('wheel_rl', -0.82, yB - 0.95), ('wheel_rr', 0.82, yB - 0.95)):
        w = wheel(nm, (0, 0, 0), 0.4, 0.28, tire, rim, hub, spokes=6)
        if x > 0: w.data.transform(Matrix.Scale(-1, 4, (1, 0, 0))); bm = bmesh.new(); bm.from_mesh(w.data); bmesh.ops.reverse_faces(bm, faces=bm.faces[:]); bm.to_mesh(w.data); bm.free()
        w.location = (x, y, 0.4); wheels.append(w)
    return [body, tgo] + wheels

# ======================================================================================= AO/snavs-bagning (lakken mørkner i fordybninger og forneden)
def bake_ao(objs, vid, size=2048):
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 32; sc.cycles.use_denoising = False
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type = 'METAL'; prefs.get_devices()
        for dv in prefs.devices: dv.use = True
        sc.cycles.device = 'GPU'
    except Exception as e: print('GPU', e)
    im = bpy.data.images.new(vid + '_ao', size, size)
    # én fælles UV-atlas for alle dele (smart project, pakket sammen)
    for o in objs:
        activate(o); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004); bpy.ops.object.mode_set(mode='OBJECT')
    activate(objs[0])
    for o in objs[1:]: o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(margin=0.003); bpy.ops.object.mode_set(mode='OBJECT')
    # bagemateriale: AO^1.3 x højde-snavs (mørkere forneden) som emission
    saved = {}
    for o in objs:
        saved[o.name] = [s.material for s in o.material_slots]
    bm_ = bpy.data.materials.new('bakeAO'); bm_.use_nodes = True; nt = bm_.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission')
    ao = nt.nodes.new('ShaderNodeAmbientOcclusion'); ao.samples = 24; ao.inputs['Distance'].default_value = 0.35
    pw = nt.nodes.new('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = 1.3; nt.links.new(ao.outputs['AO'], pw.inputs[0])
    gc = nt.nodes.new('ShaderNodeNewGeometry'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(gc.outputs['Position'], sep.inputs[0])
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 0.3; mr.inputs['From Max'].default_value = 1.4; mr.inputs['To Min'].default_value = 0.72; mr.inputs['To Max'].default_value = 1.0
    nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 3.0; nz.inputs['Detail'].default_value = 6
    nr = nt.nodes.new('ShaderNodeMapRange'); nr.inputs['To Min'].default_value = 0.85; nr.inputs['To Max'].default_value = 1.05; nt.links.new(nz.outputs['Fac'], nr.inputs['Value'])
    m1 = nt.nodes.new('ShaderNodeMath'); m1.operation = 'MULTIPLY'; nt.links.new(pw.outputs[0], m1.inputs[0]); nt.links.new(mr.outputs['Result'], m1.inputs[1])
    m2 = nt.nodes.new('ShaderNodeMath'); m2.operation = 'MULTIPLY'; nt.links.new(m1.outputs[0], m2.inputs[0]); nt.links.new(nr.outputs['Result'], m2.inputs[1])
    nt.links.new(m2.outputs[0], em.inputs['Color']); nt.links.new(em.outputs[0], out.inputs['Surface'])
    tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = im; nt.nodes.active = tn
    for o in objs:
        for s in o.material_slots: s.material = bm_
    activate(objs[0])
    for o in objs[1:]: o.select_set(True)
    sc.render.bake.margin = 4; bpy.ops.object.bake(type='EMIT')
    im.filepath_raw = os.path.join(CACHE, vid + '_ao.png'); im.file_format = 'PNG'; im.save()
    for o in objs:
        for s, m in zip(o.material_slots, saved[o.name]): s.material = m
    # AO ganges på alle bagbare materialer (via billedet i et Multiply-led)
    for m in MATS.values():
        if not m.get('bake'): continue
        nt = m.node_tree; b = nt.nodes['Principled BSDF']
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = im
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1.0
        nt.links.new(t.outputs['Color'], mx.inputs['A']); mx.inputs['B'].default_value = b.inputs['Base Color'].default_value[:]
        nt.links.new(mx.outputs['Result'], b.inputs['Base Color'])

def render(vid, objs, outdir):
    os.makedirs(outdir, exist_ok=True); sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'; sc.view_settings.view_transform = 'AgX'
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.5, 0.55, 0.6, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.8
    sun = link(bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))); sun.data.energy = 4; sun.rotation_euler = (0.9, 0.2, 0.8)
    gp = bmesh.new(); bmesh.ops.create_grid(gp, x_segments=1, y_segments=1, size=12); obj_from_bm('ground', gp, mat('Ground', 0x9a958a, 0.95))
    cam = link(bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))); sc.camera = cam; cam.data.lens = 40
    for i, (p, t) in enumerate((((-6.5, -7.5, 3.0), (0, 0, 1.0)), ((6.0, 7.5, 2.6), (0, 0.5, 1.2)), ((-4.5, 6.5, 1.9), (0, 2.8, 1.3)))):
        cam.location = p; cam.rotation_euler = (Vector(t) - Vector(p)).to_track_quat('-Z', 'Y').to_euler()
        sc.render.resolution_x = 1000; sc.render.resolution_y = 650; sc.render.filepath = os.path.join(outdir, '%s_%d.png' % (vid, i)); bpy.ops.render.render(write_still=True)

def export(vid, objs):
    for o in bpy.context.view_layer.objects: o.select_set(False)
    for o in objs: o.select_set(True)
    path = os.path.join(OUT, vid + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_image_format='JPEG', export_jpeg_quality=85, export_yup=True, export_apply=True)
    print('EXPORT', path, round(os.path.getsize(path) / 1e6, 2), 'MB')

for vid in IDS:
    reset(); MATS.clear(); random.seed(1)
    objs = build_swat() if vid == 'swat_truck' else build_technical()
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs); print('TRIS', vid, tris)
    bake_ao(objs, vid, 1024)
    if RENDER: render(vid, objs, RENDER)
    if '--noexport' not in ARGS: export(vid, objs)
