# ==========================================================================
# de_niseko · arkitektur: facader (gamle japanske byhuse: machiya, butikker, værtshuse, kura, helligdom, havemure) og tage (fælles tagprofil, nk_roof.py).
#   Alt er bundet til gangenes omrids: facaden ligger PRÆCIS i kollisionsfladen (w = 0); fremspring på jordniveau ≤ 0,12 m (stolper, gitre), udhæng/lanterner over hovedhøjde.
#   Objekter: walls (lysmap) · detail_trim (vertex-lys: tømmer, gitre, skærme) · detail_far (vertex-lys: tegl)
# ==========================================================================
import math, random
from nk_geo import *
from nk_roof import roof_y
from nk_common import blend_at, hash2

PLASTER = {'machiya': 'nk_plaster_w', 'shop': 'nk_plaster_o', 'inn': 'nk_plaster_g', 'house1': 'nk_plaster_o', 'wall': 'nk_plaster_w', 'kura': 'nk_plaster_w', 'shrine': 'nk_plaster_w'}
LIGHTS = []                                       # (x, y, z, kind, power)
DOORS_LOG = []

def facade(l, S, rnd):
    p0, p1 = l['front']; u = l['dir']; n = l['nout']; L = l['L']; fr = Fr(p0, u, n)
    he = l['he']; rp = l['rp']; style = l['style']; floors = l['floors']
    wall_top = he + rp['pitch'] * rp['over']
    uoff = rnd.uniform(0, 7.0); first, last = l['first'], l['last']
    W, T = S['walls'], S['trim']
    if style == 'hedge':                                           # klippet hæk på lav stensokkel (havemur) – intet fremspring
        vquad(W, fr, 0, L, 0, 0, 0.45, 'nk_stonebase', uoff)
        pts_col = [fr.P(0, 0, 0.45), fr.P(L, 0, 0.45), fr.P(L, 0, he), fr.P(0, 0, he)]
        vquad(W, fr, 0, L, 0, 0.45, he, 'nk_hedge', uoff, col=[blend_at(p_, 0.0) for p_ in pts_col])
        return
    base_h = 0.55 if style not in ('kura', 'wall') else (1.1 if style == 'kura' else 0.8)
    floor_h = 3.05 if floors == 2 else None
    pm = PLASTER.get(style, 'nk_plaster_w')
    # ---- sokkel (sten) og mur
    vquad(W, fr, 0, L, 0, 0, base_h, 'nk_stonebase', uoff, col=None)
    if style == 'kura':
        namako_h = 3.2; vquad(W, fr, 0, L, 0, base_h, namako_h, 'nk_black', uoff); vquad(W, fr, 0, L, 0, namako_h, wall_top, pm, uoff)
    elif style == 'shrine':
        vquad(W, fr, 0, L, 0, base_h, wall_top, pm, uoff)
    else:
        vquad(W, fr, 0, L, 0, base_h, wall_top, pm, uoff)
    if L < 0.9: return
    if style == 'shrine':
        shrine_front(l, S, rnd, fr, L, base_h, wall_top, he, uoff, first, last); return
    if style == 'kura':
        kura_front(l, S, rnd, fr, L, base_h, wall_top, he, uoff, first, last); return
    # ---- tømmerramme
    nb = max(1, int(round(L / 2.1))); bay = L / nb
    post_m = 'nk_vermilion' if style == 'shrine' else 'nk_timber'
    for k in range(nb + 1):
        a = k * bay
        if (k == 0 and not first and False): continue
        a0, a1 = max(0.0, a - 0.075), min(L, a + 0.075)
        obox(T, fr, a0, a1, 0, 0.1 if style != 'shrine' else 0.14, base_h, wall_top - 0.04, post_m, faces='fltr', uoff=uoff)
    top_h = 0.2 if style != 'wall' else 0.14
    obox(T, fr, 0, L, 0, 0.1, wall_top - top_h, wall_top, post_m, faces='fltr', uoff=uoff)                        # tagbjælke
    obox(T, fr, 0, L, 0, 0.07, base_h, base_h + 0.1, 'nk_timber', faces='ftlr', uoff=uoff)                      # fodrem
    if floor_h: obox(T, fr, 0, L, 0, 0.12, floor_h - 0.1, floor_h + 0.12, post_m, faces='fltrd', uoff=uoff)     # etagebjælke
    if style == 'wall':
        # havemur: nogle sektioner med bambushegn
        return
    # ---- bugter: vinduer, døre, butiksfacader
    door_bay = rnd.randrange(nb) if nb >= 2 and L >= 3.5 else -1
    for k in range(nb):
        a0, a1 = k * bay, (k + 1) * bay; ac = (a0 + a1) / 2; bw = bay - 0.3
        gy0 = base_h + 0.35
        if k == door_bay or (style == 'shop' and k == door_bay):
            dw = min(1.3, bw)
            for (x0_, x1_) in ((ac - dw / 2 - 0.09, ac - dw / 2), (ac + dw / 2, ac + dw / 2 + 0.09)): obox(T, fr, x0_, x1_, 0, 0.08, base_h, 2.2, 'nk_black_lac', faces='fltr')
            obox(T, fr, ac - dw / 2 - 0.09, ac + dw / 2 + 0.09, 0, 0.08, 2.08, 2.2, 'nk_black_lac', faces='fltrd')
            if rnd.random() < 0.5:                                                                                       # skydedør af gitter med lys bagved
                vquad(T, fr, ac - dw / 2, ac + dw / 2, 0.02, base_h, 2.08, 'nk_shoji', uoff)
                nsl = int(dw / 0.14)
                for q in range(0, nsl + 1):
                    xx = ac - dw / 2 + q * dw / nsl; obox(T, fr, xx - 0.016, xx + 0.016, 0.0, 0.05, base_h, 2.08, 'nk_black_lac', faces='flr')
                obox(T, fr, ac - dw / 2, ac + dw / 2, 0.0, 0.05, 1.0, 1.06, 'nk_black_lac', faces='fltrd')
            else:
                vquad(T, fr, ac - dw / 2, ac + dw / 2, 0.025, base_h, 2.08, 'nk_cedar_d', uoff + 1.7)                      # trædør
                obox(T, fr, ac - dw / 2, ac + dw / 2, 0.0, 0.05, 1.12, 1.18, 'nk_black_lac', faces='fltrd'); obox(T, fr, ac - dw / 2, ac + dw / 2, 0.0, 0.05, 1.7, 1.76, 'nk_black_lac', faces='fltrd')
            # noren (tekstilforhæng)
            for j in range(3):
                x0 = ac - dw / 2 + j * dw / 3 + 0.02; x1 = x0 + dw / 3 - 0.04
                vquad(T, fr, x0, x1, 0.07, 1.55, 2.1, 'nk_noren' if style != 'inn' else 'nk_noren2', 0.0)
            obox(T, fr, ac - dw / 2 - 0.05, ac + dw / 2 + 0.05, 0.03, 0.08, 2.1, 2.16, 'nk_rope', faces='ft')
            DOORS_LOG.append((fr.W(ac, 0.3), l))
            LIGHTS.append(dict(x=round(fr.W(ac + dw / 2 + 0.32, 0.4)[0], 2), y=2.45, z=round(fr.W(ac + dw / 2 + 0.32, 0.4)[1], 2), n=n, kind='chochin', red=rnd.random() < 0.35))
            continue
        # gittervindue (koshi) i stueetagen
        if floors == 2 or style in ('shop', 'house1'):
            win_w = min(1.55, bw); lit = rnd.random() < 0.62 if style != 'shop' else True
            wy0, wy1 = gy0 + 0.35, (floor_h - 0.55) if floor_h else (min(he, 3.4) - 0.7)
            if wy1 - wy0 > 0.5:
                vquad(T, fr, ac - win_w / 2, ac + win_w / 2, 0.014, wy0, wy1, 'nk_shoji' if lit else 'nk_shoji_off', uoff)
                # ramme
                for (aa, bb, yy0, yy1) in ((ac - win_w / 2 - 0.05, ac - win_w / 2 + 0.02, wy0 - 0.05, wy1 + 0.05), (ac + win_w / 2 - 0.02, ac + win_w / 2 + 0.05, wy0 - 0.05, wy1 + 0.05)):
                    obox(T, fr, aa, bb, 0, 0.07, yy0, yy1, 'nk_black_lac', faces='fltr')
                obox(T, fr, ac - win_w / 2 - 0.05, ac + win_w / 2 + 0.05, 0, 0.07, wy1, wy1 + 0.07, 'nk_black_lac', faces='fltr')
                obox(T, fr, ac - win_w / 2 - 0.05, ac + win_w / 2 + 0.05, 0, 0.09, wy0 - 0.07, wy0, 'nk_black_lac', faces='ftlr')
                ns = int(win_w / 0.15)
                for q in range(1, ns):
                    x = ac - win_w / 2 + q * win_w / ns
                    obox(T, fr, x - 0.013, x + 0.013, 0.01, 0.06, wy0, wy1, 'nk_black_lac', faces='fl' + 'r')
        # etage
        if floor_h:
            uy0, uy1 = floor_h + 0.45, wall_top - 0.5
            if uy1 - uy0 > 0.5:
                uw = min(1.1, bw); lit2 = rnd.random() < 0.5
                vquad(T, fr, ac - uw / 2, ac + uw / 2, 0.014, uy0, uy1, 'nk_shoji' if lit2 else 'nk_shoji_off', uoff + 3)
                for xx in (ac - uw / 2 - 0.04, ac + uw / 2 - 0.01): obox(T, fr, xx, xx + 0.05, 0, 0.06, uy0 - 0.04, uy1 + 0.04, 'nk_black_lac', faces='fltr')
                obox(T, fr, ac - uw / 2 - 0.04, ac + uw / 2 + 0.04, 0, 0.06, uy1, uy1 + 0.05, 'nk_black_lac', faces='fltr'); obox(T, fr, ac - uw / 2 - 0.04, ac + uw / 2 + 0.04, 0, 0.06, uy0 - 0.05, uy0, 'nk_black_lac', faces='fltr')
                for q in range(1, 3):
                    x = ac - uw / 2 + q * uw / 3; obox(T, fr, x - 0.012, x + 0.012, 0.01, 0.05, uy0, uy1, 'nk_black_lac', faces='flr')
    # ---- hisashi (lille tegltag mellem etagerne) – ikke ved hjørner (her mødes nabofacader)
    if floor_h and L > 2.4:
        a0 = 0.9 if first else 0.0; a1 = L - 0.9 if last else L
        if a1 - a0 > 0.8:
            yh = floor_h + 0.15; pr = 0.85; ya, yb = yh + 0.55, yh + 0.05
            sz = tsz('nk_roof2'); F = S['far']
            F.poly([fr.P(a0, 0, ya), fr.P(a1, 0, ya), fr.P(a1, pr, yb), fr.P(a0, pr, yb)], 'nk_roof2', uv=[((a0 + uoff) / sz, 0), ((a1 + uoff) / sz, 0), ((a1 + uoff) / sz, 1.0), ((a0 + uoff) / sz, 1.0)], want=(n[0] * 0.5, 1, n[1] * 0.5), col=[blend_at(fr.P(a0, 0, ya), 0.8)] * 4)
            T.poly([fr.P(a0, pr, yb - 0.1), fr.P(a1, pr, yb - 0.1), fr.P(a1, 0, ya - 0.12), fr.P(a0, 0, ya - 0.12)], 'nk_timber', uv=[(0, 0), (1, 0), (1, 1), (0, 1)], want=(0, -1, 0))
            vquad(T, fr, a0, a1, pr, yb - 0.12, yb + 0.02, 'nk_black_lac', 0.0)
            T.poly([fr.P(a0, pr, yb - 0.12), fr.P(a0, pr, yb + 0.02), fr.P(a0, 0, ya), fr.P(a0, 0, ya - 0.12)], 'nk_roofcap', uv=[(0, 0), (1, 0), (1, 1), (0, 1)], want=(-u[0], 0, -u[1]))
            T.poly([fr.P(a1, pr, yb - 0.12), fr.P(a1, pr, yb + 0.02), fr.P(a1, 0, ya), fr.P(a1, 0, ya - 0.12)], 'nk_roofcap', uv=[(0, 0), (1, 0), (1, 1), (0, 1)], want=(u[0], 0, u[1]))
    # ---- kanban (hængeskilt), sudare (bambusgardin) og blåregn på hisashi – kun over hovedhøjde
    if style in ('shop', 'inn', 'machiya') and L > 3.2 and rnd.random() < 0.4:
        a = rnd.choice([0.55, L - 0.55]); y0_ = 2.3; hh = 0.95
        obox(T, fr, a - 0.025, a + 0.025, 0.1, 0.62, y0_, y0_ + hh, 'nk_black_lac', faces='fkltrd')
        obox(T, fr, a - 0.02, a + 0.02, 0.0, 0.12, y0_ + hh - 0.05, y0_ + hh + 0.03, 'nk_timber', faces='fkltr')
        for sgn, ww in ((-1, a - 0.03), (1, a + 0.03)):
            fr2 = Fr(fr.W(ww, 0.14), (0, 0), (0, 0))
            xa, za = fr.W(ww, 0.17); xb, zb = fr.W(ww, 0.58)
            T.poly([(xa, y0_ + 0.12, za), (xb, y0_ + 0.12, zb), (xb, y0_ + hh - 0.12, zb), (xa, y0_ + hh - 0.12, za)], 'nk_shoji', uv=[(0, 0), (1, 0), (1, 1), (0, 1)], want=(sgn * fr.u[0], 0, sgn * fr.u[1]))
            for j in range(3):
                yy = y0_ + 0.22 + j * 0.23; T.poly([(xa + (xb - xa) * 0.15, yy, za + (zb - za) * 0.15), (xa + (xb - xa) * 0.85, yy, za + (zb - za) * 0.85), (xa + (xb - xa) * 0.85, yy + 0.09, za + (zb - za) * 0.85), (xa + (xb - xa) * 0.15, yy + 0.09, za + (zb - za) * 0.15)], 'nk_black_lac', uv=[(0, 0), (1, 0), (1, 1), (0, 1)], want=(sgn * fr.u[0] * 1.0, 0, sgn * fr.u[1] * 1.0))
    if floor_h and L > 2.4 and rnd.random() < 0.55:                                    # blåregn der hænger ned fra det lille tag
        a0_ = 0.9 if first else 0.0; a1_ = L - 0.9 if last else L; yh = floor_h + 0.15
        k = a0_ + rnd.uniform(0.4, 1.0)
        while k < a1_ - 0.3:
            F = S['fol']; right = fr.u; ww = rnd.uniform(0.7, 1.0); hh = rnd.uniform(0.9, 1.3)
            cx, cz = fr.W(k, 0.7)
            from nk_plants import card as _card
            _card(F, 'fol_wisteria', (cx, yh + 0.12 - hh / 2 + 0.28, cz), (right[0], 0.0, right[1]), (0.0, 1.0, 0.0), ww, hh)
            k += rnd.uniform(1.3, 2.4)
    # ---- lanterner ved eaves (hver ~8 m)
    if L > 5 and rnd.random() < 0.8:
        ac = rnd.uniform(1.5, L - 1.5); x, z = fr.W(ac, 0.32); y = (floor_h - 0.25) if floor_h else min(he, 3.4) - 0.3
        LIGHTS.append(dict(x=round(x, 2), y=round(y - 0.3, 2), z=round(z, 2), n=n, kind='chochin', red=rnd.random() < 0.5, hang=True))

