# ==========================================================================
# de_fattoria · terræn og mure fra højdefeltet (layout.py → out/fattoria_design.json): gulve, lodrette facader/stenmure, bakketerræn (skråninger omkring banen),
# dæk/lofter (øvre lag), ramper og trapper. Alt kommer fra de samme celler som kollisionen → intet svæver, intet er usynligt.
# ==========================================================================
import math, heapq
import numpy as np
from ft_common import blend_at, vnoise
from bld.common import MATS

SURF_MAT = {'gravel': 'ft_gravel', 'cobble': 'ft_cobble', 'soil': 'ft_soil', 'terracotta': 'ft_terra', 'brickfloor': 'ft_brickf', 'grass': 'ft_grass', 'marble': 'ft_marble', 'stone': 'ft_ashlar', 'wood': 'ft_floor', 'vineyard': 'ft_soil'}
STYLE_MAT = {'earth': 'ft_oldstone', 'stone': 'ft_stone', 'plaster': 'ft_plaster_a', 'brick': 'ft_vault', 'wood': 'ft_timber', 'hedge': 'ft_hedge', 'ochre': 'ft_ochre_a', 'marble': 'ft_marble', 'cellar': 'ft_vault'}
HILL_RISE = 0.11          # bakkens stigning bagved murene (m pr. m)
WALL_VIS = 3.0            # synlig højde af støttemure mod bakke

class Grid:
    def __init__(s, D):
        s.D = D; s.res = D['res']; s.X0 = D['X0']; s.Z0 = D['Z0']; s.NX = D['NX']; s.NZ = D['NZ']; s.TOP = D['top']
        s.H = np.array(D['H'], np.float32); s.K = np.array(D['K'], np.int8); s.SURF = np.array(D['SURF'], np.int8); s.STYLE = np.array(D['STYLE'], np.int8); s.BLD = np.array(D['BLD'], np.int16); s.BLDALL = np.array(D['BLDALL'], np.int16)
        s.UB = np.array([[np.nan if v is None else v for v in r] for r in D['UB']], np.float32); s.UT = np.array([[np.nan if v is None else v for v in r] for r in D['UT']], np.float32)
        s.UK = np.array(D['UK'], np.int8); s.USURF = np.array(D['USURF'], np.int8); s.surfs = D['surfs']; s.styles = D['styles']
        s.bld = D['buildings']; s.L = D['levels']
        s.hill = (s.K == 0) & (s.H >= s.TOP - 0.01) & (s.BLD == 0)
        s.skip = np.zeros_like(s.K, bool)
        for r in D['ramps']: s._mark(r[0], r[1], r[2], r[3])
        for r in D['stairs']: s._mark(r[0], r[1], r[2], r[3])
        s.cap = s._hill_heights()
    def cx(s, x): return int(round((x - s.X0) / s.res))
    def cz(s, z): return int(round((z - s.Z0) / s.res))
    def x(s, i): return s.X0 + i * s.res
    def z(s, j): return s.Z0 + j * s.res
    def _mark(s, x0, z0, x1, z1): s.skip[s.cz(z0):s.cz(z1), s.cx(x0):s.cx(x1)] = True
    def _hill_heights(s):
        """bakkens højde bag murene: nærmeste gulv + støttemurens højde + en rolig stigning udad (multi-kilde Dijkstra over cellerne)"""
        NZ, NX = s.NZ, s.NX; cap = np.full((NZ, NX), np.inf, np.float64); h = []
        for j in range(NZ):
            for i in range(NX):
                if s.K[j, i] == 1 and not np.isnan(s.H[j, i]) and s.H[j, i] > -50:
                    y = s.H[j, i]
                    # ramper/trapper: brug den højeste kant (muren skal være synlig over rampen)
                    cap[j, i] = y + WALL_VIS; heapq.heappush(h, (cap[j, i], j, i))
        for r in s.D['ramps']:
            for j in range(s.cz(r[1]), s.cz(r[3])):
                for i in range(s.cx(r[0]), s.cx(r[2])):
                    ya, yb = r[5], r[6]; t = ((s.z(j) - r[1]) / (r[3] - r[1])) if r[4] == 'z' else ((s.x(i) - r[0]) / (r[2] - r[0])); y = ya + (yb - ya) * min(max(t, 0), 1)
                    v = y + WALL_VIS
                    if v < cap[j, i] or True: cap[j, i] = v; heapq.heappush(h, (v, j, i))
        nb = [(1, 0, 1.0), (-1, 0, 1.0), (0, 1, 1.0), (0, -1, 1.0), (1, 1, 1.414), (1, -1, 1.414), (-1, 1, 1.414), (-1, -1, 1.414)]
        while h:
            c, j, i = heapq.heappop(h)
            if c > cap[j, i] + 1e-9: continue
            for dj, di, w in nb:
                j2, i2 = j + dj, i + di
                if not (0 <= j2 < NZ and 0 <= i2 < NX) or not s.hill[j2, i2]: continue
                v = c + HILL_RISE * w * s.res
                if v < cap[j2, i2] - 1e-9: cap[j2, i2] = v; heapq.heappush(h, (v, j2, i2))
        cap[np.isinf(cap)] = 8.0
        return cap
    def corner_y(s, j, i):
        """bakketerrænets højde i gitterpunkt (j, i) = middel af de omgivende bakke-celler"""
        v = []
        for dj in (-1, 0):
            for di in (-1, 0):
                a, b = j + dj, i + di
                if 0 <= a < s.NZ and 0 <= b < s.NX and s.hill[a, b]: v.append(s.cap[a, b])
        return float(np.mean(v)) if v else None

