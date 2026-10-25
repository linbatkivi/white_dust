# ==========================================================================
# de_fattoria · de taktiske genstande (brønd, fontæne, vogne, kasser, lave mure, piller, tønder, presse, trug, plantekasser, bænke, parasolfyr): udseende med præcis samme mål som kollisionen.
#   Alle er opbygget så synligt volumen ≥ kollisionsvolumen (ingen usynlige hitbokse) og intet svæver (alt står på y = 0).
# ==========================================================================
import math, random
import ft_plants, ft_models
from ft_geo import *

def _poly12(cx, cz, r, y0, y1, M, mat, caps='tb', r1=None):
    """12-kantet søjle med samme hjørner som kollisionen (circle_poly 12) – radius r er omkredsradius, så synlig ≥ kollision"""
    cyl(M, cx, cz, r, y0, y1, mat, n=12, caps=caps, r1=r1)

def well(S, it, rnd):
    T, W = S['trim'], S['walls']; x, z, r, h = it['x'], it['z'], it['r'], it['h']
    _poly12(x, z, r, 0.0, h - 0.12, W, 'ft_ashlar'); _poly12(x, z, r + 0.05, h - 0.12, h, T, 'ft_sand')
    _poly12(x, z, r - 0.22, h - 0.1, h - 0.1, T, 'ft_soil_dark', caps='t') if False else None
    ring = [(x + math.cos(2 * math.pi * k / 12) * (r - 0.25), h - 0.115, z + math.sin(2 * math.pi * k / 12) * (r - 0.25)) for k in range(12)]
    T.poly(ring, 'ft_water', uv=[(p[0] / 3, p[2] / 3) for p in ring], want=(0, 1, 0))
    for sx in (-1, 1):                                                                # to jernstolper + bjælke + lille tegltag (over hovedhøjde)
        T.box(x + sx * (r - 0.3) - 0.06, h, z - 0.06, x + sx * (r - 0.3) + 0.06, 2.55, z + 0.06, 'ft_timber', faces='nsewt')
    T.box(x - r + 0.2, 2.5, z - 0.09, x + r - 0.2, 2.64, z + 0.09, 'ft_beam', faces='nsewtb')
    F = S['far']; sz = tsz('ft_roof'); a, b = (x - r - 0.2, z - 0.85), (x + r + 0.2, z + 0.85)
    for sg in (-1, 1):
        zz = z + sg * 0.85; F.poly([(a[0], 2.55, zz), (b[0], 2.55, zz), (b[0], 2.95, z), (a[0], 2.95, z)] if sg > 0 else [(b[0], 2.55, zz), (a[0], 2.55, zz), (a[0], 2.95, z), (b[0], 2.95, z)], 'ft_roof', uv=[(0, 0), (2, 0), (2, 1), (0, 1)], want=(0, 1, sg))
    T.box(x - 0.04, 2.1, z - 0.04, x + 0.04, 2.5, z + 0.04, 'ft_iron')                # kæde + spand
    ft_models.place('wooden_bucket_01', x + 0.0, 2.0 - 0.0, z, rnd.uniform(0, 360), 0.8) if False else None

def fountain(S, it, rnd):
    T, W, WM = S['trim'], S['walls'], S['water']; x, z, r, h = it['x'], it['z'], it['r'], it['h']
    _poly12(x, z, r, 0.0, h - 0.1, W, 'ft_marble_w'); _poly12(x, z, r + 0.07, h - 0.1, h, T, 'ft_marble_w')
    ring = [(x + math.cos(2 * math.pi * k / 12) * (r - 0.38), h - 0.22, z + math.sin(2 * math.pi * k / 12) * (r - 0.38)) for k in range(12)]
    WM.poly(ring, 'ft_water', uv=[(p[0] / 3, p[2] / 3) for p in ring], want=(0, 1, 0))
    _poly12(x, z, r - 0.37, h - 0.22, h - 0.09, T, 'ft_marble_w', caps='b') if False else None
    cyl(T, x, z, 0.5, 0.0, 1.35, 'ft_marble_w', n=10, caps='tb', r1=0.42)                                         # søjlen (kollision r = 0,5 → 2,8 m høj)
    cyl(T, x, z, 0.5, 1.35, 2.8, 'ft_marble_w', n=10, caps='tb', r1=0.2)
    cyl(T, x, z, 1.15, 1.45, 1.6, 'ft_marble_w', n=12, caps='tb', r1=1.15)                                        # skål (over hovedhøjde ved basinets kant)
    cyl(T, x, z, 1.15, 1.6, 1.62, 'ft_water', n=12, caps='t') if False else None
    cyl(T, x, z, 0.45, 2.0, 2.15, 'ft_marble_w', n=10, caps='tb', r1=0.7); cyl(T, x, z, 0.14, 2.8, 3.1, 'ft_marble_w', n=8, caps='tb', r1=0.03)
    for k in range(4):                                                                                             # fire små vandstråler (lysende udstrålere i spillet via lyd/partikler)
        a = k * math.pi / 2; T.box(x + math.cos(a) * 0.55 - 0.03, 1.6, z + math.sin(a) * 0.55 - 0.03, x + math.cos(a) * 0.55 + 0.03, 1.85, z + math.sin(a) * 0.55 + 0.03, 'ft_marble_w')

