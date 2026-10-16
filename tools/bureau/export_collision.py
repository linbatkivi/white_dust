#!/usr/bin/env python3
# ==========================================================================
# de_bureau – kollision og gameplay-data i spillets format (som de_havn/de_ascension): shared/bureau_data.js
#   python3 tools/bureau/export_collision.py   (kører generatoren gen/gen.py – samme grundlag som grafikken)
#   boxes [x0,z0,x1,z1,y0,y1,kind] · stairs [x0,z0,x1,z1,axis,ya,yb,n] · ramps [x0,z0,x1,z1,axis,ya,yb] · rails [x0,z0,x1,z1,y,h]
# ==========================================================================
import os, sys, json, math, importlib.util
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(HERE, 'gen'))
spec = importlib.util.spec_from_file_location('gen', os.path.join(HERE, 'gen', 'gen.py')); G = importlib.util.module_from_spec(spec); spec.loader.exec_module(G)
WALK, F, C, OUT, SLOPE, STEPS, ZID = G.WALK, G.F, G.C, G.OUT, G.SLOPE, G.STEPS, G.ZID
H, W, S, cx, cz, rects = G.H, G.W, G.S, G.cx, G.cz, G.rects
BASE = -4.0
boxes, stairs, ramps = [], [], []
def box(x0, z0, x1, z1, y0, y1, kind):
    if x1 - x0 > 1e-4 and z1 - z0 > 1e-4 and y1 - y0 > 1e-4: boxes.append([round(x0, 3), round(z0, 3), round(x1, 3), round(z1, 3), round(y0, 3), round(y1, 3), kind])
# mure: massive celler op til den højeste naboflade (loft inde, brystning/usynlig væg ude) – kun et bånd omkring bygningen
near = np.zeros_like(WALK); ii, jj = np.nonzero(WALK); i0, i1, j0, j1 = max(0, ii.min() - 6), min(H, ii.max() + 7), max(0, jj.min() - 6), min(W, jj.max() + 7)
near[i0:i1, j0:j1] = True
top = np.where(WALK, np.where(OUT, np.nan_to_num(F) + 4.0, np.nan_to_num(C)), -99.0)
t2 = top.copy()
for _ in range(14):                                                    # murens højde = højeste nabo-loft (inden for murtykkelsen)
    n = t2.copy(); n[1:] = np.maximum(n[1:], t2[:-1]); n[:-1] = np.maximum(n[:-1], t2[1:]); n[:, 1:] = np.maximum(n[:, 1:], t2[:, :-1]); n[:, :-1] = np.maximum(n[:, :-1], t2[:, 1:])
    t2 = np.where(WALK, t2, n)
_wd = WALK.copy()                                                               # ydermurens tykkelse: op til 0,6 m uden for gulvet (lukker sprækker i facaden)
for _ in range(5):
    n_ = _wd.copy(); n_[1:] |= _wd[:-1]; n_[:-1] |= _wd[1:]; n_[:, 1:] |= _wd[:, :-1]; n_[:, :-1] |= _wd[:, 1:]; _wd = n_
mass = ~WALK & near & (t2 > -50) & (~G.EXT | _wd)                              # v26: bygningens egne mure – ikke tomrummet langt udenfor
key = np.where(mass, np.round(t2 * 4).astype(np.int64), -1)
for (a0, b0, a1, b1, k) in rects(mass, key): box(cx(b0), cz(a0), cx(b1), cz(a1), BASE, k / 4.0, 'wall')
# lofter (inde): plade fra loftet og 0,3 m op – stopper granater og hop
ind = WALK & ~OUT & np.isfinite(C)
key = np.where(ind, np.round(np.nan_to_num(C) * 100).astype(np.int64), -1)
for (a0, b0, a1, b1, k) in rects(ind, key): box(cx(b0), cz(a0), cx(b1), cz(a1), k / 100.0, k / 100.0 + 0.3, 'ceil')
# gulve (ikke trapper/ramper)
fl = WALK & (SLOPE < 0)
key = np.where(fl, np.round(np.nan_to_num(F) * 100).astype(np.int64) + 100000, -1)
for (a0, b0, a1, b1, k) in rects(fl, key): box(cx(b0), cz(a0), cx(b1), cz(a1), BASE, (k - 100000) / 100.0, 'floor')
# trapper og ramper (pr. sammenhængende tværløb)
def lateral_runs(t, k):
    x0, y0, x1, y1 = t['r']; blk = SLOPE[y0:y1, x0:x1] == k
    lat = blk.any(axis=1) if t['axis'] == 'x' else blk.any(axis=0)
    out, a = [], None; base = y0 if t['axis'] == 'x' else x0
    for q, v in enumerate(list(lat) + [False]):
        if v and a is None: a = q
        if not v and a is not None: out.append((base + a, base + q)); a = None
    return out
