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

## v26.11 – nye hijacker-modeller
- Første forsøg (CGTrader-base med balaclava-hoved, `hij_raid.py`) blev afvist: ansigt og hoved var for dårlige. Filerne ligger i `~/Projekter/wd-arkiv/kilder/figurer-afvist-v26.11/`.
- `tools/chars/hij_face.py` (MakeHuman/MPFB, CC0) bygger tre nye hijackere med **rigtige, synlige ansigter**: **Raider** (pandebånd, skægstubbe, feltjakke, brystrig, rygsæk), **Sprængmester** (fuldskæg, beskyttelsesbriller i panden, respirator om halsen, kedeldragt, brystrig), **Spejder** (boonie, tørklæde, patronbælte, skjorte). 10 farvevarianter.
- Pr. figur: egne ansigtsformer (MakeHuman-targets: næse, kæbe, pande, kindben, øjenposer …), hudtone, 2048-hudtekstur med skæg malet ind efter læber/hage/kæbelinje, omfarvet iris, hår-/brynfarve, eget hår (short01/03/04) med alfa-maske.
- Kør: `blender -b -P tools/chars/hij_face.py -- [hij4 hij5 hij6] [--render DIR] [--noexport]`. Materialer til varianter: Top, Pants, Vest, Gloves, Pads, Band, Pack, Roll · Rubber, Filter, Lens · Boonie, HatBand, Scarf, Strap, Shell.
- Begrænsning: ansigterne er MakeHuman-kvalitet (pæne spilfigurer, ikke fotoscanninger); huden har kun diffuse-tekstur.

## v26.12 – fysik, bots, netcode, musikkits
- **Grafik**: Valkyrie har afrundede vægkanter (7 cm bevel, 1 segment; 592 k trekanter), kantudglatningen (FXAA) fanger flere kanter, visuelle lyd-pile er fjernet. (Bureau-afrunding gav 1,3 mio. trekanter og er slået fra.)
- **Fysiske/destruerbare props** (`public/js/dprops.js`, server: `dpropsFor`/`dpShot`/`dpBlast`): krukker, kurve, spande, kasser (Valkyrie) og kopper, papir, tastaturer, bærbare, kontorstole, ildslukkere (Bureau) bages ikke ind – de udgives som `<bane>/dprops.json` og er egne objekter. Skud/HE: krukker og kopper smadres (skår, jord/væske-plet, lyd), andet vælter som stiv krop (impuls, kant-kontakt, rulning, hvile), ildslukkeren sprøjter gas. Servere, TV, skærme, kameraer, elskabe og generatorer (statiske, bagte) sprøjter gnister og røg. Lamper (`shared/lamps.json`) rives løs og svinger i kabel med bevægeligt lys og flimmer.
- **Vand**: knæhøjt vand sænker farten (×0,58, også i klientens forudsigelse), plask-lyd, sensorer der kastes i vand kortslutter.
- **Blodspor**: under 20 HP efterlades pøle og vægstænk (`bleed`) hvert ~1,7 s i bevægelse – ses af alle.
- **Mundingsglød + heat haze**: ≈ ét magasin fuldautomatisk ild får løbet til at gløde (mest i mørke) og luften over det til at flimre (post-shader `uHz`).
- **Netcode**: bevægelsesbudgettet tæller klientens tid (`ts`) → ingen rubberbanding efter lag-bunker; små serverkorrektioner glider ind (`tp.soft`); adaptiv snap-frekvens pr. spiller (RTT/bufferedAmount: 20 → 10 → 7 Hz); tomme lister og holdstatus udelades i snaps. Målbar via `/netstats` (kun WD_TEST).
- **Bots** (`bots/nav.js`, `bots/aim.js`, `bots/brain.js`; host-knap BOTS i lobbyen): udfylder op til 5 mod 5. A* på spillets fysikgraf (genoptagelige jobs, ≤3 ms/tick), menneskelig sigtekurve (reaktion 150–220 ms, fjeder, rystelse, recoil-kompensation, hoved/bryst efter afstand/våben), syn med røg og synsfelt, lyd med usikkerhed (skridt/skud/genladning/plant/defuse), holdplaner (exec/fake-push, SWAT-ankre og rotation efter intel, retake med koordineret redskaber), økonomi (full/half/eco), clutch-tidsspil. Test: `WD_BOTS=1` (tests kører ellers uden bots), debug: `WD_BOTDBG=1`.
- **MVP-musikkits**: 7 syntetiserede temaer (`audio.js: kit`) i inventar › MUSIK; afspilles for alle når ejeren er rundens MVP. (Pixabay ligger bag Cloudflare-udfordring, derfor egen syntese i stedet for hentede lydfiler.)
- **Stat-Chisel**: våbnets stats (drab, vundne runder, HS%) graveres i siden af våbnet (stregtællere, tekst, ramme, kranie, forgyldt kant efter Mastery-level 1–10).
- **Rettelser (23/10)**: LAV PARTY virkede ikke i appen, fordi den indbyggede server kun får `server.js` + `shared/*.js` (bots/ og JSON-data manglede → serveren crashede ved opstart). Bots ligger nu i `shared/bots*.js`, data i `shared/lamps.js` + `shared/dprops_data.js` (generér med `node scripts/gen-shared-data.js`), og `require` er ikke-fatalt. Level-up midt i spillet er et lille kort; MVP-musik slukker baggrundsmusikken; MISSIONER/TROFÆER i pausemenuen; blod/ragdoll slået til for alle; sensoren ligger under UDSTYR; HUD-elementer (kikkert, plant-bar, dræberkort) overlapper ikke.
- **Admin-konsol** (`§`): `public/js/console.js` + `shared/admin.js` – 51 kommandoer (runde, spillere, server, bots, udstyr, miljø, debug), kun værten, parser/historik/Tab, server tjekker admin-flag.

