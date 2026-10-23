# ==========================================================================
# de_niseko · fælles: materialer (CC0-teksturer fra Poly Haven), hjælpere til polygon-geometri og støj
#   (importeres af build.py; kører i Blender – bruger ikke shapely)
# ==========================================================================
import os, math, random
from mathutils import Vector
from bld.common import MATS
HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, 'cache', 'tex')

SIZE = {'nk_roof2': 2.0, 'nk_timber': 1.6, 'nk_cedar': 1.6, 'nk_hinoki': 1.6, 'nk_stonebase': 2.0, 'nk_street': 2.2, 'nk_mosscob': 2.2, 'nk_deck': 1.8, 'nk_bank': 2.0, 'nk_bamboo': 1.6,
        'nk_fence': 1.8, 'nk_riverbed': 2.4, 'nk_bark': 1.2, 'nk_beam': 1.6, 'nk_floor': 1.8, 'nk_black': 1.6, 'nk_raked': 2.0}          # kun materialer der bruges (ubrugte teksturer fylder 15+ MB)
def define(defmat):
    for n, sz in SIZE.items():
        f = {'d': os.path.join(TEX, n + '_albedo.jpg'), 'n': os.path.join(TEX, n + '_normal.jpg'), 'a': os.path.join(TEX, n + '_orm.jpg')}
        if os.path.exists(f['d']): defmat(n, tex=n, size=sz, files=f)
    for nm, tint in (('nk_plaster_w', (1.0, 0.98, 0.94)), ('nk_plaster_o', (0.96, 0.86, 0.7)), ('nk_plaster_g', (0.84, 0.88, 0.82))):
        f = {'d': os.path.join(TEX, 'nk_lime_albedo.jpg'), 'n': os.path.join(TEX, 'nk_lime_normal.jpg'), 'a': os.path.join(TEX, 'nk_lime_orm.jpg')}
        defmat(nm, tex='nk_lime', size=2.4, files=f, tint=tint)
    f = {'d': os.path.join(TEX, 'nk_hedge_albedo.jpg'), 'n': os.path.join(TEX, 'nk_hedge_normal.jpg'), 'a': os.path.join(TEX, 'nk_hedge_orm.jpg')}
    if os.path.exists(f['d']): defmat('nk_hedge', tex='nk_hedge', size=1.6, files=f)
    for n in ('fol_sakura', 'fol_willow', 'fol_maple', 'fol_pine', 'fol_bush', 'fol_azalea', 'fol_azalea_w', 'fol_bamboo', 'fol_grass', 'fol_wisteria'):
        fp = os.path.join(TEX, n + '_albedo.png')
        if os.path.exists(fp): defmat(n, tex=n, size=1.0, files={'d': fp, 'n': None, 'a': None}, rough=0.85); MATS[n].update(alpha=True, nrm=False, arm=False)
    # farvede/glødende materialer uden tekstur
    defmat('nk_paper', color=(0.95, 0.72, 0.4), rough=0.9, emit=(1.0, 0.62, 0.26, 7.0))                  # papirlanterne (varm glød)
    defmat('nk_paper_red', color=(0.8, 0.1, 0.06), rough=0.9, emit=(1.0, 0.18, 0.08, 5.0))
    defmat('nk_shoji', color=(0.9, 0.84, 0.7), rough=0.95, emit=(1.0, 0.7, 0.36, 3.2))                    # lyse papirskærme med lys bag
    defmat('nk_shoji_off', color=(0.82, 0.78, 0.68), rough=0.95)
    defmat('nk_vermilion', color=(0.55, 0.07, 0.04), rough=0.5)                                          # lakrød (torii, helligdom)
    defmat('nk_cedar_d', tex='nk_cedar', size=1.6, files={'d': os.path.join(TEX, 'nk_cedar_albedo.jpg'), 'n': os.path.join(TEX, 'nk_cedar_normal.jpg'), 'a': os.path.join(TEX, 'nk_cedar_orm.jpg')}, tint=(0.62, 0.48, 0.34))
    defmat('nk_black_lac', color=(0.025, 0.022, 0.02), rough=0.35, metal=0.1)
    defmat('nk_noren', color=(0.06, 0.1, 0.22), rough=0.95); defmat('nk_noren2', color=(0.5, 0.45, 0.4), rough=0.95)
    defmat('nk_iron', color=(0.05, 0.05, 0.055), rough=0.45, metal=0.9)
    defmat('nk_roofcap', color=(0.06, 0.06, 0.065), rough=0.5)
    defmat('nk_rope', color=(0.36, 0.28, 0.16), rough=0.95)
    defmat('nk_soil', color=(0.1, 0.075, 0.05), rough=1.0)
    defmat('nk_lantern_stone', color=(0.34, 0.34, 0.32), rough=0.85)
    defmat('nk_koi', color=(0.9, 0.5, 0.2), rough=0.5)
    defmat('water', color=(0.010, 0.030, 0.034), rough=0.04, kind='water'); MATS['water']['opacity'] = 0.74

def rot(p, c, ang):
    ca, sa = math.cos(ang), math.sin(ang); x, z = p[0] - c[0], p[1] - c[1]
    return (c[0] + x * ca - z * sa, c[1] + x * sa + z * ca)
def hash2(a, b):
    n = (int(a * 73856093) ^ int(b * 19349663)) & 0xffffffff; n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return ((n ^ (n >> 16)) & 0xffff) / 65535.0
def vnoise(x, y, z=0.0):
    ix, iy, iz = math.floor(x), math.floor(y), math.floor(z); fx, fy, fz = x - ix, y - iy, z - iz
    fx, fy, fz = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy), fz * fz * (3 - 2 * fz)
    h = lambda a, b, c: hash2(a * 31 + c * 7, b * 17 + c * 13)
    l = lambda a, b, t: a + (b - a) * t
    return l(l(l(h(ix, iy, iz), h(ix + 1, iy, iz), fx), l(h(ix, iy + 1, iz), h(ix + 1, iy + 1, iz), fx), fy), l(l(h(ix, iy, iz + 1), h(ix + 1, iy, iz + 1), fx), l(h(ix, iy + 1, iz + 1), h(ix + 1, iy + 1, iz + 1), fx), fy), fz)
def blend_at(p, up):
    """(snavs, mos, vådt) pr. hjørne – mos i fugtige pletter og langs kanalen, støv/snavs ved fødderne"""
    x, y, z = p
    n = vnoise(x * 0.37, z * 0.37, y * 0.5) * 0.6 + vnoise(x * 1.6, z * 1.6, y * 1.8) * 0.4
    if up > 0.6:
        moss = min(1.0, max(0.0, (n - 0.45) * 2.2)) * 0.8; dirt = min(1.0, 0.2 + n * 0.5); wet = max(0.0, n - 0.6)
    else:
        low = max(0.0, 1.0 - y / 3.2)
        moss = min(1.0, max(0.0, n * 1.2 - 0.3 + low * 0.5)) * 0.8; dirt = min(1.0, 0.25 + low * 0.5 + n * 0.25); wet = max(0.0, low * 0.45 - 0.1) * n
    return (dirt, moss, wet, 1.0)
def polyarea(ring):
    a = 0.0
    for i in range(len(ring) - 1):
        a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    return a / 2.0
