# de_bureau · trappe-/rampekontrol: hver ende skal munde ud i gulv i samme højde over mindst 1,2 m bredde (ikke ind i en mur)
#   python3 tools/bureau/gen/stairqa.py   (bruges også af test/mapqa-lignende tjek)
import io, contextlib, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
with contextlib.redirect_stdout(io.StringIO()):
    import gen as G
import numpy as np
S = G.S; bad = 0
def end_width(t, side):
    x0, y0, x1, y1 = t['r']; want = t['ya'] if side == 'a' else t['yb']; best = 0
    for d in range(1, 6):                                                    # første 0,6 m uden for enden
        if t['axis'] == 'z':
            i = y0 - d if side == 'a' else y1 - 1 + d; cells = [(i, j) for j in range(x0, x1)]
        else:
            j = x0 - d if side == 'a' else x1 - 1 + d; cells = [(i, j) for i in range(y0, y1)]
        ok = [0 <= i < G.H and 0 <= j < G.W and G.WALK[i, j] and abs(G.F[i, j] - want) < 0.3 for i, j in cells]
        best = max(best, sum(ok) * S)
    return best
def side_exit(t, side):
    """udgang til siden de sidste 2,5 m før enden (L-sving): naboceller i samme højde som rampen dér"""
    x0, y0, x1, y1 = t['r']; n = 0; L = int(2.5 / S)
    rng = range(y0, min(y1, y0 + L)) if (side == 'a') == (t['axis'] == 'z') else range(max(y0, y1 - L), y1)
    if t['axis'] == 'x': rng = range(x0, min(x1, x0 + L)) if side == 'a' else range(max(x0, x1 - L), x1)
    for a in rng:
        for d in (1, 2, 3):
            for (i, j, ii, jj) in (((a, x0 - d, a, x0) if t['axis'] == 'z' else (y0 - d, a, y0, a)), ((a, x1 - 1 + d, a, x1 - 1) if t['axis'] == 'z' else (y1 - 1 + d, a, y1 - 1, a))):
                if 0 <= i < G.H and 0 <= j < G.W and G.WALK[i, j] and G.SLOPE[i, j] < 0 and abs(G.F[i, j] - G.FC[ii, jj]) < 0.45: n += 1; break
    return n * S / 3
for k, t in enumerate(G.TR):
    wa, wb = end_width(t, 'a'), end_width(t, 'b')
    if wa < 1.2: wa = max(wa, side_exit(t, 'a'))
    if wb < 1.2: wb = max(wb, side_exit(t, 'b'))
    lat = ((t['r'][2] - t['r'][0]) if t['axis'] == 'z' else (t['r'][3] - t['r'][1])) * S
    ok = wa >= min(1.2, lat * 0.5) and wb >= min(1.2, lat * 0.5)
    if not ok: bad += 1
    print('%s #%-2d %-6s %4.1f→%4.1f  bredde %.1f m · ende a %.1f m · ende b %.1f m' % ('ok  ' if ok else 'FEJL', k, t['kind'], t['ya'], t['yb'], lat, wa, wb))
print('ALT OK' if not bad else '%d trapper/ramper ender blindt' % bad); sys.exit(1 if bad else 0)
