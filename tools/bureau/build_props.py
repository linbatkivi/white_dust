# ==========================================================================
# Egne modeller til Ascension Agency (det der ikke findes som CC0): blender -b --factory-startup -P tools/props/build_props.py
#   → assets/models/custom/<navn>.glb · origo i gulvhøjde midt under modellen · forside mod +Z i Godot (= −Y i Blender)
#   Mål i meter efter virkelige produkter. Teksturer (rackfront, skærmbilleder, logo) tegnes med PIL i tools/props/tex/.
# ==========================================================================
import bpy, bmesh, math, os, random
from mathutils import Vector, Matrix
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'models', 'custom'); TEXD = os.path.join(os.path.dirname(__file__), 'tex')
os.makedirs(OUT, exist_ok=True); os.makedirs(TEXD, exist_ok=True)
random.seed(7)

# ---------------------------------------------------------------- teksturer (PIL kører uden for Blender – brug numpy i Blender i stedet)
import numpy as np
def save_img(name, arr):
    h, w = arr.shape[:2]; im = bpy.data.images.new(name, w, h, alpha=arr.shape[2] == 4)
    a = np.ones((h, w, 4), np.float32); a[..., :arr.shape[2]] = arr[::-1] / 255.0
    im.pixels.foreach_set(a.ravel()); im.filepath_raw = os.path.join(TEXD, name + '.png'); im.file_format = 'PNG'; im.save(); return im

