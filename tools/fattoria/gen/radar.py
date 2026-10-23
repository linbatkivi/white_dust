#!/usr/bin/env python3
# de_fattoria · minikort (radar) til spillet: public/assets/radar/fattoria.json + fattoria_0.png (lav: piazza/vinmark/kælder) + fattoria_1.png (høj: terrasse/villa) – RGBA, 20 px/m
#   python3 tools/fattoria/gen/radar.py
import os, json, math
import numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); TOOL = os.path.dirname(HERE); ROOT = os.path.abspath(os.path.join(TOOL, '..', '..'))
D = json.load(open(os.path.join(TOOL, 'out', 'fattoria_design.json')))
RES, X0, Z0, NX, NZ, TOP = D['res'], D['X0'], D['Z0'], D['NX'], D['NZ'], D['top']
H = np.array(D['H'], np.float32); K = np.array(D['K'], np.int8); SURF = np.array(D['SURF'], np.int8); STYLE = np.array(D['STYLE'], np.int8)
UB = np.array([[np.nan if v is None else v for v in r] for r in D['UB']], np.float32); UT = np.array([[np.nan if v is None else v for v in r] for r in D['UT']], np.float32); UK = np.array(D['UK'], np.int8)
SURFS = D['surfs']
COL = {'gravel': (214, 200, 160), 'cobble': (176, 170, 156), 'soil': (176, 140, 98), 'terracotta': (190, 110, 76), 'brickfloor': (150, 98, 84), 'grass': (150, 160, 100), 'marble': (214, 210, 200), 'stone': (170, 166, 154), 'wood': (150, 108, 70), 'vineyard': (170, 150, 90)}
# synlig udstrækning: celler uden for 'hill' (massiv) og inden for banens gangbare område + 2 m
walk = (K == 1) | (~np.isnan(UK) & (UK == 1))
ys, xs = np.where((K == 1) | (~np.isnan(UB)))
i0, i1, j0, j1 = max(0, xs.min() - 6), min(NX, xs.max() + 7), max(0, ys.min() - 6), min(NZ, ys.max() + 7)
SC = 0.05; PX = int(round(RES / SC)); W = (i1 - i0) * PX; Hh = (j1 - j0) * PX
def layer(lo, hi):
    img = Image.new('RGBA', (W, Hh), (0, 0, 0, 0)); a = np.zeros((Hh, W, 4), np.uint8)
    for j in range(j0, j1):
        for i in range(i0, i1):
            y = float(H[j, i]); col = None
            if K[j, i] == 1 and lo <= y < hi: col = COL.get(SURFS[SURF[j, i]], (176, 170, 156))
            elif not np.isnan(UB[j, i]) and UK[j, i] == 1 and lo <= float(UT[j, i]) < hi: col = COL['terracotta']
            elif K[j, i] == 0 and H[j, i] < TOP - 0.01 and y >= lo - 0.5 and y < hi + 1.5 and STYLE[j, i] != 0: col = (74, 74, 80)     # lave mure
            if col: a[(j - j0) * PX:(j - j0 + 1) * PX, (i - i0) * PX:(i - i0 + 1) * PX] = (*col, 255)
    return Image.fromarray(a, 'RGBA')
def furniture(img, lo, hi):
    d = ImageDraw.Draw(img); P = lambda x, z: ((x - (X0 + i0 * RES)) / SC, (z - (Z0 + j0 * RES)) / SC)
    for (x, z, w, dd, h, y0, st) in D['props']:
        if lo - 0.3 <= y0 < hi and st not in ('hedge',): d.rectangle([P(x - w / 2, z - dd / 2), P(x + w / 2, z + dd / 2)], fill=(74, 74, 80, 255))
    for (x, z, r, y0, y1, st) in D['cyls']:
        if lo - 0.3 <= y0 < hi and st in ('well', 'fountain', 'foudre', 'pier', 'column'): d.ellipse([P(x - r, z - r), P(x + r, z + r)], fill=(74, 74, 80, 255))
    for (pts, y0, y1, st) in D['dwalls']:
        if lo - 0.3 <= y0 < hi: d.polygon([P(*q) for q in pts], fill=(74, 74, 80, 255))
    for (x0, z0, x1, z1, base, h, st) in D['rails']:
        if st == 'vine' and lo - 0.3 <= base < hi: d.line([P(x0, (z0 + z1) / 2), P(x1, (z0 + z1) / 2)], fill=(110, 150, 70, 255), width=3)
    for (x0, z0, x1, z1, axis, ya, yb, n, st) in D['stairs']:
        if lo - 0.3 <= min(ya, yb) < hi + 3: d.rectangle([P(x0, z0), P(x1, z1)], fill=(205, 196, 170, 255))
os.makedirs(os.path.join(ROOT, 'public', 'assets', 'radar'), exist_ok=True)
L0 = layer(-6.0, 1.3); furniture(L0, -6.0, 1.3); L0.save(os.path.join(ROOT, 'public', 'assets', 'radar', 'fattoria_0.png'), optimize=True)
L1 = layer(1.3, 14.0); furniture(L1, 1.3, 14.0); L1.save(os.path.join(ROOT, 'public', 'assets', 'radar', 'fattoria_1.png'), optimize=True)
json.dump({'x0': round(float(X0 + int(i0) * RES), 2), 'z0': round(float(Z0 + int(j0) * RES), 2), 'scale': SC, 'layers': [{'yb': -6, 'yt': 1.3, 'img': 'fattoria_0.png', 'w': int(W), 'h': int(Hh)}, {'yb': 1.3, 'yt': 14, 'img': 'fattoria_1.png', 'w': int(W), 'h': int(Hh)}]},
          open(os.path.join(ROOT, 'public', 'assets', 'radar', 'fattoria.json'), 'w'))
print('[radar]', W, Hh, os.path.getsize(os.path.join(ROOT, 'public', 'assets', 'radar', 'fattoria_0.png')) // 1024, 'KB +', os.path.getsize(os.path.join(ROOT, 'public', 'assets', 'radar', 'fattoria_1.png')) // 1024, 'KB')
bg = Image.new('RGBA', L0.size, (28, 30, 36, 255)); bg.alpha_composite(L0); bg.alpha_composite(L1); bg.convert('RGB').resize((1000, int(1000 * Hh / W))).save(os.path.join(TOOL, 'out', 'radar_preview.png'))