def walls_extra_gate(l, S, rnd): pass

def roof(l, S, rnd):
    """tag over parcellens stykker + udhæng mod gaden. Fælles tagprofil sikrer sammenhæng over hjørner/skillevægge."""
    if l['style'] == 'hedge':
        he = l['he']
        for pc in l['pieces']:
            pts = [(x, he, z) for (x, z) in pc]
            if len(pts) >= 3: S['trim'].poly(pts, 'nk_hedge', col=[(0.0, 0.0, 0.0, 1.0)] * len(pts), want=(0, 1, 0))
        return
    p0, p1 = l['front']; u = l['dir']; n = l['nout']; nw = (-n[0], -n[1]); L = l['L']; rp = l['rp']; he = l['he']; style = l['style']
    pitch, sr, over = rp['pitch'], rp['sr'], rp['over']
    F, T = S['far'], S['trim']
    def s_of(p): return nw[0] * (p[0] - p0[0]) + nw[1] * (p[1] - p0[1])
    def a_of(p): return u[0] * (p[0] - p0[0]) + u[1] * (p[1] - p0[1])
    def y_of(s): return roof_y(he, rp, s)
    sz = tsz('nk_roof2'); cs = math.sqrt(1 + pitch * pitch); uoff = hash2(round(p0[0] * 10), round(p0[1] * 10)) * 5.0
    tile = 'nk_roof2'
    def face(poly, front):
        pts = []; uv = []; col = []
        for (x, z) in poly:
            s = s_of((x, z)); y = y_of(s); pts.append((x, y, z)); a = a_of((x, z))
            uv.append(((a + uoff) / sz, ((s + over) * cs if front else ((sr + over) + (s - sr)) * cs) / sz)); col.append(blend_at((x, y, z), 0.8))
        if len(pts) >= 3: F.poly(pts, tile, uv=uv, col=col, want=(0, 1, 0))
    for pc in l['pieces']:
        fr_poly = clip_poly(pc, lambda p: sr - s_of(p), True)           # s ≤ sr
        rr_poly = clip_poly(pc, lambda p: s_of(p) - sr, True)           # s ≥ sr
        if len(fr_poly) >= 3 and abs(polygon_area([(q[0], 0, q[1]) for q in fr_poly])) > 1e-4: face(fr_poly, True)
        if len(rr_poly) >= 3 and abs(polygon_area([(q[0], 0, q[1]) for q in rr_poly])) > 1e-4: face(rr_poly, False)
        # kam: skæring med s = sr
        xs = []
        for i in range(len(pc)):
            a, b = pc[i], pc[(i + 1) % len(pc)]; sa, sb = s_of(a) - sr, s_of(b) - sr
            if (sa > 1e-6 and sb < -1e-6) or (sa < -1e-6 and sb > 1e-6):
                t = sa / (sa - sb); xs.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
            elif abs(sa) <= 1e-6: xs.append(a)
        if len(xs) >= 2:
            xs.sort(key=a_of); ra, rb = xs[0], xs[-1]
            if math.hypot(rb[0] - ra[0], rb[1] - ra[1]) > 0.4 and style != 'wall':
                fr2 = Fr(ra, u, n); yr = y_of(sr); Lr = math.hypot(rb[0] - ra[0], rb[1] - ra[1])
                obox(T, fr2, 0, Lr, -0.17, 0.17, yr - 0.02, yr + 0.2, 'nk_roofcap', faces='fkltr')
    # ---- udhæng mod gaden (samme plan som forslagen)
    if style == 'wall': over_e = over
    else: over_e = over
    quad = l['quad']; q0 = quad[-1] if len(quad) == 4 else quad[2]; q1 = quad[2] if len(quad) == 4 else quad[2]
    def endvec(p, q):
        v = (q[0] - p[0], q[1] - p[1]); ln = math.hypot(*v)
        return (v[0] / ln, v[1] / ln) if ln > 1e-9 else nw
    e0 = endvec(p0, q0); e1 = endvec(p1, q1)
    c0 = max(0.3, e0[0] * nw[0] + e0[1] * nw[1]); c1 = max(0.3, e1[0] * nw[0] + e1[1] * nw[1])
    o0 = (p0[0] - e0[0] * over_e / c0, p0[1] - e0[1] * over_e / c0); o1 = (p1[0] - e1[0] * over_e / c1, p1[1] - e1[1] * over_e / c1)
    poly = [o0, o1, p1, p0]
    # selvskæring? (kort kant mellem to lange): brug vinkelret udhæng
    ok = (a_of(o1) - a_of(o0)) > 0.05 and polygon_area([(q[0], 0, q[1]) for q in poly]) != 0
    cr1 = (o1[0] - o0[0]) * (p1[1] - o1[1]) - (o1[1] - o0[1]) * (p1[0] - o1[0]); cr2 = (p1[0] - o1[0]) * (p0[1] - p1[1]) - (p1[1] - o1[1]) * (p0[0] - p1[0])
    cr3 = (p0[0] - p1[0]) * (o0[1] - p0[1]) - (p0[1] - p1[1]) * (o0[0] - p0[0]); cr4 = (o0[0] - p0[0]) * (o1[1] - o0[1]) - (o0[1] - p0[1]) * (o1[0] - o0[0])
    if not (ok and (cr1 > 0) == (cr2 > 0) == (cr3 > 0) == (cr4 > 0)):
        o0 = (p0[0] + n[0] * over_e, p0[1] + n[1] * over_e); o1 = (p1[0] + n[0] * over_e, p1[1] + n[1] * over_e); poly = [o0, o1, p1, p0]
    pts = []; uv = []; col = []
    for (x, z) in poly:
        s = s_of((x, z)); y = y_of(s); pts.append((x, y, z)); uv.append(((a_of((x, z)) + uoff) / sz, ((s + over) * cs) / sz)); col.append(blend_at((x, y, z), 0.8))
    F.poly(pts, tile, uv=uv, col=col, want=(0, 1, 0))
    wall_top = he + pitch * over
    # undersiden (soffit) og vindskede
    yo = he - 0.17
    T.poly([(o0[0], yo, o0[1]), (o1[0], yo, o1[1]), (p1[0], wall_top - 0.18, p1[1]), (p0[0], wall_top - 0.18, p0[1])], 'nk_timber', uv=[(a_of(o0) / 1.6, 0), (a_of(o1) / 1.6, 0), (a_of(p1) / 1.6, over / 1.6), (a_of(p0) / 1.6, over / 1.6)], want=(0, -1, 0))
    T.poly([(o0[0], yo, o0[1]), (o1[0], yo, o1[1]), (o1[0], he + 0.03, o1[1]), (o0[0], he + 0.03, o0[1])], 'nk_black_lac', uv=[(0, 0), (L / 1.6, 0), (L / 1.6, 0.1), (0, 0.1)], want=(n[0], 0, n[1]))
    # spærender (hver 0,6 m) under udhænget
    if style != 'wall' and L > 1.5:
        k = max(1, int(L / 0.6)); ds = L / k
        fr = Fr(p0, u, n)
        for i in range(k):
            a = ds * (i + 0.5)
            obox(T, fr, a - 0.05, a + 0.05, over - 0.4, over - 0.03, yo - 0.08, yo + 0.1, 'nk_timber', faces='fltd', uoff=0)


