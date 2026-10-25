# ==========================================================================
# de_fattoria · terræn: gulvstykker (1,5 m felter med snavs/mos pr. hjørne), overgangslister, øernes toppe (terrasser, haver, tage)
# ==========================================================================
import math
from ft_geo import *
from ft_common import blend_at

def ground(D, M):
    for g in D['ground']:
        pts = [(x, g['y'], z) for x, z in g['ring']]
        M.poly(pts, g['m'], col=[blend_at(p, 1.0) for p in pts], want=(0, 1, 0))

def thresholds(D, T):
    for (a0, a1, b0, b1) in D['thresholds']:
        L = math.hypot(b0 - a0, b1 - a1)
        if L < 0.3: continue
        u = ((b0 - a0) / L, (b1 - a1) / L); n = (-u[1], u[0])
        pts = [(a0 - n[0] * 0.12, 0.025, a1 - n[1] * 0.12), (b0 - n[0] * 0.12, 0.025, b1 - n[1] * 0.12), (b0 + n[0] * 0.12, 0.025, b1 + n[1] * 0.12), (a0 + n[0] * 0.12, 0.025, a1 + n[1] * 0.12)]
        T.poly(pts, 'ft_ashlar', uv=[(p[0] / 2, p[2] / 2) for p in pts], want=(0, 1, 0))

TOPMAT = {'terrace': 'ft_soil', 'hedge': 'ft_lawn', 'fienile': 'ft_roof_old', 'casa': 'ft_roof_old', 'casetta': 'ft_roof_old', 'villa': 'ft_roof_old'}
def fills(D, M):
    """øernes indre set ovenfra: terrasse (jord med vinrækker/oliven), have (græs) eller fladt tag – ingen huller ned til kulissen"""
    for f in D['fills']:
        pts = [(x, f['y'], z) for x, z in f['ring']]
        M.poly(pts, TOPMAT.get(f['style'], 'ft_soil'), col=[(0.4, 0.2, 0.0, 1.0)] * len(pts), want=(0, 1, 0))
