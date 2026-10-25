#!/usr/bin/env python3
# kontaktark af prøvebilleder: python3 tools/fattoria/gen/sheet.py out.jpg navn1 navn2 …  (4 kolonner, 640×360)
import sys, os
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); SH = os.path.join(os.path.dirname(HERE), 'out', 'shots')
out = sys.argv[1]; names = sys.argv[2:]; W, H = 640, 360; cols = 4; rows = (len(names) + cols - 1) // cols
sheet = Image.new('RGB', (W * cols, H * rows))
for k, n in enumerate(names):
    im = Image.open(os.path.join(SH, n + '.png')).convert('RGB').resize((W, H)); ImageDraw.Draw(im).text((8, 6), n, fill=(255, 255, 0)); sheet.paste(im, ((k % cols) * W, (k // cols) * H))
sheet.save(out, quality=88)
