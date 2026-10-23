#!/usr/bin/env python3
# ==========================================================================
# de_niseko · bane-design efter brugerens minimap (gen/trace.py → out/layout_trace.json) – python3 tools/niseko/gen/layout.py
#   Koordinater i meter: x øst, z syd (nord = −z), y op. 10 px i minimappet = 1 m.
#   Kollision = rene geometriske prismer (konvekse polygoner): gulve, husrækker langs væggene (parceller med præcis skrå vægge), vand, props.
#   Udgang: shared/niseko_data.js (spil), out/niseko_design.json (Blender), out/niseko_layout.png (oversigt)
# ==========================================================================
import os, sys, json, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import Polygon, Point, LineString, box as sbox, MultiPolygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
from shapely import affinity
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from nk_roof import params as roof_params, roof_y
from geom import convex_pieces, polys_of, convex, ccw

HERE = os.path.dirname(os.path.abspath(__file__)); TOOL = os.path.dirname(HERE); OUT = os.path.join(TOOL, 'out'); ROOT = os.path.abspath(os.path.join(TOOL, '..', '..'))
rnd = random.Random(26)
S, CX, CY = 10.0, 651.0, 575.0                       # px pr. meter, billedets midte = verdens-origo
BASE = -4.0
CANAL_BED, CANAL_WATER = -0.48, -0.08
def M(px, py): return ((px - CX) / S, (py - CY) / S)
def MB(x0, y0, x1, y1): a = M(x0, y0); b = M(x1, y1); return sbox(a[0], a[1], b[0], b[1])
def rnd_range(a, b): return a + (b - a) * rnd.random()

# --------------------------------------------------------------------------- gangene (fra billedet)
T = json.load(open(os.path.join(OUT, 'layout_trace.json')))
WALK = orient(Polygon(T['ext'], T['holes']).buffer(0), 1.0)
assert WALK.is_valid and WALK.geom_type == 'Polygon', WALK.geom_type
X0W, Z0W, X1W, Z1W = WALK.bounds

# --------------------------------------------------------------------------- overflader (malerrækkefølge)
SURF = [('nk_street', WALK),
        ('nk_stonebase', MB(340, 10, 506, 128)), ('nk_stonebase', MB(392, 990, 656, 1135)),          # spawn-pladserne
        ('nk_stonebase', MB(585, 640, 920, 836)),                                                   # Mid
        ('nk_raked', MB(995, 280, 1166, 452)),                                                 # A: zen-haven (raket grus)
        ('nk_floor', MB(130, 290, 346, 441)),                                                   # B: lagerhusets gulv
        ('nk_stonebase', MB(452, 468, 560, 604)),                                                   # West Connector
        ('nk_mosscob', MB(60, 574, 400, 896))]                                                  # Lower Hall (småsten)

# --------------------------------------------------------------------------- vand: kanal (kilde under 'kildemuren' i Central Hall → Mid-dammen) + damme
def chaikin(pts, it=2):
    for _ in range(it):
        out = [pts[0]]
        for a, b in zip(pts[:-1], pts[1:]): out += [(0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]), (0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1])]
        out.append(pts[-1]); pts = out
    return pts
CANAL_LINE = chaikin([M(636, 512), M(636, 566), M(650, 606), M(662, 650), M(668, 700), M(674, 738)], 2)
CANAL = LineString(CANAL_LINE).buffer(1.3, cap_style='flat', join_style='round', quad_segs=8)
MID_POND = Point(*M(680, 757)).buffer(2.9, quad_segs=14)
PONDS = [('Mid Pond', MID_POND), ('SWAT Pond', Point(*M(395, 62)).buffer(2.3, quad_segs=12)), ('Hijackers Pond', Point(*M(470, 1078)).buffer(2.3, quad_segs=12)),
         ('A Pond', Point(*M(1062, 424)).buffer(1.9, quad_segs=12)), ('Connector Pond', Point(*M(506, 537)).buffer(2.5, quad_segs=12))]
BRIDGE = MB(612, 577, 660, 595)                                   # stenbro af fladsten (dæk i gulvhøjde) over kanalen
WATER_SHAPES = [('Canal', CANAL.difference(BRIDGE))] + PONDS
WATER = unary_union([g for _, g in WATER_SHAPES]).intersection(WALK).buffer(0)
for nm, g in WATER_SHAPES: assert WALK.buffer(0.05).contains(g.buffer(-0.01)), nm + ' ligger ikke i gangene'

# --------------------------------------------------------------------------- B-sitets balkon (træ-galleri langs nordvæggen)  + trappe
BAL_Y = 2.6
BAL = (-49.0, -27.85, -37.6, -24.5)             # x0, z0, x1, z1 – dækket (ligger frit; frihøjde 2,3 m)
BAL_STAIR = (-37.6, -27.85, -32.6, -24.5)       # trappen går ned mod øst (+x) langs nordvæggen

# --------------------------------------------------------------------------- props (grønne felter i minimappet) → kasser i meter
def pbox(x0, y0, x1, y1, h, kind, name, style): g = MB(x0, y0, x1, y1); return dict(poly=g, h=h, kind=kind, name=name, style=style)
PROPS = [
    pbox(628, 430, 645, 503, 1.25, 'prop', 'Spring Wall', 'spring'),            # kildemur ved kanalens udspring
    pbox(950, 698, 972, 730, 1.3, 'prop', 'Barrels E', 'barrels'),             # sakefade
    pbox(997, 735, 1007, 790, 1.15, 'prop', 'Fence E', 'fence'),
    pbox(934, 840, 972, 848, 1.15, 'prop', 'Low Wall E', 'lowwall'),
    pbox(1180, 580, 1193, 635, 1.2, 'prop', 'Planter L1', 'planter'),
    pbox(1200, 643, 1208, 675, 1.0, 'prop', 'Planter L2', 'planter'),
    pbox(1038, 306, 1072, 316, 1.1, 'prop', 'Stone Bench A', 'bench'),
    pbox(1120, 340, 1132, 410, 1.2, 'prop', 'Garden Wall A', 'gardenwall'),
    pbox(175, 345, 200, 360, 1.3, 'prop', 'Crates B1', 'crates'),
    pbox(218, 435, 252, 449, 3.0, 'wall', 'Door Post', 'doorpost'),             # deler indgangen fra syd i to døre
    pbox(305, 348, 316, 410, 1.4, 'prop', 'Shelf B', 'shelf'),
    pbox(195, 632, 275, 652, 1.2, 'prop', 'Crates B2', 'crates'),
    pbox(293, 618, 305, 683, 1.15, 'prop', 'Low Wall B', 'lowwall'),
]
TEAHOUSE = dict(walls=[MB(808, 715, 815, 790), MB(808, 715, 885, 722)], counter=MB(838, 762, 880, 768), roof=MB(808, 715, 885, 790), roof_y=3.0, wall_h=2.6)
for p in PROPS:
    p['poly'] = p['poly'].intersection(WALK).buffer(0)
    assert not p['poly'].is_empty, p['name']
TEA_WALLS = [w.intersection(WALK) for w in TEAHOUSE['walls']]

# --------------------------------------------------------------------------- sites, spawns, labels
A_RED = MB(1022, 315, 1120, 385); B_RED = MB(178, 350, 315, 435)
def grow(g, d): x0, z0, x1, z1 = g.bounds; return (round(x0 - d, 2), round(z0 - d, 2), round(x1 + d, 2), round(z1 + d, 2))
SITES = {'A': grow(A_RED, 0.8), 'B': grow(B_RED, 0.8)}
SWAT_Z = MB(340, 10, 506, 128); HIJ_Z = MB(392, 990, 656, 1135)
def spawn_points(zone, n, yaw, avoid, seed):
    inner = zone.intersection(WALK).buffer(-1.5).difference(avoid.buffer(1.0))
    x0, z0, x1, z1 = inner.bounds; pts = []; r = random.Random(seed)
    for _ in range(4000):
        p = Point(r.uniform(x0, x1), r.uniform(z0, z1))
        if inner.contains(p) and all(p.distance(Point(q[0], q[1])) > 2.0 for q in pts): pts.append((round(p.x, 2), round(p.y, 2)))
        if len(pts) >= n: break
    return pts