def cart(S, it, rnd):
    T = S['trim']; x, z, yaw, L, Wd, h = it['x'], it['z'], it['yaw'], it['L'], it['W'], it['h']
    fr = Fr((x - math.cos(yaw) * L / 2 + math.sin(yaw) * Wd / 2, z - math.sin(yaw) * L / 2 - math.cos(yaw) * Wd / 2), (math.cos(yaw), math.sin(yaw)), (-math.sin(yaw), math.cos(yaw)))
    # fylder hele kollisionsvolumenet: bund (planker) + sider + last (halm/fade) – hjul på ydersiden (≤ 0,1 m)
    obox(T, fr, 0, L, 0, Wd, 0.0, 0.5, 'ft_beam', faces='fkltr')
    obox(T, fr, 0, L, 0, Wd, 0.5, h - 0.35, 'ft_fence', faces='fkltrd')
    obox(T, fr, 0.04, L - 0.04, 0.04, Wd - 0.04, h - 0.35, h, 'ft_straw', faces='fkltr')
    obox(T, fr, 0.04, L - 0.04, 0.04, Wd - 0.04, h, h + 0.002, 'ft_straw', faces='t')
    for a in (L * 0.25, L * 0.75):
        for w_ in (-0.06, Wd + 0.06):
            c = fr.W(a, w_); ax = (fr.n[0], fr.n[1])
            hcyl(T, (c[0] - ax[0] * 0.05, 0.55, c[1] - ax[1] * 0.05), (c[0] + ax[0] * 0.05, 0.55, c[1] + ax[1] * 0.05), 0.55, 'ft_beam', n=12, caps='ab')
    # (ingen dragstang: kun genstande der kan stødes ind i er modelleret – kollision = udseende)

def crates(S, it, rnd):
    T = S['trim']; x, z, yaw, L, Wd, h = it['x'], it['z'], it['yaw'], it['L'], it['W'], it['h']
    nx = max(1, round(L / 0.75)); nz = max(1, round(Wd / 0.75)); ny = max(1, round(h / 0.5)); mats = ['ft_beam', 'ft_fence', 'ft_timber']
    fr = Fr((x - math.cos(yaw) * L / 2 + math.sin(yaw) * Wd / 2, z - math.sin(yaw) * L / 2 - math.cos(yaw) * Wd / 2), (math.cos(yaw), math.sin(yaw)), (-math.sin(yaw), math.cos(yaw)))
    cw, cd, ch = L / nx, Wd / nz, h / ny
    for k in range(ny):
        for i in range(nx):
            for j in range(nz):
                g = 0.012; m = mats[rnd.randrange(len(mats))]
                obox(T, fr, i * cw + g, (i + 1) * cw - g, j * cd + g, (j + 1) * cd - g, k * ch + 0.004, (k + 1) * ch - 0.004, m, faces='fkltrd' if k == ny - 1 else 'fkltr')
                obox(T, fr, i * cw + g - 0.004, (i + 1) * cw - g + 0.004, j * cd + g - 0.004, (j + 1) * cd - g + 0.004, k * ch + ch * 0.4, k * ch + ch * 0.5, 'ft_iron', faces='fkltr')
    # (kassens ydermål = kollisionens mål; bundnet står på y = 0)

