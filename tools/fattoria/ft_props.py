# ==========================================================================
# de_fattoria · rekvisitter: tønder (stav-opbyggede, med jernbånd), fødertønder, vogne, kasser, bænke, krukker/plantekasser (CC0-modeller), brønd, fontæne med marmorbassin og
# vand, bogreoler, vinreoler med flasker, hø og bokse i stalden. Kollisionen kommer fra layoutet (props/cyls); her tegnes kun det visuelle ovenpå samme mål.
# ==========================================================================
import math, random
from ft_geo import *
from ft_common import hash2
import ft_models
from ft_plants import tube, bush, card, V3
from bld.common import MATS

def barrel(M, x, y0, z, r, h, axis='y', mat='ft_timber', n=14, hoops=4, bulge=0.12):
    """stav-tønde: n sider, buet profil (maks. radius i midten), jernbånd. axis 'y' = stående, 'x'/'z' = liggende (lukker i enderne)"""
    prof = []
    for k in range(9):
        t = k / 8; rr = r * (1 - bulge * (2 * t - 1) ** 2) if True else r; prof.append((y0 + h * t, rr * (1 + bulge * 0.5)))
    with M.part():
        for k in range(8):
            (ya, ra), (yb, rb) = prof[k], prof[k + 1]
            for i in range(n):
                a0 = 2 * math.pi * i / n; a1 = 2 * math.pi * (i + 1) / n; am = (a0 + a1) / 2
                if axis == 'y': P = lambda a, rr, yy: (x + math.cos(a) * rr, yy, z + math.sin(a) * rr)
                elif axis == 'x': P = lambda a, rr, yy: (x + (yy - y0) - h / 2, y0 + r + math.cos(a) * rr, z + math.sin(a) * rr)
                else: P = lambda a, rr, yy: (x + math.cos(a) * rr, y0 + r + math.sin(a) * rr, z + (yy - y0) - h / 2)
                q = [P(a0, ra, ya), P(a1, ra, ya), P(a1, rb, yb), P(a0, rb, yb)]
                c = P(am, (ra + rb) / 2, (ya + yb) / 2); cc = P(0, 0, (ya + yb) / 2)
                M.poly(q, mat, uv=[(i / n * 2, ya / 1.6), ((i + 1) / n * 2, ya / 1.6), ((i + 1) / n * 2, yb / 1.6), (i / n * 2, yb / 1.6)], want=(c[0] - cc[0], c[1] - cc[1], c[2] - cc[2]), smooth=True, col=[(0.2, 0, 0, 1)] * 4)
        for end in (0, 8):
            ye, re = prof[end]
            pts = [(x + math.cos(2 * math.pi * i / n) * re, ye, z + math.sin(2 * math.pi * i / n) * re) for i in range(n)] if axis == 'y' else None
            if axis == 'y': M.poly(pts, mat, want=(0, -1 if end == 0 else 1, 0), col=[(0.2, 0, 0, 1)] * n)
            elif axis == 'x':
                pts = [(x + (ye - y0) - h / 2, y0 + r + math.cos(2 * math.pi * i / n) * re, z + math.sin(2 * math.pi * i / n) * re) for i in range(n)]; M.poly(pts, mat, want=(-1 if end == 0 else 1, 0, 0), col=[(0.2, 0, 0, 1)] * n)
            else:
                pts = [(x + math.cos(2 * math.pi * i / n) * re, y0 + r + math.sin(2 * math.pi * i / n) * re, z + (ye - y0) - h / 2) for i in range(n)]; M.poly(pts, mat, want=(0, 0, -1 if end == 0 else 1), col=[(0.2, 0, 0, 1)] * n)
    for k in range(hoops):                                                        # jernbånd
        t = (k + 0.7) / (hoops + 0.4); yy = y0 + h * t; rr = r * (1 - bulge * (2 * t - 1) ** 2) * (1 + bulge * 0.5) + 0.012
        if axis == 'y': cyl(M, x, z, rr, yy - 0.035, yy + 0.035, 'ft_iron', n=n, caps='')
        elif axis == 'x': hcyl(M, (x + (yy - y0) - h / 2 - 0.035, y0 + r, z), (x + (yy - y0) - h / 2 + 0.035, y0 + r, z), rr, 'ft_iron', n=n, caps='')
        else: hcyl(M, (x, y0 + r, z + (yy - y0) - h / 2 - 0.035), (x, y0 + r, z + (yy - y0) - h / 2 + 0.035), rr, 'ft_iron', n=n, caps='')

def fit(M_name, mid, x, z, y, w, d, h, yaw=0.0, mirror=False):
    """sætter en CC0-model så den fylder (w × d × h) – skaleret ensartet efter højden (eller bredden)"""
    L = ft_models.model_obj(mid)
    if not L: return None
    ob0, mnz, mxz, bb = L; hh = (mxz - mnz) or 1.0
    s = h / hh if h else 1.0
    return ft_models.place(mid, x, y, z, yaw, s)

