# DE_WHITE_DUST

Et multiplayer FPS i 3D, inspireret af **SUPERHOT** (den knivskarpe hvid/sort æstetik)
og **Counter-Strike** (taktisk bombescenarie, køb-fase, SWAT vs. Hijackers).
Kører lokalt med Node.js og kan deles med venner over internettet via **ngrok**.

## Kom i gang

Kræver [Node.js](https://nodejs.org) 16 eller nyere.

```bash
npm install
npm start
```

Serveren starter på port 3000 og udskriver adresser, du kan bruge:

```
Lokalt:          http://localhost:3000
På dit netværk:  http://192.168.x.x:3000
```

Åbn adressen i en browser (Chrome/Edge/Firefox — kræver mus + tastatur).

### Spil med venner over internettet (ngrok)

1. [Installér ngrok](https://ngrok.com/download) og log ind (`ngrok config add-authtoken ...`).
2. Mens `npm start` kører, åbn en ny terminal og kør:
   ```bash
   ngrok http 3000
   ```
3. Ngrok giver dig en adresse som `https://xxxx.ngrok-free.app` — send den til dine venner.
   Både siden og spillets WebSocket-forbindelse går gennem den samme adresse, så intet
   ekstra behøves konfigureres.

Vil du ændre porten, sæt `PORT`-miljøvariablen: `PORT=8080 npm start` (husk at ngrok'e samme port).

## Sådan spiller du

1. **LAV PARTY** genererer en 4-cifret kode. Del den med dine venner.
2. De klikker **JOIN** og indtaster koden for at komme i venterummet.
3. Værten (den der oprettede rummet) klikker **START SPIL** — spillerne fordeles
   automatisk i to hold: **SWAT** (forsvarer) og **Hijackers** (angriber).
4. Hver runde starter med **12 sekunders købsfase** (+ 10 s ekstra købstid i spawn efter start) hvor I står fastlåst på jeres
   spawn og kan købe våben/granater. Derefter låses bevægelse op.
5. Hijackers skal plante C4 på **A** eller **B** site og forsvare den til den
   detonerer. SWAT skal forhindre planting eller desarmere bomben efter plant.
6. Første hold til 7 vundne runder vinder kampen (I skifter side ved runde 6).

### Taster

| Handling | Tast |
|---|---|
| Bevæg dig | `W A S D` |
| Hop | `Mellemrum` |
| Gå (lydløst) | `Shift` |
| Nedhuk | `Ctrl` / `C` |
| Sigt (museklik for at låse musen) | Klik på skærmen |
| Skyd (hold for automatild – modvirk rekyl-mønsteret ved at trække musen nedad) | Venstreklik |
| AWP-scope (til/fra) | Højreklik / `F` |
| Genindlæs | `R` |
| Skift til primærvåben / pistol | `1` / `2` |
| Skift udstyr (cyklus) | `Musehjul` |
| Kniv (løb 10 % hurtigere · venstreklik = hug, højreklik = stik, bagfra = rygstik) | `3` |
| Bladr gennem granaterne / HE / smoke / molotov·brandgranat / flashbang | `4` / `5` / `6` / `7` / `8` |
| Forrige våben | `Q` |
| Inspicér kniven | `F` (med kniven i hånden) |
| Saml våben op (går man hen over et våben med tomt primær-slot, samles det op automatisk) | `E` |
| Granat: træk splitten + opbyg kraft, kast ved slip | Hold **venstreklik**, slip for at kaste (længere hold = længere kast) |
| Granat: blødt underhåndskast (nærkamp) | Hold **højreklik**, slip for at kaste |
| Indstillinger (crosshair, mus, lyd) | `Esc` → **⚙ INDSTILLINGER** (eller fra hovedmenuen) |
| Plant / desarmér bomben (hold nede) | `E` |
| Klatre på stige | `W` mod stigen (op), `S` (ned), `Mellemrum` (hop af) |
| Ventilationskanaler (Nuke) | kun nedhukket: hold `Ctrl` / `C` |
| Købshjul (købsfase + første 10 s i spawn) | `B` åbner/lukker · klik/tryk kategori → våben · eller `1`-`9`, `0` = tilbage |
| Smid primærvåben (til en holdkammerat) | `G` |
| Scoreboard | Hold `Tab` |

## Banerne (map pool)

Værten vælger bane i lobbyen (kort med radar-forhåndsvisning). Banen låses ved spilstart og skifter **aldrig** af sig selv
efter en runde eller kamp. Alle baner er defineret i `shared/wd.js`, så server og klient altid har præcis samme kollision.

### de_nuke — atomkraftværk i to etager (A oppe, B nede under) · v11: bygget efter CS:GO-radaren
Layoutet er tegnet direkte efter radaren i CS-skala (0,2 m pr. radar-pixel → samme løbetider som originalen).
Orientering som radaren: nord = op, T Spawn mod vest, CT Spawn mod øst, Outside mod syd. B-etagens indsat på radaren
ligger korrekt *under* overetagen (Bottom Ramp under Ramp room, B under A, Secret under Outside).

* **T-siden:** T Spawn → **Lobby**-bygningen (Lobby, **Hut**, **Squeaky** med knirkende dør, **Radio**; **T Roof** ovenpå med stige)
  → **Trophy** → **Control** → **Ramp room**.
* **A-site:** stor reaktorhal med **Hut**-dør og -vindue, **Squeaky**-døren, **Tetris** (SV), **Mustang** (hævet platform, NV),
  **Rafters** og **Heaven** (gitterbalkon over **Hell**, stige op gennem en luge + trappe fra CT Spawn), **Main** ud til Outside
  og **Hatch** – en gulvluge i A, man kan droppe igennem direkte ned i B.
* **CT-siden:** **Lockers** mellem A og CT Spawn, **Turnpike** fra Ramp room ned i Hell, **CT Box/Bridge** ned mod Outside.
* **Outside:** stor yard med **Silo**, **T Red**, **CT Red**, containere, **Garage** (porte mod yarden og CT),
  **Secret**-trappen (åbent løb + repos + overdækket løb ned til B-etagen) og **Vent**-indgangen.
* **B-etagen:** **Ramp** ned mod nord → **Bottom Ramp** (U-vending) → **B-site** med reaktor · **Window** · **Doors** →
  **Tunnels** → **Secret** · **Decon** · **Back Vents** (kun nedhuk) fra Vent-indgangen via en skakt med stige.
* Testet: alle 30+ områder kan nås og forlades fra begge spawns, ventilation/stiger/hatch virker med den rigtige fysik,
  ingen sigtelinje mellem spawns, og CT når Heaven, Ramp room, B (via Hatch), CT Red og Secret før T.

### de_inferno — gammel italiensk landsby (v13, inspireret af CS2-Inferno)
Genereres af `tools/inferno_gen.py` → `shared/inferno_data.js` (husmasse udskåret i 0,5 m-celler, så gaderne kan snoe sig).
* **T-siden:** T Spawn → **T-rampen** → krydset: **Banana** (smal, snoet gade der stiger mod B: Bottom Banana, **Car**, **Logs**,
  **Sandbags**, Top Banana) · **Second Mid** → **Mid** → **Top Mid** · **Halls** (lille gyde med to knæk og en bue mellem Mid og Banana)
  · **T Apps**: trappehus op til **lejlighederne** på 1. sal – en kæde af små rum (soveværelse, stue med vindue ud over Mid,
  køkken, gang) → **Boiler** → **Balcony** over A med trappe ned.
* **A:** piazza med **Graveyard** (hævet gravbed med cypresser), **Pit** (sænket hjørne), **Quad** (CT's indgang fra øst),
  **Short** (smal gyde med bue og trin ned), **Library** (indendørs, fra CT-gården) og **Arch** (overdækket port fra Top Mid).
* **B:** hævet kirkeplads – **Church** med trappe og port, **Coffins**, springvand, appelsinbede (**Oranges**), **Construction** mod CT.
* Huse i okker/terracotta/rosa/creme (nogle med afskallet puds), tegltage med udhæng, skodder, smedejernsaltaner med
  pelargonier, lanterner, vasketøj over gaderne, butiksskilte med markiser, vejaltre, efeu, brønd, cypresser og en campanile i horisonten.

### de_havn — nordisk havnebydel (v15: forfattet i Blender med bagt global belysning)
En gammel havnebydel en klar sommereftermiddag. Kanalen deler banen og kan krydses i tre højder:
- broerne (Klapbroen i nittet stål og Sydbroen i granit med segmentbue),
- gaden over Slusen,
- nede ved vandet over pontonen under Klapbroen og færgeprammen.

T starter på Banegården med godsvogne på havnebanen. CT starter på Kastellets vold med kanoner og Dannebrog.
- **A** er Toldbodpladsen ved den klassicistiske toldbod, træmolen og det hollandske sejlskib.
- **B** er Fiskehallen med galleri og en iskælder, der nås gennem Krybegangen fra kajen.

Midten består af:
- Torvet med springvand og kiosk,
- Smøgen med Baggården og Porten gennem huset,
- Pakhuset med loft og luge ud mod Torvet,
- Kirkepladsen med teglstenskirken med vesttårn og kobberspir.

Banen er bygget med en helt anden metode end de andre: modelleret proceduralt i Blender (`tools/havn/`) med fotoscannede
CC0-materialer og -modeller fra Poly Haven. Lyset er bagt med Cycles (himmel og tilbagekastet lys, støjfjernet med OIDN), og solen
tegnes i realtid.
Kollisionen kommer fra samme layoutfil. Se `docs/maps/havn/DESIGN.md`.

### de_white_dust — ørkenby i eftermiddagssol
A (hævet) og B (sænket), Long A, Catwalk, Pit, Upper/Lower Tunnels, balkoner, broer og closets. **Mid er ikke længere åbent:**
T kommer kun ind i Mid i østsiden, et ruinhus står midt i Mid, og CT-siden har kun den vestlige Mid-dør – ingen sigtelinje
mellem spawns. Facader med skodder-vinduer, stenbuer over døråbninger, markiser over hoveddørene, lygter med fast afstand.

### de_ancient — jungle-tempel (v14: nyt layout tættere på CS2-Ancient)
Genereres af `tools/ancient_gen.py` → `shared/ancient_data.js` (samme 0,5 m-celle-metode som Inferno: alt der ikke er gang,
plads eller rum er murmasse med ruinernes varierende murkroner). T Spawn mod syd, CT Spawn mod nord, **A mod vest, B mod øst**.
* **T-siden:** T Spawn (lysning med terrasser) → **T Ramp** → **A Main** (lang stengang mod vest med to knæk) → **Elbow** → A,
  eller **Red Room** (overdækket rum med rød stuk og fakler) over til Mid.
* **Mid:** S-formet gade med en **vandkanal** på tværs (lidt lavere, vand og kantsten) og **House** på østsiden – ingen lige
  linje mellem spawns. Mid fører op til **Top Mid** (hævet plads med **obelisk**), hvorfra **Donut** (ringgang om en stenblok)
  går mod A, **B Short** ned i B og **CT Mid** (forskudt) mod CT.
* **A = Temple:** hævet 1,6 m – overdækket søjlegang, alter med trin, helligdom bagerst; indgange fra Elbow, Donut og
  Temple-trappen fra CT.
* **B:** sænket bassin (−1,2 m) med **vandfald**, knækket søjlerække og alter-sten; T kommer ind via **B Lane** → **Cave**
  (mørk tunnel fra House) / **B Ramp**, CT via **Ruins** og B Short.
* Træer (kollision på stammen), plantebede, krukker, blokke og søjlestumper er håndplaceret efter QA-varmekortet
  (dækning i hjørnerne, ikke i løbelinjen).

### Taktisk balance (testet automatisk)
* **Ingen sigtelinje mellem T- og CT-spawn** på nogen bane (tusindvis af øjenhøjde-par testes).
* **SWAT når forsvarspositioner først:** fx Nuke – Ramp room 5,0 s før, Outside 2,7 s før, B 8,9 s før; White Dust –
  Mid-døren 7,3 s og Catwalk 2,2 s før; Inferno – Top Mid 7,4 s, A via Short 7,4 s og Banana 2,1 s før; Ancient (v14) –
  Top Mid 2,8 s, A via Elbow/Donut 7,2–7,3 s, B via B Ramp 7,5 s og via B Short 5,7 s før.
* Chokepoints, 90°-hjørner og dækning i alle forbindelser.

## Arkitektur (for den nysgerrige / for videreudvikling)

```
server.js            Node/HTTP + WebSocket-server: lobby, runder, køb, bombe,
                     hitscan-skydning med lag-kompensation, granatfysik.
shared/wd.js         Delt fysik- og kortmodul (server OG klient): baner i flere tile-lag
                     (Nukes B-etage under A), stiger, rumligt kollisionsgitter, raycasts.
public/index.html    HTML-skelet: menu, lobby med map pool, HUD, købsmenu.
public/css/main.css  Visuel stil (HUD, menuer).
public/js/app.js     Klienten: netværk, input, HUD, rendering-loop, førstepersonsvåben.
public/js/visuals.js Banens rendering: verdensmesh, BAGT LYS (himmel-synlighed + lamper),
                     lys-prober til spillere/våben, døre, himmel, LOD.
public/js/themes.js  Fælles bibliotek (teksturer, props, vegetation, gelændere, stiger, lamper).
public/js/theme_nuke.js · theme_dust.js · theme_ancient.js · theme_inferno.js   Materialer, lys og dekor pr. bane.
public/js/models.js      Minimal glTF-loader til de fotoscannede modeller + automatisk afstands-LOD (clusterLOD).
public/js/assets.js      Henter fotoscannede teksturer, HDRI og modeller pr. bane (public/assets, se CREDITS.md).
public/js/procguns.js    Procedurale våben (v14: ny AK-47).
tools/nuke_from_stl.py · inferno_gen.py · ancient_gen.py   Generatorer → shared/nuke_data.js · inferno_data.js · ancient_data.js
                         (rediger aldrig de genererede filer i hånden – ret generatoren og kør den igen).
public/js/characters.js  Spillermodeller (SkinnedMesh, 17 knogler, glat vægtet skinning, teksturatlas, IK-arme) + animation.
public/js/weapons.js     Våbenmodeller (første- og tredjeperson), hold-finish (PBR), granater, C4.
public/js/audio.js       Syntetiseret 3D-lyd (skud, fodtrin, døre, bombe, flashbang + tinnitus, ild, glas).
public/js/post.js        Post-processing: HDR, SSAO, Mie-dis, sol-stråler, bloom, FXAA, ACES, color grading pr. bane.
public/js/details.js     Mikro-detaljer (decal-atlas + regelstyret placering), gesims og skybox-ring uden for banen.
public/js/fx.js          GPU-billboard-partikler: røg (med dybdeskrivende kerne), ild, flashbang-glimt.
public/js/pbr.js         Afleder normal-/roughness-/metalness-maps fra de procedurale teksturer.
public/js/settings.js    Indstillinger: crosshair-editor med forhåndsvisning, mus-sensitivitet, master-volumen.
public/vendor/       Lokal kopi af three.js (ingen CDN-afhængighed).
test/                Automatiske tests + test/mapsvg.js (tegner en bane ovenfra som SVG).
```

**Sikkerhed mod snyd:** Klienten forudsiger sin egen bevægelse lokalt (samme
fysikkode som serveren), men serveren tjekker hver position mod et
"bevægelsesbudget" og afviser/retter urealistiske hop. Skud afgøres på
serveren med lag-kompensation (den gemmer spilleres positionshistorik og
"spoler tiden tilbage" til det tidspunkt, skytten faktisk så sit mål).

## Tests

```bash
npm test                  # alle nedenstående undtagen e2e
node test/nav.js nuke     # navigation pr. bane (også white_dust / ancient):
                          #   Dijkstra med rigtig fysik (gang, nedhuk, hop, fald, stiger), alle områder nås fra
                          #   begge spawns, ingen fælder, fysisk gang-test, ALLE stiger op/ned/hop af,
                          #   ventilation A→B og tilbage, kollisions-fuzz (36.000 frames), glidning langs alle
                          #   kasser/containere, ramper, C4-regler, spawn-til-spawn-sigtelinjer og tider
node test/visuals.js      # rendering uden browser: geometri/bagt lys uden NaN, budget, mesh = kollision,
                          #   lofter lukkede nedefra (intet gennemsigtigt), indendørs mørkere end ude,
                          #   spillermodeller animerer (alle tilstande), glat skinning, alle 16 våben/granater × 2 hold,
                          #   face-normaler: 0 inverterede trekanter og ingen vægflader vendt ind i geometrien
node test/integration.js  # 100 server-tests: lobby, banevalg, holdlåste køb, granatgrænser, skydning, bombe
                          #   (inkl. afvist plantning på kasser + fejlbesked), kast-kraft/underhånd, flashbang
                          #   (vinkel/varighed), ild (polygon-zone, 15 HP/s, smoke slukker), reconnect, halvleg,
                          #   hel kamp, stiger accepteres af anti-cheat, alle baner i multiplayer
node test/havn.js         # v15 de_havn (forfattet): filer/KTX2/lysmaps findes, gyldig geometri og budget,
                          #   grafik = kollision set ovenfra, ingen huller (kollision uden synlig flade) og ingen
                          #   spøgelsesvægge (synlig flade uden kollision) – stråler i øjenhøjde fra gå-bare punkter –
                          #   og grafik i hver rekvisits kollisionskasse
WD_QA_STRICT=1 node test/mapqa.js  # v14 bane-QA: svævende objekter, huller ud af banen, tomme områder, mørke celler
                          #   (varmekort i docs/qa/<bane>_qa.png) – strengt: 0 svævere og 0 huller
npm run test:e2e          # browser-test (kræver: npm i -D playwright && npx playwright install chromium)
```

**Ydelse (v14, målt i browseren på en Mac med Apple M3, grafik "Medium", 2560×1440 i 1× opløsning, fast kamera-tur
med 24–41 positioner pr. bane, gennemsnit over 8 frames inkl. skyggekort og post-processing):**

| Bane | Median | Værste position | Draw calls (hovedpas, median / maks) | Byggetid |
|---|---|---|---|---|
| Nuke | 10,3–11,1 ms | 11,6–14,5 ms | 285 / 374 | 2,8–3,7 s |
| Inferno | 11,7 ms | 14,4 ms | 234 / 439 | 2,6 s (4,3 s koldt) |
| Ancient | 11,5 ms | 12,7 ms | 192 / 263 | 0,9–2,7 s |
| White Dust | 10,0 ms | 10,7 ms | 167 / 255 | 1,9 s |

Det svarer til 70–100 FPS uden vsync, altså luft til stabile 60 FPS. Under lang fuld belastning skruer en blæserløs Mac ned
for GPU'en (målt op til ~18 ms). Derfor sænker klienten selv opløsningen (Medium: ned til 0,8×, ≈ 7,4 ms på Nuke), når FPS
falder under ~57, og hæver den igen, når der er luft. Bagt lys beregnes én gang, når banen indlæses.

**Om ngrok:** Denne sandbox har ikke netværksadgang til ngrok.com, så det
faktiske ngrok-flow er ikke afprøvet herfra. Serveren er skrevet til at
understøtte det uden ekstra konfiguration (lytter på `0.0.0.0`, HTTP og
WebSocket på samme port, klienten bruger `location.host` dynamisk i stedet for
en hardkodet adresse) — men test det gerne selv med et par venner efter du har
hentet projektet.


## v2 – ændringer
- **Grafik:** ren hvid verden uden outlines/wireframes; dybde kun via directional light + shadow map (PCF soft). Spillere kaster skygger.
- **Våben:** unik 3D-silhuet pr. våben (USP, MP5, AK-47, M4A1, AWP, HE, Smoke), mørk finish.
- **HUD:** ammo opdateres i realtid pr. skud (klient-prediction, rettes af serverens `self`); reload-progressbar + våben-dyk; skydning låst under reload; auto-reload ved tomt magasin.
- **Inventory:** `1/2/4/5` og musehjul; aktivt item fremhæves på HUD med tastenummer.
- **Server:** `onSwitch` sender nu altid `self` (før blev våbenskift aldrig bekræftet til klienten).


## v3 – visuel opgradering
- `public/js/visuals.js` (nyt): procedurelle teksturer (gulv/mur/kasse), farvet verden pr. zone (A varm, B kold), kontakt-skygge mod gulv, dekor (planter, palmer, bannere), 3D-spillermodeller (SWAT/Hijackers) og animationsmotor.
- Belysning: hemisphere + varm sol med bløde skygger (kanter/hjørner/niveauforskelle fremhæves). Himmel + tåge i stedet for hvid.
- Animation: gå/løb, baglæns/strafe, nedhuk, hop, idle-vejrtrækning, sigte-pitch, rekyl + mundingsild, skud-reaktion (flinch), dødsfald. Alle led easer → flydende ved 20 Hz snapshots.
- Førsteperson: hænder + ærmer på våbnene.
- `shared/wd.js`: 5 nye solide props (delt server/klient). Alle tests grønne (nav, 52 integration).

## v4
- **Fysik:** i luften kan man ikke længere gå ind i kasser; i stedet 'hiver' man sig op på kanter op til 0,65 m over fødderne (`PL.MANTLE`), så man kan hoppe op på 1,0/1,5 m kasser uden at sidde fast. Samme kode kører på server og klient.
- **Minimap:** retningspilen er rettet (canvas roterer med uret, verdens-yaw mod uret). Tage/balkoner tegnes ikke længere som vægge.
- **Match-kontrol (Esc-menuen):** værten kan *NYT SPIL (GENSTART)* eller *AFSLUT TIL VENTEVÆRELSET* (bekræft med to klik). Klienter vender nu også tilbage til venteværelset ved kampens slut. Serverbeskeder: `restart`, `endgame` (kun vært).
- **Bane:** Mid-balkon + bro over Mid til Catwalk-loft (y=3,2), trapper, B-galleri (y=2,8), trappe op på Ninja-blokken, snørklet Sewer Alley (Lower Tunnels → B), døråbninger/vinduer mellem Catwalk og Long A, overliggere over døre, søjler, ruiner.
- **Detaljer:** vægsokler + gesimser, loftsbjælker i tunneler, lygtepæle (varme lyspytter), skilte, kædehegn, flere planter.

## v5
- **Item-drops:** når en spiller dør (eller forlader spillet), lægges primærvåben (med ammo), pistol, HE og smoke som fysiske objekter på jorden; C4 droppes som før. Tryk **E** nær et drop for at tage det (primærvåben byttes: dit gamle lægges ned). Pistol-drop genopfylder ammo. Drops ryddes ved ny runde. Server: `pickup`-besked, `d` i snapshot.
- **Spectator:** døde kan KUN følge levende holdkammerater (klik/mellemrum = næste, højreklik/← = forrige). Intet frit kamera, musen styrer ikke kameraet mens man er død.
- **Fog of war (minimap):** kun eget hold + dig selv. Tabt C4 vises kun for Hijackers; plantet C4 for alle. NB: fjendepositioner sendes stadig i snapshots (bruges til rendering), så skjulningen er klient-side.
- **AWP-scope:** **F** (eller højreklik) tænder/slukker scope.
- **Bane:** lygtepæle erstattet af væglamper i regelmæssig rytme (~12 m, én side pr. gang, ingen stolper i vejen); hegn fjernet; tilføjet lav betonmur med fuld collision i Long A-indgangen.

## v6
- **Holdvalg:** i lobbyen vælger hver spiller HIJACKERS eller SWAT (maks 5 pr. hold) eller lader det stå på auto. Lobbyen viser antal pr. hold og en balance-besked; uden valg fordeles spillerne så holdene bliver lige store. Start afvises hvis begge hold ikke har mindst én spiller (undtagen solo-test). Valget bevares ved genstart og efter kamp. Server: `team`-besked, `notice`-besked.
- **C4:** `WD.plantSpot()` (delt server/klient) tillader kun planting på det flade site-gulv med frit rum (0,5 m) – ikke ovenpå/ved kasser, platforme eller kanter. Prompten "HOLD E" vises kun på gyldige steder, og bomben placeres på gulvhøjde.
- **Ramper:** de 'z'-orienterede ramper havde to hjørner byttet i render-meshet (vredet/skæv overflade, som ikke passede til collision). Rettet; mesh og fysik matcher nu (testet med raycasts). Alle ramper løbes igennem i test uden fartstab.
- **Performance (uden visuelt tab):** statisk dekor flettet pr. materiale (~270 → få meshes), statiske matricer fryst, minimap-kortet tegnes én gang til offscreen-lag, DOM opdateres kun ved ændring, scoreboard-forespørgsler 4 Hz (før hver frame), tracere pooles, skudhuller er ét InstancedMesh (før 1 mesh+geometri+materiale pr. skud, aldrig frigivet), adaptiv opløsning (sænkes kun hvis <42 FPS, hæves igen når der er luft). Fysik måles til ~13 µs/frame, så den er urørt.

## v7 – map pool + grafisk løft
- **Banevalg:** værten vælger bane i lobbyen (dropdown). Banen låses ved spilstart og skifter ALDRIG af sig selv efter en kamp. Server: `map`-besked (kun vært, kun lobby), `round`-beskeden bærer `map`.
- **Baner** (alle defineret i `shared/wd.js` → `MAP_REG`; server og klient bygger samme kollision):
  - **white_dust** – opdateret: nye teksturer (512 px), tønder/containere/sandsække/betonbarrierer/paller i stedet for kasser, palmer med buede stammer og rigtige blade, tørre buske, sand-driver, murbrokker, markiser, væglamper, bedre skygger.
  - **nuke** – to lag: A-site oppe (plade med åbent skakt + Heaven-catwalk), B-site nede under, yard med silo/tanke, garage, Main, kontrolrum, nedre hal, to ramper ned (Ramp/Secret) + rampe fra CT, **stige** i skaktet. Rør-installationer, lysstofrør, gule/sorte advarselsbarrierer, damp-ventiler, tåge, lysstråle gennem loftet.
  - **ancient** – jungle-ruiner: hævet tempel (A), sænket gård (B), Mid med buer, snoet "Cave" og "Donut", mosbeklædte stenmure, søjler, altre, statuer, krukker, træer med krone-kort, bregner, slyngplanter, fakler, solstråler og støv-/pollenpartikler.
- **Stiger:** ny mekanik i `wd.js` (W op / S ned mens man vender mod væggen, hop slipper, øverst trækkes man op). Samme kode på server og klient.
- **Grafik:** `visuals.js` (motor: Batch-sammensmeltning, malere, himmel med skyer, spillermodeller) + `themes.js` (tekstursæt, props, vegetation, lys og effekter pr. bane). Alle teksturer males proceduralt (512–1024 px).
- **Performance/LOD:** al statisk geometri er sammensmeltet pr. materiale og 32 m-celle (frustum-culling), småt "detalje"-lag (blade, greebles, mos) skjules på afstand, damp/støv er partikler i én draw call hver, maks. 8 punktlys pr. bane, kun statiske matricer. Kollision urørt (AABB).
- **Tests:** `npm test` kører nav-test for alle tre baner (BFS, gang, ramper, stige, C4-regler), visuals-test (geometri/NaN/budget/culling) og integrationstesten (inkl. banevalg og multiplayer på alle baner).


## v8 – professionel opgradering
- **Nuke genopbygget fra bunden** i to etager med alle callouts (se *Banerne*), døre (Squeaky knirker), stiger, ventilation, Secret med 90°-drej.
- **White Dust:** Mid lukket med ruinhus + forskudte indgange (ingen spawn-til-spawn sigtelinje), facader, buer, markiser.
- **Ancient:** helt nyt, gennemtænkt layout med bevidst placeret vegetation (træer med kollision, plantebede).
- **Rendering:** bagt lys (himmel-synlighed + lamper pr. vertex), lys-prober til spillere/våben, ACES-tonemapping, skjulte flader fjernes,
  alle lofter/etageadskillelser lukkede (ingen gennemsigtige flader), ingen svævende tekst-plader eller tilfældige lygtepæle/hegn.
- **Spillermodeller:** bløde, proportionerede SWAT/Hijacker-modeller (SkinnedMesh), retningsbestemt gang, nedhuk, hop, knæl ved plant, IK-arme.
- **Våben:** detaljerede modeller med unikke skins – AK-47 *Ember Lacquer*, M4A1 *Arctic Hex*, AWP *Tidal Wave*, MP5 *Urban Grid*,
  USP-S *Blueprint*, Glock-18 *Desert Fade* (ny standardpistol for Hijackers), C4 med tastatur og LCD. Genladning, bolt-cyklus, patronhylstre.
- **Lyd:** 3D-placerede skud, fodtrin (gang med Shift er lydløs), døre, bombe-bip, eksplosioner.
- **Stiger:** grib stigen når man falder ned i en luge, CS-agtig styring, sikker udgang øverst (også ud i smalle kanaler).
- **Fejlrettelse:** "HOLD E FOR AT PLANTE" blev aldrig vist (forkert kald af `plantSpot`).

## v9 – taktisk dybde + grafisk transformation
- **Granater:** hold venstreklik = splitten trækkes (lyd + animation) og kraften opbygges; kastet sker når knappen slippes
  (14–25 m/s, parabelbane). Højreklik = blødt underhåndskast. Kastet ses også af de andre spillere (3.-persons-animation).
- **Flashbang:** raycast-analyse mod alle spillere i 26 m: direkte blik = 3,5 s hvid blænding der klinger langsomt af
  (med efterbillede), kigger man væk 0,8 s. Høj tinnitus-tone mens alle andre lyde dæmpes. Røg blokerer flashen.
- **Molotov (Hijackers) / brandgranat (SWAT):** antændes ved kontakt med gulv/væg eller efter 2 s og spreder en ildzone
  (3D-polygon på gulvet, radius 3,5 m, klippes af vægge/kanter) i 7 s med 15 HP/s. Flamme-/røg-/gnistpartikler og en
  flimrende orange PointLight. En smoke slukker ilden.
- **Grafik:** PBR-materialer (albedo + normal/roughness/metalness-maps) – metal reflekterer himlen, beton/mursten er ru.
  Skygge-kaskader (skarp 4096² nær-kaskade der følger kameraet + statisk kort over hele banen). SSAO, subtil bloom
  (sol, mundingsild, eksplosioner, lamper), FXAA og ACES-tonemapping. Mundingsild (0,05 s) med lys der rammer væg og hænder.
- **Gunplay:** våben-sway med inerti, fysisk kick (fjedre), procedural pattern recoil pr. våben (kan modvirkes med musen).
- **Holdvåben:** Hijackers: AK-47, Galil AR, Tec-9, Molotov · SWAT: M4A1, FAMAS, Five-SeveN, brandgranat ·
  fælles: AWP, Desert Eagle, HE, smoke, flashbang. Finish: «Worn Factory» (slidt, træ på AK) / «Tactical Graphite» (blå accenter).
- **Spillermodeller:** glat vægtet skinning, separate tøjteksturer (atlas), udstyr (plate carrier, hjelm m. NVG-holder,
  brystrig, shemagh …); animationer for idle, løb/sidelæns, nedhuk, skud/rekyl, genladning og granatkast – synkroniseret over nettet.
- **Indstillinger:** crosshair (længde, tykkelse, gap, farve/presets, prik, kontur, alpha) med live-forhåndsvisning,
  mus-sensitivitet (0,1–10) og master-volumen – gemmes i localStorage.
- **Rettelser:** røg er nu uigennemsigtig gennem AWP-zoom (billboards + dybdeskrivende kerne i stedet for GL-punkter);
  navneskilte/skilte klipper ikke ind i vægge; C4 kan kun plantes direkte på site-gulvet (strengt raycast-tjek + fejlbesked).


## v9.1 – iPad / telefon (touch)
Touch-enheder registreres automatisk (ingen mus/pointer lock nødvendig – test på desktop med `?touch=1`):
- **Venstre side:** joystick (dukker op hvor du trykker). Let tryk = lydløs gang.
- **Træk på resten af skærmen:** kig rundt (følger mus-sensitivitet fra indstillingerne).
- **SKYD:** hold for at skyde. Med en granat: hold = træk splitten og byg kraft op, slip = kast. Træk på knappen for at sigte samtidig.
- **SIGT:** AWP-scope – med en granat: blødt underhåndskast (hold/slip).
- **HOP · DUK** (til/fra) **· R** (genlad) **· E** (plant/desarmér/saml op – hold) **· ⇄** (skift våben).
- **❚❚** pause (indstillinger, forlad osv.) **· TAB** scoreboard **· KØB** åbn/luk butikken i købsfasen. Spectator: tryk for næste spiller.
- Spil på langs; i portræt på telefon vises en "vend skærmen"-besked.

## v9.2 – nyt købssystem (CS:GO-købshjul)
- **B** åbner et hjul med kategorierne PISTOLER · RIFLER · SNIPER · GRANATER → klik/tryk (eller tal 1-9) for at se og købe våbnene.
  Dit pengebeløb står i midten af hjulet og i sidepanelet. Rettet: før kunne varerne ikke klikkes (kun taltaster virkede).
- **Købsfase 12 s**, og man kan stadig købe de **første 10 s af runden** så længe man står i holdets spawn.
- **Sælg:** alt du har købt i denne runde kan sælges tilbage til fuld pris (klik på det ejede våben i hjulet eller «SÆLG» i panelet).
- **Ønsk / giv:** «ØNSK FRA HOLDET» + vælg et våben → holdkammeraterne får besked og en «GIV»-knap; giveren betaler og du får våbnet.
  **G** smider dit primærvåben, så en holdkammerat kan samle det op (også i købsfasen).

## v10 – art direction: vejrlig, mikro-detaljer, silhuetter og filmisk finish
Se **ART_DIRECTION.md** for de visuelle regler (de 6 søjler), som alt nyt indhold skal følge.
- **Vejrlig i shaderen** (alle mure, gulve og props – ingen ekstra teksturer/draw calls): makrovariation der bryder
  teksturgentagelsen, smuds/sand/mos op ad murfoden, regnløb fra murkronerne, sand-/støv-/mospletter på vandrette flader,
  blanke vandpytter og fugtkant i Nukes kælder. Styres pr. bane af `weather` i temaet.
- **Mikro-detaljer (decals):** 16 håndmalede motiver i ét atlas – håndsmuds ved døre, slid ved stiger, kridtkryds,
  tællestreger og sod på bombesites, fodspor ved spawn, revner, skjolder, rustløb, plakater, graffiti, advarselsmærkater,
  olie, blade og mos. Placeres efter faste regler og KUN på helt plane, frie flader (testet: 0 svævende/klippende).
- **Silhuetter:** profileret gesims/zinkinddækning under murkronen + en *skybox-ring* uden for banen (middelhavsby med
  tegltage og klokketårn · kraftværk med køletårn, damp og skorstene · junglekrone og trappepyramide). Intet over spilbart
  område under 11 m og ingen skygger ind på banen – granater/kugler kan aldrig ramme et "usynligt" tag.
- **Mikro-liv:** svævende sandstøv/pollen i lyset (GPU-wrap om kameraet), kondens-dryp i Nukes kanaler og kælder.
- **Filmisk finish pr. bane:** color grading (mætning, kontrast, split-toning), Mie-dis mod solen, sol-stråler,
  vignette, let skærpning og dithering (ingen banding i himlen). `?post=0` slår det fra.
- **Rettet:** A-sitets lave platform på Dust blev tegnet som en flad, sort "container" – nu en sandstensplint.


## v11 – ny Nuke (radar-layout) + fotoscannet grafik
- **Nuke bygget om efter CS:GO-radaren** (se afsnittet om de_nuke ovenfor).
- **Fotoscannede CC0-materialer** (Poly Haven, `public/assets/nuke/`, se `CREDITS.md`): beton, asfalt, præfab-facader,
  bølgeblik, container-plader, riflet stål, rustne riste og rør – med farve-, normal- og ARM-kort (AO/roughness/metalness).
- **HDRI-himmel + miljølys (IBL):** fotograferet himmel med rigtige skyer; solens retning udledes af HDRI'en, så skygger,
  sol-stråler og himmel altid passer sammen. Egen Radiance-parser (`public/js/assets.js`) – ingen eksterne afhængigheder.
- **Afrundede murhjørner** (kvart-cylindre på alle frie konvekse hjørner) og **industriarkitektur** i A-hallen, Ramp room og
  Garage: stål-tagspær med åse og skråstivere, stålprofiler på murene og kabelbakker – alt over spillerhøjde eller fladt på muren.
- Mangler assets (eller kører testene uden browser), bruges de procedurale materialer automatisk – spillet kører altid.
- **Dust og Ancient i samme stil:** fotoscannede sandstensmure, stenfliser, tegltage og trælofter (Dust) · mosgroede tempel- og
  ruinmure, brosten, klippeblokke, bark og skovbund (Ancient) · hver bane med sin egen HDRI-himmel (varm eftermiddag / fugtig
  formiddag), afrundede murhjørner og vegetation afstemt efter de nye materialer. Kreditering: `public/assets/*/CREDITS.md`.
- **v11.2 – fotoscannede 3D-modeller** (Poly Haven, CC0, `public/assets/models/` – se `CREDITS.md`): egen glTF-loader
  (`public/js/models.js`), tegnet som instancede meshes med bagt lys pr. instans. Ståltønder, el-skabe, gasflasker og
  industrielle hængelamper (Nuke) · vintønder, malede amforaer, lerkrukker, plantekummer og buske (Dust) · urner, bregner,
  buske og mosklædte klipper (Ancient). Nye props har rigtig kollision (testet: nav, glidning, ingen overlap).

## v11.3 – nye spillerfigurer, våbenmodeller, skins og inventar
- **INVENTAR** (hovedmenu, venteværelse og pausemenu): vælg **agent** pr. hold og **skin** pr. våben, med drejende 3D-forhåndsvisning.
  Valget gemmes lokalt og sendes til de andre spillere (serveren validerer), så alle ser din figur og dine skins.
- **Agenter** (CC0, Quaternius – `public/assets/chars/CREDITS.md`): SWAT-operatør og Agent (SWAT) · Gadebande, Lejesoldat (m/k),
  Infiltratør og Bossen (Hijackers) – hver med farvevarianter. Figurerne drives af spillets eget netværkssynkroniserede
  animationssystem (retargeting + IK på hænderne), så nedhuk, genladning, granatkast, plant og død virker for alle figurer.
- **Våben** (CC0, Pichuliru/Quaternius/CreativeTrio – `public/assets/weapons/CREDITS.md`): West-familie til SWAT, East til Hijackers.
  Modellerne passes ind i spillets våbenmål, så sigte, munding, hænder og genladning stemmer i første og tredje person.
- **10 skins**: Worn Factory · Tactical Graphite · Desert Storm · Woodland · Urban Digital · Arctic Ghost · Tiger Strike ·
  Carbon Weave · Redline · Golden Reserve – med sjældenhed som i CS. Mønstrene tegnes i shaderen (model-rum).

## v12 – e-sport-finpudsning: hit-reg, bevægelse, økonomi, lyd, knive

**Hit-registrering ("sigtet er på modstanderen, men intet sker")** – den egentlige fejl er fundet og rettet: klienten sendte
`Date.now()` som skudtid, mens serveren regner i sit eget ur, så lag-kompensationen reelt var slået fra. Nu
* interpolerer klienten modstanderne på **servertid** (udjævnet ur-offset) i stedet for modtagetid → ingen hakken ved netværks-jitter,
* sendes den viste servertid med hvert skud, og serveren spoler modstanderne tilbage til **præcis de snapshots klienten viste** (målt: 2/24 → alle træf mod et mål der løber 6 m/s),
* er serverens kadence-tjek jitter-tolerant (to skud der ankommer klumpet sammen blev før stille afvist).

**Bevægelse & kamera** – Source/CS-fysik: friktion + acceleration (counter-strafe stopper på ~0,1 s, kort glid når man slipper),
air-strafe i luften, hjørne-glid så man ikke hænger fast i dørkarme/kassehjørner, blød kamera-udjævning når man træder op på trin,
fart afhænger af våbnet i hånden (kniv 110 %, AWP 84 %). Musen: rå input (ingen OS-acceleration), filter mod browserens falske
kæmpespring og valgfri udjævning (0–20 ms, standard 6 ms) der fjerner hak når musens polling og skærmens Hz ikke går op.

**CS-økonomi** – kill-belønning pr. våben (pistol/rifle $300, MP5 $600, AWP $100, kniv $1500, granater $300), plant $300 til planteren
(+$800 til hele Hijacker-holdet hvis runden alligevel tabes), desarmering $300, sejr $3250 (detonation/desarmering $3500),
tabsserie $1400 → $1900 → $2400 → $2900 → $3400 (falder med 1 ved sejr som i CS2), overlevende Hijackers ved udløbet tid får ingen
tabsbonus. Købsmenuen viser **holdets økonomi** (alle holdkammeraters penge + våben, total, gennemsnit), en ECO/FORCE/FULL BUY-anbefaling
og en **Win/Loss-predictor**. Indtjening vises som et lille feed ved pengene.

**Lyd** – separate sliders: Master · SFX · Musik/Ambience · Speaker & stemme-UI. Nye skarpe, metalliske pistolskud (Glock, USP-S,
Five-SeveN, Tec-9, Deagle), dæmpet flashbang og blødere tinnitus, markant højere fodtrin med længere rækkevidde, sprødt metallisk
headshot-“dink” og dæmpet kropsskud-thud, kort efterklang på skud, ambience pr. bane, musik-stings og engelsk speaker
(“Bomb has been planted”, “SWAT win” …).

**Rundeslut** – animeret skærm “ROUND WON BY SWAT/HIJACKERS” (blå/rød glød), sejrsbetingelse, MVP, rundens indtjening og 5 s nedtælling;
kontrollen fryses 0,6 s, derefter kan man bevæge sig og **skyde i pausen**. Alle respawner automatisk.

**Feedback** – rødt glimt i crosshairet ved træf, skade-bue der roterer blødt med blikket, egne sporstreger + skudhuller + gnister/støv,
bombe-kamera (hele holdet dødt og bomben plantet: kameraet hænger ved C4'en, musen kigger rundt), **plant-zoner malet på gulvet**
(præcis de felter hvor C4 må plantes).

**Knive** – Karambit, Butterfly-kniv (håndtagene folder ud), M9 Bayonet og Talon i 6 finishes (Vanilla, Damascus Steel, Crimson Web,
Fade, Doppler, Tiger Tooth) – vælges under **INVENTAR → ★ KNIVE**.

**Nuke fra STL** – `docs/NUKE_STL_BESKRIVELSE.md` beskriver de to medsendte 3D-filer ned til hvert objekt: 90 objekter i overetagen,
70 i underetagen, 22 ramper og 37 vægspor – alle med koordinater i spillets system (+ `docs/nuke_stl_objekter.json` og to annoterede kort).

## v12.1 – ydelse på Mac + Nuke bygget præcist efter 3D-modellen

**Ydelse (lag på Mac)** – målt på en Mac med Apple-GPU: Retina-opløsning (×1,5) kostede ~6 ms pr. billede, det nære skyggekort
(4096², tegnet hver frame) ~4 ms, bloom ~2 ms, SSAO ~1,3 ms og sol-stråler ~1,2 ms. Nu:
* **Grafik-kvalitet** i Indstillinger (Auto · Ultra · Høj · Medium · Lav · Minimum). *Auto* vælger **Medium på Mac/Apple-GPU** (pixel-ratio 1,0,
  skyggekort 2048² opdateret hver 2. frame, ingen sol-stråler) og Høj på PC'er med grafikkort.
* Adaptiv opløsning reagerer hurtigere (efter 1 sekund under 57 FPS) og slår derefter SSAO/sol-stråler fra og tynder skyggeopdateringen ud.
* Dørene er slået sammen til ét mesh pr. materiale (før ~100 draw calls), lydgrafen er lettere (kort mono-efterklang, HRTF kun på skud og
  fodtrin, loft over samtidige lyde).
* **Vis FPS & ping** (Indstillinger) viser billedfrekvens, ping og grafik-niveau øverst til venstre.

**Nuke** – hele banen genereres nu af `tools/nuke_from_stl.py` direkte fra de to STL-filer (`tools/nuke_stl/`), i målestok 0,45 m pr. enhed
(kalibreret mod radaren og CS-timing): gulve og trin celle for celle (0,225 m), murene fra printets vægspor med højder fra hjørnestolperne,
underetagen fra printets massive blok, ramper/trapper/stiger målt i printet, props med printets mål. T Spawn og CT Spawn (uden for printet) er
lagt ind efter radaren. Kør `python3 tools/nuke_from_stl.py` for at genbygge `shared/nuke_data.js`. De gamle "svævende vinduer" findes ikke længere.
Testet automatisk: alt kan nås fra begge spawns, ingen fælder, stiger, ramper, vent-kanalen, og SWAT når alle sites før Hijackers (A 10 s mod 15 s,
B 16 s mod 20 s).

## v13 – Nuke-gennemgang, Inferno, SMG'er, ny købsmenu, hænder og knive

**Nuke (stadig genereret fra 3D-printet, `tools/nuke_from_stl.py`):**
* **Tagene er lukkede:** kun en indhegnet sti fra T Roof-stigen langs tagkanten og en gangbro over til **siloen**, hvis top nu kan
  betrædes (rækværk hele vejen rundt). Alle andre tage har usynlige kanter (clip), så man ikke kan hoppe op fra containere.
* **B:** en mur på tværs for foden af B-rampen (intet frit udsyn til sitet) med **to døre – én i hver ende**.
* **A-sitet** er skåret ned til området lige omkring de to tanke.
* **CT-ruten til B:** fra CT Spawn går man lige ud til en ny indgang i Turnpike → trappe ned til Window-rummet → B.
  Før man drejer: en **stige op til Palace** – en ristegangbro med gelænder langs A-hallens østmur med udkig over A.
  Palace kan **ikke** nås inde fra sitet (testet automatisk).
* Døråbninger har fået **overliggere** (printet viste kun vægspor, så dørene stod åbne op til taget), Ramp-gangen har fået loft
  (ingen himmel over rampen), props der hang ud over ramper/huller er fjernet, dækning på B site.
* **Lys:** alle overdækkede gangarealer på begge etager får en lampe inden for ~7 m (ingen mørke huller).
* Mindre kantet: afrundede murhjørner (også lave mure), murkroner med afdækning, tagkanter med inddækning, pilastre på
  yderfacaderne, stålsøjler og ovenlys i hallerne, rørføringer.

**Ancient:** afrundede murhjørner + **ny vegetation**: realistiske løvteksturer (mange enkeltblade), jungletræer med grene og
krydsede løvkort + lianer, efeu-tæpper fra murkronerne, fotoscannede tropiske planter (Poly Haven CC0: Calathea, Anthurium,
Shrub 03, Sorrel, ukrudt) i bedene og ved murfoden.

**Våben:** seks maskinpistoler – **MAC-10** (Hijackers), **MP9** (SWAT), **MP7**, **UMP-45**, **P90**, **MP5-SD** (lyddæmpet) –
med CS2-økonomi (+$600 pr. kill, P90 +$300), spray-mønstre og fart. **Ny AK-47** (og Galil) i samme stil som de andre våben
(poly.pizza CC0) med træskæfte. Modeller i `public/assets/weapons` (CREDITS.md).

**Købsmenu:** helt ny CS2-agtig menu – kolonner (Pistoler · Maskinpistoler · Rifler · Granater) med 3D-renderede våbenkort,
pris, kill-bonus og statistik (skade, kadence, præcision, mobilitet); taster 1–4 kategori → 1–6 våben.

**Førsteperson:** rigtige hænder (leddelte fingre om grebet, tommelfinger, knoer, håndled, manchet og ærme med folder;
SWAT: Nomex-handsker med knobeskytter, Hijackers: fingerløse læderhandsker) og knive holdt i et rigtigt hammergreb.

**Flashbang:** afstanden betyder ikke længere noget – kan du se granaten, bliver skærmen helt hvid.
**Spectate:** bomben på en holdkammerats ryg dækker ikke længere kameraet, når man ser gennem holdkammeratens øjne.

Tests: `npm test` dækker nu fire baner (nav-test for Inferno inkl. tider, lukkede tage og Palace på Nuke) + v13-integrationstests.

## v14 – fra "fungerer" til fejlfrit (arbejdsordre: `docs/PLAN_v14.md`)

**Værktøjer til kvalitet (fase 1):** `test/mapqa.js` finder svævende objekter, huller ud af banen, tomme områder og mørke
celler og tegner varmekort (`docs/qa/<bane>_qa.png`). Den kører strengt i `npm test`. Foto-turen `?dev=1&tour=<bane>` laver
kontaktark med alle callouts, og `perf()` i `public/dev/helpers.js` måler ydelsen over de samme kameraer
(se `docs/qa/README.md`).

**Skarphed (fase 2):** spillernavne som skarp HTML, minimap i fuld opløsning, tydeligere stednavne med områdenavn ved
områdeskift, skilte i dobbelt opløsning.

**Våben (fase 3):** ny procedural AK-47 (`public/js/procguns.js`). Alle GLB-våben placeres efter målte ankre (rigtig længde
og greb fundet i bundprofilen). Nye førstepersonspositioner, tredjeperson med skrå skydestilling og kolbe i skulderen, og
karambit i omvendt greb.

**Genladning pr. våben:** magasinet er en egen del. Det findes som mærkede dele i den procedurale AK, som separate
geometri-øer i GLB-modellerne eller som udskåret område, når magasinet er svejset fast (UMP-45). Pistoler, MAC-10 og AWP får
et proceduralt magasin, der glider ud af grebet. Tidslinjen følger våbnets reload-tid:
* **Pistoler, MAC-10 og TEC-9:** våbnet vippes, magasinet skubbes ud og falder, venstre hånd henter et nyt fra bæltet og
  trykker det op i grebet, og slæden spændes med et overhåndsgreb.
* **Rifler og SMG'er:** hånden griber magasinet, trækker det ud og slipper det, sætter et nyt i og spænder.
  Ladegrebet sidder i højre side (AK med et rigtigt ladegreb, Galil, P90), bagerst foroven (M4, FAMAS, MP7, MP9) eller
  forrest med HK-greb (MP5, UMP-45).
* **AWP:** magasinskift efterfulgt af boltgrebet.
* **P90:** topmagasinet løftes af.

Lydene (magasin ud, ind, ladegreb/slæde) ligger på tidslinjen. I tredjeperson har venstre hånd et magasin med til bæltet og
tilbage. Undervejs blev to forkerte greb rettet: FAMAS-modellen holdtes om magasinet, og TEC-9 bag grebet.
Kontaktark: `docs/qa/genladning_*.jpg` (dev: `__wd.Renderer.vmSheet(['ak47@0.25', …])`).

**Købshjulet er tilbage (fase 4)** i nyt design: 3D-våben, info-kort med statistik, hover, højreklik = sælg.

**Banerne (fase 5–7):**
* **Inferno:** buet Banana, overdækket Second Mid, hvælvede buer, kirke med klokketårn, Dark med søjler, bil under
  presenning, bænke, café, byggeplads og møbler i lejlighederne.
* **Nuke:** lys bølgeblikbeklædning med blåt bånd, vinduesbånd, projektører, rulleporte, el-skabe og tagaggregater. Rummene
  har fået en funktion (skranke, automater, kontrolpulte, reoler, brandudstyr i hvert rum). Gangene har rørføringer på
  konsoller, el-tavler med lysdioder og faremarkering ved murfoden i kælderen.
* **Ancient:** helt nyt layout tættere på CS2-Ancient (se banebeskrivelsen ovenfor), genereret af `tools/ancient_gen.py`.
  Tilhuggede kvadersten, rød stuk, vandkanal i Mid, vandfald ved B, fakler i Cave og Red Room, obelisk på Top Mid.
* QA-runde 2 med varmekortet: Nuke gik fra 45 % til 36 % tomme gangceller og fra 11,4 % til 6,9 % mørke celler. Ancient
  ligger på 17 % tomme celler. Alle baner har 0 svævere og 0 huller.

**Ydelse (fase 8)** – se tabellen under *Tests*:
* Tunge fotoscannede modeller (fx tagaggregatet på 9.400 trekanter pr. del) får automatisk en grov afstandsversion
  (vertex-clustering, ~22 % af trekanterne) ud over 16 m.
* Alle instanser af en tung model ligger i én nær- og én fjern-buffer for hele banen, så hovedpassets draw calls på Nuke faldt
  fra 412/526 til 285/374 (median/maks). Skyline-ringen samles i store celler.
* Slukkede lys (mundingsglimt- og ild-lyspuljen på intensitet 0, fjern-kaskadens lys) springes over i shaderen, og
  vejrligs-shaderens støj beregnes kun på de flader, den rammer.
* Banerne henter kun de modeller, de faktisk bruger. Det sparer ca. 37 MB ved første indlæsning (CREDITS.md viser, hvilke
  modeller der ligger ubrugte).
