# ==========================================================================
# de_fattoria · fælles: materialer (CC0-teksturer fra Poly Haven), støj og hjælpere til polygon-geometri. Kører i Blender (bruger ikke shapely).
# ==========================================================================
import os, math, random
from bld.common import MATS
HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, 'cache', 'tex')

# materialets virkelige mål (m pr. teksturgentagelse)
SIZE = {'ft_roof': 1.5, 'ft_roof_old': 2.0, 'ft_rubble': 2.2, 'ft_stone': 2.4, 'ft_sand': 2.2, 'ft_ashlar': 2.0, 'ft_oldstone': 2.4, 'ft_marble': 2.0, 'ft_terra': 2.0, 'ft_brickf': 2.0,
        'ft_cobble': 2.0, 'ft_cobble2': 2.0, 'ft_gravel': 3.0, 'ft_soil': 3.0, 'ft_dirt': 3.0, 'ft_grass': 3.4, 'ft_lawn': 3.4, 'ft_vault': 1.6, 'ft_timber': 1.6, 'ft_floor': 1.8,
        'ft_beam': 1.6, 'ft_deck': 1.8, 'ft_black': 1.6, 'ft_fence': 1.8, 'ft_bark': 1.2, 'ft_rock': 2.0}
def define(defmat):
    for n, sz in SIZE.items():
        f = {'d': os.path.join(TEX, n + '_albedo.jpg'), 'n': os.path.join(TEX, n + '_normal.jpg'), 'a': os.path.join(TEX, n + '_orm.jpg')}
        if os.path.exists(f['d']): defmat(n, tex=n, size=sz, files=f, tint=(0.62, 0.56, 0.5) if n == 'ft_bark' else (1.6, 1.45, 1.3) if n == 'ft_brickf' else (1.75, 1.6, 1.35) if n in ('ft_gravel',) else (1.25, 1.2, 1.1) if n in ('ft_cobble', 'ft_cobble2') else (1, 1, 1))
    # pudsede facader i forskellige toscanske toner (samme tekstur, forskellig farve → ét sæt KTX2)
    for nm, tex, tint in (('ft_plaster_a', 'ft_plaster', (1.0, 0.93, 0.80)), ('ft_plaster_b', 'ft_plaster', (1.0, 0.97, 0.90)), ('ft_plaster_c', 'ft_plaster', (1.0, 0.84, 0.72)),
                          ('ft_plaster_d', 'ft_plaster', (0.98, 0.92, 0.80)), ('ft_ochre_a', 'ft_ochre', (1.0, 0.92, 0.78)), ('ft_ochre_b', 'ft_ochre', (1.0, 0.84, 0.66))):
        f = {'d': os.path.join(TEX, tex + '_albedo.jpg'), 'n': os.path.join(TEX, tex + '_normal.jpg'), 'a': os.path.join(TEX, tex + '_orm.jpg')}
        if os.path.exists(f['d']): defmat(nm, tex=tex, size=3.0, files=f, tint=tint)
    for nm in ('ft_vinefield',):
        f = {'d': os.path.join(TEX, nm + '_albedo.jpg'), 'n': os.path.join(TEX, nm + '_normal.jpg'), 'a': os.path.join(TEX, nm + '_orm.jpg')}
        if os.path.exists(f['d']): defmat(nm, tex=nm, size=14.0, files=f)
    for nm, tint in (('ft_hedge', (1, 1, 1)),):
        f = {'d': os.path.join(TEX, 'ft_hedge_albedo.jpg'), 'n': os.path.join(TEX, 'ft_hedge_normal.jpg'), 'a': os.path.join(TEX, 'ft_hedge_orm.jpg')}
        if os.path.exists(f['d']): defmat(nm, tex='ft_hedge', size=1.6, files=f)
    for n in ('fol_cypress', 'fol_olive', 'fol_vine', 'fol_pine', 'fol_lemon', 'fol_shrub', 'fol_grass', 'fol_lavender', 'fol_oleander', 'fol_ivy', 'fol_rose'):
        fp = os.path.join(TEX, n + '_albedo.png')
        if os.path.exists(fp): defmat(n, tex=n, size=1.0, files={'d': fp, 'n': None, 'a': None}, rough=0.85); MATS[n].update(alpha=True, nrm=False, arm=False)
    defmat('ft_iron', color=(0.04, 0.04, 0.045), rough=0.5, metal=0.9)                       # smedejern
    defmat('ft_brass', color=(0.62, 0.46, 0.2), rough=0.4, metal=0.9)
    defmat('ft_water', color=(0.04, 0.12, 0.13), rough=0.05, kind='water'); MATS['ft_water']['opacity'] = 0.8
    defmat('water', color=(0.04, 0.12, 0.13), rough=0.05, kind='water'); MATS['water']['opacity'] = 0.8
    defmat('ft_marble_w', color=(0.82, 0.8, 0.76), rough=0.3)                                 # fontænens hvide marmor
    defmat('ft_cypress_trunk', color=(0.22, 0.15, 0.1), rough=1.0)
    defmat('ft_shutter', color=(0.17, 0.3, 0.2), rough=0.8)                                  # grønne træskodder
    defmat('ft_shutter_b', color=(0.28, 0.2, 0.12), rough=0.8)
    defmat('ft_door', color=(0.2, 0.12, 0.07), rough=0.75)
    defmat('ft_wine', color=(0.12, 0.2, 0.1), rough=0.1, kind='glass')                        # flasker (mørkt grønt glas)
    defmat('ft_pane', color=(0.022, 0.026, 0.034), rough=0.08)
    defmat('ft_glass', color=(0.7, 0.8, 0.85), rough=0.03, kind='glass')
    defmat('ft_curtain', color=(0.7, 0.6, 0.45), rough=0.95)
    defmat('ft_soil_dark', color=(0.16, 0.11, 0.07), rough=1.0)
    defmat('ft_flower_r', color=(0.8, 0.12, 0.1), rough=0.8); defmat('ft_flower_y', color=(0.9, 0.75, 0.15), rough=0.8)
    for i, c in enumerate(((0.35, 0.1, 0.08), (0.12, 0.22, 0.14), (0.2, 0.16, 0.12), (0.45, 0.35, 0.18), (0.1, 0.14, 0.26), (0.38, 0.22, 0.1))): defmat('ft_book%d' % i, color=c, rough=0.8)
    defmat('ft_straw', color=(0.72, 0.6, 0.28), rough=0.95)

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
    """(snavs, mos/ukrudt, vådt) pr. hjørne: støv ved fødderne af mure, mos i fugtige hjørner, pletter af slid på gulve"""
    x, y, z = p
    n = vnoise(x * 0.37, z * 0.37, y * 0.5) * 0.6 + vnoise(x * 1.6, z * 1.6, y * 1.8) * 0.4
    if up > 0.6: dirt = min(1.0, 0.15 + n * 0.55); moss = max(0.0, n - 0.62) * 1.1; wet = 0.0
    else:
        low = max(0.0, 1.0 - y / 3.0); dirt = min(1.0, 0.1 + low * 0.5 + n * 0.3); moss = max(0.0, n * 0.9 - 0.45 + low * 0.3) * 0.5; wet = 0.0
    return (dirt, moss, wet, 1.0)
