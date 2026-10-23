#!/usr/bin/env python3
# ==========================================================================
# de_niseko · løv-teksturer (RGBA, tegnet procedurelt – ingen eksterne billeder): kirsebærblomster, piletræ, ahorn, fyr, buske, azalea
#   python3 tools/niseko/gen/plants_tex.py   →   tools/niseko/cache/tex/fol_*_albedo.png
#   Hvert kort er et tæt løvklump på gennemsigtig baggrund; kort samles til kroner i nk_plants.py.
# ==========================================================================
import os, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__)); TOOL = os.path.dirname(HERE); DST = os.path.join(TOOL, 'cache', 'tex')
os.makedirs(DST, exist_ok=True)
SS = 2                                                       # supersampling

def new(w, h): return Image.new('RGBA', (w * SS, h * SS), (0, 0, 0, 0))
def done(im, name, w, h):
    im = im.resize((w, h), Image.LANCZOS)
    # kantfarver udtværes ind i det gennemsigtige (undgå mørke kanter ved mip-mapping)
    a = np.array(im).astype(np.float32); al = a[..., 3:4] / 255.0
    rgb = a[..., :3]; blur = np.array(Image.fromarray(np.clip(rgb * al, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))).astype(np.float32)
    ba = np.array(Image.fromarray((al[..., 0] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))).astype(np.float32)[..., None] / 255.0
    fill = blur / np.maximum(ba, 1e-3)
    rgb2 = np.where(al > 0.02, rgb, fill)
    out = np.concatenate([np.clip(rgb2, 0, 255), a[..., 3:4]], axis=2).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(os.path.join(DST, name + '_albedo.png'))
def col(rnd, base, var):
    return tuple(int(max(0, min(255, c + rnd.uniform(-var, var)))) for c in base)
def ellipse_poly(cx, cy, a, b, ang, n=16):
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n; x, y = a * math.cos(t), b * math.sin(t)
        pts.append((cx + x * math.cos(ang) - y * math.sin(ang), cy + x * math.sin(ang) + y * math.cos(ang)))
    return pts
def leaf_poly(cx, cy, L, W, ang):
    """lancetblad: spids i begge ender, bredest før midten"""
    pts = []
    for i in range(0, 13):
        t = i / 12; w = W * 0.5 * math.sin(math.pi * t) ** 0.8 * (1.0 - 0.25 * t)
        pts.append((t * L, w))
    pts += [(t, -w) for (t, w) in reversed(pts)]
    return [(cx + x * math.cos(ang) - y * math.sin(ang), cy + x * math.sin(ang) + y * math.cos(ang)) for (x, y) in pts]

# ---------------------------------------------------------------- kirsebærblomster (sakura)
def sakura(seed=1, W=512, H=512):
    rnd = random.Random(seed); im = new(W, H); d = ImageDraw.Draw(im); S = SS
    blobs = [(rnd.uniform(0.25, 0.75) * W, rnd.uniform(0.25, 0.75) * H, rnd.uniform(0.18, 0.3) * W) for _ in range(6)]
    # kviste
    for _ in range(9):
        x0, y0 = rnd.uniform(0.2, 0.8) * W, rnd.uniform(0.2, 0.8) * H; a = rnd.uniform(0, 6.28); L = rnd.uniform(70, 170)
        pts = [(x0 + math.cos(a + 0.4 * math.sin(k)) * k * L / 8, y0 + math.sin(a + 0.4 * math.sin(k)) * k * L / 8) for k in range(9)]
        d.line([(p[0] * S, p[1] * S) for p in pts], fill=(66, 44, 36, 255), width=int(2.6 * S))
    # unge blade (bronze/grøn)
    for _ in range(46):
        bx, by, br = blobs[rnd.randrange(len(blobs))]; x = bx + rnd.gauss(0, br * 0.7); y = by + rnd.gauss(0, br * 0.7)
        c = col(rnd, (96, 112, 62) if rnd.random() < 0.6 else (130, 84, 62), 22); L = rnd.uniform(30, 44)
        d.polygon([(p[0] * S, p[1] * S) for p in leaf_poly(x, y, L, L * 0.42, rnd.uniform(0, 6.28))], fill=c + (255,))
    PINK = [(255, 196, 212), (250, 170, 196), (255, 222, 232), (246, 150, 182), (255, 236, 242)]
    for _ in range(300):
        bx, by, br = blobs[rnd.randrange(len(blobs))]; x = bx + rnd.gauss(0, br * 0.62); y = by + rnd.gauss(0, br * 0.62)
        if not (10 < x < W - 10 and 10 < y < H - 10): continue
        r = rnd.uniform(11, 19); base = PINK[rnd.randrange(len(PINK))]; rot = rnd.uniform(0, 6.28)
        for k in range(5):
            a = rot + k * 2 * math.pi / 5
            px, py = x + math.cos(a) * r * 0.55, y + math.sin(a) * r * 0.55
            d.polygon([(q[0] * S, q[1] * S) for q in ellipse_poly(px, py, r * 0.62, r * 0.46, a, 12)], fill=col(rnd, base, 8) + (255,))
        d.ellipse(((x - r * 0.22) * S, (y - r * 0.22) * S, (x + r * 0.22) * S, (y + r * 0.22) * S), fill=(206, 80, 118, 255))
        for k in range(6):
            a = rnd.uniform(0, 6.28); d.line([(x * S, y * S), ((x + math.cos(a) * r * 0.5) * S, (y + math.sin(a) * r * 0.5) * S)], fill=(236, 200, 120, 255), width=S)
    done(im, 'fol_sakura', W, H)

