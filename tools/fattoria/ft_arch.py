# ==========================================================================
# de_fattoria · arkitektur: facader (villa, bondehuse, lader, stenmure, terrassemure, hække, tårn, hal-vægge) og tage (fælles tagprofil, ft_roof.py), tårnet, B-hallen og galleriet.
#   Alt er bundet til gangenes omrids: facaden ligger PRÆCIS i kollisionsfladen (w = 0); fremspring på jordniveau ≤ 0,12 m (karme, sokkelbånd), udhæng/lanterner over hovedhøjde.
#   Objekter: walls (lysmap) · detail_trim (vertex-lys: karme, skodder, døre, gitre) · detail_far (vertex-lys: tegl)
# ==========================================================================
import math, random
from ft_geo import *
from ft_roof import roof_y
from ft_common import blend_at, hash2

PLASTER = {'villa': ['ft_ochre_a', 'ft_plaster_a'], 'casa': ['ft_plaster_a', 'ft_plaster_c', 'ft_ochre_b', 'ft_plaster_d', 'ft_ochre_a'], 'casetta': ['ft_plaster_b', 'ft_plaster_d', 'ft_ochre_a'],
           'fienile': ['ft_stone'], 'hallwall': ['ft_plaster_b'], 'twall': ['ft_ashlar'], 'swall': ['ft_rubble'], 'terrace': ['ft_stone'], 'hedge': ['ft_hedge']}
LAMPS = []                                          # (x, y, z, w) – varme lamper til bagningen
DOORS_LOG = []

def window(T, fr, a, w, h, ysill, rnd, shutter=True, mat_sh=None):
    """stenkarm, sålbænk, mørk rude, midterstolpe og skodder (åbne, lagt mod facaden)"""
    obox(T, fr, a - w / 2 - 0.1, a + w / 2 + 0.1, 0, 0.09, ysill + h, ysill + h + 0.15, 'ft_ashlar', faces='fkltrd')
    obox(T, fr, a - w / 2 - 0.12, a + w / 2 + 0.12, 0, 0.14, ysill - 0.1, ysill, 'ft_ashlar', faces='fkltrd')
    obox(T, fr, a - w / 2 - 0.1, a - w / 2, 0, 0.08, ysill, ysill + h, 'ft_ashlar', faces='fkltrd')
    obox(T, fr, a + w / 2, a + w / 2 + 0.1, 0, 0.08, ysill, ysill + h, 'ft_ashlar', faces='fkltrd')
    vquad(T, fr, a - w / 2, a + w / 2, 0.012, ysill, ysill + h, 'ft_pane')
    obox(T, fr, a - 0.022, a + 0.022, 0.0, 0.04, ysill, ysill + h, 'ft_timber', faces='fkltrd'); obox(T, fr, a - w / 2, a + w / 2, 0.0, 0.04, ysill + h * 0.55 - 0.022, ysill + h * 0.55 + 0.022, 'ft_timber', faces='fkltrd')
    if shutter:
        sw = w / 2; col = mat_sh or ('ft_shutter' if rnd.random() < 0.7 else 'ft_shutter_b')
        obox(T, fr, a - w / 2 - 0.13 - sw, a - w / 2 - 0.13, 0.0, 0.045, ysill - 0.02, ysill + h + 0.02, col, faces='fkltrd')
        obox(T, fr, a + w / 2 + 0.13, a + w / 2 + 0.13 + sw, 0.0, 0.045, ysill - 0.02, ysill + h + 0.02, col, faces='fkltrd')

def arch_door(T, fr, ac, dw, dh, rnd, mat_door='ft_door'):
    """stenomramning med rundbue og mørk trædør (fladt på facaden)"""
    r = dw / 2; spring = dh - r
    for (x0_, x1_) in ((ac - dw / 2 - 0.14, ac - dw / 2), (ac + dw / 2, ac + dw / 2 + 0.14)): obox(T, fr, x0_, x1_, 0, 0.09, 0.0, spring, 'ft_ashlar', faces='fltr')
    vquad(T, fr, ac - dw / 2, ac + dw / 2, 0.02, 0.0, spring, mat_door, 0.0)
    n = 8; pts_o = []; pts_i = []
    for k in range(n + 1):
        t = math.pi * k / n; pts_i.append((ac - math.cos(t) * r, spring + math.sin(t) * r)); pts_o.append((ac - math.cos(t) * (r + 0.14), spring + math.sin(t) * (r + 0.14)))
    for k in range(n):
        (a0, y0), (a1, y1) = pts_i[k], pts_i[k + 1]; (b0, z0), (b1, z1) = pts_o[k], pts_o[k + 1]
        with T.part():
            T.poly([fr.P(a0, 0.02, y0), fr.P(a1, 0.02, y1), fr.P(ac, 0.02, spring)], mat_door, uv=[(0, 0), (1, 0), (0.5, 0.5)], want=(fr.n[0], 0, fr.n[1]))
            T.poly([fr.P(a0, 0.09, y0), fr.P(b0, 0.09, z0), fr.P(b1, 0.09, z1), fr.P(a1, 0.09, y1)], 'ft_ashlar', uv=[(0, 0), (0.2, 0), (0.2, 0.2), (0, 0.2)], want=(fr.n[0], 0, fr.n[1]))
    obox(T, fr, ac - 0.05, ac + 0.05, 0.0, 0.1, dh + 0.14, dh + 0.3, 'ft_sand', faces='fkltrd')            # sluttesten
    obox(T, fr, ac - dw / 2, ac + dw / 2, 0.0, 0.05, 1.0, 1.06, 'ft_iron', faces='fltrd'); obox(T, fr, ac - dw / 2, ac + dw / 2, 0.0, 0.05, 1.8, 1.86, 'ft_iron', faces='fltrd')

