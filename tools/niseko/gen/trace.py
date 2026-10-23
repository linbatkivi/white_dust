#!/usr/bin/env python3
# ==========================================================================
# de_niseko · layoutet fra brugerens minimap (ref/minimap_user.webp) → rene vektorpolygoner (meter) – python3 tools/niseko/gen/trace.py
#   sort = gange, rød = sites, grøn = objekter, hvid/grå = bygninger. Skala: 10 px = 1 m. Kanter regulariseres: lodret/vandret/45° rettes helt op, øvrige
#   vinkler holdes (rette linjestykker med fælles hjørner). Udgang: out/layout_trace.json (+ out/layout_trace.png)
# ==========================================================================
import os, sys, json, math, pickle
import numpy as np
from PIL import Image, ImageDraw
from shapely.geometry import Polygon, box
from shapely.ops import unary_union
HERE = os.path.dirname(os.path.abspath(__file__)); TOOL = os.path.dirname(HERE); OUT = os.path.join(TOOL, 'out')
S = 10.0                                  # px pr. meter
CX, CY = 651.0, 575.0                     # billedets midte → verdens-origo

def line_isect(p0, d0, p1, d1):
    cr = d0[0] * d1[1] - d0[1] * d1[0]
    if abs(cr) < 0.08: return None
    t = ((p1[0] - p0[0]) * d1[1] - (p1[1] - p0[1]) * d1[0]) / cr
    return (p0[0] + d0[0] * t, p0[1] + d0[1] * t)

def angle_targets(rings, tol=5.0, min_len=7.0, long_len=4.0, ctol=3.0):
    """vinkler pr. kant: lodret/vandret/45° rettes op; øvrige lange kanter grupperes (±3°) og får gruppens gennemsnit (parallelle vægge → helt parallelle)"""
    T = {}; free = []
    for ri, ring in enumerate(rings):
        for i in range(len(ring) - 1):
            a, b = ring[i], ring[i + 1]; dx, dz = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dz); th = math.degrees(math.atan2(dz, dx)) % 180.0
            if L >= min_len:
                hit = next((t for t in (0.0, 45.0, 90.0, 135.0, 180.0) if abs(th - t) < tol), None)
                if hit is not None: T[(ri, i)] = hit % 180.0; continue
            if L >= long_len: free.append((th, L, ri, i))
    free.sort()
    grp = []
    for e in free:
        if grp and e[0] - grp[-1][-1][0] < ctol: grp[-1].append(e)
        else: grp.append([e])
    for g in grp:
        m = sum(e[0] * e[1] for e in g) / sum(e[1] for e in g)
        for e in g: T[(e[2], e[3])] = m
    return T

def regularize(ring, ri, T, long_sharp=2.0, chamfer=1.55):
    pts = [tuple(p) for p in ring[:-1]]
    # 1) små affasninger (< 1,3 m) mellem to lange kanter → skarpt hjørne
    ch = True
    while ch and len(pts) > 4:
        ch = False; n = len(pts)
        for i in range(n):
            a, b = pts[i], pts[(i + 1) % n]; L = math.hypot(b[0] - a[0], b[1] - a[1])
            if L >= chamfer: continue
            p0, p3 = pts[i - 1], pts[(i + 2) % n]
            L0, L2 = math.hypot(a[0] - p0[0], a[1] - p0[1]), math.hypot(p3[0] - b[0], p3[1] - b[1])
            if L0 < long_sharp or L2 < long_sharp: continue
            d0 = ((a[0] - p0[0]) / L0, (a[1] - p0[1]) / L0); d2 = ((p3[0] - b[0]) / L2, (p3[1] - b[1]) / L2)
            q = line_isect(p0, d0, b, d2)
            if q and math.hypot(q[0] - a[0], q[1] - a[1]) < 3.2 and math.hypot(q[0] - b[0], q[1] - b[1]) < 3.2:
                pts[i] = q; del pts[(i + 1) % n]; ch = True; break
    n = len(pts); E = []
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]; dx, dz = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dz)
        E.append(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, L, (dx / L, dz / L) if L > 1e-9 else (1, 0)))
    return pts, E

