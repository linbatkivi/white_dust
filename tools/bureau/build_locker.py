# ==========================================================================
# de_bureau · våbenskab til B-sitet (v26.3) – blender -b --factory-startup -P tools/bureau/build_locker.py
#   → cache/custom/weapon_locker.glb (100 × 50 × 190 cm, forside mod +Z, origo i gulvhøjde midt under skabet)
#   Før: en glat grå kasse med sorte flader. Nu et rigtigt pansret våbenskab: oliven pulverlak, to gitterdøre man kan se ind
#   igennem, fire rifler i et stativ, hylde med ammokasser, kodelås med LED, hængsler, ventilationsslidser, sokkel og stencil-nummer.
# ==========================================================================
import os, random
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'build_props.py')).read()
exec(src[:src.index('# ---------------------------------------------------------------- modellerne')])     # hjælperne: mat, box, cyl, export, reset
OUT = os.path.join(HERE, 'cache', 'custom')
bpy.ops.wm.read_factory_settings(use_empty=True)
OD = mat('locker_od', (0.16, 0.19, 0.13), 0.55, 0.35)                  # oliven pulverlak
ODD = mat('locker_od_dark', (0.07, 0.08, 0.06), 0.7, 0.2)              # indersiden
BAR = mat('locker_bar', (0.30, 0.31, 0.30), 0.4, 0.9)                  # gitteret
STEEL = mat('steel_brushed', (0.62, 0.63, 0.64), 0.28, 1.0)
GUN = mat('gun_black', (0.035, 0.035, 0.038), 0.45, 0.5)
FDE = mat('gun_fde', (0.42, 0.34, 0.22), 0.7, 0.0)                     # sandfarvede kolber/greb
AMMO = mat('ammo_green', (0.20, 0.24, 0.14), 0.6, 0.3)
STENCIL = mat('stencil_yellow', (0.85, 0.66, 0.08), 0.6, 0.0)
RUB = mat('case_rubber', (0.015, 0.015, 0.016), 0.85, 0.0)
LED = mat('led_green', (0.1, 1, 0.3), 0.3, emit=((0.1, 1, 0.3), 8))
LEDR = mat('led_red', (1, 0.1, 0.05), 0.3, emit=((1, 0.1, 0.05), 8))

def rifle(x, lean, o, fde):
    """stående riffel (løbet op), ca. 95 cm – stilet: kolbe, skæfte, magasin, løb, sigte"""
    z = -0.05 + lean
    o.append(box(x - 0.022, 0.12, z - 0.07, x + 0.022, 0.36, z + 0.03, FDE if fde else GUN, 0.006))       # kolbe
    o.append(box(x - 0.02, 0.36, z - 0.04, x + 0.02, 0.70, z + 0.02, GUN, 0.004))                           # skæfte/receiver
    o.append(box(x - 0.016, 0.44, z + 0.02, x + 0.016, 0.58, z + 0.09, GUN, 0.004))                          # magasin
    o.append(box(x - 0.014, 0.40, z - 0.075, x + 0.014, 0.47, z - 0.04, FDE if fde else GUN, 0.004))         # pistolgreb
    o.append(box(x - 0.024, 0.70, z - 0.035, x + 0.024, 0.92, z + 0.025, GUN, 0.004))                        # forskæfte
    o.append(cyl(x, 0.92, z - 0.005, 0.009, 0.16, STEEL, 10))                                                # løb
    o.append(box(x - 0.012, 0.56, z - 0.065, x + 0.012, 0.62, z - 0.04, GUN, 0.002))                         # sigte

