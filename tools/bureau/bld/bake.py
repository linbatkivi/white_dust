# ==========================================================================
# de_ascension (v25) · bagning og eksport (fra de_havn; nat: 'sky'-passet = nattehimmel + alle lamper, 'sun' = månens indirekte lys)
#   1. modifiers anvendes (fasninger), glas skilles ud (ingen lysmap – spejler himlen i spillet)
#   2. al statisk geometri deles i chunks (35 m) og samles pr. chunk; hver chunk får en lysmap-UV ('LM') med ensartet tæthed
#   3. bagning i Cycles i to additive pas: A = himmel + lamper (direkte + indirekte, sol slukket), B = solens indirekte lys
#      → lysmap = A + B (himmellys + alt tilbagekastet lys; den direkte sol tegnes i realtid i spillet med skarpe skygger)
#   4. lysmaps støjfjernes (OIDN, tools/havn/denoise_lm.py) og gemmes som 8-bit PNG (gamma 2,2 · skala S i manifestet), banen som world.glb (UV0, UV1, blend-farve)
# ==========================================================================
import json, math, os, subprocess, time
import bpy, bmesh
import numpy as np
from mathutils import Vector
from .common import OUT, ROOT, MATS, coll

DST = os.path.join(ROOT, 'public', 'assets', 'bureau')
CH = 30.0                    # chunk-størrelse (m) – banen er 114 × 85 m → 4 × 3 chunks
DENSITY = float(os.environ.get('BU_LM_DENSITY', 14.0))     # lysmap-pixels pr. meter
NO_LM = {'glass', 'water', 'lamp_on', 'window', 'glass_door'}

def apply_all(objs):
    for ob in objs:
        if ob.type != 'MESH': continue
        bpy.context.view_layer.objects.active = ob; ob.select_set(True)
        for md in list(ob.modifiers):
            try: bpy.ops.object.modifier_apply(modifier=md.name)
            except Exception as e: print('[bake] modifier', ob.name, md.name, e)
        ob.select_set(False)

def split_by(ob, keyfn, prefix):
    """del et objekt i flere efter polygon-nøgle (fx chunk eller glas/ikke-glas). Returnerer {nøgle: objekt}"""
    me = ob.data; groups = {}
    for p in me.polygons:
        c = ob.matrix_world @ p.center; groups.setdefault(keyfn(p, c), []).append(p.index)
    out = {}
    for k, idx in groups.items():
        bm = bmesh.new(); bm.from_mesh(me); keep = set(idx)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in keep], context='FACES')
        nm = bpy.data.meshes.new('%s_%s' % (prefix, k)); bm.to_mesh(nm); bm.free()
        for m in me.materials: nm.materials.append(m)
        o2 = bpy.data.objects.new(nm.name, nm); o2.matrix_world = ob.matrix_world
        ob.users_collection[0].objects.link(o2); out[k] = o2
    bpy.data.objects.remove(ob, do_unlink=True)
    return out

def chunk_key(c):
    # Blender (X, Y) = layout (x, −z); kanter lægges i nærmeste chunk (ingen mini-chunks)
    return '%d_%d' % (min(3, max(0, math.floor((c.x + 60) / CH))), min(2, max(0, math.floor((-c.y + 45) / CH))))
# objekter hvis lys bages pr. hjørne (små detaljer) – resten får lysmap
VTX = ('detail_trim', 'detail_metal', 'detail_glass', 'detail_far', 'props', 'detail_light')   # små detaljer + kulisse: lys pr. hjørne

def prepare():
    statics = [o for c in ('ground', 'walls', 'ceil', 'arch', 'structures', 'props', 'backdrop') if bpy.data.collections.get(c) for o in bpy.data.collections[c].objects if o.type == 'MESH']
    apply_all(statics)
    glass_c = coll('glass'); chunks = {}
    for ob in statics:
        mats = [m.name if m else '' for m in ob.data.materials]
        kind = 'vx' if ob.name.startswith(VTX) else 'lm'
        parts = split_by(ob, lambda p, c: 'glass' if mats[p.material_index] in NO_LM else chunk_key(c), ob.name)
        for k, o2 in parts.items():
            if k == 'glass':
                for cc in o2.users_collection: cc.objects.unlink(o2)
                glass_c.objects.link(o2)
            else: chunks.setdefault((k, kind), []).append(o2)
    out = {}
    for (k, kind), obs in chunks.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs: o.select_set(True)
        bpy.context.view_layer.objects.active = obs[0]
        if len(obs) > 1: bpy.ops.object.join()
        ob = bpy.context.view_layer.objects.active; ob.name = 'C_%s_%s' % (k, kind); ob.data.name = ob.name
        for cc in list(ob.users_collection): cc.objects.unlink(ob)
        coll('chunks').objects.link(ob); out[(k, kind)] = ob
    return out