def rects(key, valid):
    """grådig sammensmeltning: key[j,i] (int, −1 = ingen) → [(i0, j0, i1, j1, key)] (halvåbne intervaller)"""
    NZ, NX = key.shape; used = ~valid.copy(); out = []
    for j in range(NZ):
        i = 0
        while i < NX:
            if used[j, i]: i += 1; continue
            k = key[j, i]; i1 = i
            while i1 + 1 < NX and not used[j, i1 + 1] and key[j, i1 + 1] == k: i1 += 1
            j1 = j
            while j1 + 1 < NZ and not used[j1 + 1, i:i1 + 1].any() and (key[j1 + 1, i:i1 + 1] == k).all(): j1 += 1
            used[j:j1 + 1, i:i1 + 1] = True; out.append((i, j, i1 + 1, j1 + 1, int(k))); i = i1 + 1
    return out

def building_mat(G, bid, default='ft_plaster_a'):
    return G.bld[bid - 1]['mat'] if bid and bid <= len(G.bld) else default

def tops(G, M, Mcap):
    """gulve: sammensmeltede rektangler pr. (højde, overflade) → 1,5 m-felter med blend-farver pr. hjørne"""
    H, K, SURF = G.H, G.K, G.SURF
    ys = {}; key = np.full(H.shape, -1, np.int64); valid = (K == 1) & (~G.skip)
    for j in range(G.NZ):
        for i in range(G.NX):
            if valid[j, i]:
                kk = (round(float(H[j, i]), 2), int(SURF[j, i])); key[j, i] = ys.setdefault(kk, len(ys))
    inv = {v: k for k, v in ys.items()}
    for (i0, j0, i1, j1, k) in rects(key, valid):
        y, sf = inv[k]; mat = SURF_MAT.get(G.surfs[sf], 'ft_cobble')
        M.grid(G.x(i0), G.z(j0), G.x(i1), G.z(j1), y, mat, step=1.5, colfn=lambda x, z, y=y: blend_at((x, y, z), 1.0), want=(0, 1, 0))
    # lave murtoppe (K=0 med endelig højde, ikke bygning)
    key = np.full(H.shape, -1, np.int64); valid = (K == 0) & (H < G.TOP - 0.01) & (G.BLD == 0) & (~G.skip); ys = {}
    for j in range(G.NZ):
        for i in range(G.NX):
            if valid[j, i]:
                kk = (round(float(H[j, i]), 2), int(G.STYLE[j, i])); key[j, i] = ys.setdefault(kk, len(ys))
    inv = {v: k for k, v in ys.items()}
    for (i0, j0, i1, j1, k) in rects(key, valid):
        y, st = inv[k]; nm = G.styles[st]
        mat = 'ft_hedge' if nm == 'hedge' else 'ft_ashlar' if nm in ('stone', 'earth') else STYLE_MAT.get(nm, 'ft_stone')
        Mcap.grid(G.x(i0), G.z(j0), G.x(i1), G.z(j1), y, mat, step=1.5, want=(0, 1, 0), colfn=lambda x, z, y=y: blend_at((x, y, z), 1.0))

