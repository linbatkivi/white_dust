# ==========================================================================
# de_fattoria · geometri-hjælpere til Blender-bygningen: lokal ramme (langs en facade), orienterede bokse, cylindre, lanterner.
#   Layout-koordinater (x øst, y op, z syd). MB (bld/common.py) laver verdens-UV'er; her bruges egne UV'er langs facaderne (skrå vægge får ikke strakte teksturer).
# ==========================================================================
import math, random
from bld.common import MB, MATS
from ft_common import blend_at

def tsz(m): return MATS[m].get('size') or 2.0

class Fr:
    """lokal ramme: p0 = start, u = enhedsvektor langs facaden, n = enhedsvektor ud mod gaden (xz). P(a, w, y) → (x, y, z)"""
    def __init__(s, p0, u, n): s.p0 = p0; s.u = u; s.n = n
    def P(s, a, w, y): return (s.p0[0] + s.u[0] * a + s.n[0] * w, y, s.p0[1] + s.u[1] * a + s.n[1] * w)
    def W(s, a, w): return (s.p0[0] + s.u[0] * a + s.n[0] * w, s.p0[1] + s.u[1] * a + s.n[1] * w)

def vquad(M, fr, a0, a1, w, y0, y1, mat, uoff=0.0, back=False, col=None):
    """lodret flade i planen w = const (vender ud mod gaden; back = modsat)"""
    pts = [fr.P(a0, w, y0), fr.P(a1, w, y0), fr.P(a1, w, y1), fr.P(a0, w, y1)]; sz = tsz(mat)
    uv = [((a + uoff) / sz, y / sz) for (a, y) in ((a0, y0), (a1, y0), (a1, y1), (a0, y1))]
    M.poly(pts, mat, uv=uv, col=col, want=((-fr.n[0], 0, -fr.n[1]) if back else (fr.n[0], 0, fr.n[1])))

def obox(M, fr, a0, a1, w0, w1, y0, y1, mat, faces='fkltrd', uoff=0.0, uvrot=False):
    """kasse i den lokale ramme. faces: f = udad (w1), k = bag (w0), l = start (a0), r = slut (a1), t = top, d = bund"""
    sz = tsz(mat); n = fr.n; u = fr.u
    with M.part():
        if 'f' in faces: vquad(M, fr, a0, a1, w1, y0, y1, mat, uoff)
        if 'k' in faces: vquad(M, fr, a0, a1, w0, y0, y1, mat, uoff, back=True)
        if 'l' in faces:
            M.poly([fr.P(a0, w0, y0), fr.P(a0, w1, y0), fr.P(a0, w1, y1), fr.P(a0, w0, y1)], mat, uv=[(w / sz, y / sz) for (w, y) in ((w0, y0), (w1, y0), (w1, y1), (w0, y1))], want=(-u[0], 0, -u[1]))
        if 'r' in faces:
            M.poly([fr.P(a1, w0, y0), fr.P(a1, w1, y0), fr.P(a1, w1, y1), fr.P(a1, w0, y1)], mat, uv=[(w / sz, y / sz) for (w, y) in ((w0, y0), (w1, y0), (w1, y1), (w0, y1))], want=(u[0], 0, u[1]))
        if 't' in faces:
            M.poly([fr.P(a0, w0, y1), fr.P(a1, w0, y1), fr.P(a1, w1, y1), fr.P(a0, w1, y1)], mat, uv=[((a + uoff) / sz, w / sz) for (a, w) in ((a0, w0), (a1, w0), (a1, w1), (a0, w1))], want=(0, 1, 0))
        if 'd' in faces:
            M.poly([fr.P(a0, w0, y0), fr.P(a1, w0, y0), fr.P(a1, w1, y0), fr.P(a0, w1, y0)], mat, uv=[((a + uoff) / sz, w / sz) for (a, w) in ((a0, w0), (a1, w0), (a1, w1), (a0, w1))], want=(0, -1, 0))

def abox(M, x0, y0, z0, x1, y1, z1, mat, faces='nsewtb'):
    """akseparallel kasse med verdens-UV"""
    M.box(x0, y0, z0, x1, y1, z1, mat, faces=faces)

def cyl(M, cx, cz, r, y0, y1, mat, n=10, caps='tb', r1=None, smooth=True, uvscale=None):
    """lodret cylinder (r1 = øvre radius for kegle). UV: omkreds × højde"""
    r1 = r if r1 is None else r1; sz = tsz(mat) if uvscale is None else uvscale
    with M.part():
        for k in range(n):
            a0 = 2 * math.pi * k / n; a1 = 2 * math.pi * (k + 1) / n
            p = lambda a, rr, y: (cx + math.cos(a) * rr, y, cz + math.sin(a) * rr)
            am = (a0 + a1) / 2
            u0, u1 = (a0 * r) / sz, (a1 * r) / sz
            M.poly([p(a0, r, y0), p(a1, r, y0), p(a1, r1, y1), p(a0, r1, y1)], mat, uv=[(u0, y0 / sz), (u1, y0 / sz), (u1, y1 / sz), (u0, y1 / sz)], want=(math.cos(am), 0, math.sin(am)))
            if 't' in caps and k:
                pass
        if 't' in caps:
            pts = [(cx + math.cos(2 * math.pi * k / n) * r1, y1, cz + math.sin(2 * math.pi * k / n) * r1) for k in range(n)]
            M.poly(pts, mat, uv=[((q[0]) / sz, (q[2]) / sz) for q in pts], want=(0, 1, 0))
        if 'b' in caps:
            pts = [(cx + math.cos(2 * math.pi * k / n) * r, y0, cz + math.sin(2 * math.pi * k / n) * r) for k in range(n)]
            M.poly(pts, mat, uv=[((q[0]) / sz, (q[2]) / sz) for q in pts], want=(0, -1, 0))