def wall_lantern(S, fr, a, y, rnd):
    """smedejernslanterne på arm: hænger over hovedhøjde (≥ 2,2 m), 0,3 m ud"""
    T = S['trim']; n = fr.n; x, z = fr.W(a, 0.32)
    obox(T, fr, a - 0.02, a + 0.02, 0.0, 0.34, y + 0.2, y + 0.24, 'ft_iron', faces='fkltrd')
    with T.part():
        r = 0.09; yb, yt = y - 0.14, y + 0.18
        for k in range(4):
            a0 = math.pi / 4 + k * math.pi / 2; a1 = a0 + math.pi / 2; am = (a0 + a1) / 2
            T.poly([(x + math.cos(a0) * r, yb, z + math.sin(a0) * r), (x + math.cos(a1) * r, yb, z + math.sin(a1) * r), (x + math.cos(a1) * r, yt, z + math.sin(a1) * r), (x + math.cos(a0) * r, yt, z + math.sin(a0) * r)], 'ft_iron', uv=[(0, 0), (1, 0), (1, 1), (0, 1)], want=(math.cos(am), 0, math.sin(am)))
    cyl(T, x, z, 0.11, yt, yt + 0.06, 'ft_iron', n=4, caps='tb', r1=0.03)
    LAMPS.append(dict(x=round(x, 2), y=round(y, 2), z=round(z, 2), w=150.0, i=1.2, range=7.0))

