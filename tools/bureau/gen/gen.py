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
from collections import deque
class ndi:
    """de få morfologi-funktioner fra scipy.ndimage, i ren numpy (Blenders Python har ikke scipy)"""
    @staticmethod
    def binary_dilation(m, iterations=1):
        m = m.copy()
        for _ in range(iterations):
            n = m.copy(); n[1:] |= m[:-1]; n[:-1] |= m[1:]; n[:, 1:] |= m[:, :-1]; n[:, :-1] |= m[:, 1:]; m = n
        return m
    @staticmethod
    def binary_erosion(m, iterations=1):
        m = m.copy()
        for _ in range(iterations):
            n = m.copy(); n[1:] &= m[:-1]; n[:-1] &= m[1:]; n[:, 1:] &= m[:, :-1]; n[:, :-1] &= m[:, 1:]
            n[0, :] = n[-1, :] = False; n[:, 0] = n[:, -1] = False; m = n
        return m
    @staticmethod
    def binary_opening(m, structure):
        from numpy.lib.stride_tricks import sliding_window_view as swv
        k = structure.shape[0]; a = k // 2; b = k - 1 - a
        er = np.zeros_like(m); er_ = swv(np.pad(m, ((a, b), (a, b))), (k, k)).all(axis=(2, 3)); er[:] = er_
        di = swv(np.pad(er, ((b, a), (b, a))), (k, k)).any(axis=(2, 3))
        return di & m
    @staticmethod
    def label(m, structure=None):
        diag = structure is not None and structure.shape == (3, 3) and structure.all()
        Hh, Ww = m.shape; lab = np.zeros((Hh, Ww), np.int32); n = 0; flat = m.ravel(); L = lab.ravel()
        nb = [(-1, 0), (1, 0), (0, -1), (0, 1)] + ([(-1, -1), (-1, 1), (1, -1), (1, 1)] if diag else [])
        for start in np.flatnonzero(flat):
            if L[start]: continue
            n += 1; L[start] = n; q = deque([start])
            while q:
                c = q.popleft(); i, j = divmod(c, Ww)
                for di, dj in nb:
                    ii, jj = i + di, j + dj
                    if 0 <= ii < Hh and 0 <= jj < Ww:
                        k = ii * Ww + jj
                        if flat[k] and not L[k]: L[k] = n; q.append(k)
        return lab, n
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
FY0 = R['fy'].astype(np.float64).copy()
# v26: trapperne i vestfløjen rettet (brugerens feedback: trapper der ender i en mur, Dark lukket af, mærkelig Lower B)
#   carve(x0, x1, z0, z1, rum, gulvhøjde): åbner mure/sætter gulv · trapperne omlægges efter behov
def _ij(x, z): return int(round(z / S + CY)), int(round(x / S + CX))
def carve(x0, x1, z0, z1, room, fy):
    i0, j0 = _ij(x0, z0); i1, j1 = _ij(x1, z1); zi = [z['name'] for z in M['zones']].index(room)
    ZID[i0:i1, j0:j1] = zi; WALL0[i0:i1, j0:j1] = False; FY0[i0:i1, j0:j1] = fy
def setfy(x0, x1, z0, z1, fy):
    i0, j0 = _ij(x0, z0); i1, j1 = _ij(x1, z1); m = ZID[i0:i1, j0:j1] >= 0; FY0[i0:i1, j0:j1][m] = fy
ST = M['stairs']
# #4 Dark-trappen: foden løb ind i en mur – muren åbnes ind til Dark-kammeret
carve(-50.9, -45.4, -18.4, -17.0, 'Dark-kammeret', 1.5)
# #7 Kryptnedgangen: var lukket i begge ender – nu fra Tunnels hjørne (vest, 1,5) ned mod øst (−1,5) med repos og udgang til Lower B
i0_, j0_ = _ij(-39.6, 1.6); i1_, j1_ = _ij(-33.5, 6.4)
ST[7] = dict(ST[7], r=[j0_, i0_, j1_, i1_], axis='x', ya=1.5, yb=-1.5)
setfy(-33.5, -30.5, 1.6, 6.4, -1.5)
carve(-41.2, -39.2, 1.8, 6.2, 'Tunnels hjørne', 1.5)
carve(-33.5, -30.6, 6.2, 7.0, 'Lower B', -1.5)
# #10 Kryptgangen: starter nu med en repos ved foden af trappe #9 (ikke midt på dens side)
x0_, y0_, x1_, y1_ = ST[10]['r']; i_rep = _ij(0, 21.4)[0]
ST[10] = dict(ST[10], r=[x0_, i_rep, x1_, y1_])
setfy((x0_ - CX) * S, (x1_ - CX) * S, (y0_ - CY) * S, 21.4, -1.5)
# v26.3: Trappehallen – hullet mellem trappe #8 og #9 (en grube på −1,5 med trappede lofter) fyldes ud til en massiv kerne,
#   og reposen syd for #9 (op til Kryptgangen) får sin egen åbning mod vest ind i hallen
def fill(x0, x1, z0, z1):
    i0, j0 = _ij(x0, z0); i1, j1 = _ij(x1, z1); ZID[i0:i1, j0:j1] = -1; WALL0[i0:i1, j0:j1] = True