def cart(M, x, z, y0, w, d, yaw=0.0):
    """tovejs trævogn (rammer, bund, sider, to hjul, trækstang)"""
    fr = Fr((x, z), (math.cos(yaw), math.sin(yaw)), (-math.sin(yaw), math.cos(yaw)))
    L = w * 0.62; hw = d * 0.34
    obox(M, fr, -L / 2, L / 2, -hw, hw, y0 + 0.62, y0 + 0.7, 'ft_beam')                                      # bund
    for sgn in (-1, 1): obox(M, fr, -L / 2, L / 2, sgn * hw - 0.04 + (0.04 if sgn < 0 else 0), sgn * hw + 0.04 + (-0.04 if sgn > 0 else 0), y0 + 0.7, y0 + 1.2, 'ft_timber')
    obox(M, fr, -L / 2 - 0.04, -L / 2 + 0.04, -hw, hw, y0 + 0.7, y0 + 1.2, 'ft_timber'); obox(M, fr, L / 2 - 0.04, L / 2 + 0.04, -hw, hw, y0 + 0.7, y0 + 1.2, 'ft_timber')
    obox(M, fr, -0.1, 0.1, -hw - 0.05, hw + 0.05, y0 + 0.5, y0 + 0.64, 'ft_beam')                           # aksel
    for sgn in (-1, 1):
        p0 = fr.P(0, sgn * (hw + 0.14), y0 + 0.6); p1 = fr.P(0, sgn * (hw + 0.2), y0 + 0.6)
        hcyl(M, (p0[0], p0[1], p0[2] - 0.0), (p0[0] + fr.n[0] * sgn * 0.08, p0[1], p0[2] + fr.n[1] * sgn * 0.08), 0.6, 'ft_timber', n=12, caps='ab')
    obox(M, fr, L / 2, L / 2 + 1.3, -0.06, 0.06, y0 + 0.5, y0 + 0.6, 'ft_beam')                              # trækstang
    # hø/kasser på vognen
    obox(M, fr, -L / 2 + 0.1, 0.2, -hw + 0.1, hw - 0.1, y0 + 0.7, y0 + 1.1, 'ft_straw')

def bale(M, x, z, y0, w, d, h, yaw=0.0):
    fr = Fr((x, z), (math.cos(yaw), math.sin(yaw)), (-math.sin(yaw), math.cos(yaw)))
    obox(M, fr, -w / 2, w / 2, -d / 2, d / 2, y0, y0 + h, 'ft_straw')
    for a in (-w / 4, w / 4): obox(M, fr, a - 0.015, a + 0.015, -d / 2 - 0.01, d / 2 + 0.01, y0, y0 + h + 0.01, 'ft_rope') if False else None

def bookshelf(M, x, z, y0, w, d, h, rnd):
    fr = Fr((x - w / 2, z), (1, 0), (0, 1 if z > -29 else -1)) if False else None
    # to tværbrædder + hylder (langs x) med bøger
    obox_ = lambda *a, **k: M.box(*a, **k)
    x0, x1, z0, z1 = x - w / 2, x + w / 2, z - d / 2, z + d / 2
    M.box(x0, y0, z0, x1, y0 + 0.08, z1, 'ft_timber'); M.box(x0, y0 + h - 0.08, z0, x1, y0 + h, z1, 'ft_timber')
    for xx in (x0, x1 - 0.06): M.box(xx, y0, z0, xx + 0.06, y0 + h, z1, 'ft_timber')
    M.box(x0, y0, z1 - 0.03, x1, y0 + h, z1, 'ft_timber'); M.box(x0, y0, z0, x1, y0 + h, z0 + 0.03, 'ft_timber')
    shelves = 5
    for s_ in range(1, shelves):
        yy = y0 + h * s_ / shelves; M.box(x0 + 0.06, yy, z0, x1 - 0.06, yy + 0.04, z1, 'ft_timber')
    for s_ in range(shelves):
        yb = y0 + 0.08 + h * s_ / shelves if s_ else y0 + 0.08; yb = y0 + (h * s_ / shelves) + (0.08 if s_ == 0 else 0.04); xx = x0 + 0.1
        while xx < x1 - 0.14:
            bw = rnd.uniform(0.03, 0.07); bh = rnd.uniform(0.2, 0.3) * (h / shelves / 0.45); bh = min(bh, h / shelves - 0.07)
            M.box(xx, yb, z0 + 0.08, xx + bw, yb + bh, z1 - 0.08, 'ft_book%d' % rnd.randrange(6)); xx += bw + 0.002
            if rnd.random() < 0.07: xx += rnd.uniform(0.1, 0.25)

