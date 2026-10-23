#!/usr/bin/env python3
# ==========================================================================
# de_fattoria · layout (Chianti, Toscana · gyldne time) – scenen tegnes i kode som rektangler på et 0,5 m-gitter (højdefelt).
#   python3 tools/fattoria/gen/layout.py   →  shared/fattoria_data.js (kollision) + out/fattoria_design.json (Blender) + out/fattoria_layout.png (oversigt)
#
#   Metode: hele banen starter som MASSIV (jord/sten). Gangbare gulve skæres ud (carve), vægge/bygninger males ovenpå, dæk/lofter lægges som et
#   øvre lag (kælder under terrassen, haller, arkader). Det garanterer at ingen gulvkant ender i intet. Gitteret smeltes sammen til få, store bokse.
#   Akser: x øst, z syd (nord = −z), y op. T (hijackers) nederst på bakken i syd, CT (SWAT) bag villaen i nord. Spawn-yaw 0 = mod nord.
#   Højder: YT −3,0 piazzale/kælder · YM 0,0 vinmarkens top · YP 2,6 terrakotta-terrassen (dæk over kælderen) · YE 4,8 villaens grund · YB 0,0 kælderbalkon
# ==========================================================================
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); TOOL = os.path.dirname(HERE); ROOT = os.path.abspath(os.path.join(TOOL, '..', '..')); OUT = os.path.join(TOOL, 'out'); os.makedirs(OUT, exist_ok=True)

YT, YM, YP, YE, YB = -3.0, 0.0, 2.6, 4.8, 0.0
CEILC = YP - 0.4              # kælderens loft = undersiden af terrassens dæk
TOP = 14.0
HALL = 3.7                    # frihøjde i haller/arkader
HALLH = 6.8                   # hallens (dobbelte) loftshøjde
RES = 0.5
X0, X1, Z0, Z1 = -64.0, 64.0, -60.0, 60.0
NX, NZ = int(round((X1 - X0) / RES)), int(round((Z1 - Z0) / RES))
H = np.full((NZ, NX), TOP, np.float32)            # højde af jordsøjlens top (gulv for gange, væg-top for massiv)
K = np.zeros((NZ, NX), np.int8)                    # 1 = gangbar overflade
SURF = np.zeros((NZ, NX), np.int8)
STYLE = np.zeros((NZ, NX), np.int8)                # facade-/kantstil
UB = np.full((NZ, NX), np.nan, np.float32)         # øvre lag: underside (loft/dæk)
UT = np.full((NZ, NX), np.nan, np.float32)         # øvre lag: overside
UK = np.zeros((NZ, NX), np.int8)                   # 1 = overside er gangbar (terrasse), 0 = tag/loft
USURF = np.zeros((NZ, NX), np.int8)
BLDALL = np.zeros((NZ, NX), np.int16)             # bygnings-id for ALLE celler i husets rektangel (også udskårne rum)
BLD = np.zeros((NZ, NX), np.int16)               # bygnings-id (1…) for massive celler der er huse (facaden tegnes op til tagfoden)
BUILDINGS = []
SURFS = ['gravel', 'cobble', 'soil', 'terracotta', 'brickfloor', 'grass', 'marble', 'stone', 'wood', 'vineyard']
STYLES = ['earth', 'stone', 'plaster', 'brick', 'wood', 'hedge', 'ochre', 'marble', 'cellar']
SI = {n: i for i, n in enumerate(SURFS)}; WI = {n: i for i, n in enumerate(STYLES)}
def cx(x): return int(round((x - X0) / RES))
def cz(z): return int(round((z - Z0) / RES))

ramps = []; stairs = []; rails = []; props = []; cyls = []; dwalls = []; labels = []; sites = {}; spawns = {'hij': [], 'swat': []}; decor = []; doors = []; surf_of = {}

def carve(x0, z0, x1, z1, y, surf='cobble', edge='stone'):
    a, b, c, d = cz(z0), cz(z1), cx(x0), cx(x1); H[a:b, c:d] = y; K[a:b, c:d] = 1; SURF[a:b, c:d] = SI[surf]; STYLE[a:b, c:d] = WI[edge]
def mass(x0, z0, x1, z1, style='stone', top=TOP, surf=None, walk=False):
    a, b, c, d = cz(z0), cz(z1), cx(x0), cx(x1); H[a:b, c:d] = top; STYLE[a:b, c:d] = WI[style]; K[a:b, c:d] = 1 if walk else 0
    if surf: SURF[a:b, c:d] = SI[surf]