fill(-12.8, -5.4, 11.0, 14.6)
carve(-15.6, -11.9, 19.5, 21.4, 'Trappehallen', -1.5)                     # v26.5: helt ind til reposen (før stod en 12 cm mur tilbage)
# v26.5: tærskler uden gelænder (rampens sidegelænder spærrede døren fra Receptionen ud til helipad-trappen)
NORAIL = np.zeros(ZID.shape, bool)
def threshold(x0, x1, z0, z1, room, fy):
    carve(x0, x1, z0, z1, room, fy); i0, j0 = _ij(x0, z0); i1, j1 = _ij(x1, z1); NORAIL[max(0, i0 - 2):i1 + 2, max(0, j0 - 2):j1 + 2] = True
threshold(20.2, 21.95, 30.6, 32.7, 'T Base', 0.0)                             # Receptionen → helipad-trappen: 2,1 m bred dør
# v26.5: Arch ↔ Søjlegangen A – åbning i muren mellem Arch-lommen og Søjlegangen (begge 3,0 m)
carve(29.5, 32.3, -7.6, -4.3, 'Søjlegangen A', 3.0)
# v26.5: Arch → Kaffebaren (Connector, 1,5 m lavere): ny trappe ned gennem muren
carve(25.15, 27.55, -6.4, -2.5, 'Arch', 3.0)
i0_, j0_ = _ij(25.15, -6.0); i1_, j1_ = _ij(27.55, -2.5)
M['stairs'].append(dict(r=[j0_, i0_, j1_, i1_], axis='z', ya=3.0, yb=1.5))
ZN = [z['name'] for z in M['zones']]; ZY = np.array([z['y'] for z in M['zones']], np.float32)
WALK = ZID >= 0
cx = lambda j: (j - CX) * S
cz = lambda i: (i - CY) * S
for n in ZN: assert n in ROOMS, 'rum mangler i rooms.py: ' + n

# ---------------------------------------------------------------- højdefelter
F = np.where(WALK, FY0, np.nan).astype(np.float64)            # gulv (synligt: trapper i trin)
FC = F.copy()                                                     # gulv til kollision (trapper glatte)
SLOPE = np.full((H, W), -1, np.int32)                             # skrå flade (rampe, eller trappe i kollisionen)
STEPS = np.zeros((H, W), bool)
TR = [dict(t, kind='stairs') for t in M['stairs']] + [dict(t, kind='ramp') for t in M['ramps']]
RAMP_K = np.array([t['kind'] == 'ramp' for t in TR] + [True])          # indeks −1 (ingen skrå flade) → True
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
# v26.3: en trappe har altid vægge på siderne, hvor naboen ligger mere end 0,6 m højere/lavere (før: åbne trappesider ned i en grube,
#   så loftet ved siden af trappen fulgte trinene og blev trappet). Kanten (2 celler) bliver mur; smalle gulvrester (< 0,7 m) fjernes.
_Fz = np.nan_to_num(F, nan=-99.0); _side = np.zeros((H, W), bool)
for _ax in (0, 1):
    for _s in (1, -1):
        _Fb = np.roll(_Fz, _s, _ax); _Wb = np.roll(WALK, _s, _ax); _Sb = np.roll(SLOPE, _s, _ax)
        _side |= WALK & _Wb & (SLOPE >= 0) & ~RAMP_K[SLOPE] & (_Sb != SLOPE) & (np.abs(_Fz - _Fb) > 0.6)
