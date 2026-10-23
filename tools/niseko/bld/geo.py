# ==========================================================================
# de_havn · geometri-værktøjer oven på MB (layout-koordinater x øst, y op, z syd):
#   prism/lathe (lodrette omdrejningslegemer: pæle, pullerter, søjler, spir), tube (stang mellem to punkter),
#   xbeam (bjælke i et lodret plan med skrå over-/underkant), hip_roof (valmtag), stepped_gable (kamtakket gavl),
#   arch_pts (cirkelsegment), ngon-hjælpere. Alle flader får udadvendte normaler (want=…).
# ==========================================================================
import math

def ring(cx, cz, r, n, rot=0.0):
    return [(cx + r * math.cos(rot + 2 * math.pi * k / n), cz + r * math.sin(rot + 2 * math.pi * k / n)) for k in range(n)]

def lathe(mb, prof, cx, cz, m, n=16, rot=None, cap_top=True, cap_bot=False, mats=None):
    with mb.part(): return _lathe(mb, prof, cx, cz, m, n, rot, cap_top, cap_bot, mats)
def _lathe(mb, prof, cx, cz, m, n, rot, cap_top, cap_bot, mats):
    """omdrejningslegeme om lodret akse gennem (cx, cz). prof = [(r, y), ...] nedefra og op. mats: materiale pr. profilsegment."""
    rot = (math.pi / n) if rot is None else rot
    for i in range(len(prof) - 1):
        (r0, y0), (r1, y1) = prof[i], prof[i + 1]
        mm = mats[i] if mats else m
        if r0 < 1e-5 and r1 < 1e-5: continue
        for k in range(n):
            a0 = rot + 2 * math.pi * k / n; a1 = rot + 2 * math.pi * (k + 1) / n; am = (a0 + a1) / 2
            p = [(cx + r0 * math.cos(a0), y0, cz + r0 * math.sin(a0)), (cx + r0 * math.cos(a1), y0, cz + r0 * math.sin(a1)),
                 (cx + r1 * math.cos(a1), y1, cz + r1 * math.sin(a1)), (cx + r1 * math.cos(a0), y1, cz + r1 * math.sin(a0))]
            if r0 < 1e-5: p = [p[0], p[2], p[3]]
            elif r1 < 1e-5: p = [p[0], p[1], p[2]]
            dr, dy = r1 - r0, y1 - y0                                          # normal: vinkelret på profilen, udad
            nrm = (math.cos(am) * dy, -dr, math.sin(am) * dy)
            if abs(dy) < 1e-6: nrm = (0, 1 if r1 < r0 else -1, 0)
            mb.poly(p, mm, want=nrm)
    if cap_top and prof[-1][0] > 1e-5:
        r, y = prof[-1]; mb.poly([(x, y, z) for x, z in ring(cx, cz, r, n, rot)], mats[-1] if mats else m, want=(0, 1, 0))
    if cap_bot and prof[0][0] > 1e-5:
        r, y = prof[0]; mb.poly([(x, y, z) for x, z in ring(cx, cz, r, n, rot)], mats[0] if mats else m, want=(0, -1, 0))

def prism(mb, cx, cz, r, y0, y1, m, n=8, r1=None, caps='t', rot=None):
    lathe(mb, [(r, y0), (r if r1 is None else r1, y1)], cx, cz, m, n=n, rot=rot, cap_top='t' in caps, cap_bot='b' in caps)

def tube(mb, p0, p1, r, m, n=8, caps=True, r1=None):
    with mb.part(): return _tube(mb, p0, p1, r, m, n, caps, r1)
def _tube(mb, p0, p1, r, m, n, caps, r1):
    """n-kantet stang fra p0 til p1 (layout-punkter)"""
    ax = [p1[i] - p0[i] for i in range(3)]; L = math.sqrt(sum(a * a for a in ax))
    if L < 1e-6: return
    d = [a / L for a in ax]
    up = (0, 1, 0) if abs(d[1]) < 0.9 else (1, 0, 0)
    u = cross(d, up); u = norm(u); v = cross(d, u)
    rr = r if r1 is None else r1
    pts0, pts1, nr = [], [], []
    for k in range(n):
        a = 2 * math.pi * (k + 0.5) / n; c, s = math.cos(a), math.sin(a)
        off = [u[i] * c + v[i] * s for i in range(3)]
        pts0.append(tuple(p0[i] + off[i] * r for i in range(3))); pts1.append(tuple(p1[i] + off[i] * rr for i in range(3))); nr.append(off)
    for k in range(n):
        k2 = (k + 1) % n; nn = [nr[k][i] + nr[k2][i] for i in range(3)]
        mb.poly([pts0[k], pts0[k2], pts1[k2], pts1[k]], m, want=tuple(nn))
    if caps:
        mb.poly(pts1, m, want=tuple(d)); mb.poly(pts0[::-1], m, want=tuple(-x for x in d))

def cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def norm(a):
    l = math.sqrt(sum(x * x for x in a)) or 1.0; return tuple(x / l for x in a)

def obox(mb, p0, p1, w, h, m, up=(0, 1, 0), faces='all'):
    with mb.part(): return _obox(mb, p0, p1, w, h, m, up, faces)
def _obox(mb, p0, p1, w, h, m, up, faces):
    """kasse langs linjen p0→p1 med bredde w (vandret, vinkelret) og højde h (op fra linjen) – til skrå bjælker og stivere"""
    ax = [p1[i] - p0[i] for i in range(3)]; d = norm(ax)
    side = norm(cross(d, up)); upv = norm(cross(side, d))
    def P(p, s, t): return tuple(p[i] + side[i] * s + upv[i] * t for i in range(3))
    hw = w / 2
    c = [P(p0, -hw, 0), P(p0, hw, 0), P(p0, hw, h), P(p0, -hw, h), P(p1, -hw, 0), P(p1, hw, 0), P(p1, hw, h), P(p1, -hw, h)]
    F = [((0, 1, 5, 4), tuple(-x for x in upv)), ((3, 7, 6, 2), upv), ((1, 2, 6, 5), side), ((0, 4, 7, 3), tuple(-x for x in side)),
         ((0, 3, 2, 1), tuple(-x for x in d)), ((4, 5, 6, 7), d)]
    for idx, wv in F: mb.poly([c[i] for i in idx], m, want=wv)

def xbeam(mb, xa, ya, xb, yb, z0, z1, h, m, faces='tbnsew'):
    with mb.part(): return _xbeam(mb, xa, ya, xb, yb, z0, z1, h, m, faces)
def _xbeam(mb, xa, ya, xb, yb, z0, z1, h, m, faces):
    """bjælke i planet z0..z1 hvis underkant går fra (xa, ya) til (xb, yb) og som er h høj (lodret)"""
    P = lambda x, y, z: (x, y, z)
    if 't' in faces: mb.poly([P(xa, ya + h, z1), P(xb, yb + h, z1), P(xb, yb + h, z0), P(xa, ya + h, z0)], m, want=(0, 1, 0))
    if 'b' in faces: mb.poly([P(xa, ya, z0), P(xb, yb, z0), P(xb, yb, z1), P(xa, ya, z1)], m, want=(0, -1, 0))
    if 's' in faces: mb.poly([P(xa, ya, z1), P(xb, yb, z1), P(xb, yb + h, z1), P(xa, ya + h, z1)], m, want=(0, 0, 1))
    if 'n' in faces: mb.poly([P(xb, yb, z0), P(xa, ya, z0), P(xa, ya + h, z0), P(xb, yb + h, z0)], m, want=(0, 0, -1))
    if 'w' in faces: mb.poly([P(xa, ya, z0), P(xa, ya, z1), P(xa, ya + h, z1), P(xa, ya + h, z0)], m, want=(-1, 0, 0))
    if 'e' in faces: mb.poly([P(xb, yb, z1), P(xb, yb, z0), P(xb, yb + h, z0), P(xb, yb + h, z1)], m, want=(1, 0, 0))

def zbeam(mb, za, ya, zb, yb, x0, x1, h, m, faces='tbnsew'):
    with mb.part(): return _zbeam(mb, za, ya, zb, yb, x0, x1, h, m, faces)
def _zbeam(mb, za, ya, zb, yb, x0, x1, h, m, faces):
    """som xbeam, men langs z (underkant fra (za, ya) til (zb, yb)) i planet x0..x1"""
    P = lambda x, y, z: (x, y, z)
    if 't' in faces: mb.poly([P(x0, ya + h, za), P(x0, yb + h, zb), P(x1, yb + h, zb), P(x1, ya + h, za)], m, want=(0, 1, 0))
    if 'b' in faces: mb.poly([P(x0, ya, za), P(x1, ya, za), P(x1, yb, zb), P(x0, yb, zb)], m, want=(0, -1, 0))
    if 'e' in faces: mb.poly([P(x1, ya, za), P(x1, yb, zb), P(x1, yb + h, zb), P(x1, ya + h, za)], m, want=(1, 0, 0))
    if 'w' in faces: mb.poly([P(x0, yb, zb), P(x0, ya, za), P(x0, ya + h, za), P(x0, yb + h, zb)], m, want=(-1, 0, 0))
    if 'n' in faces: mb.poly([P(x0, ya, za), P(x1, ya, za), P(x1, ya + h, za), P(x0, ya + h, za)], m, want=(0, 0, -1))
    if 's' in faces: mb.poly([P(x1, yb, zb), P(x0, yb, zb), P(x0, yb + h, zb), P(x1, yb + h, zb)], m, want=(0, 0, 1))

