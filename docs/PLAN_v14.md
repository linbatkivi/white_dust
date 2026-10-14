# PLAN v14 – fra "fungerer" til fejlfrit

> Arbejdsordre for de næste sessioner.
>
> **Status 2026-10-07:**
> - **Fase 2 (skarphed) – færdig:** spillernavne som skarp HTML, minimap i fuld opløsning, tydeligere stednavne + områdenavn ved områdeskift, skilte i dobbelt opløsning, Mac "Medium" render-skala 1,2.
> - **Fase 3 (våben) – kernen færdig:** ny procedural AK-47 (`public/js/procguns.js`), alle GLB-våben placeres efter målte ankre (rigtig længde, greb fundet i bundprofilen, `GRIP_FRAC`), nye førstepersonspositioner, dev-kontaktark (`Renderer.vmSheet`).
>   (Resten – tredjeperson og karambit – se nedenfor.) **Genladning pr. våben – færdig (2026-10-08):** magasinet skilles ud af modellen
>   (mærkede dele / geometri-øer / udskæring / proceduralt), tidslinje pr. klasse (grebsmagasin, magasin under/bag/oven på våbnet)
>   med ladegreb, slæde eller bolt, lyde på tidslinjen og magasin i hånden i tredjeperson. FAMAS- og TEC-9-grebet rettet. Se `docs/qa/genladning_*.jpg`.
> - **Fase 4 (købshjul) – færdig:** hjulet er tilbage i nyt design (3D-våben, info-kort med statistik, hover, højreklik = sælg).
> - **Fase 1 (værktøjer) – færdig (2026-10-07):** `test/mapqa.js` (svævere, huller, tomhed, lys + varmekort; strengt i `npm test`), foto-tur `?dev=1&tour=<bane>` → `docs/qa/tour_*.jpg`, `Renderer.tpSheet` (tredjeperson), `public/dev/helpers.js` (kort ovenfra). Se `docs/qa/README.md`.
> - **Fase 3 – resten færdig:** tredjeperson med skrå skydestilling, kolbe i skulderen og lukkede fingre; karambit i omvendt greb.
> - **Fase 5–7 – første pass færdigt:** Inferno (buet Banana, overdækket Second Mid, hvælvede buer, kirke med klokketårn, Dark med søjler, bil, bænke, café, byggeplads, møbelmodeller, bogstaver på murene). Nuke (lys bølgeblikbeklædning med blåt bånd, vinduesbånd, projektører, rulleporte, el-skabe, tagaggregater; rum med funktion: skranke, automater, kontrolpulte, skabe, reoler, brandudstyr; B-hal med lamper, faremarkering og rør). Ancient (tilhuggede kvadersten, rød stuk, glyf-friser, trappetakker, slangehoveder, tempelportaler, vand i Mid).
> - **Ancient-layout – færdigt (session 3):** nyt layout tættere på CS2-Ancient, genereret af `tools/ancient_gen.py` → `shared/ancient_data.js`
>   (T syd, CT nord, A = Temple mod vest, B = bassin med vandfald mod øst; Mid med vandkanal, House, Top Mid med obelisk, Donut, B Short,
>   Cave, B Lane/B Ramp, Red Room, Elbow, Ruins). Nav-test: CT først 2,8–7,5 s på alle fem ruter, ingen spawn-sigtelinjer; mapqa 0/0.
> - **QA-runde 2:** Nuke – `dressCorridors` (rør på konsoller, el-tavler, faremarkering, vægbelysning i kælderen) via `themes.js` `sampleRuns()`;
>   tomme celler 45 → 36 %, mørke 11,4 → 6,9 %. Ancient – lave mure relative til gulvet (ingen huller i A), fakler flyttet, ingen rød stuk
>   under tag, waterfall-fx. Nuke/Inferno: sokkelmalingen ignorerer props (reoler gav mørke felter på væggen over sig i Radio/Hut).
>   Tour-ark før/efter i `docs/qa/foer/` og `docs/qa/tour_*.jpg`.
> - **Fase 8 (ydelse) – færdig:** målt med `perf()` (`public/dev/helpers.js`) på Apple M3, Medium, 2560×1440, 1× opløsning:
>   Nuke 10,3–11,1 ms median (maks 11,6–14,5), Inferno 11,7 (14,4), Ancient 11,5 (12,7), White Dust 10,0 (10,7). Hovedpassets draw calls
>   maks 374 / 439 / 263 / 255 (< 450). Byggetid 0,9–3,7 s (Inferno koldt 4,3 s). Tiltag: automatisk afstands-LOD for tunge modeller
>   (`clusterLOD`), én nær/fjern-buffer pr. tung model for hele banen, skyline i store celler, slukkede lys springes over i shaderen,
>   vejrligs-shader med grene, ubrugte modeller fjernet fra load-listerne (−37 MB). NB: gl.finish/timer-queries er upålidelige på
>   ANGLE/Metal, og lang fuld belastning giver termisk nedregulering (op til ~18 ms) – den adaptive opløsning tager det.
>   Ikke gjort: "Høj" på PC (120+ FPS) og netværkstest på 2 maskiner kræver din PC.
> - **Fase 9 – dokumentation færdig:** README (Ancient, tider, ydelsestabel, arkitektur, v14-afsnit), CREDITS (brug pr. model), `docs/qa/README.md`.
>   **Mangler (kræver dig):** den manuelle tjekliste (hel kamp med 2 spillere, alle våben, menuer i alle skærmstørrelser), 3. QA-runde
>   på Inferno/White Dust efter din gennemgang.
> Skrevet 2026-10-06 efter v13. Hver fase har konkrete leverancer, en "færdig når"-liste og et kontrolpunkt, hvor du godkender, før jeg går videre.