# ---------------------------------------------------------------- piletræ: hængende kviste med smalle blade
def willow(seed=2, W=256, H=512):
    rnd = random.Random(seed); im = new(W, H); d = ImageDraw.Draw(im); S = SS
    for k in range(16):
        x0 = (k + rnd.uniform(0.1, 0.9)) * W / 16; L = rnd.uniform(0.55, 0.98) * H; sway = rnd.uniform(-18, 18); ph = rnd.uniform(0, 6.28)
        pts = []
        for i in range(0, 41):
            t = i / 40; pts.append((x0 + sway * t * t + 5 * math.sin(ph + t * 5) * t, t * L))
        d.line([(p[0] * S, p[1] * S) for p in pts], fill=(88, 84, 48, 255), width=int(2.4 * S))
        for i in range(2, 41, 1):
            t = i / 40; x, y = pts[i]; sd = 1 if i % 2 else -1
            c = col(rnd, (122, 156, 62) if rnd.random() < 0.7 else (96, 132, 52), 16)
            ang = math.pi / 2 + sd * rnd.uniform(0.35, 0.75)
            d.polygon([(q[0] * S, q[1] * S) for q in leaf_poly(x, y, rnd.uniform(18, 30), rnd.uniform(4.5, 6.5), ang)], fill=c + (255,))
    done(im, 'fol_willow', W, H)

# ---------------------------------------------------------------- japansk ahorn (momiji)
def maple_leaf(cx, cy, R, ang, rnd):
    pts = []
    for k in range(10):
        a = ang + k * math.pi / 5; r = R if k % 2 == 0 else R * 0.5
        if k % 2 == 0 and k in (0, 8): r = R * 0.72
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
        # tænder
        a2 = a + math.pi / 10; pts.append((cx + math.cos(a2) * r * 0.72, cy + math.sin(a2) * r * 0.72))
    return pts
def maple(seed=3, W=512, H=512):
    rnd = random.Random(seed); im = new(W, H); d = ImageDraw.Draw(im); S = SS
    blobs = [(rnd.uniform(0.25, 0.75) * W, rnd.uniform(0.25, 0.75) * H, rnd.uniform(0.2, 0.3) * W) for _ in range(6)]
    COL = [(176, 28, 30), (206, 56, 28), (226, 98, 30), (188, 40, 40), (222, 140, 36), (150, 30, 34)]
    for _ in range(9):
        x0, y0 = rnd.uniform(0.2, 0.8) * W, rnd.uniform(0.2, 0.8) * H; a = rnd.uniform(0, 6.28); L = rnd.uniform(80, 180)
        d.line([(x0 * S, y0 * S), ((x0 + math.cos(a) * L) * S, (y0 + math.sin(a) * L) * S)], fill=(70, 44, 36, 255), width=int(2.6 * S))
    for _ in range(95):
        bx, by, br = blobs[rnd.randrange(len(blobs))]; x = bx + rnd.gauss(0, br * 0.6); y = by + rnd.gauss(0, br * 0.6)
        if not (20 < x < W - 20 and 20 < y < H - 20): continue
        R = rnd.uniform(24, 40); c = COL[rnd.randrange(len(COL))] if rnd.random() < 0.88 else (110, 140, 50)
        pts = maple_leaf(x, y, R, rnd.uniform(0, 6.28), rnd)
        d.polygon([(q[0] * S, q[1] * S) for q in pts], fill=col(rnd, c, 14) + (255,))
    done(im, 'fol_maple', W, H)

