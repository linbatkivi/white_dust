# ==========================================================================
# de_fattoria · kulisse: Chianti-landskab uden for banen – bølgende bakker med vinmarker (rækketekstur), oliventræer, cypresrækker, stenfyr og små gårde i det fjerne.
#   Starter ved kanten af layoutets bakketerræn (så der ikke er en søm) og breder sig udad; hører til 'backdrop'-lagene (vertex-lys, ingen kollision).
# ==========================================================================
import math, random
import numpy as np
from ft_common import hash2, vnoise
from ft_plants import cypress, olive, stone_pine, card, V3
from ft_geo import *

def build(D, S):
    G = S['G']; BD = S['bd']; F = S['fol']; B = S['bark']; T = S['far']
    X0, Z0 = G.X0, G.Z0; X1, Z1 = G.x(G.NX), G.z(G.NZ)
    # kanthøjde: bakketerrænets højde ved gitterets rand (fra Dijkstra-feltet)
    def edge_y(x, z):
        j = min(max(G.cz(z), 0), G.NZ - 1); i = min(max(G.cx(x), 0), G.NX - 1)
        return float(G.cap[j, i]) if G.hill[j, i] else 6.0
    # ringe: afstand (m) fra gitterets rand
    D_ = [0.0, 6.0, 14.0, 26.0, 45.0, 75.0, 120.0, 190.0, 300.0]
    # rektangulær ring med 4 sider × N punkter pr. side
    def ring_pts(d):
        pts = []
        xs = [X0 - d + (X1 - X0 + 2 * d) * k / 40 for k in range(41)]; zs = [Z0 - d + (Z1 - Z0 + 2 * d) * k / 36 for k in range(37)]
        for x in xs: pts.append((x, Z0 - d))
        for z in zs[1:]: pts.append((X1 + d, z))
        for x in reversed(xs[:-1]): pts.append((x, Z1 + d))
        for z in reversed(zs[1:-1]): pts.append((X0 - d, z))
        return pts
    base = {}
    def height(x, z, d):
        cx_ = min(max(x, X0 + 0.01), X1 - 0.01); cz_ = min(max(z, Z0 + 0.01), Z1 - 0.01)
        y0 = edge_y(cx_, cz_)
        # mod syd falder bakken ned i dalen; mod nord og øst/vest stiger den til bakkerygge
        south = max(0.0, (z - Z1) / 120.0); north = max(0.0, (Z0 - z) / 150.0)
        amp = min(1.0, d / 60.0)
        roll = (vnoise(x * 0.012, z * 0.012) - 0.5) * 24 * amp + (vnoise(x * 0.04, z * 0.04) - 0.5) * 5 * amp
        return y0 + 0.06 * d * (1 - min(1, d / 160)) + roll - south * 40 * min(1, d / 40) + north * 22
    rings = [ring_pts(d) for d in D_]
    n = len(rings[0])
    for r in range(len(D_) - 1):
        a, b = rings[r], rings[r + 1]
        for k in range(n):
            k2 = (k + 1) % n
            q = [(a[k][0], height(a[k][0], a[k][1], D_[r]), a[k][1]), (a[k2][0], height(a[k2][0], a[k2][1], D_[r]), a[k2][1]), (b[k2][0], height(b[k2][0], b[k2][1], D_[r + 1]), b[k2][1]), (b[k][0], height(b[k][0], b[k][1], D_[r + 1]), b[k][1])]
            cxm = sum(p[0] for p in q) / 4; czm = sum(p[2] for p in q) / 4; h = vnoise(cxm * 0.018, czm * 0.018)
            mat = 'ft_vinefield' if h > 0.55 else 'ft_grass' if h > 0.32 else 'ft_soil'
            uvr = (hash2(int(cxm / 30), int(czm / 30)) * 3.14)
            BD.poly(q[::-1], mat, want=(0, 1, 0), uvrot=uvr, col=[(0.2, 0.0, 0.0, 1)] * 4)
    # træer og cypresrækker i landskabet
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
    # cypresrækker (allé) ned ad en bakke mod nord og øst
    for (x0, z0, dx, dz, nn) in ((-90, -140, 0, 1, 14), (95, -100, 0.15, 1, 12), (-120, 30, 1, 0.2, 10)):
        for k in range(nn):
            x, z = x0 + dx * k * 9, z0 + dz * k * 9; y = height(x, z, 70); cypress(B, F, x, z, y, random.Random(k * 13 + 5), h=rnd.uniform(10, 13), w=1.4); cnt += 1
    # små gårde i det fjerne: kasse + pyramidetag
    for (x, z, w, d) in ((-110, -95, 14, 9), (130, -60, 12, 8), (-150, 10, 16, 9), (60, -170, 12, 8), (160, 70, 14, 9), (-60, 150, 12, 8)):
        y = height(x, z, 100); T.box(x - w / 2, y - 1, z - d / 2, x + w / 2, y + 5, z + d / 2, 'ft_plaster_a')
        T.poly([(x - w / 2 - 0.5, y + 5, z - d / 2 - 0.5), (x + w / 2 + 0.5, y + 5, z - d / 2 - 0.5), (x + w / 2 - 2, y + 8, z), (x - w / 2 + 2, y + 8, z)], 'ft_roof', want=(0, 1, -1))
        T.poly([(x + w / 2 + 0.5, y + 5, z + d / 2 + 0.5), (x - w / 2 - 0.5, y + 5, z + d / 2 + 0.5), (x - w / 2 + 2, y + 8, z), (x + w / 2 - 2, y + 8, z)], 'ft_roof', want=(0, 1, 1))
        T.poly([(x - w / 2 - 0.5, y + 5, z + d / 2 + 0.5), (x - w / 2 - 0.5, y + 5, z - d / 2 - 0.5), (x - w / 2 + 2, y + 8, z)], 'ft_roof', want=(-1, 1, 0))
        T.poly([(x + w / 2 + 0.5, y + 5, z - d / 2 - 0.5), (x + w / 2 + 0.5, y + 5, z + d / 2 + 0.5), (x + w / 2 - 2, y + 8, z)], 'ft_roof', want=(1, 1, 0))
    print('[back] landskab: %d træer' % cnt)