def wine_rack(M, x, z, y0, w, d, h, rnd, along='x'):
    x0, x1, z0, z1 = x - w / 2, x + w / 2, z - d / 2, z + d / 2
    M.box(x0, y0, z0, x1, y0 + 0.06, z1, 'ft_timber'); M.box(x0, y0 + h - 0.06, z0, x1, y0 + h, z1, 'ft_timber')
    L = w if along == 'x' else d; k = int(L / 0.3)
    rows = 5
    for q in range(k + 1):
        t = x0 + L * q / max(1, k) if along == 'x' else z0 + L * q / max(1, k)
        if along == 'x': M.box(t - 0.02, y0, z0, t + 0.02, y0 + h, z1, 'ft_timber')
        else: M.box(x0, y0, t - 0.02, x1, y0 + h, t + 0.02, 'ft_timber')
    for r_ in range(rows):
        yy = y0 + 0.18 + r_ * (h - 0.3) / rows
        for q in range(k):
            if rnd.random() < 0.12: continue
            t = (x0 + L * (q + 0.5) / k) if along == 'x' else (z0 + L * (q + 0.5) / k)
            if along == 'x': hcyl(M, (t, yy, z0 + 0.04), (t, yy, z1 - 0.04), 0.045, 'ft_wine', n=7, caps='ab')
            else: hcyl(M, (x0 + 0.04, yy, t), (x1 - 0.04, yy, t), 0.045, 'ft_wine', n=7, caps='ab')

def fountain(D, S, x, z, y0, r):
    M = S['props']; W = S['water']
    cyl(M, x, z, r, y0, y0 + 0.5, 'ft_marble_w', n=16, caps='b')                                   # ydre bassinvæg
    cyl(M, x, z, r - 0.25, y0 + 0.5, y0 + 0.62, 'ft_marble_w', n=16, caps='t')                      # kantsten (top)
    ring = [(x + math.cos(2 * math.pi * k / 16) * (r - 0.25), y0 + 0.62, z + math.sin(2 * math.pi * k / 16) * (r - 0.25)) for k in range(16)]
    # vandet ligger i bassinet (0,12 under kanten)
    W.poly([(x + math.cos(2 * math.pi * k / 24) * (r - 0.3), y0 + 0.46, z + math.sin(2 * math.pi * k / 24) * (r - 0.3)) for k in range(24)], 'water', want=(0, 1, 0))
    cyl(M, x, z, 0.55, y0 + 0.2, y0 + 0.9, 'ft_marble_w', n=12, caps='t'); cyl(M, x, z, 0.28, y0 + 0.9, y0 + 1.7, 'ft_marble_w', n=10, caps='')
    cyl(M, x, z, 0.85, y0 + 1.7, y0 + 1.85, 'ft_marble_w', n=14, caps='tb')                       # øvre skål
    W.poly([(x + math.cos(2 * math.pi * k / 20) * 0.75, y0 + 1.84, z + math.sin(2 * math.pi * k / 20) * 0.75) for k in range(20)], 'water', want=(0, 1, 0))
    cyl(M, x, z, 0.14, y0 + 1.85, y0 + 2.35, 'ft_marble_w', n=8, caps='t')
    ft_models.place('marble_bust_01', x, y0 + 2.35, z, 0, 0.9) if False else None

def well(D, S, x, z, y0, r):
    M = S['props']; T = S['trim']
    cyl(M, x, z, r, y0, y0 + 0.95, 'ft_stone', n=14, caps='t'); cyl(M, x, z, r - 0.25, y0 + 0.95, y0 + 0.98, 'ft_pane', n=14, caps='t')
    for sgn in (-1, 1): T.box(x + sgn * (r - 0.12) - 0.07, y0 + 0.9, z - 0.07, x + sgn * (r - 0.12) + 0.07, y0 + 2.5, z + 0.07, 'ft_timber')
    T.box(x - r, y0 + 2.45, z - 0.08, x + r, y0 + 2.6, z + 0.08, 'ft_timber')
    for sgn in (-1, 1): S['far'].poly([(x - r - 0.2, y0 + 2.5, z + sgn * 0.0), (x + r + 0.2, y0 + 2.5, z + sgn * 0.0), (x + r + 0.2, y0 + 3.0, z + sgn * 0.0)], 'ft_roof') if False else None
    hcyl(M, (x - r + 0.15, y0 + 2.2, z), (x + r - 0.15, y0 + 2.2, z), 0.06, 'ft_timber', n=6, caps='ab')

STYLE_PROP = {}

