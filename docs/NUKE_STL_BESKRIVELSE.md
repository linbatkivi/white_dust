# de_nuke – komplet beskrivelse ud fra 3D-modellen (STL)

Kilde: `Nuke upper part.stl` (6 496 trekanter, overetagen: A-niveau, Outside, Lobby, Ramp-rummet, Garage) og `Nuke lower part+roofs.stl` (6 880 trekanter, underetagen: Ramp, Bottom Ramp, B site, Secret-gangen + tagplader printet fladt ved siden af).

Alt er udtrukket automatisk: STL-filerne er rasteriseret til et højdekort (0,25 enheder pr. celle), hvert sammenhængende fladt område er segmenteret og målt (mindste omsluttende rektangel → centrum, bredde, dybde, rotation), skrå flader er fundet som ramper (hældning via mindste kvadraters metode), og huller i modellen (hvor vægstykkerne sidder i printet) er målt som vægspor. Ingen bokse er tegnet "på øjemål".

Filer: [nuke_stl_objekter.json](nuke_stl_objekter.json) (alle data, maskinlæsbare) · [nuke_stl_overetage.png](nuke_stl_overetage.png) og [nuke_stl_underetage.png](nuke_stl_underetage.png) (kort med ID'er og 10 m-gitter i spillets koordinater).

## 1. Målestok og koordinater (samme som i spillet)

* **Målestok: 0,45 m pr. STL-enhed** – kalibreret mod radaren (Silo ↔ A-hallen ↔ Garage ↔ Ramp giver 2,1 radar-px pr. enhed ≈ 18,8 Hammer-enheder) og spillets løbefart (6 m/s ≙ CS 250 u/s), så løbetiderne svarer til CS.
* **Akser:** STL +x = øst, STL +y = nord, STL +z = op. Spillet: +x = øst, **−z = nord**, +y = op.
* **Overetage → spil:** `x = 0,45·(X + 935)`, `z = −0,45·(Y − 233)`, `y = 0,45·(Z − 29,07)`.
* **Underetage → spil:** først `X − 1433,9`, `Y + 257,4` (bekræftet af vent-stigen, hvis trin findes i begge dele, og af Ramp/Secret-forbindelserne), derefter som ovenfor med `y = 0,45·(Z − 1,2 − 29,07)`.
* Gulvhøjder i spillet: A-niveau y 0 · hævet CT-plads +2,09 · T Roof +5,83 · A-hallens loft +7,05 · Ramp-landing −1,74 · Bottom Ramp −6,22 · Back Vents −5,17 · **B site −9,31**.
* Den spilbare bane genereres direkte fra STL-filerne af `tools/nuke_from_stl.py` → `shared/nuke_data.js`.

## 2. Overblik – områder

**Overetagen (A-niveau)**, fra vest mod øst:
* **T-side (vest):** kileformet indgang fra T Spawn (modellens vestspids x ≈ −41 i spillet; T Spawn selv er tilføjet efter radaren), skrå nordvest- og sydvestkant.
* **Lobby-bygningen:** rumkomplekset vest for A-hallen (Lobby, Hut, Squeaky, Radio) – kun vægspor i modellen (UW-vægge), én langstrakt kasse (U38) og hjørnestolper.
* **T Outside / Silo:** den store silo (U67, Ø 8,8 m, 10,5 m høj) med platformen/gangbroen ved toppen (U53–U63), kasser rundt om foden (U75, U77, U78, U79) og en lang container mod vest (U50).
* **A-bygningen (A site / Hell):** stor hal (indre gulv ≈ 19,8 × 30,2 m) uden vægge i printet (væggene er det store vægspor UW23); to cylindriske tanke (U21, U22, Ø 3,2 m, 5,75 m høje), kasse ved nordvæggen (U17), kasser ved sydindgangene (U61, U62), og Hell-rummet i hallens sydøst-del.
* **Ramp-rummet (nord for A):** kasse-stak i nordvesthjørnet (U05 drejet 14°, U06 drejet 27°, U08, U09 stor kasse, U10), kasse ved østvæggen (U07), og to nedkørsler mod nord (UR6/UR7 → Ramp ned til B). Nordligst stablede kasser U01–U04.
* **CT-siden (øst):** hævet plads (+2,09 m) med to ramper op (UR3 fra syd, UR4 fra vest), en drejet kasse (U26 drejet 56°), rum med vægspor (Lockers/Heaven-trappen) og små stolper (U13, U14, U19, U20, U28–U33).
* **Outside (gården, syd):** åben gård med to vægstykker (U64/U73/U74 – mur-L), drejet container (U66, 79° → næsten nord-syd) med kasse (U68), stor lav blok/containere ved sydkanten (U88 + U82/U83 oven på), kasse U58.
* **Garage (sydøst):** vægspor-rum (U69–U72, U80–U85), høje containere/kasser langs østkanten (U70, U76, U86, U89) og en stor høj blok (U87). Secret-trappen ned (UR1) ved sydkanten.

**Underetagen (B-niveau)**, fra nord mod syd:
* **Ramp-top:** forbindelse til Ramp-rummet (Z 27,49) med to runde søjler/rør (L-cylindre ved Ramp-toppen) og en hævet kasse.
* **Ramp (LR):** 13,5 m lang nedkørsel mod syd fra Ramp-landingen (−1,74) til Bottom Ramp (−6,22).
* **Mellemplateau (Bottom Ramp):** y = −6,22 med gelænder/karm (bjælken L-objekterne ved Y≈23), ramper ned til B.
* **B site (y = −9,31):** stort åbent gulv (30,6 × 26,6 m) under A-hallen med reaktor-søjlen (rund, Ø 2,1 m), kasser og konsoller, ramper op mod øst (Doors/Tunnels) og Secret.
* **Secret-gangen:** skrå gang mod sydøst (y = −6,22) der ender i Secret-trappen op til gården (y = 0).
* **Tagplader:** flade stykker til højre i printet (taget over Lobby, A-hallen, Garage osv. – med ventilationskasser, rør og AC-enheder), tages ikke med som spilbare bokse men er listet for fuldstændighedens skyld.

## 3. Alle objekter (bokse, containere, cylindre, stolper, vægstykker)

Koordinaterne i tabellerne er præcis de samme som i spillet. Rotation er vinklen for rektanglets første side (bredden) mod øst-aksen i STL-planet (0° = akse-parallel). "Bredde/Dybde" er rektanglets sider (ved rotation 0: langs x og z). Cylindre: bredde = dybde = diameter.

### 3.1 Overetagen (90 objekter)

| ID | Område | Type | Spil x | Spil z | Bredde (x) m | Dybde (z) m | Rotation ° | y bund | y top | Højde m | STL centrum (X, Y) | STL top Z |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
| U01 | Ramp-rummet (N for A) | væg/skinne | -4.84 | -31.39 | 2.14 | 0.11 | 0 | -0.00 | -0.00 | 0.00 | (-945.75, 302.75) | 29.06 |
| U02 | Ramp-rummet (N for A) | kasse | -4.84 | -30.49 | 2.14 | 1.69 | 0 | 0.00 | 1.80 | 1.80 | (-945.75, 300.75) | 33.07 |
| U03 | Ramp-rummet (N for A) | kasse | -2.25 | -29.87 | 3.04 | 2.93 | 0 | 0.00 | 2.25 | 2.25 | (-940.00, 299.38) | 34.07 |
| U04 | Ramp-rummet (N for A) | kasse | -4.78 | -29.14 | 2.02 | 1.01 | 0 | 0.00 | 0.90 | 0.90 | (-945.62, 297.75) | 31.07 |
| U05 | Ramp-rummet (N for A) | kasse | -7.05 | -22.14 | 2.87 | 2.54 | -14 | 0.00 | 3.15 | 3.15 | (-950.67, 282.20) | 36.07 |
| U06 | Ramp-rummet (N for A) | kasse | -4.61 | -21.32 | 1.77 | 1.72 | -27 | 0.00 | 3.15 | 3.15 | (-945.25, 280.37) | 36.07 |
| U07 | Ramp-rummet (N for A) | kasse | 7.88 | -20.20 | 2.36 | 2.25 | 0 | 0.00 | 3.60 | 3.60 | (-917.50, 277.88) | 37.07 |
| U08 | Ramp-rummet (N for A) | kasse | -4.16 | -19.18 | 1.69 | 1.35 | 0 | 0.00 | 3.15 | 3.15 | (-944.25, 275.62) | 36.07 |
| U09 | Ramp-rummet (N for A) | platform/blok | -7.15 | -18.56 | 3.60 | 3.71 | 0 | 0.00 | 3.15 | 3.15 | (-950.88, 274.25) | 36.07 |
| U10 | Ramp-rummet (N for A) | kasse | -4.16 | -17.44 | 1.69 | 1.46 | 0 | 0.00 | 3.15 | 3.15 | (-944.25, 271.75) | 36.07 |
| U11 | Lobby-bygningen (Lobby · Hut · Squeaky · Radio) | kasse | -23.96 | -16.09 | 1.01 | 0.56 | 0 | 0.00 | 5.83 | 5.83 | (-988.25, 268.75) | 42.02 |
| U12 | Lobby-bygningen (Lobby · Hut · Squeaky · Radio) | kasse | -10.75 | -16.03 | 1.12 | 0.45 | 0 | 0.00 | 5.83 | 5.83 | (-958.88, 268.62) | 42.02 |
| U13 | CT-siden (Ø) · hævet plads + ramper | stolpe/søjle | 16.48 | -15.64 | 0.68 | 0.56 | 0 | 0.00 | 3.51 | 3.51 | (-898.38, 267.75) | 36.88 |
| U14 | CT-siden (Ø) · hævet plads + ramper | stolpe/søjle | 19.80 | -15.52 | 0.56 | 0.79 | 0 | 0.00 | 3.51 | 3.51 | (-891.00, 267.50) | 36.88 |
| U15 | A-bygningen (A site / Hell) | stolpe/søjle | -8.55 | -14.74 | 0.79 | 0.79 | 0 | 0.00 | 7.05 | 7.05 | (-954.00, 265.75) | 44.74 |
| U16 | A-bygningen (A site / Hell) | stolpe/søjle | 8.44 | -14.74 | 0.79 | 0.79 | 0 | 0.00 | 7.05 | 7.05 | (-916.25, 265.75) | 44.74 |
| U17 | A-bygningen (A site / Hell) | kasse | -4.00 | -13.55 | 2.02 | 2.02 | 0 | 0.00 | 1.83 | 1.83 | (-943.88, 263.12) | 33.14 |
| U18 | A-bygningen (A site / Hell) | væg/skinne | 8.21 | -13.22 | 1.80 | 0.11 | 90 | 0.78 | 1.47 | 0.69 | (-916.75, 262.38) | 32.34 |
| U19 | CT-siden (Ø) · hævet plads + ramper | stolpe/søjle | 12.20 | -11.36 | 0.45 | 0.79 | 0 | 0.00 | 7.05 | 7.05 | (-907.88, 258.25) | 44.74 |
| U20 | A-bygningen (A site / Hell) | stolpe/søjle | 10.12 | -9.56 | 0.56 | 0.79 | 0 | 0.00 | 3.51 | 3.51 | (-912.50, 254.25) | 36.88 |
| U21 | A-bygningen (A site / Hell) | cylinder | 2.02 | -6.75 | 3.26 | 3.26 | 0 | 0.00 | 5.76 | 5.76 | (-930.50, 248.00) | 41.86 |
| U22 | A-bygningen (A site / Hell) | cylinder | -2.08 | -6.70 | 3.15 | 3.15 | 0 | 0.00 | 5.76 | 5.76 | (-939.62, 247.88) | 41.86 |
| U23 | Lobby-bygningen (Lobby · Hut · Squeaky · Radio) | stolpe/søjle | -10.57 | -5.74 | 0.79 | 0.56 | 0 | 0.00 | 5.83 | 5.83 | (-958.50, 245.75) | 42.02 |
| U24 | Lobby-bygningen (Lobby · Hut · Squeaky · Radio) | stolpe/søjle | -12.94 | -5.29 | 0.79 | 0.34 | 0 | 0.00 | 2.88 | 2.88 | (-963.75, 244.75) | 35.47 |
| U25 | A-bygningen (A site / Hell) | stolpe/søjle | -10.35 | -5.29 | 0.34 | 0.34 | 0 | 0.00 | 2.88 | 2.88 | (-958.00, 244.75) | 35.47 |
| U26 | CT-siden (Ø) · hævet plads + ramper | kasse | 30.59 | -3.25 | 1.58 | 1.61 | 56 | 2.09 | 3.89 | 1.80 | (-867.02, 240.22) | 37.72 |
| U27 | T-side (vest, indgang fra T Spawn) | kasse | -29.93 | -2.36 | 0.56 | 1.01 | 0 | 0.00 | 5.83 | 5.83 | (-1001.50, 238.25) | 42.02 |
| U28 | A-bygningen (A site / Hell) | stolpe/søjle | 10.24 | -2.36 | 0.79 | 0.56 | 0 | 0.00 | 3.51 | 3.51 | (-912.25, 238.25) | 36.88 |
| U29 | CT-siden (Ø) · hævet plads + ramper | platform/blok | 12.26 | -2.36 | 3.26 | 0.56 | 0 | 0.00 | 1.05 | 1.05 | (-907.75, 238.25) | 31.40 |
| U30 | CT-siden (Ø) · hævet plads + ramper | stolpe/søjle | 14.23 | -2.36 | 0.68 | 0.56 | 0 | 0.00 | 3.51 | 3.51 | (-903.38, 238.25) | 36.88 |
| U31 | CT-siden (Ø) · hævet plads + ramper | stolpe/søjle | 19.80 | -2.36 | 0.56 | 0.56 | 0 | 0.00 | 3.51 | 3.51 | (-891.00, 238.25) | 36.88 |
| U32 | CT-siden (Ø) · hævet plads + ramper | kasse | 16.99 | -1.46 | 1.01 | 1.01 | 0 | 0.00 | 1.57 | 1.57 | (-897.25, 236.25) | 32.57 |
| U33 | CT-siden (Ø) · hævet plads + ramper | kasse | 18.11 | -1.46 | 1.01 | 1.01 | 0 | 0.00 | 2.93 | 2.93 | (-894.75, 236.25) | 35.57 |
| U34 | A-bygningen (A site / Hell) | væg/skinne | -10.35 | -0.79 | 0.34 | 1.69 | 0 | 0.00 | 5.83 | 5.83 | (-958.00, 234.75) | 42.02 |
| U35 | A-bygningen (A site / Hell) | stolpe/søjle | -8.66 | 0.68 | 0.56 | 0.56 | 0 | 0.00 | 3.48 | 3.48 | (-954.25, 231.50) | 36.80 |
| U36 | A-bygningen (A site / Hell) | stolpe/søjle | -4.61 | 0.68 | 0.56 | 0.56 | 0 | 0.00 | 3.48 | 3.48 | (-945.25, 231.50) | 36.80 |
| U37 | A-bygningen (A site / Hell) | kasse | 9.05 | 2.81 | 1.57 | 0.56 | 0 | 0.00 | 7.05 | 7.05 | (-914.88, 226.75) | 44.74 |
| U38 | Lobby-bygningen (Lobby · Hut · Squeaky · Radio) | platform/blok | -12.94 | 5.29 | 0.79 | 4.16 | 0 | 0.00 | 2.88 | 2.88 | (-963.75, 221.25) | 35.47 |
| U39 | A-bygningen (A site / Hell) | stolpe/søjle | -10.35 | 7.15 | 0.34 | 0.45 | 0 | 0.00 | 2.88 | 2.88 | (-958.00, 217.12) | 35.47 |
| U40 | T-side (vest, indgang fra T Spawn) | kasse | -29.93 | 7.37 | 0.56 | 1.12 | 0 | 0.00 | 5.83 | 5.83 | (-1001.50, 216.62) | 42.02 |
| U41 | A-bygningen (A site / Hell) | kasse | -3.65 | 7.48 | 1.35 | 1.35 | 0 | 1.57 | 2.35 | 0.78 | (-943.12, 216.38) | 34.30 |
| U42 | A-bygningen (A site / Hell) | kasse | -3.38 | 7.48 | 1.91 | 1.80 | 0 | 1.05 | 1.57 | 0.52 | (-942.50, 216.38) | 32.56 |
| U43 | A-bygningen (A site / Hell) | kasse | -1.80 | 7.48 | 1.24 | 1.35 | 0 | 0.00 | 1.05 | 1.05 | (-939.00, 216.38) | 31.40 |
| U44 | Lobby-bygningen (Lobby · Hut · Squeaky · Radio) | stolpe/søjle | -10.40 | 7.65 | 0.45 | 0.56 | 0 | 3.27 | 5.83 | 2.56 | (-958.12, 216.00) | 42.02 |
| U45 | Lobby-bygningen (Lobby · Hut · Squeaky · Radio) | stolpe/søjle | -24.19 | 8.15 | 0.56 | 0.45 | 0 | 0.00 | 3.66 | 3.66 | (-988.75, 214.88) | 37.21 |
| U46 | Lobby-bygningen (Lobby · Hut · Squeaky · Radio) | stolpe/søjle | -10.40 | 8.15 | 0.45 | 0.45 | 0 | 0.00 | 3.66 | 3.66 | (-958.12, 214.88) | 37.21 |
| U47 | A-bygningen (A site / Hell) | stolpe/søjle | -8.66 | 8.15 | 0.56 | 0.45 | 0 | 0.00 | 3.48 | 3.48 | (-954.25, 214.88) | 36.80 |
| U48 | A-bygningen (A site / Hell) | stolpe/søjle | -4.61 | 8.15 | 0.56 | 0.45 | 0 | 0.00 | 3.48 | 3.48 | (-945.25, 214.88) | 36.80 |
| U49 | A-bygningen (A site / Hell) | kasse | -9.90 | 10.46 | 0.56 | 1.69 | 0 | 0.00 | 2.88 | 2.88 | (-957.00, 209.75) | 35.47 |
| U50 | Lobby-bygningen (Lobby · Hut · Squeaky · Radio) | container | -27.45 | 11.20 | 2.81 | 6.53 | 0 | 0.00 | 3.14 | 3.14 | (-996.00, 208.12) | 36.05 |
| U51 | Lobby-bygningen (Lobby · Hut · Squeaky · Radio) | kasse | -21.15 | 12.38 | 1.69 | 1.01 | 0 | 0.00 | 2.70 | 2.70 | (-982.00, 205.50) | 35.07 |
| U52 | Lobby-bygningen (Lobby · Hut · Squeaky · Radio) | kasse | -18.79 | 12.38 | 2.81 | 1.01 | 0 | 0.00 | 0.90 | 0.90 | (-976.75, 205.50) | 31.07 |
| U53 | Lobby-bygningen (Lobby · Hut · Squeaky · Radio) | væg/skinne | -16.20 | 12.94 | 5.96 | 0.11 | 0 | 7.20 | 7.25 | 0.05 | (-971.00, 204.25) | 45.19 |
| U54 | Lobby-bygningen (Lobby · Hut · Squeaky · Radio) | stolpe/søjle | -24.19 | 13.10 | 0.56 | 0.45 | 0 | 0.00 | 3.66 | 3.66 | (-988.75, 203.88) | 37.21 |
| U55 | Lobby-bygningen (Lobby · Hut · Squeaky · Radio) | stolpe/søjle | -10.40 | 13.10 | 0.45 | 0.45 | 0 | 0.00 | 3.66 | 3.66 | (-958.12, 203.88) | 37.21 |
| U56 | Lobby-bygningen (Lobby · Hut · Squeaky · Radio) | kasse | -15.58 | 13.39 | 0.90 | 0.11 | 0 | 0.00 | 7.64 | 7.64 | (-969.62, 203.25) | 46.05 |
| U57 | T Outside / Silo | væg/skinne | -16.70 | 13.55 | 1.35 | 0.23 | 0 | 0.00 | 7.65 | 7.65 | (-972.12, 202.88) | 46.07 |
| U58 | CT-siden (Ø) · hævet plads + ramper | kasse | 12.60 | 14.00 | 2.36 | 1.80 | 0 | 0.00 | 1.83 | 1.83 | (-907.00, 201.88) | 33.14 |
| U59 | T Outside / Silo | kasse | -18.56 | 14.06 | 1.01 | 0.11 | 0 | 0.00 | 7.32 | 7.32 | (-976.25, 201.75) | 45.34 |
| U60 | T Outside / Silo | nedsænket felt/fordybning | -18.68 | 14.35 | 0.79 | 0.45 | 0 | 8.28 | 0.00 | -8.28 | (-976.50, 201.12) | 29.07 |
| U61 | A-bygningen (A site / Hell) | kasse | 4.95 | 14.57 | 1.91 | 1.80 | 0 | 0.00 | 1.96 | 1.96 | (-924.00, 200.62) | 33.43 |
| U62 | A-bygningen (A site / Hell) | kasse | -5.12 | 14.62 | 2.25 | 1.69 | 0 | 0.00 | 2.09 | 2.09 | (-946.38, 200.50) | 33.72 |
| U63 | T Outside / Silo | nedsænket felt/fordybning | -11.59 | 15.02 | 3.38 | 2.81 | 90 | 9.48 | 0.00 | -9.48 | (-960.75, 199.62) | 29.07 |
| U64 | A-bygningen (A site / Hell) | stolpe/søjle | -4.05 | 17.55 | 0.56 | 0.56 | 0 | 0.00 | 4.18 | 4.18 | (-944.00, 194.00) | 38.37 |
| U65 | A-bygningen (A site / Hell) | stolpe/søjle | 5.51 | 17.55 | 0.56 | 0.56 | 0 | 0.00 | 4.18 | 4.18 | (-922.75, 194.00) | 38.37 |
| U66 | Garage (SØ) | container | 18.12 | 18.24 | 5.70 | 2.56 | -79 | 0.00 | 2.88 | 2.88 | (-894.74, 192.46) | 35.47 |
| U67 | T Outside / Silo | cylinder | -15.58 | 19.40 | 8.78 | 8.78 | 0 | 0.00 | 10.47 | 10.47 | (-969.62, 189.88) | 52.33 |
| U68 | Garage (SØ) | kasse | 18.63 | 20.27 | 1.83 | 0.80 | 11 | 2.88 | 3.47 | 0.59 | (-893.59, 187.96) | 36.79 |
| U69 | Garage (SØ) | kasse | 23.96 | 20.48 | 2.59 | 2.14 | 0 | 0.00 | 5.23 | 5.23 | (-881.75, 187.50) | 40.70 |
| U70 | Garage (SØ) | kasse | 37.69 | 20.70 | 2.81 | 2.59 | 0 | 0.00 | 4.71 | 4.71 | (-851.25, 187.00) | 39.53 |
| U71 | Garage (SØ) | stolpe/søjle | 17.66 | 22.50 | 0.56 | 0.56 | 0 | 0.00 | 4.18 | 4.18 | (-895.75, 183.00) | 38.37 |
| U72 | Garage (SØ) | stolpe/søjle | 22.39 | 22.50 | 0.56 | 0.56 | 0 | 0.00 | 4.18 | 4.18 | (-885.25, 183.00) | 38.37 |
| U73 | Outside (gården, S) | stolpe/søjle | -4.05 | 23.57 | 0.56 | 0.45 | 0 | 0.00 | 4.18 | 4.18 | (-944.00, 180.62) | 38.37 |
| U74 | Outside (gården, S) | stolpe/søjle | 5.51 | 23.57 | 0.56 | 0.45 | 0 | 0.00 | 4.18 | 4.18 | (-922.75, 180.62) | 38.37 |
| U75 | T Outside / Silo | platform/blok | -12.77 | 25.93 | 3.38 | 2.70 | 0 | 0.00 | 4.45 | 4.45 | (-963.38, 175.38) | 38.95 |
| U76 | Garage (SØ) | kasse | 37.69 | 26.72 | 2.81 | 2.70 | 0 | 0.00 | 6.02 | 6.02 | (-851.25, 173.62) | 42.44 |
| U77 | T Outside / Silo | kasse | -17.21 | 27.90 | 2.36 | 2.36 | 0 | 0.00 | 2.35 | 2.35 | (-973.25, 171.00) | 34.30 |
| U78 | T Outside / Silo | kasse | -11.48 | 28.91 | 2.36 | 2.36 | 0 | 0.00 | 2.61 | 2.61 | (-960.50, 168.75) | 34.88 |
| U79 | T Outside / Silo | kasse | -12.15 | 30.65 | 1.01 | 1.12 | 0 | 0.00 | 1.31 | 1.31 | (-962.00, 164.88) | 31.98 |
| U80 | Garage (SØ) | stolpe/søjle | 17.66 | 31.16 | 0.56 | 0.56 | 0 | 0.00 | 4.18 | 4.18 | (-895.75, 163.75) | 38.37 |
| U81 | Garage (SØ) | stolpe/søjle | 22.39 | 31.16 | 0.56 | 0.56 | 0 | 3.40 | 4.18 | 0.78 | (-885.25, 163.75) | 38.37 |
| U82 | Outside (gården, S) | kasse | -1.80 | 31.39 | 1.24 | 1.01 | 0 | 0.00 | 1.05 | 1.05 | (-939.00, 163.25) | 31.40 |
| U83 | Outside (gården, S) | kasse | -1.97 | 32.68 | 1.57 | 1.57 | 0 | 0.00 | 1.83 | 1.83 | (-939.38, 160.38) | 33.14 |
| U84 | Garage (SØ) | stolpe/søjle | 16.88 | 32.74 | 0.79 | 0.79 | 0 | 0.00 | 1.04 | 1.04 | (-897.50, 160.25) | 31.39 |
| U85 | Garage (SØ) | kasse | 18.17 | 32.85 | 1.57 | 0.79 | 0 | 0.00 | 1.04 | 1.04 | (-894.62, 160.00) | 31.39 |
| U86 | Garage (SØ) | kasse | 37.57 | 34.03 | 3.04 | 2.70 | 0 | 0.00 | 6.02 | 6.02 | (-851.50, 157.38) | 42.44 |
| U87 | Garage (SØ) | platform/blok | 24.52 | 34.43 | 3.71 | 8.66 | 0 | 0.00 | 3.40 | 3.40 | (-880.50, 156.50) | 36.63 |
| U88 | Outside (gården, S) | container | -0.05 | 34.93 | 7.20 | 2.93 | 0 | 0.00 | 2.88 | 2.88 | (-935.12, 155.38) | 35.47 |
| U89 | Garage (SØ) | kasse | 31.33 | 37.46 | 3.15 | 2.59 | 0 | 0.00 | 6.02 | 6.02 | (-865.38, 149.75) | 42.44 |
| U90 | Garage (SØ) | nedsænket felt/fordybning | 18.56 | 40.33 | 2.70 | 0.11 | 90 | -1.00 | -1.24 | -0.23 | (-893.75, 143.38) | 26.32 |

### 3.2 Underetagen + tagplader (70 objekter)

| ID | Område | Type | Spil x | Spil z | Bredde (x) m | Dybde (z) m | Rotation ° | y bund | y top | Højde m | STL centrum (X, Y) | STL top Z |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
| L01 | Ramp-top (forbindelse til Ramp-rummet) | platform/blok | -6.93 | -44.84 | 3.93 | 3.93 | -45 | -6.22 | -1.25 | 4.97 | (483.50, 75.25) | 27.49 |
| L02 | Ramp-top (forbindelse til Ramp-rummet) | kasse | -6.93 | -44.84 | 2.14 | 2.14 | 0 | -1.25 | -0.21 | 1.04 | (483.50, 75.25) | 29.81 |
| L03 | Ramp-top (forbindelse til Ramp-rummet) | platform/blok | 6.79 | -44.73 | 3.94 | 3.94 | 0 | -6.22 | -1.25 | 4.97 | (514.00, 75.00) | 27.49 |
| L04 | Ramp-top (forbindelse til Ramp-rummet) | kasse | 6.85 | -44.73 | 2.02 | 2.14 | 0 | -1.25 | -0.21 | 1.04 | (514.12, 75.00) | 29.81 |
| L05 | Ramp-top (forbindelse til Ramp-rummet) | kasse | -1.70 | -44.00 | 2.70 | 2.25 | 0 | -1.77 | 0.93 | 2.70 | (495.12, 73.38) | 32.33 |
| L06 | Ramp-top (forbindelse til Ramp-rummet) | nedsænket felt/fordybning | 0.10 | -43.10 | 18.00 | 9.00 | 0 | 0.93 | -1.77 | -2.70 | (499.12, 71.38) | 26.33 |
| L07 | Tag-stykke (printet fladt, separat del) | nedsænket felt/fordybning | 27.44 | -36.97 | 30.15 | 17.21 | 0 | -9.31 | -9.64 | -0.33 | (559.88, 57.75) | 8.85 |
| L08 | Tag-stykke (printet fladt, separat del) | platform/blok | 33.29 | -36.97 | 4.73 | 7.99 | 0 | -9.71 | -9.57 | 0.14 | (572.88, 57.75) | 9.01 |
| L09 | Tag-stykke (printet fladt, separat del) | platform/blok | 38.18 | -36.91 | 3.26 | 12.83 | 0 | -9.71 | -9.57 | 0.14 | (583.75, 57.62) | 9.01 |
| L10 | Tag-stykke (printet fladt, separat del) | nedsænket felt/fordybning | 26.54 | -36.74 | 6.53 | 10.01 | 0 | -8.52 | -10.09 | -1.57 | (557.88, 57.25) | 7.85 |
| L11 | Tag-stykke (printet fladt, separat del) | kasse | 27.32 | -34.21 | 1.35 | 1.35 | 0 | -10.09 | -8.52 | 1.57 | (559.62, 51.62) | 11.34 |
| L12 | Ramp-top (forbindelse til Ramp-rummet) | platform/blok | -6.31 | -34.10 | 5.17 | 5.62 | 0 | -2.62 | -1.25 | 1.37 | (484.88, 51.38) | 27.49 |
| L13 | Ramp-top (forbindelse til Ramp-rummet) | platform/blok | 6.34 | -34.10 | 5.51 | 5.62 | 0 | -1.28 | -1.25 | 0.03 | (513.00, 51.38) | 27.49 |
| L14 | Tag-stykke (printet fladt, separat del) | stolpe/søjle | 13.09 | -33.98 | 0.56 | 0.45 | 0 | -9.50 | -6.56 | 2.94 | (528.00, 51.12) | 15.70 |
| L15 | Tag-stykke (printet fladt, separat del) | nedsænket felt/fordybning | 16.87 | -33.48 | 10.12 | 13.84 | 0 | -7.02 | -9.50 | -2.48 | (536.38, 50.00) | 9.16 |
| L16 | Tag-stykke (printet fladt, separat del) | kasse | 15.91 | -33.43 | 0.56 | 1.57 | 0 | -9.50 | -6.56 | 2.94 | (534.25, 49.88) | 15.70 |
| L17 | Tag-stykke (printet fladt, separat del) | stolpe/søjle | 13.09 | -27.35 | 0.56 | 0.45 | 0 | -9.50 | -6.56 | 2.94 | (528.00, 36.38) | 15.70 |
| L18 | Mellemplateau (Bottom Ramp) | platform/blok | -0.01 | -21.67 | 8.33 | 1.69 | 0 | -6.22 | -1.25 | 4.97 | (498.88, 23.75) | 27.49 |
| L19 | Mellemplateau (Bottom Ramp) | platform/blok | -0.01 | -21.50 | 7.42 | 0.68 | 0 | -1.25 | -0.35 | 0.90 | (498.88, 23.38) | 29.49 |
| L20 | Tag-stykke (printet fladt, separat del) | container | 38.41 | -21.33 | 2.36 | 5.06 | 0 | -9.71 | -7.74 | 1.97 | (584.25, 23.00) | 13.07 |
| L21 | Tag-stykke (printet fladt, separat del) | stolpe/søjle | 28.34 | -20.83 | 0.68 | 0.68 | 0 | -9.31 | -6.53 | 2.77 | (561.88, 21.88) | 15.75 |
| L22 | Tag-stykke (printet fladt, separat del) | container | 28.34 | -19.25 | 2.02 | 5.40 | 0 | -9.31 | -7.48 | 1.83 | (561.88, 18.38) | 13.65 |
| L23 | Tag-stykke (printet fladt, separat del) | platform/blok | 26.32 | -18.40 | 9.22 | 10.24 | 0 | -9.70 | -7.61 | 2.09 | (557.38, 16.50) | 13.36 |
| L24 | Tag-stykke (printet fladt, separat del) | kasse | 20.97 | -18.07 | 1.46 | 1.69 | 0 | -9.31 | -8.87 | 0.44 | (545.50, 15.75) | 10.57 |
| L25 | Mellemplateau (Bottom Ramp) | væg/skinne | 21.87 | -18.07 | 0.34 | 1.69 | 0 | -8.87 | -5.40 | 3.46 | (547.50, 15.75) | 18.26 |
| L26 | Tag-stykke (printet fladt, separat del) | stolpe/søjle | 22.15 | -18.07 | 0.23 | 0.56 | 0 | -9.31 | -6.50 | 2.81 | (548.12, 15.75) | 15.83 |
| L27 | Tag-stykke (printet fladt, separat del) | stolpe/søjle | 28.34 | -17.68 | 0.68 | 0.68 | 0 | -9.31 | -6.53 | 2.77 | (561.88, 14.88) | 15.75 |
| L28 | Mellemplateau (Bottom Ramp) | gulvflade | -0.46 | -17.28 | 14.40 | 17.21 | 0 | -6.27 | -6.22 | 0.05 | (497.88, 14.00) | 16.44 |
| L29 | Mellemplateau (Bottom Ramp) | platform/blok | 7.58 | -16.02 | 3.71 | 1.57 | -92 | -9.31 | -6.67 | 2.63 | (515.75, 11.20) | 15.44 |
| L30 | Tag-stykke (printet fladt, separat del) | nedsænket felt/fordybning | 31.72 | -14.58 | 20.03 | 24.19 | 0 | -8.47 | -9.71 | -1.23 | (569.38, 8.00) | 8.70 |
| L31 | Tag-stykke (printet fladt, separat del) | platform/blok | 28.96 | -14.18 | 3.94 | 1.80 | 0 | -10.09 | -9.70 | 0.39 | (563.25, 7.12) | 8.72 |
| L32 | Tag-stykke (printet fladt, separat del) | væg/skinne | 22.82 | -13.23 | 2.25 | 0.11 | 0 | -10.09 | -9.70 | 0.39 | (549.62, 5.00) | 8.72 |
| L33 | Tag-stykke (printet fladt, separat del) | væg/skinne | 30.02 | -10.53 | 2.48 | 0.11 | 0 | -9.31 | -9.15 | 0.16 | (565.62, -1.00) | 9.94 |
| L34 | Tag-stykke (printet fladt, separat del) | væg/skinne | 30.25 | -9.97 | 1.80 | 0.11 | 0 | -8.86 | -8.76 | 0.10 | (566.12, -2.25) | 10.81 |
| L35 | Tag-stykke (printet fladt, separat del) | kasse | 31.82 | -9.97 | 1.12 | 1.46 | 0 | -9.71 | -8.29 | 1.41 | (569.62, -2.25) | 11.84 |
| L36 | B site | kasse | 4.66 | -9.63 | 1.01 | 1.01 | 0 | -9.31 | -6.95 | 2.36 | (509.25, -3.00) | 14.83 |
| L37 | Mellemplateau (Bottom Ramp) | kasse | -8.33 | -9.59 | 1.92 | 1.24 | 94 | -9.31 | -6.67 | 2.63 | (480.38, -3.08) | 15.44 |
| L38 | Mellemplateau (Bottom Ramp) | væg/skinne | 8.42 | -9.52 | 0.23 | 5.06 | 0 | -7.76 | -6.67 | 1.09 | (517.62, -3.25) | 15.44 |
| L39 | Tag-stykke (printet fladt, separat del) | væg/skinne | 30.37 | -9.40 | 1.80 | 0.11 | 0 | -9.50 | -9.21 | 0.29 | (566.38, -3.50) | 9.81 |
| L40 | Tag-stykke (printet fladt, separat del) | kasse | 39.87 | -9.29 | 1.24 | 1.24 | 0 | -9.31 | -7.60 | 1.70 | (587.50, -3.75) | 13.37 |
| L41 | Tag-stykke (printet fladt, separat del) | gulvflade | 14.44 | -9.18 | 11.36 | 8.89 | 0 | -6.22 | -6.22 | 0.00 | (531.00, -4.00) | 16.44 |
| L42 | Tag-stykke (printet fladt, separat del) | væg/skinne | 31.21 | -8.17 | 2.14 | 0.11 | 0 | -9.15 | -9.02 | 0.13 | (568.25, -6.25) | 10.23 |
| L43 | Tag-stykke (printet fladt, separat del) | gulvflade | 39.87 | -7.83 | 5.29 | 14.29 | 0 | -9.68 | -9.70 | -0.01 | (587.50, -7.00) | 8.72 |
| L44 | Tag-stykke (printet fladt, separat del) | kasse | 31.60 | -7.60 | 1.12 | 0.11 | 0 | -8.64 | -8.55 | 0.09 | (569.12, -7.50) | 11.28 |
| L45 | Tag-stykke (printet fladt, separat del) | kasse | 32.95 | -7.55 | 1.35 | 1.57 | 0 | -9.71 | -8.29 | 1.41 | (572.12, -7.62) | 11.84 |
| L46 | Tag-stykke (printet fladt, separat del) | væg/skinne | 31.54 | -7.04 | 1.46 | 0.11 | 0 | -9.31 | -8.93 | 0.37 | (569.00, -8.75) | 10.42 |
| L47 | Tag-stykke (printet fladt, separat del) | væg/skinne | 28.39 | -6.31 | 7.65 | 0.11 | 90 | -9.27 | -9.00 | 0.27 | (562.00, -10.38) | 10.27 |
| L48 | Tag-stykke (printet fladt, separat del) | væg/skinne | 29.41 | -5.92 | 6.86 | 0.11 | 90 | -9.31 | -9.11 | 0.20 | (564.25, -11.25) | 10.03 |
| L49 | Tag-stykke (printet fladt, separat del) | væg/skinne | 29.63 | -5.08 | 5.17 | 0.11 | 90 | -9.31 | -8.99 | 0.31 | (564.75, -13.12) | 10.29 |
| L50 | Tag-stykke (printet fladt, separat del) | væg/skinne | 30.19 | -4.79 | 4.61 | 0.11 | 90 | -8.64 | -8.55 | 0.10 | (566.00, -13.75) | 11.28 |
| L51 | Tag-stykke (printet fladt, separat del) | væg/skinne | 30.76 | -4.73 | 4.50 | 0.11 | 90 | -9.31 | -8.95 | 0.36 | (567.25, -13.88) | 10.38 |
| L52 | Tag-stykke (printet fladt, separat del) | stolpe/søjle | 39.70 | -3.73 | 0.68 | 0.68 | 0 | -9.31 | -8.79 | 0.51 | (587.12, -16.12) | 10.73 |
| L53 | B site | nedsænket felt/fordybning | 6.40 | -0.85 | 30.60 | 26.66 | 0 | -6.67 | -9.31 | -2.63 | (513.12, -22.50) | 9.59 |
| L54 | Tag-stykke (printet fladt, separat del) | stolpe/søjle | 31.88 | 2.47 | 0.79 | 0.68 | 0 | -9.31 | -8.66 | 0.64 | (569.75, -29.88) | 11.02 |
| L55 | Tag-stykke (printet fladt, separat del) | platform/blok | 31.82 | 4.21 | 5.17 | 9.11 | 0 | -9.71 | -9.57 | 0.14 | (569.62, -33.75) | 9.01 |
| L56 | B site | kasse | 6.12 | 8.54 | 1.24 | 1.35 | 0 | -9.31 | -8.26 | 1.05 | (512.50, -43.38) | 11.92 |
| L57 | B site | cylinder | -0.52 | 8.71 | 2.36 | 2.36 | 0 | -6.22 | -4.33 | 1.89 | (497.75, -43.75) | 20.64 |
| L58 | B site | kasse | 7.47 | 9.22 | 1.69 | 1.57 | 0 | -9.31 | -7.74 | 1.57 | (515.50, -44.88) | 13.08 |
| L59 | Tag-stykke (printet fladt, separat del) | gulvflade | 30.47 | 11.18 | 28.80 | 19.24 | 0 | -9.80 | -9.71 | 0.09 | (566.62, -49.25) | 8.69 |
| L60 | B site | kasse | -9.18 | 11.24 | 0.56 | 1.35 | 0 | -9.31 | -7.02 | 2.28 | (478.50, -49.38) | 14.66 |
| L61 | B site | kasse | -8.45 | 12.20 | 0.90 | 0.56 | 0 | -9.31 | -6.67 | 2.63 | (480.12, -51.50) | 15.44 |
| L62 | B site | stolpe/søjle | 7.92 | 12.20 | 0.79 | 0.56 | 0 | -9.31 | -6.67 | 2.63 | (516.50, -51.50) | 15.44 |
| L63 | Tag-stykke (printet fladt, separat del) | nedsænket felt/fordybning | 19.39 | 13.94 | 1.57 | 0.11 | 90 | -9.80 | -10.04 | -0.24 | (542.00, -55.38) | 7.96 |
| L64 | Secret-gangen → Secret-trappen | væg/skinne | -6.03 | 14.67 | 0.34 | 1.69 | 0 | -5.17 | -1.25 | 3.92 | (485.50, -57.00) | 27.49 |
| L65 | Secret-gangen → Secret-trappen | platform/blok | 2.53 | 14.72 | 16.79 | 4.54 | -170 | -6.22 | -5.17 | 1.05 | (504.52, -57.12) | 18.77 |
| L66 | Secret-gangen → Secret-trappen | gulvflade | -12.50 | 15.85 | 8.10 | 11.25 | 0 | -9.16 | -9.31 | -0.14 | (471.12, -59.62) | 9.59 |
| L67 | Tag-stykke (printet fladt, separat del) | gulvflade | 14.19 | 20.97 | 34.33 | 18.93 | -31 | -6.25 | -6.22 | 0.03 | (530.43, -71.00) | 16.44 |
| L68 | Secret-gangen → Secret-trappen | kasse | 19.34 | 35.77 | 1.12 | 1.12 | 0 | -1.25 | -0.60 | 0.65 | (541.88, -103.88) | 28.94 |
| L69 | Secret-gangen → Secret-trappen | platform/blok | 19.34 | 37.00 | 6.30 | 9.45 | 0 | -2.26 | -1.25 | 1.01 | (541.88, -106.62) | 27.49 |
| L70 | Secret-gangen → Secret-trappen | kasse | 24.01 | 40.43 | 2.81 | 2.59 | 0 | -6.22 | -3.87 | 2.35 | (552.25, -114.25) | 21.67 |

## 4. Ramper og trapper

| ID | Område | Spil x | Spil z | Bredde m | Dybde m | y lav | y høj | Stiger mod |
|---|---|---:|---:|---:|---:|---:|---:|---|
| UR1 | Garage (SØ) | 17.42 | 40.29 | 2.25 | 2.81 | -1.16 | 0.00 | vest |
| UR2 | T Outside / Silo | -16.50 | 14.13 | 7.31 | 2.25 | 6.96 | 7.65 | nord |
| UR3 | CT-siden (Ø) · hævet plads + ramper | 28.22 | 4.96 | 4.73 | 5.06 | 0.00 | 2.09 | nord |
| UR4 | CT-siden (Ø) · hævet plads + ramper | 24.90 | -10.00 | 2.36 | 3.49 | 0.00 | 2.09 | øst |
| UR5 | A-bygningen (A site / Hell) | 7.80 | -13.21 | 0.79 | 2.02 | 0.00 | 1.24 | øst |
| UR6 | Ramp-rummet (N for A) | -6.32 | -33.96 | 5.17 | 5.51 | -1.28 | 0.00 | syd |
| UR7 | Ramp-rummet (N for A) | 6.34 | -33.96 | 5.51 | 5.51 | -1.28 | 0.00 | syd |
| LR1 | Secret-gangen → Secret-trappen | 22.06 | 38.72 | 6.75 | 5.96 | -6.22 | -1.25 | vest |
| LR2 | Secret-gangen → Secret-trappen | -6.01 | 19.37 | 4.84 | 4.16 | -9.31 | -6.22 | øst |
| LR3 | Tag-stykke (printet fladt, separat del) | 19.08 | 13.91 | 0.56 | 1.57 | -9.96 | -9.71 | vest |
| LR4 | Tag-stykke (printet fladt, separat del) | 12.78 | 7.28 | 4.16 | 6.08 | -9.31 | -6.22 | syd |
| LR5 | Tag-stykke (printet fladt, separat del) | 31.91 | 2.38 | 1.91 | 1.91 | -9.57 | -8.66 | syd |
| LR6 | Tag-stykke (printet fladt, separat del) | 18.07 | -2.29 | 4.16 | 4.95 | -9.31 | -6.22 | nord |
| LR7 | Tag-stykke (printet fladt, separat del) | 31.06 | -5.32 | 2.70 | 5.62 | -8.93 | -8.29 | øst |
| LR8 | Tag-stykke (printet fladt, separat del) | 39.67 | -3.69 | 1.91 | 1.91 | -9.70 | -8.79 | nord |
| LR9 | Mellemplateau (Bottom Ramp) | 8.68 | -9.54 | 0.23 | 5.06 | -6.67 | -6.22 | øst |
| LR10 | Mellemplateau (Bottom Ramp) | -0.04 | -11.45 | 5.51 | 5.74 | -9.31 | -6.22 | nord |
| LR11 | Tag-stykke (printet fladt, separat del) | 27.46 | -14.15 | 7.20 | 2.14 | -9.71 | -7.61 | vest |
| LR12 | Mellemplateau (Bottom Ramp) | 6.76 | -16.18 | 0.23 | 3.71 | -6.67 | -6.22 | vest |
| LR13 | Tag-stykke (printet fladt, separat del) | 28.36 | -19.27 | 2.48 | 5.85 | -7.61 | -6.53 | vest |
| LR14 | Ramp-top (forbindelse til Ramp-rummet) | 0.13 | -32.15 | 18.00 | 13.84 | -6.22 | -1.25 | nord |
| LR15 | Tag-stykke (printet fladt, separat del) | 18.29 | -33.50 | 4.39 | 1.69 | -9.50 | -6.56 | vest |

## 5. Vægge (vægspor i printet) og åbninger

Modellen er printet i dele: væggene sidder som separate stykker i spor i gulvpladen. Sporene er målt her – tynde spor = vægge (tykkelse ≈ 0,4–0,6 m), større felter = åbninger/skakte uden topflade.

| ID | Område | Type | Spil x | Spil z | Længde/bredde m | Dybde m | Rotation ° |
|---|---|---|---:|---:|---:|---:|---:|
| UW1 | Garage (SØ) | vægspor (væg) | 17.70 | 30.33 | 0.56 | 1.12 | 0 |
| UW2 | Garage (SØ) | vægspor (væg) | 22.43 | 30.33 | 0.56 | 1.12 | 0 |
| UW3 | Garage (SØ) | vægspor (væg) | 17.70 | 23.47 | 0.56 | 1.35 | 0 |
| UW4 | Garage (SØ) | vægspor (væg) | 22.43 | 23.47 | 0.56 | 1.35 | 0 |
| UW5 | Outside (gården, S) | vægspor (væg) | 0.77 | 23.58 | 9.00 | 0.45 | 0 |
| UW6 | Outside (gården, S) | vægspor (væg) | -4.01 | 20.60 | 0.56 | 5.51 | 0 |
| UW7 | Outside (gården, S) | vægspor (væg) | 5.55 | 22.51 | 0.56 | 1.69 | 0 |
| UW8 | Garage (SØ) | vægspor (væg) | 20.07 | 22.51 | 4.16 | 0.56 | 0 |
| UW9 | Garage (SØ) | åbning/skakt (ingen top-flade) | 25.18 | 20.54 | 6.08 | 3.38 | 0 |
| UW10 | Outside (gården, S) | vægspor (væg) | 5.55 | 18.23 | 0.56 | 0.79 | 0 |
| UW11 | A-bygningen (A site / Hell) | åbning/skakt (ingen top-flade) | -6.37 | 14.30 | 7.54 | 5.96 | 0 |
| UW12 | A-bygningen (A site / Hell) | åbning/skakt (ingen top-flade) | 6.17 | 10.19 | 7.42 | 14.18 | 0 |
| UW13 | A-bygningen (A site / Hell) | vægspor (væg) | -5.13 | 13.73 | 1.69 | 0.11 | 0 |
| UW14 | Lobby-bygningen (Lobby · Hut · Squeaky · Radio) | vægspor (væg) | -21.62 | 13.12 | 4.50 | 0.45 | 0 |
| UW15 | Lobby-bygningen (Lobby · Hut · Squeaky · Radio) | vægspor (væg) | -11.83 | 13.12 | 2.48 | 0.45 | 0 |
| UW16 | Lobby-bygningen (Lobby · Hut · Squeaky · Radio) | vægspor (væg) | -24.15 | 10.64 | 0.56 | 4.50 | 0 |
| UW17 | A-bygningen (A site / Hell) | åbning/skakt (ingen top-flade) | -9.52 | 8.22 | 1.24 | 2.81 | 0 |
| UW18 | A-bygningen (A site / Hell) | vægspor (væg) | -6.60 | 8.17 | 3.49 | 0.45 | 0 |
| UW19 | Lobby-bygningen (Lobby · Hut · Squeaky · Radio) | vægspor (væg) | -25.95 | 7.66 | 7.31 | 0.56 | 0 |
| UW20 | Lobby-bygningen (Lobby · Hut · Squeaky · Radio) | vægspor (væg) | -14.58 | 7.66 | 7.99 | 0.56 | 0 |
| UW21 | A-bygningen (A site / Hell) | vægspor (væg) | -4.46 | 4.46 | 0.34 | 6.98 | 0 |
| UW22 | T-side (vest, indgang fra T Spawn) | vægspor (væg) | -29.88 | 2.48 | 0.56 | 8.66 | 0 |
| UW23 | A-bygningen (A site / Hell) | åbning/skakt (ingen top-flade) | 2.40 | -9.44 | 25.09 | 28.91 | 0 |
| UW24 | A-bygningen (A site / Hell) | vægspor (væg) | -7.89 | 0.63 | 0.90 | 0.45 | 0 |
| UW25 | A-bygningen (A site / Hell) | vægspor (væg) | -5.36 | 0.63 | 1.01 | 0.45 | 0 |
| UW26 | CT-siden (Ø) · hævet plads + ramper | vægspor (væg) | 17.08 | -2.29 | 4.95 | 0.45 | 0 |
| UW27 | Lobby-bygningen (Lobby · Hut · Squeaky · Radio) | vægspor (væg) | -28.82 | -2.58 | 1.57 | 0.56 | 0 |
| UW28 | Lobby-bygningen (Lobby · Hut · Squeaky · Radio) | åbning/skakt (ingen top-flade) | -23.35 | -8.97 | 13.55 | 2.98 | -94 |
| UW29 | CT-siden (Ø) · hævet plads + ramper | åbning/skakt (ingen top-flade) | 19.22 | -5.67 | 1.80 | 6.08 | 0 |
| UW30 | Lobby-bygningen (Lobby · Hut · Squeaky · Radio) | åbning/skakt (ingen top-flade) | -14.92 | -7.92 | 7.99 | 4.95 | 0 |
| UW31 | CT-siden (Ø) · hævet plads + ramper | vægspor (væg) | 19.84 | -13.55 | 0.56 | 3.15 | 0 |
| LW1 | Secret-gangen → Secret-trappen | åbning/skakt (ingen top-flade) | -3.84 | 14.87 | 11.86 | 5.44 | 177 |
| LW2 | Secret-gangen → Secret-trappen | åbning/skakt (ingen top-flade) | 5.81 | 15.54 | 9.79 | 3.49 | 0 |
| LW3 | Tag-stykke (printet fladt, separat del) | åbning/skakt (ingen top-flade) | 21.78 | 16.28 | 1.69 | 1.80 | 0 |
| LW4 | B site | åbning/skakt (ingen top-flade) | 9.52 | 8.40 | 2.36 | 8.10 | 0 |
| LW5 | Tag-stykke (printet fladt, separat del) | åbning/skakt (ingen top-flade) | 12.16 | -3.02 | 7.65 | 7.99 | 0 |
| LW6 | Tag-stykke (printet fladt, separat del) | åbning/skakt (ingen top-flade) | 23.02 | -18.09 | 1.91 | 1.69 | 0 |

## 6. Sådan er spillets Nuke bygget ud fra modellen (v12.1)

* **Hele banen genereres fra STL-filerne** (`tools/nuke_from_stl.py`): hver 0,225 m-celle af printet bliver geometri – gulve og trin præcis i printets højder, vægsporene bliver mure med de højder printets hjørnestolper angiver, underetagens massive blok bliver B-niveauets rum, kanter og plateauer.
* Ramper og trapper (Ramp, Ramp-banerne, B-rampen, Window-, Tunnels- og Back Vents-ramperne, CT-ramperne, Secret-rampen og den knækkede Secret-trappe) er målt i printets skrå flader; stigerne (T Roof og vent-skakten) står hvor printets trin står.
* Props (kasser, containere, lastbilen i Garage, Siloen, de to tanke i A, reaktoren i B) har printets mål og højder. T Red og CT Red er røde containere.
* **Tilføjet fordi printet ikke kan vise det:** T Spawn og CT Spawn (uden for printet – lagt ind efter radaren), døren fra Lockers ind i A (printet viser kun vægspor, ikke døråbninger), tage/lofter over bygningerne (taget ligger som separate plader i printet) og banens yderkant.