def area(ob):
    return sum(p.area for p in ob.data.polygons)

def lightmap_uv(ob):
    me = ob.data
    if 'LM' not in me.uv_layers: me.uv_layers.new(name='LM')
    me.uv_layers.active = me.uv_layers['LM']
    for i, l in enumerate(me.uv_layers): l.active_render = (l.name == 'UVMap')
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    # de_bureau: plane naboflader (gulvstrimler, vægfelter) samles først → én ø pr. flade i lysmappet (ingen striber ved strimmelkanter)
    bpy.ops.mesh.remove_doubles(threshold=0.002)
    bpy.ops.mesh.dissolve_limited(angle_limit=math.radians(0.5), delimit={'MATERIAL'})
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.003, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(rotate=True, margin=0.004)
    bpy.ops.object.mode_set(mode='OBJECT')

def lm_size(ob):
    texels = area(ob) * DENSITY * DENSITY / 0.55
    s = 256
    while s * s < texels and s < 2048: s *= 2
    return s

def bake_img(ob, name, size):
    img = bpy.data.images.get(name) or bpy.data.images.new(name, size, size, alpha=False, float_buffer=True)
    if tuple(img.size) != (size, size): img.scale(size, size)
    for m in ob.data.materials:                                             # Cycles bager ind i det aktive billed-node i hvert materiale
        nt = m.node_tree; n = nt.nodes.get('__bake') or nt.nodes.new('ShaderNodeTexImage'); n.name = '__bake'; n.image = img
        uvn = nt.nodes.get('__bakeuv') or nt.nodes.new('ShaderNodeUVMap'); uvn.name = '__bakeuv'; uvn.uv_map = 'LM'; nt.links.new(uvn.outputs['UV'], n.inputs['Vector'])
        for x in nt.nodes: x.select = False
        n.select = True; nt.nodes.active = n
    return img

def px(img):
    a = np.empty(img.size[0] * img.size[1] * 4, np.float32); img.pixels.foreach_get(a); return a.reshape(img.size[1], img.size[0], 4)

def vtx_attr(ob, name):
    me = ob.data
    a = me.color_attributes.get(name) or me.color_attributes.new(name=name, type='FLOAT_COLOR', domain='CORNER')
    me.color_attributes.active_color = a
    return a

def smooth_corners(me, L, it=3):
    """vertex-lys (domæne: hjørne) → gennemsnit pr. (vertex, flade-normal) og et par Laplace-skridt inden for hver flade og på tværs af
    delte hjørner i samme plan. Bevarer hårde kanter (forskellige normaler holdes adskilt)."""
    nl = len(me.loops)
    if nl == 0: return L
    vi = np.empty(nl, np.int64); me.loops.foreach_get('vertex_index', vi)
    pn = np.empty(len(me.polygons) * 3, np.float32); me.polygons.foreach_get('normal', pn); pn = pn.reshape(-1, 3)
    ls = np.empty(len(me.polygons), np.int64); me.polygons.foreach_get('loop_start', ls)
    lt = np.empty(len(me.polygons), np.int64); me.polygons.foreach_get('loop_total', lt)
    poly = np.repeat(np.arange(len(me.polygons)), lt)
    q = np.round(pn[poly] * 4).astype(np.int64)
    key = vi * 1000 + (q[:, 0] + 5) * 100 + (q[:, 1] + 5) * 10 + (q[:, 2] + 5)
    _, grp = np.unique(key, return_inverse=True); ng = grp.max() + 1
    C = L[:, :3].astype(np.float64)
    def group_avg(C):
        s = np.zeros((ng, 3)); np.add.at(s, grp, C); c = np.bincount(grp, minlength=ng)[:, None]
        return (s / np.maximum(c, 1))[grp]
    C = group_avg(C)
    for _ in range(it):
        fs = np.zeros((len(me.polygons), 3)); np.add.at(fs, poly, C); fm = (fs / lt[:, None])[poly]
        C = group_avg(0.55 * C + 0.45 * fm)
    out = L.copy(); out[:, :3] = C; return out

