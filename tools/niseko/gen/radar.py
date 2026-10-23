#!/usr/bin/env python3
# de_niseko · minikort (radar) til spillet: public/assets/radar/niseko.json + niseko_0.png (RGBA, 20 px/m, gennemsigtigt uden for gangene) – python3 tools/niseko/gen/radar.py
import os, json, math
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); TOOL = os.path.dirname(HERE); ROOT = os.path.abspath(os.path.join(TOOL, '..', '..'))
D = json.load(open(os.path.join(TOOL, 'out', 'niseko_design.json')))
walk = D['walk']; xs = [p[0] for p in walk['ext']]; zs = [p[1] for p in walk['ext']]
X0, Z0, X1, Z1 = min(xs) - 1.0, min(zs) - 1.0, max(xs) + 1.0, max(zs) + 1.0
SC = 0.05; W = int((X1 - X0) / SC); H = int((Z1 - Z0) / SC)
img = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
P = lambda q: ((q[0] - X0) / SC, (q[1] - Z0) / SC)
COL = {'nk_street': (170, 160, 122), 'nk_stonebase': (124, 130, 140), 'nk_gravel': (206, 196, 158), 'nk_raked': (206, 196, 158), 'nk_floor': (176, 132, 84), 'nk_pebbles': (140, 138, 124), 'nk_slate': (124, 130, 140)}
def poly(ring, holes, col):
    d.polygon([P(q) for q in ring], fill=col)
    for h in holes: d.polygon([P(q) for q in h], fill=(0, 0, 0, 0))
for s in D['surf']:
    for p in s['polys']: poly(p['ext'], p['holes'], COL.get(s['mat'], (170, 160, 122)) + (255,))
for w in D['water']:
    for p in w['polys']: poly(p['ext'], [], (78, 138, 190, 255))
x0, z0, x1, z1 = D['bridge']; d.rectangle([P((x0, z0)), P((x1, z1))], fill=(150, 154, 160, 255))
for pr in D['props']: d.polygon([P(q) for q in pr['poly']], fill=(70, 70, 76, 255))
th = D['teahouse']
for w in th['walls']: d.rectangle([P((w[0], w[1])), P((w[2], w[3]))], fill=(70, 70, 76, 255))
c = th['counter']; d.rectangle([P((c[0], c[1])), P((c[2], c[3]))], fill=(70, 70, 76, 255))
b = D['balcony']; bx0, bz0, bx1, bz1 = b['deck']; d.rectangle([P((bx0, bz0)), P((bx1, bz1))], fill=(120, 84, 52, 255), outline=(60, 40, 24, 255))
os.makedirs(os.path.join(ROOT, 'public', 'assets', 'radar'), exist_ok=True)
img.save(os.path.join(ROOT, 'public', 'assets', 'radar', 'niseko_0.png'), optimize=True)
json.dump({'x0': round(X0, 2), 'z0': round(Z0, 2), 'scale': SC, 'layers': [{'yb': -4, 'yt': 9, 'img': 'niseko_0.png', 'w': W, 'h': H}]}, open(os.path.join(ROOT, 'public', 'assets', 'radar', 'niseko.json'), 'w'))
print('[radar]', W, H, os.path.getsize(os.path.join(ROOT, 'public', 'assets', 'radar', 'niseko_0.png')) // 1024, 'KB')
bg = Image.new('RGBA', img.size, (28, 30, 36, 255)); bg.alpha_composite(img); bg.convert('RGB').resize((1000, int(1000 * H / W))).save(os.path.join(TOOL, 'out', 'radar_preview.png'))