def seam(sm, S):
    """gavlvæg mellem to tage med forskellig højde: puds + mørk vindskede langs tagets linje og lodrette stolper i enderne"""
    W, T = S['walls'], S['trim']; pts = [tuple(p) for p in sm['pts']]; n = sm['n']
    W.poly(pts, PLASTER.get(sm['style'], 'nk_plaster_w'), want=(n[0], 0, n[1]))
    A, Bp, Bl, Al = pts; off = (n[0] * 0.025, 0.0, n[1] * 0.025)
    sh = lambda p, dy=0.0: (p[0] + off[0], p[1] + dy, p[2] + off[2])
    T.poly([sh(A), sh(Bp), sh(Bp, -0.2), sh(A, -0.2)], 'nk_black_lac', uv=[(0, 0), (1, 0), (1, 1), (0, 1)], want=(n[0], 0, n[1]))
    # tømmerramme på gavlvæggen: lodrette stolper hver ~1,9 m og vandrette bjælker hver ~2,3 m (følger tagets linje)
    dxs, dzs = Bp[0] - A[0], Bp[2] - A[2]; Ls = math.hypot(dxs, dzs)
    if Ls > 1.6:
        nposts = max(1, int(Ls / 1.9)); w2 = 0.11
        for k in range(1, nposts):
            t = k / nposts; xk, zk = A[0] + dxs * t, A[2] + dzs * t; yt = A[1] + (Bp[1] - A[1]) * t - 0.2; yb = Al[1] + (Bl[1] - Al[1]) * t
            if yt - yb > 0.6:
                ux_, uz_ = dxs / Ls, dzs / Ls
                T.poly([(xk + off[0] - ux_ * w2, yb, zk + off[2] - uz_ * w2), (xk + off[0] + ux_ * w2, yb, zk + off[2] + uz_ * w2), (xk + off[0] + ux_ * w2, yt, zk + off[2] + uz_ * w2), (xk + off[0] - ux_ * w2, yt, zk + off[2] - uz_ * w2)], 'nk_timber', uv=[(0, 0), (0.1, 0), (0.1, (yt - yb) / 1.6), (0, (yt - yb) / 1.6)], want=(n[0], 0, n[1]))
        hmax = max(A[1] - Al[1], Bp[1] - Bl[1])
        for k in range(1, int(hmax / 2.3) + 1):
            ya = Al[1] + k * 2.3; yb_ = Bl[1] + k * 2.3
            if ya < A[1] - 0.4 and yb_ < Bp[1] - 0.4:
                T.poly([(A[0] + off[0], ya, A[2] + off[2]), (Bp[0] + off[0], yb_, Bp[2] + off[2]), (Bp[0] + off[0], yb_ + 0.15, Bp[2] + off[2]), (A[0] + off[0], ya + 0.15, A[2] + off[2])], 'nk_timber', uv=[(0, 0), (1, 0), (1, 0.1), (0, 0.1)], want=(n[0], 0, n[1]))
    for P0, P1 in ((A, Al), (Bp, Bl)):
        h = P0[1] - P1[1]
        if h > 0.5:
            dx = (Bp[0] - A[0]); dz = (Bp[2] - A[2]); L = math.hypot(dx, dz) or 1.0; ux, uz = dx / L, dz / L; sgn = 1 if P0 is A else -1; w = 0.14
            q = [(P0[0] + off[0], P0[1] - 0.2, P0[2] + off[2]), (P0[0] + off[0] + ux * w * sgn, P0[1] - 0.2, P0[2] + off[2] + uz * w * sgn), (P1[0] + off[0] + ux * w * sgn, P1[1], P1[2] + off[2] + uz * w * sgn), (P1[0] + off[0], P1[1], P1[2] + off[2])]
            T.poly(q, 'nk_timber', uv=[(0, 0), (0.1, 0), (0.1, h / 1.6), (0, h / 1.6)], want=(n[0], 0, n[1]))


