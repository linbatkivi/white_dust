#!/usr/bin/env python3
# ==========================================================================
# de_fattoria · bane-design efter brugerens plantegning (gen/trace.py → out/layout_trace.json) – python3 tools/fattoria/gen/layout.py
#   Koordinater i meter: x øst, z syd (nord = −z), y op. 10 px i plantegningen = 1 m. Samme metode som Niseko:
#   kollision = rene geometriske prismer (konvekse polygoner): gulve, huse/mure langs alle kanter (parceller med præcis skrå vægge), øer, props.
#   ALT er placeret med et taktisk formål (se TAKTIK-blokken): intet står tilfældigt, intet svæver, ingen usynlige vægge.
#   Udgang: shared/fattoria_data.js (spil), out/fattoria_design.json (Blender), out/qa.json, out/fattoria_layout.png
# ==========================================================================
import os, sys, json, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import Polygon, Point, LineString, box as sbox, MultiPolygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
from shapely import affinity
from shapely.strtree import STRtree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ft_roof import params as roof_params, roof_y
from geom import convex_pieces, polys_of, convex, ccw

HERE = os.path.dirname(os.path.abspath(__file__)); TOOL = os.path.dirname(HERE); OUT = os.path.join(TOOL, 'out'); ROOT = os.path.abspath(os.path.join(TOOL, '..', '..'))
rnd = random.Random(31)
S, CX, CY = 10.0, 654.0, 601.0                       # px pr. meter, billedets midte = verdens-origo
BASE = -4.0
def M(px, py): return ((px - CX) / S, (py - CY) / S)
def MB(x0, y0, x1, y1): a = M(x0, y0); b = M(x1, y1); return sbox(a[0], a[1], b[0], b[1])
def rnd_range(a, b): return a + (b - a) * rnd.random()

# --------------------------------------------------------------------------- gangene (fra billedet)
T = json.load(open(os.path.join(OUT, 'layout_trace.json')))
WALK = orient(Polygon(T['ext'], T['holes']).buffer(0), 1.0)
assert WALK.is_valid and WALK.geom_type == 'Polygon', WALK.geom_type
X0W, Z0W, X1W, Z1W = WALK.bounds

# --------------------------------------------------------------------------- zoner (px-rektangler fra plantegningen → meter)
SWAT_Z = MB(118, 25, 316, 163); HIJ_Z = MB(975, 1020, 1272, 1152)
UPPER_Z = MB(455, 118, 712, 222); MID_Z = MB(515, 530, 968, 746); MID_N = MB(448, 470, 520, 545)
A_RED = MB(109, 446, 228, 558); B_RED = MB(932, 230, 1194, 305)
A_OVAL = affinity.scale(Point(*M(172, 515)).buffer(1.0, quad_segs=24), 12.6, 13.6)                       # A: den runde tærskeplads (aia)
B_HALL = MB(890, 208, 1220, 326)
TOWER_BOX = MB(176, 688, 316, 772)
HOLES = [Polygon(h) for h in T['holes']]
def island_id(g):
    c = g.centroid; best = min(range(len(HOLES)), key=lambda i: HOLES[i].centroid.distance(c)); return best

# --------------------------------------------------------------------------- overflader (malerrækkefølge)
SURF = [('ft_gravel', WALK),
        ('ft_cobble', SWAT_Z), ('ft_cobble2', MID_Z), ('ft_cobble2', MID_N), ('ft_gravel', HIJ_Z),
        ('ft_cobble2', UPPER_Z),                                                      # Upper Hall: fliser i villaens loggia
        ('ft_cobble', A_OVAL),                                                        # A: stenlagt tærskeplads (aia)
        ('ft_brickf', B_HALL),                                                        # B: tinaiaens teglgulv
        ('ft_terra', TOWER_BOX)]                                                      # tårnets gulv


# --------------------------------------------------------------------------- konvekse stykker → prismer
prisms = []          # [ [[x,z]…], y0, y1, kind ]
boxes = []           # [x0,z0,x1,z1,y0,y1,kind] (akseparallelle)
def add_prisms(g, y0, y1, kind):
    for p in polys_of(g):
        for pc in convex_pieces(p): prisms.append([[[round(x, 3), round(z, 3)] for x, z in pc], round(y0, 3), round(y1, 3), kind])

# gulve: gangene (ét plan, y = 0)
add_prisms(WALK, BASE, 0.0, 'floor')

# --------------------------------------------------------------------------- stilarter pr. kant (hus, mur, terrasse …) – hver kant får en stil efter hvor den ligger
STY = {'villa':    dict(dep=(8.8, 9.6), lw=(9.5, 13.0), he=(7.0, 7.5), fl=2),
       'casa':     dict(dep=(6.8, 8.4), lw=(6.0, 8.5), he=(5.6, 6.3), fl=2),
       'casetta':  dict(dep=(5.4, 6.6), lw=(5.2, 7.5), he=(3.5, 4.0), fl=1),
       'fienile':  dict(dep=(8.2, 9.2), lw=(8.0, 11.0), he=(5.3, 5.8), fl=1),
       'swall':    dict(dep=(1.3, 1.3), lw=(40.0, 40.0), he=(3.6, 3.6), fl=1),
       'terrace':  dict(dep=(1.8, 1.8), lw=(40.0, 40.0), he=(3.4, 3.4), fl=1),
       'hedge':    dict(dep=(1.5, 1.5), lw=(40.0, 40.0), he=(3.8, 3.8), fl=1),
       'hallwall': dict(dep=(1.5, 1.5), lw=(40.0, 40.0), he=(5.4, 5.4), fl=1),
       'twall':    dict(dep=(1.5, 1.5), lw=(40.0, 40.0), he=(6.9, 6.9), fl=1)}        # tårnets mure (flade, høje)