def lowwall(S, it, rnd):
    T, W = S['trim'], S['walls']; x, z, yaw, L, th, h = it['x'], it['z'], it['yaw'], it['L'], it['W'], it['h']
    fr = Fr((x - math.cos(yaw) * L / 2 + math.sin(yaw) * th / 2, z - math.sin(yaw) * L / 2 - math.cos(yaw) * th / 2), (math.cos(yaw), math.sin(yaw)), (-math.sin(yaw), math.cos(yaw)))
    with W.part():
        vquad(W, fr, 0, L, th, 0, h - 0.1, 'ft_rubble', 0.0); vquad(W, fr, 0, L, 0, 0, h - 0.1, 'ft_rubble', 0.0, back=True)
        W.poly([fr.P(0, 0, 0), fr.P(0, 0, h - 0.1), fr.P(0, th, h - 0.1), fr.P(0, th, 0)], 'ft_rubble', uv=[(0, 0), (0, 1), (1, 1), (1, 0)], want=(-fr.u[0], 0, -fr.u[1]))
        W.poly([fr.P(L, 0, 0), fr.P(L, th, 0), fr.P(L, th, h - 0.1), fr.P(L, 0, h - 0.1)], 'ft_rubble', uv=[(0, 0), (0, 1), (1, 1), (1, 0)], want=(fr.u[0], 0, fr.u[1]))
    obox(T, fr, -0.04, L + 0.04, -0.04, th + 0.04, h - 0.1, h, 'ft_ashlar', faces='fkltrd')

def pier(S, it, rnd):
    T, W = S['trim'], S['walls']; x, z, yaw, w, d, h = it['x'], it['z'], it['yaw'], it['L'], it['W'], it['h']
    fr = Fr((x - math.cos(yaw) * w / 2 + math.sin(yaw) * d / 2, z - math.sin(yaw) * w / 2 - math.cos(yaw) * d / 2), (math.cos(yaw), math.sin(yaw)), (-math.sin(yaw), math.cos(yaw)))
    obox(W, fr, 0, w, 0, d, 0.0, h - 0.0, 'ft_ashlar', faces='fkltr')
    obox(T, fr, -0.06, w + 0.06, -0.06, d + 0.06, 0.0, 0.34, 'ft_sand', faces='fkltrd'); obox(T, fr, -0.08, w + 0.08, -0.08, d + 0.08, h - 0.2, h, 'ft_sand', faces='fkltrd')
    if h > 3.0: obox(T, fr, 0.1, w - 0.1, 0.1, d - 0.1, h, h + 0.35, 'ft_roof_old', faces='fkltrd')                   # lille hat (kun dekor over hovedhøjde)

def barrel(S, it, rnd):
    r, h = it['r'], it['h']
    ft_models.place('wine_barrel_01', it['x'], 0.0, it['z'], rnd.uniform(0, 360), sx=(2 * r / 0.74), sy=(2 * r / 0.74), sz=(h / 0.87))

def tun(S, it, rnd):
    T = S['trim']; x, z, r, h = it['x'], it['z'], it['r'], it['h']
    cyl(S['walls'], x, z, r, 0.0, h, 'ft_beam', n=12, caps='')
    cyl(T, x, z, r, h, h + 0.04, 'ft_timber', n=12, caps='tb')
    for yy in (0.25, 0.9, 1.55, 2.1): cyl(T, x, z, r + 0.03, yy, yy + 0.1, 'ft_iron', n=12, caps='')
    T.box(x - 0.18, 0.55, z - r - 0.1, x + 0.18, 0.85, z - r, 'ft_brass', faces='nsewt') if False else None
    cyl(T, x, z, 0.12, h + 0.04, h + 0.12, 'ft_brass', n=8, caps='tb')                                                  # spunds (prop)

def press(S, it, rnd):
    T = S['trim']; x, z, yaw, L, Wd, h = it['x'], it['z'], it['yaw'], it['L'], it['W'], it['h']
    fr = Fr((x - math.cos(yaw) * L / 2 + math.sin(yaw) * Wd / 2, z - math.sin(yaw) * L / 2 - math.cos(yaw) * Wd / 2), (math.cos(yaw), math.sin(yaw)), (-math.sin(yaw), math.cos(yaw)))
    obox(T, fr, 0, L, 0, Wd, 0.0, h - 0.18, 'ft_beam', faces='fkltr'); obox(T, fr, 0, L, 0, Wd, h - 0.18, h, 'ft_timber', faces='fkltrd')
    for yy in (0.3, 0.8): obox(T, fr, -0.02, L + 0.02, -0.02, Wd + 0.02, yy, yy + 0.07, 'ft_iron', faces='fkltr')
    for a in (L * 0.18, L * 0.82): obox(T, fr, a - 0.11, a + 0.11, Wd / 2 - 0.11, Wd / 2 + 0.11, h, h + 1.2, 'ft_beam', faces='fkltrd')           # to søjler
    obox(T, fr, L * 0.18 - 0.15, L * 0.82 + 0.15, Wd / 2 - 0.13, Wd / 2 + 0.13, h + 1.2, h + 1.38, 'ft_beam', faces='fkltrd')
    c = fr.W(L / 2, Wd / 2); cyl(T, c[0], c[1], 0.07, h, h + 1.2, 'ft_iron', n=8, caps='tb'); cyl(T, c[0], c[1], 0.07, h + 0.9, h + 0.96, 'ft_iron', n=8, caps='tb')

