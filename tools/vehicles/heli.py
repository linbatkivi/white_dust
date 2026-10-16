# v26: hijackernes helikopter til intro-cutscenen på de_bureau – modelleret proceduralt i Blender (eget arbejde/CC0)
#   Mørk, umærket civil enmotoret helikopter i H125/AS350-klassen: boble-cockpit, skydedøre bagi, slæbesko (skids), halebom med
#   finne, stabilisator og halerotor, trebladet hovedrotor. Mål efter det rigtige fly: skrog 10,9 m, kabine 1,9 m bred, rotor Ø 10,7 m.
#   Noder spillet bruger: body · door_l / door_r (skydedøre – flyttes bagud langs skinnen) · rotor (origo i navet, drejer om y)
#   · tail_rotor (origo i navet, drejer om x) · spot (søgelyset under næsen). Fremad = +Z i glTF (= −Y i Blender).
# Kør:  blender -b --factory-startup -P tools/vehicles/heli.py [-- --render DIR]
import bpy, bmesh, sys, os, math, json
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'public', 'assets', 'vehicles'); os.makedirs(OUT, exist_ok=True)
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
RENDER = ARGS[ARGS.index('--render') + 1] if '--render' in ARGS else None
bpy.ops.wm.read_factory_settings(use_empty=True)

def G(x, y, z): return Vector((x, -z, y))                                   # spil (x, y op, z frem) → Blender

def lin(h):
    c = [((h >> s) & 255) / 255 for s in (16, 8, 0)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)
MATS = {}
def mat(name, col, r=0.5, metal=0.0, emit=None, coat=0.0):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*lin(col), 1); b.inputs['Roughness'].default_value = r; b.inputs['Metallic'].default_value = metal
    if coat: b.inputs['Coat Weight'].default_value = coat
    if emit: b.inputs['Emission Color'].default_value = (*lin(emit[0]), 1); b.inputs['Emission Strength'].default_value = emit[1]
    MATS[name] = m; return m
PAINT = mat('heli_paint', 0x2b2f35, 0.36, 0.4, coat=0.5)          # mørk antracit metallak
STRIPE = mat('heli_stripe', 0x5a1414, 0.4, 0.3)                     # mørkerød stribe
GLASS = mat('heli_glass', 0x0c1a1f, 0.02, 0.6)                     # tonet, spejlende glas (grønlig)
METAL = mat('heli_metal', 0x6d7075, 0.35, 1.0)
DARKM = mat('heli_darkmetal', 0x1a1b1d, 0.45, 0.8)
RUBBER = mat('heli_rubber', 0x0a0a0a, 0.8)
CABIN = mat('heli_cabin', 0x1c1d20, 0.85)
SEAT = mat('heli_seat', 0x2a2620, 0.7)
BLADE = mat('heli_blade', 0x15161a, 0.45, 0.2)
TIP = mat('heli_tip', 0xc9c9c2, 0.4)
RED = mat('heli_nav_red', 0xff2010, 0.3, emit=(0xff2010, 9.0))
GREEN = mat('heli_nav_green', 0x20ff50, 0.3, emit=(0x20ff50, 9.0))
WHITE = mat('heli_nav_white', 0xffffff, 0.3, emit=(0xfff6e8, 9.0))
LENS = mat('heli_lens', 0x8a8070, 0.1, emit=(0x8a8070, 1.5))

def link(ob): bpy.context.scene.collection.objects.link(ob); return ob
def activate(ob):
    bpy.context.view_layer.update()
    for o in bpy.context.view_layer.objects: o.select_set(False)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
def mk(name, bm, m, smooth=False):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); ob = link(bpy.data.objects.new(name, me))
    if isinstance(m, list):
        for mm in m: me.materials.append(mm)
    else: me.materials.append(m)
    for p in me.polygons: p.use_smooth = smooth
    return ob