def facade(l, S, rnd):
    p0, p1 = l['front']; u = l['dir']; n = l['nout']; L = l['L']; fr = Fr(p0, u, n)
    he = l['he']; rp = l['rp']; style = l['style']; floors = l['floors']
    wall_top = he + rp['pitch'] * rp['over']
    uoff = rnd.uniform(0, 7.0); first, last = l['first'], l['last']
    W, T = S['walls'], S['trim']
    pm = PLASTER[style][rnd.randrange(len(PLASTER[style]))] if style in PLASTER else 'ft_plaster_a'
    if style == 'hedge':                                           # klippet cypres-/buksbomshæk på lav stensokkel
        vquad(W, fr, 0, L, 0, 0, 0.45, 'ft_stone', uoff)
        pts_col = [fr.P(0, 0, 0.45), fr.P(L, 0, 0.45), fr.P(L, 0, he), fr.P(0, 0, he)]
        vquad(W, fr, 0, L, 0, 0.45, he, 'ft_hedge', uoff, col=[blend_at(p_, 0.0) for p_ in pts_col]); return
    if style in ('swall', 'terrace'):
        mat = 'ft_rubble' if style == 'swall' else 'ft_ashlar'
        vquad(W, fr, 0, L, 0, 0, he - 0.2, mat, uoff, col=None)
        obox(T, fr, 0, L, 0, 0.1, he - 0.24, he, 'ft_ashlar', faces='fltrt', uoff=uoff)                                  # kronesten
        nb = max(1, int(round(L / 4.8))); bay = L / nb                                                                   # lisener hver ~4,8 m (≤ 0,1 m)
        for k in range(nb + 1):
            a = k * bay; obox(T, fr, max(0.0, a - 0.28), min(L, a + 0.28), 0, 0.09, 0.0, he - 0.2, 'ft_sand', faces='fltr', uoff=uoff)
        for k in range(nb):                                                                                              # blinde buer mellem lisenerne (stenramme 0,06 m)
            ac = (k + 0.5) * bay; w = min(2.6, bay - 1.0)
            if w < 1.2 or he < 3.0: continue
            ys = 1.9
            for xx in (ac - w / 2 - 0.1, ac + w / 2): obox(T, fr, xx, xx + 0.1, 0, 0.05, 0.0, ys, 'ft_sand', faces='fltr', uoff=uoff)
            nseg = 8; r = w / 2 + 0.1
            for q in range(nseg):
                a0 = math.pi * q / nseg; a1 = math.pi * (q + 1) / nseg
                T.poly([fr.P(ac - math.cos(a0) * (r - 0.1), 0.05, ys + math.sin(a0) * (r - 0.1)), fr.P(ac - math.cos(a1) * (r - 0.1), 0.05, ys + math.sin(a1) * (r - 0.1)), fr.P(ac - math.cos(a1) * r, 0.05, ys + math.sin(a1) * r), fr.P(ac - math.cos(a0) * r, 0.05, ys + math.sin(a0) * r)], 'ft_sand', uv=[(0, 0), (0.1, 0), (0.1, 0.1), (0, 0.1)], want=(fr.n[0], 0, fr.n[1]))
        if L > 3.0 and rnd.random() < 0.55:                                                                              # vedbend / vin ned ad muren (kun over hovedhøjde: 1,6–2,9 m)
            from ft_plants import card as _card
            k = rnd.uniform(0.5, 1.6)
            while k < L - 0.6:
                cx, cz = fr.W(k, 0.05); _card(S['fol'], 'fol_ivy', (cx, he - 0.55, cz), (u[0], 0.0, u[1]), (0.0, 1.0, 0.0), rnd.uniform(0.9, 1.5), rnd.uniform(1.0, 1.6)); k += rnd.uniform(2.2, 4.2)
        return
    if style == 'hallwall':
        vquad(W, fr, 0, L, 0, 0, 1.5, 'ft_stone', uoff); vquad(W, fr, 0, L, 0, 1.5, he, pm, uoff)
        obox(T, fr, 0, L, 0, 0.1, 1.5, 1.62, 'ft_ashlar', faces='ftlr', uoff=uoff); obox(T, fr, 0, L, 0, 0.14, he - 0.28, he, 'ft_ashlar', faces='fltrd', uoff=uoff)
        nb = max(1, int(round(L / 3.4))); bay = L / nb
        for k in range(nb):                                                                                               # blinde buer (stenramme, 0,06 m)
            ac = (k + 0.5) * bay; w = min(2.0, bay - 0.7)
            if w < 0.8: continue
            for xx in (ac - w / 2 - 0.08, ac + w / 2): obox(T, fr, xx, xx + 0.08, 0, 0.06, 0.0, 3.0, 'ft_ashlar', faces='fltr')
            obox(T, fr, ac - w / 2 - 0.08, ac + w / 2 + 0.08, 0, 0.06, 3.0, 3.18, 'ft_ashlar', faces='fltrd')
        if L > 4.5: wall_lantern(S, fr, L * rnd.uniform(0.3, 0.7), 3.1, rnd)
        return
    if style == 'twall':
        vquad(W, fr, 0, L, 0, 0, he, 'ft_ashlar', uoff)
        obox(T, fr, 0, L, 0, 0.1, 3.0, 3.22, 'ft_sand', faces='ftlr', uoff=uoff); obox(T, fr, 0, L, 0, 0.16, he - 0.3, he, 'ft_sand', faces='fltrd', uoff=uoff)
        nsl = max(0, int(L / 3.2))
        for k in range(nsl):
            a = (k + 0.5) * L / nsl; vquad(T, fr, a - 0.07, a + 0.07, 0.012, 1.4, 2.3, 'ft_pane')
            obox(T, fr, a - 0.1, a - 0.07, 0, 0.05, 1.4, 2.3, 'ft_sand', faces='fltr'); obox(T, fr, a + 0.07, a + 0.1, 0, 0.05, 1.4, 2.3, 'ft_sand', faces='fltr')
        return
    # ---- huse og lader
    base_h = 0.75 if style != 'fienile' else 0.0
    floor_h = 3.15 if floors == 2 else None
    if style == 'fienile':
        vquad(W, fr, 0, L, 0, 0, wall_top, 'ft_stone', uoff)
    else:
        vquad(W, fr, 0, L, 0, 0, base_h, 'ft_stone', uoff); vquad(W, fr, 0, L, 0, base_h, wall_top, pm, uoff)
        obox(T, fr, 0, L, 0, 0.08, base_h, base_h + 0.1, 'ft_ashlar', faces='ftlr', uoff=uoff)                         # sokkelbånd
    if L < 0.9: return
    if floor_h: obox(T, fr, 0, L, 0, 0.1, floor_h - 0.07, floor_h + 0.05, 'ft_ashlar', faces='fltrd', uoff=uoff)        # etagebånd
    obox(T, fr, 0, L, 0, 0.17, wall_top - 0.34, wall_top, 'ft_ashlar' if style != 'villa' else 'ft_sand', faces='fltrd', uoff=uoff)   # gesims under tagfoden (over hovedhøjde)
    if (first or last) and style in ('villa', 'casa'):                                                                  # hjørnesten (quoins)
        for (a0, a1) in (((0.0, 0.5),) if first else ()) + (((L - 0.5, L),) if last else ()):
            yy = base_h; k = 0
            while yy < wall_top - 0.4:
                obox(T, fr, a0, a1, 0, 0.05, yy, yy + 0.5, 'ft_sand', faces='fltr', uoff=uoff + k); yy += 0.55; k += 1
    # bugter: døre og vinduer
    nb = max(1, int(round(L / 3.0))); bay = L / nb
    door_bay = rnd.randrange(nb) if L >= 3.2 and style != 'fienile' else (rnd.randrange(nb) if nb >= 1 and L >= 4.0 else -1)
    for k in range(nb):
        a0, a1 = k * bay, (k + 1) * bay; ac = (a0 + a1) / 2; bw = bay - 0.5
        if style == 'fienile':
            if k == door_bay:                                              # stor staldport (rundbue) – lukket, med tunge plankedøre
                dw = min(2.4, bw); arch_door(T, fr, ac, dw, 3.1, rnd, 'ft_beam')
            else:
                ww = min(0.9, bw); vquad(T, fr, ac - ww / 2, ac + ww / 2, 0.012, 3.4, 4.3, 'ft_pane')
                obox(T, fr, ac - ww / 2 - 0.1, ac + ww / 2 + 0.1, 0, 0.08, 4.3, 4.43, 'ft_ashlar', faces='fltrd'); obox(T, fr, ac - ww / 2 - 0.1, ac + ww / 2 + 0.1, 0, 0.1, 3.3, 3.4, 'ft_ashlar', faces='fltrd')
                for xx in (ac - ww / 2 - 0.1, ac + ww / 2): obox(T, fr, xx, xx + 0.1, 0, 0.08, 3.4, 4.3, 'ft_ashlar', faces='fltr')
            continue
        if k == door_bay:
            dw = min(1.25, bw); dh = 2.35; arch_door(T, fr, ac, dw, dh, rnd); DOORS_LOG.append((fr.W(ac, 0.3), l))
            if rnd.random() < 0.7: wall_lantern(S, fr, ac + dw / 2 + 0.55, 2.55, rnd)
            continue
        gy0 = base_h + 0.35
        if floors == 2 or style == 'casa':
            ww = min(1.1, bw); window(T, fr, ac, ww, 1.45, gy0 + 0.55, rnd)
        else:
            ww = min(1.0, bw); window(T, fr, ac, ww, 1.25, gy0 + 0.45, rnd)
        if floor_h:
            uh = 1.5; window(T, fr, ac, min(1.0, bw), uh, floor_h + 0.55, rnd)
    # blomsterkrukker (terrakotta) på facaden: kun små, ≤ 0.1 m
    if style in ('casa', 'casetta') and L > 3.5 and rnd.random() < 0.5:
        from ft_plants import card as _card
        a = L * rnd.uniform(0.25, 0.75); cx, cz = fr.W(a, 0.12)
        _card(S['fol'], 'fol_rose', (cx, 1.0, cz), (u[0], 0.0, u[1]), (0.0, 1.0, 0.0), 0.9, 1.5)

