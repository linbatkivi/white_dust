# ==========================================================================
# de_niseko · planter: kirsebærtræer, piletræer, ahorn, fyr, buske (azalea), bambus og græs – procedurelle stammer/grene (rør) + løvkort (alfa-RGBA-teksturer, gen/plants_tex.py)
#   Alt placeres på bestemte punkter (layout.py → DRESS); stammer har kollision (prisme i layout), løv har ingen. Layout-koordinater (x øst, y op, z syd).
# ==========================================================================
import math, random
from nk_geo import tsz
from bld.common import MATS

def V3(a, b): return (a[0] + b[0], a[1] + b[1], a[2] + b[2])
def S3(a, k): return (a[0] * k, a[1] * k, a[2] * k)
def sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def norm(a):
    l = math.sqrt(dot(a, a)) or 1.0; return (a[0] / l, a[1] / l, a[2] / l)

def tube(M, pts, r0, r1, mat='nk_bark', seg=6, uvsz=1.2):
    """rør langs en polylinje (layout-koordinater), konisk r0 → r1. Parallel-transport-ramme."""
    n = len(pts); rings = []; T0 = norm(sub(pts[1], pts[0]))
    ref = (0.0, 0.0, 1.0) if abs(T0[1]) > 0.9 else (0.0, 1.0, 0.0)
    N = norm(cross(T0, ref)); Bn = cross(T0, N); s_acc = 0.0
    for i in range(n):
        T = norm(sub(pts[min(i + 1, n - 1)], pts[max(i - 1, 0)]))
        N = norm(sub(N, S3(T, dot(N, T)))); Bn = cross(T, N)
        r = r0 + (r1 - r0) * i / (n - 1)
        ring = [V3(pts[i], V3(S3(N, math.cos(2 * math.pi * k / seg) * r), S3(Bn, math.sin(2 * math.pi * k / seg) * r))) for k in range(seg)]
        rings.append((ring, s_acc, r))
        if i < n - 1: s_acc += math.sqrt(dot(sub(pts[i + 1], pts[i]), sub(pts[i + 1], pts[i])))
    with M.part():
        for i in range(n - 1):
            ra, sa, rra = rings[i]; rb, sb, rrb = rings[i + 1]
            for k in range(seg):
                k2 = (k + 1) % seg; u0 = k * 2 * math.pi * rra / seg / uvsz; u1 = (k + 1) * 2 * math.pi * rra / seg / uvsz
                mid = V3(ra[k], rb[k2]); c0 = pts[i]; out = sub(S3(mid, 0.5), c0)
                M.poly([ra[k], ra[k2], rb[k2], rb[k]], mat, uv=[(u0, sa / uvsz), (u1, sa / uvsz), (u1, sb / uvsz), (u0, sb / uvsz)], want=out, smooth=True)

def card(M, mat, c, right, up, w, h, flip=False):
    """løvkort: kvadrat midt i c, spændt ud af right/up (enhedsvektorer). UV 0..1"""
    p = [V3(c, V3(S3(right, -w / 2), S3(up, -h / 2))), V3(c, V3(S3(right, w / 2), S3(up, -h / 2))), V3(c, V3(S3(right, w / 2), S3(up, h / 2))), V3(c, V3(S3(right, -w / 2), S3(up, h / 2)))]
    nrm = cross(right, up)
    M.poly(p, mat, uv=[(0, 0), (1, 0), (1, 1), (0, 1)], want=nrm, col=[(0, 0, 0, 1)] * 4)

def rnd_dir(rnd):
    a = rnd.uniform(0, 2 * math.pi); z = rnd.uniform(-1, 1); r = math.sqrt(1 - z * z); return (r * math.cos(a), z, r * math.sin(a))