def bake_pass(ob, target, mode, sc, bg, sky, samples):
    """to additive pas (ingen subtraktion → ingen negativ støj der klippes til pletter):
       'sky' – himmel + lamper, direkte og indirekte, solen slukket;  'sun' – kun solens INDIREKTE lys (den direkte sol tegnes i spillet)"""
    lights = [o.data for o in bpy.data.objects if o.type == 'LIGHT']
    keep = {d.name: d.energy for d in lights}
    for d in lights:
        if (d.type == 'SUN') == (mode == 'sky'): d.energy = 0.0
    bg.inputs['Strength'].default_value = sky if mode == 'sky' else 0.0
    sc.cycles.samples = samples
    try: bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'} if mode == 'sky' else {'INDIRECT'}, margin=6, use_clear=True, target=target)
    finally:
        for d in lights: d.energy = keep[d.name]

def bake_all(samples=int(os.environ.get('BU_BAKE_SAMPLES', 128))):
    os.makedirs(DST, exist_ok=True); os.makedirs(os.path.join(DST, 'lm'), exist_ok=True)
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type = 'METAL'; prefs.get_devices()
    for d in prefs.devices: d.use = d.type != 'CPU'                          # kun GPU: blandet CPU+Metal crashede i CPU-stien (chunk 3_3 vx)
    sc.cycles.device = 'GPU'; sc.cycles.samples = samples; sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 6; sc.cycles.diffuse_bounces = 4; sc.cycles.glossy_bounces = 1
    sc.render.bake.margin = 6; sc.render.bake.use_clear = True
    chunks = prepare(); man = {'chunks': {}, 'density': DENSITY}
    world = sc.world; bg = [n for n in world.node_tree.nodes if n.type == 'BACKGROUND'][0]; sky = bg.inputs['Strength'].default_value
    RAW = os.path.join(OUT, 'lm_raw'); os.makedirs(RAW, exist_ok=True); jobs = []
    only = os.environ.get('BU_ONLY')                                       # diagnose: kun disse chunks (fx "0_0,1_1")
    for (k, kind), ob in sorted(chunks.items()):
        if only and k not in only.split(','): continue
        t0 = time.time(); print('[bake] start %s %s' % (k, kind), flush=True)
        bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
        if kind == 'lm':
            lightmap_uv(ob); size = lm_size(ob)
            imA = bake_img(ob, 'lmA_' + k, size); bake_pass(ob, 'IMAGE_TEXTURES', 'sky', sc, bg, sky, samples); A = px(imA).copy()
            if any(o.type == 'LIGHT' and o.data.type == 'SUN' for o in bpy.data.objects):
                imB = bake_img(ob, 'lmB_' + k, size); bake_pass(ob, 'IMAGE_TEXTURES', 'sun', sc, bg, sky, samples); Bv = px(imB)
            else: Bv = np.zeros_like(A)                                         # nat: ingen sol – kun himmel + lamper
            L = np.clip(A[..., :3] + Bv[..., :3], 0, None)
            out = bpy.data.images.new('lmraw_' + k, size, size, alpha=False, float_buffer=True); rgba = np.ones((size, size, 4), np.float32); rgba[..., :3] = L
            out.pixels.foreach_set(rgba.ravel()); out.filepath_raw = os.path.join(RAW, 'lm_%s.exr' % k); out.file_format = 'OPEN_EXR'; out.save()
            jobs.append({'exr': out.filepath_raw, 'png': os.path.join(DST, 'lm', 'lm_%s.png' % k), 'name': ob.name})
            man['chunks'][ob.name] = {'lm': 'lm/lm_%s.png' % k, 'scale': 1.0, 'size': size, 'area': area(ob)}
            print('[bake] %s: %d m², %d², %.1f s' % (ob.name, area(ob), size, time.time() - t0), flush=True)
        else:
            for m in ob.data.materials:                                       # vertex-bagning: ingen aktiv billed-node må forstyrre
                n = m.node_tree.nodes.get('__bake')
                if n: m.node_tree.nodes.remove(n)
            a = vtx_attr(ob, 'vlmA'); bake_pass(ob, 'VERTEX_COLORS', 'sky', sc, bg, sky, samples)
            A = np.empty(len(a.data) * 4, np.float32); a.data.foreach_get('color', A)
            b = vtx_attr(ob, 'vlmB')
            if any(o.type == 'LIGHT' and o.data.type == 'SUN' for o in bpy.data.objects): bake_pass(ob, 'VERTEX_COLORS', 'sun', sc, bg, sky, samples)
            Bv = np.empty(len(b.data) * 4, np.float32); b.data.foreach_get('color', Bv)
            if not any(o.type == 'LIGHT' and o.data.type == 'SUN' for o in bpy.data.objects): Bv[:] = 0
            L = np.clip(A.reshape(-1, 4) + Bv.reshape(-1, 4), 0, None); L[:, 3] = 1.0
            L = smooth_corners(ob.data, L)                                    # v26: støjen pr. hjørne udglattes (ingen trekant-pletter)
            vl = vtx_attr(ob, 'vlm'); vl.data.foreach_set('color', L.ravel())
            ob.data.color_attributes.remove(ob.data.color_attributes['vlmA']); ob.data.color_attributes.remove(ob.data.color_attributes['vlmB'])
            man['chunks'][ob.name] = {'vtx': True, 'area': area(ob)}
            print('[bake] %s: %d m² (vertex-lys, %d hjørner), %.1f s' % (ob.name, area(ob), len(L), time.time() - t0), flush=True)
    for ob in chunks.values():                                              # fjern bage-noderne før eksport
        for m in ob.data.materials:
            for nn in ('__bake', '__bakeuv'):
                n = m.node_tree.nodes.get(nn)
                if n: m.node_tree.nodes.remove(n)
    bg.inputs['Strength'].default_value = sky
    if jobs:                                                                # støjfjernelse (OIDN) + PNG-kodning i en separat Blender-proces
        jp = os.path.join(RAW, 'jobs.json'); json.dump(jobs, open(jp, 'w'))
        t0 = time.time()
        subprocess.run([bpy.app.binary_path, '-b', '--factory-startup', '-P', os.path.join(ROOT, 'tools', 'bureau', 'denoise_lm.py'), '--', jp], check=True)
        for name, S in json.load(open(jp[:-5] + '.out.json')).items(): man['chunks'][name]['scale'] = S
        print('[bake] støjfjernet %d lysmaps, %.1f s' % (len(jobs), time.time() - t0), flush=True)
    man['flipY'] = True                                                   # PNG'en vendes ved indlæsning (Blenders v går nedefra)
    json.dump(man, open(os.path.join(DST, 'lightmaps.json'), 'w'), indent=1)
    return chunks