def trough(S, it, rnd):
    T = S['trim']; x, z, yaw, L, Wd, h = it['x'], it['z'], it['yaw'], it['L'], it['W'], it['h']
    fr = Fr((x - math.cos(yaw) * L / 2 + math.sin(yaw) * Wd / 2, z - math.sin(yaw) * L / 2 - math.cos(yaw) * Wd / 2), (math.cos(yaw), math.sin(yaw)), (-math.sin(yaw), math.cos(yaw)))
    obox(S['walls'], fr, 0, L, 0, Wd, 0.0, h - 0.06, 'ft_ashlar', faces='fkltr'); obox(T, fr, -0.03, L + 0.03, -0.03, Wd + 0.03, h - 0.06, h, 'ft_sand', faces='fkltrd')
    obox(T, fr, 0.14, L - 0.14, 0.14, Wd - 0.14, h - 0.02, h - 0.015, 'ft_water', faces='t')

def planter(S, it, rnd):
    T = S['trim']; x, z, yaw, L, Wd, h = it['x'], it['z'], it['yaw'], it['L'], it['W'], it['h']
    fr = Fr((x - math.cos(yaw) * L / 2 + math.sin(yaw) * Wd / 2, z - math.sin(yaw) * L / 2 - math.cos(yaw) * Wd / 2), (math.cos(yaw), math.sin(yaw)), (-math.sin(yaw), math.cos(yaw)))
    obox(S['walls'], fr, 0, L, 0, Wd, 0.0, h - 0.05, 'ft_terra', faces='fkltr'); obox(T, fr, -0.02, L + 0.02, -0.02, Wd + 0.02, h - 0.05, h, 'ft_terra', faces='fkltrd')
    obox(T, fr, 0.06, L - 0.06, 0.06, Wd - 0.06, h - 0.012, h - 0.01, 'ft_soil_dark', faces='t')
    n = max(2, int(L / 0.6))
    for k in range(n):
        c = fr.W((k + 0.5) * L / n, Wd / 2); ft_plants.bush(S['fol'], c[0], c[1], h - 0.02, rnd, r=rnd.uniform(0.28, 0.38), mat=rnd.choice(['fol_lavender', 'fol_shrub', 'fol_rose']), n=8)

def bench(S, it, rnd):
    T = S['trim']; x, z, yaw, L, Wd, h = it['x'], it['z'], it['yaw'], it['L'], it['W'], it['h']
    fr = Fr((x - math.cos(yaw) * L / 2 + math.sin(yaw) * Wd / 2, z - math.sin(yaw) * L / 2 - math.cos(yaw) * Wd / 2), (math.cos(yaw), math.sin(yaw)), (-math.sin(yaw), math.cos(yaw)))
    obox(S['walls'], fr, 0, L, 0, Wd, 0.0, h - 0.07, 'ft_ashlar', faces='fkltr')                                       # massiv stenbænk (kollisionen er en kasse)
    obox(T, fr, -0.02, L + 0.02, -0.02, Wd + 0.02, h - 0.07, h, 'ft_timber', faces='fkltrd')

def tree(S, it, rnd):
    B, F = S['bark'], S['fol']; r = random.Random(it['seed'] * 977)
    sp = it['sp']; cyl(S['trim'], it['x'], it['z'], 0.4, 0.0, 0.42, 'ft_sand', n=8, caps='tb')                    # stenring om stammen (kollisionen er en 8-kant r = 0,36)
    if sp in ('plane', 'pine'): ft_plants.stone_pine(B, F, it['x'], it['z'], 0.0, r, h=it['Ht'], R=it['R'])
    elif sp == 'olive': ft_plants.olive(B, F, it['x'], it['z'], 0.0, r, h=it['Ht'], R=it['R'])
    else: ft_plants.cypress(B, F, it['x'], it['z'], 0.0, r, h=it['Ht'])

BUILD = dict(well=well, fountain=fountain, cart=cart, crates=crates, lowwall=lowwall, pier=pier, barrel=barrel, tun=tun, press=press, trough=trough, planter=planter, bench=bench, tree=tree)

def build(D, S):
    rnd = random.Random(5)
    for it in D['dress']:
        fn = BUILD.get(it['t'])
        if fn: fn(S, it, rnd)
        else: print('[props] ukendt type', it['t'])