def card_cluster(M, mat, c, rnd, size, n=3, flat=0.0, upbias=0.0, center=None):
    """n kort omkring c. Med center vender kortene udad som en skal (set fra siden ser man fladerne, ikke kanter)"""
    for k in range(n):
        if center is not None:
            base = norm(sub(c, center)) if dot(sub(c, center), sub(c, center)) > 1e-4 else (0, 1, 0)
            r = rnd_dir(rnd); d = norm((base[0] + r[0] * 0.55, base[1] + r[1] * 0.55, base[2] + r[2] * 0.55))
        else:
            d = rnd_dir(rnd); d = norm((d[0], d[1] * (1 - flat), d[2]))
        ref = (0, 1, 0) if abs(d[1]) < 0.9 else (1, 0, 0)
        right = norm(cross(d, ref)); up = cross(right, d)
        s = size * rnd.uniform(0.85, 1.15)
        card(M, mat, V3(c, (rnd.uniform(-0.1, 0.1) * s, rnd.uniform(-0.1, 0.1) * s + upbias, rnd.uniform(-0.1, 0.1) * s)), right, up, s, s)

# ---------------------------------------------------------------- kirsebærtræ
def sakura(B, F, x, z, y0, rnd, h=6.2, R=3.0, clear=0.0):
    """kort, kraftig krum stamme og vidt udbredte grene med tætte blomsterklumper"""
    lean = rnd.uniform(-0.5, 0.5); a0 = rnd.uniform(0, 6.28)
    ht = max(h * 0.33, clear + 0.95)
    trunk = []
    for i in range(7):
        t = i / 6; trunk.append((x + math.cos(a0) * lean * t * t * 1.4 + 0.07 * math.sin(t * 6 + a0), y0 + ht * t, z + math.sin(a0) * lean * t * t * 1.4))
    tube(B, trunk, 0.30 * (h / 6.2), 0.19 * (h / 6.2), seg=7)
    top = trunk[-1]; nb = rnd.randint(5, 7); cc = (top[0], top[1] + R * 0.32, top[2])
    for b in range(nb):
        ang = a0 + b * 2 * math.pi / nb + rnd.uniform(-0.3, 0.3); L = R * rnd.uniform(0.5, 0.68); rise = rnd.uniform(0.35, 0.8)
        pts = []; p = top
        for i in range(6):
            t = i / 5
            pts.append((top[0] + math.cos(ang) * L * t, top[1] + rise * L * t * (1.1 - 0.5 * t) + 0.25 * math.sin(t * 5 + b), top[2] + math.sin(ang) * L * t))
        tube(B, pts, 0.15, 0.04, seg=5)
        for sb in range(rnd.randint(2, 3)):
            i0 = rnd.randint(2, 4); a2 = ang + rnd.uniform(-0.9, 0.9); st = pts[i0]; L2 = L * rnd.uniform(0.3, 0.5)
            p2 = [st, V3(st, (math.cos(a2) * L2 * 0.5, L2 * 0.35, math.sin(a2) * L2 * 0.5)), V3(st, (math.cos(a2) * L2, L2 * 0.5, math.sin(a2) * L2))]
            tube(B, p2, 0.06, 0.02, seg=4)
            for q in range(2): card_cluster(F, 'fol_sakura', V3(p2[-1], (rnd.uniform(-0.3, 0.3), 0.1, rnd.uniform(-0.3, 0.3))), rnd, rnd.uniform(1.2, 1.7), 2, center=cc)
        for q in range(3): card_cluster(F, 'fol_sakura', V3(pts[-1], (rnd.uniform(-0.5, 0.5), rnd.uniform(0, 0.5), rnd.uniform(-0.5, 0.5))), rnd, rnd.uniform(1.4, 2.0), 2, center=cc)
        for i in (3, 4): card_cluster(F, 'fol_sakura', V3(pts[i], (rnd.uniform(-0.4, 0.4), 0.35, rnd.uniform(-0.4, 0.4))), rnd, rnd.uniform(1.3, 1.8), 2, center=cc)
    card_cluster(F, 'fol_sakura', V3(top, (0, R * 0.55, 0)), rnd, 1.8, 3, center=cc)