for k, t in enumerate(G.TR):
    x0, y0, x1, y1 = t['r']; lo = min(t['ya'], t['yb'])
    for (l0, l1) in lateral_runs(t, k):
        r = [cx(x0), cz(l0), cx(x1), cz(l1)] if t['axis'] == 'x' else [cx(l0), cz(y0), cx(l1), cz(y1)]
        r = [round(v, 3) for v in r]
        if t['kind'] == 'stairs':
            n = max(2, int(round(abs(t['yb'] - t['ya']) / 0.17)))
            stairs.append(r + [t['axis'], t['ya'], t['yb'], n]); box(r[0], r[1], r[2], r[3], BASE, lo - 0.3, 'floor')
        else:
            ramps.append(r + [t['axis'], t['ya'], t['yb']]); box(r[0], r[1], r[2], r[3], BASE, lo, 'floor')
# døroverliggere, inventar
for (x0, z0, x1, z1, y0, y1) in G.HEADERS: box(x0, z0, x1, z1, y0, y1, 'wall')
for p in G.PROPS:
    if 'c' in p:
        x, y, z, sx, sy, sz = p['c']; box(x - sx / 2, z - sz / 2, x + sx / 2, z + sz / 2, y - sy / 2, y + sy / 2, 'prop')
rails = [r for r in G.RAILS]
# spawns, sites, labels
M = G.M
def pts(r, yaw, n=6):
    x0, z0, x1, z1 = cx(r[0]), cz(r[1]), cx(r[2]), cz(r[3]); out = []
    for k in range(n):
        u, v = (k % 3 + 0.5) / 3, (k // 3 + 0.5) / 2; x, z = x0 + (x1 - x0) * u, z0 + (z1 - z0) * v
        i, j = int(z / S + G.CY), int(x / S + G.CX); out.append([round(x, 2), round(z, 2), yaw, round(float(F[i, j]), 2)])
    return out
sites = {}
for k_, v in M['sites'].items():
    x0, z0, x1, z1 = cx(v[0]), cz(v[1]), cx(v[2]), cz(v[3]); i, j = int(((z0 + z1) / 2) / S + G.CY), int(((x0 + x1) / 2) / S + G.CX)
    sites[k_] = [round(x0, 2), round(z0, 2), round(x1, 2), round(z1, 2), round(float(F[i, j]), 2)]
NAMES = {'CT Spawn': 'Parkeringskælder', 'CT Forgård': 'Varegården', 'A Site': 'A – Serverhallen', 'Heaven': 'Kontrolrummet', 'Mid': 'Atriet',
         'T Spawn': 'Tagterrassen', 'T Ramp': 'Helipad-trappen', 'T Base': 'Receptionen', 'Mid T': 'Elevatorlobbyen', 'B Site': 'B – Våbenkammeret',
         'Connector': 'Kaffebaren', 'Long A': 'Long A', 'Top Mid': 'Top Mid', 'Lower B': 'Kedelrummet'}
labels = [[NAMES.get(z['name'], z['name']), round(cx((z['r'][0] + z['r'][2]) / 2), 2), round(cz((z['r'][1] + z['r'][3]) / 2), 2), z['y']] for z in M['zones']]
# v26: intro – hijackernes helikopter svæver ud for tagterrassens sydlige brystning (skids lige over brystningen, døren mod terrassen)
zt = G.ZN.index('T Spawn'); ii_, jj_ = np.nonzero(ZID == zt); jc = int((jj_.min() + jj_.max()) / 2); ie = int(ii_.max()) + 1
io = ie
while io < H and not G.VOID[io, jc]: io += 1                                    # brystningens yderside
intro = {'hij': {'mode': 'heli', 'edge': round(cz(ie), 2), 'outer': round(cz(io), 2), 'parapet': G.PARAPET,
                 'hover': [round(cx(jc + 0.5), 2), round(G.PARAPET + 0.3, 2), round(cz(io) + 1.7, 2)], 'yaw': round(math.pi / 2, 4)}}
X0, X1 = math.floor(cx(j0)), math.ceil(cx(j1)); Z0, Z1 = math.floor(cz(i0)), math.ceil(cz(i1))
D = {'version': '1', 'grid': {'GX0': X0, 'GZ0': Z0, 'GW': int((X1 - X0) / 2) + 1, 'GH': int((Z1 - Z0) / 2) + 1},
     'boxes': boxes, 'ramps': ramps, 'stairs': stairs, 'rails': rails, 'cyls': [], 'doors': [], 'ladders': [], 'labels': labels, 'sites': sites,
     'spawns': {'hij': pts(M['spawns']['hij'], 0.0), 'swat': pts(M['spawns']['swat'], math.pi)}, 'levels': {'T': 0.0, 'CT': 6.0}, 'water': [], 'intro': intro}
# v26: lamperne til spillets lys-prober (alt der bevæger sig: våben i hånden, spillere, C4, tabte våben) – samme lamper som bagningen
PK = {'down': (0.75, 7.0, 0xffcf94, True), 'panel': (1.1, 8.0, 0xfff2e0, True), 'linear': (1.0, 8.0, 0xeaf2ff, True), 'highbay': (2.2, 13.0, 0xffeccc, True),
      'server': (1.6, 9.0, 0x8cc0ff, True), 'atrium': (2.4, 14.0, 0xffe0bc, True), 'street': (1.6, 12.0, 0xffb873, False), 'emergency': (0.9, 6.0, 0xff2010, False), 'ring': (1.1, 9.0, 0xffdcab, False)}
pl = []
for l in G.LIGHTS:
    k = PK.get(l['kind'])
    if not k: continue
    i_, r_, c_, down = k
    if l.get('dark'): i_ *= 0.45
    e = {'x': l['x'], 'y': l['y'], 'z': l['z'], 'i': round(i_, 3), 'range': r_, 'color': c_}
    if down: e['dir'] = [0, -1, 0]; e['cone'] = 1.2
    pl.append(e)
json.dump({'lamps': pl}, open(os.path.join(ROOT, 'public', 'assets', 'bureau', 'probes.json'), 'w'), separators=(',', ':'))
print('probes.json: %d lamper' % len(pl))
# v26: gulvceller (0,5 m) til rækkevidde-testen (test/reach.js)
wc = []
for i in range(0, H, 4):
    for j in range(0, W, 4):
        if WALK[i, j] and SLOPE[i, j] < 0 and not OUT[i, j] or (WALK[i, j] and OUT[i, j] and SLOPE[i, j] < 0):
            wc.append([round(cx(j + 0.5), 2), round(cz(i + 0.5), 2), round(float(F[i, j]), 2), G.ZN[ZID[i, j]]])
json.dump({'cells': wc}, open(os.path.join(HERE, 'out', 'bureau_walk.json'), 'w'))
txt = ('/* AUTOGENERERET af tools/bureau/export_collision.py – redigér ikke i hånden.\n   de_bureau: luksus-bureauet øverst i et højhus om natten. */\n'
       '(function (root) {\n  const D = ' + json.dumps(D, ensure_ascii=False, separators=(',', ':')) + ';\n'
       "  if (typeof module === 'object' && module.exports) module.exports = D; else root.WD_BUREAU = D;\n})(typeof self !== 'undefined' ? self : this);\n")
open(os.path.join(ROOT, 'shared', 'bureau_data.js'), 'w').write(txt)
print('bureau_data.js: %d bokse · %d trapper · %d ramper · %d gelændere · %.0f KB' % (len(boxes), len(stairs), len(ramps), len(rails), len(txt) / 1e3))