def wall(x0, z0, x1, z1, top, style='stone', cap='stone'):
    mass(x0, z0, x1, z1, style, top)
def cover(x0, z0, x1, z1, yb, yt, walk=False, surf='terracotta', style='stone'):
    a, b, c, d = cz(z0), cz(z1), cx(x0), cx(x1); UB[a:b, c:d] = yb; UT[a:b, c:d] = yt; UK[a:b, c:d] = 1 if walk else 0; USURF[a:b, c:d] = SI[surf]
def uncover(x0, z0, x1, z1):
    a, b, c, d = cz(z0), cz(z1), cx(x0), cx(x1); UB[a:b, c:d] = np.nan; UT[a:b, c:d] = np.nan; UK[a:b, c:d] = 0
def ramp(x0, z0, x1, z1, axis, ya, yb, surf='gravel', edge='stone'):
    ramps.append((x0, z0, x1, z1, axis, ya, yb, surf)); carve(x0, z0, x1, z1, min(ya, yb), surf, edge)
def stair(x0, z0, x1, z1, axis, ya, yb, n=None, style='stone', edge='stone'):
    n = n or max(3, int(round(abs(yb - ya) / 0.2))); stairs.append((x0, z0, x1, z1, axis, ya, yb, n, style)); carve(x0, z0, x1, z1, min(ya, yb), 'stone', edge)
def rail(x0, z0, x1, z1, base, h=1.1, style='vine'): rails.append((x0, z0, x1, z1, base, h, style))
def prop(x, z, w, d, h, y0, style='crate'): props.append((x, z, w, d, h, y0, style))
def cyl(x, z, r, y0, y1, style='barrel'): cyls.append((x, z, r, y0, y1, style))
def dwall(pts, y0, y1, style='stone'): dwalls.append((pts, y0, y1, style))
def deco(kind, **k): k['t'] = kind; decor.append(k)
def building(name, x0, z0, x1, z1, eave, roof='hip', mat='ft_plaster_a', rise=2.6, ridge='x', **k):
    """hus: markerer de massive celler i rektanglet; facaden tegnes op til tagfoden 'eave' (absolut y), taget bygges af ft_arch"""
    BUILDINGS.append(dict(name=name, rect=[x0, z0, x1, z1], eave=eave, roof=roof, mat=mat, rise=rise, ridge=ridge, **k)); i = len(BUILDINGS)
    a, b, c, d = cz(z0), cz(z1), cx(x0), cx(x1); BLDALL[a:b, c:d] = i; sub = BLD[a:b, c:d]; sub[(H[a:b, c:d] >= TOP - 0.01) & (K[a:b, c:d] == 0)] = i
    return i
def lab(n, x, z, y, surf=None):
    labels.append((n, x, z, y))
    if surf: surf_of[n] = surf

mass(X0, Z0, X1, Z1, 'earth', TOP)

# ============================================================================================================================ GULVE
# nord (CT) er −z, syd (T) er +z. Grænsen mellem terrasse og villaens grund ligger ved ZE.
ZE = -24.0
YC = -2.0                      # kælderens gulv
# ---------- T-piazzale (nederst) ----------
carve(-56, 30, 56, 46, YT, 'gravel')
# ---------- vinmarken (Mid) – skråning op mod terrassen ----------
ramp(-22, 6, 22, 30, 'z', YM, YT, 'vineyard')                  # ya (nord, z=6) = 0,0 · yb (syd, z=30) = −3,0
carve(-22, -4, 48, 6, YM, 'cobble')                             # toppen af vinmarken og Presseriets forgård
# ---------- vestvejen (Via Maestra) op til Hovedporten ----------
ramp(-34, -12, -24, 30, 'z', YE, YT, 'gravel')
carve(-40, -22, -24, -12, YE, 'cobble')
# ---------- hulvejen mod vest (Via Vecchia) op til stalden ----------
ramp(-54, -20, -46, 30, 'z', YE, YT, 'gravel', 'stone')
carve(-58, -34, -46, -20, YE, 'gravel')
# ---------- østvejen (Via del Frantoio) op til Presseriet ----------
ramp(36, 6, 46, 30, 'z', YM, YT, 'gravel')
# ---------- cypres-vejen helt mod øst (Viale dei Cipressi) op til haven ----------
ramp(50, ZE, 58, 30, 'z', YE, YT, 'gravel')
# ---------- porte mellem vinmark og veje (lille step 0,25 m) ----------
carve(-24, 25, -22, 29, -2.1, 'cobble')
# ---------- terrakotta-terrassen (gangbar dæk-overflade; over kælderen er det et dæk) ----------
mass(2, ZE, 46, -4, 'stone', YP, 'terracotta', True)
# ---------- villaens grund ----------
carve(-40, -60, 58, ZE, YE, 'cobble')
carve(-40, ZE, 2, -22, YE, 'cobble')                           # gårdspladsens sydlige bånd
carve(-34, -38, -8, ZE, YE, 'cobble')                          # gårdsplads B