---

## 0. Ærlig status: har jeg gjort det godt nok?

**Nej.** v13 løste de konkrete punkter, men kvaliteten er ikke dér, hvor den skal være. Her er rodårsagerne, ikke undskyldninger:

| Problem du ser | Rodårsag (fundet i koden) |
|---|---|
| **Banerne føles tomme og tilfældige** | Dekor placeres af *generelle regler* med hash-tilfældighed (vinduer, lanterner, efeu, kasser) – ikke af en designet plan pr. område. Der er ingen "historie" i hvert rum, ingen landemærker, ingen bevidst komposition. Jeg testede gameplay grundigt (nav-test), men tjekkede kun udseendet med få stikprøve-screenshots. |
| **Navne på spillere og steder er slørede** | (1) Navneskilte og callout-skilte tegnes *i 3D-scenen* og går gennem post-processing (FXAA, bloom, skarphed). (2) Mac-presettet "Medium" renderer med pixel-ratio 1,0 på Retina (halv opløsning), og den adaptive opløsning kan gå ned til 0,7. (3) Minimap-canvas er 200×200 px uden DPR og bliver nu også forstørret med CSS-zoom. (4) Skilte er tekstteksturer på 512×128, som mipmapper til grød på skrå vinkler. |
| **Våben holdes mærkeligt (fx AK-47)** | GLB-modellerne "presses" ind i den gamle procedurale models kasse (`fitTemplate`), og hænderne sættes efter én fælles tabel pr. våbentype (rifle/pistol). Grebet i GLB-modellen ligger derfor ikke, hvor hånden er. Der findes ingen målte ankerpunkter (greb, støttehånd, sigte) pr. våben. |
| **AK-47 er stadig ikke rigtig** | "Rifle Assault East" er en moderne AK (AK-12-agtig). Træet kommer fra en geometrisk gætte-opdeling af ét materiale, ikke fra en rigtig model. Det er ikke den ikoniske AK-47. |
| **Den nye købsmenu** | Den bryder med spillets stil, og du foretrak hjulet. |
| **Kantet arkitektur** | Afrundingen er kun en kosmetisk bue på hjørner. Grundformen er stadig kasser i et gitter, fordi kollisionen kun kender akse-rettede kasser. |

**Hvad jeg gør anderledes nu:**
1. Jeg bygger **værktøjer først** (kalibrering, foto-tur, automatisk QA). Så bliver hver rettelse målt i stedet for gættet, og det sparer credits.
2. Hvert område får en **skreven design-brief**: formål, landemærke, rekvisitter og lys. Dekoren *placeres i hånden* efter briefen, ikke af tilfældighedsregler.
3. **Visuel QA med faste kameraer pr. område:** alle billeder sammenlignes før og efter hver runde, og du ser kontaktark.
4. **Ingen leverance uden** at den har bestået sin "færdig når"-liste. Usikre punkter siges højt.

---

## 1. Kvalitetsbar: "fejlfrit" gjort målbart

Ingen kan bevise "fejlfrit", men det kan defineres. Et område, et våben eller en skærm er **færdigt**, når:

**Teknisk (automatisk testet)**
- 0 konsolfejl og advarsler ved indlæsning af alle 4 baner og alle menuer.
- 0 objekter der svæver, mindst 3 cm afstand (rekvisitter, skilte, lamper, decals, planter).
- 0 huller mod himmel eller void set fra gangbare steder (stråler fra et gitter af øjenpunkter).
- 0 steder hvor spilleren kan sidde fast eller komme op på tage eller uden for banen (nav-fuzz + flood fill).
- Alle mure har synlig tykkelse. Ingen z-fighting (overlappende flader under 2 mm).
- Lysdækning: ingen gangbar celle under en lysstyrke-tærskel (både indendørs og udendørs).
- Ydelse målt i browser med fast kamera-tur: **stabil 60 FPS på Mac "Medium" ved 1440p**, og draw calls under 450 pr. bane.

**Visuelt (manuelt mod tjekliste og kontaktark)**
- Hvert område har mindst ét landemærke, som gør det genkendeligt på et halvt sekund.
- Ingen gentagelse, man lægger mærke til: samme vindue eller kasse må ikke stå i rytme i synsfeltet uden variation.
- Materialeovergange har en detalje: fodliste, kantsten, sokkel eller fuge. Aldrig en "skarp kasse-kant".
- Tekst er skarp ved 1080p og 1440p på både Retina og ikke-Retina.
- Våben ligger korrekt i hånden fra alle vinkler: førsteperson, tredjeperson og inventar.

**Gameplay**
- CS-timing: CT når forsvarspositioner først. Mindst 2 s til sites, og der er en tabel pr. bane.
- Ingen sigtelinjer spawn til spawn. Kun bevidste, dokumenterede lange sigtelinjer.
- Dækningen er designet, og hver kasse har en gameplay-grund (beskrevet i briefen).

---

## 2. Arbejdsgang der sparer credits

1. **Værktøjer først** (fase 1). Hver efterfølgende rettelse bliver hurtigere og sikrere.
2. **Batching:** én session pr. fase eller delfase med en klar leverance, ikke spredte småting.
3. **Faste kamera-ture** (JSON pr. bane): screenshots tages automatisk og samles til ét kontaktark, så jeg ikke tager 30 enkeltbilleder.
4. **Godkendelses-punkter:** efter hver fase sender jeg ét kontaktark plus en kort liste. Du siger "videre" eller markerer fejl.
5. **Rækkefølge efter effekt pr. credit:**
   1. Klarhed og skarphed.
   2. Våbengreb og AK-47.
   3. Købshjulet.
   4. Banerne, én ad gangen: Inferno → Nuke → Ancient.
   5. Ydelse, polish og slut-QA.

