#!/usr/bin/env python3
# de_fattoria · grundplan med meter-gitter (kun gangene + øer) til bevidst placering af taktiske elementer → out/plan0.png  (x0 z0 x1 z1 [zoom])
import os, sys, json
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); TOOL = os.path.dirname(HERE)
T = json.load(open(os.path.join(TOOL, 'out', 'layout_trace.json')))
x0, z0, x1, z1 = (float(v) for v in sys.argv[1:5]) if len(sys.argv) > 4 else (-63, -60, 64, 57)
Z = float(sys.argv[5]) if len(sys.argv) > 5 else 10.0
W, H = int((x1 - x0) * Z), int((z1 - z0) * Z)
im = Image.new('RGB', (W, H), (30, 32, 38)); d = ImageDraw.Draw(im)
P = lambda q: ((q[0] - x0) * Z, (q[1] - z0) * Z)
d.polygon([P(q) for q in T['ext']], fill=(206, 196, 170))
for h in T['holes']: d.polygon([P(q) for q in h], fill=(58, 62, 70))
f = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 12 if Z < 14 else 22)
gx = int(x0 // 5) * 5
while gx <= x1:
    d.line([P((gx, z0)), P((gx, z1))], fill=(255, 40, 40) if gx % 10 == 0 else (130, 130, 140), width=1); d.text(P((gx + 0.2, z0 + 0.3)), str(gx), fill=(0, 0, 200), font=f); gx += 5
gz = int(z0 // 5) * 5
while gz <= z1:
    d.line([P((x0, gz)), P((x1, gz))], fill=(255, 40, 40) if gz % 10 == 0 else (130, 130, 140), width=1); d.text(P((x0 + 0.2, gz + 0.2)), str(gz), fill=(0, 0, 200), font=f); gz += 5
im.save(os.path.join(TOOL, 'out', 'plan0.png' if len(sys.argv) < 7 else sys.argv[6]))