# ============================================================================================================================ VILLAEN (ARKITEKTUR)
# nordfløjen (hovedhuset): massiv, med en gennemgående hal
mass(-40, -50, -6, -38, 'plaster', TOP)
carve(-26, -50, -20, -38, YE, 'marble', 'plaster'); cover(-26, -50, -20, -38, YE + HALLH, TOP, False)                    # Hallen – 6 m bred, dobbelt højde, gennemgående
# vestfløjen = stalde: massiv med indre rum
mass(-46, -42, -36, -18, 'ochre', TOP)
carve(-44, -36, -36, -24, YE, 'cobble', 'ochre'); cover(-44, -36, -36, -24, YE + HALL, TOP, False)                       # selve staldrummet
carve(-36, -34, -34, -26, YE, 'cobble', 'ochre'); cover(-36, -34, -34, -26, YE + HALL, TOP, False)                       # bred åbning mod gårdspladsen (stald-arkaden)
carve(-46, -32, -44, -28, YE, 'cobble', 'ochre'); cover(-46, -32, -44, -28, YE + HALL, TOP, False)                       # dør ud til hulvejen
# østfløjen = biblioteket
mass(-8, -38, 2, -20, 'plaster', TOP)
carve(-7, -37, 1, -21, YE, 'wood', 'plaster'); cover(-7, -37, 1, -21, YE + HALL, TOP, False)
carve(-8, -31, -7, -28, YE, 'wood', 'plaster'); cover(-8, -31, -7, -28, YE + HALL, TOP, False)                           # dør mod gårdspladsen
carve(1, -24, 2, -21, YE, 'wood', 'plaster'); cover(1, -24, 2, -21, YE + HALL, TOP, False)                               # dør mod terrassen (syd)
carve(1, -36, 2, -33, YE, 'wood', 'plaster'); cover(1, -36, 2, -33, YE + HALL, TOP, False)                               # dør mod CT's have (nord)
# sydmuren omkring gårdspladsen med Hovedporten
mass(-40, -23, -6, -22, 'stone', 9.0); carve(-35, -23, -29, -22, YE, 'cobble', 'stone')                                  # Hovedporten (6 m)
cover(-35, -23, -29, -22, YE + 3.4, 9.0, False)                                                                         # portbuens overligger
# arkade-ringen (overdækket søjlegang) rundt om gårdspladsen; nordarkadens tag er en gangbar altan (Terrazzino) – nås fra hallens trappe
cover(-34, -38, -8, -35.5, YE + 3.2, YE + 3.7, True, 'terracotta'); cover(-34, -24.5, -8, -23, YE + HALL, YE + HALL + 0.5, False)
cover(-34, -38, -31.5, -23, YE + HALL, YE + HALL + 0.5, False); cover(-10.5, -38, -8, -23, YE + HALL, YE + HALL + 0.5, False)
uncover(-35, -24.5, -29, -23)                                                                                          # åbent foran porten