def shrine_front(l, S, rnd, fr, L, base_h, wall_top, he, uoff, first, last):
    """helligdommens facade: høj stensokkel, lakrøde søjler, hvidt puds og store lyse gitterskydedøre. Shimenawa (rep med shide) over midten."""
    T = S['trim']; n = l['nout']
    nb = max(1, int(round(L / 2.4))); bay = L / nb
    for k in range(nb + 1):
        a = k * bay; obox(T, fr, max(0.0, a - 0.11), min(L, a + 0.11), 0, 0.12, 0.9, wall_top - 0.1, 'nk_vermilion', faces='fltr', uoff=uoff)
    obox(T, fr, 0, L, 0, 0.12, wall_top - 0.5, wall_top - 0.28, 'nk_vermilion', faces='fltrd'); obox(T, fr, 0, L, 0, 0.1, 2.75, 2.95, 'nk_vermilion', faces='fltrd')
    for k in range(nb):
        a0, a1 = k * bay, (k + 1) * bay; ac = (a0 + a1) / 2; w = bay - 0.5
        if rnd.random() < 0.75:
            vquad(T, fr, ac - w / 2, ac + w / 2, 0.02, 1.0, 2.7, 'nk_shoji', uoff)
            ns = max(3, int(w / 0.22))
            for q in range(ns + 1):
                x = ac - w / 2 + q * w / ns; obox(T, fr, x - 0.016, x + 0.016, 0.0, 0.06, 1.0, 2.7, 'nk_black_lac', faces='flr')
            for yy in (1.0, 1.85, 2.66): obox(T, fr, ac - w / 2, ac + w / 2, 0.0, 0.07, yy, yy + 0.04, 'nk_black_lac', faces='fltrd')
        else:
            vquad(T, fr, ac - w / 2, ac + w / 2, 0.025, 0.9, 2.7, 'nk_cedar_d', uoff)
            for yy in (1.3, 2.3): obox(T, fr, ac - w / 2, ac + w / 2, 0.0, 0.06, yy, yy + 0.07, 'nk_black_lac', faces='fltrd')
    # shimenawa: reb mellem de to midterste søjler + papirstrimler
    ac = L / 2; hw = min(bay * 0.5, 1.2) if nb >= 2 else min(L / 2 - 0.2, 1.0); yb = 3.05
    segs = 8
    for k in range(segs):
        a0 = ac - hw + 2 * hw * k / segs; a1 = ac - hw + 2 * hw * (k + 1) / segs
        y0_ = yb - 0.12 * math.sin(math.pi * k / segs); y1_ = yb - 0.12 * math.sin(math.pi * (k + 1) / segs)
        T.poly([fr.P(a0, 0.1, y0_ - 0.05), fr.P(a1, 0.1, y1_ - 0.05), fr.P(a1, 0.1, y1_ + 0.05), fr.P(a0, 0.1, y0_ + 0.05)], 'nk_rope', uv=[(0, 0), (1, 0), (1, 1), (0, 1)], want=(n[0], 0, n[1]))
    for k in range(4):
        a = ac - hw * 0.7 + k * hw * 1.4 / 3; yy = yb - 0.1
        T.poly([fr.P(a - 0.06, 0.13, yy - 0.32), fr.P(a + 0.06, 0.13, yy - 0.32), fr.P(a + 0.06, 0.13, yy), fr.P(a - 0.06, 0.13, yy)], 'nk_shoji_off', uv=[(0, 0), (1, 0), (1, 1), (0, 1)], want=(n[0], 0, n[1]))
    LIGHTS.append(dict(x=round(fr.W(0.6, 0.4)[0], 2), y=2.5, z=round(fr.W(0.6, 0.4)[1], 2), n=n, kind='chochin', red=True)) if L > 3 else None
    LIGHTS.append(dict(x=round(fr.W(L - 0.6, 0.4)[0], 2), y=2.5, z=round(fr.W(L - 0.6, 0.4)[1], 2), n=n, kind='chochin', red=True)) if L > 3 else None


