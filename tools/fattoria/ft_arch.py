# ==========================================================================
# de_fattoria · arkitektur: tage (tegl), facade-detaljer (vinduer med skodder, sålbænke, hjørnesten, gesims), skorstene, døråbninger, arkader med buer, duetårn,
# pergola, lysskakter og kælderens hvælvribber. Alt udledt af layoutets bygninger/celler (ingen tilfældig placering – faste regler og faste afstande).
# ==========================================================================
import math, random
import numpy as np
from ft_geo import *
from ft_common import blend_at
from bld.common import MATS

LAMPS = []

def sides(b):
    x0, z0, x1, z1 = b['rect']
    return [('N', (x0, z0), (1, 0), (0, -1), x1 - x0), ('S', (x0, z1), (1, 0), (0, 1), x1 - x0), ('W', (x0, z0), (0, 1), (-1, 0), z1 - z0), ('E', (x1, z0), (0, 1), (1, 0), z1 - z0)]

def exposure(G, p0, u, n, L):
    """celler 0,4 m udenfor facaden: (a, gulvhøjde) hvor der er et gangbart gulv. a måles langs facaden fra p0."""
    out = []
    a = 0.25
    while a < L:
        x = p0[0] + u[0] * a + n[0] * 0.4; z = p0[1] + u[1] * a + n[1] * 0.4
        j, i = G.cz(z), G.cx(x)
        if 0 <= j < G.NZ and 0 <= i < G.NX and G.K[j, i] == 1: out.append((a, float(G.H[j, i])))
        a += 0.5
    return out

def wall_solid(G, x, z):
    j, i = G.cz(z), G.cx(x)
    return 0 <= j < G.NZ and 0 <= i < G.NX and G.K[j, i] == 0 and G.H[j, i] >= G.TOP - 0.01

