# ==========================================================================
# de_fattoria · kulisse: bølgende Chianti-landskab uden for murene (bakker med vinmarker, oliventræer, cypresrækker, fjerne gårde), cypresser/oliven langs murene,
#   vinmarken oven på ø 0 og oliventræer på ø 7. Alt står uden for banens kollision (kun udsigt).
# ==========================================================================
import math, random
from ft_common import hash2, vnoise
from ft_plants import cypress, olive, stone_pine, vine_row, bush, V3
from ft_geo import *

def span_z(ring, x):
    """z-intervaller hvor lodret linje ved x ligger inde i ringen (lige-ulige regel)"""
    xs = []
    for i in range(len(ring) - 1):
        (xa, za), (xb, zb) = ring[i], ring[i + 1]
        if (xa <= x < xb) or (xb <= x < xa): xs.append(za + (zb - za) * (x - xa) / (xb - xa))
    xs.sort(); return [(xs[i], xs[i + 1]) for i in range(0, len(xs) - 1, 2)]

def vines(D, S):
    V = D['vine']; ring = V['poly']; ring = ring + [ring[0]] if ring[0] != ring[-1] else ring
    B, F, T = S['bark'], S['fol'], S['trim']; rnd = random.Random(21); xs = [p[0] for p in ring]; x = math.floor(min(xs)) + 0.9; n = 0
    while x < max(xs):
        for (za, zb) in span_z(ring, x):
            if zb - za > 4.0: vine_row(B, F, T, x, za + 0.8, x, zb - 0.8, V['y'], 1.45, rnd); n += 1
        x += V['gap']
    print('[scen] vinrækker på ø0:', n)

def scen(D, S):
    B, F = S['bark'], S['fol']
    for it in D['scen']:
        rnd = random.Random(it['seed'] * 977)
        if it['t'] == 'cypress': cypress(B, F, it['x'], it['z'], it['y'], rnd, h=it['h'], w=1.3)
        elif it['t'] == 'olive': olive(B, F, it['x'], it['z'], it['y'], rnd, h=it['h'], R=2.2)

