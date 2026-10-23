#!/usr/bin/env python3
# ==========================================================================
# de_fattoria · løv-teksturer (RGBA, tegnet procedurelt – ingen eksterne billeder): cypres, oliven, vinblade, stenfyr, citron, buske, tørt græs, lavendel, oleander, vedbend
#   + ft_hedge (sammenhængende hæk-tekstur: albedo/normal/ORM)
#   python3 tools/fattoria/gen/plants_tex.py   →   tools/fattoria/cache/tex/fol_*_albedo.png, ft_hedge_*.jpg
# ==========================================================================
import os, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__)); TOOL = os.path.dirname(HERE); DST = os.path.join(TOOL, 'cache', 'tex'); os.makedirs(DST, exist_ok=True)
SS = 2

def new(w, h): return Image.new('RGBA', (w * SS, h * SS), (0, 0, 0, 0))
def done(im, name, w, h):
    im = im.resize((w, h), Image.LANCZOS)
    a = np.array(im).astype(np.float32); al = a[..., 3:4] / 255.0; rgb = a[..., :3]
    blur = np.array(Image.fromarray(np.clip(rgb * al, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))).astype(np.float32)
    ba = np.array(Image.fromarray((al[..., 0] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))).astype(np.float32)[..., None] / 255.0
    fill = blur / np.maximum(ba, 1e-3); rgb2 = np.where(al > 0.02, rgb, fill)
    Image.fromarray(np.concatenate([np.clip(rgb2, 0, 255), a[..., 3:4]], axis=2).astype(np.uint8), 'RGBA').save(os.path.join(DST, name + '_albedo.png'))
def col(rnd, base, var): return tuple(int(max(0, min(255, c + rnd.uniform(-var, var)))) for c in base)
def ellipse_poly(cx, cy, a, b, ang, n=14):
    return [(cx + a * math.cos(2 * math.pi * i / n) * math.cos(ang) - b * math.sin(2 * math.pi * i / n) * math.sin(ang), cy + a * math.cos(2 * math.pi * i / n) * math.sin(ang) + b * math.sin(2 * math.pi * i / n) * math.cos(ang)) for i in range(n)]
def leaf_poly(cx, cy, L, W, ang, tip=0.8):
    pts = []
    for i in range(13):
        t = i / 12; w = W * 0.5 * math.sin(math.pi * t) ** tip * (1.0 - 0.25 * t); pts.append((t * L, w))
    pts += [(t, -w) for (t, w) in reversed(pts)]
    return [(cx + x * math.cos(ang) - y * math.sin(ang), cy + x * math.sin(ang) + y * math.cos(ang)) for (x, y) in pts]
def P(pts): return [(p[0] * SS, p[1] * SS) for p in pts]

def cypress(seed=1, W=256, H=512):
    """tæt, mørkegrøn flamme: skælformede kviste på en lodret midterlinje"""
    rnd = random.Random(seed); im = new(W, H); d = ImageDraw.Draw(im)
    for k in range(900):
        t = rnd.random() ** 0.8; y = H * (0.03 + 0.95 * t); hw = (0.12 + 0.34 * math.sin(math.pi * min(1, t * 1.05)) ** 0.7) * W
        x = W / 2 + rnd.gauss(0, hw * 0.48); L = rnd.uniform(14, 26)
        if abs(x - W / 2) > hw: continue
        a = math.pi / 2 + rnd.uniform(-0.9, 0.9) + (x - W / 2) / W * 1.2
        c = col(rnd, (28, 54, 30) if rnd.random() < 0.7 else (40, 72, 38), 10)
        d.polygon(P(leaf_poly(x, y, L, L * 0.38, a)), fill=c + (255,))
    for k in range(260):
        t = rnd.random(); y = H * (0.05 + 0.9 * t); hw = (0.1 + 0.28 * math.sin(math.pi * t) ** 0.7) * W; x = W / 2 + rnd.gauss(0, hw * 0.4)
        d.ellipse(((x - 5) * SS, (y - 5) * SS, (x + 5) * SS, (y + 5) * SS), fill=col(rnd, (18, 38, 22), 6) + (255,))
    done(im, 'fol_cypress', W, H)