# --------------------------------------------------------------------------- tage
def roof(b, S):
    M = S['far']; T = S['trim']; x0, z0, x1, z1 = b['rect']; e = b['eave']; r = b['rise']; kind = b['roof']; ov = 0.6
    mat = b.get('rmat', 'ft_roof'); sz = MATS[mat]['size'] or 1.5
    if kind == 'gable':
        ridge = b['ridge']
        if ridge == 'z':
            xm = (x0 + x1) / 2; hw = (x1 - x0) / 2; s = r / hw
            for (xa, xb, sg) in ((x0, xm, -1), (x1, xm, 1)):
                xe = xa - sg * ov * -1 if False else (xa + (-ov if sg < 0 else ov)); ye = e - s * ov
                Lsl = math.hypot(abs(xm - xe), r + s * ov)
                q = [(xe, ye, z1 + 0.3), (xe, ye, z0 - 0.3), (xm, e + r, z0 - 0.3), (xm, e + r, z1 + 0.3)]
                if sg > 0: q = [(xe, ye, z0 - 0.3), (xe, ye, z1 + 0.3), (xm, e + r, z1 + 0.3), (xm, e + r, z0 - 0.3)]
                M.poly(q, mat, uv=[(0, 0), (1.0 * (z1 - z0 + 0.6) / sz, 0), (1.0 * (z1 - z0 + 0.6) / sz, Lsl / sz), (0, Lsl / sz)], want=(sg * s, 1, 0), col=[(0.15, 0, 0, 1)] * 4)
                M.poly([(q[0][0], q[0][1] - 0.12, q[0][2]), (q[3][0], q[3][1] - 0.12, q[3][2]), (q[2][0], q[2][1] - 0.12, q[2][2]), (q[1][0], q[1][1] - 0.12, q[1][2])] if False else q[::-1], 'ft_timber', want=(-sg * s, -1, 0), col=[(0.1, 0, 0, 1)] * 4)
            for zz, nz in ((z0, -1), (z1, 1)):                                                   # gavltrekanter
                M.poly([(x0, e, zz), (x1, e, zz), (xm, e + r, zz)], b['mat'], want=(0, 0, nz), col=[(0.2, 0, 0, 1)] * 3)
            M.box(xm - 0.18, e + r - 0.02, z0 - 0.3, xm + 0.18, e + r + 0.2, z1 + 0.3, 'ft_roof_old')       # rygningssten
        else:
            zm = (z0 + z1) / 2; hw = (z1 - z0) / 2; s = r / hw
            for (za, sg) in ((z0, -1), (z1, 1)):
                ze = za + (-ov if sg < 0 else ov); ye = e - s * ov; Lsl = math.hypot(abs(zm - ze), r + s * ov)
                q = [(x0 - 0.3, ye, ze), (x1 + 0.3, ye, ze), (x1 + 0.3, e + r, zm), (x0 - 0.3, e + r, zm)]
                M.poly(q, mat, uv=[(0, 0), ((x1 - x0 + 0.6) / sz, 0), ((x1 - x0 + 0.6) / sz, Lsl / sz), (0, Lsl / sz)], want=(0, 1, sg * s), col=[(0.15, 0, 0, 1)] * 4)
                M.poly(q[::-1], 'ft_timber', want=(0, -1, -sg * s), col=[(0.1, 0, 0, 1)] * 4)
            for xx, nx in ((x0, -1), (x1, 1)):
                M.poly([(xx, e, z0), (xx, e, z1), (xx, e + r, zm)] if nx > 0 else [(xx, e, z1), (xx, e, z0), (xx, e + r, zm)], b['mat'], want=(nx, 0, 0), col=[(0.2, 0, 0, 1)] * 3)
            M.box(x0 - 0.3, e + r - 0.02, zm - 0.18, x1 + 0.3, e + r + 0.2, zm + 0.18, 'ft_roof_old')
    elif kind == 'hip':
        long_x = (x1 - x0) >= (z1 - z0)
        if long_x:
            hw = (z1 - z0) / 2; zm = (z0 + z1) / 2; d = hw; rx0, rx1 = x0 + d * 0.9, x1 - d * 0.9; s = r / hw
            if rx1 - rx0 < 0.5: rx0 = rx1 = (x0 + x1) / 2
            P4 = lambda a, b_, c, d_: M.poly([a, b_, c, d_], mat, uv=[(0, 0), (1, 0), (1, 1), (0, 1)], want=None)
            for (za, sg) in ((z0, -1), (z1, 1)):
                ze = za + (-ov if sg < 0 else ov); ye = e - s * ov; Lsl = math.hypot(abs(zm - ze), r + s * ov)
                q = [(x0 - ov, ye, ze), (x1 + ov, ye, ze), (rx1, e + r, zm), (rx0, e + r, zm)]
                M.poly(q, mat, uv=[(0, 0), ((x1 - x0 + 2 * ov) / sz, 0), ((rx1 - rx0 + 1.0) / sz, Lsl / sz), (0, Lsl / sz)], want=(0, 1, sg * s), col=[(0.15, 0, 0, 1)] * 4)
                M.poly(q[::-1], 'ft_timber', want=(0, -1, -sg * s), col=[(0.1, 0, 0, 1)] * 4)
            for (xa, sg, rxa) in ((x0, -1, rx0), (x1, 1, rx1)):
                xe = xa + (-ov if sg < 0 else ov); ye = e - s * ov; Lsl = math.hypot(abs(rxa - xe), r + s * ov)
                q = [(xe, ye, z0 - ov), (xe, ye, z1 + ov), (rxa, e + r, zm)]
                M.poly(q, mat, uv=[(0, 0), ((z1 - z0 + 2 * ov) / sz, 0), (0.5 * (z1 - z0) / sz, Lsl / sz)], want=(sg * s, 1, 0), col=[(0.15, 0, 0, 1)] * 3)
                M.poly(q[::-1], 'ft_timber', want=(-sg * s, -1, 0), col=[(0.1, 0, 0, 1)] * 3)
            if rx1 > rx0 + 0.3: M.box(rx0, e + r - 0.02, zm - 0.18, rx1, e + r + 0.2, zm + 0.18, 'ft_roof_old')
        else:
            hw = (x1 - x0) / 2; xm = (x0 + x1) / 2; d = hw; rz0, rz1 = z0 + d * 0.9, z1 - d * 0.9; s = r / hw
            if rz1 - rz0 < 0.5: rz0 = rz1 = (z0 + z1) / 2
            for (xa, sg) in ((x0, -1), (x1, 1)):
                xe = xa + (-ov if sg < 0 else ov); ye = e - s * ov; Lsl = math.hypot(abs(xm - xe), r + s * ov)
                q = [(xe, ye, z1 + ov), (xe, ye, z0 - ov), (xm, e + r, rz0), (xm, e + r, rz1)] if sg < 0 else [(xe, ye, z0 - ov), (xe, ye, z1 + ov), (xm, e + r, rz1), (xm, e + r, rz0)]
                M.poly(q, mat, uv=[(0, 0), ((z1 - z0 + 2 * ov) / sz, 0), ((rz1 - rz0 + 1.0) / sz, Lsl / sz), (0, Lsl / sz)], want=(sg * s, 1, 0), col=[(0.15, 0, 0, 1)] * 4)
                M.poly(q[::-1], 'ft_timber', want=(-sg * s, -1, 0), col=[(0.1, 0, 0, 1)] * 4)
            for (za, sg, rza) in ((z0, -1, rz0), (z1, 1, rz1)):
                ze = za + (-ov if sg < 0 else ov); ye = e - s * ov; Lsl = math.hypot(abs(rza - ze), r + s * ov)
                q = [(x0 - ov, ye, ze), (x1 + ov, ye, ze), (xm, e + r, rza)]
                M.poly(q, mat, uv=[(0, 0), ((x1 - x0 + 2 * ov) / sz, 0), (0.5 * (x1 - x0) / sz, Lsl / sz)], want=(0, 1, sg * s), col=[(0.15, 0, 0, 1)] * 3)
                M.poly(q[::-1], 'ft_timber', want=(0, -1, -sg * s), col=[(0.1, 0, 0, 1)] * 3)
            if rz1 > rz0 + 0.3: M.box(xm - 0.18, e + r - 0.02, rz0, xm + 0.18, e + r + 0.2, rz1, 'ft_roof_old')

# --------------------------------------------------------------------------- facader
STY = {'villa': dict(w=1.15, h=1.85, sp=3.5, floors=2), 'stable': dict(w=0.9, h=1.1, sp=4.0, floors=1), 'library': dict(w=1.05, h=2.0, sp=3.4, floors=2), 'mill': dict(w=0.95, h=1.3, sp=4.2, floors=1),
       'orangery': dict(w=1.7, h=3.0, sp=3.0, floors=1), 'shed': dict(w=0.0, h=0.0, sp=9.9, floors=1)}