Estimater i "sessioner" (en session svarer til en arbejdsomgang på størrelse med v13's delopgaver):

| Fase | Indhold | Størrelse |
|---|---|---|
| 1 | Værktøjer: VM-lab, foto-tur, geometri-QA, lys-QA | M |
| 2 | Skarphed: navne, callouts, minimap, tekst | S–M |
| 3 | Våben: ankre for alle 16 + knive + granater, ny AK-47, tredjeperson | M–L |
| 4 | Købshjulet (gammel stil, nyt design) | S–M |
| 5 | Inferno – total gennemarbejdning | L–XL |
| 6 | Nuke – total gennemarbejdning | L–XL |
| 7 | Ancient – total gennemarbejdning | L |
| 8 | Ydelse og stabilitet | M |
| 9 | Slut-QA, regression og dokumentation | M |

Er der kun credits til en del: **fase 1–4 giver den største synlige forbedring pr. credit.** Banerne tager jeg derefter én ad gangen, færdige frem for halvfærdige.

---

## 3. Fase 1 – Værktøjer (grundlaget for "fejlfrit")

### 1.1 VM-lab (`?dev=1&vmlab=1`)
- En side der viser ét våben i førsteperson med armene, plus fritdrejeligt tredjeperson og inventar-visning side om side.
- Skydere og håndtag for hvert anker:
  - grebspunkt og grebsakse;
  - støttehånd og håndledsvinkel;
  - kolbeplacering ved skulderen;
  - sigtelinje: siget skal flugte med skærmens midte i sigte-pose.
- Ghost-overlay af den procedurale reference-model og en "røntgen", der viser hvor hånden skærer grebet.
- Gem-knap → `public/js/weapon_anchors.json`. Kodens `ARM`-tabel erstattes af data pr. våben.
- **Færdig når:** jeg kan kalibrere et våben på under 2 minutter, og værdierne overlever genindlæsning.

### 1.2 Foto-tur
- `tools/phototour/<bane>.json` med 25–40 navngivne kamerapositioner pr. bane. Hver callout har mindst 1 vinkel, sites har 4, og der er 2 fra hvert spawn.
- Dev-knap og en `node`-hjælper, der kører turen i browseren og samler ét kontaktark (PNG, 5 billeder pr. række) med navne på.
- Før/efter-sammenligning: samme kameraer, side om side.
- **Færdig når:** én kommando giver kontaktarket for en bane på cirka 1 minut.

### 1.3 Geometri-QA (udvidelse af `test/visuals.js` / ny `test/mapqa.js`)
- **Svævere:** hver dekor-instans (props, skilte, lamper, vinduer, planter, decals, rør) skal have kontakt. Det tjekkes med en stråle ned eller ind i nærmeste mur inden for 3 cm, ellers fejl med koordinat.
- **Huller:** fra et gitter (1 m) af øjenpunkter skydes 64 vandrette og skrå stråler. Rammer en stråle himmel eller void gennem en åbning der ikke skal være der, er det en fejl.
- **Z-fighting:** parallelle, overlappende flader under 2 mm fra hinanden.
- **Tag-adgang:** flood fill fra begge spawns. Alle steder over 3 m skal stå på en hvidliste.
- **Tomheds-detektor:** for hver gangbar celle tælles dekor-elementer inden for 6 m. Celler under en tærskel vises som varmekort, så jeg kan se de "tomme" steder.
- **Gentagelses-detektor:** samme dekor-type i fast afstand mere end 5 gange i én facade-række.

### 1.4 Lys-QA
- Varmekort over lysstyrke (proben) pr. etage, med minimum, maksimum og kontrast.
- Liste over lamper uden synligt armatur og armaturer uden lys.

---

## 4. Fase 2 – Skarphed: navne og steder skal stå knivskarpt

**Mål:** al tekst er skarp på alle skærme og skalaer.

1. **Spillernavne → skærm-overlay i HTML.** Navnet projiceres fra hovedet til skærmkoordinater hver frame og tegnes som et DOM-element.
   - Det giver native opløsning og ingen post-effekter.
   - Afstandsfade, holdfarve, maks-bredde og skjul bag vægge (som nu, kun holdkammerater).
2. **Callouts (stednavne):**
   - HUD-stednavnet under minimap bliver større og med bedre kontrast (14–15 px), og ingen zoom-sløring.
   - Når man træder ind i et nyt område, vises kort et stort, diskret områdenavn ("BANANA", "A SITE") i toppen.
   - Skiltene i verden: 1024×256-tekstur, anisotropi 16, mipmap-bias, `alphaTest`-kant og mindre skrå placering. Skiltetekst og -farver følger hver banes stil.
3. **Minimap:** canvas skaleres med `devicePixelRatio × --ui` (ikke CSS-zoom), og alle tal og bogstaver tegnes i den rigtige opløsning. Callouts kan vises på minimap (valgfrit).
4. **Kill feed, scoreboard og runde-banner:** testes ved 1080p, 1440p og Retina. Skrifttykkelse og kontrast justeres, og der bruges ingen halve pixels i transform.
5. **Render-skala:** "Medium" på Mac giver i dag sløret 3D.
   - Mulighed (a): 3D'en renderes på 0,85–1,0, men HUD og tekst er altid native (punkt 1–3 løser det meste).
   - Mulighed (b): ny skærpe-indstilling ("FSR-lignende" CAS-skarphed, der allerede delvist findes i `post.js`).
   - Begge evalueres med FPS-måling.
- **Færdig når:** screenshot ved 100 % zoom af navneskilt på 5, 15 og 30 m, callout-skilt og minimap er skarpe. Det testes på både DPR 1 og DPR 2.

---

## 5. Fase 3 – Våben, hænder og AK-47

### 3.1 Data-drevne ankre pr. våben (løser "holdes mærkeligt")
- `weapon_anchors.json` pr. model:
  - grebspunkt og -akse;
  - aftrækkerfinger-position;
  - støttehånd (punkt, akse, venstre-spejling);
  - magasinposition (til genladning);
  - munding;
  - sigtelinje (bagsigte og forsigte);
  - kolbe;
  - skala.
- `fitTemplate` erstattes: GLB'en placeres ved sit **eget** greb, ikke presset ind i den procedurale kasse.
- Første forslag til ankrene beregnes automatisk (grebs-dal i bundprofilen, som jeg prototypede i v13) og finjusteres i VM-lab.
- **Alle** kalibreres og godkendes på kontaktark (førsteperson, tredjeperson og inventar):
  - AK-47, M4A1, FAMAS, Galil, AWP;
  - MAC-10, MP9, MP7, UMP-45, P90, MP5-SD;
  - Glock, USP-S, Five-SeveN, Tec-9, Deagle;
  - 5 granater, 4 knive, C4.
- **Tredjeperson:** figurens højre og venstre hånd (IK fra `characters.js`) bruger de samme ankre. Så holder modstanderne også våbnet rigtigt.
- **Animationer:** genladning følger det rigtige magasin, der er inspect-animation pr. våbenklasse, og løbe-bob og sigte-pose er tjekket for hvert våben.

### 3.2 Hænder og arme
- Ekstra pass:
  - fingrene skal *ligge på* grebet uden at skære igennem (kollisionstjek i VM-lab);
  - aftrækkerfingeren ligger langs bøjlen;
  - tommelfingeren følger grebet.
- Handsker:
  - bedre materialer: normal-map og syninger;
  - et ur eller et armbånd pr. hold;
  - ærmet slutter rent ved skærmkanten i alle poser.
- Kniv:
  - pr. model en egen grebsstilling: karambit i omvendt greb med fingeren i ringen, butterfly-åbning, M9 og Talon i hammergreb;
  - stik- og hug-animationer genbalanceres efter den nye pose.

### 3.3 Ny AK-47
Tre muligheder evalueres. Hver renderes side om side i VM-lab fra samme vinkler, og **du vælger på kontaktarket**:
1. **CC0-model**, hvis der findes en klassisk AK-47 med træskæfte, buet magasin og gasrør i passende stil. Jeg søger poly.pizza, Kenney, Quaternius og OpenGameArt.
2. **Ny detaljeret procedural AK-47** bygget i koden efter rigtige mål (≈ 0,88 m):
   - presset stål-receiver med nitter og støvdæksel med ribber;
   - lamineret træ med åretekstur;
   - bakelit-greb;
   - buet stål-magasin med ribber;
   - skrå mundingsbremse og gasblok.
   - Den er i samme low-poly stil som Pichuliru-våbnene og kræver ingen licens.
3. **CC-BY-model** (fx "AKM" / "AK47" på poly.pizza). Det **kræver din godkendelse**, da kreditering er påkrævet.

Min anbefaling er **(2)**: fuld kontrol over proportioner, greb og stil, og ingen licensrisiko. Galil vurderes samtidig.

- **Færdig når:**
  - AK-47 er straks genkendelig;
  - træ og metal læses tydeligt;
  - hånden sidder på grebet;
  - støttehånden er på håndbeskytteren;
  - magasinet falder rigtigt ved genladning.

### 3.4 Våben-stil samlet
- Alle våben gennemgås for skala (den rigtige længde i meter), materiale-konsistens (samme PBR-lys) og skin-kompatibilitet (alle 10 skins på alle våben).

---

## 6. Fase 4 – Købshjulet tilbage, i et bedre design

Du vil have hjulet tilbage i samme stil, men bedre. Hjulet (v9.2–v12) hentes fra git (commit `7af5f38`) som udgangspunkt.

**Design:**
- **Opbygning:** radialt hjul med kategorier i ringen; klik eller tal-tast åbner kategoriens våben i den samme ring (som CS:GO). Pengebeløbet står i centrum.
- **Visuelt løft:**
  - sektorer med glas-gradient og tynd lysende kant;
  - hover løfter sektoren 6 px ud med en kort animation;
  - 3D-renderet våbenikon i hver sektor (genbrug af `gunIcon` fra v13);
  - pris i grøn eller rød efter råd;
  - "EJET"/"SÆLG"-markering;
  - holdfarve-accent.
- **Info:** et lille kort ved hovering, med statistik-bjælker (fra v13-menuen), kill-bonus og fart med våbnet i hånden.
- **Sidepanel (som før):** udstyr og salg, holdets økonomi og predictor, ønsker og gaver. Panelet strammes op og flugter med hjulet.
- **Taster:**
  - B åbner;
  - 1–5 vælger kategori;
  - 1–6 vælger våben;
  - 0 eller Backspace går tilbage;
  - højreklik på et ejet våben sælger det.
- **Skalering:** følger `--ui`. Fungerer på touch.
- **Færdig når:**
  - du har godkendt et mockup-screenshot, før jeg færdiggør;
  - integrationstestene for køb, salg, ønske og gave består uændret;
  - der er ingen layoutfejl i 1000×560, 1440×900 og 2560×1440.

---

## 7. Fase 5–7 – Banerne: gennemarbejdet til mindste detalje

### Fælles metode for alle tre baner

1. **Reference og brief.** For hvert område skriver jeg en brief i `docs/maps/<bane>/<område>.md`:
   - **Funktion:** gameplay, sigtelinjer, timing, dækning, og hvorfor hver kasse står hvor den står.
   - **Fortælling:** hvad stedet *er* (fx "bageriets baggård", "reaktorens kontrolrum").
   - **Landemærke:** genkendeligt på et halvt sekund.
   - **Rekvisitliste** med antal og placering, og hvad der ligger op ad væggene.
   - **Lys:** kilder, farve og stemning.
   - **Lyd:** fodtrin-materiale og stemningslyd.
   - **Materialer og farvezoning:** hvert område har sin egen farvetone, så man altid ved, hvor man er.
2. **Håndplaceret dekor** i datafiler (`shared/<bane>_decor.js`). Hash-tilfældige facadeelementer erstattes med *komponerede* facader: et hus er ét hus med sin egen dør, sine vinduer, sit skilt og sin skorsten. Regler bruges kun som udfyldning.
3. **Arkitektur, der ikke ligner kasser:**
   - fodlister, sokler, gesimser og vinduesindfatninger med dybde (ikke kort på muren);
   - buer;
   - nicher og fremspring;
   - afrundede kanter i rigtig geometri;
   - "slid" på hjørner og trapper.
   - **Motor-udvidelse (vurderes):** roterede kasser (OBB) i kollision og raycast, så gader og mure kan stå skråt.
     - Det er den eneste måde at få *rigtigt* organiske gader.
     - Risiko: fysik, nav-test og hit-reg skal udvides.
     - Den bygges kun med fuld testdækning (fuzz og nav).
     - **Dit valg:** ja eller nej, før fase 5.
4. **Densitets-pass:** tomheds-varmekortet (fase 1.3) skal være "grønt" overalt undtagen bevidst åbne pladser. Små ting, der giver liv:
   - lag: papir, blade og skrald;
   - kabler, rør og skilte;
   - planter i revner;
   - skodder i forskellige stillinger.
5. **Lys-pass:** hver lampe har et synligt armatur. Der er lyspøle- og vægreflekser (decal-gradienter), varmt og koldt lys bruges bevidst, og der er sollys-pletter ind ad døre og vinduer.
6. **Lyd-pass:** fodtrin efter materiale (brosten, træ, metal, gitter, grus), zone-stemning (vind, fugle, maskinbrum, kirkeklokker) og lyd for døre og vinduer.
7. **Skybox og horisont:** ingen flade "ringe". Lagdelt horisont med silhuetter, der passer til banens historie.
8. **QA-runder:** foto-tur før og efter, geometri-QA og nav-test. **Minimum 3 runder pr. bane:** byg, kritiser, ret, og så igen.

### Fase 5 – Inferno (mest arbejde, fordi den er nyest)
**Layout-revision mod CS2-Inferno** (proportioner og timing, ikke kopi):
- **T-siden:** T Spawn med brønd og vognport; "T Ramp" med trapper i siden. **Second Mid**: huset med de to døre. **Alt Mid**.
- **Banana:**
  - kurven skal føles som en bue med fliser, trappetrin og en lav mur;
  - Logs, Sandbags, Car og "Coffins-hjørnet";
  - Top Banana skal have de klassiske dæknings-vinkler mod B.
- **B:**
  - kirken med facade, trappe og port;
  - Dark (overdækket hjørne);
  - First/Second Oranges, Coffins, New Box, Fountain, Construction (stilladser og byggematerialer);
  - CT-indgangen via "Kitchen".
- **Mid:**
  - Top Mid med brønd og bænke;
  - "Arch" med buegang og kalkmalede hvælv.
  - "Library" skal være et *rigtigt* bibliotek: reoler, læsepult, trapper og lamper.
- **Apartments:**
  - hver lejlighed skal have sin egen indretning: soveværelse, stue, køkken og trappeopgang;
  - vinduer med lys ind;
  - "Boiler" med kedel, rør og varmt lys;
  - "Balcony" med blomster og rækværk.
- **A:**
  - "Pit" med stentrapper og planter;
  - "Graveyard" med gravsten og cypresser i rigtige proportioner;
  - "Truck" (tidstypisk lastvogn);
  - "Quad" med fontæne/plantekumme;
  - "Short" med trappetrin og en lav mur;
  - "Library-balkonen".

**Stemning:**
- Toscansk eftermiddag med varme skygger og lyse sten.
- Byg detaljer ind:
  - markiser;
  - vinranker over gyder (pergola);
  - vasketøj;
  - vespa og cykler;
  - vinkasser;
  - tomatplanter i potter;
  - en kat på en mur (statisk);
  - plakater på italiensk;
  - helgenbilleder.
- Tegltagene skal have rygninger, skorstene og tagrender.

**Facader:** husene får variation i højde, sokkel, vinduesrytme og døre, og skodder i forskellige stillinger. Der skal være murstensfelter, hvor pudsen er faldet af, med *rigtig* dybde (ikke bare tekstur).

### Fase 6 – Nuke
**Layout:** STL-geometrien er grundlaget. Spørgsmålet til dig er, om vi holder fast i printet 100 %, eller om CS2-Nuke må veje tungere, hvor printet er tyndt (Heaven, Hut-vinduer, Ramp-rummets detaljer).

**Indhold pr. område:**
- **Lobby/Radio/Control:**
  - receptionsdisk og skranke-glas;
  - kontorstole og skærme;
  - kontrolpaneler med blinkende LED'er;
  - kabelbakker;
  - mødeplanche og brandslukker.
- **A-hallen:**
  - rigtige reaktortanke med rør op i loftet;
  - gangbroer, rækværk og trapper (Palace/Heaven);
  - Hut med vindue og dør;
  - Mustang-platform;
  - gule faremarkeringer;
  - loftskraner, ventilationskanaler og ophængte lamper.
- **Ramp-rummet:** ståldøre, rørsystemer, en trappe med rækværk, "Ramp"-skilte og sikkerhedsskilte.
- **B:**
  - reaktorkernen med kontrolrum og ruder;
  - kølerør;
  - Window med glas;
  - Doors med rigtige ståldøre;
  - Decon med bruser-stationer og skilte;
  - Vents med gitre.
- **Outside:**
  - lastbiler og containere (rigtige modeller);
  - Silo med trappe og stigesystem;
  - hegn med pigtråd;
  - lygtepæle;
  - rørbroer;
  - Secret med ståltrappe;
  - Garage med porte og værktøj.
- **Skybox:** køletårn med damp, højspændingsmaster, hav eller kyst i horisonten (som CS2-Nuke) og hegn.
- **Materialer:** rene industrielle zoner (hvidt og gult i A, grønt og blåt i B), og nummererede døre og rum.

### Fase 7 – Ancient
- **Layout-revision mod CS2-Ancient:** Mid med vandkanal, Donut, "Cave", "Temple" (A) med søjler og trapper, B med bassin og vandfald, CT- og T-spawn.
- **Arkitektur:** skårne stenblokke med fuger (rigtig geometri), knækkede søjler, faldne stenhoveder, relieffer og trappepyramide-elementer.
- **Natur:**
  - vand: bassin, kanaler og et lille vandfald med partikler;
  - rødder der vokser gennem mure;
  - lianer i lag og mos i fugerne;
  - jungle-mur bag banen (horisont);
  - tåge og fugle- og insektlyde.
- **Lys:** solstriber gennem løvet (gobo-effekt), dyb skygge i Cave og fakler med flimmer.

---

## 8. Fase 8 – Ydelse og stabilitet
- **Profilering pr. bane med fast kamera-tur:**
  - FPS (gennemsnit og 1 %-low);
  - draw calls, trekanter og hukommelse;
  - byggetid.
- **Mål:**
  - Mac "Medium" ved 1440p: stabile 60 FPS;
  - "Høj" på PC: 120+ FPS;
  - byggetid under 4 s.
- **Værktøjer:**
  - instancing for alle gentagne ting (vinduer, skodder, lanterner, potter);
  - materiale-atlas for at nedbringe draw calls;
  - LOD og afstands-culling af detaljer;
  - skyggekort-cascade-tuning.
- **Netværk:** test på 2 maskiner (din Mac og din vens PC) med server på Mac. Ping og jitter-log.

---

## 9. Fase 9 – Slut-QA og sign-off
- `npm test` er grøn på alle 4 baner: nav, visuals og integration, plus de nye `mapqa`- og `vmqa`-tests.
- Foto-tur kontaktark for alle baner: før og efter.
- **Manuel tjekliste**, gået igennem tre gange med fem dages mellemrum i hovedet (dvs. ny kontekst hver gang):
  - hver callout gået igennem i spillet;
  - hvert våben affyret, genladet og inspiceret;
  - hver menu i alle skærmstørrelser;
  - en hel kamp med 2 spillere.
- README, CREDITS og memory opdateret.

---

## 10. Sporbarhed: hvert punkt i din besked → hvor det løses

| Dit ønske | Fase | Hvordan det verificeres |
|---|---|---|
| "Opdatere, opgradere, gennemarbejde, fejlfinde, løse, kritisere, vedligeholde, konstruere, færdiggøre" | Alle. Metoden i §2 og §7 (brief → byg → QA → kritik → ret, mindst 3 runder) | Kontaktark før og efter + QA-tests |
| "Fejlfrit, man kan ikke sætte en finger på det" | §1 kvalitetsbar + fase 1-værktøjer + fase 9 | Automatisk QA: 0 svævere, 0 huller, 0 tag-adgang, lys og FPS |
| "Gamle buy interface tilbage, samme stil, bedre design" | Fase 4 | Mockup godkendes af dig, inden det færdiggøres |
| "AK-47 mangler stadig at blive opdateret" | Fase 3.3 | Tre kandidater side om side. Du vælger |
| "Nuke, Ancient, Inferno føles tomme og random" | Fase 5–7 + tomheds-detektor (1.3) | Varmekort grønt + brief pr. område |
| "Alt skal nøje overvejes til mindste detalje" | Briefs pr. område (§7.1) + densitets- og lys-pass | Brief-tjekliste pr. område |
| "Navne på spillere og steder er sløret" | Fase 2 | Skarphedstest ved DPR 1 og 2, 5–30 m |
| "Mange guns holdes mærkeligt, fx AK-47" | Fase 3.1 (ankre) + VM-lab | Kontaktark med førsteperson, tredjeperson og inventar for alle 21 genstande |
| "Tage stilling flere gange. Har jeg gjort det godt nok? Tjek alt." | §0 (ærlig status) + 3 QA-runder pr. leverance + fase 9 | Ingen leverance uden "færdig når"-liste |
| "Det her er sidste stræk – giv den alt" | Rækkefølge efter effekt (§2) | Du godkender efter hver fase |

---

## 11. Beslutninger – TRUFFET (2026-10-07)
Brugeren: *"I forhold til de ting, har du tilladelse til alt, også Nuke, på betingelsen at det bevæger sig tættere på originalen, fordi der er du slet ikke endnu."*
1. **AK-47:** alle tre veje er tilladt. Den bedste vælges ud fra side-om-side-renders.
2. **Roterede kollisionskasser (OBB):** JA – tilladt, med fuld testdækning.
3. **Nuke:** må gerne afvige fra 3D-printet, *så længe den kommer tættere på den originale CS-Nuke*. Det er det styrende kriterium for alle Nuke-ændringer: layout, proportioner, rum, detaljer og stemning.
4. **Rækkefølge:** som planlagt (fase 1–4, derefter Inferno → Nuke → Ancient).
5. **Downloads:** tilladt – møbler, køretøjer, industriudstyr og planter (CC0 foretrækkes, CC-BY med kreditering i CREDITS.md).
   Samme princip gælder Inferno og Ancient: *tættere på originalerne* (CS2-Inferno, CS2-Ancient).

---

## 12. Kritik af selve planen (anden gennemlæsning)
- *Er den for stor?* Ja, til én uge. Derfor er den faseopdelt med godkendelse efter hver fase, så intet efterlades halvt. Fase 1–4 kan stå alene.
- *Mangler der noget?*
  - Lyd og musik er kun nævnt i lyd-passet.
  - Hovedmenu og venterum kan få et visuelt løft, når købshjulet laves: samme designsprog.
  - Mobil/touch er kun regressionstestet, ikke forbedret.
  - Tilføjet nu: §6 kører på touch, og §9 tester alle skærmstørrelser.
- *Er "fejlfrit" realistisk?* Kun som målbar definition (§1). Alt, der ikke kan måles, går gennem kontaktark og din godkendelse. Jeg melder åbent, hvis noget ikke når målet.
- *Største risiko:*
  - At banerne igen bliver "regel-dekoreret". Modtræk: briefs og håndplaceret dekor er obligatoriske, og tomheds- og gentagelses-detektoren fanger regel-mønstre.
  - At våbenankrene bryder hit-reg eller sigtelinje. Modtræk: sigtelinjen testes automatisk (mundingen og centrum skal flugte), og integrationstesten for skud kører efter hver ændring.


AK-47: Skal jeg bygge den selv i koden, bruge en gratis model hvis jeg finder en god, eller bruge en model hvor skaberen skal krediteres? Jeg anbefaler at bygge den selv: så styrer jeg form og greb, og der er ingen licensproblemer.
Skrå mure: Spillet kan i dag kun have lige mure. Må jeg udvide motoren til skrå mure, så Inferno og Ancient kan få rigtigt snoede gader? Det er en større ændring.
Nuke: Skal den være 100 % tro mod dit 3D-print, eller må jeg tilføje detaljer fra CS2-Nuke, hvor printet ikke viser noget?
Rækkefølge: Er den ovenfor i orden?
Downloads: Må jeg hente flere gratis modeller (møbler, køretøjer, industriudstyr)? Det er nye kategorier i forhold til den tilladelse, du allerede har givet.




I forhold til de ting, har du tilladelse til alt, også nuke, på betingelsen at det bevæger sig tættere på originalen, fordi der er du slet ikke endnu.