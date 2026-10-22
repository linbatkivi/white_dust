# White Dust – fremskridt: progression, belønninger og nye systemer

Arkitektur: der er ingen server i skyen (P2P via PeerJS). Spillerens profil (XP, level, mønter, missioner, trofæer, mastery,
hideout) gemmes lokalt og sendes med i kampen; kampens server (værtens app) tildeler XP/mønter ud fra det der skete.
Venner og fraktioner udveksler data direkte mellem spillerne via PeerJS (ingen ny backend).

| #  | Punkt                                                          | Status        |
|----|----------------------------------------------------------------|---------------|
| 0  | Knive holdes rigtigt: M9/KA-BAR vendt, kniven synlig i 3. person (holdtes som en pistol, pegede ind i kameraet) | ✅ færdig     |
| 1  | Flere slags MVP-cutscenes: bullseye, række af skiver (3+ drab), knivkast, desarmering, går fra eksplosionen, nedtælling | ✅ færdig     |
| 2  | XP, levels 1–100, ranks Bronze → Elite, titler/profilkort/badges, KARRIERE-hub, level ved navne | ✅ færdig     |
| 3  | Missioner: 3 daglige + 3 ugentlige (samme for alle venner), Sæson 1 · Penthouse (10), udforskning og ruter, mønter | ✅ færdig     |
| 4  | Mønter (kampe + missioner) og BUTIK: titler, profilkort, badges, navnefarver, dagens tilbud – kun kosmetik | ✅ færdig     |
| 5  | Trofæer: 24 (bronze/sølv/guld, 3 hemmelige) – Master of Heights, Kartograf, Kældermennesket, Kaffepause …; guld = badge | ✅ færdig     |
| 6  | Mastery pr. våben/udstyr (level 1–10): bronze/sølv/guld-charm på våbnet (ses af alle), guld = snurre-inspect (F) | ✅ færdig     |
| 7  | Bounty: 3 drab i træk → Bounty Target ($1000 + 250 pr. drab), chip/banner, rødt mærke (skjult bag vægge), +$300 til holdet, XP og trofæer | ✅ færdig     |
| 8  | Dynamiske events (30 % fra runde 3, aldrig to i træk): tæt tåge (~15 m), skybrud (lyn + regn), strømafbrydelse (rødt pulserende nødlys, lommelygter afslører spillere) · banner + chip | ✅ færdig     |
| 9  | Interaktive kortmekanikker (porte, projektører, damp)          | ✖ skrottet    |
| 10 | Fraktioner: Aurum / Vanta / Nocturne kæmper om 10 bydele på de_bureau; sæsonkort, ugeopgørelse (XP, mønter, titel/badge), regnskab deles mellem alle man spiller med | ✅ færdig     |
| 11 | Hideout (KARRIERE → HIDEOUT): 3D-rum med trofævæg (pokal pr. trofæ i bronze/sølv/guld, mus over = navn), mastery-plader, rank-banner, fraktionsflag og 12 dekorationer fra BUTIKKEN | ✅ færdig     |
| 12 | Venner: vennekode WD-XXXXXXXX, seneste medspillere, sammenlign level/statistik/trofæer/mastery side om side, besøg vennens hideout; kort udveksles via pub-relæ og PeerJS | ✅ færdig     |


## v26.7 (2026-10-21)
- Sprogvalg: engelsk (standard), dansk, fransk, spansk, tysk, mandarin – menu og indstillinger; ordbog i `tools/i18n/*.txt` → `node tools/i18n/build.py`.
- Introen slutter nu præcis i spillerens øjne (kameraet blev skubbet 7,8 m tilbage af kamera-sikringen).
- Rundetimer: HUD-loopet stoppede når et element manglede (`setText` null-sikret).
- Pistoler (undtagen deagle) kan ikke dræbe med ét headshot (2,2×).
- Bane: yaw-fix i bageren (alt vendte samme vej), vægbilleder flugter med væggen i øjenhøjde, racks flyttet ind i A-hallen, store planter (3 typer) i stedet for småplanter.
- Hænder: skinnede, glatte fingre (`public/js/hands.js`) + levende fingre; knive i tredjeperson holdes rigtigt.
- Fraktionsnavne: Aurum / Vanta / Nocturne. CS-referencer fjernet (våbennavne, sjældenheder, knivnavne, bane-callouts, dokumenter, README).
- Trailer: `▶ TRAILER` i menuen (afspilles i motoren) eller `node scripts/record-trailer.js` → `docs/trailer/white_dust_trailer.webm`.