def export():
    """kompakt binært format til spillet (public/assets/havn/world.bin + world.json):
       pr. mesh (chunk × materiale): pos uint16×3 (kvantiseret i meshets kasse, layout-akser x,y,z), normal int8×4, uv0 float32×2,
       uv1 uint16×2 (lysmap) | vlm uint8×4 (vertex-lys, RGB gamma 2,2 + fælles skala), blend uint8×4, indekser uint16/uint32.
       Hjørner med ens data deles (np.unique på de kvantiserede værdier) – typisk 3–4× færre hjørner end pr. trekant-hjørne."""
    os.makedirs(DST, exist_ok=True)
    blob = bytearray(); meshes = []
    def align():
        while len(blob) % 4: blob.append(0)
    obs = []
    for c in ('chunks', 'glass', 'water', 'city'):
        if bpy.data.collections.get(c): obs += [(c, o) for o in bpy.data.collections[c].objects if o.type == 'MESH']
    tot_loops = 0
    for cname, ob in obs:
        me = ob.data; me.calc_loop_triangles()
        nt = len(me.loop_triangles); nl = len(me.loops); nv = len(me.vertices)
        if nt == 0: continue
        tl = np.empty(nt * 3, np.int32); me.loop_triangles.foreach_get('loops', tl)
        tm = np.empty(nt, np.int32); me.loop_triangles.foreach_get('material_index', tm)
        lv = np.empty(nl, np.int32); me.loops.foreach_get('vertex_index', lv)
        co = np.empty(nv * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
        M4 = np.array(ob.matrix_world, np.float64); co = (co @ M4[:3, :3].T + M4[:3, 3]).astype(np.float32)
        cn = np.empty(nl * 3, np.float32); me.corner_normals.foreach_get('vector', cn); cn = cn.reshape(-1, 3)
        N3 = np.array(ob.matrix_world.to_3x3().inverted().transposed(), np.float64); cn = cn @ N3.T
        cn /= np.maximum(np.linalg.norm(cn, axis=1, keepdims=True), 1e-9)
        def layer_uv(name):
            l = me.uv_layers.get(name)
            if not l: return None
            a = np.empty(nl * 2, np.float32); l.data.foreach_get('uv', a); return a.reshape(-1, 2)
        def layer_col(name):
            l = me.color_attributes.get(name)
            if not l: return None
            a = np.empty(len(l.data) * 4, np.float32); l.data.foreach_get('color', a); a = a.reshape(-1, 4)
            if l.domain == 'POINT': a = a[lv]
            return a
        U0, U1, BL, VL = layer_uv('UVMap'), layer_uv('LM'), layer_col('blend'), layer_col('vlm')
        P = co[lv]; P = np.stack([P[:, 0], P[:, 2], -P[:, 1]], 1)                    # Blender → layout (x, y, z)
        N = np.stack([cn[:, 0], cn[:, 2], -cn[:, 1]], 1)
        for mi in np.unique(tm):
            mname = me.materials[mi].name if mi < len(me.materials) and me.materials[mi] else 'setts'
            loops = tl.reshape(-1, 3)[tm == mi].ravel(); tot_loops += len(loops)
            p = P[loops]; lo, hi = p.min(0), p.max(0); ext = np.maximum(hi - lo, 1e-4)
            q = np.round((p - lo) / ext * 65535).astype(np.uint16)
            nn = np.clip(np.round(N[loops] * 127), -127, 127).astype(np.int8); nn = np.concatenate([nn, np.zeros((len(nn), 1), np.int8)], 1)
            u0 = U0[loops] if U0 is not None else np.zeros((len(loops), 2), np.float32)
            is_lm = cname == 'chunks' and ob.name.endswith('_lm')
            if cname == 'city': VL = None
            u1 = np.clip(np.round(U1[loops] * 65535), 0, 65535).astype(np.uint16) if (U1 is not None and is_lm) else np.zeros((len(loops), 2), np.uint16)
            b8 = np.clip(np.round((BL[loops] if BL is not None else np.tile([0, 0, 0, 1], (len(loops), 1))) * 255), 0, 255).astype(np.uint8)
            if VL is not None:
                V = VL[loops][:, :3]; vs = float(max(1e-3, np.percentile(V, 99.5) * 1.1))
                v8 = np.concatenate([np.clip(np.round((np.clip(V / vs, 0, 1) ** (1 / 2.2)) * 255), 0, 255), np.full((len(V), 1), 255)], 1).astype(np.uint8)
            else: vs = 1.0; v8 = np.zeros((len(loops), 4), np.uint8)
            # del ens hjørner: nøgle = alle kvantiserede attributter
            key = np.concatenate([q.view(np.uint8).reshape(len(q), -1), nn.view(np.uint8).reshape(len(q), -1), u0.view(np.uint8).reshape(len(q), -1),
                                  u1.view(np.uint8).reshape(len(q), -1), b8, v8], 1)
            kv = np.ascontiguousarray(key).view(np.dtype((np.void, key.shape[1]))).ravel()
            _, first, inv = np.unique(kv, return_index=True, return_inverse=True)
            n = len(first)
            idx = inv.astype(np.uint32 if n > 65535 else np.uint16)
            ent = {'name': ob.name, 'chunk': ob.name.rsplit('_', 1)[0] if cname == 'chunks' else cname, 'kind': cname, 'mat': mname, 'n': int(n), 'ni': int(len(idx)),
                   'lo': lo.tolist(), 'ext': ext.tolist(), 'lm': ob.name if is_lm else None, 'vtx': VL is not None, 'vscale': vs, 'off': {}}
            for nm, arr in (('pos', q[first]), ('nrm', nn[first]), ('uv0', u0[first].astype(np.float32)), ('uv1', u1[first]), ('blend', b8[first]), ('vlm', v8[first]), ('idx', idx)):
                if nm == 'uv1' and not ent['lm']: continue
                if nm == 'vlm' and not ent['vtx']: continue
                align(); ent['off'][nm] = len(blob); blob += np.ascontiguousarray(arr).tobytes()
            ent['i32'] = idx.dtype == np.uint32
            meshes.append(ent)
    open(os.path.join(DST, 'world.bin'), 'wb').write(blob)
    json.dump({'version': 1, 'build': int(time.time()), 'meshes': meshes, 'materials': {k: v for k, v in MATS.items()}}, open(os.path.join(DST, 'world.json'), 'w'), indent=0)
    print('[export] world.bin %.1f MB · %d meshes · %d hjørner (af %d trekant-hjørner) · %d trekanter' % (len(blob) / 1e6, len(meshes), sum(m['n'] for m in meshes), tot_loops, sum(m['ni'] for m in meshes) // 3))
