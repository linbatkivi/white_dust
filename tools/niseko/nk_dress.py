# ==========================================================================
# de_niseko · udsmykning på bestemte punkter (design JSON "dress" + "props"): træer, stenlanterner, torii, bænke, plantekasser, sten, tehus og de grønne felters rigtige udseende.
#   Alt der kan stødes ind i har kollision med samme mål (layout.py); fremspring er kun hængende/over hovedhøjde.
# ==========================================================================
import math, random
import nk_plants, nk_models, nk_arch
from nk_geo import *
from bld.common import MB, MATS

def trees(D, S):
    B, F = S['bark'], S['fol']
    for it in D['dress']:
        if it['t'] != 'tree': continue
        rnd = random.Random(it['seed'] * 977)
        fn = nk_plants.SPECIES[it['sp']]; fn(B, F, it['x'], it['z'], it.get('y', 0.0), rnd, h=it['h'], R=it['R'], clear=(2.2 if it.get('trunk') else 0.0))

def hexagon(M, cx, cz, r, y0, y1, mat, n=6, ang0=0.0, r1=None):
    cyl(M, cx, cz, r, y0, y1, mat, n=n, caps='tb', r1=r1)

def stonelantern(S, it):
    T = S['trim']; x, z = it['x'], it['z']
    box = lambda x0, y0, x1, y1, h: None
    cyl(T, x, z, 0.30, 0.0, 0.10, 'nk_stonebase', n=8, caps='tb')                                  # sokkel
    cyl(T, x, z, 0.12, 0.10, 0.80, 'nk_stonebase', n=8, caps='b')                                  # søjle
    cyl(T, x, z, 0.26, 0.80, 0.88, 'nk_stonebase', n=8, caps='tb', r1=0.30)                       # lysbord
    # ildkasse: otte-kantet, to åbne sider med lys
    with T.part():
        r = 0.20; yb, yt = 0.88, 1.26
        for k in range(8):
            a0 = 2 * math.pi * k / 8 + math.pi / 8; a1 = a0 + 2 * math.pi / 8; am = (a0 + a1) / 2
            m = 'nk_paper' if k in (0, 4) else 'nk_stonebase'
            pts = [(x + math.cos(a0) * r, yb, z + math.sin(a0) * r), (x + math.cos(a1) * r, yb, z + math.sin(a1) * r), (x + math.cos(a1) * r, yt, z + math.sin(a1) * r), (x + math.cos(a0) * r, yt, z + math.sin(a0) * r)]
            T.poly(pts, m, uv=[(0, 0), (1, 0), (1, 1), (0, 1)], want=(math.cos(am), 0, math.sin(am)))
    cyl(T, x, z, 0.34, 1.26, 1.30, 'nk_stonebase', n=8, caps='b', r1=0.40)                         # tagets underkant
    cyl(T, x, z, 0.42, 1.30, 1.50, 'nk_stonebase', n=8, caps='b', r1=0.12)                         # tag (kegle)
    cyl(T, x, z, 0.07, 1.50, 1.62, 'nk_stonebase', n=8, caps='tb', r1=0.09)
    cyl(T, x, z, 0.09, 1.62, 1.76, 'nk_stonebase', n=8, caps='tb', r1=0.01)                       # juvel
    nk_arch.LIGHTS.append(dict(x=x, y=1.07, z=z, n=(0, 1), kind='tourou', red=False))

