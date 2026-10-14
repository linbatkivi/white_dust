# Spillerfigurer (agenter) – v19
Alle figurer bygges af `tools/chars/build.py` (Blender + MPFB) – kun CC0-materiale:

| Del | Kilde | Licens |
|---|---|---|
| Kroppe, ansigter, hud, øjne, bryn, tøj (skjorter, jakker, bukser, støvler) | MakeHuman system assets (`makehuman_system_assets_cc0`) via MPFB – https://static.makehumancommunity.org | CC0 |
| Stoffer: hessian_230 (vest/lommer), knitted_fleece (skimaske/hue), rough_linen (shemagh), fabric_leather_01 (handsker/knæbeskyttere) | Poly Haven – https://polyhaven.com | CC0 |
| Taktisk udstyr (plate carrier, brystrig, hjelm, høreværn, briller, skimaske, shemagh, hue, handsker, knæbeskyttere, hylster) | modelleret proceduralt i build.py | CC0 (eget) |

Figurer: `swat` (SWAT-operatør), `swat2` (SWAT-stormer), `hij` (Hijacker), `hij2` (Hijacker med shemagh), `hij3` (Hijacker-leder).
Rig: MPFB "game_engine" (pelvis/spine_01…/upperarm_r …) – drives af spillets procedurale skelet via retargeting (characters.js).
Farvevarianter laves i spillet ved at farve materialerne (Top, Pants, Vest, Helmet, Gloves, Pads, Mask, Beanie) – ingen ekstra filer.