reset(); o = []; W, D, H = 1.0, 0.5, 1.9; w, d = W / 2, D / 2
# korpus: sider, bund, top, ryg, sokkel
o.append(box(-w, 0.08, -d, -w + 0.03, H, d, OD, 0.006)); o.append(box(w - 0.03, 0.08, -d, w, H, d, OD, 0.006))
o.append(box(-w, H - 0.04, -d, w, H, d, OD, 0.006)); o.append(box(-w, 0.08, -d, w, 0.12, d, OD, 0.004))
o.append(box(-w, 0.08, -d, w, H, -d + 0.02, OD, 0.004))
o.append(box(-w + 0.02, 0.0, -d + 0.03, w - 0.02, 0.08, d - 0.03, RUB, 0.004))                            # sokkel
o.append(box(-w + 0.03, 0.12, -d + 0.02, w - 0.03, H - 0.04, -d + 0.03, ODD, 0.0))                         # mørk inderside
o.append(box(-0.01, 0.12, -d + 0.02, 0.01, H - 0.04, d - 0.02, OD, 0.0))                                   # midterskillevæg
# riffelstativ (to sider × 2 rifler) + hylde med ammokasser og et skilt
o.append(box(-w + 0.03, 0.12, -0.12, w - 0.03, 0.16, 0.12, ODD, 0.0))
o.append(box(-w + 0.03, 0.88, -d + 0.03, w - 0.03, 0.9, -0.1, STEEL, 0.0))                                 # holdeskinne
for k, x in enumerate((-0.36, -0.16, 0.16, 0.36)): rifle(x, 0.0, o, k % 2 == 1)
o.append(box(-w + 0.03, 1.28, -d + 0.03, w - 0.03, 1.30, d - 0.04, STEEL, 0.0))                            # hylde
rnd = random.Random(3)
for x in (-0.38, -0.2, 0.06, 0.26):
    hh = rnd.choice((0.14, 0.17))
    o.append(box(x, 1.30, -0.16, x + 0.15, 1.30 + hh, 0.08, AMMO, 0.004)); o.append(box(x + 0.05, 1.30 + hh, -0.05, x + 0.1, 1.30 + hh + 0.02, -0.03, STEEL, 0.002))
# to gitterdøre: ramme + lodrette og vandrette tremmer (man ser riflerne igennem)
for s in (-1, 1):
    x0, x1 = (-w + 0.035, -0.012) if s < 0 else (0.012, w - 0.035); zf = d - 0.01
    o.append(box(x0, 0.13, zf - 0.02, x1, 0.19, zf + 0.012, OD, 0.003)); o.append(box(x0, H - 0.11, zf - 0.02, x1, H - 0.05, zf + 0.012, OD, 0.003))
    o.append(box(x0, 0.13, zf - 0.02, x0 + 0.05, H - 0.05, zf + 0.012, OD, 0.003)); o.append(box(x1 - 0.05, 0.13, zf - 0.02, x1, H - 0.05, zf + 0.012, OD, 0.003))
    o.append(box(x0, 0.98, zf - 0.02, x1, 1.03, zf + 0.012, OD, 0.003))                                     # tværbånd
    nx = 6
    for k in range(nx):
        xx = x0 + 0.05 + (x1 - x0 - 0.1) * (k + 0.5) / nx
        o.append(box(xx - 0.005, 0.19, zf - 0.012, xx + 0.005, H - 0.11, zf - 0.002, BAR, 0.0))
    yy = 0.26
    while yy < H - 0.12:
        if not 0.96 < yy < 1.05: o.append(box(x0 + 0.05, yy - 0.005, zf - 0.008, x1 - 0.05, yy + 0.005, zf + 0.002, BAR, 0.0))
        yy += 0.075
    hx = x1 - 0.02 if s < 0 else x0 + 0.02                                                                 # hængsler yderst
    hx = x0 + 0.01 if s < 0 else x1 - 0.01
    for hy in (0.35, 1.0, 1.6): o.append(cyl(hx, hy, zf + 0.015, 0.012, 0.09, STEEL, 10))
    gx = x1 - 0.07 if s < 0 else x0 + 0.07                                                                  # håndtag ved midten
    o.append(box(gx - 0.012, 0.86, zf + 0.012, gx + 0.012, 1.14, zf + 0.04, STEEL, 0.004))
# kodelås med LED og stencil-nummer + advarselsstribe
o.append(box(-0.07, 1.16, d, 0.07, 1.34, d + 0.03, GUN, 0.006))
o.append(box(-0.05, 1.29, d + 0.03, -0.02, 1.31, d + 0.034, LED, 0.0)); o.append(box(0.02, 1.29, d + 0.03, 0.05, 1.31, d + 0.034, LEDR, 0.0))
for r in range(3):
    for c in range(3): o.append(box(-0.045 + c * 0.032, 1.18 + r * 0.033, d + 0.03, -0.025 + c * 0.032, 1.205 + r * 0.033, d + 0.036, STEEL, 0.0))
o.append(box(-w + 0.06, H - 0.035, d - 0.004, -w + 0.32, H - 0.005, d + 0.002, STENCIL, 0.0))                 # stencilbånd på topkanten
o.append(box(-w + 0.04, 0.02, d - 0.03, w - 0.04, 0.07, d - 0.025, STENCIL, 0.0))                           # gul stribe på soklen
# ventilationsslidser på siderne
for sx in (-w - 0.002, w - 0.001):
    for k in range(6): o.append(box(sx, 1.55 + k * 0.035, -0.12, sx + 0.003, 1.565 + k * 0.035, 0.12, ODD, 0.0))
export('weapon_locker', o)
print('[locker] våbenskab bygget, %d dele' % len(o))