def torii(S, it):
    T = S['trim']; xa, za, xb, zb, h = it['xa'], it['za'], it['xb'], it['zb'], it['h']
    L = math.hypot(xb - xa, zb - za); u = ((xb - xa) / L, (zb - za) / L); n = (-u[1], u[0]); fr = Fr((xa, za), u, n)
    for (px, pz) in ((xa, za), (xb, zb)):
        cyl(T, px, pz, 0.3, 0.0, 0.3, 'nk_black_lac', n=12, caps='tb')                              # stenbase
        cyl(T, px, pz, 0.27, 0.3, h, 'nk_vermilion', n=12, caps='t', r1=0.23)                       # søjle (let tilspidset)
    yn = 3.0
    obox(T, fr, -0.35, L + 0.35, -0.12, 0.12, yn, yn + 0.26, 'nk_vermilion', faces='fkltrd')        # nuki
    obox(T, fr, L / 2 - 0.2, L / 2 + 0.2, -0.07, 0.07, yn + 0.26, h - 0.28, 'nk_black_lac', faces='fkltr')     # plade
    # kasagi (øverste bjælke) – let opadbuet i enderne
    segs = 6; ext = 0.8
    for k in range(segs):
        a0 = -ext + (L + 2 * ext) * k / segs; a1 = -ext + (L + 2 * ext) * (k + 1) / segs
        def yk(a): t = (a - L / 2) / (L / 2 + ext); return h - 0.28 + 0.34 * abs(t) ** 2.4
        ya, yb = yk(a0), yk(a1)
        T.poly([fr.P(a0, 0.2, ya), fr.P(a1, 0.2, yb), fr.P(a1, 0.2, yb + 0.3), fr.P(a0, 0.2, ya + 0.3)], 'nk_black_lac', uv=[(0, 0), (1, 0), (1, 1), (0, 1)], want=(n[0], 0, n[1]))
        T.poly([fr.P(a0, -0.2, ya), fr.P(a1, -0.2, yb), fr.P(a1, -0.2, yb + 0.3), fr.P(a0, -0.2, ya + 0.3)], 'nk_black_lac', uv=[(0, 0), (1, 0), (1, 1), (0, 1)], want=(-n[0], 0, -n[1]))
        T.poly([fr.P(a0, -0.2, ya + 0.3), fr.P(a1, -0.2, yb + 0.3), fr.P(a1, 0.2, yb + 0.3), fr.P(a0, 0.2, ya + 0.3)], 'nk_black_lac', uv=[(0, 0), (1, 0), (1, 1), (0, 1)], want=(0, 1, 0))
        T.poly([fr.P(a0, -0.2, ya), fr.P(a1, -0.2, yb), fr.P(a1, 0.2, yb), fr.P(a0, 0.2, ya)], 'nk_vermilion', uv=[(0, 0), (1, 0), (1, 1), (0, 1)], want=(0, -1, 0))
    for sgn in (-1, 1):
        a = -ext if sgn < 0 else L + ext; ya = h - 0.28 + 0.34
        T.poly([fr.P(a, -0.2, ya), fr.P(a, 0.2, ya), fr.P(a, 0.2, ya + 0.3), fr.P(a, -0.2, ya + 0.3)], 'nk_vermilion', uv=[(0, 0), (1, 0), (1, 1), (0, 1)], want=(sgn * u[0], 0, sgn * u[1]))

def bench(S, it):
    """bænk med massiv bund (samme udstrækning som kollisionen): stenfod + bræddesæde med lille udhæng"""
    T = S['trim']; c, sn = math.cos(it['yaw']), math.sin(it['yaw']); u = (c, sn); n = (-sn, c); L, Wd, h = it['L'], it['W'], it['h']
    fr = Fr((it['x'] - u[0] * L / 2 - n[0] * Wd / 2, it['z'] - u[1] * L / 2 - n[1] * Wd / 2), u, n)
    obox(T, fr, 0.0, L, 0.0, Wd, 0.0, h - 0.07, 'nk_stonebase', faces='fkltr')
    for k in range(3): obox(T, fr, 0.0, L, k * Wd / 3 + 0.004, (k + 1) * Wd / 3 - 0.004, h - 0.07, h, 'nk_hinoki', faces='fkltr')