def roof(l, S, rnd):
    """tag over parcellens stykker + udhæng mod gaden. Fælles tagprofil sikrer sammenhæng over hjørner/skillevægge. Flade stilarter får en kronesten-/hæktop."""
    style = l['style']; he = l['he']
    if style in ('hedge', 'swall', 'terrace', 'hallwall', 'twall'):
        mat = {'hedge': 'ft_hedge', 'swall': 'ft_ashlar', 'terrace': 'ft_ashlar', 'hallwall': 'ft_timber', 'twall': 'ft_ashlar'}[style]
        for pc in l['pieces']:
            pts = [(x, he, z) for (x, z) in pc]
            if len(pts) >= 3: S['trim'].poly(pts, mat, col=[(0.0, 0.0, 0.0, 1.0)] * len(pts), want=(0, 1, 0))
        return
    p0, p1 = l['front']; u = l['dir']; n = l['nout']; nw = (-n[0], -n[1]); L = l['L']; rp = l['rp']; he = l['he']
    pitch, sr, over = rp['pitch'], rp['sr'], rp['over']
    F, T = S['far'], S['trim']
    def s_of(p): return nw[0] * (p[0] - p0[0]) + nw[1] * (p[1] - p0[1])
    def a_of(p): return u[0] * (p[0] - p0[0]) + u[1] * (p[1] - p0[1])
    def y_of(s): return roof_y(he, rp, s)
    sz = tsz('ft_roof'); cs = math.sqrt(1 + pitch * pitch); uoff = hash2(round(p0[0] * 10), round(p0[1] * 10)) * 5.0
    tile = 'ft_roof'
    def face(poly, front):
        pts = []; uv = []; col = []
        for (x, z) in poly:
            s = s_of((x, z)); y = y_of(s); pts.append((x, y, z)); a = a_of((x, z))
            uv.append(((a + uoff) / sz, ((s + over) * cs if front else ((sr + over) + (s - sr)) * cs) / sz)); col.append(blend_at((x, y, z), 0.8))
        if len(pts) >= 3: F.poly(pts, tile, uv=uv, col=col, want=(0, 1, 0))
    for pc in l['pieces']:
        fr_poly = clip_poly(pc, lambda p: sr - s_of(p), True)
        rr_poly = clip_poly(pc, lambda p: s_of(p) - sr, True)
        if len(fr_poly) >= 3 and abs(polygon_area([(q[0], 0, q[1]) for q in fr_poly])) > 1e-4: face(fr_poly, True)
        if len(rr_poly) >= 3 and abs(polygon_area([(q[0], 0, q[1]) for q in rr_poly])) > 1e-4: face(rr_poly, False)
        xs = []
        for i in range(len(pc)):
            a, b = pc[i], pc[(i + 1) % len(pc)]; sa, sb = s_of(a) - sr, s_of(b) - sr
            if (sa > 1e-6 and sb < -1e-6) or (sa < -1e-6 and sb > 1e-6):
                t = sa / (sa - sb); xs.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
            elif abs(sa) <= 1e-6: xs.append(a)
        if len(xs) >= 2:
            xs.sort(key=a_of); ra, rb = xs[0], xs[-1]
            if math.hypot(rb[0] - ra[0], rb[1] - ra[1]) > 0.4:
                fr2 = Fr(ra, u, n); yr = y_of(sr); Lr = math.hypot(rb[0] - ra[0], rb[1] - ra[1])
                obox(T, fr2, 0, Lr, -0.2, 0.2, yr - 0.02, yr + 0.16, 'ft_roof_old', faces='fkltr')                           # kamtegl
    quad = l['quad']; q0 = quad[-1] if len(quad) == 4 else quad[2]; q1 = quad[2] if len(quad) == 4 else quad[2]
    def endvec(p, q):
        v = (q[0] - p[0], q[1] - p[1]); ln = math.hypot(*v)
        return (v[0] / ln, v[1] / ln) if ln > 1e-9 else nw
    e0 = endvec(p0, q0); e1 = endvec(p1, q1)
    c0 = max(0.3, e0[0] * nw[0] + e0[1] * nw[1]); c1 = max(0.3, e1[0] * nw[0] + e1[1] * nw[1])
    o0 = (p0[0] - e0[0] * over / c0, p0[1] - e0[1] * over / c0); o1 = (p1[0] - e1[0] * over / c1, p1[1] - e1[1] * over / c1)
    poly = [o0, o1, p1, p0]
    ok = (a_of(o1) - a_of(o0)) > 0.05 and polygon_area([(q[0], 0, q[1]) for q in poly]) != 0
    cr1 = (o1[0] - o0[0]) * (p1[1] - o1[1]) - (o1[1] - o0[1]) * (p1[0] - o1[0]); cr2 = (p1[0] - o1[0]) * (p0[1] - p1[1]) - (p1[1] - o1[1]) * (p0[0] - p1[0])
    cr3 = (p0[0] - p1[0]) * (o0[1] - p0[1]) - (p0[1] - p1[1]) * (o0[0] - p0[0]); cr4 = (o0[0] - p0[0]) * (o1[1] - o0[1]) - (o0[1] - p0[1]) * (o1[0] - o0[0])
    if not (ok and (cr1 > 0) == (cr2 > 0) == (cr3 > 0) == (cr4 > 0)):
        o0 = (p0[0] + n[0] * over, p0[1] + n[1] * over); o1 = (p1[0] + n[0] * over, p1[1] + n[1] * over); poly = [o0, o1, p1, p0]
    pts = []; uv = []; col = []
    for (x, z) in poly:
        s = s_of((x, z)); y = y_of(s); pts.append((x, y, z)); uv.append(((a_of((x, z)) + uoff) / sz, ((s + over) * cs) / sz)); col.append(blend_at((x, y, z), 0.8))
    F.poly(pts, tile, uv=uv, col=col, want=(0, 1, 0))
    wall_top = he + pitch * over
    yo = he - 0.2
    T.poly([(o0[0], yo, o0[1]), (o1[0], yo, o1[1]), (p1[0], wall_top - 0.2, p1[1]), (p0[0], wall_top - 0.2, p0[1])], 'ft_timber', uv=[(a_of(o0) / 1.6, 0), (a_of(o1) / 1.6, 0), (a_of(p1) / 1.6, over / 1.6), (a_of(p0) / 1.6, over / 1.6)], want=(0, -1, 0))
    T.poly([(o0[0], yo, o0[1]), (o1[0], yo, o1[1]), (o1[0], he + 0.03, o1[1]), (o0[0], he + 0.03, o0[1])], 'ft_roof_old', uv=[(0, 0), (L / 1.6, 0), (L / 1.6, 0.2), (0, 0.2)], want=(n[0], 0, n[1]))
    if L > 1.5:                                                                     # synlige spærender (hver 0,7 m) under udhænget
        k = max(1, int(L / 0.7)); ds = L / k; fr = Fr(p0, u, n)
        for i in range(k):
            a = ds * (i + 0.5); obox(T, fr, a - 0.05, a + 0.05, over - 0.45, over - 0.04, yo - 0.1, yo + 0.1, 'ft_timber', faces='fltd', uoff=0)

