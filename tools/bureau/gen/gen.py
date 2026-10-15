# ==========================================================================
# Ascension Agency – bygger banen som rigtig bygning ud fra overblikkets analyse (data/map.json + data/raster.npz).
#   blender -b --factory-startup -P tools/map/build_map.py
#   → assets/maps/ascension/ascension.glb      synlig geometri (én mesh pr. materiale, verdens-UV i meter)
#     assets/maps/ascension/collision.glb      kollision (trapper som glatte skrå flader – CS-agtig bevægelse)
#     assets/maps/ascension/ascension.json     lys, spawns, sites, rum
# Celler: 1 px = 0,12 m. Spil-koordinater: X = øst, Y = op, Z = syd. Blender: (X, −Z, Y) – glTF-eksporten vender tilbage.
# ==========================================================================
import json, math, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
from rooms import ROOMS, FACADE_TOP, ATRIUM_H, PARAPET

M = json.load(open(os.path.join(HERE, 'data', 'map.json'))); R = np.load(os.path.join(HERE, 'data', 'raster.npz'))
S, CX, CY = M['S'], M['CX'], M['CY']
ZID = R['zid'].astype(np.int32); H, W = ZID.shape
WALL0 = R['wall'].copy()
# elevatorkernen midt i elevatorlobbyen (Mid T): bryder den lige sigtelinje fra tagterrassen gennem atriet til parkeringskælderen
# og giver dækning – gangen går uden om på begge sider (4,0 m mod vest, 3,4 m mod øst)
for (x0_, z0_, x1_, z1_) in M.get('cores', [[9.2, 18.6, 14.6, 21.4]]):
    i0_, i1_, j0_, j1_ = int(z0_ / S + CY), int(z1_ / S + CY), int(x0_ / S + CX), int(x1_ / S + CX)
    ZID[i0_:i1_, j0_:j1_] = -1; WALL0[i0_:i1_, j0_:j1_] = True
ZN = [z['name'] for z in M['zones']]; ZY = np.array([z['y'] for z in M['zones']], np.float32)
WALK = ZID >= 0
cx = lambda j: (j - CX) * S
cz = lambda i: (i - CY) * S
for n in ZN: assert n in ROOMS, 'rum mangler i rooms.py: ' + n

# ---------------------------------------------------------------- højdefelter
F = np.where(WALK, R['fy'], np.nan).astype(np.float64)            # gulv (synligt: trapper i trin)
FC = F.copy()                                                     # gulv til kollision (trapper glatte)
SLOPE = np.full((H, W), -1, np.int32)                             # skrå flade (rampe, eller trappe i kollisionen)
STEPS = np.zeros((H, W), bool)
TR = [dict(t, kind='stairs') for t in M['stairs']] + [dict(t, kind='ramp') for t in M['ramps']]
for k, t in enumerate(TR):
    x0, y0, x1, y1 = t['r']; blk = WALK[y0:y1, x0:x1]
    ii, jj = np.nonzero(blk)
    if not len(ii): continue
    L = (y1 - y0) if t['axis'] == 'z' else (x1 - x0)
    tt = ((ii + 0.5) / L) if t['axis'] == 'z' else ((jj + 0.5) / L)
    smooth = t['ya'] + (t['yb'] - t['ya']) * tt
    FC[y0 + ii, x0 + jj] = smooth; SLOPE[y0 + ii, x0 + jj] = k
    if t['kind'] == 'ramp':
        F[y0 + ii, x0 + jj] = smooth
    else:
        n = max(2, int(round(abs(t['yb'] - t['ya']) / 0.17)))
        kk = np.clip(np.floor(tt * (n + 1)), 0, n)
        F[y0 + ii, x0 + jj] = t['ya'] + (t['yb'] - t['ya']) * kk / n; STEPS[y0 + ii, x0 + jj] = True
RAMP = (SLOPE >= 0) & ~STEPS