SPAWN_HIJ = spawn_points(HIJ_Z, 5, 0.0, unary_union([g for _, g in PONDS]), 5)
SPAWN_SWAT = spawn_points(SWAT_Z, 5, math.pi, unary_union([g for _, g in PONDS]), 7)
LABELS = [('SWAT Spawn', 425, 72), ('Upper Hall', 505, 212), ('Temple Road', 570, 165), ('B Top', 395, 262), ('B Site', 255, 388), ('B Main', 357, 479), ('West Connector', 509, 520),
          ('Central Hall', 637, 543), ('Mid', 690, 700), ('A Main', 910, 479), ('A Site', 1070, 353), ('A Hook', 810, 240), ('A Top', 1090, 243), ('East Hall', 964, 790), ('East Long', 1216, 600),
          ('Lower Hall', 262, 872), ('Lower West', 82, 720), ('Hijackers Spawn', 532, 1060), ('Canal Road', 614, 905), ('South Road', 415, 800), ('Hij Alley', 840, 1100)]

# --------------------------------------------------------------------------- konvekse stykker → prismer
prisms = []          # [ [[x,z]…], y0, y1, kind ]
boxes = []           # [x0,z0,x1,z1,y0,y1,kind] (akseparallelle)
def add_prisms(g, y0, y1, kind, nb=False):
    for p in polys_of(g):
        for pc in convex_pieces(p): prisms.append([[[round(x, 3), round(z, 3)] for x, z in pc], round(y0, 3), round(y1, 3), kind])

# gulve: gangene minus vand (vandet får egen bund)
FLOOR = WALK.difference(WATER).buffer(0)
add_prisms(FLOOR, BASE, 0.0, 'floor')
add_prisms(WATER, BASE, CANAL_BED, 'floor')          # kanalbund / dambund (alle –0,48 m; A-dammen ligger i samme plan)

# --------------------------------------------------------------------------- husrækker (parceller) langs alle vægge
#   Hver kant i gangenes omrids får et bånd (vinkelret ud i væggen, afsluttet af hjørnernes vinkelhalveringslinjer = præcis gering). Bånd fra forskellige kanter
#   deler sig efter nærmeste facade (tynde vægge deles på midten). Resultatet er sammenhængende, overlapsfrie konvekse stykker → kollisions-prismer OG tage.
class Lot: pass
rings = []                                           # [(pts, is_exterior)]
rings.append((list(WALK.exterior.coords)[:-1], True))
for h in WALK.interiors: rings.append((list(h.coords)[:-1], False))
LOTS = []; WALK_BUF = WALK.buffer(-0.004)
S_RIDGE = 3.4                                        # kammens afstand fra facaden (m) – konstant, så tage hænger sammen over hjørner/skillevægge
OVER = 0.9                                           # tagudhæng mod gaden
PITCH = 0.5                                          # tagets hældning (tan)
for ri, (pts, ext) in enumerate(rings):
    n = len(pts); nw = []; dirs = []; Ls = []
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]; L = math.hypot(b[0] - a[0], b[1] - a[1]); d = ((b[0] - a[0]) / L, (b[1] - a[1]) / L)
        dirs.append(d); Ls.append(L); nw.append((d[1], -d[0]))                 # vægnormal (ud af gangene, ind i væggen)
    bis = []                                         # vinkelhalveringslinje i hjørne i (mellem kant i−1 og i), pegende ind i væggen
    for i in range(n):
        n0, n1 = nw[i - 1], nw[i]; b = (n0[0] + n1[0], n0[1] + n1[1]); bl = math.hypot(*b)
        if bl < 0.25: b = (dirs[i][0] - dirs[i - 1][0], dirs[i][1] - dirs[i - 1][1]); bl = math.hypot(*b) or 1.0
        bis.append((b[0] / bl, b[1] / bl))
    he_cur = rnd.choice([5.2, 5.6, 6.0]); ring_lots = []
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]; L = Ls[i]; d = dirs[i]; nwi = nw[i]
        nl = max(1, int(round(L / rnd_range(6.5, 9.0))))
        cuts = [0.0] + sorted((k + 1) / nl + rnd_range(-0.12, 0.12) / nl for k in range(nl - 1)) + [1.0]
        dep = rnd_range(6.8, 8.8)
        for k in range(nl):
            t0, t1 = cuts[k], cuts[k + 1]
            p0 = (a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0); p1 = (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)
            def off(bb, at_corner):
                if at_corner:
                    c = bb[0] * nwi[0] + bb[1] * nwi[1]; f = dep / max(c, 0.3); return (bb[0] * f, bb[1] * f)
                return (nwi[0] * dep, nwi[1] * dep)
            o0 = off(bis[i], k == 0); o1 = off(bis[(i + 1) % n], k == nl - 1)
            quad = [p0, p1, (p1[0] + o1[0], p1[1] + o1[1]), (p0[0] + o0[0], p0[1] + o0[1])]
            # kort kant mellem to lange: halveringslinjerne kan mødes før dybden nås → trekant i stedet for en kryds-firkant
            l0, l1 = math.hypot(*o0), math.hypot(*o1); u0 = (o0[0] / l0, o0[1] / l0); u1 = (o1[0] / l1, o1[1] / l1)
            cr = u0[0] * u1[1] - u0[1] * u1[0]
            if abs(cr) > 1e-6:
                t = ((p1[0] - p0[0]) * u1[1] - (p1[1] - p0[1]) * u1[0]) / cr; t2 = ((p1[0] - p0[0]) * u0[1] - (p1[1] - p0[1]) * u0[0]) / cr
                if 1e-6 < t < l0 and 1e-6 < t2 < l1: quad = [p0, p1, (p0[0] + u0[0] * t, p0[1] + u0[1] * t)]
            lot = Lot(); lot.ring = ri; lot.edge = i; lot.k = k; lot.nl = nl; lot.quad = quad; lot.front = (p0, p1); lot.nout = (-nwi[0], -nwi[1]); lot.nw = nwi; lot.dir = d
            lot.first = (k == 0); lot.last = (k == nl - 1); lot.L = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
            if k == 0 and ring_lots: he = ring_lots[-1].he
            elif k == 0: he = he_cur
            else: he = min(6.4, max(3.6, ring_lots[-1].he + rnd.choice([0, 0, 0, 0.8, -0.8, 1.4, -1.4])))
            lot.he = he; ring_lots.append(lot)
    if len(ring_lots) > 1: ring_lots[-1].he = ring_lots[0].he
    LOTS += ring_lots
# områder: båndet minus gangene (kun den del der hænger sammen med facaden)
def front_seg(l): return LineString([l.front[0], l.front[1]])
for l in LOTS:
    g = Polygon(l.quad).buffer(0).difference(WALK_BUF)
    keep = [p for p in polys_of(g) if p.distance(front_seg(l)) < 0.02 and p.area > 1e-3]
    l.region = unary_union(keep) if keep else Polygon()
# overlap → deles langs vinkelhalveringslinjen mellem de to facader (afstand til facadelinjen), som en lige 'tagryg-skelet'-deling
from shapely.strtree import STRtree
def halfplane(g, c, side):
    """del af planen hvor g·p − c ≤ 0 (side=-1) eller > 0 (side=+1) som stor polygon"""
    gl = math.hypot(*g); gx, gz = g[0] / gl, g[1] / gl; t = (-gz, gx); p0 = (gx * c / gl, gz * c / gl); B = 4000.0
    q = [(p0[0] + t[0] * B, p0[1] + t[1] * B), (p0[0] - t[0] * B, p0[1] - t[1] * B), (p0[0] - t[0] * B + side * gx * B, p0[1] - t[1] * B + side * gz * B), (p0[0] + t[0] * B + side * gx * B, p0[1] + t[1] * B + side * gz * B)]
    return Polygon(q)
