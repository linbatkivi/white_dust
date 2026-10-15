# kameraer til foto-turen: det mest åbne punkt i udvalgte rum, kig langs rummets længste retning → JSON til __wd.tour
import json, sys, math, numpy as np
from scipy.ndimage import distance_transform_edt as edt
H_ = 'tools/bureau/gen/data/'
M = json.load(open(H_ + 'map.json')); R = np.load(H_ + 'raster.npz'); Z = R['zid']; FY = R['fy']
D = json.load(open('tools/bureau/out/bureau.json')); S, CX, CY = M['S'], M['CX'], M['CY']; N = [z['name'] for z in M['zones']]
free = Z >= 0
for p in D['props']:
    if 'c' in p:
        x, y, z, sx, sy, sz = p['c']; j0, j1 = int((x - sx / 2) / S + CX) - 4, int((x + sx / 2) / S + CX) + 4; i0, i1 = int((z - sz / 2) / S + CY) - 4, int((z + sz / 2) / S + CY) + 4
        free[max(0, i0):i1, max(0, j0):j1] = False
dist = edt(free); out = []
for r in sys.argv[1].split(','):
    zi = N.index(r); d = np.where((Z == zi) & free, dist, 0); i, j = np.unravel_index(np.argmax(d), d.shape)
    ii, jj = np.nonzero(Z == zi); ax = (jj.max() - jj.min()) >= (ii.max() - ii.min())
    # kig mod den fjerneste ende af rummet
    if ax: yaw = math.pi / 2 if j > (jj.min() + jj.max()) / 2 else -math.pi / 2
    else: yaw = 0.0 if i > (ii.min() + ii.max()) / 2 else math.pi
    out.append(dict(n=r, x=round((j - CX) * S, 2), y=round(float(FY[i, j]) + 1.65, 2), z=round((i - CY) * S, 2), yaw=yaw, pitch=0.04))
print(json.dumps(out, ensure_ascii=False))