# ---------------------------------------------------------------- fyr (niwaki): nålebuske
def pine(seed=4, W=512, H=512):
    rnd = random.Random(seed); im = new(W, H); d = ImageDraw.Draw(im); S = SS
    centers = [(rnd.uniform(0.2, 0.8) * W, rnd.uniform(0.25, 0.75) * H) for _ in range(12)]
    for (cx, cy) in centers:
        for _ in range(70):
            a = rnd.uniform(0, 6.28); L = rnd.uniform(46, 84); a2 = a + rnd.uniform(-0.15, 0.15)
            c = col(rnd, (36, 78, 46) if rnd.random() < 0.8 else (56, 100, 56), 12)
            d.line([(cx * S, cy * S), ((cx + math.cos(a) * L) * S, (cy + math.sin(a2) * L * 0.9) * S)], fill=c + (255,), width=int(1.9 * S))
        d.ellipse(((cx - 4) * S, (cy - 4) * S, (cx + 4) * S, (cy + 4) * S), fill=(70, 50, 38, 255))
    done(im, 'fol_pine', W, H)

# ---------------------------------------------------------------- buske: grønne blade; azalea: blade + pink blomster
def bush(seed=5, W=512, H=512, flowers=None, name='fol_bush'):
    rnd = random.Random(seed); im = new(W, H); d = ImageDraw.Draw(im); S = SS
    for _ in range(170):
        x, y = rnd.uniform(0.05, 0.95) * W, rnd.uniform(0.05, 0.95) * H
        if (x - W / 2) ** 2 + (y - H / 2) ** 2 > (W * 0.46) ** 2 * rnd.uniform(0.6, 1.1): continue
        L = rnd.uniform(34, 56); c = col(rnd, (44, 96, 44) if rnd.random() < 0.7 else (66, 118, 52), 14)
        pts = leaf_poly(x, y, L, L * 0.5, rnd.uniform(0, 6.28)); d.polygon([(q[0] * S, q[1] * S) for q in pts], fill=c + (255,))
        a = rnd.uniform(0, 6.28); d.line([(x * S, y * S), ((x + math.cos(a) * L * 0.8) * S, (y + math.sin(a) * L * 0.8) * S)], fill=(150, 190, 110, 120), width=S)
    if flowers:
        for _ in range(130):
            x, y = rnd.uniform(0.08, 0.92) * W, rnd.uniform(0.08, 0.92) * H
            if (x - W / 2) ** 2 + (y - H / 2) ** 2 > (W * 0.46) ** 2: continue
            r = rnd.uniform(11, 18); base = flowers[rnd.randrange(len(flowers))]; rot = rnd.uniform(0, 6.28)
            for k in range(5):
                a = rot + k * 2 * math.pi / 5
                d.polygon([(q[0] * S, q[1] * S) for q in ellipse_poly(x + math.cos(a) * r * 0.5, y + math.sin(a) * r * 0.5, r * 0.6, r * 0.5, a, 10)], fill=col(rnd, base, 10) + (255,))
            d.ellipse(((x - r * 0.18) * S, (y - r * 0.18) * S, (x + r * 0.18) * S, (y + r * 0.18) * S), fill=(120, 30, 70, 255))
    done(im, name, W, H)