def olive(seed=2, W=512, H=512):
    """sølvgrønne smalle blade (lys underside) på tynde kviste"""
    rnd = random.Random(seed); im = new(W, H); d = ImageDraw.Draw(im)
    for _ in range(14):
        x0, y0 = rnd.uniform(0.15, 0.85) * W, rnd.uniform(0.15, 0.85) * H; a = rnd.uniform(0, 6.28); L = rnd.uniform(90, 200)
        pts = [(x0 + math.cos(a + 0.3 * math.sin(k)) * k * L / 9, y0 + math.sin(a + 0.3 * math.sin(k)) * k * L / 9) for k in range(10)]
        d.line(P(pts), fill=(86, 76, 56, 255), width=int(2.4 * SS))
        for i in range(1, 10):
            for side in (-1, 1):
                if rnd.random() < 0.35: continue
                px, py = pts[i]; la = a + side * rnd.uniform(0.7, 1.2) + rnd.uniform(-0.2, 0.2); LL = rnd.uniform(34, 52)
                c = col(rnd, (118, 134, 104) if rnd.random() < 0.6 else (150, 162, 134), 14)
                d.polygon(P(leaf_poly(px, py, LL, LL * 0.2, la, 0.6)), fill=c + (255,))
    for _ in range(420):
        x, y = rnd.uniform(20, W - 20), rnd.uniform(20, H - 20); LL = rnd.uniform(26, 44)
        d.polygon(P(leaf_poly(x, y, LL, LL * 0.2, rnd.uniform(0, 6.28), 0.6)), fill=col(rnd, (112, 128, 98), 16) + (255,))
    done(im, 'fol_olive', W, H)

def vine(seed=3, W=512, H=512):
    """vinblade (flige) med enkelte drueklaser og slyngtråde"""
    rnd = random.Random(seed); im = new(W, H); d = ImageDraw.Draw(im)
    def grape_leaf(cx, cy, r, ang, base):
        pts = []
        for i in range(36):
            t = 2 * math.pi * i / 36; rr = r * (1 + 0.28 * math.cos(5 * t + 0.4)) * (0.8 + 0.2 * math.cos(t))
            pts.append((cx + math.cos(t + ang) * rr, cy + math.sin(t + ang) * rr))
        d.polygon(P(pts), fill=col(rnd, base, 14) + (255,))
        for k in range(5): a2 = ang + k * 2 * math.pi / 5; d.line(P([(cx, cy), (cx + math.cos(a2) * r * 0.9, cy + math.sin(a2) * r * 0.9)]), fill=col(rnd, (base[0] - 22, base[1] - 22, base[2] - 18), 6) + (255,), width=SS)
    for _ in range(46):
        grape_leaf(rnd.uniform(40, W - 40), rnd.uniform(40, H - 40), rnd.uniform(34, 56), rnd.uniform(0, 6.28), (92, 134, 52) if rnd.random() < 0.75 else (150, 150, 56))
    for _ in range(3):                                                                         # drueklaser (mørke)
        cx, cy = rnd.uniform(90, W - 90), rnd.uniform(110, H - 90)
        for k in range(18):
            x, y = cx + rnd.gauss(0, 12), cy + k * 4 + rnd.gauss(0, 6); r = rnd.uniform(7, 10)
            d.ellipse(((x - r) * SS, (y - r) * SS, (x + r) * SS, (y + r) * SS), fill=col(rnd, (62, 28, 74) if rnd.random() < 0.7 else (110, 120, 52), 10) + (255,))
    for _ in range(5):
        x, y = rnd.uniform(40, W - 40), rnd.uniform(40, H - 40); pts = []
        for k in range(14): pts.append((x + 9 * math.sin(k * 0.9) , y + k * 6))
        d.line(P(pts), fill=(110, 130, 60, 255), width=SS)
    done(im, 'fol_vine', W, H)