## v26.9 – Valkyrie (nyt map, Ancient-retning)
- **Bane**: `valkyrie` – overgroede mesoamerikanske jungleruiner efter konceptkortet (tools/valkyrie/). B-site er rykket til sydvest (B Long), tæt på SWAT; løbetider T→A ≈16 s, T→B ≈14 s, SWAT→A ≈10 s, SWAT→B ≈13 s (`python3 tools/valkyrie/pathlen.py`).
- **Pipeline**: `gen/layout.py` (tegnet layout + højder/trapper) → `gen/gen.py` + `rooms.py` + `dress.py` (trinpyramider, pilastre, relieffer, dækning, planter) → `export_collision.py` (shared/valkyrie_data.js) → `build_plants.py` (egne bladnet: bregner, bananer, vedbend, lianer, træer, grene) → `blender … build.py -- bake` (dagslys: HDRI + sol som lampe, mos/snavs pr. hjørne) → `textures.py` → `tools/radar/valkyrie_radar.py`. QA: `qa_floaters.py` (svævere/usynlige barrierer), `node test/nav.js valkyrie`.
- **Højder**: A Heaven +2,0 m, Upper Mid +2,4 m, B-udgravningen −1,2 m (4 trapper, 2 ramper).
- **Spillet**: banevalg i lobby/veto, venteværelset følger banen (navn, mission, baggrund, radar, dag/nat), junglelyd (insekter, dryp), oversættelser.
- **Fundet undervejs**: delte materialer i flere modeller fik '.001'-navne uden spilmateriale (hvide blade) → samlet til ét datablok i build.py; Poly Haven-teksturer er for lyse/blanke → dæmpes og gøres ruere i fetch_tex.py.

## v26.10 – grafik, lyd og nyt udstyr
- **Grafik**: løv/bregner/vedbend/lianer/træer som alfa-bladkort (smidige silhuetter, tæt underskov, bladskygger i banen); vand med refleksion og bølger (B-udgravningen, A Heaven-bassinet); bladene lyser let igennem. Materialebug (delte materialer → hvide blade) rettet.
- **Lyd**: rum-ekko målt med stråler (gyde = slap-back, hal/kælder = lang hale, åbent land = tørt); fodtrin pr. underlag (sten, jord, blade, vand, træ, metal) med små detaljer (grus, blade, dryp); jungleambience (insekter, dryp, frøer, fugle, aber, løv, knirken) via faste lydkilder; nedslag pr. materiale; visuelle lyd-indikatorer (indstilling).
- **Udstyr** (købes i Udstyr/Granater): desarmeringssæt (SWAT, 5 s i stedet for 10 s), termisk kikkert (N, 5 s batteri pr. runde, ser gennem røg), bevægelsessensor (tast 9; kastes, sidder fast, bipper på holdets minikort, kan skydes ned). Desarmering tager nu 10 s.
- **Andet**: 3D-ping (midterste museknap, V på trackpad) · dynamiske fodspor efter vand/mudder på rene gulve (13 s) · mundingsglimt lyser mørke rum op (stroboskop) · dræber-postkort med 3D-snapshot af modstanderen, våben, HP.
- **Ragdoll + blod**: dødsfald som let fysik (skuddets impuls, glidning, svingende lemmer) og blodsprøjt/pøle (kan slås fra i indstillinger).
- **Replay + fri kamera** (F9 / pausemenu, når man er død eller runden er slut): de seneste runder afspilles med tidslinje, hastighed, fri/følg/orbit-kamera, billede (PNG) og 10 s-klip (WebM).
- **Dynamisk glas**: vinduer revner ved første skud (kan ikke ses tydeligt igennem) og knuses ved andet (lyden høres over hele banen); HE knuser glas i nærheden. Valkyrie har to (B Window, A Balcony). Serveren styrer stadierne.
- **Karakterer**: kantlys/'subsurface'-glød på hud og stofsheen, skarpere øjne. Nye modeller (fotorealistiske ansigter) kræver rigtige 3D-assets og er ikke lavet.