def window(T, fr, a, w, h, ysill, st, rnd):
    """vindue: stenramme, sålbænk, mørk rude og åbne skodder"""
    obox(T, fr, a - w / 2 - 0.12, a + w / 2 + 0.12, 0, 0.14, ysill + h, ysill + h + 0.16, 'ft_ashlar', faces='fkltrd')
    obox(T, fr, a - w / 2 - 0.16, a + w / 2 + 0.16, 0, 0.24, ysill - 0.1, ysill, 'ft_ashlar', faces='fkltrd')
    obox(T, fr, a - w / 2 - 0.12, a - w / 2, 0, 0.1, ysill, ysill + h, 'ft_ashlar', faces='fkltrd')
    obox(T, fr, a + w / 2, a + w / 2 + 0.12, 0, 0.1, ysill, ysill + h, 'ft_ashlar', faces='fkltrd')
    vquad(T, fr, a - w / 2, a + w / 2, 0.015, ysill, ysill + h, 'ft_pane')
    # midterstolpe + tværsprosse
    obox(T, fr, a - 0.025, a + 0.025, 0.0, 0.05, ysill, ysill + h, 'ft_timber', faces='fkltrd'); obox(T, fr, a - w / 2, a + w / 2, 0.0, 0.05, ysill + h * 0.55 - 0.025, ysill + h * 0.55 + 0.025, 'ft_timber', faces='fkltrd')
    if st != 'orangery':
        sw = w / 2; col = 'ft_shutter' if rnd.random() < 0.7 else 'ft_shutter_b'
        obox(T, fr, a - w / 2 - 0.14 - sw, a - w / 2 - 0.14, 0.0, 0.055, ysill - 0.02, ysill + h + 0.02, col, faces='fkltrd')
        obox(T, fr, a + w / 2 + 0.14, a + w / 2 + 0.14 + sw, 0.0, 0.055, ysill - 0.02, ysill + h + 0.02, col, faces='fkltrd')

def shed_details(b, S, G):
    T = S['trim']; x0, z0, x1, z1 = b['rect']
    for (z, nz) in ((z1, 1), (z0, -1)):
        fr = Fr((x0, z), (1, 0), (0, nz)); xm = (x1 - x0) / 2
        obox(T, fr, xm - 0.55, xm + 0.55, 0, 0.1, G_y(G, (x0 + x1) / 2, z + nz * 0.4), G_y(G, (x0 + x1) / 2, z + nz * 0.4) + 2.0, 'ft_door', faces='fkltrd')
        obox(T, fr, xm - 0.7, xm + 0.7, 0, 0.14, G_y(G, (x0 + x1) / 2, z + nz * 0.4) + 2.0, G_y(G, (x0 + x1) / 2, z + nz * 0.4) + 2.2, 'ft_ashlar', faces='fkltrd')

def G_y(G, x, z):
    j, i = G.cz(z), G.cx(x); return float(G.H[j, i]) if 0 <= j < G.NZ and 0 <= i < G.NX else 0.0

def facades(b, S, G):
    T = S['trim']; W = S['walls']; st = b['style']; cfg = STY[st]; rnd = random.Random(hash(b['name']) & 0xffff)
    x0, z0, x1, z1 = b['rect']; e = b['eave']
    for (nm, p0, u, n, L) in sides(b):
        ex = exposure(G, p0, u, n, L)
        if not ex: continue
        fr = Fr(p0, u, n); exposed = {round(a, 2): y for a, y in ex}
        # cornice (gesims) under tagfoden langs de synlige dele
        runs = []; cur = None
        for a, y in ex:
            if cur and abs(a - cur[1]) < 0.6: cur[1] = a
            else:
                if cur: runs.append(cur)
                cur = [a, a, y]
        if cur: runs.append(cur)
        for (a0, a1, yg) in runs:
            if a1 - a0 < 0.8: continue
            obox(T, fr, a0 - 0.25, a1 + 0.25, 0, 0.26, e - 0.32, e, 'ft_ashlar', faces='fkltrd')                        # gesims
            if cfg['w'] > 0:
                nfl = cfg['floors']; fh = (e - 0.4 - yg) / nfl; k = 0; a = cfg['sp'] / 2
                while a < L:
                    if a0 + 0.9 <= a <= a1 - 0.9 and wall_solid(G, p0[0] + u[0] * a - n[0] * 0.3, p0[1] + u[1] * a - n[1] * 0.3):
                        okw = all(abs(exposed.get(round(aa, 2), -99) - yg) < 0.35 for aa in np.arange(max(0.25, a - 0.75), min(L, a + 0.75), 0.5) if round(aa, 2) in exposed)
                        okh = all(wall_solid(G, p0[0] + u[0] * (a + d) - n[0] * 0.3, p0[1] + u[1] * (a + d) - n[1] * 0.3) for d in (-0.6, 0.6))
                        if okw and okh:
                            for f in range(nfl):
                                ys = yg + f * fh + (0.95 if st != 'orangery' else 0.35)
                                if st == 'orangery' and f == 0: window(T, fr, a, cfg['w'], cfg['h'], ys, st, rnd)
                                elif st != 'orangery':
                                    h = cfg['h'] * (0.92 if f else 1.0); window(T, fr, a, cfg['w'], h, ys + (0.35 if f else 0), st, rnd)
                    a += cfg['sp']
            # sokkel (stenfod) langs facaden
            obox(W, fr, a0 - 0.0, a1 + 0.0, 0, 0.1, yg, yg + 0.7, 'ft_stone', faces='fkltr')
    # hjørnesten (quoins)
    if st in ('villa', 'library', 'stable', 'orangery'):
        for (cx_, cz_, sx, sz) in ((x0, z0, -1, -1), (x1, z0, 1, -1), (x0, z1, -1, 1), (x1, z1, 1, 1)):
            j, i = G.cz(cz_ + sz * 0.4), G.cx(cx_ + sx * 0.4)
            if not (0 <= j < G.NZ and 0 <= i < G.NX) or G.K[j, i] != 1: continue
            yg = float(G.H[j, i]); nb = int((e - 0.4 - yg) / 0.55)
            for k in range(nb):
                y0q = yg + k * 0.55; L1, L2 = (0.7, 0.4) if k % 2 == 0 else (0.4, 0.7)
                xa = cx_ - 0.06 if sx < 0 else cx_ - L1; xb = cx_ + L1 if sx < 0 else cx_ + 0.06
                za = cz_ - 0.06 if sz < 0 else cz_ - L2; zb = cz_ + L2 if sz < 0 else cz_ + 0.06
                T.box(xa, y0q, za, xb, y0q + 0.52, zb, 'ft_ashlar', faces='nsewt')

