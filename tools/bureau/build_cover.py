# ==========================================================================
# bureau · site-dækning: flightcases til IT-/våbenudstyr (CS' "default"-kasser) – blender -b --factory-startup -P tools/bureau/build_cover.py
#   → cache/custom/flight_case.glb (120 × 105 × 120 cm, kan hoppes op på) og flight_case_s.glb (90 × 60 × 60 cm, stables ovenpå)
#   Bygget som rigtige transportkasser: sort fenol-krydsfiner, aluminiumsprofiler på alle kanter, kuglehjørner, sommerfuglelåse,
#   nedsænkede håndtag, låg-fuge og en papirlabel. Origo i gulvhøjde midt under kassen, forside mod +Z.
# ==========================================================================
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'build_props.py')).read()
exec(src[:src.index('# ---------------------------------------------------------------- modellerne')])     # hjælperne: mat, box, cyl, export, reset
OUT = os.path.join(HERE, 'cache', 'custom')
bpy.ops.wm.read_factory_settings(use_empty=True)
PLY = mat('case_phenolic', (0.24, 0.255, 0.22), 0.55, 0.0)            # mørk oliven-grå fenolplade (læsbar dækning)
ALU = mat('case_alu', (0.70, 0.71, 0.72), 0.32, 1.0)
CHROME = mat('case_chrome', (0.80, 0.80, 0.80), 0.18, 1.0)
RUB = mat('case_rubber', (0.015, 0.015, 0.016), 0.85, 0.0)
LABEL = mat('case_label', (0.78, 0.74, 0.62), 0.8, 0.0)
STRIPE = mat('case_stripe', (0.85, 0.55, 0.06), 0.55, 0.0)

def case(name, W, H, D, lid=None, label=True):
    reset(); o = []; w, d = W / 2, D / 2; e = 0.022                       # profilbredde
    o.append(box(-w + 0.006, 0.02, -d + 0.006, w - 0.006, H - 0.006, d - 0.006, PLY, 0.003))
    # aluminiumsprofiler langs alle 12 kanter
    for y0, y1 in ((0.0, e), (H - e, H)):
        o.append(box(-w, y0, -d, w, y1, -d + e, ALU, 0.002)); o.append(box(-w, y0, d - e, w, y1, d, ALU, 0.002))
        o.append(box(-w, y0, -d, -w + e, y1, d, ALU, 0.002)); o.append(box(w - e, y0, -d, w, y1, d, ALU, 0.002))
    for x in (-w, w - e):
        for z in (-d, d - e): o.append(box(x, 0.0, z, x + e, H, z + e, ALU, 0.002))
    # låg-fuge: profil hele vejen rundt
    ly = lid if lid is not None else H * 0.78
    o.append(box(-w - 0.004, ly - 0.012, -d - 0.004, w + 0.004, ly + 0.012, d + 0.004, ALU, 0.002))
    o.append(box(-w - 0.005, ly - 0.002, -d - 0.005, w + 0.005, ly + 0.002, d + 0.005, RUB, 0.0))
    # kuglehjørner (8)
    for x in (-w, w):
        for z in (-d, d):
            for y in (0.035, H - 0.035):
                o.append(box(x - 0.045 * (x > 0) - 0.008 * (x < 0), y - 0.04, z - 0.045 * (z > 0) - 0.008 * (z < 0),
                             x + 0.008 * (x > 0) + 0.045 * (x < 0), y + 0.04, z + 0.008 * (z > 0) + 0.045 * (z < 0), CHROME, 0.012))
    # sommerfuglelåse på for- og bagside, nedsænkede håndtag på siderne
    nl = 2 if W > 1.0 else 1
    for s in (1, -1):
        for k in range(nl):
            x = (k - (nl - 1) / 2) * W * 0.5
            z0, z1 = (d, d + 0.018) if s > 0 else (-d - 0.018, -d)
            o.append(box(x - 0.045, ly - 0.07, z0, x + 0.045, ly + 0.05, z1, CHROME, 0.004))
            o.append(cyl(x, ly - 0.03, d + 0.02 if s > 0 else -d - 0.02, 0.016, 0.012, CHROME, 12, axis='z'))
    for s in (1, -1):
        x0, x1 = (w, w + 0.02) if s > 0 else (-w - 0.02, -w)
        hy = ly - 0.22
        o.append(box(x0, hy - 0.05, -0.13, x1, hy + 0.05, 0.13, CHROME, 0.004))
        o.append(box(x0 + (0.006 if s > 0 else -0.0) , hy - 0.025, -0.1, x1 + (0.012 if s > 0 else -0.012), hy + 0.0, 0.1, RUB, 0.003))
    # hjul-/fodlister under kassen
    for z in (-d + 0.12, d - 0.12): o.append(box(-w + 0.06, -0.0, z - 0.04, w - 0.06, 0.02, z + 0.04, RUB, 0.0))
    if label:                                                                      # papirlabel + advarselsstribe på forsiden
        o.append(box(-w * 0.55, H * 0.36, d + 0.0005, -w * 0.05, H * 0.36 + 0.16, d + 0.003, LABEL, 0.0))
        o.append(box(w * 0.2, H * 0.36, d + 0.0005, w * 0.62, H * 0.36 + 0.035, d + 0.003, STRIPE, 0.0))
    export(name, o)

case('flight_case', 1.2, 1.05, 1.2)
case('flight_case_s', 0.9, 0.6, 0.6, lid=0.46)
print('[cover] flightcases bygget')