## v26.13 – de_niseko (japansk landsby om natten)
- **Ny bane Niseko** efter brugerens præcise minimap (118 × 110 m): SWAT-spawn nord, Hijackers syd, A (zen-have + helligdom med torii) i nordøst, B (lagerhus med træbalkon og to døre) i vest, Mid med kanal, stenbro og koi-dam, Central Hall, East/Lower Hall m.fl. Alle vægge følger kortet, også de skrå.
- **Skrå kollision**: nye konvekse prismer i fysikken (`prism`/`hitXZ` i `shared/wd.js`) – skrå vægge er rigtige skrå flader uden trappetrin; huse har trinvis tagkollision uden usynlige volumener.
- **Grafik**: huse som parceller langs gangene med fælles tagprofil (machiya, butikker, værtshuse, kura, helligdom), klippede hække med kirsebær-/ahorn-/fyr-/piletræer, torii, stenlanterner, lanternesnore, blåregn, kanban, bonsai, raket zen-grus; bagt lys (lanterner, lyste skærmvinduer, måneskin realtid).
- **Vand**: planar spejling af lanterner/huse (`waterfx.js`), svømmende koi (`koi.js`), vadbare damme; ingen regn på banen. Lyd: fårekyllinger, rislende vand, vindklokker.
- **QA**: nav-test, visuals-test, Blender-QA (usynlige hitbokser / synligt i fri rute), bot-kørsel; pipeline i `tools/niseko/`.

## v26.14 (okt 2026)
- **Bots med hjerne:** forskellige ruter pr. bot (A* med straf på de foregående), roller (entry/support/lurker/carrier · anker/info/roamer), fælles viden med callouts og forsinkelse, strategi pr. runde (default/rush/split/slow/fake), skulder-peeks bag sikre vinkler, tilbagetrækning til dækning, rydning af vinkler i spring, udstyr før man går ind på et forsvaret site, radio + markører til menneskelige makkere. Svagere sigte: reaktionstid 0,2–0,4 s, perifert syn med sandsynlighed, mere spredning. Test: `node test/sim/botsim.js <bane> <runder> <fart>` (+ `test/sim/plot.py` tegner ruterne på radaren).
- **Admin-konsol:** åbner ikke pausemenuen, forslag dækker ikke loggen, `help <gruppe>`, nye kommandoer (round.skipbuy, bot.difficulty, server.maps).
- **Niseko-lyd:** fårekyllinger som korte kvidrerækker (ingen konstant hyletone), blød kanalrislen, blødere frø/koi/vand-lyde.
- **MVP-musik:** 11 rigtige, klippede numre (`tools/sounds/mvp_cut.py`) i stedet for korte synth-jingles; 9 af dem kan købes for mønter i butikken.
- **Ny forside, karriere og shop:** store LAV PARTY/JOIN, hub-dock (Shop · Opgaver · Inventar · Karriere), indstillinger som lille knap i hjørnet, karrierens sidenavigation (missioner + trofæer under én fane), shoppen som egen skærm med tilbud, nedtælling og prøvelytning.

## v26.15 – de_fattoria (toscansk vingård i den gyldne time)
- **Ny bane Fattoria** (Chianti, sen eftermiddag): vingård på en bakketop på fem niveauer. A = gammel vinkælder (hvælvinger, tønder, lysskakter, Presseriet-indgang, Kælderbalkon, Flaskelageret), B = villa-piazza med marmorfontæne og loggia (Hovedporten, Biblioteket, Staldene), Mid = Vinmarken med gennemsigtige vinrækker, 45°-stenmur og Terrakotta-terrassen (Pergola- og Biblioteks-trapper). Løbetider: SWAT → A/B ≈ 7 s, Hijackers → A/B ≈ 11–13 s (`node test/nav.js fattoria`).
- **Pipeline** (`tools/fattoria/`): `gen/layout.py` (højdefelt + overlag → kollision `shared/fattoria_data.js` + design.json) → `build.py` (Blender: terræn, arkitektur, planter, udsmykning, kulisse; bagt lys med sol, himmel og ~30 varme lamper; `world.bin` 16,8 MB / 301 k trekanter) → `textures.py` → `gen/radar.py`.
- **Grafik**: sol fra HDRI (kiara_7, 8,5° over horisonten) som rigtig skyggekaster, støvslør og solstråler, cypresser/oliventræer/piniebuer/vinstokke som egne løv-kort, indvendigt: fodlister, træpanel, indrammede billeder og loftsbjælker; trappe-/rampesider mod højere naboer lukkes (ingen huller mod himlen).
- **Lyd**: cikader og vind, grus, dryp og dæmpet rumklang i kælderen; fontæne i gården.
- **Bloom pr. bane**: `look.bloom` i temaets `post` (bruges af Bureau).