def openings(D, S, G):
    """stenrammer om døråbninger (jamber + overligger + sluttesten), fundet automatisk hvor et overlag med væg ovenpå møder åbent gulv"""
    T = S['trim']; UB, UT = G.UB, G.UT; edges = {}
    for j in range(G.NZ):
        for i in range(G.NX):
            if np.isnan(UB[j, i]) or UT[j, i] < G.TOP - 0.5 or G.BLDALL[j, i] == 0: continue
            for dj, di in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                j2, i2 = j + dj, i + di
                if not (0 <= j2 < G.NZ and 0 <= i2 < G.NX) or not np.isnan(UB[j2, i2]) or G.K[j2, i2] != 1: continue
                line = (j + (1 if dj > 0 else 0)) if dj != 0 else (i + (1 if di > 0 else 0)); pos = i if dj != 0 else j
                edges.setdefault((dj, di, line, round(float(UB[j, i]), 2), round(float(G.H[j, i]), 2)), []).append(pos)
    for (dj, di, line, ub, yh), lst in edges.items():
        lst.sort(); runs = []
        for p in lst:
            if runs and p - runs[-1][1] <= 1: runs[-1][1] = p
            else: runs.append([p, p])
        for a, c in runs:
            if dj != 0: fr = Fr((G.x(a), G.z(line)), (1, 0), (0, dj)); Lw = G.x(c + 1) - G.x(a)
            else: fr = Fr((G.x(line), G.z(a)), (0, 1), (di, 0)); Lw = G.z(c + 1) - G.z(a)
            if Lw < 0.9 or ub - yh > 8: continue
            obox(T, fr, -0.2, 0.0, 0, 0.18, yh, ub, 'ft_ashlar', faces='fkltrd')
            obox(T, fr, Lw, Lw + 0.2, 0, 0.18, yh, ub, 'ft_ashlar', faces='fkltrd')
            obox(T, fr, -0.2, Lw + 0.2, 0, 0.2, ub - 0.02, ub + 0.3, 'ft_ashlar', faces='fkltrd')
            obox(T, fr, Lw / 2 - 0.25, Lw / 2 + 0.25, 0, 0.26, ub - 0.02, ub + 0.42, 'ft_sand', faces='fkltrd')

# --------------------------------------------------------------------------- skorstene
def chimneys(D, S):
    T = S['trim']
    for b in D['buildings']:
        if b['style'] not in ('villa', 'library', 'mill'): continue
        x0, z0, x1, z1 = b['rect']; e = b['eave']; r = b['rise']
        for fx in ((0.22, 0.78) if b['style'] == 'villa' else (0.5,)):
            cx_ = x0 + (x1 - x0) * fx if b['ridge'] == 'x' else (x0 + x1) / 2; cz_ = (z0 + z1) / 2 if b['ridge'] == 'x' else z0 + (z1 - z0) * fx
            T.box(cx_ - 0.45, e + r - 0.4, cz_ - 0.45, cx_ + 0.45, e + r + 1.7, cz_ + 0.45, 'ft_stone'); T.box(cx_ - 0.6, e + r + 1.7, cz_ - 0.6, cx_ + 0.6, e + r + 1.95, cz_ + 0.6, 'ft_roof_old')

# --------------------------------------------------------------------------- arkader (søjler + buer)
def column(T, x, z, y0, y1, r=0.3):
    T.box(x - 0.42, y0, z - 0.42, x + 0.42, y0 + 0.3, z + 0.42, 'ft_ashlar')
    cyl(T, x, z, r, y0 + 0.3, y1 - 0.28, 'ft_marble_w', n=14, caps='')
    T.box(x - 0.36, y1 - 0.28, z - 0.36, x + 0.36, y1 - 0.1, z + 0.36, 'ft_ashlar'); T.box(x - 0.46, y1 - 0.1, z - 0.46, x + 0.46, y1, z + 0.46, 'ft_ashlar')