# loft: rummets loft, men altid mindst 2,7 m over gulvet (loftet følger trapper der går op over rummets niveau)
C = np.full((H, W), np.nan)
OUT = np.zeros((H, W), bool); ATR = np.zeros((H, W), bool)
for zi, n in enumerate(ZN):
    r = ROOMS[n]; m = ZID == zi
    if r['h'] is None: OUT |= m; continue
    if r['h'] == 'atrium': C[m] = ZY[zi] + ATRIUM_H; ATR |= m; continue
    C[m] = np.maximum(ZY[zi] + r['h'], np.ceil((F[m] + 2.7) * 4) / 4)
INDOOR = WALK & ~OUT
# trappeskakter: ét gennemgående loft over hele trappen/rampen (i højde med det øverste trin + 2,7 m) – ingen trappede lofter
for k, t in enumerate(TR):
    m = (SLOPE == k) & np.isfinite(C)
    if m.any(): C[m] = float(np.nanmax(C[m]))
# ydervægge: bag muren (≤ 1,6 m) ligger tomrummet uden om bygningen (ikke tegnede mure, forbundet med billedkanten)
WALLS = WALL0
VOID = ~WALK & ~WALLS
EXT = np.zeros((H, W), bool); EXT[0, :] = VOID[0, :]; EXT[-1, :] = VOID[-1, :]; EXT[:, 0] = VOID[:, 0]; EXT[:, -1] = VOID[:, -1]
while True:
    n = EXT.copy(); n[1:] |= EXT[:-1]; n[:-1] |= EXT[1:]; n[:, 1:] |= EXT[:, :-1]; n[:, :-1] |= EXT[:, 1:]; n &= VOID
    if (n == EXT).all(): break
    EXT = n
# fri udsigt fra en ydervæg: ingen gangbare celler (bygningen selv) de næste 36 m vinkelret ud
VIEW = 300
cs_r = np.concatenate([np.zeros((H, 1), np.int32), np.cumsum(WALK, axis=1)], axis=1)
cs_c = np.concatenate([np.zeros((1, W), np.int32), np.cumsum(WALK, axis=0)], axis=0)
jj_ = np.arange(W); ii_ = np.arange(H)
OPEN = {('x', 1): (cs_r[:, np.minimum(jj_ + 1 + VIEW, W)] - cs_r[:, np.minimum(jj_ + 1, W)]) == 0,
        ('x', -1): (cs_r[:, np.maximum(jj_, 0)] - cs_r[:, np.maximum(jj_ - VIEW, 0)]) == 0,
        ('z', 1): (cs_c[np.minimum(ii_ + 1 + VIEW, H), :] - cs_c[np.minimum(ii_ + 1, H), :]) == 0,
        ('z', -1): (cs_c[np.maximum(ii_, 0), :] - cs_c[np.maximum(ii_ - VIEW, 0), :]) == 0}
def ext_behind(axis, sgn):
    """pr. celle: ligger der tomrum uden for bygningen højst 14 celler bag nabocellen i retning sgn"""
    out = np.zeros((H, W), bool)
    for k in range(1, 15):
        if axis == 'x':
            sh = np.zeros((H, W), bool)
            if sgn > 0: sh[:, :W - k] = EXT[:, k:]
            else: sh[:, k:] = EXT[:, :W - k]
        else:
            sh = np.zeros((H, W), bool)
            if sgn > 0: sh[:H - k, :] = EXT[k:, :]
            else: sh[k:, :] = EXT[:H - k, :]
        out |= sh
    return out
WIN = np.zeros((H, W), bool); LUX = np.zeros((H, W), bool)
for zi, n in enumerate(ZN):
    WIN |= (ZID == zi) & ROOMS[n]['win']; LUX |= (ZID == zi) & ROOMS[n]['lux']