def join(obs, name):
    obs = [o for o in obs if o]; activate(obs[0])
    for o in obs[1:]: o.select_set(True)
    bpy.ops.object.join(); obs[0].name = name; obs[0].data.name = name; return obs[0]

# ---------------------------------------------------------------- geometri-hjælpere (spil-koordinater)
def box(x0, y0, z0, x1, y1, z1, m, bev=0.0, name='b'):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    c = G((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); s = Vector((x1 - x0, z1 - z0, y1 - y0))
    for v in bm.verts: v.co = Vector((v.co.x * s.x, v.co.y * s.y, v.co.z * s.z)) + c
    ob = mk(name, bm, m)
    if bev > 0:
        md = ob.modifiers.new('bv', 'BEVEL'); md.width = bev; md.segments = 2; activate(ob); bpy.ops.object.modifier_apply(modifier=md.name)
    return ob
def tube(p0, p1, r, m, seg=12, name='t'):
    a, b = G(*p0), G(*p1); d = b - a; L = d.length
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=L)
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    for v in bm.verts: v.co = q @ v.co + (a + b) / 2
    return mk(name, bm, m, True)
def sphere(p, r, m, name='s'):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=r)
    for v in bm.verts: v.co += G(*p)
    return mk(name, bm, m, True)
def prism(pts_zy, x0, x1, m, name='p'):
    """flad plade: polygon i (z, y)-planet ekstruderet fra x0 til x1"""
    bm = bmesh.new(); A = [bm.verts.new(G(x0, y, z)) for z, y in pts_zy]; B_ = [bm.verts.new(G(x1, y, z)) for z, y in pts_zy]
    bm.faces.new(A); bm.faces.new(B_[::-1]); n = len(A)
    for i in range(n): bm.faces.new((A[i], A[(i + 1) % n], B_[(i + 1) % n], B_[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mk(name, bm, m)
def loft(rings, m, seg=36, name='loft', ntop=2.4, nbot=3.0):
    """skrog: superellipse-tværsnit (z, cy, w, htop, hbot) → lukket rør med spidse ender"""
    bm = bmesh.new(); R = []
    for (z, cy, w, ht, hb) in rings:
        ring = []
        for k in range(seg):
            th = 2 * math.pi * k / seg; c, s = math.cos(th), math.sin(th)
            x = w * math.copysign(abs(c) ** (2 / (ntop if s >= 0 else nbot)), c)
            y = cy + (ht if s >= 0 else hb) * math.copysign(abs(s) ** (2 / (ntop if s >= 0 else nbot)), s)
            ring.append(bm.verts.new(G(x, y, z)))
        R.append(ring)
    for i in range(len(R) - 1):
        for k in range(seg): bm.faces.new((R[i][k], R[i][(k + 1) % seg], R[i + 1][(k + 1) % seg], R[i + 1][k]))
    for ring, rev in ((R[0], True), (R[-1], False)):
        c = bm.verts.new(sum((v.co for v in ring), Vector()) / len(ring))
        for k in range(seg):
            f = (ring[k], ring[(k + 1) % seg], c); bm.faces.new(f[::-1] if rev else f)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mk(name, bm, m, True)
def subsurf(ob, lv=2):
    md = ob.modifiers.new('ss', 'SUBSURF'); md.levels = lv; md.render_levels = lv; activate(ob); bpy.ops.object.modifier_apply(modifier=md.name)

# ---------------------------------------------------------------- skroget
FUS = [(3.10, 1.22, 0.03, 0.03, 0.03), (3.00, 1.20, 0.32, 0.34, 0.28), (2.80, 1.24, 0.56, 0.62, 0.50), (2.45, 1.32, 0.77, 0.86, 0.66),
       (2.00, 1.40, 0.89, 1.00, 0.76), (1.30, 1.45, 0.94, 1.08, 0.84), (0.30, 1.48, 0.95, 1.10, 0.88), (-0.80, 1.52, 0.94, 1.08, 0.88),
       (-1.50, 1.62, 0.88, 0.98, 0.86), (-2.10, 1.80, 0.70, 0.78, 0.72), (-2.70, 2.00, 0.42, 0.46, 0.40), (-3.30, 2.08, 0.26, 0.28, 0.24),
       (-5.50, 2.14, 0.19, 0.20, 0.18), (-7.40, 2.18, 0.14, 0.15, 0.13), (-7.80, 2.20, 0.03, 0.03, 0.03)]
fus = loft(FUS, PAINT, 40, 'fus'); subsurf(fus, 2)
for m in (GLASS, STRIPE, CABIN): fus.data.materials.append(m)                  # 0 lak · 1 glas · 2 stribe
DOOR_Z = (-1.38, -0.02); DOOR_Y = (0.86, 2.30)
def classify(c, n):
    x, y, z = c.x, c.z, -c.y                                                     # Blender → spil
    if z > 1.22 and y > 0.80 and not (abs(x) < 0.035 and z > 1.5 and y > 1.2) and not (1.22 < z < 1.32): return 1   # boble-cockpittet (med midterspros og ramme)
    if -1.30 < z < 1.10 and 1.58 < y < 2.24 and abs(n.x) > 0.55 and not (-0.10 < z < 0.06): return 1               # sideruder (front- og skydedør)
    if -6.8 < z < 1.0 and 0.96 < y < 1.06 and abs(n.x) > 0.5: return 2                                            # mørk stribe langs siden
    return 0
for p in fus.data.polygons:
    p.material_index = classify(Vector(p.center), Vector(p.normal))
# skydedørene: skær panelerne fri som egne objekter (åbningen viser kabinen)
def cut_door(side):
    bm = bmesh.new(); bm.from_mesh(fus.data); bm.faces.ensure_lookup_table()
    sel = []
    for f in bm.faces:
        c = f.calc_center_median(); n = f.normal; x, y, z = c.x, c.z, -c.y
        if DOOR_Z[0] < z < DOOR_Z[1] and DOOR_Y[0] < y < DOOR_Y[1] and n.x * side > 0.35: sel.append(f)
    # dørpanelet (kopi) og hul i skroget
    dm = bmesh.new(); vm = {}
    for f in sel:
        vs = []
        for v in f.verts:
            if v.index not in vm: vm[v.index] = dm.verts.new(v.co + Vector((0.012 * side, 0, 0)))
            vs.append(vm[v.index])
        nf = dm.faces.new(vs); nf.material_index = f.material_index; nf.smooth = True
    bmesh.ops.delete(bm, geom=sel, context='FACES'); bm.to_mesh(fus.data); bm.free()
    ob = mk('door_r' if side > 0 else 'door_l', dm, [PAINT, GLASS, STRIPE, CABIN], True)
    ob.data.polygons.foreach_set('material_index', [p.material_index for p in ob.data.polygons])
    # lidt tykkelse på panelet, så kanten ikke ses som en tynd hinde
    md = ob.modifiers.new('sol', 'SOLIDIFY'); md.thickness = 0.03; md.offset = -1.0; activate(ob); bpy.ops.object.modifier_apply(modifier=md.name)
    return ob
door_r = cut_door(1); door_l = cut_door(-1)
for d_ in (door_l, door_r):                                                          # materialerne genbruges fra skroget
    for i, m in enumerate([PAINT, GLASS, STRIPE, CABIN]):
        if i < len(d_.data.materials): d_.data.materials[i] = m
# kabinen: indadvendt kasse (set gennem døråbningen ses bagvæggen, ikke den nære side), bænk og gulv
parts = []
bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
for v in bm.verts: v.co = Vector((v.co.x * 1.80, v.co.y * 1.52, v.co.z * 1.62)) + G(0, 1.52, -0.68)
bmesh.ops.reverse_faces(bm, faces=bm.faces); parts.append(mk('cabin', bm, CABIN))
parts.append(box(-0.82, 0.70, -1.46, 0.82, 1.12, -1.02, SEAT, 0.02))              # bagbænk
parts.append(box(-0.82, 1.12, -1.48, 0.82, 1.72, -1.36, SEAT, 0.02))              # ryglæn
parts.append(box(-0.30, 0.70, 0.10, 0.30, 1.05, 0.55, CABIN, 0.01))                # konsol mellem forsæderne
for x in (-0.45, 0.45):
    parts.append(box(x - 0.24, 0.70, 0.45, x + 0.24, 1.10, 0.95, SEAT, 0.02)); parts.append(box(x - 0.24, 1.10, 0.40, x + 0.24, 1.80, 0.52, SEAT, 0.02))
# instrumentbræt (synligt gennem boblen)
parts.append(box(-0.75, 1.05, 1.55, 0.75, 1.35, 1.85, DARKM, 0.02))
# skinnerne over og under døren
for s in (1, -1):
    parts.append(box(s * 0.93 - 0.02, 2.36, -2.65, s * 0.93 + 0.02, 2.40, 0.0, METAL))
    parts.append(box(s * 0.94 - 0.02, 0.70, -2.65, s * 0.94 + 0.02, 0.73, 0.0, METAL))

# motor- og gearkassekappen ovenpå + udstødning, luftindtag
TOP = [(0.95, 2.45, 0.10, 0.06, 0.15), (0.70, 2.50, 0.48, 0.20, 0.30), (0.20, 2.55, 0.60, 0.30, 0.35), (-0.80, 2.58, 0.62, 0.32, 0.35),
       (-1.80, 2.55, 0.58, 0.30, 0.40), (-2.50, 2.40, 0.40, 0.25, 0.40), (-2.90, 2.30, 0.12, 0.08, 0.20)]
cowl = loft(TOP, PAINT, 32, 'cowl', 2.6, 2.6); subsurf(cowl, 1); parts.append(cowl)
parts.append(tube((0, 2.55, -2.45), (0.05, 2.62, -3.05), 0.17, DARKM, 16))
parts.append(tube((0.0, 2.55, -2.95), (0.06, 2.63, -3.12), 0.13, RUBBER, 16))
for s in (1, -1): parts.append(box(s * 0.60 - 0.03, 2.55, -1.4, s * 0.60 + 0.03, 2.78, -0.7, DARKM, 0.01))   # luftindtag (gitre)
# halebom-detaljer: vertikal finne, stabilisator med endeplader, haleskid
parts.append(prism([(-6.95, 2.25), (-7.75, 2.25), (-8.10, 3.30), (-7.80, 3.34), (-7.30, 2.45)], -0.035, 0.035, PAINT, 'fin'))
parts.append(prism([(-7.30, 2.10), (-7.80, 2.10), (-7.95, 1.55), (-7.80, 1.52)], -0.03, 0.03, PAINT, 'finlo'))
parts.append(box(-1.28, 2.10, -6.68, 1.28, 2.15, -6.18, PAINT, 0.01))
for s in (1, -1): parts.append(prism([(-6.15, 1.95), (-6.70, 1.95), (-6.75, 2.55), (-6.40, 2.55)], s * 1.28 - 0.025, s * 1.28 + 0.025, PAINT, 'ep'))
parts.append(tube((0, 1.55, -7.9), (0, 1.45, -7.4), 0.025, METAL, 8))                # haleskid
# slæbesko (skids): rør, opbøjede snuder, tværrør, trin
for s in (1, -1):
    x = s * 1.12
    parts.append(tube((x, 0.06, -2.05), (x, 0.06, 1.50), 0.048, METAL, 14))
    parts.append(tube((x, 0.06, 1.50), (x, 0.20, 1.86), 0.048, METAL, 14)); parts.append(tube((x, 0.20, 1.86), (x, 0.38, 1.98), 0.046, METAL, 14))
    parts.append(sphere((x, 0.06, 1.50), 0.048, METAL)); parts.append(sphere((x, 0.20, 1.86), 0.048, METAL))
    parts.append(tube((x, 0.06, -2.05), (x, 0.12, -2.25), 0.046, METAL, 14))
    for zc in (0.95, -1.05):
        parts.append(tube((x, 0.06, zc), (s * 1.00, 0.44, zc), 0.055, METAL, 14)); parts.append(sphere((s * 1.0, 0.44, zc), 0.055, METAL))
        parts.append(tube((s * 1.00, 0.44, zc), (s * 0.55, 0.64, zc), 0.055, METAL, 14)); parts.append(sphere((x, 0.06, zc), 0.06, METAL))
    parts.append(box(s * 1.00 - 0.12, 0.40, -0.85, s * 1.00 + 0.12, 0.43, -0.35, DARKM))   # trin ved skydedøren
    for zc in (1.2, -0.4, -1.8): parts.append(box(x - 0.05, 0.0, zc - 0.08, x + 0.05, 0.03, zc + 0.08, RUBBER))   # slidsko
# lys: navigation (rød venstre/grøn højre), hvidt agterlys, røde antikollisionsblink top og bund, søgelys under næsen
parts.append(sphere((-1.31, 2.22, -6.45), 0.045, RED)); parts.append(sphere((1.31, 2.22, -6.45), 0.045, GREEN))
parts.append(sphere((0, 2.25, -7.86), 0.04, WHITE))
parts.append(box(-0.05, 2.88, -1.95, 0.05, 2.96, -1.85, RED)); parts.append(box(-0.05, 0.56, -0.9, 0.05, 0.62, -0.8, RED))
parts.append(tube((0.38, 0.62, 1.70), (0.38, 0.50, 1.80), 0.12, DARKM, 16)); parts.append(tube((0.38, 0.50, 1.80), (0.38, 0.46, 1.84), 0.10, LENS, 16))
# antenner og pitotrør
parts.append(tube((0, 0.62, -0.2), (0, 0.38, -0.35), 0.008, DARKM, 6)); parts.append(tube((0, 2.62, 0.4), (0, 2.95, 0.25), 0.008, DARKM, 6))
parts.append(tube((0.1, 2.40, 1.05), (0.1, 2.48, 1.55), 0.012, METAL, 6))
body = join([fus] + parts, 'body')

# ---------------------------------------------------------------- rotorer (origo i navet)
HUB = (0.0, 3.20, -0.35)
rp = [tube((0, 2.80, -0.35), (0, 3.25, -0.35), 0.075, METAL, 16)]
rp.append(tube((0, 3.12, -0.35), (0, 3.22, -0.35), 0.30, DARKM, 24))                   # starflex-navet
rp.append(tube((0, 3.22, -0.35), (0, 3.32, -0.35), 0.12, DARKM, 16))
for k in range(3):
    a = 2 * math.pi * k / 3; ca, sa = math.cos(a), math.sin(a)
    bm = bmesh.new()
    pts = []
    for r, ch, th, dr in ((0.28, 0.20, 0.06, 0.0), (0.7, 0.34, 0.045, 0.01), (4.9, 0.33, 0.035, 0.10), (5.35, 0.22, 0.03, 0.13)):
        for (u, v) in ((-ch / 2, -th / 2), (ch / 2, -th / 2), (ch / 2, th / 2), (-ch / 2, th / 2)):
            x, z = r * ca - u * sa, r * sa + u * ca                                   # radialt + korde
            pts.append(bm.verts.new(G(HUB[0] + x, HUB[1] + v - dr, HUB[2] + z)))
    for i in range(3):
        for j in range(4): bm.faces.new((pts[i * 4 + j], pts[i * 4 + (j + 1) % 4], pts[(i + 1) * 4 + (j + 1) % 4], pts[(i + 1) * 4 + j]))
    bm.faces.new(pts[:4][::-1]); bm.faces.new(pts[12:16])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    rp.append(mk('blade', bm, BLADE))
    tx, tz = 5.1 * ca, 5.1 * sa                                                      # hvide tip-markeringer
    rp.append(tube((HUB[0] + 5.0 * ca, HUB[1] - 0.12, HUB[2] + 5.0 * sa), (HUB[0] + 5.3 * ca, HUB[1] - 0.13, HUB[2] + 5.3 * sa), 0.021, TIP, 6))
rotor = join(rp, 'rotor')
TR = (0.20, 2.72, -7.82)
tp = [tube((0.04, TR[1], TR[2]), (TR[0] + 0.06, TR[1], TR[2]), 0.06, DARKM, 12)]
for k in range(2):
    s = 1 if k == 0 else -1
    tp.append(box(TR[0] - 0.012, TR[1] + s * 0.06, TR[2] - 0.07, TR[0] + 0.012, TR[1] + s * 0.93, TR[2] + 0.07, BLADE))
tail_rotor = join(tp, 'tail_rotor')
spot = bpy.data.objects.new('spot', None); link(spot); spot.location = G(0.38, 0.46, 1.84)

def set_origin(ob, p):
    activate(ob); bpy.context.scene.cursor.location = G(*p); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
set_origin(rotor, HUB); set_origin(tail_rotor, TR); set_origin(door_l, (-0.94, 1.5, -0.7)); set_origin(door_r, (0.94, 1.5, -0.7)); set_origin(body, (0, 0, 0))
for o in (body, rotor, tail_rotor, door_l, door_r):
    me = o.data
    try: me.shade_smooth_by_angle(angle=math.radians(38))
    except Exception: pass
tris = sum(len(p.vertices) - 2 for o in (body, rotor, tail_rotor, door_l, door_r) for p in o.data.polygons)
print('[heli] trekanter ca.', tris)

for o in bpy.context.view_layer.objects: o.select_set(o.name in ('body', 'rotor', 'tail_rotor', 'door_l', 'door_r', 'spot'))
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'heli.glb'), export_format='GLB', use_selection=True, export_yup=True, export_apply=True)
json.dump({'len': 10.9, 'wid': 2.4, 'height': 3.35, 'rotorY': HUB[1], 'rotorZ': HUB[2], 'rotorR': 5.35, 'tailRotor': list(TR), 'tailR': 0.93,
           'door': {'z0': DOOR_Z[0], 'z1': DOOR_Z[1], 'sill': DOOR_Y[0], 'x': 0.95, 'slide': 1.25}, 'spot': [0.38, 0.46, 1.84]},
          open(os.path.join(OUT, 'heli.json'), 'w'), indent=1)
print('[heli] eksporteret', os.path.join(OUT, 'heli.glb'))

if RENDER:                                                                           # kontrolbilleder
    os.makedirs(RENDER, exist_ok=True); sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.35, 0.38, 0.42, 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); link(sun); sun.data.energy = 3.0; sun.rotation_euler = (0.8, 0.2, 0.6)
    gp = bpy.data.objects.new('gp', bpy.data.meshes.new('gp')); link(gp)
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=30); bm.to_mesh(gp.data); bm.free(); gp.data.materials.append(mat('ground', 0x555555, 0.8))
    door_r.location.y += 1.25                                                        # en dør åben (bagud = +Y i Blender)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); link(cam); sc.camera = cam
    for i, (p, t) in enumerate((((9, -7, 3.2), (0, -0.5, 1.6)), ((-8, 6, 2.2), (0, 0.5, 1.5)), ((6.5, 1.2, 1.4), (0, 0.6, 1.4)), ((0, -14, 9), (0, 0, 1.5)))[:int(os.environ.get('HELI_VIEWS', 4))]):
        cam.location = p; d = Vector(t) - Vector(p); cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = 35
        sc.render.filepath = os.path.join(RENDER, 'heli_%d.png' % i); bpy.ops.render.render(write_still=True)