for _round in range(8):
    tree = STRtree([l.region if not l.region.is_empty else Point(1e6, 1e6).buffer(0.01) for l in LOTS]); changed = False
    for i, l in enumerate(LOTS):
        if l.region.is_empty: continue
        for j in tree.query(l.region):
            if j <= i: continue
            m = LOTS[j]
            if m.region.is_empty: continue
            o = l.region.intersection(m.region)
            if o.area < 0.01: continue
            # f(p) = dybde_i(p) − dybde_j(p), dybde = nw·(p − front[0])
            gx, gz = l.nw[0] - m.nw[0], l.nw[1] - m.nw[1]; c = (l.nw[0] * l.front[0][0] + l.nw[1] * l.front[0][1]) - (m.nw[0] * m.front[0][0] + m.nw[1] * m.front[0][1])
            if math.hypot(gx, gz) < 1e-6:                    # parallel med samme retning: nærmeste facade-segment afgør
                di, dj = front_seg(l).distance(o.centroid), front_seg(m).distance(o.centroid); l_wins = di <= dj
                if l_wins: m.region = m.region.difference(o).buffer(0)
                else: l.region = l.region.difference(o).buffer(0)
            else:
                Hi = halfplane((gx, gz), c, -1)                # f ≤ 0: tættere på l's facade → l
                l.region = l.region.difference(o.difference(Hi)).buffer(0); m.region = m.region.difference(o.intersection(Hi)).buffer(0)
            changed = True
    if not changed: break
for l in LOTS:                                       # opsplit i konvekse stykker; behold dem der rører facaden som 'hoved'
    ps = []
    for g in polys_of(l.region):
        if g.area < 0.02: continue
        for pc in convex_pieces(g): ps.append(pc)
    l.pieces = ps
    l.smax = 0.0
    for pc in ps:
        for q in pc: l.smax = max(l.smax, (q[0] - l.front[0][0]) * l.nw[0] + (q[1] - l.front[0][1]) * l.nw[1])
    l.area = l.region.area
# stil pr. parcel: dybde og højde → bygningstype
for l in LOTS:
    if l.smax < 2.4: l.style = 'wall'; l.he = 3.4; l.floors = 1
    elif l.smax < 4.3: l.style = 'house1'; l.he = min(l.he, 3.8); l.floors = 1
    else:
        l.floors = 2 if l.he >= 4.8 else 1
        l.style = rnd.choice(['machiya', 'machiya', 'machiya', 'shop', 'inn']) if l.floors == 2 else rnd.choice(['house1', 'shop'])
B_ZONE = MB(120, 280, 350, 460).buffer(0); A_ZONE = MB(985, 270, 1175, 470).buffer(0)
for l in LOTS:
    mid = Point((l.front[0][0] + l.front[1][0]) / 2, (l.front[0][1] + l.front[1][1]) / 2)
    if l.smax >= 2.4 and B_ZONE.contains(mid.buffer(0.5)) and l.L > 2.0: l.style = 'kura'; l.he = 6.4; l.floors = 2
    if l.smax >= 2.4 and l.ring == 3 and l.L > 1.5: l.style = 'shrine'; l.he = 5.0; l.floors = 1
GARDEN_RINGS = {5, 6, 10, 12, 15}                                 # øer der er haver (klippede hække med træer bagved) i stedet for huse
for l in LOTS:
    if l.ring in GARDEN_RINGS: l.style = 'hedge'; l.he = 3.0; l.floors = 1
for l in LOTS:
    l.rp = roof_params(l.style, l.smax); l.top = l.he + l.rp['pitch'] * (min(l.smax, l.rp['sr']) + l.rp['over'])
# kollision: konvekse stykker af hver parcel (allerede overlapsfri). Huse får trinvis kollision der følger tagfladen (højst 0,5 m under taget): ingen usynlige volumener over lavere tage.
def slab_cuts(l):
    if l.style == 'hedge': return None
    sr = l.rp['sr']; step = 0.6 if l.style == 'wall' else 1.0
    cuts = [0.0]; c = 0.0
    while c + step < sr - 0.2: c += step; cuts.append(c)
    cuts.append(sr); c = sr
    while c < l.smax + step: c += step; cuts.append(c)
    return cuts
for l in LOTS:
    cuts = slab_cuts(l)
    for pc in l.pieces:
        if cuts is None:
            prisms.append([[[round(x, 3), round(z, 3)] for x, z in pc], BASE, round(l.top, 3), 'wall']); continue
        poly = Polygon(pc)
        for a, b in zip(cuts[:-1], cuts[1:]):
            strip = poly.intersection(halfplane((l.nw[0], l.nw[1]), l.nw[0] * l.front[0][0] + l.nw[1] * l.front[0][1] + a, 1)).intersection(halfplane((l.nw[0], l.nw[1]), l.nw[0] * l.front[0][0] + l.nw[1] * l.front[0][1] + b, -1))
            if strip.is_empty or strip.area < 1e-3: continue
            top = min(roof_y(l.he, l.rp, a), roof_y(l.he, l.rp, b))                       # kollisionen ligger højst i tagfladen (aldrig et usynligt lag over taget)
            for g in polys_of(strip):
                for sp in convex_pieces(g): prisms.append([[[round(x, 3), round(z, 3)] for x, z in sp], BASE, round(top, 3), 'wall'])

# --------------------------------------------------------------------------- sømme mellem parceller med forskellig tagprofil → lodrette gavlvægge
def lot_s(l, p): return l.nw[0] * (p[0] - l.front[0][0]) + l.nw[1] * (p[1] - l.front[0][1])
def lot_y(l, p): return roof_y(l.he, l.rp, lot_s(l, p))
SEAMS = []
_act = [l for l in LOTS if l.pieces]
_tree = STRtree([l.region for l in _act])
for i, l in enumerate(_act):
    for j in _tree.query(l.region):
        if j <= i: continue
        m = _act[j]; sh = l.region.boundary.intersection(m.region.boundary)
        segs = []
        for g in ([sh] if sh.geom_type == 'LineString' else list(getattr(sh, 'geoms', []))):
            if g.geom_type != 'LineString': continue
            cs = list(g.coords); segs += list(zip(cs[:-1], cs[1:]))
        for a, b in segs:
            if math.hypot(b[0] - a[0], b[1] - a[1]) < 0.06: continue
            ts = [0.0, 1.0]
            for lo in (l, m):
                ds = lot_s(lo, b) - lot_s(lo, a)
                if abs(ds) > 1e-6:
                    t = (lo.rp['sr'] - lot_s(lo, a)) / ds
                    if 1e-4 < t < 1 - 1e-4: ts.append(t)
            ts = sorted(set(round(t, 6) for t in ts))
            for t0, t1 in zip(ts[:-1], ts[1:]):
                A = (a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0); Bp = (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)
                yl = [(lot_y(l, A), lot_y(m, A)), (lot_y(l, Bp), lot_y(m, Bp))]
                if max(abs(p[0] - p[1]) for p in yl) < 0.04: continue
                lowl = (yl[0][0] + yl[1][0]) < (yl[0][1] + yl[1][1])            # l har lavest tag
                low = l if lowl else m; high = m if lowl else l; dx, dz = Bp[0] - A[0], Bp[1] - A[1]; nL = math.hypot(dx, dz); n1 = (-dz / nL, dx / nL)
                mp = ((A[0] + Bp[0]) / 2, (A[1] + Bp[1]) / 2); pl = Point(mp[0] + n1[0] * 0.12, mp[1] + n1[1] * 0.12); pm = Point(mp[0] - n1[0] * 0.12, mp[1] - n1[1] * 0.12)
                dl_p, dl_m = low.region.distance(pl), low.region.distance(pm)
                if dl_m < dl_p - 1e-6: n1 = (-n1[0], -n1[1])              # normalen peger ind i parcellen med det laveste tag (set fra den side ses væggen)
                lo_a, hi_a = sorted(yl[0]); lo_b, hi_b = sorted(yl[1])
                SEAMS.append(dict(pts=[[round(A[0], 3), round(hi_a, 3), round(A[1], 3)], [round(Bp[0], 3), round(hi_b, 3), round(Bp[1], 3)], [round(Bp[0], 3), round(lo_b, 3), round(Bp[1], 3)], [round(A[0], 3), round(lo_a, 3), round(A[1], 3)]],
                                  n=[round(n1[0], 4), round(n1[1], 4)], style=(m.style if lowl else l.style)))