# ---------------------------------------------------------------- bambus (tykke blade på stængler) og græstotter (til kanter)
def bamboo(seed=6, W=512, H=512):
    rnd = random.Random(seed); im = new(W, H); d = ImageDraw.Draw(im); S = SS
    for _ in range(110):
        x, y = rnd.uniform(0.05, 0.95) * W, rnd.uniform(0.05, 0.95) * H; L = rnd.uniform(60, 100); ang = rnd.uniform(-0.9, 0.9) + (math.pi / 2 if rnd.random() < 0.5 else -math.pi / 2)
        c = col(rnd, (96, 150, 58) if rnd.random() < 0.7 else (124, 176, 70), 14)
        pts = leaf_poly(x, y, L, L * 0.13, ang); d.polygon([(q[0] * S, q[1] * S) for q in pts], fill=c + (255,))
    done(im, 'fol_bamboo', W, H)
def grass(seed=7, W=256, H=256):
    rnd = random.Random(seed); im = new(W, H); d = ImageDraw.Draw(im); S = SS
    for _ in range(46):
        x0 = rnd.uniform(0.08, 0.92) * W; L = rnd.uniform(0.35, 0.95) * H; lean = rnd.uniform(-40, 40)
        c = col(rnd, (84, 128, 48) if rnd.random() < 0.7 else (110, 150, 60), 14); w0 = rnd.uniform(4, 7)
        pts = [(x0 - w0, H), (x0 + w0, H)] + [(x0 + lean * t * t + w0 * (1 - t) * 0.5, H - L * t) for t in (0.5, 0.8, 1.0)]
        d.polygon([(p[0] * S, p[1] * S) for p in pts], fill=c + (255,))
    done(im, 'fol_grass', W, H)

def wisteria(seed=12, W=256, H=512):
    """blåregn: hængende klaser af lilla blomster med grønne blade øverst"""
    rnd = random.Random(seed); im = new(W, H); d = ImageDraw.Draw(im); S = SS
    LIL = [(150, 110, 200), (176, 140, 222), (120, 90, 182), (212, 192, 244), (164, 124, 210)]
    for k in range(10):
        x0 = (k + rnd.uniform(0.2, 0.8)) * W / 10; L = rnd.uniform(200, 470); ph = rnd.uniform(0, 6.28)
        d.line([(x0 * S, 0), (x0 * S, 30 * S)], fill=(70, 100, 50, 255), width=int(2.4 * S))
        n = int(L / 5)
        for i in range(n):
            t = i / n; y = 24 + t * L; x = x0 + 6 * math.sin(ph + t * 4) * t; w = 16 * (1 - t) ** 0.8 + 3
            for _ in range(3):
                fx = x + rnd.uniform(-w, w); fy = y + rnd.uniform(-5, 5); r = rnd.uniform(5, 8.5) * (1 - 0.35 * t)
                for q in range(4):
                    a = q * math.pi / 2 + rnd.uniform(0, 0.6); d.polygon([(pp[0] * S, pp[1] * S) for pp in ellipse_poly(fx + math.cos(a) * r * 0.5, fy + math.sin(a) * r * 0.5, r * 0.62, r * 0.48, a, 8)], fill=col(rnd, LIL[rnd.randrange(5)], 8) + (255,))
    for k in range(34):
        x, y = rnd.uniform(0, W), rnd.uniform(0, 70); c = col(rnd, (70, 112, 48), 14)
        d.polygon([(pp[0] * S, pp[1] * S) for pp in leaf_poly(x, y, rnd.uniform(26, 40), rnd.uniform(9, 14), rnd.uniform(0, 6.28))], fill=c + (255,))
    done(im, 'fol_wisteria', W, H)

def hedge(seed=11, W=512, H=512):
    """klippet hæk: tæt, uigennemsigtig bladflade (flerfarvet) – ses i meters afstand"""
    rnd = random.Random(seed); im = Image.new('RGB', (W * SS, H * SS), (14, 34, 18)); d = ImageDraw.Draw(im)
    for _ in range(2200):
        x, y = rnd.uniform(-0.02, 1.02) * W, rnd.uniform(-0.02, 1.02) * H; L = rnd.uniform(20, 36)
        c = col(rnd, (38, 86, 40) if rnd.random() < 0.6 else (58, 112, 50) if rnd.random() < 0.7 else (26, 62, 32), 14)
        for dx in (0, -W, W):
            for dy in (0, -H, H):
                pts = leaf_poly(x + dx, y + dy, L, L * 0.5, rnd.uniform(0, 6.28))
                if -40 < x + dx < W + 40 and -40 < y + dy < H + 40: d.polygon([(q[0] * SS, q[1] * SS) for q in pts], fill=c)
    im = im.resize((W, H), Image.LANCZOS); im.save(os.path.join(DST, 'nk_hedge_albedo.jpg'), quality=92)
    Image.new('RGB', (W, H), (128, 128, 255)).save(os.path.join(DST, 'nk_hedge_normal.jpg'))
    Image.new('RGB', (W, H), (255, 190, 0)).save(os.path.join(DST, 'nk_hedge_orm.jpg'))