def seam(sm, S):
    """gavlvæg mellem to tage med forskellig højde: puds + tagkant langs tagets linje"""
    W, T = S['walls'], S['trim']; pts = [tuple(p) for p in sm['pts']]; n = sm['n']
    W.poly(pts, PLASTER.get(sm['style'], ['ft_plaster_a'])[0], want=(n[0], 0, n[1]))
    A, Bp, Bl, Al = pts; off = (n[0] * 0.025, 0.0, n[1] * 0.025)
    sh = lambda p, dy=0.0: (p[0] + off[0], p[1] + dy, p[2] + off[2])
    T.poly([sh(A), sh(Bp), sh(Bp, -0.18), sh(A, -0.18)], 'ft_roof_old', uv=[(0, 0), (1, 0), (1, 1), (0, 1)], want=(n[0], 0, n[1]))
    dxs, dzs = Bp[0] - A[0], Bp[2] - A[2]; Ls = math.hypot(dxs, dzs)
    for P0, P1 in ((A, Al), (Bp, Bl)):
        h = P0[1] - P1[1]
        if h > 0.5:
            L = Ls or 1.0; ux, uz = dxs / L, dzs / L; sgn = 1 if P0 is A else -1; w = 0.18
            q = [(P0[0] + off[0], P0[1] - 0.18, P0[2] + off[2]), (P0[0] + off[0] + ux * w * sgn, P0[1] - 0.18, P0[2] + off[2] + uz * w * sgn), (P1[0] + off[0] + ux * w * sgn, P1[1], P1[2] + off[2] + uz * w * sgn), (P1[0] + off[0], P1[1], P1[2] + off[2])]
            T.poly(q, 'ft_sand', uv=[(0, 0), (0.1, 0), (0.1, h / 1.6), (0, h / 1.6)], want=(n[0], 0, n[1]))