MATS = sorted({v for r in ROOMS.values() for v in (r['floor'], r['wall'], r['ceil']) if v} | {'facade', 'glass', 'light_panel', 'light_strip', 'trim_metal', 'baseboard', 'door_leaf', 'glass_door', 'light_off', 'exit_sign', 'beacon_red', 'window', 'light_down', 'walnut', 'walnut_slat', 'plaster_warm', 'mullion'})
MI = {m: i for i, m in enumerate(MATS)}
fmat = np.full((H, W), -1, np.int32); wmat = fmat.copy(); cmat = fmat.copy()
for zi, n in enumerate(ZN):
    r = ROOMS[n]; m = ZID == zi
    fmat[m] = MI[r['floor']]; wmat[m] = MI[r['wall'] if r['h'] is not None else 'facade']; cmat[m] = MI[r['ceil']] if r['ceil'] else -1

# ---------------------------------------------------------------- geometri-opsamling
class Mesh:
    def __init__(self): self.v = []; self.f = []; self.uv = []; self.mat = []
    def quad(self, pts, mat, uvs):
        b = len(self.v); self.v += pts; self.f.append((b, b + 1, b + 2, b + 3)); self.uv.append(uvs); self.mat.append(mat)
VIS, COL = Mesh(), Mesh()

def rects(mask, key):
    """grådig fletning til rektangler med samme nøgle → [(i0, j0, i1, j1, k)] (eksklusive slut)"""
    out, open_ = [], {}
    for i in range(H):
        row = mask[i]; kr = key[i]; segs = []
        j = 0
        while j < W:
            if not row[j]: j += 1; continue
            k = kr[j]; a = j
            while j < W and row[j] and kr[j] == k: j += 1
            segs.append((a, j, k))
        nxt = {}
        for (a, b, k) in segs:
            r = open_.pop((a, b, k), None)
            if r is None: r = [i, a, i + 1, b, k]
            else: r[2] = i + 1
            nxt[(a, b, k)] = r
        out += [tuple(r) for r in open_.values()]; open_ = nxt
    return out + [tuple(r) for r in open_.values()]

def hquad(mesh, i0, j0, i1, j1, y, mat, up=True):
    x0, x1, z0, z1 = cx(j0), cx(j1), cz(i0), cz(i1)
    pts = [(x0, y, z0), (x0, y, z1), (x1, y, z1), (x1, y, z0)] if up else [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)]
    mesh.quad(pts, mat, [(p[0], p[2]) for p in pts])