# --------------------------------------------------------------------------- træer og planter (bestemte punkter – intet står tilfældigt)
DRESS = []
SPEC = {'sakura': dict(h=6.4, R=2.7), 'willow': dict(h=7.4, R=3.0), 'maple': dict(h=4.8, R=1.9), 'pine': dict(h=5.2, R=1.9)}
GARDEN = [l for l in LOTS if l.style == 'hedge' and l.pieces]
gard_union = unary_union([l.region for l in GARDEN]) if GARDEN else Polygon()
nongard = unary_union([l.region for l in LOTS if l.style != 'hedge' and l.pieces])
TREE_PLAN = {15: ['willow', 'pine', 'sakura', 'maple', 'sakura', 'pine', 'maple', 'sakura'], 6: ['sakura', 'maple', 'pine'], 5: ['maple'], 10: ['sakura', 'pine'], 12: ['pine']}
def pick_trees(ring, species):
    reg = unary_union([l.region for l in GARDEN if l.ring == ring]); out = []
    for sp in species:
        R = SPEC[sp]['R']; best = None
        x0, z0, x1, z1 = reg.bounds
        for gx in np.arange(x0, x1, 0.5):
            for gz in np.arange(z0, z1, 0.5):
                p = Point(gx, gz)
                if not reg.contains(p): continue
                dw = WALK.distance(p)
                if dw < 2.2: continue
                dn = nongard.distance(p) if not nongard.is_empty else 99
                rr = min(R, dn - 0.8)
                if rr < 1.1: continue
                dd = min([math.hypot(gx - t['x'], gz - t['z']) - 0.7 * (t['R'] + rr) for t in out] + [99.0])
                if dd < 0: continue
                score = min(dd, 6.0) + min(dn - rr, 3.0) * 0.5 + rnd.random() * 0.4
                if best is None or score > best[0]: best = (score, gx, gz, rr)
        if best: out.append(dict(t='tree', sp=sp, x=round(best[1], 2), z=round(best[2], 2), h=SPEC[sp]['h'] * (0.8 + 0.4 * min(1.0, best[3] / R)), R=round(best[3], 2), seed=len(DRESS) + len(out) * 31 + 7))
    return out
for ring, spl in TREE_PLAN.items(): DRESS += pick_trees(ring, spl)
TRUNKS = []
PLAZA_TREES = [('willow', 7.6, 15.4), ('sakura', -19.2, -51.7), ('sakura', -12.0, 47.8)]       # træer på pladser (med stammekollision)
for sp, x, z in PLAZA_TREES:
    cl = WALK.boundary.distance(Point(x, z)); R = min(SPEC[sp]['R'], cl - 1.6)
    assert WALK.contains(Point(x, z)) and R > 1.4, (sp, x, z, cl)
    DRESS.append(dict(t='tree', sp=sp, x=x, z=z, h=SPEC[sp]['h'], R=round(R, 2), seed=100 + len(DRESS), trunk=True))
    prisms.append([[[round(x + math.cos(2 * math.pi * k / 8) * 0.33, 3), round(z + math.sin(2 * math.pi * k / 8) * 0.33, 3)] for k in range(8)], BASE if False else 0.0, 4.0, 'wall']); TRUNKS.append(Point(x, z).buffer(0.33))

# --------------------------------------------------------------------------- udsmykning på bestemte punkter: lanterner, torii, bænke, plantekasser, sten, tebord
ALL_PTS = [Point(p[0], p[1]) for p in SPAWN_HIJ + SPAWN_SWAT]
SITE_BOXES = [sbox(a, b, c, d) for (a, b, c, d) in SITES.values()]
POND_G = unary_union([g for _, g in PONDS]); OBST_G = list(TRUNKS)                       # indtil videre placerede forhindringer (cirkler/kasser) til afstandstjek
def free_spot(x, z, r, wall=0.5, ponds=0.5, spawn=2.2, sites=False):
    p = Point(x, z)
    if not WALK.buffer(-wall).contains(p.buffer(r)): return False
    if POND_G.distance(p) < r + ponds: return False
    if WATER.distance(p) < r + 0.3: return False
    if any(p.distance(q) < spawn for q in ALL_PTS): return False
    if not sites and any(b.distance(p) < r + 0.2 for b in SITE_BOXES): return False
    if any(g.distance(p) < r + 0.25 for g in OBST_G): return False
    for pr in PROPS:
        if pr['poly'].distance(p) < r + 0.3: return False
    return True
def free_geom(g, wall=0.1, ponds=0.4, spawn=2.0, sites=False):
    if not WALK.buffer(-wall).contains(g): return False
    if POND_G.distance(g) < ponds or WATER.distance(g) < 0.25: return False
    if any(g.distance(q) < spawn for q in ALL_PTS): return False
    if not sites and any(b.distance(g) < 0.15 for b in SITE_BOXES): return False
    if any(o.distance(g) < 0.8 for o in OBST_G): return False
    if any(pr['poly'].distance(g) < 0.8 for pr in PROPS): return False
    return True
def obox_poly(x, z, L, Wd, yaw):
    c, sn = math.cos(yaw), math.sin(yaw); return Polygon([(x + a * c - b * sn, z + a * sn + b * c) for (a, b) in ((-L / 2, -Wd / 2), (L / 2, -Wd / 2), (L / 2, Wd / 2), (-L / 2, Wd / 2))])
def add_circle(x, z, r, h, kind='prop', n=8, y0=0.0):
    prisms.append([[[round(x + math.cos(2 * math.pi * k / n + math.pi / n) * r, 3), round(z + math.sin(2 * math.pi * k / n + math.pi / n) * r, 3)] for k in range(n)], y0, h, kind]); OBST_G.append(Point(x, z).buffer(r))
def add_obox(x, z, L, Wd, yaw, h, kind='prop', y0=0.0):
    c, sn = math.cos(yaw), math.sin(yaw); pts = []
    for (a, b) in ((-L / 2, -Wd / 2), (L / 2, -Wd / 2), (L / 2, Wd / 2), (-L / 2, Wd / 2)): pts.append([round(x + a * c - b * sn, 3), round(z + a * sn + b * c, 3)])
    prisms.append([pts, y0, h, kind]); OBST_G.append(Polygon(pts))
def wall_point(x, z):
    """nærmeste punkt på gangenes omrids + indadgående normal"""
    b = WALK.boundary; q = b.interpolate(b.project(Point(x, z))); n = (x - q.x, z - q.y); l = math.hypot(*n) or 1.0
    return (q.x, q.y), (n[0] / l, n[1] / l)
def pond_lanterns(pname, count=2, dist=0.95):
    g = dict(PONDS)[pname]; c = g.centroid; R = math.sqrt(g.area / math.pi); best = []
    for a in range(0, 360, 10):
        x = c.x + math.cos(math.radians(a)) * (R + dist); z = c.y + math.sin(math.radians(a)) * (R + dist)
        if free_spot(x, z, 0.33, wall=1.0): best.append((a, x, z))
    out = []
    for a, x, z in best:
        if all(abs((a - b[0] + 180) % 360 - 180) > 95 for b in out): out.append((a, x, z))
        if len(out) >= count: break
    return out
for pname in ('SWAT Pond', 'Hijackers Pond', 'Mid Pond', 'A Pond', 'Connector Pond'):
    for a, x, z in pond_lanterns(pname):
        DRESS.append(dict(t='stonelantern', x=round(x, 2), z=round(z, 2), yaw=a, h=1.8)); add_circle(x, z, 0.32, 1.8, 'prop')
def torii(cx, cz, ang_deg, width, name):
    """to søjler på tværs af en gang (retningen ang_deg langs portens bredde); søjlerne ligger 0,45 m inden for væggen"""
    a = math.radians(ang_deg); d = (math.cos(a), math.sin(a)); ln = LineString([(cx - d[0] * 12, cz - d[1] * 12), (cx + d[0] * 12, cz + d[1] * 12)]).intersection(WALK)
    seg = max(polys_of(ln.buffer(0.001)), key=lambda g: g.area) if ln.geom_type != 'LineString' else None
    if ln.geom_type != 'LineString': ln = max([g for g in ln.geoms if g.geom_type == 'LineString'], key=lambda g: g.distance(Point(cx, cz)) * -1 + g.length * 0 )
    (x0, z0), (x1, z1) = ln.coords[0], ln.coords[-1]; L = math.hypot(x1 - x0, z1 - z0); u = ((x1 - x0) / L, (z1 - z0) / L)
    if L < 3.5: return
    xa, za = x0 + u[0] * 0.5, z0 + u[1] * 0.5; xb, zb = x1 - u[0] * 0.5, z1 - u[1] * 0.5
    DRESS.append(dict(t='torii', name=name, xa=round(xa, 2), za=round(za, 2), xb=round(xb, 2), zb=round(zb, 2), h=3.7)); add_circle(xa, za, 0.3, 3.7, 'wall', 10); add_circle(xb, zb, 0.3, 3.7, 'wall', 10)