def arch_y(x, xc, half, crown, rise):
    """indersiden (intrados) af en segmentbue: crown i midten, rise over vederlaget, halv spændvidde half"""
    R = (half * half + rise * rise) / (2 * rise); yc = crown - R
    dx = min(abs(x - xc), half)
    return yc + math.sqrt(max(0.0, R * R - dx * dx))

def hip_roof(mb, x0, z0, x1, z1, edge, pitch_deg, m, ov=0.4, under='timber'):
    """valmtag over (x0..x1, z0..z1): tagkanten ligger i højden edge, ov ud fra murene (hviler på gesimsen). Returnerer (top, rygning, hjørner)."""
    t = math.tan(math.radians(pitch_deg))
    X0, Z0, X1, Z1 = x0 - ov, z0 - ov, x1 + ov, z1 + ov; ye = edge
    hx, hz = (X1 - X0) / 2, (Z1 - Z0) / 2; run = min(hx, hz); top = ye + run * t
    cx, cz = (X0 + X1) / 2, (Z0 + Z1) / 2
    if hx >= hz: r0, r1 = (cx - (hx - hz), cz), (cx + (hx - hz), cz)       # rygning langs x
    else: r0, r1 = (cx, cz - (hz - hx)), (cx, cz + (hz - hx))
    A, Bc, Cc, D = (X0, ye, Z0), (X1, ye, Z0), (X1, ye, Z1), (X0, ye, Z1)
    R0, R1 = (r0[0], top, r0[1]), (r1[0], top, r1[1])
    if hx >= hz:
        mb.poly([A, Bc, R1, R0], m, want=(0, 1, -1)); mb.poly([Cc, D, R0, R1], m, want=(0, 1, 1))
        mb.poly([D, A, R0], m, want=(-1, 1, 0)); mb.poly([Bc, Cc, R1], m, want=(1, 1, 0))
    else:
        mb.poly([D, A, R0, R1], m, want=(-1, 1, 0)); mb.poly([Bc, Cc, R1, R0], m, want=(1, 1, 0))
        mb.poly([A, Bc, R0], m, want=(0, 1, -1)); mb.poly([Cc, D, R1], m, want=(0, 1, 1))
    # tagdækningens forkant + smal underside tilbage til gesimsen
    fh = 0.04; ins = ov - 0.32
    for (a, b, nrm) in (((X0, Z0), (X1, Z0), (0, -1)), ((X1, Z0), (X1, Z1), (1, 0)), ((X1, Z1), (X0, Z1), (0, 1)), ((X0, Z1), (X0, Z0), (-1, 0))):
        mb.poly([(a[0], ye - fh, a[1]), (b[0], ye - fh, b[1]), (b[0], ye, b[1]), (a[0], ye, a[1])], m, want=(nrm[0], 0, nrm[1]))
        ia = (a[0] - nrm[0] * ins - nrm[1] * ins * 0, a[1] - nrm[1] * ins)
    yi = ye - fh + ins * t
    for (pa, pb, qa, qb) in (((X0, Z0), (X1, Z0), (X0 + ins, Z0 + ins), (X1 - ins, Z0 + ins)), ((X1, Z0), (X1, Z1), (X1 - ins, Z0 + ins), (X1 - ins, Z1 - ins)),
                             ((X1, Z1), (X0, Z1), (X1 - ins, Z1 - ins), (X0 + ins, Z1 - ins)), ((X0, Z1), (X0, Z0), (X0 + ins, Z1 - ins), (X0 + ins, Z0 + ins))):
        mb.poly([(pa[0], ye - fh, pa[1]), (pb[0], ye - fh, pb[1]), (qb[0], yi, qb[1]), (qa[0], yi, qa[1])], under, want=(0, -1, 0))
    return top, (R0, R1), (A, Bc, Cc, D)

def hip_ridges(mb, ridge, corners, m, r=0.09):
    """rygnings- og gratsten (halvrunde) langs valmtagets rygning og grater"""
    R0, R1 = ridge
    segs = [(R0, R1)] if math.dist(R0, R1) > 1e-3 else []
    A, Bc, Cc, D = corners
    near = lambda p: R0 if math.dist((p[0], p[2]), (R0[0], R0[2])) < math.dist((p[0], p[2]), (R1[0], R1[2])) else R1
    for c in (A, Bc, Cc, D): segs.append((c, near(c)))
    for a, b in segs:
        tube(mb, (a[0], a[1] + r * 0.4, a[2]), (b[0], b[1] + r * 0.4, b[2]), r, m, n=6, caps=True)

def gable_tri(mb, face_pts, m, want):
    mb.poly(face_pts, m, want=want)
