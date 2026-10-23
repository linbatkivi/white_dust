#!/usr/bin/env python3
# Tegner bot-ruter fra test/sim/botsim.js (SIMOUT=json) oven på radaren: python3 test/sim/plot.py sim.json bureau runde out.png
import json, sys
from PIL import Image, ImageDraw
d = json.load(open(sys.argv[1])); mp = sys.argv[2]; rn = int(sys.argv[3]); out = sys.argv[4]
meta = json.load(open(f'public/assets/radar/{mp}.json')); L = meta['layers'][0]
im = Image.open(f'public/assets/radar/{L["img"]}').convert('RGB'); sc = meta['scale']
W, H = im.size; dr = ImageDraw.Draw(im, 'RGBA')
def px(x, z): return ((x - meta['x0']) / sc, (z - meta['z0']) / sc)
r = [q for q in d['rounds'] if q['n'] == rn][0]; sides = d['sides']
cols = {'hij': [(255, 70, 40), (255, 160, 20), (230, 40, 160), (255, 220, 40), (200, 90, 0)], 'swat': [(60, 140, 255), (40, 220, 220), (120, 90, 255), (60, 220, 120), (20, 90, 200)]}
ci = {'hij': 0, 'swat': 0}
for pid, tr in r['tracks'].items():
    s = sides.get(pid)
    if s not in cols: continue
    c = cols[s][ci[s] % 5]; ci[s] += 1
    pts = [px(p[1], p[2]) for p in tr]
    if len(pts) > 1: dr.line(pts, fill=c + (230,), width=7)
    for i, p in enumerate(tr):
        if i % 10 == 0: x, y = px(p[1], p[2]); dr.ellipse([x - 7, y - 7, x + 7, y + 7], fill=c + (255,))
    x, y = pts[0]; dr.rectangle([x - 12, y - 12, x + 12, y + 12], outline=c + (255,), width=4)
for k in r['kills']:
    v = str(k['v']); tr = r['tracks'].get(v)
    if not tr: continue
    b = min(tr, key=lambda p: abs(p[0] - k['t'])); x, y = px(b[1], b[2]); dr.line([x - 14, y - 14, x + 14, y + 14], fill=(255, 255, 255, 255), width=6); dr.line([x - 14, y + 14, x + 14, y - 14], fill=(255, 255, 255, 255), width=6)
if r.get('plant'): x, y = px(r['plant'][1], r['plant'][2]); dr.ellipse([x - 22, y - 22, x + 22, y + 22], outline=(255, 255, 0, 255), width=6)
im.thumbnail((1500, 1500)); im.save(out)