def hill_top(G, M):
    """bakketerræn (græs/jord) over de massive celler – højde pr. gitterpunkt, glat og vandtæt mod murene"""
    NZ, NX = G.NZ, G.NX; cy = {}
    def cyf(j, i):
        k = (j, i)
        if k not in cy: cy[k] = G.corner_y(j, i)
        return cy[k]
    for j in range(NZ):
        for i in range(NX):
            if not G.hill[j, i]: continue
            c = [cyf(j, i), cyf(j, i + 1), cyf(j + 1, i + 1), cyf(j + 1, i)]
            if any(v is None for v in c): c = [G.cap[j, i]] * 4
            x0, x1, z0, z1 = G.x(i), G.x(i + 1), G.z(j), G.z(j + 1)
            pts = [(x0, c[0], z0), (x1, c[1], z0), (x1, c[2], z1), (x0, c[3], z1)]
            n = vnoise((x0 + x1) * 0.15, (z0 + z1) * 0.15)
            mat = 'ft_grass' if n > 0.42 else 'ft_soil'
            M.poly(pts[::-1], mat, col=[blend_at(p, 1.0) for p in pts[::-1]], want=(0, 1, 0))

def ground_y(G, x, z):
    """gulvhøjde (inkl. ramper) – bruges til at placere rekvisitter"""
    j, i = G.cz(z), G.cx(x)
    if not (0 <= j < G.NZ and 0 <= i < G.NX): return 0.0
    for r in G.D['ramps']:
        if r[0] - 1e-6 <= x <= r[2] + 1e-6 and r[1] - 1e-6 <= z <= r[3] + 1e-6:
            t = ((z - r[1]) / (r[3] - r[1])) if r[4] == 'z' else ((x - r[0]) / (r[2] - r[0])); return r[5] + (r[6] - r[5]) * t
    for s_ in G.D['stairs']:
        if s_[0] - 1e-6 <= x <= s_[2] + 1e-6 and s_[1] - 1e-6 <= z <= s_[3] + 1e-6:
            t = ((z - s_[1]) / (s_[3] - s_[1])) if s_[4] == 'z' else ((x - s_[0]) / (s_[2] - s_[0])); return s_[5] + (s_[6] - s_[5]) * t
    return float(G.H[j, i])

def faces(G, W):
    """lodrette flader (mure, facader, støttemure) mellem et gangbart gulv og en højere nabocelle. Sammensmeltes langs kanten."""
    H, K = G.H, G.K; segs = {}                # (akse, linje, y0, y1, stil/materiale) → liste af (a0, a1)
    def add(axis, line, a0, a1, y0, y1, mat, nrm):
        if y1 - y0 < 0.02: return
        segs.setdefault((axis, round(line, 3), round(y0, 3), round(y1, 3), mat, nrm), []).append((a0, a1))
    for j in range(G.NZ):
        for i in range(G.NX):
            if K[j, i] != 1: continue
            yl = float(H[j, i]); ub = G.UB[j, i]
            for dj, di in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                j2, i2 = j + dj, i + di
                if not (0 <= j2 < G.NZ and 0 <= i2 < G.NX): continue
                hn = float(H[j2, i2])
                if hn - yl <= 0.02: continue
                if G.skip[j, i] and K[j2, i2] == 1: continue                    # trappe-/rampe-celle mod højere gulv: trapper/ramper tegner selv
                bid = int(G.BLD[j2, i2]); st = G.styles[int(G.STYLE[j2, i2])]
                top = hn
                if G.hill[j2, i2]: top = float(G.cap[j2, i2])
                elif bid: top = min(hn, G.bld[bid - 1]['eave'])
                if not np.isnan(ub): top = min(top, float(ub))                   # under et dæk går væggen kun op til loftet
                if top - yl <= 0.02: continue
                mat = building_mat(G, bid) if (bid or st == 'plaster') else STYLE_MAT.get(st, 'ft_stone')
                if st == 'ochre' and not bid: mat = 'ft_ochre_a'
                # kantens placering og normal (peger mod gulvcellen)
                if dj != 0:                                                       # kant langs x, normal ±z
                    line = G.z(j + (1 if dj > 0 else 0)); add('x', line, G.x(i), G.x(i + 1), yl, top, mat, -dj)
                else:
                    line = G.x(i + (1 if di > 0 else 0)); add('z', line, G.z(j), G.z(j + 1), yl, top, mat, -di)
    G.face_runs = []
    for (axis, line, y0, y1, mat, nrm), lst in segs.items():
        lst.sort(); merged = []
        for a0, a1 in lst:
            if merged and abs(merged[-1][1] - a0) < 1e-6: merged[-1][1] = a1
            else: merged.append([a0, a1])
        sz = (MATS[mat].get('size') or 2.0) if mat in MATS else 2.0
        for a0, a1 in merged:
            G.face_runs.append((axis, line, a0, a1, y0, y1, mat, nrm))
            if axis == 'x':
                pts = [(a0, y0, line), (a1, y0, line), (a1, y1, line), (a0, y1, line)]; want = (0, 0, nrm); uvu = (a0, a1)
            else:
                pts = [(line, y0, a0), (line, y0, a1), (line, y1, a1), (line, y1, a0)]; want = (nrm, 0, 0); uvu = (a0, a1)
            uv = [(uvu[0] / sz, y0 / sz), (uvu[1] / sz, y0 / sz), (uvu[1] / sz, y1 / sz), (uvu[0] / sz, y1 / sz)]
            # opdel høje flader i bånd à 1,5 m så vertex-lys/lysmap har målepunkter og blend følger højden
            bands = max(1, int(math.ceil((y1 - y0) / 1.5)))
            for b in range(bands):
                ya, yb = y0 + (y1 - y0) * b / bands, y0 + (y1 - y0) * (b + 1) / bands
                if axis == 'x': q = [(a0, ya, line), (a1, ya, line), (a1, yb, line), (a0, yb, line)]
                else: q = [(line, ya, a0), (line, ya, a1), (line, yb, a1), (line, yb, a0)]
                uvq = [(uvu[0] / sz, ya / sz), (uvu[1] / sz, ya / sz), (uvu[1] / sz, yb / sz), (uvu[0] / sz, yb / sz)]
                W.poly(q, mat, uv=uvq, want=want, col=[blend_at(p, 0.0) for p in q])

