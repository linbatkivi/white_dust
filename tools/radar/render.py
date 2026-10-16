#!/usr/bin/env python3
# Radar-generator trin 2: rene minimap-billeder i CS-stil (python3 tools/radar/render.py <bane> …) → public/assets/radar/<bane>_<lag>.png + <bane>.json
#   gangbar maske → flertals-filter (fjerner takker og småhuller) → højdeniveauer (1 m) med lysere toner opad →
#   4× opløsning med udglattede kanter (blur + tærskel) → mørk kontur om alle kanter og tynde linjer mellem niveauer.
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
DST = os.path.join(ROOT, 'public', 'assets', 'radar'); os.makedirs(DST, exist_ok=True)
UP = 4
SMOOTH = {'inferno': 4}                                              # ru STL-baner: kraftigere udglatning
def majority(m, it=2):
    for _ in range(it):
        s = sum(np.roll(np.roll(m.astype(np.int16), dj, 0), di, 1) for dj in (-1, 0, 1) for di in (-1, 0, 1)); m = s >= 5
    return m
def fill_small(m, maxc):
    from collections import deque
    H, W = m.shape; seen = np.zeros_like(m); out = m.copy()
    for val in (False, True):                                           # småhuller (props) fyldes, småøer fjernes
        seen[:] = False
        for j in range(H):
            for i in range(W):
                if m[j, i] != val or seen[j, i]: continue
                q = deque([(j, i)]); seen[j, i] = True; comp = []
                while q:
                    a, b = q.popleft(); comp.append((a, b))
                    for c, d in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                        if 0 <= c < H and 0 <= d < W and not seen[c, d] and m[c, d] == val: seen[c, d] = True; q.append((c, d))
                if len(comp) < maxc:
                    for (a, b) in comp: out[a, b] = not val
    return out
def render(id_):
    D = json.load(open(os.path.join(HERE, 'out', id_ + '.json'))); nx, nz, R = D['nx'], D['nz'], D['R']
    meta = {'x0': D['x0'], 'z0': D['z0'], 'scale': R / UP, 'layers': []}
    for li, L in enumerate(D['layers']):
        h = np.array([np.nan if v is None else v for v in L['h']], float).reshape(nz, nx)
        m = ~np.isnan(h); m = majority(m, SMOOTH.get(id_, 2)); m = fill_small(m, int(1.2 / (R * R)))
        hf = np.where(np.isnan(h), np.nanmedian(h[m]) if m.any() else 0, h)
        lev = np.round(hf / 1.0)                                         # 1 m-niveauer
        lv8 = np.clip(lev + 128, 0, 255).astype(np.uint8)                # småøer (kasser, kanter) i niveauerne fjernes – rene flader og lige kanter
        for _ in range(SMOOTH.get(id_, 2)): lv8 = np.array(Image.fromarray(lv8).filter(ImageFilter.ModeFilter(5)))
        lev = lv8.astype(float) - 128
        lo, hi = np.percentile(lev[m], 2), np.percentile(lev[m], 98)
        t = np.clip((lev - lo) / max(1.0, hi - lo), 0, 1)
        # opskalering: niveau nærmeste nabo, maske udglattet
        big = lambda a, mode: np.array(Image.fromarray(a).resize((nx * UP, nz * UP), mode))
        mb = big((m * 255).astype(np.uint8), Image.BILINEAR)
        mb = np.array(Image.fromarray(mb).filter(ImageFilter.GaussianBlur(UP * 0.6))) > 127
        tb = big((t * 255).astype(np.uint8), Image.NEAREST).astype(float) / 255
        lb = big(lev.astype(np.int16).astype(np.uint8) + 128, Image.NEAREST)
        base = 92 + tb * 120                                             # lavt = mørkere grå, højt = lysere
        img = np.zeros((nz * UP, nx * UP, 4), np.uint8)
        img[..., 0] = np.clip(base * 0.98, 0, 255); img[..., 1] = np.clip(base * 1.0, 0, 255); img[..., 2] = np.clip(base * 1.03, 0, 255); img[..., 3] = np.where(mb, 255, 0)
        edge = mb & ~(np.roll(mb, 1, 0) & np.roll(mb, -1, 0) & np.roll(mb, 1, 1) & np.roll(mb, -1, 1))
        edge = np.array(Image.fromarray((edge * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))) > 0
        step = mb & ((lb != np.roll(lb, 1, 0)) | (lb != np.roll(lb, 1, 1)))
        img[step, :3] = (img[step, :3] * 0.72).astype(np.uint8)
        img[edge & mb] = [24, 26, 28, 255]
        f = '%s_%d.png' % (id_, li); Image.fromarray(img).save(os.path.join(DST, f), optimize=True)
        meta['layers'].append({'yb': L['yb'], 'yt': L['yt'], 'img': f, 'w': nx * UP, 'h': nz * UP})
    json.dump(meta, open(os.path.join(DST, id_ + '.json'), 'w'))
    print(id_, 'radar', [l['img'] for l in meta['layers']])
for a in sys.argv[1:]: render(a)