def lantern_mesh(M, Mg, cx, cy, cz, r=0.2, h=0.5, mat='nk_paper', n=10, cap='nk_black_lac'):
    """papirlanterne (chōchin): ellipsoide med ribber, sorte låg. M = detalje (vertex-lys), cy = midten"""
    rings = 5; prof = []
    for k in range(rings + 1):
        t = k / rings; yy = cy - h / 2 + h * t; rr = r * (0.55 + 0.45 * math.sin(math.pi * t) ** 0.7) if 0 < k < rings else r * 0.5
        prof.append((yy, rr))
    with M.part():
        for k in range(rings):
            (y0, r0), (y1, r1) = prof[k], prof[k + 1]
            for i in range(n):
                a0 = 2 * math.pi * i / n; a1 = 2 * math.pi * (i + 1) / n; am = (a0 + a1) / 2
                p = lambda a, rr, y: (cx + math.cos(a) * rr, y, cz + math.sin(a) * rr)
                M.poly([p(a0, r0, y0), p(a1, r0, y0), p(a1, r1, y1), p(a0, r1, y1)], mat, uv=[(i / n, k / rings), ((i + 1) / n, k / rings), ((i + 1) / n, (k + 1) / rings), (i / n, (k + 1) / rings)], want=(math.cos(am), 0, math.sin(am)), smooth=True)
    cyl(M, cx, cz, r * 0.52, cy + h / 2, cy + h / 2 + 0.05, cap, n=n, caps='tb', uvscale=1.0)
    cyl(M, cx, cz, r * 0.52, cy - h / 2 - 0.05, cy - h / 2, cap, n=n, caps='tb', uvscale=1.0)

def polygon_area(pts):
    a = 0.0
    for i in range(len(pts)):
        x0, z0 = pts[i][0], pts[i][-1]; x1, z1 = pts[(i + 1) % len(pts)][0], pts[(i + 1) % len(pts)][-1]; a += x0 * z1 - x1 * z0
    return a / 2.0

def clip_poly(poly, f0, keep_ge):
    """Sutherland–Hodgman: konveks polygon [(x,z)] klippes mod f(p) ≥ 0 (keep_ge) eller ≤ 0, f0 = funktion (x,z) → v"""
    out = []; n = len(poly)
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]; fa, fb = f0(a), f0(b)
        if not keep_ge: fa, fb = -fa, -fb
        if fa >= 0: out.append(a)
        if (fa >= 0) != (fb >= 0):
            t = fa / (fa - fb) if fa != fb else 0.0; out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return out


def hcyl(M, a, b, r, mat, n=10, caps='ab', uvscale=None):
    """cylinder mellem to punkter a, b (layout x,y,z)"""
    ax, ay, az = a; bx, by, bz = b; d = (bx - ax, by - ay, bz - az); L = math.sqrt(d[0] ** 2 + d[1] ** 2 + d[2] ** 2) or 1.0; d = (d[0] / L, d[1] / L, d[2] / L)
    ref = (0, 1, 0) if abs(d[1]) < 0.9 else (1, 0, 0)
    e1 = (d[1] * ref[2] - d[2] * ref[1], d[2] * ref[0] - d[0] * ref[2], d[0] * ref[1] - d[1] * ref[0]); l1 = math.sqrt(sum(c * c for c in e1)); e1 = tuple(c / l1 for c in e1)
    e2 = (d[1] * e1[2] - d[2] * e1[1], d[2] * e1[0] - d[0] * e1[2], d[0] * e1[1] - d[1] * e1[0]); sz = tsz(mat) if uvscale is None else uvscale
    ring = lambda c, k: (c[0] + (e1[0] * math.cos(2 * math.pi * k / n) + e2[0] * math.sin(2 * math.pi * k / n)) * r, c[1] + (e1[1] * math.cos(2 * math.pi * k / n) + e2[1] * math.sin(2 * math.pi * k / n)) * r, c[2] + (e1[2] * math.cos(2 * math.pi * k / n) + e2[2] * math.sin(2 * math.pi * k / n)) * r)
    with M.part():
        for k in range(n):
            k2 = (k + 1) % n; am = 2 * math.pi * (k + 0.5) / n; out = (e1[0] * math.cos(am) + e2[0] * math.sin(am), e1[1] * math.cos(am) + e2[1] * math.sin(am), e1[2] * math.cos(am) + e2[2] * math.sin(am))
            u0, u1 = k * 2 * math.pi * r / n / sz, (k + 1) * 2 * math.pi * r / n / sz
            M.poly([ring(a, k), ring(a, k2), ring(b, k2), ring(b, k)], mat, uv=[(u0, 0), (u1, 0), (u1, L / sz), (u0, L / sz)], want=out, smooth=True)
        if 'a' in caps: M.poly([ring(a, k) for k in range(n)], mat, uv=[(0.5 + math.cos(2 * math.pi * k / n) * 0.4, 0.5 + math.sin(2 * math.pi * k / n) * 0.4) for k in range(n)], want=(-d[0], -d[1], -d[2]))
        if 'b' in caps: M.poly([ring(b, k) for k in range(n)], mat, uv=[(0.5 + math.cos(2 * math.pi * k / n) * 0.4, 0.5 + math.sin(2 * math.pi * k / n) * 0.4) for k in range(n)], want=d)