def overlays(G, M, Mtop, Mceil):
    """øvre lag: dæk over kælderen (oversiden er terrassen), lofter i haller/arkader (undersiden), tage over arkader. Sammensmeltes."""
    UB, UT = G.UB, G.UT; valid = ~np.isnan(UB)
    ys = {}; key = np.full(UB.shape, -1, np.int64)
    for j in range(G.NZ):
        for i in range(G.NX):
            if valid[j, i]:
                kk = (round(float(UB[j, i]), 2), round(float(UT[j, i]), 2), int(G.UK[j, i]), int(G.USURF[j, i]), int(G.STYLE[j, i])); key[j, i] = ys.setdefault(kk, len(ys))
    inv = {v: k for k, v in ys.items()}
    for (i0, j0, i1, j1, k) in rects(key, valid):
        yb, yt, walk, us, st = inv[k]; nm = G.styles[st]
        x0, z0, x1, z1 = G.x(i0), G.z(j0), G.x(i1), G.z(j1)
        # undersiden (loft): hvælvede kældre = mursten, ellers pudset/træ
        cmat = 'ft_vault' if nm == 'cellar' else 'ft_timber' if nm == 'wood' else 'ft_plaster_b'
        Mceil.grid(x0, z0, x1, z1, yb, cmat, step=1.5, want=(0, -1, 0), colfn=lambda x, z, y=yb: (0.1, 0.0, 0.0, 1.0))
        if walk:
            Mtop.grid(x0, z0, x1, z1, yt, SURF_MAT.get(G.surfs[us], 'ft_terra'), step=1.5, want=(0, 1, 0), colfn=lambda x, z, y=yt: blend_at((x, y, z), 1.0))
        elif yt < G.TOP - 0.5:
            Mtop.grid(x0, z0, x1, z1, yt, 'ft_roof_old', step=1.5, want=(0, 1, 0))
    # sider af dæk/tag mod åbent rum (kanter hvor naboen ikke har dæk og er lavere end dækkets underside)
    for j in range(G.NZ):
        for i in range(G.NX):
            if not valid[j, i]: continue
            yb, yt = float(UB[j, i]), float(UT[j, i])
            if yt >= G.TOP - 0.5: continue
            for dj, di in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                j2, i2 = j + dj, i + di
                if not (0 <= j2 < G.NZ and 0 <= i2 < G.NX) or valid[j2, i2]: continue
                if G.K[j2, i2] != 1 and G.H[j2, i2] >= yt - 0.05: continue       # naboen er massiv til/over dækkets overside
                # kant
                if dj != 0:
                    line = G.z(j + (1 if dj > 0 else 0)); q = [(G.x(i), yb, line), (G.x(i + 1), yb, line), (G.x(i + 1), yt, line), (G.x(i), yt, line)]; want = (0, 0, dj)
                else:
                    line = G.x(i + (1 if di > 0 else 0)); q = [(line, yb, G.z(j)), (line, yb, G.z(j + 1)), (line, yt, G.z(j + 1)), (line, yt, G.z(j))]; want = (di, 0, 0)
                Mtop.poly(q, 'ft_ashlar', want=want, col=[(0.15, 0.0, 0.0, 1.0)] * 4)


