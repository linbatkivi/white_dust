# Spillerfigurer (agenter) – v22
Alle fire figurer bygges på brugerens CGTrader-model "SWAT Operator" (Mixamo-rig), `tools/chars/src/swat_cgt/swat_operator.blend`:

| Fil | Bygges af | Indhold |
|---|---|---|
| `swat.glb` | `tools/chars/swat_cgt.py` | SWAT-operatør: hjelm med 4-rørs nattesyn, høreværn, balaclava, plate carrier med "POLICE"/"SWAT"-mærker |
| `hij.glb`, `hij2.glb`, `hij3.glb` | `tools/chars/hij_cgt.py` | Hijackere på samme krop: balaclava / shemagh / hue, brystrig med AK-magasiner, granater, radio, armbind, øjne og hud |

- Blend-filen har ingen teksturer (den medfølgende teksturpakke hører til en anden model), så teksturerne bages i Blender (Cycles):
  grå stofdetalje (Poly Haven CC0: rough_linen, hessian_230, knitted_fleece, fabric_leather_01) × ambient occlusion + normalkort på modellens egne UV-atlasser.
- Shemagh-mønster, øjne og hud genereres proceduralt (eget).
- Fælles kode: `tools/chars/cgt_base.py`. Kør fx `blender -b -P tools/chars/hij_cgt.py -- hij2 --render /tmp/r`.
- Farvevarianter laves i spillet ved at farve materialerne (Top, Pants, Vest, Helmet, Gloves, Mask, Shemagh, Beanie, Armband …) – ingen ekstra filer.
- Rig: Mixamo, omdøbt til spillets navne (pelvis/spine_01/spine_03/upperarm_r …; `head_end` markerer Mixamo-fingerakser i characters.js).