torii(-11.5, -45.5, 135, 5.0, 'Temple Road')
torii(42.4, -29.6, 0, 4.0, 'Temple North')

# bænke langs vægge (tæt på væggen, kun hvor gangen er bred nok)
def bench(x, z, L=1.55):
    q, n = wall_point(x, z); off = 0.3; bx, bz = q[0] + n[0] * off, q[1] + n[1] * off; yaw = math.atan2(n[1], n[0]) + math.pi / 2
    thick = LineString([(bx + n[0] * 0.3, bz + n[1] * 0.3), (bx + n[0] * 30, bz + n[1] * 30)]).intersection(WALK)
    if thick.is_empty: return False
    ln = thick if thick.geom_type == 'LineString' else min(thick.geoms, key=lambda g: g.distance(Point(bx, bz)))
    if ln.length < 3.4 or not free_geom(obox_poly(bx, bz, L, 0.46, yaw), wall=0.02): return False
    DRESS.append(dict(t='bench', x=round(bx, 2), z=round(bz, 2), yaw=yaw, L=L, W=0.46, h=0.46)); add_obox(bx, bz, L, 0.46, yaw, 0.46, 'prop'); return True
for (bx, bz) in ((-1.0, 25.4), (9.5, 25.4), (15.0, 25.4), (-20.5, -46.5), (-17.0, -45.0), (-23.0, 44.0), (-8.0, 54.0), (30.5, 5.6), (35.5, 5.6), (24.5, -34.5), (-14.0, -4.0)):
    bench(bx, bz)
# plantekasser med azalea ved hjørner (lavt, kollision)
def planter(x, z, L=1.8, mat='fol_azalea'):
    q, n = wall_point(x, z); off = 0.34; px, pz = q[0] + n[0] * off, q[1] + n[1] * off; yaw = math.atan2(n[1], n[0]) + math.pi / 2
    thick = LineString([(px + n[0] * 0.3, pz + n[1] * 0.3), (px + n[0] * 30, pz + n[1] * 30)]).intersection(WALK)
    if thick.is_empty: return False
    ln = thick if thick.geom_type == 'LineString' else min(thick.geoms, key=lambda g: g.distance(Point(px, pz)))
    if ln.length < 3.6 or not free_geom(obox_poly(px, pz, L, 0.56, yaw), wall=0.02): return False
    DRESS.append(dict(t='planter', x=round(px, 2), z=round(pz, 2), yaw=yaw, L=L, W=0.56, h=0.55, mat=mat)); add_obox(px, pz, L, 0.56, yaw, 0.55, 'prop'); return True
for (px, pz, m) in ((-16.0, -41.0, 'fol_azalea'), (-6.0, -39.0, 'fol_azalea_w'), (-14.8, 12.0, 'fol_azalea'), (3.5, 5.0, 'fol_azalea_w'), (-33.0, -5.5, 'fol_azalea'), (-29.0, 36.0, 'fol_azalea_w'), (23.0, 30.0, 'fol_azalea'),
                    (45.5, 38.0, 'fol_azalea_w'), (-57.0, 10.0, 'fol_azalea'), (-45.0, 31.0, 'fol_azalea_w'), (36.5, 36.5, 'fol_azalea'), (32.0, -35.5, 'fol_azalea_w')):
    planter(px, pz, mat=m)
# automatisk placering langs facaderne: plantekasser (azalea) og bænke på ca. hver 9.–14. m, kun hvor gangen er bred nok og intet er i vejen
_ar = random.Random(91); _cnt = [0, 0]
for l in sorted([l for l in LOTS if l.style in ('machiya', 'shop', 'inn', 'house1') and l.L > 3.2 and l.pieces], key=lambda l: (l.ring, l.edge, l.k)):
    if _ar.random() > 0.42: continue
    a, b = l.front; t = _ar.uniform(0.3, 0.7); mx, mz = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
    if _ar.random() < 0.7:
        if planter(mx + l.nout[0] * 0.4, mz + l.nout[1] * 0.4, L=1.8, mat=_ar.choice(['fol_azalea', 'fol_azalea_w', 'fol_azalea'])): _cnt[0] += 1
    else:
        if bench(mx + l.nout[0] * 0.4, mz + l.nout[1] * 0.4): _cnt[1] += 1
print('[layout] auto: %d plantekasser, %d bænke' % tuple(_cnt))

# lanternesnore på tværs af gader (visuelt, mindst 3,3 m over gulvet)
STRINGS = []
def lantern_string(cx, cz, ang_deg):
    a = math.radians(ang_deg); d = (math.cos(a), math.sin(a)); ln = LineString([(cx - d[0] * 12, cz - d[1] * 12), (cx + d[0] * 12, cz + d[1] * 12)]).intersection(WALK)
    segs = [ln] if ln.geom_type == 'LineString' else [g for g in getattr(ln, 'geoms', []) if g.geom_type == 'LineString']
    if not segs: return False
    seg = min(segs, key=lambda g: g.distance(Point(cx, cz)))
    L = seg.length
    if not (3.4 <= L <= 7.5): return False
    (x0, z0), (x1, z1) = seg.coords[0], seg.coords[-1]; u = ((x1 - x0) / L, (z1 - z0) / L)
    # begge ender skal støde mod en bygningsfacade (ikke hæk/mur) med mindst 4,6 m kam
    def lot_at(x, z):
        p = Point(x, z); best = None
        for l in LOTS:
            if not l.pieces: continue
            dd = LineString(l.front).distance(p)
            if dd < 0.6 and (best is None or dd < best[0]): best = (dd, l)
        return best[1] if best else None
    la, lb = lot_at(x0, z0), lot_at(x1, z1)
    if not la or not lb or la.style in ('hedge', 'wall') or lb.style in ('hedge', 'wall') or la.he < 4.6 or lb.he < 4.6: return False
    STRINGS.append(dict(a=[round(x0 + u[0] * 0.05, 2), round(z0 + u[1] * 0.05, 2)], b=[round(x1 - u[0] * 0.05, 2), round(z1 - u[1] * 0.05, 2)], y=min(la.he, lb.he) - 0.7, na=la.nout, nb=lb.nout)); return True
for (sx_, sz_) in ((-14.0, -36.0), (-8.0, -29.0), (3.0, -33.0), (24.0, -34.0), (31.0, -10.0), (36.0, 3.0), (56.0, 0.0), (56.0, 20.0), (50.0, 38.0), (34.0, 38.0), (-4.0, 28.0), (-22.0, 36.0),
                   (-20.0, 24.0), (-57.0, 18.0), (-40.0, 31.0), (-30.0, -6.0), (-48.0, -3.0), (22.0, 50.0), (6.0, 53.0), (-22.0, -17.0)):
    for ang in (0, 45, 90, 135):
        if lantern_string(sx_, sz_, ang): break
print('[layout] lanternesnore:', len(STRINGS))

# havesten ved damme (A: ved dammen; Mid: ved vandet) – kollisionssten
ROCKS = [('A Pond', [(-2.3, 1.7, 0.9, 'namaqualand_boulder_05'), (2.5, 1.5, 0.7, 'rock_moss_set_02')]), ('Mid Pond', [(0.2, 3.9, 0.8, 'rock_moss_set_01')]), ('SWAT Pond', [(-2.9, -1.2, 0.8, 'boulder_01')]),
         ('Hijackers Pond', [(2.9, 1.0, 0.8, 'namaqualand_boulder_05')]), ('Connector Pond', [(2.9, 0.5, 0.7, 'rock_moss_set_02')])]
for pname, lst in ROCKS:
    g = dict(PONDS)[pname]; c = g.centroid
    for (ox, oz, r, mname) in lst:
        x, z = c.x + ox, c.y + oz
        if free_geom(Point(x, z).buffer(r * 0.62), wall=0.1, ponds=-1.0): DRESS.append(dict(t='rock', m=mname, x=round(x, 2), z=round(z, 2), yaw=(len(DRESS) * 53) % 360, s=r)); add_circle(x, z, r * 0.62, 0.7 * (r / 0.8) + 0.2, 'prop', 7)