def rack_front_tex():
    """42U rackfront: perforeret dør (sekskantet hulmønster) over servere med LED'er – farve + emission"""
    W, H = 512, 1536; col = np.zeros((H, W, 3), np.float32) + 14; emi = np.zeros((H, W, 3), np.float32)
    u = H / 42.0
    for k in range(42):
        y0 = int(k * u); y1 = int((k + 1) * u) - 2
        kind = random.random()
        if kind < 0.12: continue                                                   # tom plads (blindplade)
        col[y0:y1, 30:W - 30] = 32 + random.random() * 14                          # serverfront
        col[y0:y1, 30:44] = 70; col[y0:y1, W - 44:W - 30] = 70                     # ører med skruer
        for x in range(60, W - 120, 22):                                           # diskskuffer
            if random.random() < 0.8: col[y0 + 3:y1 - 3, x:x + 18] = 22 + random.random() * 10
        for n in range(random.randint(2, 6)):                                      # LED'er
            x = random.randint(W - 115, W - 55); y = random.randint(y0 + 3, max(y0 + 4, y1 - 5))
            c = random.choice([(40, 255, 90), (40, 140, 255), (40, 255, 90), (255, 170, 30)])
            emi[y:y + 4, x:x + 4] = c; col[y:y + 4, x:x + 4] = c
    # perforering lægges oven på (mørke huller, lys metalramme)
    yy, xx = np.mgrid[0:H, 0:W]; holes = (((xx + (yy // 9 % 2) * 4) % 8) < 5) & ((yy % 9) < 6)
    door = np.where(holes[..., None], col * 0.85, 26.0)
    door[:, :24] = 40; door[:, W - 24:] = 40; door[:18] = 40; door[H - 18:] = 40
    emi = np.where(holes[..., None], emi, 0)
    return save_img('rack_front', door), save_img('rack_front_e', emi)

def screen_tex(name, kind):
    W, H = 512, 300; c = np.zeros((H, W, 3), np.float32)
    c[:] = (8, 14, 22)
    if kind == 'cctv':                                                             # 3x3 overvågning
        for i in range(3):
            for j in range(3):
                x0, y0 = 6 + j * 168, 6 + i * 98
                base = 30 + random.random() * 40
                g = np.linspace(base * 0.5, base * 1.4, 162)[None, :, None]
                c[y0:y0 + 92, x0:x0 + 162] = g * np.array([0.8, 0.95, 0.85])
                c[y0 + 4:y0 + 9, x0 + 4:x0 + 40] = (200, 40, 40)
    elif kind == 'code':
        for k in range(28):
            y = 10 + k * 10; x = 10 + random.randint(0, 3) * 18; L = random.randint(60, 380)
            c[y:y + 5, x:x + L] = random.choice([(90, 200, 255), (150, 230, 140), (220, 220, 230), (255, 160, 90)])
    else:                                                                          # kort/radar
        yy, xx = np.mgrid[0:H, 0:W]
        c[(xx % 32 == 0) | (yy % 32 == 0)] = (20, 50, 60)
        r = np.hypot(xx - 300, yy - 150); c[(np.abs(r - 90) < 1.5) | (np.abs(r - 50) < 1.5)] = (40, 200, 160)
        for n in range(9):
            x, y = random.randint(40, 480), random.randint(30, 270); c[y:y + 6, x:x + 6] = (255, 70, 60)
    c[:3] = 30; c[-3:] = 30
    return save_img('screen_' + name, c)

def logo_tex():
    W, H = 1024, 256; c = np.zeros((H, W, 3), np.float32)
    # enkel blokskrift "ASCENSION" tegnet med rektangler (ingen fontafhængighed)
    G = {'A': ['01110', '10001', '11111', '10001', '10001'], 'S': ['01111', '10000', '01110', '00001', '11110'], 'C': ['01111', '10000', '10000', '10000', '01111'],
         'E': ['11111', '10000', '11110', '10000', '11111'], 'N': ['10001', '11001', '10101', '10011', '10001'], 'I': ['111', '010', '010', '010', '111'], 'O': ['01110', '10001', '10001', '10001', '01110']}
    x = 70; s = 26
    for ch in 'ASCENSION':
        g = G[ch]
        for r, row in enumerate(g):
            for q, v in enumerate(row):
                if v == '1': c[60 + r * s:60 + (r + 1) * s - 3, x + q * s:x + (q + 1) * s - 3] = (235, 240, 250)
        x += (len(g[0]) + 1) * s
    return save_img('logo', c)

# ---------------------------------------------------------------- materialer
def mat(name, col=(0.5, 0.5, 0.5), rough=0.5, metal=0.0, tex=None, emit_tex=None, emit=None, alpha=None):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if tex:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = tex; nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    if emit_tex:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = emit_tex; nt.links.new(t.outputs['Color'], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = 4.0
    elif emit:
        b.inputs['Emission Color'].default_value = (*emit[0], 1); b.inputs['Emission Strength'].default_value = emit[1]
    if alpha is not None:
        b.inputs['Alpha'].default_value = alpha
        try: m.surface_render_method = 'BLENDED'
        except Exception: pass
    return m

# ---------------------------------------------------------------- geometri-hjælpere
def link(ob): bpy.context.scene.collection.objects.link(ob); return ob
def activate(ob):
    bpy.context.view_layer.update()
    for o in bpy.context.scene.objects: o.select_set(False)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
def box(x0, y0, z0, x1, y1, z1, m, bev=0.004, uv=None):
    """akse-orienteret kasse i spil-koordinater: x, y=op, z=frem(+Z) → Blender (x, −z, y)"""
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    c = Vector(((x0 + x1) / 2, -(z0 + z1) / 2, (y0 + y1) / 2)); s = Vector((x1 - x0, z1 - z0, y1 - y0))
    for v in bm.verts: v.co = Vector((v.co.x * s.x, v.co.y * s.y, v.co.z * s.z)) + c
    me = bpy.data.meshes.new('b'); bm.to_mesh(me); bm.free(); ob = link(bpy.data.objects.new('b', me)); me.materials.append(m)
    if bev > 0 and min(s) > bev * 2.5:
        md = ob.modifiers.new('bv', 'BEVEL'); md.width = bev; md.segments = 2; md.limit_method = 'ANGLE'
        activate(ob); bpy.ops.object.modifier_apply(modifier=md.name)
    if uv == 'front':                                                               # forsiden (+Z) får hele billedet
        bm = bmesh.new(); bm.from_mesh(me); ul = bm.loops.layers.uv.new()
        for f in bm.faces:
            for l in f.loops:
                p = l.vert.co; l[ul].uv = ((p.x - x0) / (x1 - x0), (p.z - y0) / (y1 - y0))
        bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = False
    return ob
def cyl(x, y0, z, r, h, m, seg=20, axis='y', r2=None):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    me = bpy.data.meshes.new('c'); bm.to_mesh(me); bm.free(); ob = link(bpy.data.objects.new('c', me)); me.materials.append(m)
    if axis == 'y': ob.location = (x, -z, y0 + h / 2)
    elif axis == 'x': ob.rotation_euler = (0, math.pi / 2, 0); ob.location = (x, -z, y0)
    else: ob.rotation_euler = (math.pi / 2, 0, 0); ob.location = (x, -z, y0)
    for p in me.polygons: p.use_smooth = True
    return ob
def export(name, objs):
    for o in bpy.context.scene.objects: o.select_set(o in objs)
    activate(objs[0])
    for o in objs: o.select_set(True)
    bpy.ops.object.join(); ob = bpy.context.view_layer.objects.active; ob.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, name + '.glb'), export_format='GLB', use_selection=True, export_yup=True, export_apply=True)
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons); print('PROP', name, tris)
    bpy.data.objects.remove(ob)

def reset():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o)

# ---------------------------------------------------------------- modellerne
bpy.ops.wm.read_factory_settings(use_empty=True)
RF, RE = rack_front_tex(); SC = {k: screen_tex(k, k) for k in ('cctv', 'code', 'map')}; LG = logo_tex()
BLACK = mat('powder_black', (0.025, 0.026, 0.028), 0.55, 0.3); STEEL = mat('steel_brushed', (0.62, 0.63, 0.64), 0.28, 1.0)
DARKSTEEL = mat('steel_dark', (0.12, 0.125, 0.13), 0.4, 0.9); PLASTIC = mat('plastic_black', (0.02, 0.02, 0.022), 0.45)
WHITE_LAM = mat('laminate_white', (0.78, 0.78, 0.76), 0.35); FABRIC = mat('fabric_grey', (0.16, 0.17, 0.18), 0.95)
MESH = mat('mesh_black', (0.03, 0.03, 0.03), 0.8); GLASS = mat('glass_clear', (0.6, 0.66, 0.68), 0.04, alpha=0.22)
WOOD = mat('walnut', (0.16, 0.09, 0.05), 0.42); CORIAN = mat('corian_white', (0.82, 0.82, 0.8), 0.22)
RACKF = mat('rack_front', (1, 1, 1), 0.45, 0.6, tex=RF, emit_tex=RE); LOGO = mat('logo_glow', (1, 1, 1), 0.3, emit=((0.9, 0.95, 1.0), 6.0))
LOGOT = mat('logo', (1, 1, 1), 0.3, tex=LG, emit_tex=LG); RED = mat('led_red', (1, 0.1, 0.05), 0.3, emit=((1, 0.1, 0.05), 8)); GREEN = mat('led_green', (0.1, 1, 0.3), 0.3, emit=((0.1, 1, 0.3), 8))
OLIVE = mat('locker_grey', (0.24, 0.26, 0.25), 0.5, 0.6); PINE = mat('pallet_pine', (0.55, 0.42, 0.28), 0.8)
SCR = {k: mat('screen_' + k, (1, 1, 1), 0.15, tex=v, emit_tex=v) for k, v in SC.items()}

# 42U serverrack (60 × 107 × 200 cm)
reset(); o = []
o.append(box(-0.3, 0.0, -0.535, 0.3, 2.0, 0.535, BLACK, 0.006))
o.append(box(-0.285, 0.06, 0.535, 0.285, 1.96, 0.548, RACKF, 0.0, uv='front'))                    # perforeret fordør
o.append(box(-0.285, 0.06, -0.548, 0.285, 1.96, -0.535, MESH, 0.0))                               # bagdør
o.append(box(0.21, 0.95, 0.548, 0.235, 1.15, 0.575, STEEL, 0.004))                                # håndtag
o.append(box(-0.3, 2.0, -0.535, 0.3, 2.02, 0.535, DARKSTEEL, 0.003))                              # tagplade
for x in (-0.25, 0.25):
    for z in (-0.45, 0.45): o.append(cyl(x, 0.0, z, 0.025, 0.04, DARKSTEEL, 10))                  # fødder
export('server_rack', o)

# 24" skærm på fod (forsiden mod +Z) – tre varianter
for k in ('cctv', 'code', 'map'):
    reset(); o = []
    o.append(box(-0.27, 0.11, -0.025, 0.27, 0.43, 0.0, PLASTIC, 0.006))
    o.append(box(-0.262, 0.118, 0.0, 0.262, 0.422, 0.004, SCR[k], 0.0, uv='front'))
    o.append(box(-0.03, 0.0, -0.1, 0.03, 0.2, -0.06, PLASTIC, 0.006)); o.append(box(-0.11, 0.0, -0.17, 0.11, 0.012, 0.02, PLASTIC, 0.004))
    export('monitor_' + k, o)

# kontorstol (sæde 47 cm)
reset(); o = []
for a in range(5):
    ang = a / 5 * math.tau; x, z = math.cos(ang) * 0.3, math.sin(ang) * 0.3
    arm = box(-0.02, 0.06, -0.15, 0.02, 0.09, 0.15, PLASTIC, 0.008); arm.rotation_euler = (0, 0, -ang + math.pi / 2); arm.location = (x / 2, -z / 2, 0); o.append(arm)
    o.append(cyl(x, 0.0, z, 0.03, 0.05, PLASTIC, 10, 'x'))
o.append(cyl(0, 0.08, 0, 0.025, 0.32, STEEL, 14)); o.append(cyl(0, 0.38, 0, 0.06, 0.06, PLASTIC, 14))
o.append(box(-0.25, 0.44, -0.24, 0.25, 0.52, 0.24, FABRIC, 0.03))
o.append(box(-0.23, 0.6, -0.31, 0.23, 1.12, -0.26, MESH, 0.025)); o.append(box(-0.04, 0.45, -0.3, 0.04, 0.62, -0.25, PLASTIC, 0.01))
for x in (-0.27, 0.27): o.append(box(x - 0.025, 0.52, -0.12, x + 0.025, 0.7, -0.08, PLASTIC, 0.008)); o.append(box(x - 0.035, 0.7, -0.2, x + 0.035, 0.725, 0.08, PLASTIC, 0.01))
export('office_chair', o)

# skrivebordspar med afskærmning (2 × 160 × 80 cm, bordhøjde 74 cm, skærmvæg 120 cm)
reset(); o = []
for s in (-1, 1):
    zc = s * 0.42
    o.append(box(-0.8, 0.715, zc - 0.4, 0.8, 0.74, zc + 0.4, WHITE_LAM, 0.003))
    for x in (-0.75, 0.75): o.append(box(x - 0.03, 0.0, zc - 0.33, x + 0.03, 0.715, zc + 0.33, STEEL, 0.004))
    o.append(box(-0.72, 0.6, zc - 0.05 * s, 0.72, 0.64, zc + 0.02 * s, STEEL, 0.003))                          # kabelbakke
o.append(box(-0.8, 0.74, -0.02, 0.8, 1.2, 0.02, FABRIC, 0.01))
o.append(box(-0.8, 1.19, -0.025, 0.8, 1.21, 0.025, STEEL, 0.004))
export('desk_pair', o)

# receptionsskranke (320 × 90 cm, 110 cm høj) med baggrundsbelyst logo
reset(); o = []
o.append(box(-1.6, 0.0, -0.45, 1.6, 1.08, 0.45, WALNUT := WOOD, 0.01))
o.append(box(-1.65, 1.08, -0.1, 1.65, 1.12, 0.5, CORIAN, 0.008))                                # disk ud mod gæsterne
o.append(box(-1.6, 0.72, -0.45, 1.6, 0.75, 0.0, CORIAN, 0.005))                                 # arbejdsbord bagved
o.append(box(-1.1, 0.42, 0.45, 1.1, 0.88, 0.462, LOGOT, 0.0, uv='front'))
o.append(box(-1.6, 0.0, 0.43, 1.6, 0.05, 0.47, LOGO, 0.0))                                      # lysliste ved gulvet
export('reception_desk', o)

# elevatordøre (2 × 55 cm, 220 cm) i karm med betjeningspanel og etagedisplay – bagkant mod væggen (z=0)
reset(); o = []
o.append(box(-0.8, 0.0, 0.0, -0.6, 2.45, 0.08, STEEL, 0.004)); o.append(box(0.6, 0.0, 0.0, 0.8, 2.45, 0.08, STEEL, 0.004))
o.append(box(-0.8, 2.2, 0.0, 0.8, 2.45, 0.08, STEEL, 0.004))
o.append(box(-0.6, 0.0, 0.0, -0.005, 2.2, 0.04, STEEL, 0.002)); o.append(box(0.005, 0.0, 0.0, 0.6, 2.2, 0.04, STEEL, 0.002))
o.append(box(-0.2, 2.26, 0.08, 0.2, 2.38, 0.09, RED, 0.0))                                       # etagedisplay
o.append(box(0.95, 1.0, 0.0, 1.07, 1.3, 0.025, STEEL, 0.003)); o.append(cyl(1.01, 1.18, 0.03, 0.018, 0.01, GREEN, 12, 'z')); o.append(cyl(1.01, 1.1, 0.03, 0.018, 0.01, GREEN, 12, 'z'))
export('elevator_doors', o)

# adgangsgate (speed gate) med glasklapper – 140 cm lang, 100 cm høj
reset(); o = []
for x in (-0.55, 0.55):
    o.append(box(x - 0.1, 0.0, -0.7, x + 0.1, 1.0, 0.7, STEEL, 0.02)); o.append(box(x - 0.09, 1.0, -0.69, x + 0.09, 1.015, 0.69, GLASS, 0.0))
    o.append(box(x - 0.06, 0.92, 0.6, x + 0.06, 1.0, 0.68, GREEN, 0.0))
o.append(box(-0.45, 0.3, -0.01, -0.02, 1.1, 0.01, GLASS, 0.0)); o.append(box(0.02, 0.3, -0.01, 0.45, 1.1, 0.01, GLASS, 0.0))
export('speed_gate', o)

# våbenskab (stål med gitterdøre) 100 × 50 × 190 cm
reset(); o = []
o.append(box(-0.5, 0.0, -0.25, 0.5, 1.9, 0.25, OLIVE, 0.008))
o.append(box(-0.48, 0.05, 0.25, -0.01, 1.86, 0.265, MESH, 0.0)); o.append(box(0.01, 0.05, 0.25, 0.48, 1.86, 0.265, MESH, 0.0))
o.append(box(-0.04, 0.85, 0.265, -0.02, 1.05, 0.285, STEEL, 0.003)); o.append(box(0.02, 0.85, 0.265, 0.04, 1.05, 0.285, STEEL, 0.003))
export('weapon_locker', o)

# europalle 120 × 80 × 14,4 cm
reset(); o = []
for x in (-0.55, 0.0, 0.55): o.append(box(x - 0.05, 0.0, -0.4, x + 0.05, 0.022, 0.4, PINE, 0.002))
for x in (-0.55, 0.0, 0.55):
    for z in (-0.34, 0.0, 0.34): o.append(box(x - 0.05, 0.022, z - 0.05, x + 0.05, 0.122, z + 0.05, PINE, 0.004))
for z in (-0.36, -0.18, 0.0, 0.18, 0.36): o.append(box(-0.6, 0.122, z - 0.05, 0.6, 0.144, z + 0.05, PINE, 0.002))
export('pallet', o)

# ---------------------------------------------------------------- v2: "afbrudt midt i en arbejdsdag" – småting og vægting
def art_tex(name, seed):
    rr = random.Random(seed); W_, H_ = 512, 640; c = np.zeros((H_, W_, 3), np.float32)
    base = rr.choice([(30, 32, 36), (210, 205, 195), (20, 24, 30), (180, 160, 130)]); c[:] = base
    yy, xx = np.mgrid[0:H_, 0:W_]
    for k in range(rr.randint(3, 6)):                                              # abstrakte flader og cirkler (moderne kunst)
        col = rr.choice([(190, 60, 40), (220, 170, 60), (40, 70, 110), (240, 235, 225), (15, 15, 18), (120, 140, 120)])
        if rr.random() < 0.5:
            x0, y0 = rr.randint(0, W_ - 100), rr.randint(0, H_ - 100); c[y0:y0 + rr.randint(60, 300), x0:x0 + rr.randint(60, 300)] = col
        else:
            cx_, cy_, r_ = rr.randint(80, 430), rr.randint(80, 560), rr.randint(40, 180); c[(xx - cx_) ** 2 + (yy - cy_) ** 2 < r_ * r_] = col
    c += np.random.RandomState(seed).normal(0, 4, c.shape); return save_img(name, np.clip(c, 0, 255))
def paper_tex():
    W_, H_ = 256, 330; c = np.zeros((H_, W_, 3), np.float32) + 236
    for k in range(22):
        y = 30 + k * 12; L = random.randint(80, 200); c[y:y + 3, 24:24 + L] = 90
    c[12:22, 24:140] = 40; return save_img('paper', c)
def wb_tex():
    W_, H_ = 1024, 512; c = np.zeros((H_, W_, 3), np.float32) + 240
    for k in range(40):                                                              # tusch: pile, kasser, streger (taktik/projekt)
        col = random.choice([(30, 60, 160), (180, 40, 40), (30, 30, 30), (40, 140, 60)])
        x, y = random.randint(40, 960), random.randint(40, 470); L = random.randint(30, 220)
        if random.random() < 0.5: c[y:y + 4, x:min(W_, x + L)] = col
        else: c[y:min(H_, y + L // 2), x:x + 4] = col
    return save_img('whiteboard', c)
def tv_tex():
    W_, H_ = 768, 432; c = np.zeros((H_, W_, 3), np.float32); c[:] = (10, 18, 30)
    c[20:60, 20:420] = (220, 60, 50); c[80:400, 20:470] = (24, 40, 62)                # "BREAKING"-banner og kort
    yy, xx = np.mgrid[0:H_, 0:W_]
    c[((xx - 245) ** 2 + (yy - 240) ** 2 < 120 ** 2) & ((xx + yy) % 9 < 2)] = (60, 180, 200)
    for k in range(10): y = 90 + k * 30; c[y:y + 10, 500:500 + random.randint(80, 240)] = (200, 210, 220)
    return save_img('tv', c)
ART = [mat('art_%d' % k, (1, 1, 1), 0.6, tex=art_tex('art_%d' % k, 100 + k)) for k in range(4)]
PAPER = mat('paper', (1, 1, 1), 0.85, tex=paper_tex()); WB = mat('whiteboard', (1, 1, 1), 0.15, tex=wb_tex())
TV = mat('tv_screen', (1, 1, 1), 0.1, tex=tv_tex(), emit_tex=bpy.data.images['tv'])
CERAMIC = mat('ceramic_white', (0.86, 0.85, 0.82), 0.25); COFFEE = mat('coffee', (0.09, 0.05, 0.03), 0.05)
LEATHER = mat('leather_black', (0.04, 0.035, 0.03), 0.42); RUG = mat('rug_grey', (0.16, 0.16, 0.17), 0.98)
BRUSHED = mat('steel_dark2', (0.25, 0.26, 0.27), 0.3, 1.0); FRAME = mat('frame_black', (0.03, 0.03, 0.03), 0.4, 0.6)
BOOKS = [mat('book_%d' % k, c, 0.7) for k, c in enumerate([(0.35, 0.08, 0.06), (0.07, 0.12, 0.22), (0.12, 0.2, 0.12), (0.75, 0.7, 0.6), (0.1, 0.1, 0.1), (0.5, 0.35, 0.15)])]
CONCRETE = mat('concrete_fine', (0.42, 0.42, 0.41), 0.75); SOIL = mat('soil', (0.08, 0.06, 0.04), 1.0)

# tastatur + mus
reset(); o = [box(-0.22, 0.0, -0.07, 0.22, 0.02, 0.07, PLASTIC, 0.004)]
for r_ in range(5):
    for c_ in range(15): o.append(box(-0.205 + c_ * 0.0275, 0.02, -0.06 + r_ * 0.026, -0.183 + c_ * 0.0275, 0.03, -0.04 + r_ * 0.026, mat('key_dark', (0.06, 0.06, 0.065), 0.5), 0.0))
o.append(box(0.27, 0.0, -0.03, 0.33, 0.035, 0.07, PLASTIC, 0.012)); export('keyboard_mouse', o)
# kaffekop (fyldt) og papirbunke
reset(); o = [cyl(0, 0.0, 0, 0.042, 0.095, CERAMIC, 24, r2=0.046), cyl(0, 0.08, 0, 0.038, 0.002, COFFEE, 24)]
h_ = bpy.data.meshes.new('handle'); bm = bmesh.new(); bmesh.ops.create_circle(bm, segments=10, radius=0.025)
o.append(box(0.044, 0.03, -0.004, 0.068, 0.07, 0.004, CERAMIC, 0.003)); export('coffee_cup', o)
reset(); o = []
for k in range(6):
    sh = box(-0.105, k * 0.004, -0.148, 0.105, k * 0.004 + 0.004, 0.148, PAPER, 0.0, uv=None); sh.rotation_euler = (0, 0, random.uniform(-0.25, 0.25)); o.append(sh)
top = box(-0.105, 0.024, -0.148, 0.105, 0.0245, 0.148, PAPER, 0.0); o.append(top)
for f in top.data.polygons:
    pass
export('paper_stack', o)
# whiteboard på væg (180 × 100 cm), bagside mod væggen (z=0)
reset(); o = [box(-0.9, 0.9, 0.0, 0.9, 1.9, 0.02, FRAME, 0.004), box(-0.88, 0.92, 0.02, 0.88, 1.88, 0.024, WB, 0.0, uv='front'), box(-0.6, 0.86, 0.0, 0.6, 0.9, 0.08, FRAME, 0.003)]
export('whiteboard', o)
# vægkunst i fire varianter (100 × 125 cm, sort ramme)
for k in range(4):
    reset(); o = [box(-0.52, 1.0, 0.0, 0.52, 2.3, 0.04, FRAME, 0.004), box(-0.5, 1.02, 0.04, 0.5, 2.28, 0.045, ART[k], 0.0, uv='front')]
    export('wall_art_%d' % k, o)
# vægskærm (65") med nyheder
reset(); o = [box(-0.73, 1.25, 0.0, 0.73, 2.08, 0.05, PLASTIC, 0.006), box(-0.715, 1.265, 0.05, 0.715, 2.065, 0.054, TV, 0.0, uv='front')]
export('wall_tv', o)
# reol med bøger (90 × 35 × 200 cm)
reset(); o = [box(-0.45, 0.0, -0.175, 0.45, 2.0, 0.175, mat('walnut_prop', (0.13, 0.075, 0.045), 0.45), 0.004)]
o[0].data.materials.clear(); o[0].data.materials.append(bpy.data.materials['walnut_prop'])
for sh_ in range(5):
    y0 = 0.08 + sh_ * 0.38; x = -0.42
    while x < 0.4:
        w_ = random.uniform(0.02, 0.05); h__ = random.uniform(0.22, 0.32)
        if random.random() < 0.88: o.append(box(x, y0, -0.15, x + w_, y0 + h__, 0.16, random.choice(BOOKS), 0.002))
        x += w_ + 0.003
export('bookshelf', o)
# kaffebar (240 × 65 × 105 cm) med kaffemaskine
reset(); o = [box(-1.2, 0.0, -0.325, 1.2, 1.0, 0.325, mat('walnut_prop'), 0.006), box(-1.22, 1.0, -0.34, 1.22, 1.04, 0.34, CORIAN, 0.004),
              box(-0.35, 1.04, -0.25, 0.05, 1.5, 0.15, BRUSHED, 0.01), box(-0.3, 1.2, 0.15, 0.0, 1.22, 0.2, BLACK, 0.002)]
o.append(box(0.3, 1.04, -0.15, 0.6, 1.07, 0.15, mat('tray', (0.05, 0.05, 0.05), 0.4)))
for k in range(4): o.append(cyl(0.36 + (k % 2) * 0.12, 1.07, -0.08 + (k // 2) * 0.13, 0.04, 0.09, CERAMIC, 16, r2=0.044))
export('coffee_bar', o)
# tæppe (300 × 200 cm), stor plantekumme i beton, kunstsokkel
reset(); export('rug', [box(-1.5, 0.0, -1.0, 1.5, 0.012, 1.0, RUG, 0.004)])
reset(); o = [box(-0.45, 0.0, -0.45, 0.45, 0.62, 0.45, CONCRETE, 0.02), box(-0.4, 0.55, -0.4, 0.4, 0.6, 0.4, SOIL, 0.0)]; export('planter_large', o)
reset(); export('plinth', [box(-0.35, 0.0, -0.35, 0.35, 1.0, 0.35, CORIAN, 0.006)])
# kabelbakke (2 m sektion, 30 cm bred, med kabler) – ophængt
reset(); o = [box(-1.0, 0.0, -0.15, 1.0, 0.012, 0.15, BRUSHED, 0.0), box(-1.0, 0.0, -0.15, 1.0, 0.08, -0.14, BRUSHED, 0.0), box(-1.0, 0.0, 0.14, 1.0, 0.08, 0.15, BRUSHED, 0.0)]
for k in range(7): o.append(cyl(-1.0, 0.025 + (k % 2) * 0.018, -0.11 + k * 0.035, 0.012, 2.0, random.choice([mat('cable_blue', (0.05, 0.15, 0.5), 0.5), mat('cable_y', (0.7, 0.55, 0.05), 0.5), PLASTIC]), 8, 'x'))
for x in (-0.9, 0.9): o.append(box(x - 0.01, 0.0, -0.17, x + 0.01, 1.2, -0.15, BRUSHED, 0.0)); o.append(box(x - 0.01, 0.0, 0.15, x + 0.01, 1.2, 0.17, BRUSHED, 0.0))
export('cable_tray', o)
print('[props] færdig')
