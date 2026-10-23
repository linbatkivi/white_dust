# ==========================================================================
# de_fattoria · planter: cypresser, oliventræer (krogede stammer + sølvgrønt løv), citrontræer, stenfyr (parasolkrone), vinstokke i rækker, buske og tørt græs.
#   Procedurelle stammer/grene (rør) + løvkort (RGBA-teksturer fra gen/plants_tex.py). Træer med kollision (layout: cyl 'olive'/'cypress'/'lemon') placeres på deres cylinder;
#   resten (bakkernes lunde, vinmarker bag murene) placeres efter faste regler ud fra bakkens celler (hash-baseret, ikke tilfældigt: samme layout → samme træer).
# ==========================================================================
import math, random
import numpy as np
from ft_common import hash2, vnoise

def V3(a, b): return (a[0] + b[0], a[1] + b[1], a[2] + b[2])
def S3(a, k): return (a[0] * k, a[1] * k, a[2] * k)
def sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def norm(a):
    l = math.sqrt(dot(a, a)) or 1.0; return (a[0] / l, a[1] / l, a[2] / l)

def tube(M, pts, r0, r1, mat='ft_bark', seg=6, uvsz=1.2):
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

def card(M, mat, c, right, up, w, h):
    p = [V3(c, V3(S3(right, -w / 2), S3(up, -h / 2))), V3(c, V3(S3(right, w / 2), S3(up, -h / 2))), V3(c, V3(S3(right, w / 2), S3(up, h / 2))), V3(c, V3(S3(right, -w / 2), S3(up, h / 2)))]
    M.poly(p, mat, uv=[(0, 0), (1, 0), (1, 1), (0, 1)], want=cross(right, up), col=[(0, 0, 0, 1)] * 4)

def rnd_dir(rnd):
    a = rnd.uniform(0, 2 * math.pi); z = rnd.uniform(-1, 1); r = math.sqrt(1 - z * z); return (r * math.cos(a), z, r * math.sin(a))

def card_cluster(M, mat, c, rnd, size, n=3, center=None, flat=0.0):
    for k in range(n):
        if center is not None:
            base = norm(sub(c, center)) if dot(sub(c, center), sub(c, center)) > 1e-4 else (0, 1, 0)
            r = rnd_dir(rnd); d = norm((base[0] + r[0] * 0.6, base[1] + r[1] * 0.6, base[2] + r[2] * 0.6))
        else:
            d = rnd_dir(rnd); d = norm((d[0], d[1] * (1 - flat), d[2]))
        ref = (0, 1, 0) if abs(d[1]) < 0.9 else (1, 0, 0)
        right = norm(cross(d, ref)); up = cross(right, d); s = size * rnd.uniform(0.85, 1.15)
        card(M, mat, V3(c, (rnd.uniform(-0.1, 0.1) * s, rnd.uniform(-0.1, 0.1) * s, rnd.uniform(-0.1, 0.1) * s)), right, up, s, s)

# ---------------------------------------------------------------- cypres
def cypress(B, F, x, z, y0, rnd, h=9.0, w=1.2):
    for k in range(5):                                                               # fem krydsende kort → flamme set fra alle sider
        yaw = k * math.pi / 5 + rnd.uniform(-0.1, 0.1); right = (math.cos(yaw), 0, math.sin(yaw)); hh = h * rnd.uniform(0.92, 1.05)
        card(F, 'fol_cypress', (x, y0 + hh / 2 - 0.1, z), right, (0, 1, 0), w * 2.3 * rnd.uniform(0.9, 1.1), hh)
    tube(B, [(x, y0, z), (x, y0 + h * 0.3, z)], 0.12, 0.06, mat='ft_cypress_trunk', seg=5)