# tebord og skamler i tehuset (L-formen: vægge mod vest og nord, åbent mod øst/syd)
TEA = [(18.0, 16.6, 0.85, 'table'), (21.4, 16.6, 0.85, 'table'), (17.7, 20.6, 0.45, 'stool'), (20.0, 20.6, 0.45, 'stool')]
for (x, z, w, kind) in TEA:
    if kind == 'table': DRESS.append(dict(t='teatable', x=x, z=z, yaw=0.0)); add_obox(x, z, w, w, 0.0, 0.5, 'prop')
    else: DRESS.append(dict(t='stool', x=x, z=z, yaw=0.0)); add_circle(x, z, 0.2, 0.45, 'prop', 8)
# stolpe under teltets SØ-hjørne
add_obox(TEAHOUSE['roof'].intersection(WALK).bounds[2] - 0.2, TEAHOUSE['roof'].intersection(WALK).bounds[3] - 0.2, 0.3, 0.3, 0.0, TEAHOUSE['roof_y'], 'wall')
DRESS.append(dict(t='teapost', x=round(TEAHOUSE['roof'].intersection(WALK).bounds[2] - 0.2, 2), z=round(TEAHOUSE['roof'].intersection(WALK).bounds[3] - 0.2, 2), h=TEAHOUSE['roof_y']))

# --------------------------------------------------------------------------- props: kollision
for p in PROPS:
    for g in polys_of(p['poly']):
        x0, z0, x1, z1 = g.bounds
        if g.area > 0.9 * (x1 - x0) * (z1 - z0): boxes.append([round(x0, 3), round(z0, 3), round(x1, 3), round(z1, 3), 0.0, p['h'], p['kind']])
        else: add_prisms(g, 0.0, p['h'], p['kind'])
for w in TEA_WALLS:
    for g in polys_of(w):
        x0, z0, x1, z1 = g.bounds; boxes.append([round(x0, 3), round(z0, 3), round(x1, 3), round(z1, 3), 0.0, TEAHOUSE['wall_h'], 'wall'])
x0, z0, x1, z1 = TEAHOUSE['counter'].intersection(WALK).bounds; boxes.append([round(x0, 3), round(z0, 3), round(x1, 3), round(z1, 3), 0.0, 1.0, 'prop'])
tx0, tz0, tx1, tz1 = TEAHOUSE['roof'].intersection(WALK).bounds
boxes.append([round(tx0, 3), round(tz0, 3), round(tx1, 3), round(tz1, 3), TEAHOUSE['roof_y'], TEAHOUSE['roof_y'] + 0.3, 'ceil'])

# --------------------------------------------------------------------------- balkon (B), trappe og værn
bx0, bz0, bx1, bz1 = BAL
boxes.append([bx0, bz0, bx1, bz1, round(BAL_Y - 0.3, 3), BAL_Y, 'floor'])
STAIRS = []                                          # [x0,z0,x1,z1,'x',ya,yb,n] – ned mod +x (ya ved x0)
sx0, sz0, sx1, sz1 = BAL_STAIR; STAIRS.append([sx0, sz0, sx1, sz1, 'x', BAL_Y, 0.0, 15]); boxes.append([sx0, sz0, sx1, sz1, BASE, -0.3, 'floor'])
for px in (bx0 + 0.15, (bx0 + bx1) / 2, bx1 - 0.15):
    boxes.append([round(px - 0.15, 3), round(bz1 - 0.35, 3), round(px + 0.15, 3), round(bz1 - 0.05, 3), 0.0, round(BAL_Y - 0.3, 3), 'wall'])   # stolper under dækket
RAILS = [[bx0, bz1 - 0.05, bx1, bz1, BAL_Y, 1.0], [sx0, sz1 - 0.05, sx1, sz1, BAL_Y - 0.05, 1.0]]

# --------------------------------------------------------------------------- vandrektangler til spillet (0,25 m raster)
R = 0.25
def raster_rects(g, key_fn):
    x0, z0, x1, z1 = g.bounds; nx = int(math.ceil((x1 - x0) / R)); nz = int(math.ceil((z1 - z0) / R)); out = []
    inside = np.zeros((nz, nx), bool)
    from shapely import prepared
    pg = prepared.prep(g)
    for j in range(nz):
        for i in range(nx):
            inside[j, i] = pg.contains(Point(x0 + (i + 0.5) * R, z0 + (j + 0.5) * R))
    used = np.zeros_like(inside)
    for j in range(nz):
        i = 0
        while i < nx:
            if not inside[j, i] or used[j, i]: i += 1; continue
            i1 = i
            while i1 + 1 < nx and inside[j, i1 + 1] and not used[j, i1 + 1]: i1 += 1
            j1 = j
            while j1 + 1 < nz and inside[j1 + 1, i:i1 + 1].all() and not used[j1 + 1, i:i1 + 1].any(): j1 += 1
            used[j:j1 + 1, i:i1 + 1] = True; out.append([round(x0 + i * R, 2), round(z0 + j * R, 2), round(x0 + (i1 + 1) * R, 2), round(z0 + (j1 + 1) * R, 2), CANAL_WATER]); i = i1 + 1
    return out
water_rects = raster_rects(WATER, None)

# --------------------------------------------------------------------------- spil-data (shared/niseko_data.js)
def fl(x, z): return 0.0
labels = [[n, round(M(x, y)[0], 2), round(M(x, y)[1], 2), 0.0] for (n, x, y) in LABELS]
labels += [['A', round((SITES['A'][0] + SITES['A'][2]) / 2, 2), round((SITES['A'][1] + SITES['A'][3]) / 2, 2), 0.0], ['B', round((SITES['B'][0] + SITES['B'][2]) / 2, 2), round((SITES['B'][1] + SITES['B'][3]) / 2, 2), 0.0],
           ['B Gallery', round((bx0 + bx1) / 2, 2), round((bz0 + bz1) / 2, 2), BAL_Y]]
GX0, GZ0 = int(math.floor(X0W - 6)), int(math.floor(Z0W - 6)); GW = int(math.ceil((X1W + 6 - GX0) / 2)) + 1; GH = int(math.ceil((Z1W + 6 - GZ0) / 2)) + 1
D = {'version': '2', 'grid': {'GX0': GX0, 'GZ0': GZ0, 'GW': GW, 'GH': GH}, 'boxes': boxes, 'prisms': prisms, 'ramps': [], 'stairs': STAIRS, 'rails': [[r[0], r[1], r[2], r[3], r[4], r[5]] for r in RAILS],
     'cyls': [], 'doors': [], 'ladders': [], 'labels': labels,
     'sites': {k: [v[0], v[1], v[2], v[3], 0.0] for k, v in SITES.items()},
     'spawns': {'hij': [[p[0], p[1], 0.0, 0.0] for p in SPAWN_HIJ], 'swat': [[p[0], p[1], math.pi, 0.0] for p in SPAWN_SWAT]},
     'levels': {'G': 0.0}, 'water': water_rects, 'surf': {'A Site': 'dirt', 'B Site': 'wood', 'B Gallery': 'wood', 'B Top': 'stone'}, 'panes': []}
txt = ('/* AUTOGENERERET af tools/niseko/gen/layout.py – redigér ikke i hånden.\n   niseko: japansk landsby om natten, layout efter brugerens minimap. Kollision = kasser + skrå prismer. */\n'
       '(function (root) {\n  const D = ' + json.dumps(D, ensure_ascii=False, separators=(',', ':')) + ';\n'
       "  if (typeof module === 'object' && module.exports) module.exports = D; else root.WD_NISEKO = D;\n})(typeof self !== 'undefined' ? self : this);\n")
open(os.path.join(ROOT, 'shared', 'niseko_data.js'), 'w').write(txt)
print('[layout] prismer %d · bokse %d · parceller %d · vandrektangler %d · %.0f KB' % (len(prisms), len(boxes), len(LOTS), len(water_rects), len(txt) / 1e3))

# --------------------------------------------------------------------------- terræn til Blender: konvekse stykker (≤ 1,5 m felter) pr. overflade, kanalbund, brystninger, vand
CELL = 1.5
def pieces_grid(g, out, mat, y):
    if g.is_empty: return
    x0, z0, x1, z1 = g.bounds
    for ci in range(int(math.floor(x0 / CELL)), int(math.ceil(x1 / CELL))):
        for cj in range(int(math.floor(z0 / CELL)), int(math.ceil(z1 / CELL))):
            c = sbox(ci * CELL, cj * CELL, (ci + 1) * CELL, (cj + 1) * CELL)
            if not g.intersects(c): continue
            for p in polys_of(g.intersection(c)):
                if p.area < 0.01: continue
                for pc in convex_pieces(p): out.append(dict(m=mat, y=y, ring=[[round(a, 3), round(b, 3)] for a, b in pc]))
