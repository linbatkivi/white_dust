# ==========================================================================
# de_niseko · terræn: gulvstykker (1,5 m felter med mos/snavs pr. hjørne), kanalbund, brystninger langs vandet, vandflader, stenbro, overgangslister
# ==========================================================================
import math
from nk_geo import *
from nk_common import blend_at

def ground(D, M):
    for g in D['ground']:
        pts = [(x, g['y'], z) for x, z in g['ring']]
        M.poly(pts, g['m'], col=[blend_at(p, 1.0) for p in pts], want=(0, 1, 0))

def bed(D, M):
    for g in D['bed']:
        pts = [(x, g['y'], z) for x, z in g['ring']]
        M.poly(pts, g['m'], col=[(0.3, 0.0, 0.9, 1.0)] * len(pts), want=(0, 1, 0))

def banks(D, Wm, T):
    """lodrette brystningsmure (stensætning) fra kanalbunden op til gulvet + en lav dæksten (coping) hele vejen rundt. Ringe er mod-uret → vandet ligger til venstre."""
    for ring in D['water_rings']:
        n = len(ring) - 1; pts = ring[:-1]
        # vertex-normaler (udad = væk fra vandet = højre side af kantretningen)
        nrm = []
        for i in range(n):
            a, b, c = pts[i - 1], pts[i], pts[(i + 1) % n]
            n0 = (b[1] - a[1], -(b[0] - a[0])); n1 = (c[1] - b[1], -(c[0] - b[0]))
            l0 = math.hypot(*n0) or 1; l1 = math.hypot(*n1) or 1; n0 = (n0[0] / l0, n0[1] / l0); n1 = (n1[0] / l1, n1[1] / l1)
            m = (n0[0] + n1[0], n0[1] + n1[1]); ml = math.hypot(*m)
            nrm.append((m[0] / ml, m[1] / ml) if ml > 0.2 else n1)
        yb, yt = -0.48, 0.0; cw = 0.2
        for i in range(n):
            a, b = pts[i], pts[(i + 1) % n]; L = math.hypot(b[0] - a[0], b[1] - a[1])
            if L < 0.02: continue
            wn = (-(b[1] - a[1]) / L, (b[0] - a[0]) / L)                         # mod vandet (ind i vandet = venstre): venstre normal af retningen
            sz = tsz('nk_bank'); u0, u1 = i * 1.7, i * 1.7 + L
            Wm.poly([(a[0], yb, a[1]), (b[0], yb, b[1]), (b[0], yt, b[1]), (a[0], yt, a[1])], 'nk_bank', uv=[(u0 / sz, yb / sz), (u1 / sz, yb / sz), (u1 / sz, yt / sz), (u0 / sz, yt / sz)],
                    col=[blend_at((a[0], yb, a[1]), 0.0), blend_at((b[0], yb, b[1]), 0.0), blend_at((b[0], yt, b[1]), 0.0), blend_at((a[0], yt, a[1]), 0.0)], want=(wn[0], 0, wn[1]))
            # dæksten: skråt lille bånd udad (mitret via vertex-normaler) + lodret kant ned mod vandet
            na, nb_ = nrm[i], nrm[(i + 1) % n]
            A2 = (a[0] + na[0] * cw, a[1] + na[1] * cw); B2 = (b[0] + nb_[0] * cw, b[1] + nb_[1] * cw); yc = 0.07
            T.poly([(a[0], yc, a[1]), (b[0], yc, b[1]), (B2[0], yc, B2[1]), (A2[0], yc, A2[1])], 'nk_stonebase', uv=[(a[0] / 2, a[1] / 2), (b[0] / 2, b[1] / 2), (B2[0] / 2, B2[1] / 2), (A2[0] / 2, A2[1] / 2)], want=(0, 1, 0))
            T.poly([(a[0], yt, a[1]), (b[0], yt, b[1]), (b[0], yc, b[1]), (a[0], yc, a[1])], 'nk_stonebase', uv=[(u0 / 2, 0), (u1 / 2, 0), (u1 / 2, 0.035), (u0 / 2, 0.035)], want=(wn[0], 0, wn[1]))
            T.poly([(A2[0], 0.0, A2[1]), (B2[0], 0.0, B2[1]), (B2[0], yc, B2[1]), (A2[0], yc, A2[1])], 'nk_stonebase', uv=[(u0 / 2, 0), (u1 / 2, 0), (u1 / 2, 0.035), (u0 / 2, 0.035)], want=(-wn[0], 0, -wn[1]))

def water(D, WM, y=-0.08):
    for pc in D['water_pieces']:
        pts = [(x, y, z) for x, z in pc]
        WM.poly(pts, 'water', uv=[(x / 3.0, z / 3.0) for x, z in pc], want=(0, 1, 0))

def bridge(D, M, T):
    x0, z0, x1, z1 = D['bridge']
    # to granitplader (dæk i gulvhøjde) + kantsten
    w = (z1 - z0)
    M.box(x0, -0.42, z0, x1, 0.0, z1, 'nk_stonebase', faces='nsewt')
    T.box(x0 - 0.1, -0.1, z0 - 0.03, x1 + 0.1, 0.035, z0 + 0.04, 'nk_stonebase', faces='nsewt')
    T.box(x0 - 0.1, -0.1, z1 - 0.04, x1 + 0.1, 0.035, z1 + 0.03, 'nk_stonebase', faces='nsewt')
    T.box((x0 + x1) / 2 - 0.02, -0.001, z0, (x0 + x1) / 2 + 0.02, 0.012, z1, 'nk_black_lac', faces='t')          # fuge mellem pladerne

def thresholds(D, T):
    for (a0, a1, b0, b1) in D['thresholds']:
        L = math.hypot(b0 - a0, b1 - a1)
        if L < 0.3: continue
        u = ((b0 - a0) / L, (b1 - a1) / L); n = (-u[1], u[0])
        pts = [(a0 - n[0] * 0.14, 0.03, a1 - n[1] * 0.14), (b0 - n[0] * 0.14, 0.03, b1 - n[1] * 0.14), (b0 + n[0] * 0.14, 0.03, b1 + n[1] * 0.14), (a0 + n[0] * 0.14, 0.03, a1 + n[1] * 0.14)]
        T.poly(pts, 'nk_stonebase', uv=[(p[0] / 2, p[2] / 2) for p in pts], want=(0, 1, 0))