# ---------------------------------------------------------------- oliven
def olive(B, F, x, z, y0, rnd, h=3.6, R=2.1, lod=False):
    if lod: return olive_low(B, F, x, z, y0, rnd, h, R)
    a0 = rnd.uniform(0, 6.28); lean = rnd.uniform(0.1, 0.5)
    trunk = [(x + math.cos(a0) * lean * (i / 9) ** 2 + 0.05 * math.sin(i * 1.3 + a0), y0 + h * 0.42 * i / 9, z + math.sin(a0) * lean * (i / 9) ** 2 + 0.05 * math.cos(i * 1.1)) for i in range(10)]
    tube(B, trunk, 0.24, 0.17, seg=9); top = trunk[-1]; nb = rnd.randint(3, 4); cc = (top[0], top[1] + R * 0.5, top[2])
    for b in range(nb):
        ang = a0 + b * 2 * math.pi / nb + rnd.uniform(-0.4, 0.4); L = R * rnd.uniform(0.55, 0.8); rise = rnd.uniform(0.5, 0.95)
        pts = [(top[0] + math.cos(ang) * L * t + 0.07 * math.sin(t * 7 + b), top[1] + rise * L * t * (1.0 - 0.3 * t), top[2] + math.sin(ang) * L * t) for t in [i / 8 for i in range(9)]]
        tube(B, pts, 0.12, 0.04, seg=6)
        for q in range(4): card_cluster(F, 'fol_olive', V3(pts[-1], (rnd.uniform(-0.6, 0.6), rnd.uniform(-0.1, 0.5), rnd.uniform(-0.6, 0.6))), rnd, rnd.uniform(1.8, 2.5), 2, center=cc)
        for i in (5, 6): card_cluster(F, 'fol_olive', V3(pts[i], (rnd.uniform(-0.4, 0.4), 0.3, rnd.uniform(-0.4, 0.4))), rnd, rnd.uniform(1.4, 2.0), 2, center=cc)
    card_cluster(F, 'fol_olive', V3(top, (0, R * 0.7, 0)), rnd, 2.2, 3, center=cc)

def olive_low(B, F, x, z, y0, rnd, h=3.4, R=2.0):
    """billig version til bakkernes lunde/kulissen: kort krum stamme, to grene, få løvkort"""
    a0 = rnd.uniform(0, 6.28); lean = rnd.uniform(0.1, 0.5)
    trunk = [(x + math.cos(a0) * lean * (i / 3) ** 2, y0 + h * 0.45 * i / 3, z + math.sin(a0) * lean * (i / 3) ** 2) for i in range(4)]
    tube(B, trunk, 0.22, 0.15, seg=5); top = trunk[-1]; cc = (top[0], top[1] + R * 0.5, top[2])
    for b in range(2):
        ang = a0 + b * math.pi + rnd.uniform(-0.5, 0.5); L = R * rnd.uniform(0.55, 0.8)
        pts = [top, (top[0] + math.cos(ang) * L * 0.5, top[1] + L * 0.35, top[2] + math.sin(ang) * L * 0.5), (top[0] + math.cos(ang) * L, top[1] + L * 0.5, top[2] + math.sin(ang) * L)]
        tube(B, pts, 0.1, 0.04, seg=4)
        for q in range(2): card_cluster(F, 'fol_olive', V3(pts[-1], (rnd.uniform(-0.5, 0.5), rnd.uniform(0, 0.5), rnd.uniform(-0.5, 0.5))), rnd, rnd.uniform(2.0, 2.6), 2, center=cc)
    card_cluster(F, 'fol_olive', V3(top, (0, R * 0.6, 0)), rnd, 2.4, 2, center=cc)

# ---------------------------------------------------------------- citrontræ
def lemon(B, F, x, z, y0, rnd, h=2.8, R=1.3):
    tube(B, [(x, y0, z), (x + 0.04, y0 + h * 0.5, z), (x, y0 + h * 0.6, z + 0.03)], 0.1, 0.07, seg=6); cc = (x, y0 + h * 0.8, z)
    for q in range(14): card_cluster(F, 'fol_lemon', (x + rnd.uniform(-R, R) * 0.7, y0 + h * rnd.uniform(0.6, 1.05), z + rnd.uniform(-R, R) * 0.7), rnd, rnd.uniform(1.0, 1.5), 2, center=cc)

# ---------------------------------------------------------------- stenfyr (parasolkrone)
def stone_pine(B, F, x, z, y0, rnd, h=10.0, R=4.4, lod=False):
    if lod: return pine_low(B, F, x, z, y0, rnd, h, R)
    a0 = rnd.uniform(0, 6.28); pts = [(x + math.sin(i * 1.3 + a0) * 0.35 + math.cos(a0) * 0.9 * (i / 8) ** 2, y0 + h * 0.78 * i / 8, z + math.cos(i * 1.1 + a0) * 0.3 + math.sin(a0) * 0.9 * (i / 8) ** 2) for i in range(9)]
    tube(B, pts, 0.42, 0.18, seg=8); top = pts[-1]; nb = 6
    for b in range(nb):
        ang = a0 + b * 2 * math.pi / nb + rnd.uniform(-0.3, 0.3); L = R * rnd.uniform(0.55, 0.85)
        bp = [top, V3(top, (math.cos(ang) * L * 0.5, 0.5 + L * 0.12, math.sin(ang) * L * 0.5)), V3(top, (math.cos(ang) * L, 0.9 + L * 0.1, math.sin(ang) * L))]
        tube(B, bp, 0.15, 0.05, seg=5)
        for q in range(6):
            o = (rnd.uniform(-1.1, 1.1), rnd.uniform(-0.1, 0.5), rnd.uniform(-1.1, 1.1)); c = V3(bp[-1], o); yaw = rnd.uniform(0, 6.28)
            right = (math.cos(yaw), 0, math.sin(yaw)); fwd = (-right[2], 0, right[0])
            card(F, 'fol_pine', c, right, fwd, 2.6, 2.4)
            card(F, 'fol_pine', V3(c, (0, 0.25, 0)), right, (0, 1, 0), 2.4, 1.3)
    for q in range(5):
        c = V3(top, (rnd.uniform(-R * 0.5, R * 0.5), 0.8 + rnd.uniform(0, 0.8), rnd.uniform(-R * 0.5, R * 0.5))); yaw = rnd.uniform(0, 6.28); right = (math.cos(yaw), 0, math.sin(yaw)); card(F, 'fol_pine', c, right, (-right[2], 0, right[0]), 2.8, 2.6)