def pine(seed=4, W=512, H=256):
    """stenfyr: lange, mørkegrønne nåle i buske"""
    rnd = random.Random(seed); im = new(W, H); d = ImageDraw.Draw(im)
    for _ in range(26):
        cx, cy = rnd.uniform(40, W - 40), rnd.uniform(40, H - 40)
        for k in range(110):
            a = rnd.uniform(0, 6.28); L = rnd.uniform(22, 42); w = rnd.uniform(0.9, 1.4) * SS
            d.line(P([(cx, cy), (cx + math.cos(a) * L, cy + math.sin(a) * L * 0.8)]), fill=col(rnd, (36, 70, 36), 12) + (255,), width=int(w))
    done(im, 'fol_pine', W, H)

def lemon(seed=5, W=512, H=512):
    rnd = random.Random(seed); im = new(W, H); d = ImageDraw.Draw(im)
    for _ in range(120):
        x, y = rnd.uniform(30, W - 30), rnd.uniform(30, H - 30); L = rnd.uniform(38, 60)
        d.polygon(P(leaf_poly(x, y, L, L * 0.45, rnd.uniform(0, 6.28), 0.7)), fill=col(rnd, (46, 98, 40), 16) + (255,))
    for _ in range(9):
        x, y = rnd.uniform(50, W - 50), rnd.uniform(50, H - 50); r = rnd.uniform(15, 20)
        d.polygon(P(ellipse_poly(x, y, r * 1.25, r, rnd.uniform(0, 3), 18)), fill=col(rnd, (232, 206, 52), 10) + (255,))
    done(im, 'fol_lemon', W, H)

def shrub(seed=6, W=512, H=512):
    rnd = random.Random(seed); im = new(W, H); d = ImageDraw.Draw(im)
    for _ in range(300):
        x, y = rnd.uniform(24, W - 24), rnd.uniform(24, H - 24); L = rnd.uniform(26, 44)
        d.polygon(P(leaf_poly(x, y, L, L * 0.38, rnd.uniform(0, 6.28), 0.8)), fill=col(rnd, (58, 92, 44) if rnd.random() < 0.7 else (90, 116, 58), 14) + (255,))
    done(im, 'fol_shrub', W, H)

def grass(seed=7, W=256, H=256):
    """tørt toscansk græs (gyldent/sandfarvet) – lange blade i tuer"""
    rnd = random.Random(seed); im = new(W, H); d = ImageDraw.Draw(im)
    for _ in range(80):
        x0 = rnd.uniform(10, W - 10); L = rnd.uniform(0.35, 0.95) * H; bend = rnd.uniform(-34, 34); c = col(rnd, (178, 160, 88) if rnd.random() < 0.7 else (132, 142, 70), 22)
        pts = [(x0 + bend * (i / 10) ** 2, H - i * L / 10) for i in range(11)]
        for k in range(len(pts) - 1): d.line(P([pts[k], pts[k + 1]]), fill=c + (255,), width=max(1, int((2.6 - 2.1 * k / 10) * SS)))
    done(im, 'fol_grass', W, H)