def side_info(G, px, pz, y_from):
    """(top, mat) for en højere nabocelle ved siden af en trappe/rampe – ellers None (så pit-siderne ikke står åbne mod himlen)"""
    j, i = G.cz(pz), G.cx(px)
    if not (0 <= j < G.NZ and 0 <= i < G.NX): return None
    hn = float(G.H[j, i])
    if G.K[j, i] != 1 or hn - y_from <= 0.05: return None                 # (K = 0-naboer har allerede mure fra faces())
    bid = int(G.BLD[j, i]); st = G.styles[int(G.STYLE[j, i])]
    top = hn
    if G.hill[j, i]: top = float(G.cap[j, i])
    elif bid: top = min(hn, G.bld[bid - 1]['eave'])
    ub = G.UB[j, i]
    if not np.isnan(ub): top = min(top, float(ub))
    if top - y_from <= 0.05: return None
    mat = building_mat(G, bid) if (bid or st == 'plaster') else STYLE_MAT.get(st, 'ft_stone')
    if st == 'ochre' and not bid: mat = 'ft_ochre_a'
    return top, mat

def side_quad(G, W, axis, line, a0, a1, y0a, y0b, top, mat, nrm):
    """lodret sidevæg langs en trappe/rampe: bund følger trinnet/rampen (y0a ved a0, y0b ved a1), top er nabocellens kant"""
    sz = (MATS[mat].get('size') or 2.0) if mat in MATS else 2.0
    ym = max(y0a, y0b); bands = max(1, int(math.ceil((top - min(y0a, y0b)) / 1.5)))
    for b in range(bands):
        fa, fb = b / bands, (b + 1) / bands
        ya0, yb0 = y0a + (top - y0a) * fa, y0a + (top - y0a) * fb          # bånd ved a0
        ya1, yb1 = y0b + (top - y0b) * fa, y0b + (top - y0b) * fb          # bånd ved a1
        if axis == 'x': q = [(a0, ya0, line), (a1, ya1, line), (a1, yb1, line), (a0, yb0, line)]; want = (0, 0, nrm)
        else: q = [(line, ya0, a0), (line, ya1, a1), (line, yb1, a1), (line, yb0, a0)]; want = (nrm, 0, 0)
        uv = [(a0 / sz, q[0][1] / sz), (a1 / sz, q[1][1] / sz), (a1 / sz, q[2][1] / sz), (a0 / sz, q[3][1] / sz)]
        W.poly(q, mat, uv=uv, want=want, col=[blend_at(p, 0.0) for p in q])

def ramps(G, M, Mw):
    """sluttede rampe-overflader (skrå flader) + sidevægge mod lavere naboceller"""
    for (x0, z0, x1, z1, axis, ya, yb, surf) in G.D['ramps']:
        mat = SURF_MAT.get(surf, 'ft_gravel'); nx = max(1, int(round((x1 - x0) / 1.5))); nz = max(1, int(round((z1 - z0) / 1.5)))
        def Y(x, z): t = ((z - z0) / (z1 - z0)) if axis == 'z' else ((x - x0) / (x1 - x0)); return ya + (yb - ya) * t
        xs = [x0 + (x1 - x0) * k / nx for k in range(nx + 1)]; zs = [z0 + (z1 - z0) * k / nz for k in range(nz + 1)]
        for j in range(nz):
            for i in range(nx):
                p = [(xs[i], Y(xs[i], zs[j + 1]), zs[j + 1]), (xs[i + 1], Y(xs[i + 1], zs[j + 1]), zs[j + 1]), (xs[i + 1], Y(xs[i + 1], zs[j]), zs[j]), (xs[i], Y(xs[i], zs[j]), zs[j])]
                M.poly(p, mat, col=[blend_at(q, 1.0) for q in p], want=(0, 1, 0))
        # sidevægge mod højere naboer (langs rampens langsider)
        edges = [(x0, -1), (x1, 1)] if axis == 'z' else [(z0, -1), (z1, 1)]
        for (ev, sgn) in edges:
            seg = zs if axis == 'z' else xs
            for k in range(len(seg) - 1):
                a0, a1 = seg[k], seg[k + 1]; am = (a0 + a1) / 2
                px, pz = (ev + sgn * 0.3, am) if axis == 'z' else (am, ev + sgn * 0.3)
                ya, yb_ = (Y(ev, a0), Y(ev, a1)) if axis == 'z' else (Y(a0, ev), Y(a1, ev))
                inf = side_info(G, px, pz, max(ya, yb_))
                if inf: side_quad(G, Mw, 'z' if axis == 'z' else 'x', ev, a0, a1, ya, yb_, inf[0], inf[1], -sgn)