# --------------------------------------------------------------------------- tårnet (Udkigstårn): dæk, gange, trappe, gitre, loft, lamper
def tower(D, S):
    TW = D['tower']; T, W = S['trim'], S['walls']; y = TW['deck']; x0, x1, z0, z1, zs = TW['x0'], TW['x1'], TW['z0'], TW['z1'], TW['slab_z1']
    # dæk (planker) + undersiden (bjælkeloft)
    nz = int((zs - z0) / 0.2)
    for k in range(nz): T.box(x0, y - 0.05, z0 + k * (zs - z0) / nz, x1, y, z0 + (k + 1) * (zs - z0) / nz - 0.01, 'ft_deck', faces='t')
    ex0 = TW['east_x0']; ne = int((z1 - zs) / 0.2)
    for k in range(ne): T.box(ex0, y - 0.05, zs + k * (z1 - zs) / ne, x1, y, zs + (k + 1) * (z1 - zs) / ne - 0.01, 'ft_deck', faces='t')
    W.box(x0, 2.9, z0, x1, y - 0.05, zs, 'ft_plaster_b', faces='tb'); T.box(x0, 2.9, zs - 0.02, x1, y, zs + 0.0, 'ft_timber', faces='s')
    W.box(ex0, 2.9, zs, x1, y - 0.05, z1, 'ft_plaster_b', faces='tb'); T.box(ex0, 2.9, zs, ex0 + 0.0, y, z1, 'ft_timber', faces='w')
    for k in range(int((x1 - x0) / 1.8) + 1):                                                 # bjælker under loftet
        xx = x0 + 0.3 + k * 1.8
        if xx < x1 - 0.2: T.box(xx - 0.1, 2.62, z0, xx + 0.1, 2.9, zs, 'ft_beam')
    # kamme (merlons) og gitterhuller mod nord
    for (mx0, mz0, mx1, mz1) in TW['merlons']:
        T.box(mx0, y, mz0, mx1, 5.6, mz1, 'ft_ashlar', faces='nsewt'); T.box(mx0 - 0.04, 5.45, mz0 - 0.04, mx1 + 0.04, 5.6, mz1 + 0.04, 'ft_sand', faces='nsewt')
    for (gx0, gz0, gx1, gz1) in TW['grilles']:
        nb = max(2, int((gx1 - gx0) / 0.14))
        for k in range(nb + 1):
            xx = gx0 + k * (gx1 - gx0) / nb; T.box(xx - 0.012, y, gz0 + 0.02, xx + 0.012, y + 2.4, gz0 + 0.06, 'ft_iron', faces='nsewt')
        for yy in (y + 0.05, y + 1.2, y + 2.35): T.box(gx0, yy, gz0 + 0.02, gx1, yy + 0.04, gz0 + 0.07, 'ft_iron', faces='nsewtb')
    T.box(x0, y + 2.4, TW['z0'], x1, 5.6 if False else y + 2.4, TW['z0'] + 0.5, 'ft_sand', faces='t') if False else None
    # trappen (17 trin op mod øst) langs sydvæggen
    sx0, sz0, sx1, sz1 = TW['stair']; n = 17; run = (sx1 - sx0) / n; rise = y / n
    for i in range(n):
        xa, xb = sx0 + i * run, sx0 + (i + 1) * run; top = (i + 1) * rise
        T.box(xa, 0.0, sz0, xb, top, sz1, 'ft_ashlar', faces='nsewt')                                   # massive trin (intet hulrum under)
    # rækværk (1,1 m) langs dækkets sydkant + østkant
    for (rx0, rz0, rx1, rz1, rb, rh) in D['rails']:
        if rb < y - 0.01 or rz1 < 9.3 and rz0 < 9.3: continue                                    # (nordkanten er gitterhullerne ovenfor)
        Lr = math.hypot(rx1 - rx0, rz1 - rz0)
        if rh > 1.5:                                                                               # højt jerngitter (østkanten): lodrette stænger hver 0,14 m
            nbar = max(2, int(Lr / 0.14))
            for k in range(nbar + 1):
                t = k / nbar; px, pz = rx0 + (rx1 - rx0) * t, rz0 + (rz1 - rz0) * t; T.box(px - 0.012, rb, pz - 0.012, px + 0.012, rb + rh, pz + 0.012, 'ft_iron', faces='nsewt')
            for yy in (rb + 0.05, rb + rh * 0.5, rb + rh - 0.06): T.box(min(rx0, rx1) - 0.02, yy, min(rz0, rz1) - 0.02, max(rx0, rx1) + 0.02, yy + 0.04, max(rz0, rz1) + 0.02, 'ft_iron', faces='nsewtb')
        else:
            nbp = max(2, int(Lr / 1.2) + 1)
            for k in range(nbp):
                t = k / (nbp - 1); px, pz = rx0 + (rx1 - rx0) * t, rz0 + (rz1 - rz0) * t
                T.box(px - 0.035, rb, pz - 0.035, px + 0.035, rb + rh, pz + 0.035, 'ft_iron', faces='nsewt')
            for yy in (rb + rh * 0.45, rb + rh - 0.05): T.box(min(rx0, rx1) - 0.03, yy, min(rz0, rz1) - 0.03, max(rx0, rx1) + 0.03, yy + 0.05, max(rz0, rz1) + 0.03, 'ft_iron', faces='nsewtb')
    LAMPS.append(dict(x=(x0 + x1) / 2, y=2.3, z=(z0 + zs) / 2, w=320.0, i=1.4, range=8.0)); LAMPS.append(dict(x=ex0 + 1.4, y=2.3, z=(zs + z1) / 2 + 0.6, w=240.0, i=1.2, range=7.0))