# ============================================================================================================================ TERRASSEN & KÆLDEREN (A)
# kælderen: hal x 8..36, z −22..−6 (gulv YC). Dækket over den ER terrassens gulv.
carve(8, -22, 36, -6, YC, 'brickfloor', 'cellar'); cover(8, -22, 36, -6, CEILC, YP, True, 'terracotta')
# Kælderbalkonen (hævet langs nordvæggen)
carve(8, -22, 20, -18, YB, 'brickfloor', 'cellar')
# Presseriet: rampe ned i kælderens sydøstlige hjørne (under terrassen); forgården ligger ved z = −4
ramp(28, -14, 36, -4, 'z', YC, YM, 'brickfloor', 'cellar'); cover(28, -14, 36, -4, CEILC, YP, True, 'terracotta')           # ya (nord) = YC · yb (syd) = 0,0
# Pergola-trappen: går ned MOD NORD i et trappehus langs kælderens vestside (x 4..8); hullet i dækket er åbent for z ≥ −11
mass(3, -20, 9, -5, 'cellar', YP, 'terracotta', True)                                                                  # vestvæg + trappehus (massiv terrasse-gulv-top)
stair(4, -17, 8, -5, 'z', YC, YP, 28, 'stone', 'cellar')                                                               # ya (nord, z=−17) = YC · yb (syd, z=−5) = YP
carve(4, -21, 9, -17, YC, 'brickfloor', 'cellar'); cover(4, -21, 9, -17, CEILC, YP, True, 'terracotta')                # forrum ved trappens fod
mass(8, -17, 9, -5, 'cellar', CEILC); cover(8, -17, 9, -5, CEILC, YP, True, 'terracotta')                              # trappens østvæg
carve(8, -21, 9, -17, YC, 'brickfloor', 'cellar')                                                                      # åbning mod hallen (buegang)
mass(3, -17, 4, -5, 'stone', YP, 'terracotta', True); cover(4, -17, 8, -12, CEILC, YP, True, 'terracotta')                 # vestvæg + overdækket nederste del af trappen
# kælderstigen (Flaskelageret) fra CT's side: trappehus med dæk-gulv oven på; ned til balkonens vestende
stair(8, -36, 14, -26, 'z', YE, YB, 24, 'stone', 'cellar')
carve(8, -26, 14, -22, YB, 'brickfloor', 'cellar')
cover(8, -30, 14, -22, 4.4, YE, True, 'cobble')                                                                        # estate-gulvet fortsætter oven på trappehuset
mass(7, -36, 8, -30, 'stone', YE + 0.9); mass(14, -36, 15, -30, 'stone', YE + 0.9)                                      # balustrader langs den åbne del af trappen
# trappen ned fra balkonen til kældergulvet
stair(20, -22, 24, -18, 'x', YB, YC, 10, 'stone', 'cellar')
# kældervæggens knæk (skråt hjørne) – giver ikke-90°-vinkler
dwall([(9, -22), (13, -22), (9, -18)], YC, CEILC, 'cellar')
dwall([(36, -6), (32, -6), (36, -10)], YC, CEILC, 'cellar')

# ============================================================================================================================ FORBINDELSER (TRAPPER) TIL TERRASSEN
stair(4, -4, 9, 0, 'z', YP, YM, 13, 'stone', 'stone')           # Biblioteks-trappen / Pergola-trappen: fra vinmarkens top op på terrassens vestende
stair(18, -4, 24, 0, 'z', YP, YM, 13, 'stone', 'stone')         # Midt-trappen (bred) op mod bent-wall og terrassens midte
stair(2, -24, 6, -21, 'x', YE, YP, 11, 'stone', 'plaster')      # trappe fra bibliotekets sydøstdør ned på terrassen
stair(36, ZE - 4, 42, ZE, 'z', YE, YP, 11, 'stone', 'stone')    # CT's trappe fra haven ned på terrassen (øst)
stair(28, ZE - 4, 32, ZE, 'z', YE, YP, 11, 'stone', 'stone')    # CT's anden trappe (midt)


# trappen i hallen op til Terrazzinoen (stiger mod syd: ya ved z=−47 = gulv, yb ved z=−38 = altanens top)
stair(-26, -47, -23, -38, 'z', YE, YE + 3.7, 18, 'stone', 'plaster')
carve(-25.5, -38, -20, -37.5, YE + 3.7, 'terracotta', 'plaster')
# limonaiaen (orangeri) i østhaven
mass(38, -46, 50, -37, 'ochre', TOP); carve(39, -45, 49, -38, YE, 'terracotta', 'ochre'); cover(39, -45, 49, -38, YE + HALL, TOP, False)
carve(38, -42, 39, -40, YE, 'terracotta', 'ochre'); cover(38, -42, 39, -40, YE + HALL, TOP, False); carve(49, -43, 50, -41, YE, 'terracotta', 'ochre'); cover(49, -43, 50, -41, YE + HALL, TOP, False)
carve(43, -38, 45, -37, YE, 'terracotta', 'ochre'); cover(43, -38, 45, -37, YE + HALL, TOP, False)
print('layout: gulve og bygninger skåret')

# ============================================================================================================================ UDSMYKNING MED KOLLISION
exec(open(os.path.join(HERE, 'layout_props.py')).read()) if os.path.exists(os.path.join(HERE, 'layout_props.py')) else None