# ---------------------------------------------------------------- piletræ
def willow(B, F, x, z, y0, rnd, h=6.5, R=3.2, clear=0.0):
    a0 = rnd.uniform(0, 6.28); ht = h * 0.45
    trunk = [(x + 0.1 * math.sin(i * 1.3 + a0), y0 + ht * i / 5, z + 0.1 * math.cos(i * 1.1 + a0)) for i in range(6)]
    tube(B, trunk, 0.33, 0.2, seg=7); top = trunk[-1]
    nb = rnd.randint(5, 6)
    for b in range(nb):
        ang = a0 + b * 2 * math.pi / nb + rnd.uniform(-0.3, 0.3); L = R * rnd.uniform(0.75, 1.0); pts = []
        for i in range(6):
            t = i / 5; pts.append((top[0] + math.cos(ang) * L * t, top[1] + (h - ht) * 0.9 * math.sin(t * 1.4) * (1 - 0.25 * t) , top[2] + math.sin(ang) * L * t))
        tube(B, pts, 0.14, 0.04, seg=5)
        for i in range(2, 6):
            for q in range(2):
                p = pts[i]; ox = rnd.uniform(-0.4, 0.4); oz = rnd.uniform(-0.4, 0.4); yaw = rnd.uniform(0, math.pi)
                hh = min(p[1] - y0 - 0.55, rnd.uniform(2.0, 3.0));
                if hh < 0.8: continue
                right = (math.cos(yaw), 0, math.sin(yaw)); card(F, 'fol_willow', (p[0] + ox, p[1] - hh / 2 + 0.2, p[2] + oz), right, (0, 1, 0), rnd.uniform(1.0, 1.4), hh)
        card_cluster(F, 'fol_bush', V3(pts[-1], (0, 0, 0)), rnd, 1.2, 2)
    card_cluster(F, 'fol_bush', V3(top, (0, 0.9, 0)), rnd, 1.8, 3)

# ---------------------------------------------------------------- japansk ahorn (flere tynde stammer)
def maple(B, F, x, z, y0, rnd, h=4.6, R=2.2, clear=0.0):
    n = rnd.randint(2, 3); a0 = rnd.uniform(0, 6.28)
    for s in range(n):
        ang = a0 + s * 2 * math.pi / n; pts = []
        for i in range(6):
            t = i / 5; pts.append((x + math.cos(ang) * h * 0.22 * t * t, y0 + h * 0.62 * t, z + math.sin(ang) * h * 0.22 * t * t))
        tube(B, pts, 0.10, 0.045, seg=5); top = pts[-1]
        for b in range(3):
            aa = ang + b * 2.1 + rnd.uniform(-0.4, 0.4); L = R * rnd.uniform(0.42, 0.65)
            bp = [top, V3(top, (math.cos(aa) * L * 0.5, L * 0.35, math.sin(aa) * L * 0.5)), V3(top, (math.cos(aa) * L, L * 0.45, math.sin(aa) * L))]
            tube(B, bp, 0.04, 0.015, seg=4)
            for q in range(3): card_cluster(F, 'fol_maple', V3(bp[-1], (rnd.uniform(-0.3, 0.3), rnd.uniform(-0.1, 0.4), rnd.uniform(-0.3, 0.3))), rnd, rnd.uniform(0.9, 1.3), 2, center=(top[0], top[1] + 0.2, top[2]))
        card_cluster(F, 'fol_maple', V3(top, (0, 0.4, 0)), rnd, 1.2, 3, center=(top[0], top[1] - 0.3, top[2]))