GROUND = []; later = None
surf_regions = []
for k in range(len(SURF) - 1, -1, -1):
    m, g = SURF[k]; g = g.intersection(WALK)
    r = g if later is None else g.difference(later)
    surf_regions.append((m, r)); later = g if later is None else unary_union([later, g])
surf_regions.reverse()
for m, r in surf_regions: pieces_grid(r.difference(WATER).buffer(0), GROUND, m, 0.0)
BED = []; pieces_grid(WATER, BED, 'nk_riverbed', CANAL_BED)
# kanter langs vandet (brystninger) – ring-liniestykker
EDGES = []
for p in polys_of(WATER):
    for ring in [p.exterior] + list(p.interiors):
        c = list(ring.coords)
        for a, b in zip(c[:-1], c[1:]):
            if math.hypot(b[0] - a[0], b[1] - a[1]) > 0.02: EDGES.append([round(a[0], 3), round(a[1], 3), round(b[0], 3), round(b[1], 3)])
WATER_PIECES = [[[round(a, 3), round(b, 3)] for a, b in pc] for p in polys_of(WATER) for pc in convex_pieces(p)]
# overgange mellem overfladetyper (stenlister)
TH = []
for (m1, r1), (m2, r2) in zip(surf_regions[:-1], surf_regions[1:]): pass
bounds_all = [r.boundary for m, r in surf_regions[1:]]
for m, r in surf_regions[1:]:
    b = r.boundary.intersection(WALK.buffer(-0.05))
    for ls in ([b] if b.geom_type == 'LineString' else list(getattr(b, 'geoms', []))):
        if ls.geom_type != 'LineString' or ls.length < 1.5: continue
        cs = list(ls.coords)
        for a, c2 in zip(cs[:-1], cs[1:]):
            if math.hypot(c2[0] - a[0], c2[1] - a[1]) > 0.3: TH.append([round(a[0], 3), round(a[1], 3), round(c2[0], 3), round(c2[1], 3)])

# --------------------------------------------------------------------------- QA-punkter: frie prøvepunkter + sonder mod kollisionsflader (bruges af Blender-QA: ingen usynlige hitbokse / ingen synlige genstande uden kollision)
try:
    _obst = unary_union([g for g in OBST_G] + [pr['poly'] for pr in PROPS] + [w for w in TEA_WALLS] + [TEAHOUSE['counter'].intersection(WALK)] + [sbox(BAL[0] - 0.2, BAL[1], BAL[2], BAL[3]), sbox(*BAL_STAIR).buffer(0.8)] +
                        [sbox(a, b, c, d) for (a, b, c, d, y0, y1, k) in boxes if k in ('wall', 'prop') and y0 < 0.2])
    _free = WALK.buffer(-0.62).difference(_obst.buffer(0.5)).difference(WATER.buffer(0.45)); FREE = []
    for gx in np.arange(X0W, X1W, 0.7):
        for gz in np.arange(Z0W, Z1W, 0.7):
            if _free.contains(Point(gx, gz)): FREE.append([round(float(gx), 2), round(float(gz), 2)])
    PROBES = []
    def perim(poly, ymid, kind):
        ring = list(poly.exterior.coords)
        for a, b in zip(ring[:-1], ring[1:]):
            L = math.hypot(b[0] - a[0], b[1] - a[1])
            if L < 0.2: continue
            nx, nz = (b[1] - a[1]) / L, -(b[0] - a[0]) / L                       # udadnormal (CCW ydre ring: højre side)
            mid = Point((a[0] + b[0]) / 2 + nx * 0.2, (a[1] + b[1]) / 2 + nz * 0.2)
            if poly.contains(mid): nx, nz = -nx, -nz
            for t in np.arange(0.4, L, 0.9) if L > 0.8 else [L / 2]:
                x, z = a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L
                if WALK.buffer(-0.1).contains(Point(x + nx * 0.3, z + nz * 0.3)): PROBES.append([round(x, 2), round(z, 2), round(nx, 3), round(nz, 3), ymid, kind])
    for pr in PROPS:
        for g in polys_of(pr['poly']): perim(g, min(pr['h'] / 2, 1.0), 'prop:' + pr['name'])
    for g in OBST_G:
        if g.geom_type == 'Polygon': perim(g, 0.4, 'dress')
    for l in LOTS:
        for (a, b) in [l.front]:
            L = math.hypot(b[0] - a[0], b[1] - a[1])
            for t in np.arange(0.3, L, 1.5) if L > 0.6 else [L / 2]:
                x, z = a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L
                for y in (1.0, min(l.top - 0.5, 2.6)):
                    if y > 0.3: PROBES.append([round(x, 2), round(z, 2), round(l.nout[0], 3), round(l.nout[1], 3), round(y, 2), 'lot:%s' % l.style])
    json.dump(dict(free=FREE, probes=PROBES), open(os.path.join(OUT, 'qa.json'), 'w'), separators=(',', ':'))
    print('[layout] QA: %d frie punkter, %d sonder' % (len(FREE), len(PROBES)))
except Exception as e:
    import traceback; traceback.print_exc()

# --------------------------------------------------------------------------- fototur: kamera ved hvert stednavn (kig mod den længste åbne retning)
TOUR = []
for (n_, px_, py_) in LABELS:
    x, z = M(px_, py_); p = Point(x, z)
    if not WALK.buffer(-0.8).contains(p): p = WALK.buffer(-0.8).representative_point() if False else p
    best = None
    for a in range(0, 360, 15):
        d = (math.cos(math.radians(a)), math.sin(math.radians(a))); ln = LineString([(x, z), (x + d[0] * 40, z + d[1] * 40)]).intersection(WALK)
        seg = ln if ln.geom_type == 'LineString' else (min(ln.geoms, key=lambda g: g.distance(p)) if hasattr(ln, 'geoms') and len(ln.geoms) else None)
        if seg is None or seg.is_empty: continue
        L = seg.length
        if best is None or L > best[0]: best = (L, d)
    if best:
        d = best[1]; TOUR.append(dict(n=n_, x=round(x, 2), z=round(z, 2), look=[round(x + d[0] * 6, 2), round(z + d[1] * 6, 2)]))
json.dump(TOUR, open(os.path.join(OUT, 'tour.json'), 'w'))

# --------------------------------------------------------------------------- vandlegemer til koi (klient): polygoner + antal fisk
bodies = []
for p in polys_of(WATER):
    n = max(2, min(9, int(round(p.area / 4.5))))
    bodies.append(dict(ring=[[round(a, 2), round(b, 2)] for a, b in list(p.exterior.coords)], n=n, y=CANAL_WATER, area=round(p.area, 1)))
os.makedirs(os.path.join(ROOT, 'public', 'assets', 'niseko'), exist_ok=True)
json.dump(dict(y=CANAL_WATER, bodies=bodies), open(os.path.join(ROOT, 'public', 'assets', 'niseko', 'water.json'), 'w'), separators=(',', ':'))
print('[layout] koi-legemer:', [(b['n'], b['area']) for b in bodies])