def lime():
    """kalkpuds (shikkui): lys, afdæmpet version af nk_plaster2 med bevarede pletter/revner"""
    import shutil
    a = np.array(Image.open(os.path.join(DST, 'nk_plaster2_albedo.jpg')).convert('RGB')).astype(np.float32)
    lum = a.mean(axis=2, keepdims=True); stain = (lum - lum.mean()) / 255.0
    base = np.array([236, 230, 216], np.float32); out = base + stain * 150.0 * 0.9
    out = out * 0.82 + a * 0.18
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(os.path.join(DST, 'nk_lime_albedo.jpg'), quality=92)
    for k in ('normal', 'orm'): shutil.copy(os.path.join(DST, 'nk_plaster2_%s.jpg' % k), os.path.join(DST, 'nk_lime_%s.jpg' % k))

def raked():
    """karesansui: lys, fint grus med rager (parallelle riller med let bølge) – tilestbar. albedo + normal + orm"""
    N = 1024; rng = np.random.RandomState(5)
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32) / N
    grain = rng.rand(N, N).astype(np.float32); from scipy.ndimage import gaussian_filter
    grain = gaussian_filter(grain, 0.9) * 0.6 + gaussian_filter(rng.rand(N, N).astype(np.float32), 3.0) * 0.4
    lines = 22.0; wave = 0.012 * np.sin(2 * np.pi * (yy * 3.0 + xx * 1.0)) + 0.006 * np.sin(2 * np.pi * (yy * 7.0 + 0.3))
    phase = (xx + wave) * lines; groove = (np.cos(2 * np.pi * phase) * 0.5 + 0.5)             # 1 = kam, 0 = rille
    height = grain * 0.35 + groove * 0.65
    base = np.array([196, 190, 176], np.float32); alb = base[None, None, :] * (0.78 + 0.34 * grain[..., None]) * (0.78 + 0.22 * groove[..., None])
    stones = (rng.rand(N, N) > 0.994).astype(np.float32); stones = gaussian_filter(stones, 1.6) * 6
    alb = alb * (1 - np.clip(stones, 0, 0.5)[..., None] * 0.6)
    Image.fromarray(np.clip(alb, 0, 255).astype(np.uint8)).save(os.path.join(DST, 'nk_raked_albedo.jpg'), quality=92)
    gx = np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1); gy = np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)
    nx, ny, nz = -gx * 6.0, -gy * 6.0, np.ones_like(gx); l = np.sqrt(nx * nx + ny * ny + nz * nz)
    nm = np.stack([(nx / l * 0.5 + 0.5), (ny / l * 0.5 + 0.5), (nz / l * 0.5 + 0.5)], axis=2)
    Image.fromarray((nm * 255).astype(np.uint8)).save(os.path.join(DST, 'nk_raked_normal.jpg'), quality=92)
    orm = np.stack([np.clip(0.6 + 0.4 * groove, 0, 1), np.full((N, N), 0.92, np.float32), np.zeros((N, N), np.float32)], axis=2)
    Image.fromarray((orm * 255).astype(np.uint8)).save(os.path.join(DST, 'nk_raked_orm.jpg'), quality=92)

if __name__ == '__main__':
    hedge(); lime(); raked(); wisteria()
    sakura(); willow(); maple(); pine(); bush(); bush(8, flowers=[(236, 80, 140), (250, 130, 176), (214, 52, 112)], name='fol_azalea')
    bush(9, flowers=[(250, 250, 246), (240, 236, 244)], name='fol_azalea_w'); bamboo(); grass()
    print('[plants_tex] ok →', DST)
