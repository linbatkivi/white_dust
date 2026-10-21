#!/usr/bin/env python3
# v26.5: valkyrie's minimap direkte fra banens generator – HELT LIGE, hårde, vinkelrette kanter (ingen udglatning/blur)
#   gangbare celler → små takker rettet ud (lukning/åbning med kvadrat) → farve pr. højde (lysere opad, CS-radar) →
#   3 px pr. celle uden interpolation → mørk 2 px kontur langs alle kanter, tynde linjer mellem niveauer, trapper med trinstreger,
#   skrå mure tegnet som rette linjer.   python3 tools/radar/valkyrie_radar.py → public/assets/radar/valkyrie_0.png + valkyrie.json
import json, os, sys, math, importlib.util
import numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
spec = importlib.util.spec_from_file_location('gen', os.path.join(ROOT, 'tools', 'valkyrie', 'gen', 'gen.py')); G = importlib.util.module_from_spec(spec); spec.loader.exec_module(G)
ndi = G.ndi; PX = 3                                                     # pixels pr. celle (0,12 m) → 0,04 m/px
Wk = G.WALK.copy()
ii, jj = np.nonzero(Wk); i0, i1, j0, j1 = ii.min() - 6, ii.max() + 7, jj.min() - 6, jj.max() + 7
Wk = Wk[i0:i1, j0:j1]; F = np.nan_to_num(G.F[i0:i1, j0:j1], nan=-99); SL = G.SLOPE[i0:i1, j0:j1]
def box_close(m, k):
    from numpy.lib.stride_tricks import sliding_window_view as swv
    a = k // 2; b = k - 1 - a
    di = swv(np.pad(m, ((a, b), (a, b))), (k, k)).any(axis=(2, 3))
    return swv(np.pad(di, ((b, a), (b, a)), constant_values=True), (k, k)).all(axis=(2, 3))
# rette vinkler: småtakker (≤ 2 celler) i murenes ender og hjørner fjernes – lukning (fylder små indhak) og åbning (fjerner små fremspring)
M = box_close(Wk, 5) & (box_close(~Wk, 5) == False) | Wk
M = ndi.binary_opening(M, structure=np.ones((5, 5), bool)) | (Wk & ndi.binary_opening(Wk, structure=np.ones((3, 3), bool)))
# højde pr. celle (nye celler fra lukningen får naboens højde)
Fz = F.copy()
for _ in range(6):
    hole = M & (Fz < -50)
    if not hole.any(): break
    n = np.maximum.reduce([np.roll(Fz, s, a) for a in (0, 1) for s in (1, -1)]); Fz[hole] = n[hole]
lv = np.clip(np.round((Fz + 1.5) / 1.5), 0, 5).astype(int)              # niveauer à 1,5 m: −1,5 · 0 · 1,5 · 3 · 4,5 · 6
TONE = [(96, 82, 66), (176, 152, 116), (196, 172, 134), (214, 192, 154), (228, 208, 172), (240, 224, 192)]
H_, W_ = M.shape; rgb = np.zeros((H_, W_, 4), np.uint8)
for k, c in enumerate(TONE): rgb[M & (lv == k)] = (*c, 255)
st = M & (SL >= 0)                                                       # trapper/ramper: let blåt skær
rgb[st, :3] = (rgb[st, :3] * 0.85 + np.array([90, 120, 160]) * 0.15).astype(np.uint8)
img = Image.fromarray(rgb, 'RGBA').resize((W_ * PX, H_ * PX), Image.NEAREST)
d = ImageDraw.Draw(img)
OUT = (18, 19, 22, 255); LINE = (40, 42, 48, 255)
# kontur: kant mellem gangbart og ikke-gangbart (2 px, på ydersiden) og tynde linjer mellem niveauer
for (ax, sh) in ((0, 1), (0, -1), (1, 1), (1, -1)):
    nb = np.roll(M, sh, ax); edge = M & ~nb
    lvn = np.roll(lv, sh, ax); step = M & nb & (lvn != lv) & (lv > lvn)
    for mask, col, wdt in ((edge, OUT, 2), (step, LINE, 1)):
        ys, xs = np.nonzero(mask)
        for y, x in zip(ys, xs):
            if ax == 0:
                yy = y * PX if sh == 1 else (y + 1) * PX - 1
                d.rectangle([x * PX, yy - (wdt - 1 if sh == 1 else 0), x * PX + PX - 1, yy + (0 if sh == 1 else wdt - 1)], fill=col)
            else:
                xx = x * PX if sh == 1 else (x + 1) * PX - 1
                d.rectangle([xx - (wdt - 1 if sh == 1 else 0), y * PX, xx + (0 if sh == 1 else wdt - 1), y * PX + PX - 1], fill=col)