def planter(S, it, rnd):
    T, F = S['trim'], S['fol']; c, sn = math.cos(it['yaw']), math.sin(it['yaw']); u = (c, sn); n = (-sn, c); L, Wd, h = it['L'], it['W'], it['h']
    fr = Fr((it['x'] - u[0] * L / 2 - n[0] * Wd / 2, it['z'] - u[1] * L / 2 - n[1] * Wd / 2), u, n)
    obox(T, fr, 0, L, 0, Wd, 0.0, h - 0.06, 'nk_beam', faces='fkltr'); obox(T, fr, -0.02, L + 0.02, -0.02, Wd + 0.02, h - 0.08, h - 0.04, 'nk_black_lac', faces='fkltr')
    T.poly([fr.P(0.04, 0.04, h - 0.04), fr.P(L - 0.04, 0.04, h - 0.04), fr.P(L - 0.04, Wd - 0.04, h - 0.04), fr.P(0.04, Wd - 0.04, h - 0.04)], 'nk_soil', uv=[(0, 0), (1, 0), (1, 1), (0, 1)], want=(0, 1, 0))
    nb = max(2, int(L / 0.7))
    for k in range(nb):
        a = (k + 0.5) * L / nb; x, z = fr.W(a, Wd / 2)
        nk_plants.bush(F, x, z, h - 0.04, rnd, r=rnd.uniform(0.42, 0.52), mat=it.get('mat', 'fol_azalea'), n=11)

def rock(S, it):
    r = nk_models.place(it['m'], it['x'], 0.0, it['z'], it['yaw'], it['s'])

def teatable(S, it):
    nk_models.place('chinese_tea_table', it['x'], 0.0, it['z'], it['yaw'], 1.0)
    nk_models.place('tea_set_01', it['x'], 0.5, it['z'], it['yaw'], 0.9)
def stool(S, it): nk_models.place('wooden_stool_01', it['x'], 0.0, it['z'], it['yaw'], 1.0)
def teapost(S, it):
    T = S['trim']; cyl(T, it['x'], it['z'], 0.15, 0.0, it['h'], 'nk_timber', n=8, caps='tb')

BUILD = {'stonelantern': stonelantern, 'torii': torii, 'bench': bench, 'rock': rock, 'teatable': teatable, 'stool': stool, 'teapost': teapost}

def dress(D, S):
    rnd = random.Random(7)
    for i, it in enumerate(D['dress']):
        t = it['t']
        if t == 'planter': planter(S, it, random.Random(100 + i))
        elif t in BUILD: BUILD[t](S, it)

def strings(D, S):
    """lanternesnore på tværs af gader: tov (catenary-agtig) + små papirlanterner, mindst 3,2 m over gulvet"""
    T = S['trim']; rnd = random.Random(5)
    for st in D['strings']:
        (ax, az), (bx, bz), y = st['a'], st['b'], st['y']; L = math.hypot(bx - ax, bz - az); n = max(4, int(L / 0.62)); sag = min(0.45, 0.07 * L)
        P = [(ax + (bx - ax) * i / n, y - 4 * sag * (i / n) * (1 - i / n), az + (bz - az) * i / n) for i in range(n + 1)]
        for i in range(n): hcyl(T, P[i], P[i + 1], 0.012, 'nk_rope', n=5, caps='', uvscale=0.3)
        for (px, pz, nn) in ((ax, az, st['na']), (bx, bz, st['nb'])): T.box(px - 0.03 - abs(nn[0]) * 0.0, y - 0.04, pz - 0.03, px + 0.03, y + 0.04, pz + 0.03, 'nk_iron', faces='nsewt')
        for i in range(1, n):
            p = P[i]; m = 'nk_paper_red' if (i % 3 == 1) else 'nk_paper'
            hcyl(T, p, (p[0], p[1] - 0.1, p[2]), 0.006, 'nk_rope', n=4, caps='', uvscale=0.2)
            lantern_mesh(T, None, p[0], p[1] - 0.25, p[2], r=0.12, h=0.3, mat=m, n=8)
        for t in (0.35, 0.68):
            i = int(n * t); p = P[i]; nk_arch.LIGHTS.append(dict(x=round(p[0], 2), y=round(p[1] - 0.25, 2), z=round(p[2], 2), n=(0, 1), kind='chochin', red=False, string=True))

def build(D, S):
    trees(D, S); dress(D, S); strings(D, S)