def pine_low(B, F, x, z, y0, rnd, h=10.0, R=4.4):
    a0 = rnd.uniform(0, 6.28); pts = [(x + math.cos(a0) * 0.9 * (i / 4) ** 2, y0 + h * 0.78 * i / 4, z + math.sin(a0) * 0.9 * (i / 4) ** 2) for i in range(5)]
    tube(B, pts, 0.36, 0.16, seg=5); top = pts[-1]
    for b in range(3):
        ang = a0 + b * 2.1 + rnd.uniform(-0.3, 0.3); L = R * rnd.uniform(0.55, 0.85); tp = V3(top, (math.cos(ang) * L, 0.9 + L * 0.1, math.sin(ang) * L))
        tube(B, [top, tp], 0.12, 0.05, seg=4)
        for q in range(2):
            c = V3(tp, (rnd.uniform(-1, 1), rnd.uniform(0, 0.4), rnd.uniform(-1, 1))); yaw = rnd.uniform(0, 6.28); right = (math.cos(yaw), 0, math.sin(yaw)); card(F, 'fol_pine', c, right, (-right[2], 0, right[0]), 3.0, 2.8)
    card(F, 'fol_pine', V3(top, (0, 1.0, 0)), (1, 0, 0), (0, 0, 1), 3.6, 3.6)

# ---------------------------------------------------------------- vinstokke (række langs et gelænder: stolper, wirer, stok og løv)
def vine_row(B, F, T, x0, z0, x1, z1, y0, h, rnd):
    horiz = abs(x1 - x0) >= abs(z1 - z0); L = max(abs(x1 - x0), abs(z1 - z0)); xc, zc = (x0 + x1) / 2, (z0 + z1) / 2
    n = max(2, int(L / 3.0) + 1)
    for k in range(n + 1):
        t = k / n
        if horiz: px, pz = x0 + (x1 - x0) * t, zc
        else: px, pz = xc, z0 + (z1 - z0) * t
        T.box(px - 0.04, y0, pz - 0.04, px + 0.04, y0 + h, pz + 0.04, 'ft_timber')
    for yy in (0.55, 1.0, h - 0.08):
        if horiz: T.box(x0, y0 + yy, zc - 0.006, x1, y0 + yy + 0.012, zc + 0.006, 'ft_iron')
        else: T.box(xc - 0.006, y0 + yy, z0, xc + 0.006, y0 + yy + 0.012, z1, 'ft_iron')
    m = max(2, int(L / 0.7))
    for k in range(m):
        t = (k + 0.5) / m
        px, pz = (x0 + (x1 - x0) * t, zc) if horiz else (xc, z0 + (z1 - z0) * t)
        tube(B, [(px, y0, pz), (px + rnd.uniform(-0.05, 0.05), y0 + 0.5, pz), (px, y0 + 0.75, pz)], 0.05, 0.035, seg=5)
        for q in range(3):
            yaw = (0 if horiz else math.pi / 2) + rnd.uniform(-0.5, 0.5); right = (math.cos(yaw), 0, math.sin(yaw))
            card(F, 'fol_vine', (px + rnd.uniform(-0.15, 0.15), y0 + 0.5 + h * 0.5 * rnd.uniform(0.6, 1.0), pz + rnd.uniform(-0.15, 0.15)) if not horiz else (px + rnd.uniform(-0.15, 0.15), y0 + 0.5 + h * 0.5 * rnd.uniform(0.6, 1.0), pz + rnd.uniform(-0.15, 0.15)),
                 right, (0, 1, 0), rnd.uniform(0.75, 1.05), h * rnd.uniform(0.5, 0.72))

