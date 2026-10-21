#!/usr/bin/env python3
# ==========================================================================
# bureau · egen nat-skyline: facade-teksturer til højhusene + nattehimmel (HDR). Kun numpy + PIL.
#   python3 tools/bureau/city.py  → cache/city/city_{a,b,c}_albedo.jpg (+ normal/ORM-reserver), cache/city/street_albedo.jpg,
#                                   cache/sky/night.hdr (2048 × 1024, ækvirektangulær, Radiance RGBE)
# Facaden: etagehøjde 3,6 m, fag 1,8 m – én tekstur = 8 fag × 4 etager (14,4 × 14,4 m). De fleste vinduer er mørke (glas, der spejler
# natten), ca. hvert femte lyser – varmt (kontorlys, 3000 K) eller koldt (lysstofrør) – i klynger pr. etage (hele kontorer er tændt).
# ==========================================================================
import os, math
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); CITY = os.path.join(HERE, 'cache', 'city'); SKY = os.path.join(HERE, 'cache', 'sky')
os.makedirs(CITY, exist_ok=True); os.makedirs(SKY, exist_ok=True)
R = np.random.RandomState(42)

def facade(name, style, lit=0.2, seed=0):
    rs = np.random.RandomState(seed); S = 1024; img = np.zeros((S, S, 3), np.float32)
    bays, floors = 8, 4; bw, fh = S // bays, S // floors
    frame = {'glass': (14, 16, 20), 'concrete': (58, 58, 60), 'stone': (70, 64, 58)}[style]
    img[:] = frame
    for f in range(floors):
        office = rs.rand() < lit * 2.2                                    # hele etagen/kontoret tændt?
        warm = rs.rand() < 0.62
        for b in range(bays):
            x0 = b * bw + (6 if style == 'glass' else 16); x1 = (b + 1) * bw - (6 if style == 'glass' else 16)
            y0 = f * fh + (10 if style == 'glass' else 34); y1 = (f + 1) * fh - (18 if style == 'glass' else 30)
            on = (office and rs.rand() < 0.75) or rs.rand() < lit * 0.25
            if on:
                c = np.array((255, 196, 120) if warm else (190, 220, 255), np.float32) * rs.uniform(0.55, 1.0)
                # lyset falder af mod vinduets top (loftet) og har gardiner/lameller nogle steder
                g = np.linspace(1.0, 0.7, y1 - y0)[:, None, None]
                win = np.ones((y1 - y0, x1 - x0, 3), np.float32) * c * g
                if rs.rand() < 0.3: win[::7] *= 0.55                                       # persienner
                if rs.rand() < 0.25: win[:, : (x1 - x0) // 3] *= 0.25                     # en skabslåge / skærm foran
            else:
                base = np.array((10, 14, 22), np.float32) + rs.uniform(0, 8)
                v = np.linspace(1.3, 0.7, y1 - y0)[:, None, None]                          # spejling af den mørke himmel
                win = np.ones((y1 - y0, x1 - x0, 3), np.float32) * base * v
            img[y0:y1, x0:x1] = win
        img[f * fh:f * fh + 6] = np.array(frame) * 0.7                                     # etagedæk
    img += rs.normal(0, 2.0, img.shape)
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(os.path.join(CITY, name + '_albedo.jpg'), quality=92)
    Image.new('RGB', (64, 64), (128, 128, 255)).save(os.path.join(CITY, name + '_normal.jpg'))
    Image.new('RGB', (64, 64), (255, 200, 0)).save(os.path.join(CITY, name + '_orm.jpg'))

def street():
    """gaderne langt nede: mørk asfalt med gadelys, billygter og oplyste kryds (set fra 110 m)"""
    S = 1024; img = np.zeros((S, S, 3), np.float32) + (6, 6, 8)
    for k in range(0, S, 128):                                                             # gadenet (blokke à 128 px)
        img[k:k + 22, :] = (16, 15, 16); img[:, k:k + 22] = (16, 15, 16)
        for t in range(0, S, 16):
            img[k + 2:k + 5, t:t + 3] = (255, 170, 80); img[t:t + 3, k + 2:k + 5] = (255, 170, 80)   # gadelamper
    for n in range(260):                                                                   # biler (røde/hvide lygter)
        k = R.randint(0, 8) * 128; t = R.randint(0, S - 4)
        c = (255, 40, 30) if R.rand() < 0.5 else (255, 245, 220)
        if R.rand() < 0.5: img[k + 9:k + 12, t:t + 4] = c
        else: img[t:t + 4, k + 9:k + 12] = c
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(os.path.join(CITY, 'street_albedo.jpg'), quality=92)
    Image.new('RGB', (64, 64), (128, 128, 255)).save(os.path.join(CITY, 'street_normal.jpg'))
    Image.new('RGB', (64, 64), (255, 220, 0)).save(os.path.join(CITY, 'street_orm.jpg'))

def write_hdr(path, rgb):
    """Radiance RGBE (.hdr), rækker oppefra"""
    h, w, _ = rgb.shape; m = np.max(rgb, axis=2); e = np.floor(np.log2(np.maximum(m, 1e-32))) + 1
    sc = np.where(m > 1e-32, np.ldexp(1.0, -e.astype(np.int32)) * 256.0, 0.0)
    rgbe = np.zeros((h, w, 4), np.uint8)
    rgbe[..., :3] = np.clip(rgb * sc[..., None], 0, 255).astype(np.uint8); rgbe[..., 3] = np.where(m > 1e-32, e + 128, 0).astype(np.uint8)
    with open(path, 'wb') as f:
        f.write(b'#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n' + ('-Y %d +X %d\n' % (h, w)).encode()); f.write(rgbe.tobytes())

def night_sky():
    W_, H_ = 2048, 1024
    v = (np.arange(H_) + 0.5) / H_; u = (np.arange(W_) + 0.5) / W_
    el = (0.5 - v)[:, None] * math.pi                                                       # elevation (rad)
    az = (u[None, :] - 0.5) * 2 * math.pi
    up = np.clip(np.sin(el), 0, 1)
    zen = np.array((0.0016, 0.0022, 0.0045)); hor = np.array((0.018, 0.012, 0.008))         # nær sort – lysforurening ved horisonten
    t = np.exp(-up * 9.0)[..., None]
    sky = zen * (1 - t) + hor * t
    glow = np.exp(-np.abs(el) * 14.0)[..., None] * np.array((0.05, 0.026, 0.012)) * (0.75 + 0.25 * np.cos(az * 1.0 + 0.6))[..., None]
    sky = sky + glow
    # skyer: lav-frekvent støj, oplyst nedefra af byen (orange), kun over horisonten
    def noise(sc, oc=5):
        out = np.zeros((H_, W_)); a = 1.0
        for o in range(oc):
            g = R.rand(int(4 * sc * 2 ** o) + 2, int(8 * sc * 2 ** o) + 2)
            img = np.array(Image.fromarray((g * 255).astype(np.uint8)).resize((W_, H_), Image.BICUBIC), np.float32) / 255.0
            out += img * a; a *= 0.5
        return out / 1.9
    n = noise(1.0); cl = np.clip((n - 0.5) * 3.0, 0, 1) * (up > 0.02) * np.exp(-up * 2.2)
    sky = sky * (1 - cl[..., None] * 0.6) + cl[..., None] * np.array((0.03, 0.02, 0.016))
    # stjerner (få – lysforurenet by)
    for k in range(260):
        y = R.randint(0, int(H_ * 0.38)); x = R.randint(0, W_)
        if cl[y, x] < 0.2: sky[y, x] += R.uniform(0.02, 0.12)
    # under horisonten: byens nattemørke (glød fra gaderne)
    below = (el < 0)[..., 0] if el.ndim == 3 else (el < 0)
    sky[np.broadcast_to(below, (H_, W_))] = np.array((0.012, 0.009, 0.007))
    write_hdr(os.path.join(SKY, 'night.hdr'), sky.astype(np.float32))
    prev = np.clip((sky / 0.06) ** (1 / 2.2), 0, 1)
    Image.fromarray((prev * 255).astype(np.uint8)).resize((1024, 512)).save(os.path.join(SKY, 'night_preview.jpg'))

if __name__ == '__main__':
    facade('city_a', 'glass', 0.18, 1); facade('city_b', 'concrete', 0.22, 2); facade('city_c', 'stone', 0.15, 3); street(); night_sky()
    print('[city] facader, gade og nattehimmel skrevet')