ISLAND_STYLE = {0: 'terrace', 1: 'casetta', 2: 'casetta', 3: 'casetta', 4: 'fienile', 5: 'casa', 6: 'casa', 7: 'terrace', 8: 'hedge'}
EXT_VILLA = SWAT_Z.buffer(1.6).union(UPPER_Z.buffer(1.6))
HALLZONE = sbox(*B_HALL.bounds).buffer(0.6)
TOWER_Z = TOWER_BOX.buffer(0.35)
def edge_style(ri, a, b):
    mid = Point((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    if ri == 0:
        if HALLZONE.contains(mid): return 'hallwall'
        if EXT_VILLA.contains(mid): return 'villa'
        return 'swall'
    isl = ISLAND_OF_RING[ri]
    if TOWER_Z.contains(mid) and isl in (5, 7):
        if isl == 7 and abs(mid.y - 8.9) < 0.5 and -47.8 < mid.x < -34.2: return 'terrace'        # tårnets nordkant: lav terrasse (udsigt over A), værn på dækket
        return 'twall'
    return ISLAND_STYLE[isl]
EXTRA_STYLE = {}                                     # (ring, edge) → stil (overstyring)

# --------------------------------------------------------------------------- husrækker (parceller) langs alle vægge
#   Hver kant i gangenes omrids får et bånd (vinkelret ud i væggen, afsluttet af hjørnernes vinkelhalveringslinjer = præcis gering). Bånd fra forskellige kanter
#   deler sig efter nærmeste facade. Resultatet er sammenhængende, overlapsfrie konvekse stykker → kollisions-prismer OG tage.
class Lot: pass
rings = []                                           # [(pts, is_exterior)]
rings.append((list(WALK.exterior.coords)[:-1], True))
for h in WALK.interiors: rings.append((list(h.coords)[:-1], False))
ISLAND_OF_RING = {0: None}
for ri in range(1, len(rings)): ISLAND_OF_RING[ri] = island_id(Polygon(rings[ri][0]))
LOTS = []; WALK_BUF = WALK.buffer(-0.004)
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
    ring_lots = []; prev_style = None; he_cur = None
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]; L = Ls[i]; d = dirs[i]; nwi = nw[i]
        st = EXTRA_STYLE.get((ri, i)) or edge_style(ri, a, b); P = STY[st]
        nl = max(1, int(round(L / rnd_range(*P['lw']))))
        cuts = [0.0] + sorted((k + 1) / nl + rnd_range(-0.12, 0.12) / nl for k in range(nl - 1)) + [1.0]
        dep = rnd_range(*P['dep'])
        for k in range(nl):
            t0, t1 = cuts[k], cuts[k + 1]
            p0 = (a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0); p1 = (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)
            def off(bb, at_corner):
                if at_corner:
                    c = bb[0] * nwi[0] + bb[1] * nwi[1]; f = dep / max(c, 0.3); return (bb[0] * f, bb[1] * f)
                return (nwi[0] * dep, nwi[1] * dep)
            o0 = off(bis[i], k == 0); o1 = off(bis[(i + 1) % n], k == nl - 1)
            quad = [p0, p1, (p1[0] + o1[0], p1[1] + o1[1]), (p0[0] + o0[0], p0[1] + o0[1])]
            l0, l1 = math.hypot(*o0), math.hypot(*o1); u0 = (o0[0] / l0, o0[1] / l0); u1 = (o1[0] / l1, o1[1] / l1)
            cr = u0[0] * u1[1] - u0[1] * u1[0]
            if abs(cr) > 1e-6:
                t = ((p1[0] - p0[0]) * u1[1] - (p1[1] - p0[1]) * u1[0]) / cr; t2 = ((p1[0] - p0[0]) * u0[1] - (p1[1] - p0[1]) * u0[0]) / cr
                if 1e-6 < t < l0 and 1e-6 < t2 < l1: quad = [p0, p1, (p0[0] + u0[0] * t, p0[1] + u0[1] * t)]
            lot = Lot(); lot.ring = ri; lot.edge = i; lot.k = k; lot.nl = nl; lot.quad = quad; lot.front = (p0, p1); lot.nout = (-nwi[0], -nwi[1]); lot.nw = nwi; lot.dir = d
            lot.first = (k == 0); lot.last = (k == nl - 1); lot.L = math.hypot(p1[0] - p0[0], p1[1] - p0[1]); lot.style = st; lot.floors = P['fl']; lot.island = ISLAND_OF_RING[ri]
            if k == 0 and ring_lots and ring_lots[-1].style == st: he = ring_lots[-1].he
            else:
                he = rnd_range(*P['he']); 
            if k > 0: he = min(P['he'][1], max(P['he'][0], ring_lots[-1].he + rnd.choice([0, 0, 0, 0.5, -0.5, 0.9, -0.9]))) if P['he'][1] > P['he'][0] else P['he'][0]
            lot.he = he; ring_lots.append(lot)
    if len(ring_lots) > 1 and ring_lots[-1].style == ring_lots[0].style: ring_lots[-1].he = ring_lots[0].he
    LOTS += ring_lots
# områder: båndet minus gangene (kun den del der hænger sammen med facaden)
def front_seg(l): return LineString([l.front[0], l.front[1]])
for l in LOTS:
    g = Polygon(l.quad).buffer(0).difference(WALK_BUF)
    keep = [p for p in polys_of(g) if p.distance(front_seg(l)) < 0.02 and p.area > 1e-3]
    l.region = unary_union(keep) if keep else Polygon()
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
            gx, gz = l.nw[0] - m.nw[0], l.nw[1] - m.nw[1]; c = (l.nw[0] * l.front[0][0] + l.nw[1] * l.front[0][1]) - (m.nw[0] * m.front[0][0] + m.nw[1] * m.front[0][1])
            if math.hypot(gx, gz) < 1e-6:
                di, dj = front_seg(l).distance(o.centroid), front_seg(m).distance(o.centroid); l_wins = di <= dj
                if l_wins: m.region = m.region.difference(o).buffer(0)
                else: l.region = l.region.difference(o).buffer(0)
            else:
                Hi = halfplane((gx, gz), c, -1)
                l.region = l.region.difference(o.difference(Hi)).buffer(0); m.region = m.region.difference(o.intersection(Hi)).buffer(0)
            changed = True
    if not changed: break
for l in LOTS:                                       # opsplit i konvekse stykker
    ps = []
    for g in polys_of(l.region):
        if g.area < 0.02: continue
        for pc in convex_pieces(g): ps.append(pc)
    l.pieces = ps; l.smax = 0.0
    for pc in ps:
        for q in pc: l.smax = max(l.smax, (q[0] - l.front[0][0]) * l.nw[0] + (q[1] - l.front[0][1]) * l.nw[1])
    l.area = l.region.area
for l in LOTS:
    l.rp = roof_params(l.style, l.smax); l.top = l.he + l.rp['pitch'] * (min(l.smax, l.rp['sr']) + l.rp['over'])
def slab_cuts(l):
    if l.rp['pitch'] == 0.0: return None
    sr = l.rp['sr']; step = 1.0
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
            top = min(roof_y(l.he, l.rp, a), roof_y(l.he, l.rp, b))
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
                lowl = (yl[0][0] + yl[1][0]) < (yl[0][1] + yl[1][1])
                low = l if lowl else m; high = m if lowl else l; dx, dz = Bp[0] - A[0], Bp[1] - A[1]; nL = math.hypot(dx, dz); n1 = (-dz / nL, dx / nL)
                mp = ((A[0] + Bp[0]) / 2, (A[1] + Bp[1]) / 2); pl = Point(mp[0] + n1[0] * 0.12, mp[1] + n1[1] * 0.12); pm = Point(mp[0] - n1[0] * 0.12, mp[1] - n1[1] * 0.12)
                dl_p, dl_m = low.region.distance(pl), low.region.distance(pm)
                if dl_m < dl_p - 1e-6: n1 = (-n1[0], -n1[1])
                lo_a, hi_a = sorted(yl[0]); lo_b, hi_b = sorted(yl[1])
                SEAMS.append(dict(pts=[[round(A[0], 3), round(hi_a, 3), round(A[1], 3)], [round(Bp[0], 3), round(hi_b, 3), round(Bp[1], 3)], [round(Bp[0], 3), round(lo_b, 3), round(Bp[1], 3)], [round(A[0], 3), round(lo_a, 3), round(A[1], 3)]],
                                  n=[round(n1[0], 4), round(n1[1], 4)], style=(m.style if lowl else l.style)))
print('[layout] parceller %d · stilarter %s · sømme %d' % (len(LOTS), {s: sum(1 for l in LOTS if l.style == s) for s in STY}, len(SEAMS)))

# --------------------------------------------------------------------------- øernes indre: fyld (så intet er hult set ovenfra) + tage/terrasser
FILLS = []                                           # dict(poly, y, island, style)
for ii, H in enumerate(HOLES):
    ls = [l for l in LOTS if l.island == ii and l.pieces]
    if not ls: continue
    covered = unary_union([l.region for l in ls]).buffer(0.0005)
    rest = H.difference(covered).buffer(-0.0).buffer(0)
    top_y = {'terrace': 3.4, 'hedge': 3.8}.get(ISLAND_STYLE[ii]) or round(min(l.top for l in ls) - 0.9, 2)
    for g in polys_of(rest):
        if g.area < 0.4: continue
        FILLS.append(dict(poly=g, y=top_y, island=ii, style=ISLAND_STYLE[ii]))
        add_prisms(g, BASE, top_y, 'wall')
print('[layout] øfyld: %d stykker, %.0f m²' % (len(FILLS), sum(f['poly'].area for f in FILLS)))

# --------------------------------------------------------------------------- sites, spawns, labels
def grow(g, d): x0, z0, x1, z1 = g.bounds; return (round(x0 - d, 2), round(z0 - d, 2), round(x1 + d, 2), round(z1 + d, 2))
SITES = {'A': grow(A_RED, 0.8), 'B': grow(B_RED, 0.8)}
def spawn_points(zone, n, avoid, seed, inset=1.8):
    inner = zone.intersection(WALK).buffer(-inset).difference(avoid)
    x0, z0, x1, z1 = inner.bounds; pts = []; r = random.Random(seed)
    for _ in range(6000):
        p = Point(r.uniform(x0, x1), r.uniform(z0, z1))
        if inner.contains(p) and all(p.distance(Point(q[0], q[1])) > 2.2 for q in pts): pts.append((round(p.x, 2), round(p.y, 2)))
        if len(pts) >= n: break
    return pts
LABELS = [('SWAT Spawn', 215, 80), ('Spawn Exit', 350, 215), ('A Diag', 300, 300), ('Villa Lane', 450, 330), ('Upper Hall', 585, 165), ('Hall East', 760, 125), ('Loggia Loop', 850, 160),
          ('A Long', 380, 452), ('A Site', 168, 500), ('A South', 80, 640), ('A Connector', 410, 600), ('Tower', 246, 726), ('Tower Stub', 400, 725), ('West Loop', 58, 740), ('Tower Steps', 160, 830),
          ('Mid Door', 480, 520), ('Mid', 740, 640), ('Mid North', 810, 500), ('B Link', 920, 400), ('B Mouth', 900, 275), ('B Hall', 1075, 330), ('East Pocket', 1124, 640), ('East Road', 1160, 880),
          ('Mid South', 590, 880), ('South Road', 420, 1105), ('Hijackers Spawn', 1115, 1085), ('Orchard Road', 240, 960), ('B Approach', 820, 320)]

# --------------------------------------------------------------------------- spawns
NO_SPAWN = unary_union([A_RED.buffer(0), B_RED.buffer(0)])
SPAWN_HIJ = spawn_points(HIJ_Z, 5, Point(0, 1e6).buffer(0.1), 5)
SPAWN_SWAT = spawn_points(SWAT_Z.intersection(sbox(-46.5, -55.0, -33.0, -44.0)), 5, Point(0, 1e6).buffer(0.1), 7, inset=1.0)
ALL_PTS = [Point(p[0], p[1]) for p in SPAWN_HIJ + SPAWN_SWAT]
SITE_BOXES = [sbox(a, b, c, d) for (a, b, c, d) in SITES.values()]

# --------------------------------------------------------------------------- TAKTIK – hver ting herunder har et formål (peek, dækning, skjul, informationspunkt, flaskehals, kontrol af en vinkel)
DRESS = []; OBST_G = []; TACTICS = []
def free_geom(g, wall=0.1, spawn=2.0, gap=0.7):
    if not WALK.buffer(-wall).contains(g): return False
    if any(g.distance(q) < spawn for q in ALL_PTS): return False
    if any(o.distance(g) < gap for o in OBST_G): return False
    return True
def obox_poly(x, z, L, Wd, yaw):
    c, sn = math.cos(yaw), math.sin(yaw); return Polygon([(x + a * c - b * sn, z + a * sn + b * c) for (a, b) in ((-L / 2, -Wd / 2), (L / 2, -Wd / 2), (L / 2, Wd / 2), (-L / 2, Wd / 2))])
def circle_poly(x, z, r, n=12): return Point(x, z).buffer(r, quad_segs=max(2, n // 4))
def add_poly(g, y0, h, kind):
    for p in polys_of(g):
        for pc in convex_pieces(p): prisms.append([[[round(a, 3), round(b, 3)] for a, b in pc], round(y0, 3), round(h, 3), kind])
    OBST_G.append(g)
def add_circle(x, z, r, h, kind='prop', n=10, y0=0.0):
    prisms.append([[[round(x + math.cos(2 * math.pi * k / n + math.pi / n) * r, 3), round(z + math.sin(2 * math.pi * k / n + math.pi / n) * r, 3)] for k in range(n)], y0, h, kind]); OBST_G.append(Point(x, z).buffer(r))
def add_obox(x, z, L, Wd, yaw, h, kind='prop', y0=0.0):
    c, sn = math.cos(yaw), math.sin(yaw); pts = []
    for (a, b) in ((-L / 2, -Wd / 2), (L / 2, -Wd / 2), (L / 2, Wd / 2), (-L / 2, Wd / 2)): pts.append([round(x + a * c - b * sn, 3), round(z + a * sn + b * c, 3)])
    prisms.append([pts, y0, h, kind]); OBST_G.append(Polygon(pts))
FAILS = []; SHIFTED = []
def _spiral(maxr, step=0.25):
    yield (0.0, 0.0)
    r = step
    while r <= maxr + 1e-9:
        n = max(8, int(2 * math.pi * r / step))
        for k in range(n): yield (r * math.cos(2 * math.pi * k / n), r * math.sin(2 * math.pi * k / n))
        r += step
def put_group(tid, why, t, parts, snap=1.8, wall=0.1, gap=0.7, kind='prop'):
    """parts = [(dx, dz, geomfn(x,z), h, kw)] – placérer gruppen så tæt på (x,z) som muligt hvor ALLE dele er gyldige (inde i gangene, væk fra spawns/andre genstande)"""
    for (ox, oz) in _spiral(snap):
        ok = True
        for (dx, dz, gf, h, kw, gp) in parts:
            if not free_geom(gf(dx + ox, dz + oz), wall=wall, gap=gp if gp is not None else gap): ok = False; break
        if ok:
            for (dx, dz, gf, h, kw, gp) in parts:
                g = gf(dx + ox, dz + oz); add_poly(g, 0.0, h, kw.pop('_kind', kind)); d = dict(t=t, x=round(dx + ox, 2), z=round(dz + oz, 2), h=h, id=tid); d.update(kw); DRESS.append(d)
            TACTICS.append((tid, why, t, round(parts[0][0] + ox, 1), round(parts[0][1] + oz, 1)))
            if math.hypot(ox, oz) > 0.7: SHIFTED.append((tid, round(math.hypot(ox, oz), 1)))
            return True
    FAILS.append((tid, t)); return False
def well(tid, why, x, z, r=1.0, h=1.15): return put_group(tid, why, 'well', [(x, z, lambda a, b: circle_poly(a, b, r, 12), h, dict(r=r), None)])
def fountain(tid, why, x, z, r=2.6, h=0.95):
    ok = put_group(tid, why, 'fountain', [(x, z, lambda a, b: circle_poly(a, b, r, 12), h, dict(r=r), None)], snap=0.5)
    if ok:
        d = DRESS[-1]; add_circle(d['x'], d['z'], 0.5, 2.8, 'wall', 10)
    return ok
def cart(tid, why, x, z, yaw, L=2.8, W=1.3, h=1.15): return put_group(tid, why, 'cart', [(x, z, lambda a, b: obox_poly(a, b, L, W, yaw), h, dict(yaw=yaw, L=L, W=W), None)])
def crates(tid, why, x, z, yaw, L=1.6, W=1.6, h=1.5): return put_group(tid, why, 'crates', [(x, z, lambda a, b: obox_poly(a, b, L, W, yaw), h, dict(yaw=yaw, L=L, W=W), None)])
def lowwall(tid, why, x0, z0, x1, z1, h=1.2, th=0.55):
    L = math.hypot(x1 - x0, z1 - z0); yaw = math.atan2(z1 - z0, x1 - x0); cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    return put_group(tid, why, 'lowwall', [(cx, cz, lambda a, b: obox_poly(a, b, L, th, yaw), h, dict(yaw=yaw, L=L, W=th), None)])
def pier(tid, why, x, z, w=0.85, h=3.4, yaw=0.0, kind='wall'): return put_group(tid, why, 'pier', [(x, z, lambda a, b: obox_poly(a, b, w, w, yaw), h, dict(yaw=yaw, L=w, W=w, _kind=kind), None)], gap=0.5)
def barrels(tid, why, x, z, yaw=0.0, nx=2, nz=1, r=0.46, h=0.98):
    c, sn = math.cos(yaw), math.sin(yaw); parts = []
    for i in range(nx):
        for j in range(nz):
            a, b = (i - (nx - 1) / 2) * r * 2.05, (j - (nz - 1) / 2) * r * 2.05
            parts.append((x + a * c - b * sn, z + a * sn + b * c, lambda p, q: circle_poly(p, q, r, 12), h, dict(r=r), 0.0))
    return put_group(tid, why, 'barrel', parts)
def tun(tid, why, x, z, r=1.05, h=2.25): return put_group(tid, why, 'tun', [(x, z, lambda a, b: circle_poly(a, b, r, 12), h, dict(r=r, _kind='wall'), None)])
def press(tid, why, x, z, yaw, L=3.0, W=1.5, h=1.45): return put_group(tid, why, 'press', [(x, z, lambda a, b: obox_poly(a, b, L, W, yaw), h, dict(yaw=yaw, L=L, W=W), None)])
def trough(tid, why, x, z, yaw, L=2.2, W=0.8, h=0.85): return put_group(tid, why, 'trough', [(x, z, lambda a, b: obox_poly(a, b, L, W, yaw), h, dict(yaw=yaw, L=L, W=W), None)])
def planter(tid, why, x, z, yaw, L=1.8, W=0.6, h=0.62): return put_group(tid, why, 'planter', [(x, z, lambda a, b: obox_poly(a, b, L, W, yaw), h, dict(yaw=yaw, L=L, W=W), None)])
def bench(tid, why, x, z, yaw, L=1.7, W=0.5, h=0.48): return put_group(tid, why, 'bench', [(x, z, lambda a, b: obox_poly(a, b, L, W, yaw), h, dict(yaw=yaw, L=L, W=W), None)])
def tree(tid, why, sp, x, z, h, R, tr=0.36, th=4.2):
    return put_group(tid, why, 'tree', [(x, z, lambda a, b: circle_poly(a, b, tr, 8), th, dict(sp=sp, Ht=h, R=R, seed=len(DRESS) * 31 + 7, trunk=True, _kind='wall'), 0.3)], snap=0.8)

# ----- SWAT-siden: tre baner fra Spawn Exit – brønden deler krydset så ingen kan se alle tre baner på én gang
well('swat.well', 'Brønden i krydset ved Spawn Exit: søjle-dækning der deler tre baner (A Diag, Villa Lane, Upper Hall) og giver et skulder-peek begge veje', -26.6, -39.4, 0.95)
cart('adiag.cart', 'Vognen midt i A Diag: SWAT kan skubbe frem bag den mod A og Hijackers der kommer op fra A kan bruge den som første dækning', -37.2, -29.8, math.radians(-54), L=2.6, W=1.2)
barrels('adiag.barrels', 'Tønder ved A Diags udmunding: tre stk. giver et lavt crouch-peek mod A-sitets nordøst', -41.6, -22.9, math.radians(-54), nx=3, nz=1)
pier('lane.pier1', 'Pilaster i Villa Lane: bryder den lange sigtelinje fra Villa Lane til A Long, så man må vælge side', -20.2, -27.0, 0.8, 3.4)
# ----- Upper Hall: villaens loggia – piller der giver peeks langs hallens længde og skjul mod SWAT-spawnens udgang
for k, px in enumerate((-15.0, -8.0, -1.0)):
    pier('upper.pier%d' % k, 'Loggia-pille: dækning/skulderpeek ved en rykning langs Upper Hall mod B (rækken skaber to baner)', px, -43.2, 0.9, 3.6)
bench('upper.bench1', 'Stenbænk under loggiaen: lavt dæk for en lurker i hallens nordkant', -11.5, -47.6, 0.0, L=2.0)
planter('upper.pl1', 'Plantekasse i hallens sydkant: afgrænser baner og skjuler fødder', -4.0, -38.9, 0.0, L=2.2)
# ----- A Long (z ≈ −16): lang vandret korridor mod A – to forskudte dæk så rykket ikke bliver en skydebane
crates('along.crates', 'Kassestak i A Long: lukker halvdelen af bredden, så Hijackers/SWAT kun kan pege fra to kanter', -32.0, -15.2, 0.0, 1.5, 1.5, 1.5)
barrels('along.barrels', 'Tønder ved A Longs mund: dækning for at holde A-sitet ud', -39.5, -16.6, 0.0, nx=2, nz=1)
# ----- A-sitet (den runde tærskeplads): brønd i midten, lave mure og piller ved indgangene
well('a.well', 'Brønden i A: central søjle – default-plantested, 360° peek-dækning, kan hoppes op på for udsyn', -47.2, -9.4, 1.25, 1.2)
lowwall('a.south', 'Lav mur syd for brønden: skjuler en forsvarer for tårnet og for indgangen i syd (A South), peek fra begge ender', -52.4, -1.4, -47.2, -1.4, 1.15, 0.5)
barrels('a.barrels', 'Tønder i det nordvestlige hjørne: bagerste plantested + skjul bag for forsvarer der holder Long/Diag', -55.4, -14.6, math.radians(40), nx=2, nz=2)
crates('a.crates', 'Kasser ved østkanten af A: dækning mod A Long og Connector – aggressivt plantested', -40.4, -9.8, math.radians(15), 1.5, 1.5, 1.5)
pier('a.pier.ne', 'Pille ved NE-indgangen (A Diag): giver angriberen et peek ind i sitet uden at stå frit', -42.6, -19.4, 0.9, 3.4)
pier('a.pier.se', 'Pille ved SE-indgangen (A Connector): samme formål mod Connector', -37.4, -3.6, 0.9, 3.4)
# ----- Tårnet og tårngangen
barrels('stub.b1', 'Tønder i Tower Stub (første): dækning for den der går mod tårnet, bremser Mid→tårn-sigtelinjen', -27.8, 11.2, 0.0, nx=2, nz=1)
cart('stub.cart', 'Vogn i Tower Stub (anden): forskudt fra tønderne, så korridoren bliver et S-forløb og ikke en skydebane', -20.2, 13.2, 0.0, L=2.6, W=1.2)
# ----- West Loop & Orchard Road (lange korridorer): skjul og infopunkter
crates('west.crates', 'Kasser på West Loop: skjul for en lurker der lytter efter Hijackers der kommer sydfra mod A South', -59.2, 13.0, 0.0, 1.5, 1.5, 1.5)
barrels('orch.barrels', 'Tønder på Orchard Road: dækning på den lange rute fra Hijackers mod A', -40.4, 37.5, 0.0, nx=1, nz=2)
# ----- Mid: fontæne, træer, lave mure, vogn – åbent, men med dækning til tre-fire grupper
fountain('mid.fountain', 'Fontænen midt i Mid: kontrol af krydset – lav kant (crouch-dæk) og høj søjle (skulder-peek)', 7.8, 3.6, 2.5, 0.95)
tree('mid.plane1', 'Platantræ (stamme): søjledækning i Mids vestlige halvdel mod Mid Door og Mid South', 'plane', -7.5, 1.0, 9.0, 4.2, 0.36)
tree('mid.plane2', 'Platantræ (stamme): søjledækning i Mids østlige halvdel mod East Pocket', 'plane', 22.0, 8.6, 9.0, 4.2, 0.36)
lowwall('mid.wall1', 'Lav mur NV i Mid: crouch-dæk for en SWAT der holder Mid fra Mid North/Mid Door', -3.0, -4.2, 2.4, -4.2, 1.2, 0.55)
lowwall('mid.wall2', 'Lav mur SØ i Mid: dæk mod Mid South og East Road for Hijackers', 14.5, 10.8, 20.0, 10.8, 1.2, 0.55)
cart('mid.cart', 'Vogn øst i Mid: dækning i overgangen mod East Pocket', 25.5, 2.5, math.radians(80), L=3.0, W=1.3)
pier('mid.gate.w', 'Portpille vest for Mid South: peek-hjørne for dem der kommer op fra syd', -9.2, 14.2, 0.9, 3.2)
pier('mid.gate.e', 'Portpille øst for Mid South: modsat peek-hjørne', -4.6, 14.2, 0.9, 3.2)
trough('mid.trough', 'Vandtrug ved Mid Door: lavt dæk i krydset ved Villa Lane/A Connector', -12.2, -8.8, math.radians(90), L=2.4)
barrels('eastp.barrels', 'Tønder i East Pocket-gangen: skjul/infopunkt (lyd af skridt rundt om blokken)', 47.0, 3.0, math.radians(90), nx=1, nz=2)
# ----- Mid North / B-forbindelsen
crates('bl.crates', 'Kasser i B Link: bremser rykket fra Mid mod B og giver en skulder at kigge rundt', 16.2, -12.6, 0.0, 1.5, 1.5, 1.5)
barrels('mn.barrels', 'Tønder i Mid Diagonal: dækning langs diagonalen op mod B Approach', -0.6, -15.0, math.radians(45), nx=2, nz=1)
# ----- B-hallen (tinaiaen): piller, store fødertønder, presse
for k, px in enumerate((32.5, 39.0, 45.5, 52.0)):
    pier('b.pier%d' % k, 'Bærepille i B-hallen: skulderpeek og skjul – række i midten deler hallen i to baner', px, -33.4, 0.85, 5.4)
tun('b.tun1', 'Fødertønde ved SV-indgangen: dækning for den der kommer fra Mid Diagonal ind i hallen', 28.0, -29.3, 1.05)
tun('b.tun2', 'Fødertønde midt på sydvæggen: skjul for en forsvarer der dækker sitet fra syd', 42.0, -29.2, 1.05)
tun('b.tun3', 'Fødertønde øst for sitet (nord): bagerste plantested', 54.9, -37.4, 1.0)
tun('b.tun4', 'Fødertønde øst for sitet (syd): bageste skjul for en post-plant forsvarer', 54.9, -29.6, 1.0)
press('b.press', 'Vinpresse under galleriet: lavt dæk mod nord, skjuler en forsvarer for galleriet', 46.0, -37.9, 0.0, 3.0, 1.4)
crates('b.crates1', 'Kasser under galleriet (vest): dæk for den der klatrer op ad trappen', 32.0, -38.2, 0.0, 1.5, 1.4, 1.5)
# ----- Hijackers-siden
cart('hij.cart', 'Vogn foran Hijackers-spawnens vestudgang: dæk mod en SWAT-peek fra South Road', 29.4, 49.5, math.radians(90), L=3.0, W=1.3)
crates('hij.crates', 'Kasser foran nordudgangen (East Road): første dækning ved Hijackers-rykket mod Mid', 54.5, 40.6, 0.0, 1.5, 1.5, 1.5)
pier('south.gate.w', 'Portpille ved Mid South-udmundingen: peek-hjørne mod South Road', 3.4, 48.5, 0.9, 3.2)
barrels('south.barrels', 'Tønder på South Road: dækning for Hijackers der holder South Road', -12.0, 50.5, 0.0, nx=2, nz=1)
bench('spawn.bench', 'Bænk i SWAT-spawn: kun udsmykning langs væggen', -50.5, -45.9, 0.0)
# ----- sigtelinje-brydere: to 100 m lange rette linjer (South Road fra Hijackers-spawn; Mid ↔ Tower Stub) brydes af stenstøttepiller (contrafforti) der springer frem fra skiftevis nord-/sydvæg → en let S-kurve, skulder-peeks og ingen frie AWP-baner
def buttress(tid, why, x, z0, z1, side, d=1.8, w=1.0, h=3.6):
    ln = LineString([(x, z0), (x, z1)]).intersection(WALK)
    seg = max([g for g in ([ln] if ln.geom_type == 'LineString' else list(ln.geoms)) if g.geom_type == 'LineString'], key=lambda g: g.length)
    za, zb = sorted([seg.coords[0][1], seg.coords[-1][1]])
    zc = za + d / 2 if side < 0 else zb - d / 2
    return put_group(tid, why, 'pier', [(x, zc, lambda a, b: obox_poly(a, b, w, d, 0.0), h, dict(yaw=0.0, L=w, W=d, _kind='wall'), None)], snap=0.8, gap=0.4, wall=-0.04)
for k, (bx, sd) in enumerate(((-24.0, -1), (-8.0, 1), (6.0, -1), (22.0, 1))):
    buttress('south.butt%d' % k, 'Støttepille på South Road: bryder den 100 m lange sigtelinje fra Hijackers-spawn og giver et skulder-peek – skiftevis nord/syd giver en S-kurve', bx, 44.0, 58.0, sd)
for k, (bx, sd) in enumerate(((-31.5, -1), (-23.5, 1))):
    buttress('stub.butt%d' % k, 'Støttepille i Tower Stub: bryder den 97 m lange linje fra East Pocket gennem Mid til tårnet og giver et peek-hjørne', bx, 8.0, 18.0, sd)
print('[layout] taktiske elementer: %d · forskudt: %s' % (len(TACTICS), SHIFTED))
for f in FAILS: print('   MISLYKKEDES:', f)

# --------------------------------------------------------------------------- UDKIGSTÅRNET (A-site): dæk 3,2 m over gulvet med kamme og gitterhuller mod nord. Kan skyde ned på A og tilbage, men ikke hoppe ned.
TW = dict(x0=-47.6, x1=-34.4, z0=8.9, z1=16.9, deck=3.2, slab_z1=13.3, east_x0=-37.4, stair=(-42.2, 13.9, -37.4, 16.9))
boxes.append([TW['x0'], TW['z0'], TW['x1'], TW['slab_z1'], 2.9, 3.2, 'floor'])                     # nordligt dæk (undersiden = loft i stueetagen)
boxes.append([TW['east_x0'], TW['slab_z1'], TW['x1'], TW['z1'], 2.9, 3.2, 'floor'])                 # østblok (trappens afsats)
STAIRS = [[TW['stair'][0], TW['stair'][1], TW['stair'][2], TW['stair'][3], 'x', 0.0, TW['deck'], 17]]
RAILS = [[TW['x0'], TW['slab_z1'] - 0.05, TW['east_x0'], TW['slab_z1'], TW['deck'], 1.1]]           # dækkets sydkant mod trappehullet (1,1 m)
MERLONS = []; GRILLES = []
mw, gw = 1.3, 1.1; xx = TW['x0']; k = 0
while xx < TW['x1'] - 0.01:
    x1m = min(TW['x1'], xx + mw); MERLONS.append([round(xx, 3), TW['z0'], round(x1m, 3), TW['z0'] + 0.5]); boxes.append([round(xx, 3), TW['z0'], round(x1m, 3), round(TW['z0'] + 0.5, 3), TW['deck'], 5.6, 'wall'])
    xx = x1m
    if xx >= TW['x1'] - 0.01: break
    x1g = min(TW['x1'], xx + gw)
    if x1g - xx > 0.4: GRILLES.append([round(xx, 3), TW['z0'], round(x1g, 3), TW['z0'] + 0.1]); RAILS.append([round(xx, 3), TW['z0'] + 0.02, round(x1g, 3), TW['z0'] + 0.1, TW['deck'], 2.4])      # jerngitter: skud går igennem, spillere ikke
    xx = x1g
TW_RAIL_E = [TW['x1'] - 0.1, TW['slab_z1'], TW['x1'], TW['z1'], TW['deck'], 2.4]                    # østkanten af afsatsen mod Tower Stub (over indgangen)
RAILS.append(TW_RAIL_E)
RAILS.append([TW['x1'] - 0.1, TW['z0'] + 0.5, TW['x1'], TW['slab_z1'], TW['deck'], 2.4])
# ---------------------------------------------------------------------------  B-HALLEN (tinaiaen): tag (loft), galleri langs nordvæggen med trappe
HALL_RECT = sbox(24.0, -39.3, 56.5, -27.5)
HALL_G = HALL_RECT.intersection(WALK).buffer(0)
for g in polys_of(HALL_G): add_prisms(g, 5.4, 5.75, 'ceil')
GAL = dict(x0=29.0, x1=53.0, z0=-39.2, z1=-36.9, y=2.7, sx0=24.0, sx1=29.0)
boxes.append([GAL['x0'], GAL['z0'], GAL['x1'], GAL['z1'], GAL['y'] - 0.3, GAL['y'], 'floor'])
STAIRS.append([GAL['sx0'], GAL['z0'], GAL['sx1'], GAL['z1'], 'x', 0.0, GAL['y'], 15])
for px in (30.0, 36.0, 42.0, 48.0, 52.8): boxes.append([round(px - 0.17, 3), -37.25, round(px + 0.17, 3), -36.92, 0.0, GAL['y'] - 0.3, 'wall'])
RAILS.append([GAL['x0'], GAL['z1'] - 0.05, GAL['x1'], GAL['z1'], GAL['y'], 1.0]); RAILS.append([GAL['x1'] - 0.05, GAL['z0'], GAL['x1'], GAL['z1'], GAL['y'], 1.0])
RAILS.append([GAL['sx0'], GAL['z1'] - 0.05, GAL['sx1'], GAL['z1'], GAL['y'] * 0.55, 1.0])
HALL = dict(rect=[24.0, -39.3, 56.5, -27.5], eave=5.4, wall_t=1.5, ridge_h=2.5)
# kasser/stakke i hallen gemmes allerede i DRESS; kollisionen er lagt ovenfor

# --------------------------------------------------------------------------- træer og planter (blot udsmykning: stå på øernes toppe og uden for murene – ingen kollision; i gangene kun platantræer med stamme)
SCEN = []
ext_ring = LineString(list(WALK.exterior.coords))
rr = random.Random(77)
n_cyp = 0
for dist in (0.0,):
    L = ext_ring.length; t = 0.0
    while t < L:
        p = ext_ring.interpolate(t); q = ext_ring.interpolate(min(L, t + 0.5)); d = (q.x - p.x, q.y - p.y); ln = math.hypot(*d) or 1.0; nrm = (d[1] / ln, -d[0] / ln)
        for sgn in (1, -1):
            cx, cz = p.x + nrm[0] * sgn * rr.uniform(4.5, 7.5), p.y + nrm[1] * sgn * rr.uniform(4.5, 7.5)
            if WALK.buffer(5.2).contains(Point(cx, cz)) or WALK.buffer(-0.1).contains(Point(cx, cz)): continue
            if any(math.hypot(cx - s['x'], cz - s['z']) < 3.0 for s in SCEN[-30:]): continue
            SCEN.append(dict(t='cypress', x=round(cx, 2), z=round(cz, 2), y=-0.2, h=round(rr.uniform(8, 13), 1), seed=len(SCEN) + 1)); n_cyp += 1
        t += rr.uniform(3.5, 6.5)
SCEN = SCEN[::1]
# olivenlund (ø 7: terrasse) og vinmark (ø 0) + cypresser i haven (ø 8)
def scatter(poly, step, jitter, fn):
    x0, z0, x1, z1 = poly.bounds
    for gx in np.arange(x0, x1, step):
        for gz in np.arange(z0, z1, step):
            x, z = gx + rr.uniform(-jitter, jitter), gz + rr.uniform(-jitter, jitter)
            if poly.contains(Point(x, z)): fn(x, z)
ISL = {i: HOLES[i] for i in range(len(HOLES))}
scatter(ISL[7].buffer(-2.4), 4.2, 1.0, lambda x, z: SCEN.append(dict(t='olive', x=round(x, 2), z=round(z, 2), y=3.4, h=round(rr.uniform(3.4, 4.6), 1), seed=len(SCEN) + 1)))
scatter(ISL[8].buffer(-2.5), 4.5, 0.8, lambda x, z: SCEN.append(dict(t='cypress', x=round(x, 2), z=round(z, 2), y=3.8, h=round(rr.uniform(8, 10.5), 1), seed=len(SCEN) + 1)))
VINE = dict(poly=[[round(a, 2), round(b, 2)] for a, b in list(ISL[0].buffer(-2.2).exterior.coords)], y=3.4, rows_dir=0.0, gap=2.4)
print('[layout] kulisse: %d træer · vinmark ø0 %.0f m²' % (len(SCEN), ISL[0].area))

# --------------------------------------------------------------------------- spil-data (shared/fattoria_data.js)
labels = [[n, round(M(x, y)[0], 2), round(M(x, y)[1], 2), 0.0] for (n, x, y) in LABELS]
labels += [['A', round((SITES['A'][0] + SITES['A'][2]) / 2, 2), round((SITES['A'][1] + SITES['A'][3]) / 2, 2), 0.0], ['B', round((SITES['B'][0] + SITES['B'][2]) / 2, 2), round((SITES['B'][1] + SITES['B'][3]) / 2, 2), 0.0],
           ['Tower Deck', round((TW['x0'] + TW['x1']) / 2, 2), round((TW['z0'] + TW['slab_z1']) / 2, 2), TW['deck']], ['B Gallery', round((GAL['x0'] + GAL['x1']) / 2, 2), round((GAL['z0'] + GAL['z1']) / 2, 2), GAL['y']]]
GX0, GZ0 = int(math.floor(X0W - 6)), int(math.floor(Z0W - 6)); GW = int(math.ceil((X1W + 6 - GX0) / 2)) + 1; GH = int(math.ceil((Z1W + 6 - GZ0) / 2)) + 1
SURFN = {'SWAT Spawn': 'stone', 'Spawn Exit': 'dirt', 'A Diag': 'dirt', 'Villa Lane': 'dirt', 'Upper Hall': 'stone', 'Hall East': 'stone', 'Loggia Loop': 'stone', 'A Long': 'dirt', 'A Site': 'stone', 'A South': 'dirt',
         'A Connector': 'dirt', 'Tower': 'stone', 'Tower Stub': 'dirt', 'West Loop': 'dirt', 'Tower Steps': 'dirt', 'Mid Door': 'stone', 'Mid': 'stone', 'Mid North': 'dirt', 'B Link': 'dirt', 'B Mouth': 'dirt',
         'B Hall': 'stone', 'East Pocket': 'dirt', 'East Road': 'dirt', 'Mid South': 'dirt', 'South Road': 'dirt', 'Hijackers Spawn': 'dirt', 'Orchard Road': 'dirt', 'B Approach': 'dirt', 'Tower Deck': 'stone', 'B Gallery': 'wood'}
D = {'version': '2', 'grid': {'GX0': GX0, 'GZ0': GZ0, 'GW': GW, 'GH': GH}, 'boxes': boxes, 'prisms': prisms, 'ramps': [], 'stairs': STAIRS, 'rails': [[r[0], r[1], r[2], r[3], r[4], r[5]] for r in RAILS],
     'cyls': [], 'doors': [], 'ladders': [], 'labels': labels,
     'sites': {k: [v[0], v[1], v[2], v[3], 0.0] for k, v in SITES.items()},
     'spawns': {'hij': [[p[0], p[1], 0.0, 0.0] for p in SPAWN_HIJ], 'swat': [[p[0], p[1], math.pi, 0.0] for p in SPAWN_SWAT]},
     'levels': {'G': 0.0}, 'water': [], 'surf': SURFN, 'panes': []}
txt = ('/* AUTOGENERERET af tools/fattoria/gen/layout.py – redigér ikke i hånden.\n   fattoria: toscansk vingård i den gyldne time, layout efter brugerens plantegning. Kollision = kasser + skrå prismer. */\n'
       '(function (root) {\n  const D = ' + json.dumps(D, ensure_ascii=False, separators=(',', ':')) + ';\n'
       "  if (typeof module === 'object' && module.exports) module.exports = D; else root.WD_FATTORIA = D;\n})(typeof self !== 'undefined' ? self : this);\n")
open(os.path.join(ROOT, 'shared', 'fattoria_data.js'), 'w').write(txt)
print('[layout] prismer %d · bokse %d · trapper %d · rækværk %d · %.0f KB' % (len(prisms), len(boxes), len(STAIRS), len(RAILS), len(txt) / 1e3))

# --------------------------------------------------------------------------- terræn til Blender: konvekse stykker (≤ 1,5 m felter) pr. overflade
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
GROUND = []; later = None; surf_regions = []
for k in range(len(SURF) - 1, -1, -1):
    m, g = SURF[k]; g = g.intersection(WALK)
    r = g if later is None else g.difference(later)
    surf_regions.append((m, r)); later = g if later is None else unary_union([later, g])
surf_regions.reverse()
for m, r in surf_regions: pieces_grid(r.buffer(0), GROUND, m, 0.0)
# overgange mellem overfladetyper (stenlister)
TH = []
for m, r in surf_regions[1:]:
    b = r.boundary.intersection(WALK.buffer(-0.05))
    for ls in ([b] if b.geom_type == 'LineString' else list(getattr(b, 'geoms', []))):
        if ls.geom_type != 'LineString' or ls.length < 1.5: continue
        cs = list(ls.coords)
        for a, c2 in zip(cs[:-1], cs[1:]):
            if math.hypot(c2[0] - a[0], c2[1] - a[1]) > 0.3: TH.append([round(a[0], 3), round(a[1], 3), round(c2[0], 3), round(c2[1], 3)])

# --------------------------------------------------------------------------- QA-punkter: frie prøvepunkter + sonder mod kollisionsflader (Blender-QA: ingen usynlige hitbokse / ingen synlige genstande uden kollision)
try:
    _obst = unary_union([g for g in OBST_G] + [sbox(*b[:4]) for b in boxes if b[6] in ('wall', 'floor') and b[4] < 0.5] + [sbox(TW['stair'][0] - 0.2, TW['stair'][1] - 0.2, TW['stair'][2] + 0.2, TW['stair'][3] + 0.2), sbox(GAL['sx0'] - 0.2, GAL['z0'], GAL['sx1'], GAL['z1'] + 0.2)])
    _free = WALK.buffer(-0.62).difference(_obst.buffer(0.5)); FREE = []
    for gx in np.arange(X0W, X1W, 0.7):
        for gz in np.arange(Z0W, Z1W, 0.7):
            if _free.contains(Point(gx, gz)): FREE.append([round(float(gx), 2), round(float(gz), 2)])
    PROBES = []
    def perim(poly, ymid, kind):
        ring = list(poly.exterior.coords)
        for a, b in zip(ring[:-1], ring[1:]):
            L = math.hypot(b[0] - a[0], b[1] - a[1])
            if L < 0.2: continue
            nx, nz = (b[1] - a[1]) / L, -(b[0] - a[0]) / L
            mid = Point((a[0] + b[0]) / 2 + nx * 0.2, (a[1] + b[1]) / 2 + nz * 0.2)
            if poly.contains(mid): nx, nz = -nx, -nz
            for t in np.arange(0.4, L, 0.9) if L > 0.8 else [L / 2]:
                x, z = a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L
                if WALK.buffer(-0.1).contains(Point(x + nx * 0.3, z + nz * 0.3)): PROBES.append([round(x, 2), round(z, 2), round(nx, 3), round(nz, 3), ymid, kind])
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
    x, z = M(px_, py_); p = Point(x, z); best = None
    for a in range(0, 360, 15):
        d = (math.cos(math.radians(a)), math.sin(math.radians(a))); ln = LineString([(x, z), (x + d[0] * 40, z + d[1] * 40)]).intersection(WALK)
        seg = ln if ln.geom_type == 'LineString' else (min(ln.geoms, key=lambda g: g.distance(p)) if hasattr(ln, 'geoms') and len(ln.geoms) else None)
        if seg is None or seg.is_empty: continue
        L = seg.length
        if best is None or L > best[0]: best = (L, d)
    if best:
        d = best[1]; TOUR.append(dict(n=n_, x=round(x, 2), z=round(z, 2), look=[round(x + d[0] * 6, 2), round(z + d[1] * 6, 2)]))
json.dump(TOUR, open(os.path.join(OUT, 'tour.json'), 'w'))

# --------------------------------------------------------------------------- designdata til Blender
def ringcoords(g): return [[round(x, 3), round(z, 3)] for x, z in g]
design = dict(ground=GROUND, thresholds=TH, walk=dict(ext=ringcoords(list(WALK.exterior.coords)), holes=[ringcoords(list(h.coords)) for h in WALK.interiors]),
              lots=[dict(front=[[round(x, 3), round(z, 3)] for x, z in l.front], nout=[round(l.nout[0], 4), round(l.nout[1], 4)], dir=[round(l.dir[0], 5), round(l.dir[1], 5)], he=round(l.he, 3), top=round(l.top, 3), style=l.style, floors=l.floors,
                         first=l.first, last=l.last, ring=l.ring, edge=l.edge, L=round(l.L, 3), smax=round(l.smax, 3), rp=l.rp, island=l.island, quad=[[round(x, 3), round(z, 3)] for x, z in l.quad],
                         pieces=[[[round(x, 3), round(z, 3)] for x, z in pc] for pc in l.pieces]) for l in LOTS if l.pieces],
              seams=SEAMS, fills=[dict(ring=[[round(a, 3), round(b, 3)] for a, b in pc], y=f['y'], island=f['island'], style=f['style']) for f in FILLS for g in polys_of(f['poly']) for pc in convex_pieces(g)],
              dress=DRESS, scen=SCEN, vine=VINE, tower=dict(TW, merlons=MERLONS, grilles=GRILLES, stair=list(TW['stair'])), hall=HALL, gallery=GAL,
              rails=[[r[0], r[1], r[2], r[3], r[4], r[5]] for r in RAILS], sites=SITES, spawns=dict(hij=SPAWN_HIJ, swat=SPAWN_SWAT), labels=labels, tactics=TACTICS, islands={str(i): dict(style=ISLAND_STYLE[i], area=round(HOLES[i].area, 1)) for i in range(len(HOLES))})
json.dump(design, open(os.path.join(OUT, 'fattoria_design.json'), 'w'), separators=(',', ':'))

# --------------------------------------------------------------------------- oversigt (PNG): gange, parceller, props, sites, spawns, tårn, hal
Z = 9
def P2(x, z): return ((x - X0W + 6) * Z, (z - Z0W + 6) * Z)
img = Image.new('RGB', (int((X1W - X0W + 12) * Z), int((Z1W - Z0W + 12) * Z)), (28, 30, 36)); dr = ImageDraw.Draw(img)
STYC = {'villa': (176, 120, 96), 'casa': (170, 130, 100), 'casetta': (186, 150, 110), 'fienile': (150, 130, 100), 'swall': (110, 110, 104), 'terrace': (110, 130, 80), 'hedge': (50, 110, 60), 'hallwall': (140, 100, 80), 'twall': (130, 130, 140)}
for l in LOTS:
    for pc in l.pieces: dr.polygon([P2(*q) for q in pc], fill=STYC.get(l.style, (120, 120, 120)), outline=(15, 15, 15))
for f in FILLS: dr.polygon([P2(*q) for q in f['poly'].exterior.coords], fill=(80, 90, 70))
for p in polys_of(WALK):
    for h in p.interiors: pass
SC = {'ft_gravel': (205, 190, 150), 'ft_cobble': (176, 170, 156), 'ft_cobble2': (160, 156, 146), 'ft_brickf': (165, 100, 84), 'ft_terra': (190, 120, 80)}
for m, g in SURF:
    for p in polys_of(g.intersection(WALK)):
        dr.polygon([P2(*q) for q in p.exterior.coords], fill=SC.get(m, (200, 190, 150)))
        for h in p.interiors: dr.polygon([P2(*q) for q in h.coords], fill=(28, 30, 36))
for k, (a, b, c, d) in SITES.items(): dr.rectangle([P2(a, b), P2(c, d)], outline=(255, 60, 60), width=2)
for it in DRESS:
    cc = {'well': (60, 120, 220), 'fountain': (60, 160, 230), 'cart': (160, 110, 60), 'crates': (200, 160, 80), 'lowwall': (120, 120, 120), 'pier': (240, 240, 240), 'barrel': (150, 90, 40), 'tun': (110, 60, 30), 'press': (180, 60, 60), 'trough': (100, 150, 170), 'planter': (60, 190, 90), 'bench': (200, 200, 120), 'tree': (30, 150, 50)}.get(it['t'], (255, 0, 255))
    x, y = P2(it['x'], it['z']); r = max(3, it.get('r', 0.5) * Z) if it['t'] in ('well', 'fountain', 'tun', 'barrel', 'tree') else 4
    if 'L' in it: 
        pgn = obox_poly(it['x'], it['z'], it['L'], it['W'], it['yaw']); dr.polygon([P2(*q) for q in pgn.exterior.coords], fill=cc, outline=(0, 0, 0))
    else: dr.ellipse((x - r, y - r, x + r, y + r), fill=cc, outline=(0, 0, 0))
dr.rectangle([P2(TW['x0'], TW['z0']), P2(TW['x1'], TW['slab_z1'])], outline=(80, 200, 255), width=2); dr.rectangle([P2(GAL['x0'], GAL['z0']), P2(GAL['x1'], GAL['z1'])], outline=(255, 255, 0), width=2)
for sp, col in ((SPAWN_HIJ, (255, 190, 40)), (SPAWN_SWAT, (80, 160, 255))):
    for q in sp: x, y = P2(*q); dr.ellipse((x - 4, y - 4, x + 4, y + 4), fill=col)
try: fnt = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 14)
except Exception: fnt = None
for n, x, z, y in labels: dr.text(P2(x, z), n, fill=(255, 255, 255), font=fnt)
img.save(os.path.join(OUT, 'fattoria_layout.png'))