def arch_bay(T, W, xa, xb, y_spring, y_top, z, depth, axis, nrm, mat='ft_plaster_b'):
    """segmentbue mellem to søjler (i planen z = const for axis 'x', ellers x = const) + fyld op til loftet. xa..xb = søjlernes indersider."""
    n = 12; span = xb - xa; rise = min(0.62, (y_top - y_spring) - 0.05); R = (span * span / 4 + rise * rise) / (2 * rise)
    pts = []
    for k in range(n + 1):
        t = k / n; x = xa + span * t; yy = y_spring + rise - (R - math.sqrt(max(R * R - (x - (xa + xb) / 2) ** 2, 0)))
        pts.append((x, yy))
    for (nz, off) in ((1, depth / 2), (-1, -depth / 2)):                                           # forside + bagside
        for k in range(n):
            (x1_, y1_), (x2_, y2_) = pts[k], pts[k + 1]
            q = [(x1_, y1_, z + off), (x2_, y2_, z + off), (x2_, y_top, z + off), (x1_, y_top, z + off)] if axis == 'x' else [(z + off, y1_, x1_), (z + off, y2_, x2_), (z + off, y_top, x2_), (z + off, y_top - 0 + 0, x1_)]
            if axis == 'x': W.poly(q, mat, want=(0, 0, nz), col=[(0.2, 0, 0, 1)] * 4)
            else: W.poly([(z + off, y1_, x1_), (z + off, y2_, x2_), (z + off, y_top, x2_), (z + off, y_top, x1_)], mat, want=(nz, 0, 0), col=[(0.2, 0, 0, 1)] * 4)
    for k in range(n):                                                                           # intrados (undersiden af buen)
        (x1_, y1_), (x2_, y2_) = pts[k], pts[k + 1]
        if axis == 'x': W.poly([(x1_, y1_, z - depth / 2), (x2_, y2_, z - depth / 2), (x2_, y2_, z + depth / 2), (x1_, y1_, z + depth / 2)], mat, want=(0, -1, 0), col=[(0.2, 0, 0, 1)] * 4)
        else: W.poly([(z - depth / 2, y1_, x1_), (z - depth / 2, y2_, x2_), (z + depth / 2, y2_, x2_), (z + depth / 2, y1_, x1_)], mat, want=(0, -1, 0), col=[(0.2, 0, 0, 1)] * 4)

def arcades(D, S):
    T = S['trim']; W = S['walls']; YE = D['levels']['YE']
    cols = [c for c in D['cyls'] if c[5] == 'column']
    for (x, z, r, y0, y1, st) in cols:
        column(T, x, z, y0, y1, r)
    # buer: grupper søjler på en linje
    lines = {}
    for (x, z, r, y0, y1, st) in cols:
        if abs(z - round(z)) < 3 and z in (-35.8, -26.2): lines.setdefault(('z', z), []).append(x)
        if x in (-31.7, -10.3): lines.setdefault(('x', x), []).append(z)
    for (ax, line), lst in lines.items():
        lst.sort(); top = YE + (3.2 if (ax == 'z' and line == -35.8) else 3.7)
        for a, b in zip(lst[:-1], lst[1:]):
            if b - a > 3.4: continue
            arch_bay(T, W, a + 0.3, b - 0.3, YE + 2.45, top, line, 0.5, 'x' if ax == 'z' else 'z', 1)
    # altan-rækværk (smedejern) – baluster hvert 0,16 m
    for r_ in D['rails']:
        x0, z0, x1, z1, base, h, st = r_
        if st != 'iron': continue
        L = max(x1 - x0, z1 - z0)
        if L < 0.5: continue
        if (x1 - x0) >= (z1 - z0):
            zc = (z0 + z1) / 2; T.box(x0, base + h - 0.06, zc - 0.05, x1, base + h, zc + 0.05, 'ft_iron'); T.box(x0, base, zc - 0.04, x1, base + 0.08, zc + 0.04, 'ft_iron')
            k = int(L / 0.16)
            for q in range(k + 1): xx = x0 + L * q / max(1, k); T.box(xx - 0.012, base, zc - 0.012, xx + 0.012, base + h - 0.06, zc + 0.012, 'ft_iron')
        else:
            xc = (x0 + x1) / 2; T.box(xc - 0.05, base + h - 0.06, z0, xc + 0.05, base + h, z1, 'ft_iron'); T.box(xc - 0.04, base, z0, xc + 0.04, base + 0.08, z1, 'ft_iron')
            k = int(L / 0.16)
            for q in range(k + 1): zz = z0 + L * q / max(1, k); T.box(xc - 0.012, base, zz - 0.012, xc + 0.012, base + h - 0.06, zz + 0.012, 'ft_iron')