# --------------------------------------------------------------------------- designdata til Blender
def ringcoords(g): return [[round(x, 3), round(z, 3)] for x, z in g]
design = dict(ground=GROUND, bed=BED, edges=EDGES, water_pieces=WATER_PIECES, thresholds=TH, walk=dict(ext=ringcoords(list(WALK.exterior.coords)), holes=[ringcoords(list(h.coords)) for h in WALK.interiors]),
              surf=[dict(mat=m, polys=[dict(ext=ringcoords(list(p.exterior.coords)), holes=[ringcoords(list(h.coords)) for h in p.interiors]) for p in polys_of(g.intersection(WALK))]) for m, g in SURF],
              water=[dict(name=n, polys=[dict(ext=ringcoords(list(p.exterior.coords)), holes=[]) for p in polys_of(g.intersection(WALK))]) for n, g in WATER_SHAPES],
              canal_line=[[round(x, 3), round(z, 3)] for x, z in CANAL_LINE], bridge=list(BRIDGE.bounds),
              lots=[dict(front=[[round(x, 3), round(z, 3)] for x, z in l.front], nout=[round(l.nout[0], 4), round(l.nout[1], 4)], dir=[round(l.dir[0], 5), round(l.dir[1], 5)], he=round(l.he, 3), top=round(l.top, 3), style=l.style, floors=l.floors,
                         first=l.first, last=l.last, ring=l.ring, edge=l.edge, L=round(l.L, 3), smax=round(l.smax, 3), rp=l.rp, quad=[[round(x, 3), round(z, 3)] for x, z in l.quad], pieces=[[[round(x, 3), round(z, 3)] for x, z in pc] for pc in l.pieces]) for l in LOTS if l.pieces],
              seams=SEAMS, dress=DRESS, strings=STRINGS,
              water_rings=[[[round(a, 3), round(b, 3)] for a, b in list(r.coords)] for p in polys_of(orient(WATER, 1.0) if WATER.geom_type == 'Polygon' else MultiPolygon([orient(q, 1.0) for q in polys_of(WATER)])) for r in [p.exterior] + list(p.interiors)],
              props=[dict(poly=[[round(x, 3), round(z, 3)] for x, z in list(g.exterior.coords)[:-1]], h=p['h'], name=p['name'], style=p['style']) for p in PROPS for g in polys_of(p['poly'])],
              teahouse=dict(walls=[list(w.bounds) for w in TEA_WALLS], counter=list(TEAHOUSE['counter'].intersection(WALK).bounds), roof=list(TEAHOUSE['roof'].intersection(WALK).bounds), roof_y=TEAHOUSE['roof_y'], wall_h=TEAHOUSE['wall_h']),
              balcony=dict(deck=list(BAL), y=BAL_Y, stair=list(BAL_STAIR)), sites=SITES, spawns=dict(hij=SPAWN_HIJ, swat=SPAWN_SWAT), labels=labels,
              ponds=[dict(name=n, x=round(g.centroid.x, 3), z=round(g.centroid.y, 3), r=round(math.sqrt(g.area / math.pi), 3)) for n, g in PONDS])
json.dump(design, open(os.path.join(OUT, 'niseko_design.json'), 'w'), separators=(',', ':'))

# --------------------------------------------------------------------------- oversigt (PNG): gange, vand, parceller, props, sites, spawns
Z = 8
def P2(x, z): return ((x - X0W + 6) * Z, (z - Z0W + 6) * Z)
img = Image.new('RGB', (int((X1W - X0W + 12) * Z), int((Z1W - Z0W + 12) * Z)), (28, 30, 36)); dr = ImageDraw.Draw(img)
STY = {'machiya': (150, 120, 90), 'shop': (170, 110, 80), 'inn': (130, 110, 120), 'house1': (140, 130, 90), 'wall': (90, 90, 90), 'kura': (190, 190, 200), 'shrine': (200, 60, 50)}
for p in polys_of(WALK):
    dr.polygon([P2(*q) for q in p.exterior.coords], fill=(120, 118, 108))
    for h in p.interiors: dr.polygon([P2(*q) for q in h.coords], fill=(28, 30, 36))
for l in LOTS:
    for pc in l.pieces: dr.polygon([P2(*q) for q in pc], fill=STY.get(l.style, (120, 120, 120)), outline=(15, 15, 15))
for m, g in SURF[1:]:
    c = {'nk_slate': (96, 100, 110), 'nk_gravel': (165, 150, 110), 'nk_floor': (130, 96, 60), 'nk_pebbles': (110, 108, 96)}.get(m, (120, 118, 108))
    for p in polys_of(g.intersection(WALK)):
        dr.polygon([P2(*q) for q in p.exterior.coords], fill=c)
        for h in p.interiors: dr.polygon([P2(*q) for q in h.coords], fill=(28, 30, 36))
for n, g in WATER_SHAPES:
    for p in polys_of(g): dr.polygon([P2(*q) for q in p.exterior.coords], fill=(60, 120, 180))
for p in PROPS:
    for g in polys_of(p['poly']): dr.polygon([P2(*q) for q in g.exterior.coords], fill=(60, 200, 70))
for w in TEA_WALLS: dr.polygon([P2(*q) for q in list(w.exterior.coords)], fill=(40, 160, 60))
for k, (a, b, c, d) in SITES.items(): dr.rectangle([P2(a, b), P2(c, d)], outline=(255, 60, 60), width=2)
for sp, col in ((SPAWN_HIJ, (255, 190, 40)), (SPAWN_SWAT, (80, 160, 255))):
    for q in sp: x, y = P2(*q); dr.ellipse((x - 4, y - 4, x + 4, y + 4), fill=col)
dr.rectangle([P2(bx0, bz0), P2(bx1, bz1)], outline=(255, 255, 0), width=2); dr.rectangle([P2(sx0, sz0), P2(sx1, sz1)], outline=(255, 200, 0), width=2)
try: fnt = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 14)
except Exception: fnt = None
for n, x, z, y in labels: dr.text(P2(x, z), n, fill=(255, 255, 255), font=fnt)
img.save(os.path.join(OUT, 'niseko_layout.png'))

if os.environ.get('NK_DEBUG'):
    bad = [l for l in LOTS if not l.pieces]
    print('lots uden stykker:', len(bad), 'af', len(LOTS))
    for l in bad[:10]:
        q = Polygon(l.quad); print(l.ring, l.edge, l.k, 'quad valid', q.is_valid, 'area', round(q.area, 2), 'L', round(l.L, 2), 'region', round(l.region.area, 3), [(round(a, 2), round(b, 2)) for a, b in l.quad])

if os.environ.get('NK_DEBUG2'):
    x0, z0, x1, z1 = [float(v) for v in os.environ['NK_DEBUG2'].split(',')]; Zs = 30
    im = Image.new('RGB', (int((x1 - x0) * Zs), int((z1 - z0) * Zs)), (30, 30, 36)); dd = ImageDraw.Draw(im)
    P3 = lambda q: ((q[0] - x0) * Zs, (q[1] - z0) * Zs)
    for p in polys_of(WALK): 
        dd.polygon([P3(q) for q in p.exterior.coords], fill=(110, 108, 100))
        for h in p.interiors: dd.polygon([P3(q) for q in h.coords], fill=(30, 30, 36))
    cols = [(200, 90, 70), (70, 160, 200), (120, 200, 90), (200, 190, 70), (170, 90, 200), (90, 200, 180)]
    for k, l in enumerate(LOTS):
        for g in polys_of(l.region):
            dd.polygon([P3(q) for q in g.exterior.coords], fill=cols[k % 6], outline=(0, 0, 0))
        dd.line([P3(l.front[0]), P3(l.front[1])], fill=(255, 255, 255), width=2)
        dd.text(P3(l.front[0]), '%d.%d.%d' % (l.ring, l.edge, l.k), fill=(255, 255, 255))
    im.save(os.path.join(OUT, 'debug_region.png'))

if os.environ.get('NK_DEBUG3'):
    tot_r = sum(l.region.area for l in LOTS); tot_p = sum(Polygon(pc).area for l in LOTS for pc in l.pieces)
    print('region areal', round(tot_r, 2), 'stykker', round(tot_p, 2))
    for l in LOTS:
        a = sum(Polygon(pc).area for pc in l.pieces)
        if abs(a - l.region.area) > 0.05: print(l.ring, l.edge, l.k, 'region', round(l.region.area, 3), 'stykker', round(a, 3), l.region.geom_type, len(l.pieces))

if os.environ.get('NK_DEBUG4'):
    import geom as G
    for l in LOTS:
        if (l.ring, l.edge, l.k) == (14, 11, 0):
            g = polys_of(l.region)[0]; print(g.wkt[:600]); V, t = G.triangulate(g); print(len(V), len(t), sum(abs(G._area([V[i] for i in tt])) for tt in t), g.area)
            print(G.convex_pieces(g))

if os.environ.get('NK_DEBUG5'):
    px, pz = [float(v) for v in os.environ['NK_DEBUG5'].split(',')]
    P_ = Point(px, pz)
    for i, l in enumerate(LOTS):
        if l.region.buffer(0.15).contains(P_) or l.region.distance(P_) < 0.15:
            print('lot', i, 'ring', l.ring, 'edge', l.edge, 'style', l.style, 'he', round(l.he, 2), 'rp', l.rp, 's', round(lot_s(l, (px, pz)), 2), 'roof', round(lot_y(l, (px, pz)), 2), 'dist', round(l.region.distance(P_), 3), 'smax', round(l.smax, 2))
