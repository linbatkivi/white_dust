#!/usr/bin/env python3
# de_fattoria · minikort (radar) til spillet: public/assets/radar/fattoria.json + fattoria_0.png (gulvplan) + fattoria_1.png (tårndæk og galleri) – RGBA, 20 px/m – python3 tools/fattoria/gen/radar.py
import os, json, math
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); TOOL = os.path.dirname(HERE); ROOT = os.path.abspath(os.path.join(TOOL, '..', '..'))
D = json.load(open(os.path.join(TOOL, 'out', 'fattoria_design.json')))
walk = D['walk']; xs = [p[0] for p in walk['ext']]; zs = [p[1] for p in walk['ext']]
X0, Z0, X1, Z1 = min(xs) - 1.0, min(zs) - 1.0, max(xs) + 1.0, max(zs) + 1.0
SC = 0.05; W = int((X1 - X0) / SC); H = int((Z1 - Z0) / SC)
P = lambda q: ((q[0] - X0) / SC, (q[1] - Z0) / SC)
COL = {'ft_gravel': (214, 200, 160), 'ft_cobble': (176, 170, 156), 'ft_cobble2': (168, 164, 150), 'ft_brickf': (176, 120, 96), 'ft_terra': (190, 118, 84)}
def layer0():
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    for g in D['ground']: d.polygon([P(q) for q in g['ring']], fill=COL.get(g['m'], (190, 180, 150)) + (255,))
    for it in D['dress']:
        t = it['t']; dk = (74, 74, 80, 255)
        if t in ('well', 'fountain', 'tun', 'barrel', 'tree'):
            r = it.get('r', 0.4); c = P((it['x'], it['z'])); rr = r / SC; d.ellipse([c[0] - rr, c[1] - rr, c[0] + rr, c[1] + rr], fill=dk)
        elif 'L' in it:
            y = it['yaw']; hw, hd = it['L'] / 2, it['W'] / 2; cs, sn = math.cos(y), math.sin(y)
            d.polygon([P((it['x'] + a * cs - b * sn, it['z'] + a * sn + b * cs)) for (a, b) in ((-hw, -hd), (hw, -hd), (hw, hd), (-hw, hd))], fill=dk)
    for k, v in D['sites'].items(): pass
    return img
def layer1():
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(img); T = D['tower']; G = D['gallery']
    d.rectangle([P((T['x0'], T['z0'])), P((T['x1'], T['slab_z1']))], fill=(150, 108, 70, 255)); d.rectangle([P((T['east_x0'], T['slab_z1'])), P((T['x1'], T['z1']))], fill=(150, 108, 70, 255))
    sx0, sz0, sx1, sz1 = T['stair']; d.rectangle([P((sx0, sz0)), P((sx1, sz1))], fill=(205, 196, 170, 255))
    for (mx0, mz0, mx1, mz1) in T['merlons']: d.rectangle([P((mx0, mz0)), P((mx1, mz1))], fill=(74, 74, 80, 255))
    d.rectangle([P((G['x0'], G['z0'])), P((G['x1'], G['z1']))], fill=(150, 108, 70, 255)); d.rectangle([P((G['sx0'], G['z0'])), P((G['sx1'], G['z1']))], fill=(205, 196, 170, 255))
    return img
os.makedirs(os.path.join(ROOT, 'public', 'assets', 'radar'), exist_ok=True)
L0, L1 = layer0(), layer1()
L0.save(os.path.join(ROOT, 'public', 'assets', 'radar', 'fattoria_0.png'), optimize=True); L1.save(os.path.join(ROOT, 'public', 'assets', 'radar', 'fattoria_1.png'), optimize=True)
json.dump({'x0': round(X0, 2), 'z0': round(Z0, 2), 'scale': SC, 'layers': [{'yb': -4, 'yt': 1.3, 'img': 'fattoria_0.png', 'w': W, 'h': H}, {'yb': 1.3, 'yt': 12, 'img': 'fattoria_1.png', 'w': W, 'h': H}]}, open(os.path.join(ROOT, 'public', 'assets', 'radar', 'fattoria.json'), 'w'))
print('[radar]', W, H, os.path.getsize(os.path.join(ROOT, 'public', 'assets', 'radar', 'fattoria_0.png')) // 1024, 'KB')
bg = Image.new('RGBA', L0.size, (28, 30, 36, 255)); bg.alpha_composite(L0); bg.alpha_composite(L1); bg.convert('RGB').resize((1000, int(1000 * H / W))).save(os.path.join(TOOL, 'out', 'radar_preview.png'))
