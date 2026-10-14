# ART DIRECTION – DE_WHITE_DUST (v10)

Visuelle regler for alt nyt indhold. Målet er ikke fotorealisme, men en verden der føles **brugt, beboet og
knivskarp** – uden at gå på kompromis med taktisk læsbarhed eller 60+ FPS i browseren.

Det vigtigste princip: **detalje er lagdelt efter afstand og betydning.**

| Lag | Afstand | Hvad | Hvor i koden |
|---|---|---|---|
| Silhuet | 30–150 m | Skybox-ring, tage, tårne, junglekrone | `details.js → ringSlots/roof`, `theme_*.js → skyline()` |
| Form | 5–40 m | Mure, gesimser, props, plinte | `visuals.js` (verdensmesh), `themes.js → propLib` |
| Overflade | 2–15 m | PBR-tekstur + vejrlig i shaderen | `pbr.js`, `visuals.js → WEATHER_FRAG`, `theme.weather` |
| Mikro | 0–8 m | Decals, partikler, dryp | `details.js → place()`, `visuals.js → ambientMotes/drips` |

---

## 1 · Form, silhuet og komposition
- **Ingen flade toplinjer:** hver udendørs murkrone får en profil (gesims, zinkkappe, brudte sten). Alt holdes **under 9 m**,
  fordi granater lander på murkronerne – geometri over 9 m inde over banen ville give visuel klipning.
- **Silhuetten bor uden for banen:** skybox-ringen (≥ 5 m uden for yderste kollision) giver asymmetri og dybde.
  Elementer i ring 2 er højere end ring 1, så horisonten får lag. Én dominant (klokketårn, køletårn, pyramide) pr. bane.
- **Props skal have masse og funktion:** en boks klædes efter sine proportioner (lav + bred = plint/platform, høj = container).
  Kollisionen er sandheden – modellen ligger altid inden for boksen, og ståflader ligger præcis i boksens top.
- **Læsbarhed:** spillerhøjden (0–2,2 m) holdes visuelt rolig. Mikrodetaljer på mure placeres ved fod (0,4–0,8 m),
  i øjenhøjde kun som flade decals, og aldrig noget der ligner en silhuet af en person (ingen mørke, lodrette former i hjørner).

## 2 · Tekstur-dybde og materiale-blanding
- Hver flade = procedural albedo → afledt normal + ORM (`pbr.js`) → **vejrlig i verdensrum** (`theme.weather`):
  `macro` (bryder gentagelse), `grime` (murfod), `streak` (regnløb fra kronen), `top` (aflejring på vandret), `wet` (under `wetY`).
- Overgange skabes af shaderen, ikke af ekstra geometri: samme materiale ser forskelligt ud ved foden og ved kronen.
- Farver i `weather`/`post` er **lineære** (ikke sRGB). Grime-farver ganges ×1,6 – værdier < 0,62 mørkner, > 0,62 lysner.
- Banens identitet: **Dust** = sand op ad murene, mørke regnløb, varm puds · **Nuke** = sod, rust, støv, våd kælder ·
  **Ancient** = mos og jord nedefra, fugtløb, mospletter i belægningen.

## 3 · Mikro-detaljer (det spilleren opdager)
Placeres efter faste regler i `details.js → place()` – deterministisk, ens for alle spillere:

| Regel | Motiv |
|---|---|
| Døre / døråbninger | håndsmuds ved håndtaget (1,0–1,1 m), gummi-skrammer hvor døren svinger |
| Stiger | slid på væggen bag trinene, skrammer ved foden |
| Bombesites | 2 kridt-kryds, sod fra tidligere eksplosioner, skrammer, tællestreger på nærmeste mur |
| Spawn | fodspor fra rundestarten |
| Murløb | fast rytme (5,5–7 m) af temaets motiver (skjolder, revner, plakater, tags, rust, mos, mærkater) |
| Gulve | fast gitter (4,5–5 m) med tæthed pr. tema (revner, olie, blade, mos; olie → vandpytter i Nukes kælder) |
| Levende detaljer | sandstøv/pollen i lyset, kondens-dryp i kanaler, damp fra køletårnet |

Krav: et decal placeres **kun** hvis alle hjørner ligger på samme plane flade og intet står foran (testes automatisk).
Nye motiver tilføjes som celle i decal-atlasset (4×4) – aldrig som nyt materiale.

## 4 · Lys, skygger og atmosfære
- Sol = 2 skyggekaskader (nær følger kameraet, fjern er statisk). Skybox-geometri kaster **ikke** skygger ind på banen.
- Bagt lys pr. vertex (himmel-synlighed + lamper) + lys-prober til alt der bevæger sig – spillere matcher altid rummets lys.
- Dynamiske lys kommer fra en **fast pulje** (mundingsild, ild, flash) – lys tilføjes/fjernes aldrig (ingen shader-genkompilering).
- Atmosfære: Mie-dis i solens retning (`post.mie`), sol-stråler (`post.shafts`), afstandståge pr. tema.

## 5 · Post-processing og filmisk finish
HDR → SSAO → (AO + Mie-dis) → førstepersonsvåben → bloom → sol-stråler → FXAA + skærpning → ACES → grading → vignette → dither.
`theme.post` styrer looket: **Dust** varmt/gyldent med kølige skygger · **Nuke** koldt, afmættet, høj kontrast ·
**Ancient** fugtigt grønt med gyldne stråler. Hold `sharpen ≤ 0,25` og `vignette ≤ 0,25` (crosshair-området skal være neutralt).

## 6 · Sammenhæng og QA
Automatiske garantier (`npm test` → `test/visuals.js`):
- alle statiske meshes har gyldigt bagt lys + vejrligs-attribut; ingen NaN; trekant-/draw-call-budget
- face-normaler: ingen inverterede flader, ingen vægflader vendt ind i massiv geometri; lofter er lukkede nedefra
- decals: 0 svævende/klippende, 0 på murkroner · gesims: helt mellem 8,3 og 9,0 m
- skybox-ring: 0 vertices inde over spilbart område under 11 m, 0 skygge-kastere

Manuel QA-tjekliste før en ny bane/prop merges:
1. Kig langs hver mur i øjenhøjde: ingen z-fighting, ingen skilte der stikker ud over hjørner.
2. Smid en smoke og scope ind med AWP: intet må ses gennem kernen.
3. Kig mod solen: sol-stråler må ikke blænde crosshair-området.
4. Kør med `?post=0`: banen skal stadig se korrekt ud (fallback uden post-processing).
5. Ingen konsolfejl, stabile 60 FPS (adaptiv opløsning må gerne træde til på svage maskiner).