_side = ndi.binary_dilation(_side, iterations=1) & (SLOPE >= 0)
_keep = ndi.binary_opening(WALK & ~_side, structure=np.ones((6, 6), bool))
_gone = _side | (WALK & ~_keep & ndi.binary_dilation(_side, iterations=10))          # kun gulvrester ved de nye trappevægge
ZID[_gone] = -1; WALL0[_gone] = True; WALK[_gone] = False
F[_gone] = np.nan; FC[_gone] = np.nan; SLOPE[_gone] = -1; STEPS[_gone] = False
print('[gen] trappesider lukket: %d celler, gulvrester fjernet: %d celler' % (int(_side.sum()), int((_gone & ~_side).sum())))
# lukkede lommer: gulv der kun hænger sammen med resten af banen gennem en sprække < 0,5 m (fx strimlen bag A Rampes skrå mur) bliver mur
_E = ndi.binary_erosion(WALK, iterations=2); _lab, _n = ndi.label(_E); _sz = np.bincount(_lab.ravel()); _sz[0] = 0
_R = WALK & ~ndi.binary_dilation(_lab == _sz.argmax(), iterations=3); _l2, _n2 = ndi.label(_R, structure=np.ones((3, 3), bool)); _s2 = np.bincount(_l2.ravel())
_pk = np.isin(_l2, [k for k in range(1, _n2 + 1) if _s2[k] >= 60])
ZID[_pk] = -1; WALL0[_pk] = True; WALK[_pk] = False; F[_pk] = np.nan; FC[_pk] = np.nan; SLOPE[_pk] = -1; STEPS[_pk] = False
print('[gen] lukkede lommer fyldt: %d celler' % int(_pk.sum()))
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
# v26: et loft må aldrig ligge lavere end nabogulvene inden for 1 m + 2,4 m frihøjde (ellers bliver loftspladen en afsats man kan hoppe op på,
#   fx en repos ved siden af en trappe der fortsætter opad)
_Fn = np.where(WALK, np.nan_to_num(F, nan=-99), -99.0); _mx = _Fn.copy()
for _ in range(8):
    n_ = _mx.copy(); n_[1:] = np.maximum(n_[1:], _mx[:-1]); n_[:-1] = np.maximum(n_[:-1], _mx[1:]); n_[:, 1:] = np.maximum(n_[:, 1:], _mx[:, :-1]); n_[:, :-1] = np.maximum(n_[:, :-1], _mx[:, 1:]); _mx = np.where(WALK, n_, -99.0)   # kun gennem gulv, ikke gennem mure
_low = np.isfinite(C) & (C < _mx + 2.4)
C[_low] = np.ceil((_mx[_low] + 2.4) * 4) / 4
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
MATS = sorted({v for r in ROOMS.values() for v in (r['floor'], r['wall'], r['ceil']) if v} | {'facade', 'glass', 'ceiling_paint', 'light_panel', 'light_strip', 'trim_metal', 'baseboard', 'door_leaf', 'glass_door', 'light_off', 'exit_sign', 'beacon_red', 'window', 'light_down', 'walnut', 'walnut_slat', 'plaster_warm', 'mullion', 'paint_white', 'paint_yellow', 'paint_black'})
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

# ---------------------------------------------------------------- v26.3: skrå mure – glat beklædning hen over savtakkerne
#   En skrå mur i cellegitteret bliver en savtak af 12 cm-trin (så ud som lodrette ribber). Langs hver skrå strækning (≥ 1 m) lægges
#   en lodret flade fra gulv til loft lige foran takkerne (+ fodliste). Kollisionen er uændret (takkerne er kun 4 cm dybe).
def _chains():
    """randkanter mellem gangbar celle og mur som polylinjer i hjørnekoordinater (i, j); hver kant husker sin gangbare celle"""
    E = {}
    def add(a, b, cell):
        E.setdefault(a, []).append((b, cell)); E.setdefault(b, []).append((a, cell))
    EB = np.zeros((H, W), bool)
    for _a in ('x', 'z'):
        for _s in (1, -1): EB |= ext_behind(_a, _s) & OPEN[(_a, _s)]
    Wk = WALK & INDOOR & ~(WIN & EB)                                     # ikke hen over panoramavinduer
    ii, jj = np.nonzero(Wk[:, :-1] & ~WALK[:, 1:] & ~EXT[:, 1:]);  [add((i, j + 1), (i + 1, j + 1), (i, j)) for i, j in zip(ii, jj)]
    ii, jj = np.nonzero(Wk[:, 1:] & ~WALK[:, :-1] & ~EXT[:, :-1]);  [add((i, j + 1), (i + 1, j + 1), (i, j + 1)) for i, j in zip(ii, jj)]
    ii, jj = np.nonzero(Wk[:-1, :] & ~WALK[1:, :] & ~EXT[1:, :]);  [add((i + 1, j), (i + 1, j + 1), (i, j)) for i, j in zip(ii, jj)]
    ii, jj = np.nonzero(Wk[1:, :] & ~WALK[:-1, :] & ~EXT[:-1, :]);  [add((i + 1, j), (i + 1, j + 1), (i + 1, j)) for i, j in zip(ii, jj)]
    used = set(); out = []
    for a0 in list(E.keys()):
        for (b0, c0) in E[a0]:
            if (a0, b0) in used: continue
            pts, cells = [a0], []; a, b, c = a0, b0, c0
            while True:
                used.add((a, b)); used.add((b, a)); pts.append(b); cells.append(c)
                nxt = [(n, cc) for (n, cc) in E.get(b, []) if (b, n) not in used]
                if len(E.get(b, [])) != 2 or not nxt: break
                a, (b, c) = b, nxt[0]
            out.append((pts, cells))
    return out
