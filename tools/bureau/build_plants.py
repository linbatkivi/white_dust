# ==========================================================================
# bureau · store, realistiske stueplanter til lobby, atrium og gange – blender -b --factory-startup -P tools/bureau/build_plants.py
#   → cache/custom/plant_fig.glb (fiddle-leaf fig, 2,3 m) · plant_palm.glb (kentia-palme, 2,2 m) · plant_strelitzia.glb (paradisfugl, 2,4 m)
#   + varianterne uden krukke (…_np) til de store plantekasser. Hvert blad er et rigtigt, bøjet og foldet net (ribber, midtribbe, hængende
#   spids) med egen bladtekstur, spiral-stilling (137,5°) og individuel størrelse – ikke et kryds af billeder. Origo i gulvhøjde, midt under.
# ==========================================================================
import os, sys, math, random
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'build_props.py')).read()
exec(src[:src.index('# ---------------------------------------------------------------- modellerne')])     # hjælperne: mat, box, cyl, export, reset, save_img
OUT = os.path.join(HERE, 'cache', 'custom')
bpy.ops.wm.read_factory_settings(use_empty=True)
rnd = random.Random(23)
V = Vector

# ---------------------------------------------------------------- bladtekstur (RGB 0-255): grundfarve, midtribbe og sideribber, støj
def leaf_tex(name, base, light, vein, kind):
    W_, H_ = 256, 512; v, u = np.mgrid[0:H_, 0:W_]; v = v / (H_ - 1.0); u = u / (W_ - 1.0)
    d = np.abs(u - 0.5) * 2                                                        # 0 = midtribbe, 1 = kant
    t = np.clip(1 - d ** 1.6, 0, 1)[..., None]
    c = np.array(base, np.float32) * (1 - t) + np.array(light, np.float32) * t       # lysere mod midten
    c = c * (0.86 + 0.28 * v[..., None])                                            # lidt lysere mod spidsen
    if kind == 'fig':
        w = v * 15.0 - d * 6.5; side = np.abs((w % 1.0) - 0.5) < 0.055             # sideribber (skrå) – blegere
        c[side & (d > 0.04)] = c[side & (d > 0.04)] * 0.45 + np.array(vein, np.float32) * 0.55
    elif kind == 'strel':
        side = np.abs(((v * 46.0 + d * 1.6) % 1.0) - 0.5) < 0.12
        c[side] = c[side] * 0.82 + np.array(vein, np.float32) * 0.18
    mid = d < 0.035; c[mid] = np.array(vein, np.float32)
    n = np.random.RandomState(5).normal(0, 5.0, c.shape); n2 = np.random.RandomState(6).normal(0, 12.0, (H_ // 8, W_ // 8, 1)).repeat(8, 0).repeat(8, 1)
    c = c + n + n2
    return save_img(name, np.clip(c, 0, 255))

LEAF_FIG = mat('leaf_fig', (1, 1, 1), 0.32, tex=leaf_tex('leaf_fig', (14, 50, 16), (34, 92, 30), (170, 190, 110), 'fig'))
LEAF_PALM = mat('leaf_palm', (1, 1, 1), 0.5, tex=leaf_tex('leaf_palm', (22, 70, 22), (52, 118, 38), (150, 170, 90), 'palm'))
LEAF_STREL = mat('leaf_strel', (1, 1, 1), 0.4, tex=leaf_tex('leaf_strel', (24, 78, 52), (48, 128, 84), (176, 200, 140), 'strel'))
BARK = mat('plant_bark', (0.20, 0.15, 0.11), 0.85); STEM = mat('plant_stem', (0.16, 0.30, 0.10), 0.5)
POT = mat('plant_pot', (0.085, 0.088, 0.095), 0.32, 0.15); POTRIM = mat('plant_potrim', (0.62, 0.50, 0.30), 0.3, 1.0)
DIRT = mat('plant_soil', (0.06, 0.045, 0.03), 1.0); PEB = mat('plant_gravel', (0.30, 0.29, 0.27), 0.9)

# ---------------------------------------------------------------- hjælpere (Blender-koordinater: Z op)
def shape_w(kind, t):
    if kind == 'obovate': return min(1.0, math.sin(math.pi * t ** 1.05) ** 0.6 * (0.78 + 0.5 * t))      # fiddle-leaf: bred, bredest mod den afrundede spids
    if kind == 'ovate': return math.sin(math.pi * t ** 0.8) ** 0.9
    if kind == 'lance': return math.sin(math.pi * t) ** 0.75
    if kind == 'paddle': return (min(1.0, 0.32 + 4.5 * t) if t < 0.66 else max(0.0, 1 - ((t - 0.66) / 0.34) ** 2.2) ** 0.55)   # strelitzia: parallelle kanter, afrundet spids
    return 1.0

def leaf_bm(L, Wd, kind, droop, fold, nv, nu, wave=0.0, seed=0.0, curl=0.0):
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new(); G = []; uv = {}
    for i in range(nv + 1):
        t = i / nv; w = Wd / 2 * shape_w(kind, t); row = []
        for j in range(nu + 1):
            s = -1 + 2 * j / nu; x = s * w
            z = fold * abs(x) - droop * L * t * t + wave * math.sin(t * 8.5 + s * 2.2 + seed) * (abs(s) ** 1.3) * L
            y = t * L - 0.02 * L * s * s * t; x += curl * L * t * t
            v = bm.verts.new((x, y, z)); uv[v] = (0.5 + s / 2, t); row.append(v)
        G.append(row)
    def face(vs, flip):
        f = bm.faces.new(vs[::-1] if flip else vs)
        for lp in f.loops: lp[uvl].uv = uv[lp.vert]
        f.smooth = True
    for i in range(nv):
        for j in range(nu): face((G[i][j], G[i][j + 1], G[i + 1][j + 1], G[i + 1][j]), False)
    # bagside: egne punkter 1,5 mm under – samme UV, vendt (spillet tegner kun forsider)
    B2 = []
    for i in range(nv + 1):
        row = []
        for j in range(nu + 1):
            p = G[i][j].co; v = bm.verts.new((p.x, p.y, p.z - 0.0015)); uv[v] = uv[G[i][j]]; row.append(v)
        B2.append(row)
    for i in range(nv):
        for j in range(nu): face((B2[i][j], B2[i][j + 1], B2[i + 1][j + 1], B2[i + 1][j]), True)
    return bm

def basis(d, up=V((0, 0, 1))):
    d = V(d).normalized(); x = d.cross(up)
    if x.length < 1e-4: x = V((1, 0, 0))
    x.normalize(); z = x.cross(d).normalized()
    return Matrix(((x.x, d.x, z.x, 0), (x.y, d.y, z.y, 0), (x.z, d.z, z.z, 0), (0, 0, 0, 1)))

def put_leaf(objs, mt, pos, d, L, Wd, kind, droop, fold, nv, nu, wave=0.0, roll=0.0, curl=0.0):
    bm = leaf_bm(L, Wd, kind, droop, fold, nv, nu, wave, rnd.uniform(0, 6.28), curl)
    M = Matrix.Translation(V(pos)) @ basis(d) @ Matrix.Rotation(roll, 4, 'Y')
    bm.transform(M); me = bpy.data.meshes.new('leaf'); bm.to_mesh(me); bm.free(); me.materials.append(mt)
    ob = link(bpy.data.objects.new('leaf', me)); objs.append(ob); return ob

def tube(objs, mt, pts, r0, r1, seg=7):
    bm = bmesh.new(); rings = []
    for k, p in enumerate(pts):
        T = (pts[min(k + 1, len(pts) - 1)] - pts[max(k - 1, 0)]).normalized(); Mb = basis(T)
        r = r0 + (r1 - r0) * k / (len(pts) - 1); ring = []
        for a in range(seg):
            ang = math.tau * a / seg; q = Mb @ V((math.cos(ang) * r, 0, math.sin(ang) * r)); ring.append(bm.verts.new(V(p) + q))
        rings.append(ring)
    for k in range(len(rings) - 1):
        for a in range(seg):
            f = bm.faces.new((rings[k][a], rings[k][(a + 1) % seg], rings[k + 1][(a + 1) % seg], rings[k + 1][a])); f.smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('tube'); bm.to_mesh(me); bm.free(); me.materials.append(mt)
    ob = link(bpy.data.objects.new('tube', me)); objs.append(ob); return ob

def bez(p0, p1, p2, p3, t):
    a = 1 - t; return V(p0) * a ** 3 + V(p1) * 3 * a * a * t + V(p2) * 3 * a * t * t + V(p3) * t ** 3

def pot(objs, h=0.5):
    # tung grafitglasseret krukke med messingkant, jord og lidt grus
    objs.append(cyl(0, 0.0, 0, 0.215, h, POT, 40, r2=0.285)); objs.append(cyl(0, h - 0.012, 0, 0.292, 0.02, POTRIM, 40, r2=0.292))
    objs.append(cyl(0, h - 0.035, 0, 0.268, 0.03, DIRT, 32))
    for k in range(26):
        a = rnd.uniform(0, math.tau); r = rnd.uniform(0.07, 0.25); s = rnd.uniform(0.012, 0.022)
        objs.append(box(math.cos(a) * r - s, h - 0.012, math.sin(a) * r - s, math.cos(a) * r + s, h + 0.006, math.sin(a) * r + s, PEB, 0.004))

# ---------------------------------------------------------------- 1) fiddle-leaf fig (Ficus lyrata)
def fig(name, with_pot=True):
    reset(); o = []; z0 = 0.5 if with_pot else 0.05
    if with_pot: pot(o)
    top = z0 + 1.55; pts = []
    for k in range(14):
        t = k / 13; pts.append(V((0.045 * math.sin(t * 2.4), 0.03 * math.sin(t * 1.7 + 1), z0 - 0.04 + (top - z0 + 0.04) * t)))
    tube(o, BARK, pts, 0.026, 0.011, 9)
    n = 46
    for k in range(n):
        t = k / (n - 1); h = z0 + 0.5 + (top - z0 - 0.5) * (t ** 0.8); az = math.radians(k * 137.5 + rnd.uniform(-10, 10))
        pk = min(range(len(pts)), key=lambda i: abs(pts[i].z - h)); base = pts[pk]
        L = 0.40 - 0.12 * t + rnd.uniform(-0.03, 0.03); Wd = L * 0.80
        el = math.radians(24 + 26 * t + rnd.uniform(-8, 8)); d = V((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el)))
        pet = V((math.cos(az), math.sin(az), 0.35)).normalized() * 0.035
        tube(o, STEM, [base, base + pet * 0.5, base + pet], 0.006, 0.005, 5)
        put_leaf(o, LEAF_FIG, base + pet, d, L, Wd, 'obovate', 0.30 + rnd.uniform(-0.1, 0.12), 0.30, 9, 4, wave=0.014, roll=rnd.uniform(-0.25, 0.25))
    for k in range(5):                                                              # nye, opretstående blade i toppen
        az = math.tau * k / 5 + rnd.uniform(-0.3, 0.3); el = math.radians(62 + rnd.uniform(-8, 8)); d = V((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el)))
        put_leaf(o, LEAF_FIG, pts[-1], d, 0.19 + rnd.uniform(0, 0.05), 0.14, 'obovate', 0.15, 0.4, 7, 3)
    export(name + ('' if with_pot else '_np'), o)