# ============================================================================================================================ OUTPUT
def merge_boxes(mask_fn):
    """grådig sammensmeltning af ens celler → rektangler (x0,z0,x1,z1,key)"""
    used = np.zeros((NZ, NX), bool); out = []
    for j in range(NZ):
        i = 0
        while i < NX:
            k = mask_fn(j, i)
            if k is None or used[j, i]: i += 1; continue
            i1 = i
            while i1 + 1 < NX and not used[j, i1 + 1] and mask_fn(j, i1 + 1) == k: i1 += 1
            j1 = j
            while j1 + 1 < NZ and all((not used[j1 + 1, q]) and mask_fn(j1 + 1, q) == k for q in range(i, i1 + 1)): j1 += 1
            used[j:j1 + 1, i:i1 + 1] = True; out.append((X0 + i * RES, Z0 + j * RES, X0 + (i1 + 1) * RES, Z0 + (j1 + 1) * RES, k)); i = i1 + 1
    return out


def octagon(x, z, r, n=8):
    rr = r / math.cos(math.pi / n)
    return [[round(x + rr * math.cos(2 * math.pi * (k + 0.5) / n), 3), round(z + rr * math.sin(2 * math.pi * (k + 0.5) / n), 3)] for k in range(n)]

def build_data():
    boxes = []; prisms = []
    for (x0, z0, x1, z1, k) in merge_boxes(lambda j, i: (round(float(H[j, i]), 3), int(K[j, i]))):
        h, walk = k
        boxes.append([round(x0, 2), round(z0, 2), round(x1, 2), round(z1, 2), -8.0, h, 'floor' if walk else 'wall'])
    for (x0, z0, x1, z1, k) in merge_boxes(lambda j, i: None if np.isnan(UB[j, i]) else (round(float(UB[j, i]), 3), round(float(UT[j, i]), 3), int(UK[j, i]))):
        yb, yt, walk = k
        boxes.append([round(x0, 2), round(z0, 2), round(x1, 2), round(z1, 2), yb, yt, 'floor' if walk else 'ceil'])
    for (x, z, w, d, h, y0, st) in props: boxes.append([round(x - w / 2, 2), round(z - d / 2, 2), round(x + w / 2, 2), round(z + d / 2, 2), y0, round(y0 + h, 2), 'prop'])
    for (x, z, r, y0, y1, st) in cyls:
        prisms.append([octagon(x, z, r), y0, y1, 'prop' if (y1 - y0) < 2.4 and st not in ('column', 'foudre', 'pier', 'fountain') else 'wall'])
    for (pts, y0, y1, st) in dwalls: prisms.append([[[round(a, 3), round(b, 3)] for a, b in pts], y0, y1, 'wall'])
    D = {'version': '3', 'grid': {'GX0': int(X0), 'GZ0': int(Z0), 'GW': int((X1 - X0) / 2) + 1, 'GH': int((Z1 - Z0) / 2) + 1}, 'boxes': boxes, 'prisms': prisms,
         'ramps': [[r[0], r[1], r[2], r[3], r[4], r[5], r[6]] for r in ramps], 'stairs': [[s_[0], s_[1], s_[2], s_[3], s_[4], s_[5], s_[6], s_[7]] for s_ in stairs],
         'rails': [[r[0], r[1], r[2], r[3], r[4], r[5]] for r in rails], 'cyls': [], 'doors': [], 'ladders': [],
         'labels': [[n, round(x, 2), round(z, 2), y] for (n, x, z, y) in labels], 'sites': {k: list(v) for k, v in sites.items()},
         'spawns': {k: [[round(p[0], 2), round(p[1], 2), round(p[2], 4), p[3]] for p in v] for k, v in spawns.items()},
         'levels': {'G': 0.0}, 'water': [], 'surf': surf_of, 'panes': []}
    return D

def write_data(D):
    txt = ('/* AUTOGENERERET af tools/fattoria/gen/layout.py – redigér ikke i hånden.\n   fattoria: toscansk vingård på en bakketop i den gyldne time. Kollision = højdefelt-bokse + skrå prismer. */\n'
           '(function (root) {\n  const D = ' + json.dumps(D, ensure_ascii=False, separators=(',', ':')) + ';\n'
           "  if (typeof module === 'object' && module.exports) module.exports = D; else root.WD_FATTORIA = D;\n})(typeof self !== 'undefined' ? self : this);\n")
    open(os.path.join(ROOT, 'shared', 'fattoria_data.js'), 'w').write(txt)
    print('[layout] bokse %d · prismer %d · ramper %d · trapper %d · gelændere %d · %.0f KB' % (len(D['boxes']), len(D['prisms']), len(D['ramps']), len(D['stairs']), len(D['rails']), len(txt) / 1e3))