def lavender(seed=8, W=256, H=512):
    rnd = random.Random(seed); im = new(W, H); d = ImageDraw.Draw(im)
    for _ in range(36):
        x0 = rnd.uniform(14, W - 14); L = rnd.uniform(0.5, 0.95) * H; sway = rnd.uniform(-24, 24)
        pts = [(x0 + sway * (i / 12) ** 2, H - i * L / 12) for i in range(13)]
        d.line(P(pts), fill=(104, 124, 94, 255), width=int(1.8 * SS))
        for i in range(8, 13):
            px, py = pts[i]
            for k in range(3):
                a = rnd.uniform(0, 6.28); d.ellipse(((px + math.cos(a) * 3 - 3.5) * SS, (py + math.sin(a) * 3 - 3) * SS, (px + math.cos(a) * 3 + 3.5) * SS, (py + math.sin(a) * 3 + 3) * SS), fill=col(rnd, (122, 92, 176), 14) + (255,))
        for i in range(2, 8):
            px, py = pts[i]; la = rnd.choice([-1, 1]) * rnd.uniform(0.6, 1.0) - math.pi / 2; LL = rnd.uniform(18, 30)
            d.polygon(P(leaf_poly(px, py, LL, LL * 0.1, la, 0.6)), fill=col(rnd, (120, 136, 108), 10) + (255,))
    done(im, 'fol_lavender', W, H)

def oleander(seed=9, W=512, H=512):
    rnd = random.Random(seed); im = new(W, H); d = ImageDraw.Draw(im)
    for _ in range(200):
        x, y = rnd.uniform(24, W - 24), rnd.uniform(24, H - 24); L = rnd.uniform(40, 70)
        d.polygon(P(leaf_poly(x, y, L, L * 0.16, rnd.uniform(0, 6.28), 0.7)), fill=col(rnd, (54, 92, 46), 14) + (255,))
    for _ in range(70):
        x, y = rnd.uniform(40, W - 40), rnd.uniform(40, H - 40); r = rnd.uniform(11, 17); rot = rnd.uniform(0, 6.28); base = (236, 104, 150) if rnd.random() < 0.7 else (246, 196, 206)
        for k in range(5):
            a = rot + k * 2 * math.pi / 5; px, py = x + math.cos(a) * r * 0.55, y + math.sin(a) * r * 0.55
            d.polygon(P(ellipse_poly(px, py, r * 0.62, r * 0.5, a, 12)), fill=col(rnd, base, 8) + (255,))
        d.ellipse(((x - r * 0.2) * SS, (y - r * 0.2) * SS, (x + r * 0.2) * SS, (y + r * 0.2) * SS), fill=(240, 220, 120, 255))
    done(im, 'fol_oleander', W, H)

def ivy(seed=10, W=512, H=512):
    rnd = random.Random(seed); im = new(W, H); d = ImageDraw.Draw(im)
    for _ in range(150):
        x, y = rnd.uniform(24, W - 24), rnd.uniform(24, H - 24); r = rnd.uniform(18, 28); a = rnd.uniform(0, 6.28)
        pts = [(x + math.cos(a + t) * r * (1 + 0.35 * math.cos(3 * t)) , y + math.sin(a + t) * r * (1 + 0.35 * math.cos(3 * t))) for t in [2 * math.pi * i / 24 for i in range(24)]]
        d.polygon(P(pts), fill=col(rnd, (46, 84, 40), 14) + (255,))
    done(im, 'fol_ivy', W, H)

def rose(seed=11, W=512, H=512):
    rnd = random.Random(seed); im = new(W, H); d = ImageDraw.Draw(im)
    for _ in range(170):
        x, y = rnd.uniform(24, W - 24), rnd.uniform(24, H - 24); L = rnd.uniform(24, 40)
        d.polygon(P(leaf_poly(x, y, L, L * 0.5, rnd.uniform(0, 6.28), 0.8)), fill=col(rnd, (52, 90, 44), 14) + (255,))
    for _ in range(46):
        x, y = rnd.uniform(40, W - 40), rnd.uniform(40, H - 40); r = rnd.uniform(11, 17); base = rnd.choice([(196, 36, 56), (236, 200, 200), (240, 120, 130)])
        for k in range(3):
            d.ellipse(((x - r + k * 2) * SS, (y - r + k * 2) * SS, (x + r - k * 2) * SS, (y + r - k * 2) * SS), fill=col(rnd, tuple(int(c * (0.78 + k * 0.12)) for c in base), 6) + (255,))
    done(im, 'fol_rose', W, H)