# --------------------------------------------------------------------------- duetårn (colombaia)
def tower(D, S):
    T = S['trim']; W = S['walls']; M = S['far']
    for d in D['decor']:
        if d['t'] != 'tower': continue
        pts = d['pts']; y0 = d['y']; e = y0 + 10.2; n = len(pts)
        cx_ = sum(p[0] for p in pts) / n; cz_ = sum(p[1] for p in pts) / n
        for i in range(n):
            a, b = pts[i], pts[(i + 1) % n]; mx, mz = (a[0] + b[0]) / 2 - cx_, (a[1] + b[1]) / 2 - cz_
            W.poly([(a[0], y0, a[1]), (b[0], y0, b[1]), (b[0], e, b[1]), (a[0], e, a[1])], 'ft_rubble', want=(mx, 0, mz), col=[(0.2, 0, 0, 1)] * 4)
        # gesims, buevinduer (dueåbninger) på hver anden side
        for i in range(n):
            a, b = pts[i], pts[(i + 1) % n]; L = math.hypot(b[0] - a[0], b[1] - a[1]); u = ((b[0] - a[0]) / L, (b[1] - a[1]) / L); nn = (u[1], -u[0])
            mx, mz = (a[0] + b[0]) / 2 - cx_, (a[1] + b[1]) / 2 - cz_
            if nn[0] * mx + nn[1] * mz < 0: nn = (-nn[0], -nn[1])
            fr = Fr(a, u, nn); obox(T, fr, -0.1, L + 0.1, 0, 0.3, e - 0.35, e, 'ft_ashlar', faces='fkltrd')
            obox(T, fr, L / 2 - 0.55, L / 2 + 0.55, 0, 0.12, y0 + 7.6, y0 + 9.2, 'ft_ashlar', faces='fkltrd'); vquad(T, fr, L / 2 - 0.4, L / 2 + 0.4, 0.14, y0 + 7.7, y0 + 9.1, 'ft_pane')
            obox(T, fr, L / 2 - 0.6, L / 2 + 0.6, 0, 0.3, y0 + 9.1, y0 + 9.3, 'ft_ashlar', faces='fkltrd')
        # kegletag
        rz = 3.4; apex = (cx_, e + rz, cz_)
        for i in range(n):
            a, b = pts[i], pts[(i + 1) % n]; o = 0.45
            ao = (cx_ + (a[0] - cx_) * (1 + o / 2.3), cz_ + (a[1] - cz_) * (1 + o / 2.3)); bo = (cx_ + (b[0] - cx_) * (1 + o / 2.3), cz_ + (b[1] - cz_) * (1 + o / 2.3))
            M.poly([(ao[0], e - 0.2, ao[1]), (bo[0], e - 0.2, bo[1]), apex], 'ft_roof', uv=[(0, 0), (1.5, 0), (0.75, 2.2)], want=((a[0] + b[0]) / 2 - cx_, 1, (a[1] + b[1]) / 2 - cz_), col=[(0.15, 0, 0, 1)] * 3)
        T.box(cx_ - 0.1, e + rz, cz_ - 0.1, cx_ + 0.1, e + rz + 0.9, cz_ + 0.1, 'ft_iron')

# --------------------------------------------------------------------------- pergola (smal gang mod trappehullet)
def pergola(D, S):
    T = S['trim']; F = S['fol']; YP = D['levels']['YP']
    # to rækker stolper (fra layoutets 'pergola_post'-cylindre) forbundet af tværbjælker + langbjælker; vinranker som løvkort
    posts = sorted([c for c in D['cyls'] if c[5] == 'pergola_post'], key=lambda c: c[1])
    xs = sorted(set(round(c[0], 1) for c in posts)); zs = sorted(set(round(c[1], 1) for c in posts))
    if len(xs) < 2: return
    ytop = YP + 3.1
    for (x, z, r, y0, y1, st) in posts: cyl(T, x, z, 0.14, y0, y1, 'ft_timber', n=8, caps='t')
    for z in zs: T.box(xs[0] - 0.4, ytop, z - 0.07, xs[-1] + 0.4, ytop + 0.18, z + 0.07, 'ft_timber')
    for x in xs: T.box(x - 0.07, ytop + 0.18, zs[0] - 0.4, x + 0.07, ytop + 0.3, zs[-1] + 0.4, 'ft_timber')
    k = 0; z = zs[0] - 0.3
    while z < zs[-1] + 0.4: T.box(xs[0] - 0.3, ytop + 0.3, z - 0.025, xs[-1] + 0.3, ytop + 0.36, z + 0.025, 'ft_timber'); z += 0.45
    return (xs, zs, ytop)

# --------------------------------------------------------------------------- lysskakter + kælder-ribber
def skylights(D, S):
    T = S['trim']; YP = D['levels']['YP']; C = D['levels']['CEILC']
    for d in D['decor']:
        if d['t'] != 'skylight': continue
        x0, z0, x1, z1 = d['x0'], d['z0'], d['x1'], d['z1']
        for (a, b, c, e_, nrm) in ((x0, z0, x1, z0, (0, 0, 1)), (x0, z1, x1, z1, (0, 0, -1)), (x0, z0, x0, z1, (1, 0, 0)), (x1, z0, x1, z1, (-1, 0, 0))):
            T.poly([(a, C, b), (c, C, e_), (c, YP, e_), (a, YP, b)], 'ft_ashlar', want=nrm, col=[(0.2, 0, 0, 1)] * 4)                            # skaktens sider (dækkets tykkelse)
        T.box(x0 - 0.16, YP, z0 - 0.16, x1 + 0.16, YP + 0.1, z0 - 0.02, 'ft_ashlar'); T.box(x0 - 0.16, YP, z1 + 0.02, x1 + 0.16, YP + 0.1, z1 + 0.16, 'ft_ashlar')
        T.box(x0 - 0.16, YP, z0 - 0.02, x0 - 0.02, YP + 0.1, z1 + 0.02, 'ft_ashlar'); T.box(x1 + 0.02, YP, z0 - 0.02, x1 + 0.16, YP + 0.1, z1 + 0.02, 'ft_ashlar')