def build(D, S):
    M = S['props']; T = S['trim']; G = S['G']; L = D['levels']
    ft_models.coll if False else None
    for (x, z, w, d, h, y0, st) in D['props']:
        rnd = random.Random(int(hash2(x * 3.3, z * 1.9) * 1e6)); yaw = 0.0 if w >= d else math.pi / 2
        if st == 'cart': cart(M, x, z, y0, w if w >= d else d, d if w >= d else w, 0.0 if w >= d else math.pi / 2)
        elif st in ('crates', 'crate'):
            n = 3 if st == 'crates' and w > 1.6 else 1
            for k in range(n):
                ob = fit('crate', rnd.choice(['wooden_crate_01', 'wooden_crate_02']), x + (k - (n - 1) / 2) * 0.95 * (1 if w >= d else 0), z + (k - (n - 1) / 2) * 0.95 * (0 if w >= d else 1), y0, 0.9, 0.9, 0.62, yaw=rnd.uniform(-8, 8))
                if k == 1 and ob: fit('crate', 'wooden_crate_01', x, z, y0 + 0.62, 0.9, 0.9, 0.62, yaw=rnd.uniform(0, 30))
        elif st in ('barrels', 'barrels_stack'):
            n = 2 if st == 'barrels' else max(2, int(max(w, d) / 0.9))
            for k in range(n):
                dx = (k - (n - 1) / 2) * 0.9 * (1 if w >= d else 0); dz = (k - (n - 1) / 2) * 0.9 * (0 if w >= d else 1)
                barrel(M, x + dx, y0, z + dz, 0.4, 1.0, 'y', 'ft_timber', 12, 3)
        elif st == 'barrel_side': barrel(M, x, y0, z, 0.45, w if w >= d else d, 'x' if w >= d else 'z', 'ft_timber', 12, 4)
        elif st == 'planter':
            ft_models.place('planter_pot_clay', x, y0, z, 0, 1.15) if False else None
            fit('pot', rnd.choice(['planter_box_01', 'planter_box_02', 'planter_box_03']), x, z, y0, w, d, 0.62, yaw=0 if w >= d else 90)
            bush(S['fol'], x, z, y0 + 0.5, rnd, r=0.55, mat=rnd.choice(['fol_lavender', 'fol_oleander', 'fol_rose', 'fol_shrub']), n=9)
        elif st == 'bench': fit('bench', 'painted_wooden_bench', x, z, y0, w, d, 0.9, yaw=0 if w >= d else 90)
        elif st == 'hedge': M.box(x - w / 2, y0, z - d / 2, x + w / 2, y0 + h, z + d / 2, 'ft_hedge')
        elif st == 'stall':
            fr = Fr((x - w / 2, z), (1, 0), (0, 1))
            for k in range(5): obox(M, fr, k * w / 4 - 0.05, k * w / 4 + 0.05, -0.12, 0.12, y0, y0 + 1.7, 'ft_beam')
            obox(M, fr, 0, w, -0.1, 0.1, y0 + 1.1, y0 + 1.5, 'ft_timber'); obox(M, fr, 0, w, -0.1, 0.1, y0 + 0.3, y0 + 0.7, 'ft_timber')
        elif st == 'hay':
            bale(M, x, z, y0, w, d, h * 0.55); bale(M, x + 0.05, z, y0 + h * 0.55, w * 0.9, d * 0.9, h * 0.45, 0.2)
        elif st == 'shelf': bookshelf(M, x, z, y0, w, d, h, rnd)
        elif st == 'table':
            fit('table', 'WoodenTable_01', x, z, y0, w, d, h, yaw=0)
            for k in (-0.55, 0.55): fit('chair', 'WoodenChair_01', x + k, z + (0.9 if True else 0), y0, 0.5, 0.5, 0.9, yaw=180); fit('chair', 'WoodenChair_01', x + k, z - 0.9, y0, 0.5, 0.5, 0.9, yaw=0)
        elif st == 'rack': wine_rack(M, x, z, y0, w, d, h, rnd, 'x' if w >= d else 'z')
    for (x, z, r, y0, y1, st) in D['cyls']:
        rnd = random.Random(int(hash2(x * 3.3, z * 1.9) * 1e6))
        if st == 'barrel': barrel(M, x, y0, z, r * 0.95, y1 - y0, 'y', 'ft_timber', 12, 3)
        elif st == 'foudre':
            barrel(M, x, y0, z, r * 0.98, (y1 - y0) - 0.15, 'y', 'ft_timber', 20, 6, bulge=0.1)
            T.box(x - 0.45, y0 + 1.0, z - r - 0.04, x + 0.45, y0 + 2.0, z - r + 0.14, 'ft_beam')                      # lille dør/hane-plade
            hcyl(T, (x, y0 + 0.8, z - r - 0.0), (x, y0 + 0.8, z - r - 0.45), 0.07, 'ft_brass', n=8, caps='b')
        elif st == 'fountain': fountain(D, S, x, z, y0, r)
        elif st == 'well': well(D, S, x, z, y0, r)
    # CT-/T-spawn-detaljer og andre faste CC0-dekorationer (ft_dress)