def backdrop(D, S):
    BD, F, B, T = S['bd'], S['fol'], S['bark'], S['far']
    ext = D['walk']['ext']; xs = [p[0] for p in ext]; zs = [p[1] for p in ext]; X0, X1, Z0, Z1 = min(xs) - 6, max(xs) + 6, min(zs) - 6, max(zs) + 6
    # højderyggens plateau: ét fladt plan under hele banen (y = −0,35) så intet kigger ned i tomrum
    BD.poly([(X0, -0.35, Z1), (X1, -0.35, Z1), (X1, -0.35, Z0), (X0, -0.35, Z0)], 'ft_soil', want=(0, 1, 0), col=[(0.4, 0.2, 0.0, 1)] * 4)
    D_ = [0.0, 6.0, 14.0, 26.0, 45.0, 75.0, 120.0, 190.0, 300.0]
    def height(x, z, d):
        south = max(0.0, (z - Z1) / 120.0); north = max(0.0, (Z0 - z) / 150.0); amp = min(1.0, d / 60.0)
        roll = (vnoise(x * 0.012, z * 0.012) - 0.5) * 24 * amp + (vnoise(x * 0.04, z * 0.04) - 0.5) * 5 * amp
        return -0.35 - 0.12 * d * (1 - min(1, d / 120)) + roll * 1.0 - south * 40 * min(1, d / 40) + north * 30 + max(0.0, d - 90) * 0.12
    def ring_pts(d):
        pts = []
        xs_ = [X0 - d + (X1 - X0 + 2 * d) * k / 40 for k in range(41)]; zs_ = [Z0 - d + (Z1 - Z0 + 2 * d) * k / 36 for k in range(37)]
        for x in xs_: pts.append((x, Z0 - d))
        for z in zs_[1:]: pts.append((X1 + d, z))
        for x in reversed(xs_[:-1]): pts.append((x, Z1 + d))
        for z in reversed(zs_[1:-1]): pts.append((X0 - d, z))
        return pts
    rings = [ring_pts(d) for d in D_]; n = len(rings[0])
    for r in range(len(D_) - 1):
        a, b = rings[r], rings[r + 1]
        for k in range(n):
            k2 = (k + 1) % n
            q = [(a[k][0], height(a[k][0], a[k][1], D_[r]), a[k][1]), (a[k2][0], height(a[k2][0], a[k2][1], D_[r]), a[k2][1]), (b[k2][0], height(b[k2][0], b[k2][1], D_[r + 1]), b[k2][1]), (b[k][0], height(b[k][0], b[k][1], D_[r + 1]), b[k][1])]
            cxm = sum(p[0] for p in q) / 4; czm = sum(p[2] for p in q) / 4; h = vnoise(cxm * 0.018, czm * 0.018)
            mat = 'ft_vinefield' if h > 0.55 else 'ft_grass' if h > 0.32 else 'ft_soil'
            BD.poly(q[::-1], mat, want=(0, 1, 0), uvrot=(hash2(int(cxm / 30), int(czm / 30)) * 3.14), col=[(0.2, 0.0, 0.0, 1)] * 4)
    rnd = random.Random(11); cnt = 0
    for r in range(1, 6):
        d = D_[r]; pts = rings[r]
        for k in range(0, n, 2):
            x, z = pts[k]
            if hash2(x * 0.3, z * 0.3) > 0.5: continue
            y = height(x, z, d); rr = random.Random(int(hash2(x, z) * 1e6)); t = rr.random()
            if t < 0.4: cypress(B, F, x, z, y, rr, h=rr.uniform(9, 14), w=1.3)
            elif t < 0.75: olive(B, F, x, z, y, rr, h=rr.uniform(3.2, 4.6), R=rr.uniform(2.0, 3.0), lod=True)
            else: stone_pine(B, F, x, z, y, rr, h=rr.uniform(9, 13), R=rr.uniform(4, 5.5), lod=True)
            cnt += 1
    for (x0, z0, dx, dz, nn) in ((-90, -140, 0, 1, 14), (95, -100, 0.15, 1, 12), (-120, 30, 1, 0.2, 10)):         # cypresallé ned ad bakkerne
        for k in range(nn):
            x, z = x0 + dx * k * 9, z0 + dz * k * 9
            if X0 - 3 < x < X1 + 3 and Z0 - 3 < z < Z1 + 3: continue                                                  # aldrig inde i banen
            y = height(x, z, 70); cypress(B, F, x, z, y, random.Random(k * 13 + 5), h=rnd.uniform(10, 13), w=1.4); cnt += 1
    for (x, z, w, d) in ((-110, -95, 14, 9), (130, -60, 12, 8), (-150, 10, 16, 9), (60, -170, 12, 8), (160, 70, 14, 9), (-60, 150, 12, 8)):         # små gårde i det fjerne
        y = height(x, z, 100); T.box(x - w / 2, y - 1, z - d / 2, x + w / 2, y + 5, z + d / 2, 'ft_plaster_a')
        T.poly([(x - w / 2 - 0.5, y + 5, z - d / 2 - 0.5), (x + w / 2 + 0.5, y + 5, z - d / 2 - 0.5), (x + w / 2 - 2, y + 8, z), (x - w / 2 + 2, y + 8, z)], 'ft_roof', want=(0, 1, -1))
        T.poly([(x + w / 2 + 0.5, y + 5, z + d / 2 + 0.5), (x - w / 2 - 0.5, y + 5, z + d / 2 + 0.5), (x - w / 2 + 2, y + 8, z), (x + w / 2 - 2, y + 8, z)], 'ft_roof', want=(0, 1, 1))
        T.poly([(x - w / 2 - 0.5, y + 5, z + d / 2 + 0.5), (x - w / 2 - 0.5, y + 5, z - d / 2 - 0.5), (x - w / 2 + 2, y + 8, z)], 'ft_roof', want=(-1, 1, 0))
        T.poly([(x + w / 2 + 0.5, y + 5, z - d / 2 - 0.5), (x + w / 2 + 0.5, y + 5, z + d / 2 + 0.5), (x + w / 2 - 2, y + 8, z)], 'ft_roof', want=(1, 1, 0))
    print('[back] landskab: %d træer' % cnt)

def build(D, S):
    backdrop(D, S); scen(D, S); vines(D, S)