def _dp(P, eps):
    """Douglas–Peucker: indekser der bevares"""
    keep = {0, len(P) - 1}; st = [(0, len(P) - 1)]
    if np.hypot(*(P[-1] - P[0])) < 1e-6 and len(P) > 3:                 # lukket løkke: del først ved det fjerneste punkt
        m = int(np.argmax(np.hypot(*(P - P[0]).T))); keep.add(m); st = [(0, m), (m, len(P) - 1)]
    while st:
        a, b = st.pop()
        if b <= a + 1: continue
        d = P[b] - P[a]; L = np.hypot(*d) or 1e-9; n = np.array([-d[1], d[0]]) / L
        dist = np.abs((P[a + 1:b] - P[a]) @ n); k = int(np.argmax(dist))
        if dist[k] > eps: m = a + 1 + k; keep.add(m); st += [(a, m), (m, b)]
    return sorted(keep)
nclad = 0
for pts, cells in _chains():
    if len(pts) < 10: continue
    P = np.array([(cx(j), cz(i)) for (i, j) in pts], float)           # (x, z)
    ks = _dp(P, 0.32)
    for a, b in zip(ks[:-1], ks[1:]):
        d = P[b] - P[a]; L = float(np.hypot(*d))
        ang = abs(math.degrees(math.atan2(d[1], d[0]))) % 90.0
        if L < 1.0 or ang < 8.0 or ang > 82.0: continue                 # kun skrå strækninger (lige mure er fine)
        seg = cells[a:b]; fl = np.array([F[c] for c in seg]); cl = np.array([C[c] for c in seg])
        flat = np.nanmax(fl) - np.nanmin(fl) < 0.05                       # langs en trappe: fladen går fra laveste gulv til højeste loft (resten skjules)
        u = d / L; nrm = np.array([-u[1], u[0]])
        ci = np.array([(cx(c[1] + 0.5), cz(c[0] + 0.5)) for c in seg])
        if np.mean((ci - P[a]) @ nrm) < 0: nrm = -nrm                     # normalen peger ind i rummet
        off = max(0.0, float(np.max((P[a:b + 1] - P[a]) @ nrm))) + 0.035   # foran de yderste takker + fodlisterne
        p0, p1 = P[a] + nrm * off, P[b] + nrm * off
        y0, y1 = float(np.nanmin(fl)), float(np.nanmax(cl))
        mi = int(wmat[seg[len(seg) // 2]]); mname = MATS[mi]
        if mname == 'lux_wall': mname = 'walnut' if L > 3.0 else 'plaster_warm'
        q = [(p0[0], y0, p0[1]), (p1[0], y0, p1[1]), (p1[0], y1, p1[1]), (p0[0], y1, p0[1])]
        e1 = np.subtract(q[1], q[0]); e2 = np.subtract(q[3], q[0]); nn = np.cross(e1, e2)
        if nn[0] * nrm[0] + nn[2] * nrm[1] < 0: q = q[::-1]
        t0 = float(p0 @ u); VIS.quad(q, mname, [(float(np.array([v[0], v[2]]) @ u), v[1]) for v in q])
        bq = [(p0[0] + nrm[0] * 0.015, y0, p0[1] + nrm[1] * 0.015), (p1[0] + nrm[0] * 0.015, y0, p1[1] + nrm[1] * 0.015),
              (p1[0] + nrm[0] * 0.015, y0 + 0.1, p1[1] + nrm[1] * 0.015), (p0[0] + nrm[0] * 0.015, y0 + 0.1, p0[1] + nrm[1] * 0.015)]
        if q[0] != (p0[0], y0, p0[1]): bq = bq[::-1]
        if flat: VIS.quad(bq, 'baseboard', [(0, 0), (1, 0), (1, 1), (0, 1)])
        nclad += 1
print('[gen] skrå mure beklædt: %d strækninger' % nclad)

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
            frac = {'panel': 0.38, 'linear': 0.5, 'highbay': 0.9, 'server': 0.95, 'atrium': 0.5}[kind] * (0.28 if r.get('dark') else 1.0)   # v26: kælder/lager tændt hele natten · mørke rum: enkelte lysrør
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