# trinstreger på trapperne (tværs af løbet, hver 0,48 m) – kun inden for gulvet
hat = Image.new('RGBA', img.size, (0, 0, 0, 0)); d0 = d; d = ImageDraw.Draw(hat)
for k, t in enumerate(G.TR):
    if t['kind'] != 'stairs': continue
    x0, y0, x1, y1 = t['r']
    for s in range(0, (x1 - x0) if t['axis'] == 'x' else (y1 - y0), 4):
        if t['axis'] == 'x':
            xs = (x0 + s - j0) * PX; d.line([(xs, (y0 - i0) * PX + 2), (xs, (y1 - i0) * PX - 3)], fill=(60, 64, 72, 150), width=1)
        else:
            ys = (y0 + s - i0) * PX; d.line([((x0 - j0) * PX + 2, ys), ((x1 - j0) * PX - 3, ys)], fill=(60, 64, 72, 150), width=1)
mk = Image.fromarray((M * 255).astype(np.uint8)).resize(img.size, Image.NEAREST)
img.paste(hat, (0, 0), Image.fromarray(np.minimum(np.array(hat)[:, :, 3], np.array(mk))))
d = d0
# skrå mure: rette linjer hen over savtakken (samme strækninger som generatorens beklædning)
for pts, cells in G._chains():
    if len(pts) < 10: continue
    P = np.array([(j - j0, i - i0) for (i, j) in pts], float)
    ks = G._dp(P * G.S, 0.32)
    for a, b in zip(ks[:-1], ks[1:]):
        dv = (P[b] - P[a]) * G.S; L = math.hypot(*dv); ang = abs(math.degrees(math.atan2(dv[1], dv[0]))) % 90
        if L < 1.0 or ang < 8 or ang > 82: continue
        seg = P[a:b + 1]; u = dv / L; nrm = np.array([-u[1], u[0]])
        ci = np.array([(c[1] - j0 + 0.5, c[0] - i0 + 0.5) for c in cells[a:b]]); side = 1 if np.mean((ci - P[a]) @ nrm) > 0 else -1
        off = max(0.0, float(np.max((seg - P[a]) @ (nrm * side))))
        p0 = (P[a] + nrm * side * off) * PX; p1 = (P[b] + nrm * side * off) * PX
        q0 = p0 - nrm * side * (off + 0.4) * PX; q1 = p1 - nrm * side * (off + 0.4) * PX   # takkerne bag linjen bliver mur
        d.polygon([tuple(p0), tuple(p1), tuple(q1), tuple(q0)], fill=(0, 0, 0, 0))
        d.line([tuple(p0), tuple(p1)], fill=OUT, width=3)
img.save(os.path.join(ROOT, 'public', 'assets', 'radar', 'valkyrie_0.png'), optimize=True)
meta = {'x0': round(G.cx(j0), 4), 'z0': round(G.cz(i0), 4), 'scale': round(G.S / PX, 6), 'layers': [{'yb': -4, 'yt': 9, 'img': 'valkyrie_0.png', 'w': img.size[0], 'h': img.size[1]}]}
json.dump(meta, open(os.path.join(ROOT, 'public', 'assets', 'radar', 'valkyrie.json'), 'w'))
print('[radar] valkyrie %dx%d px, %.3f m/px' % (img.size[0], img.size[1], G.S / PX), meta['x0'], meta['z0'])