def plot(D):
    Z = 8
    def P2(x, z): return ((x - X0) * Z, (z - Z0) * Z)
    img = Image.new('RGB', (int((X1 - X0) * Z), int((Z1 - Z0) * Z)), (24, 26, 30)); px = img.load()
    # højdefelt: farve efter højde (blå lav → gul høj); massive (ikke gangbare) mørkere
    lo, hi = -3.0, 5.0
    for j in range(NZ):
        for i in range(NX):
            h = float(H[j, i]); walk = K[j, i]
            if h >= TOP - 0.01 and not walk: continue
            t = min(1, max(0, (h - lo) / (hi - lo))); col = (int(60 + 190 * t), int(90 + 130 * t), int(150 - 90 * t)) if walk else (70, 62, 55)
            if not np.isnan(UB[j, i]): col = tuple(int(c * 0.78) for c in col) if UK[j, i] else (110, 60, 60)
            x0_, z0_ = P2(X0 + i * RES, Z0 + j * RES)
            for a in range(int(RES * Z)):
                for b in range(int(RES * Z)): px[int(x0_) + a, int(z0_) + b] = col
    dr = ImageDraw.Draw(img)
    for r in ramps: dr.rectangle([P2(r[0], r[1]), P2(r[2], r[3])], outline=(255, 255, 255), width=2)
    for s_ in stairs: dr.rectangle([P2(s_[0], s_[1]), P2(s_[2], s_[3])], outline=(255, 220, 90), width=2)
    for r in rails: dr.line([P2(r[0], r[1]), P2(r[2], r[3])], fill=(90, 220, 90), width=2)
    for (x, z, w, d, h, y0, st) in props: dr.rectangle([P2(x - w / 2, z - d / 2), P2(x + w / 2, z + d / 2)], fill=(210, 130, 60))
    for (x, z, r, y0, y1, st) in cyls: dr.ellipse([P2(x - r, z - r), P2(x + r, z + r)], fill=(200, 100, 200))
    for (pts, y0, y1, st) in dwalls: dr.polygon([P2(*q) for q in pts], fill=(255, 120, 60))
    for k, (a, b, c, d, y) in sites.items(): dr.rectangle([P2(a, b), P2(c, d)], outline=(255, 60, 60), width=3)
    for sp, col in ((spawns['hij'], (255, 190, 40)), (spawns['swat'], (80, 170, 255))):
        for q in sp: x, y = P2(q[0], q[1]); dr.ellipse((x - 6, y - 6, x + 6, y + 6), fill=col, outline=(0, 0, 0))
    try: fnt = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 15)
    except Exception: fnt = None
    for (n, x, z, y) in labels: dr.text(P2(x, z), n, fill=(255, 255, 255), font=fnt)
    img.save(os.path.join(OUT, 'fattoria_layout.png'))

if __name__ == '__main__':
    D = build_data(); write_data(D); plot(D)
    def arr(a, nd=2): return np.round(a.astype(np.float64), nd).tolist() if a.dtype.kind == 'f' else a.tolist()
    design = dict(res=RES, X0=X0, Z0=Z0, NX=NX, NZ=NZ, top=TOP, surfs=SURFS, styles=STYLES, H=arr(H), K=arr(K), SURF=arr(SURF), STYLE=arr(STYLE), BLD=arr(BLD), BLDALL=arr(BLDALL),
                  UB=[[None if np.isnan(v) else round(float(v), 2) for v in row] for row in UB], UT=[[None if np.isnan(v) else round(float(v), 2) for v in row] for row in UT], UK=arr(UK), USURF=arr(USURF),
                  ramps=ramps, stairs=stairs, rails=rails, props=props, cyls=cyls, dwalls=[[list(map(list, d[0])), d[1], d[2], d[3]] for d in dwalls], labels=labels, sites={k: list(v) for k, v in sites.items()},
                  spawns=spawns, decor=decor, buildings=BUILDINGS, levels=dict(YT=YT, YM=YM, YP=YP, YE=YE, YC=YC, YB=YB, CEILC=CEILC, HALL=HALL, HALLH=HALLH))
    json.dump(design, open(os.path.join(OUT, 'fattoria_design.json'), 'w'), separators=(',', ':'))
    print('[layout] design.json %.1f MB' % (os.path.getsize(os.path.join(OUT, 'fattoria_design.json')) / 1e6))