def cellar(D, S, G):
    """hvælvribber af mursten mellem piller og vægge (højde = loftet), samt trækonsoller. Buer i planerne x = const og z = const."""
    T = S['trim']; C = D['levels']['CEILC']; YC = D['levels']['YC']
    piers = [c for c in D['cyls'] if c[5] == 'pier']
    for (x, z, r, y0, y1, st) in piers:
        T.box(x - 0.55, YC, z - 0.55, x + 0.55, YC + 0.35, z + 0.55, 'ft_stone'); T.box(x - 0.52, C - 0.5, z - 0.52, x + 0.52, C, z + 0.52, 'ft_stone')
        cyl(T, x, z, 0.5, YC + 0.35, C - 0.5, 'ft_vault', n=10, caps='')
    # ribber mellem pillerne (N-S og E-W) og mod væggene: segmentbue under loftet
    xs = sorted(set(c[0] for c in piers)); zs = sorted(set(c[1] for c in piers))
    def rib(a0, a1, line, axis):
        n = 10; span = a1 - a0; rise = 0.75; ys = C - rise
        for k in range(n):
            t0, t1 = k / n, (k + 1) / n
            def yy(t): return C - (rise * (1 - (2 * t - 1) ** 2)) * 0 - 0.0
            y0_ = ys + rise * (2 * t0 - 1) ** 2 * 1.0; y1_ = ys + rise * (2 * t1 - 1) ** 2 * 1.0
            p0 = a0 + span * t0; p1 = a0 + span * t1
            if axis == 'x': T.poly([(p0, y0_, line - 0.3), (p1, y1_, line - 0.3), (p1, y1_, line + 0.3), (p0, y0_, line + 0.3)], 'ft_vault', want=(0, -1, 0), col=[(0.2, 0, 0, 1)] * 4)
            else: T.poly([(line - 0.3, y0_, p0), (line - 0.3, y1_, p1), (line + 0.3, y1_, p1), (line + 0.3, y0_, p0)], 'ft_vault', want=(0, -1, 0), col=[(0.2, 0, 0, 1)] * 4)
    for (x, z, r, y0, y1, st) in piers:
        for (x2, z2, *_r) in piers:
            if x2 > x + 0.5 and abs(z2 - z) < 0.6 and x2 - x < 20: rib(x, x2, z, 'x')
            if z2 > z + 0.5 and abs(x2 - x) < 0.6 and z2 - z < 20: rib(z, z2, x, 'z')

def lamps(D, S):
    """lamper: (x, z, højde over gulv, watt) – bagt som varme punktlys (kælder, hal, bibliotek, stald, arkader, trapper); små jernlamper tegnes ved kælderlamperne"""
    T = S['trim']; L = D['levels']; YC, YB, YE = L['YC'], L['YB'], L['YE']
    LIST = [  # (x, z, base, h, w)
        (13, -8, YC, 2.3, 450), (18, -20.5, YC, 2.3, 450), (22, -6.8, YC, 2.3, 450), (26, -20.5, YC, 2.3, 450), (31, -6.8, YC, 2.3, 450), (34.5, -14, YC, 2.3, 450), (23, -14, YC, 2.3, 350), (28, -11, YC, 2.3, 300), (31, -19.5, YC, 2.3, 350),
        (12, -19.5, YB, 1.9, 250), (17, -19.5, YB, 1.9, 250), (6, -19.5, YC, 2.0, 250), (6, -14, YC, 1.4, 150), (32, -6.5, YC, 1.2, 250),
        (11, -30, 2.3, 1.2, 160), (11, -26, YB, 1.8, 200),
        (-23, -42, YE, 4.8, 700), (-23, -47, YE, 4.8, 500), (-5, -33, YE, 3.0, 300), (-5, -25, YE, 3.0, 300), (-1, -29, YE, 3.0, 220), (-40, -32, YE, 2.8, 260), (-40, -26, YE, 2.8, 260),
        (-28, -36.8, YE, 2.5, 160), (-18, -36.8, YE, 2.5, 160), (-12, -36.8, YE, 2.5, 160), (-28, -25.4, YE, 2.7, 120), (-16, -25.4, YE, 2.7, 120), (-32.6, -30.5, YE, 2.6, 120), (-9.6, -30.5, YE, 2.6, 120)]
    for (x, z, base, h, w) in LIST:
        yy = base + h
        if base == YC or (base == YB and h < 2.2): T.box(x - 0.06, yy - 0.3, z - 0.06, x + 0.06, yy + 0.1, z + 0.06, 'ft_iron'); T.box(x - 0.14, yy, z - 0.14, x + 0.14, yy + 0.26, z + 0.14, 'ft_brass')
        LAMPS.append(dict(x=x, y=yy + 0.15, z=z, w=w, i=1.4, range=9.0))