# gulve (ikke skrå flader) og lofter
q = lambda a: np.round(np.nan_to_num(a, nan=-99) * 100).astype(np.int64)
for mesh, Fm, flat in ((VIS, F, WALK & ~RAMP), (COL, FC, WALK & (SLOPE < 0))):
    key = fmat.astype(np.int64) * 10**7 + q(Fm) + 10**6
    for (i0, j0, i1, j1, k) in rects(flat, key):
        hquad(mesh, i0, j0, i1, j1, (k % 10**7 - 10**6) / 100.0, MATS[k // 10**7])
key = cmat.astype(np.int64) * 10**7 + q(C) + 10**6
def vbox(mesh, x0, y0, z0, x1, y1, z1, mat, faces='nsewtb'):
    P = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    Q = {'n': (1, 0, 3, 2), 's': (4, 5, 6, 7), 'w': (0, 4, 7, 3), 'e': (5, 1, 2, 6), 't': (3, 7, 6, 2), 'b': (0, 1, 5, 4)}
    for f in faces:
        qq = [P[k] for k in Q[f]]
        mesh.quad(qq, mat, [((p[0] if f in 'nstb' else p[2]), (p[1] if f not in 'tb' else p[2])) for p in qq])
nslat = 0
for (i0, j0, i1, j1, k) in rects(INDOOR & ~ATR, key + LUX.astype(np.int64) * 10**12):
    lux = k >= 10**12; k = k % 10**12
    y = (k % 10**7 - 10**6) / 100.0
    hquad(VIS, i0, j0, i1, j1, y, 'plaster_warm' if lux else MATS[k // 10**7], up=False); hquad(COL, i0, j0, i1, j1, y, 'ceil', up=False)
    if lux:                                                                 # valnødlameller: 5 cm brede, 12 cm høje, c/c 15 cm (langs x)
        z0_, z1_ = cz(i0), cz(i1); x0_, x1_ = cx(j0), cx(j1)
        zz = math.ceil(z0_ / 0.15) * 0.15
        while zz + 0.05 <= z1_:
            vbox(VIS, x0_, y - 0.12, zz, x1_, y, zz + 0.05, 'walnut_slat', 'nsb'); zz += 0.15; nslat += 1
for (i0, j0, i1, j1, k) in rects(ATR, q(C)):                                    # atriets glastag
    hquad(VIS, i0, j0, i1, j1, (k) / 100.0, 'glass', up=False)

# skrå flader: rampe (synlig) og alle trapper+ramper (kollision) – pr. sammenhængende tværløb
def slopes(mesh, which):
    for k, t in enumerate(TR):
        if t['kind'] not in which: continue
        x0, y0, x1, y1 = t['r']; m = (SLOPE[y0:y1, x0:x1] == k)
        lat = m.any(axis=1) if t['axis'] == 'x' else m.any(axis=0)
        runs, a = [], None
        for p, v in enumerate(list(lat) + [False]):
            if v and a is None: a = p
            if not v and a is not None: runs.append((a, p)); a = None
        ii_, jj_ = np.nonzero(m)
        if not len(ii_): continue
        mat = MATS[fmat[y0 + ii_[len(ii_) // 2], x0 + jj_[len(jj_) // 2]]] if mesh is VIS else 'floor'
        for (l0, l1) in runs:
            if t['axis'] == 'z':
                X0, X1 = cx(x0 + l0), cx(x0 + l1); Za, Zb = cz(y0), cz(y1)
                pts = [(X0, t['ya'], Za), (X0, t['yb'], Zb), (X1, t['yb'], Zb), (X1, t['ya'], Za)]
            else:
                Z0, Z1 = cz(y0 + l0), cz(y0 + l1); Xa, Xb = cx(x0), cx(x1)
                pts = [(Xa, t['ya'], Z0), (Xa, t['ya'], Z1), (Xb, t['yb'], Z1), (Xb, t['yb'], Z0)]
            # vinding: normalen skal pege op
            e1 = np.subtract(pts[1], pts[0]); e2 = np.subtract(pts[3], pts[0])
            if np.cross(e1, e2)[1] < 0: pts = [pts[0], pts[3], pts[2], pts[1]]
            mesh.quad(pts, mat, [(p[0], p[2]) for p in pts])
slopes(VIS, ('ramp',)); slopes(COL, ('ramp', 'stairs'))

# ---------------------------------------------------------------- lodrette flader (vægge, trin, nedhæng, facade over døre)
def vfaces(mesh, Fm, slope_mask):
    for axis in ('x', 'z'):
        for sgn in (1, -1):
            # a = cellen, b = naboen i retning sgn langs aksen; fladen ligger på grænsen og vender mod a
            if axis == 'x':
                A = (slice(None), slice(0, W - 1)) if sgn > 0 else (slice(None), slice(1, W))
                B = (slice(None), slice(1, W)) if sgn > 0 else (slice(None), slice(0, W - 1))
            else:
                A = (slice(0, H - 1), slice(None)) if sgn > 0 else (slice(1, H), slice(None))
                B = (slice(1, H), slice(None)) if sgn > 0 else (slice(0, H - 1), slice(None))
            wa, wb = WALK[A], WALK[B]; fa, fb = Fm[A], Fm[B]; ca, cb = C[A], C[B]; ina, inb = INDOOR[A], INDOOR[B]
            outa, outb = OUT[A], OUT[B]; sa, sb = slope_mask[A], slope_mask[B]
            lo = np.full(wa.shape, np.nan); hi = lo.copy(); mat = np.full(wa.shape, -1, np.int32)
            def put(m, l, h, mm):
                m = m & np.isnan(lo); lo[m] = np.broadcast_to(l, m.shape)[m]; hi[m] = np.broadcast_to(h, m.shape)[m]; mat[m] = np.broadcast_to(mm, m.shape)[m]
            top_a = np.where(ina, ca, np.maximum(fa + 4.0, FACADE_TOP))
            extA = ext_behind(axis, sgn)[A]; openA = OPEN[(axis, sgn)][A]
            # 0a) panoramavindue: inde-rum med vinduer, ydervæg, fri udsigt over byen
            win = wa & ~wb & ina & WIN[A] & extA & openA & (SLOPE[A] < 0)
            if mesh is VIS: put(win, fa - 0.02, ca, MI['window'])
            # 0b) tagterrassens kant ud mod byen: lav brystning (kollisionen er en usynlig væg – 100 m ned)
            par = wa & ~wb & outa & extA
            put(par, fa - 0.4, fa + (PARAPET if mesh is VIS else 4.0), (MI['arch_concrete'] if mesh is VIS else 0))
            # 1) mur: a gangbar, b massiv
            put(wa & ~wb, fa - 0.4, top_a, (wmat[A] if mesh is VIS else 0))
            # 2) trin/kant: b højere end a (ikke inden for samme skrå flade)
            same = (SLOPE[A] >= 0) & (SLOPE[A] == SLOPE[B]) & sa & sb
            put(wa & wb & (fb > fa + 0.005) & ~same, fa, fb, (fmat[B] if mesh is VIS else 0))
            # 3) loftsnedhæng: begge inde, a's loft højere
            put(wa & wb & ina & inb & (ca > cb + 0.005), cb, ca, (wmat[A] if mesh is VIS else 0))
            # 4) facade over en dør ud til gaden: a inde, b ude – fladen vender ud mod b
            mo = wa & wb & ina & outb
            mats_f = np.full(wa.shape, MI['facade'], np.int32)
            emit(mesh, axis, sgn, lo, hi, mat, A)
            lo2 = np.where(mo, ca, np.nan); hi2 = np.where(mo, np.maximum(ca + 0.5, FACADE_TOP), np.nan)
            emit(mesh, axis, -sgn, lo2, hi2, np.where(mo, mats_f if mesh is VIS else 0, -1), A)

def emit(mesh, axis, sgn, lo, hi, mat, A):
    """flet langs hver grænselinje: samme (lo, hi, mat) i træk → én flade. sgn: retning fra a mod b (fladen vender mod a)."""
    valid = ~np.isnan(lo) & (hi - np.nan_to_num(lo) > 0.004)
    li = np.round(np.nan_to_num(lo) * 100).astype(np.int64); hh = np.round(np.nan_to_num(hi) * 100).astype(np.int64)
    off_i = A[0].start or 0; off_j = A[1].start or 0
    if axis == 'x':
        for jl in range(valid.shape[1]):
            col = valid[:, jl]
            if not col.any(): continue
            j = jl + off_j; xb = cx(j + 1) if sgn > 0 else cx(j)
            i = 0
            while i < valid.shape[0]:
                if not col[i]: i += 1; continue
                k = (li[i, jl], hh[i, jl], mat[i, jl]); a = i
                while i < valid.shape[0] and col[i] and (li[i, jl], hh[i, jl], mat[i, jl]) == k: i += 1
                y0, y1 = k[0] / 100, k[1] / 100; z0, z1 = cz(a + off_i), cz(i + off_i)
                pts = [(xb, y0, z0), (xb, y1, z0), (xb, y1, z1), (xb, y0, z1)]
                if sgn > 0: pts = pts[::-1]                                     # vender mod a (−x-siden ved sgn>0)
                face(mesh, pts, k[2], 'x')
                if mesh is VIS and k[2] == MI['window']: mullions('x', xb, z0, z1, y0, y1, sgn)
    else:
        for il in range(valid.shape[0]):
            row = valid[il]
            if not row.any(): continue
            ii = il + off_i; zb = cz(ii + 1) if sgn > 0 else cz(ii)
            j = 0
            while j < valid.shape[1]:
                if not row[j]: j += 1; continue
                k = (li[il, j], hh[il, j], mat[il, j]); a = j
                while j < valid.shape[1] and row[j] and (li[il, j], hh[il, j], mat[il, j]) == k: j += 1
                y0, y1 = k[0] / 100, k[1] / 100; x0, x1 = cx(a + off_j), cx(j + off_j)
                pts = [(x0, y0, zb), (x0, y1, zb), (x1, y1, zb), (x1, y0, zb)]
                if sgn < 0: pts = pts[::-1]
                face(mesh, pts, k[2], 'z')
                if mesh is VIS and k[2] == MI['window']: mullions('z', zb, x0, x1, y0, y1, sgn)

def mullions(axis, e, a0, a1, y0, y1, sgn):
    """vinduesprofiler: lodrette sprosser c/c 1,5 m, bundprofil og topprofil (mørk anodiseret aluminium)"""
    L = a1 - a0; n = max(1, int(round(L / 1.5)))
    d0, d1 = (e - 0.07, e + 0.05) if sgn > 0 else (e - 0.05, e + 0.07)
    for k in range(n + 1):
        a = a0 + L * k / n; a = min(max(a, a0 + 0.03), a1 - 0.03)
        if axis == 'x': vbox(VIS, d0, y0, a - 0.03, d1, y1, a + 0.03, 'mullion', 'nsew')
        else: vbox(VIS, a - 0.03, y0, d0, a + 0.03, y1, d1, 'mullion', 'nsew')
    for (yy0, yy1) in ((y0 + 0.02, y0 + 0.14), (y1 - 0.1, y1)):
        if axis == 'x': vbox(VIS, d0, yy0, a0, d1, yy1, a1, 'mullion', 'ewt' if yy0 < y0 + 0.1 else 'ewb')
        else: vbox(VIS, a0, yy0, d0, a1, yy1, d1, 'mullion', 'nst' if yy0 < y0 + 0.1 else 'nsb')

def face(mesh, pts, mi, axis):
    if mesh is VIS and MATS[mi] == 'lux_wall':                              # repræsentative vægge: valnød på lange flader, ellers varm puds
        L = max(abs(pts[0][0] - pts[2][0]), abs(pts[0][2] - pts[2][2]))
        h = int(abs(pts[0][0] * 7.3 + pts[0][2] * 3.1)) % 3
        mi = MI['walnut'] if (L > 3.0 and h != 0) else MI['plaster_warm']
    if mesh is VIS:
        uvs = [((p[2] if axis == 'x' else p[0]), p[1]) for p in pts]
        mesh.quad(pts, MATS[mi], uvs)
    else:
        mesh.quad(pts, 'wall', [(0, 0)] * 4)
vfaces(VIS, F, RAMP); vfaces(COL, FC, SLOPE >= 0)

# ---------------------------------------------------------------- armaturer (lyspaneler i loftet) + lysliste
LIGHTS = []
SPACING = {'panel': 3.0, 'linear': 3.6, 'highbay': 6.0, 'server': 3.0, 'atrium': 5.0, 'street': 9.0}
# afstand til nærmeste mur/kant (i celler, op til 30) – til spots langs væggene
DW = np.zeros((H, W), np.int32); er = WALK.copy()
for k in range(1, 31):
    n_ = er.copy(); n_[1:] &= er[:-1]; n_[:-1] &= er[1:]; n_[:, 1:] &= er[:, :-1]; n_[:, :-1] &= er[:, 1:]
    DW[er & ~n_] = k; er = n_
DW[er] = 31
def downlights(zi, n):
    """varme indbyggede spots: en ring 0,6 m fra væggene (c/c 1,5 m – lysbuer ned ad væggene) + et luftigt net midt i rummet"""
    m = (ZID == zi) & (SLOPE < 0); pts = []
    ring = m & (DW == 5)
    ii, jj = np.nonzero(ring); taken = []
    for i, j in sorted(zip(ii, jj), key=lambda t: (t[0], t[1])):
        if all((i - a) ** 2 + (j - b) ** 2 > 12.5 ** 2 for a, b in taken): taken.append((i, j))
    pts += taken
    grid = m & (DW >= 14); sp = 20
    ii, jj = np.nonzero(grid)
    for i, j in zip(ii, jj):
        if i % sp == sp // 2 and j % sp == sp // 2: pts.append((i, j))
    for (i, j) in pts:
        if not np.isfinite(C[i, j]): continue
        x, z = cx(j + 0.5), cz(i + 0.5); y = float(C[i, j]) - (0.122 if LUX[i, j] else 0.012)
        VIS.quad([(x - 0.07, y, z - 0.07), (x + 0.07, y, z - 0.07), (x + 0.07, y, z + 0.07), (x - 0.07, y, z + 0.07)], 'light_down', [(0, 0)] * 4)
        LIGHTS.append(dict(x=round(x, 2), y=round(y - 0.03, 2), z=round(z, 2), kind='down', room=n))
for zi, n in enumerate(ZN):
    r = ROOMS[n]; kind = r['light']
    if kind == 'down': downlights(zi, n); continue
    if kind == 'none': continue
    m = ZID == zi
    # mindst 0,9 m fra væggene
    from numpy.lib.stride_tricks import sliding_window_view as swv
    pad = 8; mp = np.pad(m, pad, constant_values=False); inner = swv(mp, (2 * pad + 1, 2 * pad + 1)).all(axis=(2, 3)) & m
    sp = int(round(SPACING[kind] / S)); ii, jj = np.nonzero(inner)
    if not len(ii): continue
    oi, oj = ii.min() % sp, jj.min() % sp
    for i in range(ii.min() + sp // 2, ii.max() + 1, sp):
        for j in range(jj.min() + sp // 2, jj.max() + 1, sp):
            if not inner[i, j]: continue
            x, z = cx(j + 0.5), cz(i + 0.5)
            if kind == 'street':
                LIGHTS.append(dict(x=round(x, 2), y=round(F[i, j] + 5.5, 2), z=round(z, 2), kind=kind)); continue
            y = float(C[i, j]) if not ATR[i, j] else float(F[i, j] + 7.5)
            w, d = {'panel': (0.6, 1.2), 'linear': (0.18, 1.5), 'highbay': (0.5, 0.5), 'server': (0.16, 2.4), 'atrium': (0.9, 0.9)}[kind]
            # nat: kun en del af lyset er tændt – klynger efter position (så hele gange/hjørner er mørke), mørke rum: intet
            frac = {'panel': 0.38, 'linear': 0.5, 'highbay': 0.55, 'server': 0.85, 'atrium': 0.5}[kind] * (0.0 if r.get('dark') else 1.0)
            cluster = (math.sin(x * 0.37 + z * 0.11) * 0.5 + 0.5) * 0.7 + ((i * 7 + j * 13) % 10) / 10.0 * 0.3
            on = cluster < frac
            mat = ('light_panel' if kind in ('panel', 'highbay', 'atrium') else 'light_strip') if on else 'light_off'
            hy = y - 0.012
            x0, x1, z0, z1 = x - w / 2, x + w / 2, z - d / 2, z + d / 2
            VIS.quad([(x0, hy, z0), (x1, hy, z0), (x1, hy, z1), (x0, hy, z1)], mat, [(0, 0), (1, 0), (1, 1), (0, 1)])
            if on: LIGHTS.append(dict(x=round(x, 2), y=round(hy - 0.05, 2), z=round(z, 2), kind=kind, dark=bool(r.get('dark')), room=n))

# nødlys: røde lamper i mørke rum, kælder og trappehaller (de eneste lyskilder dér)
for zi, n in enumerate(ZN):
    r = ROOMS[n]
    if not (r.get('dark') or n in ('Trappehallen', 'Kryptgangen', 'Main B', 'Kryptnedgangen')): continue
    ii, jj = np.nonzero(ZID == zi)
    if not len(ii): continue
    step = max(1, len(ii) // 3)
    for k in range(0, len(ii), step * 1):
        i, j = ii[k], jj[k]
        if not np.isfinite(C[i, j]): continue
        x, z = cx(j + 0.5), cz(i + 0.5); y = float(C[i, j]) - 0.15
        VIS.quad([(x - 0.06, y, z - 0.06), (x + 0.06, y, z - 0.06), (x + 0.06, y, z + 0.06), (x - 0.06, y, z + 0.06)], 'beacon_red', [(0, 0)] * 4)
        LIGHTS.append(dict(x=round(x, 2), y=round(y - 0.05, 2), z=round(z, 2), kind='emergency', room=n))
        if k // step >= 2: break

# ---------------------------------------------------------------- døre, fodlister, gelændere, indretning (dress.py)
import dress
RAILS, HEADERS = [], []
wallmat_of = lambda i, j: MATS[wmat[i, j]]
PROPS = dress.run(globals(), ROOMS, MATS, MI)
print('[map] lameller', nslat)

# ---------------------------------------------------------------- spawns, sites
def rect_pts(r, n=5):
    x0, z0, x1, z1 = cx(r[0]), cz(r[1]), cx(r[2]), cz(r[3]); out = []
    for k in range(n):
        u = (k % 3 + 0.5) / 3; v = (k // 3 + 0.5) / 2
        out.append([round(x0 + (x1 - x0) * u, 2), round(z0 + (z1 - z0) * v, 2)])
    return out
def floor_at(x, z):
    i, j = int((z / S) + CY), int((x / S) + CX); return float(FC[i, j]) if WALK[i, j] else 0.0
spawns = {side: [[p[0], round(floor_at(*p), 2), p[1]] for p in rect_pts(r)] for side, r in M['spawns'].items()}
sites = {k: [round(cx(v[0]), 2), round(cz(v[1]), 2), round(cx(v[2]), 2), round(cz(v[3]), 2), round(floor_at(cx((v[0] + v[2]) / 2), cz((v[1] + v[3]) / 2)), 2)] for k, v in M['sites'].items()}
DST = os.path.join(HERE, '..', 'out'); os.makedirs(DST, exist_ok=True)
bounds = {}
for zi, n in enumerate(ZN):
    ii, jj = np.nonzero(ZID == zi)
    if not len(ii) or ROOMS[n]['h'] is None: continue
    fl = float(np.nanmin(F[ii, jj])); cl = float(np.nanmax(C[ii, jj]))
    bounds[n] = [round(cx(jj.min()), 2), round(fl, 2), round(cz(ii.min()), 2), round(cx(jj.max() + 1), 2), round(cl, 2), round(cz(ii.max() + 1), 2)]
json.dump(dict(lights=LIGHTS, props=PROPS, bounds=bounds, spawns=spawns, sites=sites, rooms={n: ROOMS[n] for n in ZN}, labels=[[z['name'], round(cx((z['r'][0] + z['r'][2]) / 2), 2), round(cz((z['r'][1] + z['r'][3]) / 2), 2), z['y']] for z in M['zones']]),
          open(os.path.join(DST, 'bureau.json'), 'w'), indent=1)
print('[map] synlig %d flader · kollision %d flader · %d lys · materialer %s' % (len(VIS.f), len(COL.f), len(LIGHTS), MATS))

print('[gen] færdig')