# ---------------------------------------------------------------- 2) kentia-palme: buede stilke med dobbeltrækkede, nedhængende småblade
def palm(name, with_pot=True):
    reset(); o = []; z0 = 0.5 if with_pot else 0.05
    if with_pot: pot(o)
    n = 8
    for s in range(n):
        az = math.tau * s / n + rnd.uniform(-0.2, 0.2); lean = 0.55 + rnd.uniform(-0.2, 0.25); H = 1.55 + rnd.uniform(-0.3, 0.35)
        c = V((math.cos(az), math.sin(az), 0)); r0 = V((c.x * 0.03, c.y * 0.03, z0 - 0.03))
        p1 = r0 + V((c.x * 0.05, c.y * 0.05, H * 0.45)); p2 = r0 + V((c.x * lean * 0.55, c.y * lean * 0.55, H * 0.95)); p3 = r0 + V((c.x * lean * 1.25, c.y * lean * 1.25, H * 1.02))
        P = [bez(r0, p1, p2, p3, t / 22) for t in range(23)]
        tube(o, STEM, P, 0.011, 0.004, 5)
        nl = 17
        for k in range(nl):
            t = 0.36 + 0.64 * k / (nl - 1); p = bez(r0, p1, p2, p3, t); tg = (bez(r0, p1, p2, p3, min(1, t + 0.02)) - bez(r0, p1, p2, p3, max(0, t - 0.02))).normalized()
            side = tg.cross(V((0, 0, 1))); side = side.normalized() if side.length > 1e-3 else V((1, 0, 0))
            Ls = (0.40 - 0.2 * ((t - 0.36) / 0.64) ** 1.3) * (0.9 + rnd.random() * 0.2)
            for sg in (-1, 1):
                d = (side * sg * math.cos(math.radians(48)) + tg * math.sin(math.radians(48)) + V((0, 0, -0.18))).normalized()
                put_leaf(o, LEAF_PALM, p, d, Ls, 0.05 + 0.012 * (1 - t), 'lance', 0.45 + rnd.uniform(0, 0.25), 0.18, 3, 2, roll=sg * 0.5)
        tipd = (P[-1] - P[-3]).normalized()
        put_leaf(o, LEAF_PALM, P[-1], tipd + V((0, 0, -0.15)), 0.22, 0.04, 'lance', 0.3, 0.1, 3, 2)
    export(name + ('' if with_pot else '_np'), o)