# --------------------------------------------------------------------------- indvendig udsmykning (fodlister, panel, billeder, loftsbjælker)
def interiors(D, S, G):
    """pudsede indervægge får fodliste + træpanel + lister + indrammede billeder; lofter i stuer/haller får synlige bjælker. Kun flade (≤ 5 cm) pynt på væggene – ingen usynlige hitbokser."""
    import ft_ground
    T = S['trim']; rnd = random.Random(77); UB, UK = G.UB, G.UK
    WALLS = {'ft_plaster_a', 'ft_plaster_b', 'ft_ochre_a', 'ft_ochre_b'}
    PIC = ['ft_book0', 'ft_book1', 'ft_book3', 'ft_book4', 'ft_curtain', 'ft_book5']
    nrun = npic = nbeam = 0
    for (axis, line, a0, a1, y0, y1, mat, nrm) in getattr(G, 'face_runs', []):
        if mat not in WALLS or y1 - y0 < 2.0 or a1 - a0 < 0.9: continue
        am = (a0 + a1) / 2; px, pz = (am, line + nrm * 0.3) if axis == 'x' else (line + nrm * 0.3, am)
        j, i = G.cz(pz), G.cx(px)
        if not (0 <= j < G.NZ and 0 <= i < G.NX) or G.K[j, i] != 1 or np.isnan(UB[j, i]) or UK[j, i] != 0: continue          # kun under et loft (indendørs)
        L = a1 - a0; fr = Fr((a0, line), (1, 0), (0, nrm)) if axis == 'x' else Fr((line, a0), (0, 1), (nrm, 0))
        obox(T, fr, 0, L, 0, 0.04, y0, y0 + 0.17, 'ft_timber', faces='fltrt')                           # fodliste
        obox(T, fr, 0, L, 0, 0.022, y0 + 0.17, y0 + 1.05, 'ft_deck', faces='fltr')                       # panel
        obox(T, fr, 0, L, 0, 0.06, y0 + 1.05, y0 + 1.12, 'ft_beam', faces='fltrt')                       # panellist
        hc = float(UB[j, i]) - y0
        if hc > 3.0 and y1 - y0 > 2.6: obox(T, fr, 0, L, 0, 0.07, float(UB[j, i]) - 0.2, float(UB[j, i]), 'ft_plaster_b', faces='fltrd')    # kronlist under loftet
        nrun += 1
        if L > 3.0 and hc > 2.9:
            n = int(L // 2.9); gap = L / n
            for k in range(n):
                a = gap * (k + 0.5); w, h = rnd.choice(((0.7, 0.9), (0.9, 0.65), (0.6, 0.8), (1.1, 0.8))); yc = y0 + 1.95
                obox(T, fr, a - w / 2 - 0.05, a + w / 2 + 0.05, 0, 0.05, yc - h / 2 - 0.05, yc + h / 2 + 0.05, 'ft_beam', faces='fltrtd')
                vquad(T, fr, a - w / 2, a + w / 2, 0.052, yc - h / 2, yc + h / 2, rnd.choice(PIC)); npic += 1
    # loftsbjælker: på tværs af korteste led, hver 2,4 m
    UBn = np.nan_to_num(UB, nan=-99.0); valid = (~np.isnan(UB)) & (UK == 0) & ((UB - G.H) > 2.4) & (G.K == 1)
    valid &= np.array([[G.styles[int(G.STYLE[j, i])] in ('plaster', 'ochre', 'stone') for i in range(G.NX)] for j in range(G.NZ)])
    key = np.full(UB.shape, -1, np.int64); ys = {}
    for j in range(G.NZ):
        for i in range(G.NX):
            if valid[j, i]: key[j, i] = ys.setdefault((round(float(UB[j, i]), 2),), len(ys))
    inv = {v: k for k, v in ys.items()}
    for (i0, j0, i1, j1, k) in ft_ground.rects(key, valid):
        yb = inv[k][0]; x0, z0, x1, z1 = G.x(i0), G.z(j0), G.x(i1), G.z(j1); w, d = x1 - x0, z1 - z0
        if min(w, d) < 3.0: continue
        if w >= d:
            xx = math.ceil(x0 / 2.4) * 2.4
            while xx < x1 - 0.2:
                if xx > x0 + 0.2: T.box(xx - 0.11, yb - 0.3, z0, xx + 0.11, yb, z1, 'ft_beam'); nbeam += 1
                xx += 2.4
        else:
            zz = math.ceil(z0 / 2.4) * 2.4
            while zz < z1 - 0.2:
                if zz > z0 + 0.2: T.box(x0, yb - 0.3, zz - 0.11, x1, yb, zz + 0.11, 'ft_beam'); nbeam += 1
                zz += 2.4
    print('[interior] vægstrækninger %d · billeder %d · bjælker %d' % (nrun, npic, nbeam))

def build(D, S):
    G = S['G']
    for b in D['buildings']:
        roof(b, S); facades(b, S, G)
        if b['style'] == 'shed': shed_details(b, S, G)
    chimneys(D, S); openings(D, S, G); arcades(D, S); tower(D, S); pergola(D, S); skylights(D, S); cellar(D, S, G); lamps(D, S); interiors(D, S, G)