def finish(ring, ri, T, G=2.5):
    pts, E = regularize(ring, ri, T)
    n = len(pts)
    def target_for(i):
        a, b = pts[i], pts[(i + 1) % n]; mx, mz = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2; L = math.hypot(b[0] - a[0], b[1] - a[1])
        if L < 3.0: return None
        best, bd = None, 1e9
        for (r2, j), th in T.items():
            if r2 != ri: continue
            aa, bb = RINGS[ri][j], RINGS[ri][j + 1]; d = math.hypot((aa[0] + bb[0]) / 2 - mx, (aa[1] + bb[1]) / 2 - mz)
            if d < bd: bd, best = d, th
        return best if bd < 0.45 * L + 4 else None
    rd = lambda v: round(v / G) * G
    lines = []          # (a, b, c, fixed?)  a·x + b·z = c
    for i in range(n):
        th = target_for(i); mx, mz = E[i][0], E[i][1]
        if th is None:
            dx, dz = E[i][3]; a, b = -dz, dx; lines.append((a, b, a * mx + b * mz, False)); continue
        if abs(th) < 1e-6 or abs(th - 180) < 1e-6: lines.append((0.0, 1.0, rd(mz), True))
        elif abs(th - 90) < 1e-6: lines.append((1.0, 0.0, rd(mx), True))
        elif abs(th - 45) < 1e-6: lines.append((-1.0, 1.0, rd(mz - mx), True))
        elif abs(th - 135) < 1e-6: lines.append((1.0, 1.0, rd(mz + mx), True))
        else:
            r = math.radians(th); a, b = -math.sin(r), math.cos(r); lines.append((a, b, round((a * mx + b * mz) / 0.05) * 0.05, True))
    out = []
    for i in range(n):
        v = pts[i]; l0, l1 = lines[i - 1], lines[i]
        det = l0[0] * l1[1] - l0[1] * l1[0]
        if abs(det) > 0.08 and (l0[3] or l1[3]):
            x = (l0[2] * l1[1] - l0[1] * l1[2]) / det; z = (l0[0] * l1[2] - l0[2] * l1[0]) / det
            if math.hypot(x - v[0], z - v[1]) < max(9.0, 0.45 * min(E[i - 1][2], E[i][2])): v = (x, z)
        out.append(v)
    res = []
    for v in out:
        if not res or math.hypot(v[0] - res[-1][0], v[1] - res[-1][1]) > 0.8: res.append(v)
    if len(res) > 1 and math.hypot(res[0][0] - res[-1][0], res[0][1] - res[-1][1]) <= 0.8: res.pop()
    ch = True
    while ch and len(res) > 3:
        ch = False
        for i in range(len(res)):
            a, b, c = res[i - 1], res[i], res[(i + 1) % len(res)]
            cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); L = math.hypot(c[0] - a[0], c[1] - a[1])
            if L > 1e-9 and abs(cr) / L < 0.25: del res[i]; ch = True; break
    return res + [res[0]]

if __name__ == '__main__':
    P = pickle.load(open(os.path.join(OUT, 'mm_poly_raw.pkl'), 'rb'))
    tol = float(sys.argv[1]) if len(sys.argv) > 1 else 2.5
    Ps = P.simplify(tol, preserve_topology=True)
    RINGS = [list(Ps.exterior.coords)] + [list(h.coords) for h in Ps.interiors]
    T = angle_targets(RINGS)
    done = [finish(r, ri, T) for ri, r in enumerate(RINGS)]
    ext, holes = done[0], done[1:]
    R = Polygon(ext, holes)
    print('gyldig', R.is_valid, 'areal', R.area / S / S, 'hjørner', len(ext) + sum(len(h) for h in holes))
    im = Image.open(os.path.join(HERE, '..', 'ref', 'minimap_user.webp')).convert('RGB'); d = ImageDraw.Draw(im)
    for ring in [ext] + holes:
        d.line(ring, fill=(255, 0, 255), width=2)
        for v in ring: d.ellipse((v[0] - 3, v[1] - 3, v[0] + 3, v[1] + 3), fill=(0, 140, 255))
    im.save(os.path.join(OUT, 'layout_trace.png'))
    to_m = lambda ring: [[round((x - CX) / S, 3), round((y - CY) / S, 3)] for x, y in ring]
    json.dump({'ext': to_m(ext), 'holes': [to_m(h) for h in holes]}, open(os.path.join(OUT, 'layout_trace.json'), 'w'))