def bush(F, x, z, y0, rnd, r=0.7, mat='fol_shrub', n=10):
    for k in range(n):
        d = norm((rnd.uniform(-1, 1), rnd.uniform(0.15, 1.0), rnd.uniform(-1, 1)))
        c = (x + d[0] * r * 0.55, y0 + r * 0.5 * d[1] + r * 0.3, z + d[2] * r * 0.55)
        ref = (0, 1, 0) if abs(d[1]) < 0.9 else (1, 0, 0); right = norm(cross(d, ref)); up = cross(right, d)
        card(F, mat, c, right, up, r * rnd.uniform(1.0, 1.4), r * rnd.uniform(1.0, 1.4))

def grass(F, x, z, y0, rnd, s=0.5):
    for k in range(3):
        yaw = k * math.pi / 3 + rnd.uniform(-0.2, 0.2); right = (math.cos(yaw), 0, math.sin(yaw)); card(F, 'fol_grass', (x, y0 + s * 0.5, z), right, (0, 1, 0), s * 1.3, s)

# ---------------------------------------------------------------- placering
def build(D, S):
    G = S['G']; B = S['bark']; F = S['fol']; T = S['trim']; n_tree = 0
    seed = lambda x, z: random.Random(int(hash2(x * 7.3, z * 3.1) * 1e6))
    # 1) træer med kollision (layout)
    for (x, z, r, y0, y1, st) in D['cyls']:
        rnd = seed(x, z)
        if st == 'olive': olive(B, F, x, z, y0, rnd, h=3.4 + rnd.uniform(0, 0.8), R=2.0 + rnd.uniform(0, 0.5))
        elif st == 'cypress': cypress(B, F, x, z, y0, rnd, h=(y1 - y0) + 6.5 if (y1 - y0) < 4 else (y1 - y0) + 2.5, w=1.1)
        elif st == 'lemon': lemon(B, F, x, z, y0, rnd)
    # 2) vinstokke langs layoutets 'vine'-gelændere
    for (x0, z0, x1, z1, base, h, st) in D['rails']:
        if st == 'vine': vine_row(B, F, T, x0, z0, x1, z1, base, h, seed(x0, z0))
    # 3) bakkens lunde: fast regelsæt pr. celle (hash) – cypresrækker langs skillelinjer, oliven og stenfyr i grupper, buske og græs
    H = G.H; hill = G.hill; cap = G.cap; NZ, NX = G.NZ, G.NX; used = []
    near = np.zeros((NZ, NX), np.float32)                              # afstand til nærmeste gangbare gulv (celler)
    walk = (G.K == 1)
    dist = np.full((NZ, NX), 99.0, np.float32); dist[walk] = 0
    for _ in range(30):
        d2 = dist.copy()
        for dj, di in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sh = np.roll(dist, (dj, di), (0, 1)) + 1; d2 = np.minimum(d2, sh)
        dist = d2
    def tri_y(x, z):
        j, i = G.cz(z), G.cx(x); return float(G.cap[j, i]) if (0 <= j < NZ and 0 <= i < NX and hill[j, i]) else None
    for j in range(2, NZ - 2, 5):
        for i in range(2, NX - 2, 5):
            if not hill[j, i]: continue
            hx, hz = hash2(i * 1.7, j * 2.3), hash2(i * 3.1, j * 1.3)
            x = G.x(i) + hx * 1.4; z = G.z(j) + hz * 1.4; y = tri_y(x, z)
            if y is None: continue
            dd = float(dist[j, i]) * G.res
            rnd = random.Random(int(hash2(i, j) * 1e6)); r = hash2(i * 0.91, j * 0.73)
            if dd < 1.2: continue                                         # holder kanten frit (murene)
            # skillelinjer: cypresser med ~7 m afstand langs de fleste kanter; vinstokke på store flader; oliven i klynger
            if dd < 4.0 and r < 0.30: cypress(B, F, x, z, y, rnd, h=rnd.uniform(7.5, 11.0)); n_tree += 1
            elif r < 0.55 and vnoise(x * 0.07, z * 0.07) > 0.45: olive(B, F, x, z, y, rnd, h=rnd.uniform(3.0, 4.2), R=rnd.uniform(1.8, 2.5), lod=True); n_tree += 1
            elif r < 0.62 and vnoise(x * 0.05 + 9, z * 0.05) > 0.55: stone_pine(B, F, x, z, y, rnd, h=rnd.uniform(8, 11), R=rnd.uniform(3.6, 4.8), lod=True); n_tree += 1
            elif r < 0.85: bush(F, x, z, y, rnd, r=rnd.uniform(0.6, 1.1), mat=rnd.choice(['fol_shrub', 'fol_shrub', 'fol_lavender', 'fol_oleander']));
            else: grass(F, x, z, y, rnd, s=rnd.uniform(0.5, 0.9))
    print('[plants] træer på bakkerne:', n_tree)