# --------------------------------------------------------------------------- B-hallen (tinaiaen): gavltag med bjælker, loft, galleri med trappe og rækværk, buer ved indgangene
def hall(D, S):
    H = D['hall']; G = D['gallery']; T, W, F = S['trim'], S['walls'], S['far']
    x0, z0, x1, z1 = H['rect']; e = H['eave']; wt = H['wall_t']; rh = H['ridge_h']
    ax0, az0, ax1, az1 = x0 - 0.6, z0 - wt - 0.2, x1 + wt + 0.2, z1 + wt + 0.2
    cz = (z0 + z1) / 2; ridge = e + rh + 0.15
    sz = tsz('ft_roof'); cs = math.sqrt(1 + (rh / (cz - az0)) ** 2)
    def tri(a, b, c, mat='ft_roof'): F.poly([a, b, c], mat, uv=[(a[0] / sz, a[2] / sz), (b[0] / sz, b[2] / sz), (c[0] / sz, c[2] / sz)], want=(0, 1, 0))
    yeave = e - 0.1
    def quad(a, b, c, d, mat='ft_roof'): F.poly([a, b, c, d], mat, uv=[(a[0] / sz, 0), (b[0] / sz, 0), (c[0] / sz, (cz - az0) * cs / sz), (d[0] / sz, (cz - az0) * cs / sz)], want=(0, 1, 0))
    quad((ax0, yeave, az0), (ax1, yeave, az0), (ax1, ridge, cz), (ax0, ridge, cz)); quad((ax1, yeave, az1), (ax0, yeave, az1), (ax0, ridge, cz), (ax1, ridge, cz))
    T.box(ax0, ridge - 0.02, cz - 0.2, ax1, ridge + 0.18, cz + 0.2, 'ft_roof_old', faces='nsewt')
    # gavl mod vest (over indgangen): puds-trekant + stenramme
    W.poly([(x0, e, z0 - 0.0), (x0, e, z1), (x0, e + rh * (1 - 0.0), cz)], 'ft_plaster_b', want=(-1, 0, 0)) if False else None
    for (px, nx_) in ((ax0 + 0.6, -1), (ax1 - 0.2, 1)):
        W.poly([(px, e, z0 - wt), (px, e, z1 + wt), (px, ridge - 0.1, cz)], 'ft_plaster_b', want=(nx_, 0, 0))
    # loft (flade planker) og bjælker i hallen
    nzp = int((z1 - z0) / 0.2)
    W.box(x0 + 0.1, e - 0.06, z0, x1, e, z1, 'ft_deck', faces='b')                                                  # sammenhængende loft (ingen sprækker mod himlen)
    xx = x0 + 1.2
    while xx < x1 - 0.5:
        T.box(xx - 0.14, e - 0.38, z0, xx + 0.14, e - 0.05, z1, 'ft_beam'); xx += 3.2
    for zz in (z0 + 2.0, cz, z1 - 2.0): T.box(x0 + 0.1, e - 0.28, zz - 0.11, x1, e - 0.05, zz + 0.11, 'ft_beam')
    # tagets bjælker/spær synlige over loftet er skjult; udhæng-spærender mod nord/syd
    for k in range(int((ax1 - ax0) / 0.8)):
        xk = ax0 + 0.4 + k * 0.8; T.box(xk - 0.05, e - 0.28, az0, xk + 0.05, e - 0.05, az0 + 0.8, 'ft_timber', faces='nsewtb') if False else None
    # galleri: planker, bjælker, rækværk, trappe (kollision i layout)
    gx0, gx1, gz0, gz1, gy = G['x0'], G['x1'], G['z0'], G['z1'], G['y']
    nzp = int((gz1 - gz0) / 0.16)
    for k in range(nzp): T.box(gx0, gy - 0.07, gz0 + k * (gz1 - gz0) / nzp, gx1, gy, gz0 + (k + 1) * (gz1 - gz0) / nzp - 0.012, 'ft_deck', faces='t')
    T.box(gx0, gy - 0.3, gz0, gx1, gy - 0.07, gz1, 'ft_beam', faces='nsewtb')
    for px in (30.0, 36.0, 42.0, 48.0, 52.8): T.box(px - 0.17, 0.0, -37.25, px + 0.17, gy - 0.3, gz1 - 0.0 - 0.0, 'ft_timber', faces='nsewt')
    nposts = int((gx1 - gx0) / 1.3) + 1
    for k in range(nposts):
        xk = gx0 + k * (gx1 - gx0) / (nposts - 1); T.box(xk - 0.04, gy, gz1 - 0.1, xk + 0.04, gy + 1.0, gz1 - 0.02, 'ft_iron', faces='nsewt')
    for yy in (gy + 0.5, gy + 0.95): T.box(gx0, yy, gz1 - 0.08, gx1, yy + 0.05, gz1 - 0.03, 'ft_iron', faces='nsewtb')
    T.box(gx1 - 0.08, gy, gz0, gx1 - 0.02, gy + 1.0, gz1, 'ft_iron', faces='nsewtb')
    sx0, sx1 = G['sx0'], G['sx1']; n = 15; run = (sx1 - sx0) / n; rise = gy / n
    for i in range(n):
        xa, xb = sx0 + i * run, sx0 + (i + 1) * run; top = (i + 1) * rise; T.box(xa, 0.0, gz0, xb, top - 0.05, gz1, 'ft_beam', faces='nsew'); T.box(xa, top - 0.05, gz0, xb, top, gz1, 'ft_deck', faces='nsewt')
    for zz in (gz0, gz1 - 0.08): T.box(sx0, 0.0, zz, sx1, 0.1, zz + 0.08, 'ft_timber', faces='nsewt')
    for k in range(6):
        xk = sx0 + k * (sx1 - sx0) / 5; yy = (k / 5) * gy; T.box(xk - 0.04, yy, gz1 - 0.1, xk + 0.04, yy + 0.95, gz1 - 0.02, 'ft_iron', faces='nsewt')
    # lysekroner (jern + lys) og væglamper
    for xk in (33.0, 40.0, 47.0, 54.0):
        cx_, cz_ = xk, cz; T.box(cx_ - 0.02, e - 1.0, cz_ - 0.02, cx_ + 0.02, e - 0.05, cz_ + 0.02, 'ft_iron')
        cyl(T, cx_, cz_, 0.34, e - 1.12, e - 1.06, 'ft_iron', n=10, caps='tb'); cyl(T, cx_, cz_, 0.06, e - 1.06, e - 0.85, 'ft_brass', n=6, caps='tb')
        LAMPS.append(dict(x=cx_, y=e - 1.0, z=cz_, w=900.0, i=1.8, range=12.0))
    # indgangsbuer (stenbue-ramme over hallens vestlige åbning) – hele åbningen er gangareal, buen sidder over hovedhøjde (≥ 3,4 m)
    T.box(x0 - 0.2, 3.6, z0 - 0.0, x0 + 0.1, 3.9, z1, 'ft_ashlar', faces='nsewtb')

def build(D, S):
    for l in D['lots']:
        rnd = random.Random(1000 + l['ring'] * 7919 + l['edge'] * 131 + 17)
        facade(l, S, rnd); roof(l, S, rnd)
    for sm in D['seams']: seam(sm, S)
    tower(D, S); hall(D, S)
