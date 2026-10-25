# ==========================================================================
# de_niseko · geometri-hjælpere (shapely + earcut): konveks opdeling af polygoner til kollisions-prismer
# ==========================================================================
import math
import numpy as np
import mapbox_earcut as earcut
from shapely.geometry import Polygon, MultiPolygon

def polys_of(g):
    if g is None or g.is_empty: return []
    if g.geom_type == 'Polygon': return [g]
    if hasattr(g, 'geoms'): return [q for p in g.geoms for q in polys_of(p)]
    return []

def ccw(pts):
    a = 0.0
    for i in range(len(pts)):
        x0, z0 = pts[i]; x1, z1 = pts[(i + 1) % len(pts)]; a += x0 * z1 - x1 * z0
    return a > 0

def triangulate(poly):
    """shapely Polygon (med huller) → (hjørner [(x,z)], trekanter [(i,j,k)]) – earcut"""
    rings = [list(poly.exterior.coords)[:-1]] + [list(h.coords)[:-1] for h in poly.interiors]
    V = [p for r in rings for p in r]; ends = []; n = 0
    for r in rings: n += len(r); ends.append(n)
    t = earcut.triangulate_float64(np.array(V, dtype=np.float64).reshape(-1, 2), np.array(ends, dtype=np.uint32)).reshape(-1, 3)
    return V, [tuple(int(i) for i in tri) for tri in t]

def convex(pts, eps=1e-7):
    n = len(pts); s = 0
    for i in range(n):
        a, b, c = pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
        if cr > eps: s |= 1
        elif cr < -eps: s |= 2
        if s == 3: return False
    return True

def _tri_ok(poly, V, tris):
    a = sum(abs(_area([V[i] for i in t])) for t in tris)
    return abs(a - poly.area) <= max(1e-4, 0.002 * poly.area)

def _clean(poly):
    q = poly.buffer(0)
    if q.geom_type != 'Polygon': q = max(polys_of(q), key=lambda g: g.area)
    for tol in (2e-4, 1e-3, 5e-3):
        g = q.simplify(tol)
        if g.is_empty or g.geom_type != 'Polygon': continue
        yield g

def convex_pieces(poly, max_pts=12):
    """konveks opdeling (earcut + Hertel–Mehlhorn-sammenlægning): liste af polygoner [(x,z),…] i mod-uret rækkefølge"""
    V = tris = None
    for g in _clean(poly):
        v, t = triangulate(g)
        if _tri_ok(g, v, t): V, tris, poly = v, t, g; break
    if tris is None:
        from shapely.ops import triangulate as dt
        out = []
        for t in dt(poly):
            if poly.contains(t.representative_point()): out.append([tuple(c) for c in list(t.exterior.coords)[:-1]])
        out = [pc if ccw(pc) else pc[::-1] for pc in out]
        return [pc for pc in out if abs(_area(pc)) > 1e-6]
    P = []
    for t in tris:
        a, b, c = t
        if ccw([V[a], V[b], V[c]]): P.append([a, b, c])
        else: P.append([a, c, b])
    P = [p for p in P if abs(_area([V[i] for i in p])) > 1e-9]
    changed = True
    while changed:
        changed = False
        em = {}
        for pi, p in enumerate(P):
            if p is None: continue
            for k in range(len(p)): em[(p[k], p[(k + 1) % len(p)])] = pi
        for pi, p in enumerate(P):
            if p is None: continue
            for k in range(len(p)):
                a, b = p[k], p[(k + 1) % len(p)]; qi = em.get((b, a))
                if qi is None or qi == pi or P[qi] is None: continue
                q = P[qi]
                pl = p[k + 1:] + p[:k + 1]                      # [b, …, a]
                j = q.index(a); ql = q[j:] + q[:j]              # [a, …, b]
                m = pl + ql[1:-1]
                if len(m) > max_pts: continue
                pts = [V[i] for i in m]
                if convex(pts):
                    P[pi] = m; P[qi] = None; changed = True; break
            if changed: break
    out = []
    for p in P:
        if p is None: continue
        pts = [V[i] for i in p]
        # fjern (næsten) kollineære punkter
        res = []
        for i in range(len(pts)):
            a, b, c = pts[i - 1], pts[i], pts[(i + 1) % len(pts)]
            cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); L = math.hypot(c[0] - a[0], c[1] - a[1])
            if L < 1e-9 or abs(cr) / L > 2e-4: res.append(b)
        if len(res) >= 3 and abs(_area(res)) > 1e-6: out.append(res)
    return out

def _area(pts):
    a = 0.0
    for i in range(len(pts)):
        x0, z0 = pts[i]; x1, z1 = pts[(i + 1) % len(pts)]; a += x0 * z1 - x1 * z0
    return a / 2.0
