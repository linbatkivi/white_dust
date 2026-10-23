#!/usr/bin/env python3
# de_niseko · planbillede med koordinatgitter (til at placere udsmykning bevidst) → out/plan.png (+ udsnit via argumenter x0,z0,x1,z1)
import os, sys, json
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); TOOL = os.path.dirname(HERE)
D = json.load(open(os.path.join(TOOL, 'out', 'niseko_design.json')))
x0, z0, x1, z1 = (float(v) for v in sys.argv[1:5]) if len(sys.argv) > 4 else (-60, -57, 60, 57)
Z = float(sys.argv[5]) if len(sys.argv) > 5 else 11.0
W, H = int((x1 - x0) * Z), int((z1 - z0) * Z)
im = Image.new('RGB', (W, H), (26, 28, 34)); d = ImageDraw.Draw(im)
P = lambda q: ((q[0] - x0) * Z, (q[1] - z0) * Z)
STY = {'machiya': (150, 120, 90), 'shop': (170, 110, 80), 'inn': (130, 110, 120), 'house1': (140, 130, 90), 'wall': (100, 100, 100), 'kura': (190, 190, 200), 'shrine': (200, 70, 60), 'hedge': (50, 110, 50)}
for l in D['lots']:
    for pc in l['pieces']: d.polygon([P(q) for q in pc], fill=STY.get(l['style'], (120, 120, 120)), outline=(20, 20, 20))
w = D['walk']; d.polygon([P(q) for q in w['ext']], outline=(255, 255, 255))
for g in D['surf'][1:]:
    pass
for g in D['ground'][::1]:
    d.polygon([P(q) for q in g['ring']], fill={'nk_street': (120, 114, 100), 'nk_stonebase': (96, 100, 110), 'nk_gravel': (176, 164, 124), 'nk_raked': (176, 164, 124), 'nk_floor': (140, 100, 64), 'nk_pebbles': (110, 108, 96)}.get(g['m'], (120, 114, 100)))
for wp in D['water_pieces']: d.polygon([P(q) for q in wp], fill=(60, 120, 180))
for p in D['props']: d.polygon([P(q) for q in p['poly']], fill=(60, 210, 80))
for it in D['dress']:
    if it['t'] == 'torii': d.line([P((it['xa'], it['za'])), P((it['xb'], it['zb']))], fill=(255, 60, 40), width=4); continue
    c = {'sakura': (255, 160, 190), 'willow': (150, 220, 100), 'maple': (230, 90, 40), 'pine': (40, 120, 70)}.get(it.get('sp'), (255, 255, 0))
    cx, cz = P((it['x'], it['z'])); r = it.get('R', 0.4) * Z; d.ellipse((cx - r, cz - r, cx + r, cz + r), outline=c, width=2); d.ellipse((cx - 3, cz - 3, cx + 3, cz + 3), fill=c)
for k, s in D['sites'].items(): d.rectangle([P((s[0], s[1])), P((s[2], s[3]))], outline=(255, 60, 60), width=2)
try: f = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 11)
except Exception: f = None
gx = int(x0 // 5) * 5
while gx <= x1:
    d.line([P((gx, z0)), P((gx, z1))], fill=(255, 255, 255) if gx % 10 == 0 else (70, 70, 80), width=1); d.text(P((gx + 0.2, z0 + 0.3)), str(gx), fill=(255, 255, 0), font=f); gx += 5
gz = int(z0 // 5) * 5
while gz <= z1:
    d.line([P((x0, gz)), P((x1, gz))], fill=(255, 255, 255) if gz % 10 == 0 else (70, 70, 80), width=1); d.text(P((x0 + 0.2, gz + 0.2)), str(gz), fill=(255, 255, 0), font=f); gz += 5
for n, x, z, y in D['labels']: d.text(P((x, z)), n, fill=(255, 255, 255), font=f)
im.save(os.path.join(TOOL, 'out', 'plan.png'))