def kura_front(l, S, rnd, fr, L, base_h, wall_top, he, uoff, first, last):
    """lagerhusets facade: sort namako-sokkel, hvidt puds, kraftigt tømmer, tunge dobbeltdøre med jernbånd og små tremmevinduer"""
    T = S['trim']; n = l['nout']
    nb = max(1, int(round(L / 3.0))); bay = L / nb
    for k in range(nb + 1):
        a = k * bay; obox(T, fr, max(0.0, a - 0.11), min(L, a + 0.11), 0, 0.12, base_h, wall_top - 0.12, 'nk_timber', faces='fltr', uoff=uoff)
    for yy, hh in ((3.2, 0.3), (5.55, 0.26), (wall_top - 0.24, 0.24)): obox(T, fr, 0, L, 0, 0.13, yy, yy + hh, 'nk_timber', faces='fltrd', uoff=uoff)
    obox(T, fr, 0, L, 0, 0.06, base_h, base_h + 0.1, 'nk_black_lac', faces='ftlr')
    door = rnd.randrange(nb) if (nb >= 1 and L >= 3.0) else -1
    for k in range(nb):
        a0, a1 = k * bay, (k + 1) * bay; ac = (a0 + a1) / 2
        if k == door:
            dw = min(2.2, bay - 0.5); dh = 2.7
            for (x0_, x1_) in ((ac - dw / 2 - 0.12, ac - dw / 2), (ac + dw / 2, ac + dw / 2 + 0.12)): obox(T, fr, x0_, x1_, 0, 0.1, base_h, dh + 0.1, 'nk_black_lac', faces='fltr')
            obox(T, fr, ac - dw / 2 - 0.12, ac + dw / 2 + 0.12, 0, 0.1, dh, dh + 0.14, 'nk_black_lac', faces='fltrd')
            vquad(T, fr, ac - dw / 2, ac, 0.03, base_h, dh, 'nk_beam', uoff); vquad(T, fr, ac, ac + dw / 2, 0.03, base_h, dh, 'nk_beam', uoff + 1.0)
            obox(T, fr, ac - 0.02, ac + 0.02, 0.0, 0.07, base_h, dh, 'nk_black_lac', faces='fltr')
            for yy in (1.0, 1.8, 2.5): obox(T, fr, ac - dw / 2, ac + dw / 2, 0.0, 0.06, yy, yy + 0.09, 'nk_iron', faces='fltrd')
            LIGHTS.append(dict(x=round(fr.W(ac + dw / 2 + 0.55, 0.4)[0], 2), y=2.3, z=round(fr.W(ac + dw / 2 + 0.55, 0.4)[1], 2), n=n, kind='chochin', red=rnd.random() < 0.4))
        else:
            lit = rnd.random() < 0.5; ww = min(0.9, bay - 0.8); y0_, y1_ = 4.4, 5.3
            vquad(T, fr, ac - ww / 2, ac + ww / 2, 0.02, y0_, y1_, 'nk_shoji' if lit else 'nk_black_lac', uoff)
            obox(T, fr, ac - ww / 2 - 0.06, ac - ww / 2, 0.0, 0.07, y0_ - 0.06, y1_ + 0.06, 'nk_black_lac', faces='fltr'); obox(T, fr, ac + ww / 2, ac + ww / 2 + 0.06, 0.0, 0.07, y0_ - 0.06, y1_ + 0.06, 'nk_black_lac', faces='fltr')
            obox(T, fr, ac - ww / 2 - 0.06, ac + ww / 2 + 0.06, 0.0, 0.07, y1_, y1_ + 0.08, 'nk_black_lac', faces='fltrd'); obox(T, fr, ac - ww / 2 - 0.06, ac + ww / 2 + 0.06, 0.0, 0.09, y0_ - 0.08, y0_, 'nk_black_lac', faces='fltrd')
            for q in range(1, 5): xx = ac - ww / 2 + q * ww / 5; obox(T, fr, xx - 0.012, xx + 0.012, 0.0, 0.05, y0_, y1_, 'nk_iron', faces='flr')
            if rnd.random() < 0.6:                                                           # lille lysvindue i stueetagen
                vquad(T, fr, ac - 0.5, ac + 0.5, 0.02, 1.5, 2.5, 'nk_shoji' if rnd.random() < 0.6 else 'nk_shoji_off', uoff)
                for xx in (ac - 0.5, ac + 0.5 - 0.05): obox(T, fr, xx, xx + 0.05, 0.0, 0.07, 1.45, 2.55, 'nk_black_lac', faces='fltr')
                obox(T, fr, ac - 0.5, ac + 0.5, 0.0, 0.07, 1.45, 1.5, 'nk_black_lac', faces='fltrd'); obox(T, fr, ac - 0.5, ac + 0.5, 0.0, 0.07, 2.5, 2.55, 'nk_black_lac', faces='fltrd')
                for q in range(1, 6): xx = ac - 0.5 + q * 1.0 / 6; obox(T, fr, xx - 0.012, xx + 0.012, 0.0, 0.05, 1.5, 2.5, 'nk_black_lac', faces='flr')