# ---------------------------------------------------------------- 3) paradisfugl (Strelitzia nicolai): høje stilke med store, flossede paddelblade
def strel(name, with_pot=True):
    reset(); o = []; z0 = 0.5 if with_pot else 0.05
    if with_pot: pot(o)
    n = 16
    for s in range(n):
        az = math.radians(s * 137.5 + rnd.uniform(-12, 12)); c = V((math.cos(az), math.sin(az), 0)); lean = 0.10 + 0.16 * (s / n) + rnd.uniform(0, 0.08)
        H = 0.85 + 0.22 * (s % 5) + rnd.uniform(-0.05, 0.1); r0 = V((c.x * 0.03, c.y * 0.03, z0 - 0.03))
        p3 = r0 + V((c.x * lean, c.y * lean, H)); P = [bez(r0, r0 + V((0, 0, H * 0.4)), p3 - V((c.x * lean * 0.5, c.y * lean * 0.5, H * 0.35)), p3, t / 14) for t in range(15)]
        tube(o, STEM, P, 0.013, 0.007, 6)
        tg = (P[-1] - P[-4]).normalized(); outward = V((c.x, c.y, 0)); Ld = 0.78 + rnd.uniform(-0.08, 0.12)
        d = (outward * 0.62 + V((0, 0, 0.78))).normalized() if s % 3 else (outward * 0.9 + V((0, 0, 0.45))).normalized()
        put_leaf(o, LEAF_STREL, P[-1], d, Ld, 0.35 + rnd.uniform(-0.03, 0.05), 'paddle', 0.55 + rnd.uniform(-0.1, 0.15), 0.12, 12, 5, wave=0.008, roll=rnd.uniform(-0.2, 0.2), curl=rnd.uniform(-0.08, 0.08))
    export(name + ('' if with_pot else '_np'), o)

for with_pot in (True, False):
    fig('plant_fig', with_pot); palm('plant_palm', with_pot); strel('plant_strelitzia', with_pot)
print('[plants] 3 plantetyper bygget (med og uden krukke)')