# ---------------------------------------------------------------- fyr (niwaki): snoet stamme og flade nålepuder
def pine(B, F, x, z, y0, rnd, h=4.8, R=2.0, clear=0.0):
    a0 = rnd.uniform(0, 6.28); pts = []
    for i in range(9):
        t = i / 8; pts.append((x + math.sin(t * 5 + a0) * 0.28 * t + math.cos(a0) * 0.35 * t * t, y0 + h * 0.85 * t, z + math.cos(t * 4 + a0) * 0.25 * t + math.sin(a0) * 0.35 * t * t))
    tube(B, pts, 0.26, 0.07, seg=7)
    for i, (lv, rr) in enumerate(((0.42, 0.55), (0.58, 0.8), (0.74, 1.0), (0.92, 0.7))):
        k = int(lv * 8); p = pts[min(k, 8)]; ang = a0 + i * 2.2 + rnd.uniform(-0.4, 0.4); Lr = R * rr
        pad = V3(p, (math.cos(ang) * Lr * 0.8, 0.15, math.sin(ang) * Lr * 0.8))
        tube(B, [p, V3(p, (math.cos(ang) * Lr * 0.45, 0.2, math.sin(ang) * Lr * 0.45)), pad], 0.07, 0.03, seg=4)
        for q in range(7):
            o = (rnd.uniform(-Lr * 0.55, Lr * 0.55), rnd.uniform(-0.08, 0.25), rnd.uniform(-Lr * 0.55, Lr * 0.55)); c = V3(pad, o)
            yaw = rnd.uniform(0, 6.28); right = (math.cos(yaw), 0.0, math.sin(yaw)); fwd = (-right[2], 0.0, right[0])
            card(F, 'fol_pine', c, right, fwd, Lr * 0.9, Lr * 0.9)                                   # vandret nålepude
            card(F, 'fol_pine', V3(c, (0, 0.12, 0)), right, (0, 1, 0), Lr * 0.8, Lr * 0.7)         # lodret kort mod siden

# ---------------------------------------------------------------- klippet busk (ikegaki / azalea), halvkugle af kort
def bush(F, x, z, y0, rnd, r=0.6, mat='fol_bush', n=13, flat=0.35):
    for k in range(n):
        d = norm((rnd.uniform(-1, 1), rnd.uniform(0.15, 1.0), rnd.uniform(-1, 1)))
        c = (x + d[0] * r * 0.55, y0 + r * 0.55 * (1 - flat) * d[1] + r * 0.25, z + d[2] * r * 0.55)
        ref = (0, 1, 0) if abs(d[1]) < 0.9 else (1, 0, 0); right = norm(cross(d, ref)); up = cross(right, d)
        card(F, mat, c, right, up, r * rnd.uniform(0.9, 1.25), r * rnd.uniform(0.9, 1.25))
    card(F, mat, (x, y0 + r * 0.55, z), (1, 0, 0), (0, 0, 1), r * 1.0, r * 1.0)

def grass(F, x, z, y0, rnd, s=0.4):
    for k in range(3):
        yaw = k * math.pi / 3 + rnd.uniform(-0.2, 0.2); right = (math.cos(yaw), 0, math.sin(yaw)); card(F, 'fol_grass', (x, y0 + s * 0.5, z), right, (0, 1, 0), s * 1.1, s)

def bamboo(B, F, x, z, y0, rnd, n=7, h=6.0, spread=0.7):
    for k in range(n):
        a = rnd.uniform(0, 6.28); r = rnd.uniform(0.0, spread); bx, bz = x + math.cos(a) * r, z + math.sin(a) * r
        hh = h * rnd.uniform(0.8, 1.15); lean = (rnd.uniform(-0.5, 0.5), rnd.uniform(-0.5, 0.5))
        pts = [(bx + lean[0] * (i / 6) ** 2, y0 + hh * i / 6, bz + lean[1] * (i / 6) ** 2) for i in range(7)]
        tube(B, pts, 0.045, 0.028, mat='nk_bamboo', seg=5, uvsz=0.5)
        for j in range(5):
            p = pts[min(6, 3 + j // 2)]
            card_cluster(F, 'fol_bamboo', V3(p, (rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3))), rnd, rnd.uniform(1.0, 1.5), 2)

SPECIES = {'sakura': sakura, 'willow': willow, 'maple': maple, 'pine': pine}