def stairs(G, M, W=None):
    """trin: hver trin har en overside (trædeflade) og et stødtrin mod den lave ende; langsiderne tegnes hvor naboen er lavere end trinnet"""
    for (x0, z0, x1, z1, axis, ya, yb, n, style) in G.D['stairs']:
        lo = min(ya, yb); rise = abs(yb - ya); L = (x1 - x0) if axis == 'x' else (z1 - z0); asc_pos = yb > ya
        step = L / n
        def side_level(px, pz):
            j, i = G.cz(pz), G.cx(px)
            if not (0 <= j < G.NZ and 0 <= i < G.NX): return 99.0
            return float(G.H[j, i]) if (G.K[j, i] == 1 or G.H[j, i] < G.TOP - 0.01) else 99.0
        for k in range(1, n + 1):
            top = lo + rise * k / n; prev = lo + rise * (k - 1) / n
            if asc_pos: s0, s1 = (k - 1) * step, k * step; riser_at = s0; rn = -1
            else: s0, s1 = L - k * step, L - (k - 1) * step; riser_at = s1; rn = 1
            a0, a1 = s0, s1
            if axis == 'x':
                X0_, X1_ = x0 + a0, x0 + a1; rx = x0 + riser_at
                M.poly([(X0_, top, z0), (X1_, top, z0), (X1_, top, z1), (X0_, top, z1)], 'ft_ashlar', want=(0, 1, 0), col=[(0.25, 0.0, 0.0, 1)] * 4)
                M.poly([(rx, prev, z0), (rx, prev, z1), (rx, top, z1), (rx, top, z0)], 'ft_ashlar', want=(rn, 0, 0), col=[(0.3, 0.0, 0.0, 1)] * 4)
                for (zz, nz_) in ((z0, -1), (z1, 1)):                                   # langsider
                    nb = side_level((X0_ + X1_) / 2, zz + nz_ * 0.3)
                    if nb < top - 0.05:
                        M.poly([(X0_, max(nb, lo - 0.01), zz), (X1_, max(nb, lo - 0.01), zz), (X1_, top, zz), (X0_, top, zz)], 'ft_ashlar', want=(0, 0, nz_), col=[(0.3, 0.0, 0.0, 1)] * 4)
                    elif W is not None:
                        inf = side_info(G, (X0_ + X1_) / 2, zz + nz_ * 0.3, prev)
                        if inf: side_quad(G, W, 'x', zz, X0_, X1_, prev, prev, inf[0], inf[1], -nz_)
            else:
                Z0_, Z1_ = z0 + a0, z0 + a1; rz = z0 + riser_at
                M.poly([(x0, top, Z0_), (x1, top, Z0_), (x1, top, Z1_), (x0, top, Z1_)], 'ft_ashlar', want=(0, 1, 0), col=[(0.25, 0.0, 0.0, 1)] * 4)
                M.poly([(x0, prev, rz), (x1, prev, rz), (x1, top, rz), (x0, top, rz)], 'ft_ashlar', want=(0, 0, rn), col=[(0.3, 0.0, 0.0, 1)] * 4)
                for (xx, nx_) in ((x0, -1), (x1, 1)):
                    nb = side_level(xx + nx_ * 0.3, (Z0_ + Z1_) / 2)
                    if nb < top - 0.05:
                        M.poly([(xx, max(nb, lo - 0.01), Z0_), (xx, max(nb, lo - 0.01), Z1_), (xx, top, Z1_), (xx, top, Z0_)], 'ft_ashlar', want=(nx_, 0, 0), col=[(0.3, 0.0, 0.0, 1)] * 4)
                    elif W is not None:
                        inf = side_info(G, xx + nx_ * 0.3, (Z0_ + Z1_) / 2, prev)
                        if inf: side_quad(G, W, 'z', xx, Z0_, Z1_, prev, prev, inf[0], inf[1], -nx_)
