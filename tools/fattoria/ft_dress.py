# ==========================================================================
# de_fattoria · udsmykning: vedbend og klatrerose på murene, græs ved murfødder, sten og klippeblokke, krukker, statuer, lysekrone og lanterner, bibliotekets møbler,
# vinranker over pergolaen. Alt placeres efter faste regler (hash af position) – samme layout giver altid samme udsmykning.
# ==========================================================================
import math, random
import numpy as np
from ft_geo import *
from ft_common import hash2, vnoise
import ft_models
from ft_props import fit
from ft_plants import card, bush, grass, V3
import ft_arch

def build(D, S):
    G = S['G']; F = S['fol']; T = S['trim']; M = S['props']; L = D['levels']; YE = L['YE']
    # 1) vedbend og roser på facader (fra ground-modulets facekørsel)
    runs = getattr(G, 'face_runs', [])
    n_ivy = 0
    for (axis, line, a0, a1, y0, y1, mat, nrm) in runs:
        if y1 - y0 < 1.4 or a1 - a0 < 1.5: continue
        h = hash2(line * 0.77 + a0, a0 * 1.3 + y0)
        kind = None
        if mat in ('ft_stone', 'ft_oldstone', 'ft_rubble') and h < 0.16: kind = 'fol_ivy'
        elif mat.startswith('ft_plaster') or mat.startswith('ft_ochre'):
            if h < 0.07: kind = 'fol_rose' if h < 0.035 else 'fol_ivy'
        if not kind: continue
        rnd = random.Random(int(h * 1e6)); wlen = min(a1 - a0, rnd.uniform(2.0, 5.0)); st = a0 + rnd.uniform(0, max(0, (a1 - a0) - wlen)); hh = min(y1 - y0, rnd.uniform(1.8, 3.6))
        for k in range(max(1, int(wlen / 1.0))):
            a = st + (k + 0.5) * wlen / max(1, int(wlen / 1.0)); yb = y0 + 0.1
            for r in range(max(1, int(hh / 1.0))):
                yy = yb + r * 1.0 + rnd.uniform(0, 0.3)
                if axis == 'x': c = (a, yy + 0.5, line + 0.04 * nrm); right = (1, 0, 0)
                else: c = (line + 0.04 * nrm, yy + 0.5, a); right = (0, 0, 1)
                card(F, kind, c, right, (0, 1, 0), 1.25, 1.25); n_ivy += 1
    # 2) græs ved murfødder (tørt græs) og sten
    for (axis, line, a0, a1, y0, y1, mat, nrm) in runs:
        if mat not in ('ft_stone', 'ft_oldstone', 'ft_rubble'): continue
        n = int((a1 - a0) / 2.2)
        for k in range(n):
            h = hash2(line + k * 1.7, a0 * 0.9)
            if h > 0.55: continue
            a = a0 + (k + 0.5) * (a1 - a0) / max(1, n); off = 0.35 * nrm
            x, z = (a, line + off) if axis == 'x' else (line + off, a)
            grass(F, x, z, y0 - 0.02, random.Random(int(h * 1e6)), s=rnd_s(h))
    # 3) klippeblokke og sten ved murfødder af bakkerne (CC0: rock_07, rock_09, boulder_01)
    n_rock = 0
    for (axis, line, a0, a1, y0, y1, mat, nrm) in runs:
        if mat != 'ft_oldstone' or a1 - a0 < 3.0: continue
        h = hash2(a0 * 0.3, line * 0.2)
        if h > 0.22: continue
        a = a0 + (a1 - a0) * hash2(a0, line); x, z = (a, line + 0.7 * nrm) if axis == 'x' else (line + 0.7 * nrm, a)
        ft_models.place(['rock_07', 'rock_09', 'boulder_01'][int(h * 100) % 3], x, y0 - 0.05, z, h * 360, 0.55 + h * 1.2); n_rock += 1
    # 4) hallens lysekrone, lanterner ved porte og kælder, buster på sokler i gården, bibliotekets møbler, port
    cx, cz = -23.0, -44.0
    ft_models.place('lantern_chandelier_01', cx, YE + 4.6, cz, 0, 1.5)
    for (x, z, y) in ((-32.0, -23.2, YE + 3.0), (-29.6, -23.2, YE + 3.0), (-23, -37.7, YE + 3.0), (-20.5, -37.7, YE + 3.0)):
        ft_models.place('Lantern_01', x, y, z, 0, 0.9); ft_arch.LAMPS.append(dict(x=x, y=y + 0.2, z=z, w=40, i=1.0, range=8.0))
    for (x, z) in ((-33.0, -37.0), (-9.2, -37.0), (-33.0, -23.8), (-9.2, -23.8)):
        T.box(x - 0.35, YE, z - 0.35, x + 0.35, YE + 0.95, z + 0.35, 'ft_ashlar'); ft_models.place('marble_bust_01', x, YE + 0.95, z, 45, 0.85)
    # bibliotek: skrivebord, stole, daybed
    fit('table', 'dining_table', -3.0, -29.0, YE, 2.4, 1.1, 0.8)
    fit('chair', 'dining_chair_02', -3.0, -27.9, YE, 0.5, 0.5, 0.95, yaw=180); fit('chair', 'dining_chair_02', -3.0, -30.1, YE, 0.5, 0.5, 0.95, yaw=0)
    ft_models.place('vintage_day_bed', -5.5, YE, -22.4, 0, 1.0)
    ft_models.place('ClassicConsole_01', 0.1, YE, -30.0, 270, 1.0) if False else None
    # smedejerns-port ved Hovedporten (stående åben mod væggen) + bevoksning over pergolaen
    ft_models.place('large_iron_gate', -35.0 + 0.1, YE, -22.6, 90, 1.0) if False else None
    pg = ft_arch.pergola.__defaults__ if False else None
    rnd = random.Random(7)
    for z in (-12.5, -9.5, -6.5):                                    # løv over pergolaen (cards i toppen)
        for x in (3.5, 8.5):
            for k in range(3): card(F, 'fol_vine', (x + rnd.uniform(-0.3, 0.3), L['YP'] + 3.2 + rnd.uniform(0, 0.3), z + rnd.uniform(-0.6, 0.6)), (math.cos(k), 0, math.sin(k)), (0, 0.001, 0), 1.6, 1.6) if False else None
    # 5) krukker med lavendel/oleander langs forgårde (faste punkter)
    for (x, z, y) in ((-27, -13, YE), (-31, -13, YE), (-37, -13.5, YE), (22, 3.0, 0.0), (38, 3.0, 0.0), (26, -4.8 + 0.0, L['YP']), (35, -5.6, L['YP'])):
        rnd = random.Random(int(hash2(x, z) * 1e6)); ft_models.place('planter_pot_clay', x, y, z, rnd.uniform(0, 360), 1.15); bush(F, x, z, y + 0.55, rnd, r=0.5, mat=rnd.choice(['fol_lavender', 'fol_oleander']), n=8)
    print('[dress] vedbend/roser %d · klippeblokke %d' % (n_ivy, n_rock))

def rnd_s(h): return 0.5 + 0.5 * ((h * 977) % 1.0)