def hedge(seed=12, N=512):
    """sammenhængende hæktekstur (boks/laurbær): små blade i mørke og lyse grønne nuancer – albedo + normal + ORM"""
    rnd = random.Random(seed); S2 = 2; im = Image.new('RGB', (N * S2, N * S2), (22, 40, 22)); d = ImageDraw.Draw(im)
    hm = Image.new('L', (N * S2, N * S2), 40); dh = ImageDraw.Draw(hm)
    for pas in range(4):
        for _ in range(2600):
            x, y = rnd.uniform(0, N), rnd.uniform(0, N); L = rnd.uniform(12, 22); a = rnd.uniform(0, 6.28); sh = 0.55 + pas * 0.15 + rnd.uniform(-0.1, 0.1)
            c = tuple(int(v * sh) for v in ((72, 118, 52) if rnd.random() < 0.7 else (104, 140, 60)))
            for ox in (-N, 0, N):
                for oy in (-N, 0, N):
                    pts = [((px + ox) * S2, (py + oy) * S2) for (px, py) in ellipse_poly(x, y, L * 0.5, L * 0.28, a, 10)]
                    d.polygon(pts, fill=c); dh.polygon(pts, fill=int(80 + pas * 40))
    im = im.resize((N, N), Image.LANCZOS); hm = hm.resize((N, N), Image.LANCZOS)
    h = np.array(hm).astype(np.float32) / 255.0
    gx = np.roll(h, -1, 1) - np.roll(h, 1, 1); gy = np.roll(h, -1, 0) - np.roll(h, 1, 0); nrm = np.stack([-gx * 3.0, gy * 3.0, np.ones_like(h)], -1); nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
    Image.fromarray(((nrm * 0.5 + 0.5) * 255).astype(np.uint8)).save(os.path.join(DST, 'ft_hedge_normal.jpg'), quality=92)
    orm = np.stack([np.clip(0.45 + h * 0.9, 0, 1), np.full_like(h, 0.82), np.zeros_like(h)], -1)
    Image.fromarray((orm * 255).astype(np.uint8)).save(os.path.join(DST, 'ft_hedge_orm.jpg'), quality=92)
    im.save(os.path.join(DST, 'ft_hedge_albedo.jpg'), quality=93)

def vinefield(seed=13, N=512):
    """vinmark set oppefra/på afstand: parallelle rækker af grønne vinstokke på tør, rødbrun jord (sømløs)"""
    rnd = random.Random(seed); im = Image.new('RGB', (N, N), (150, 116, 80)); d = ImageDraw.Draw(im)
    for y in range(N):
        n = (rnd.random() - 0.5) * 18
        d.line([(0, y), (N, y)], fill=(int(150 + n), int(116 + n), int(80 + n)))
    rows = 8; step = N / rows
    for r in range(rows):
        y = r * step + step / 2
        for x in range(0, N, 5):
            w = rnd.uniform(9, 14); c = (int(64 + rnd.uniform(-14, 14)), int(100 + rnd.uniform(-16, 16)), int(48 + rnd.uniform(-10, 10)))
            d.ellipse((x - 5, y - w, x + 9, y + w), fill=c)
        for x in range(0, N, 9): d.ellipse((x - 3, y - 4, x + 5, y + 4), fill=(46, 76, 36))
    im = im.filter(ImageFilter.GaussianBlur(0.7)); im.save(os.path.join(DST, 'ft_vinefield_albedo.jpg'), quality=93)
    nrm = Image.new('RGB', (N, N), (128, 128, 255)); nrm.save(os.path.join(DST, 'ft_vinefield_normal.jpg'), quality=90)
    orm = Image.new('RGB', (N, N), (255, 215, 0)); orm.save(os.path.join(DST, 'ft_vinefield_orm.jpg'), quality=90)

if __name__ == '__main__':
    for f in (cypress, olive, vine, pine, lemon, shrub, grass, lavender, oleander, ivy, rose, hedge, vinefield): f(); print('ok', f.__name__)
