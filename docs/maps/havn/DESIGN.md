# de_havn – designdokument

> Banen er bygget med en helt anden metode end de tidligere. Geometrien modelleres proceduralt i **Blender 5** (Python/bpy) med
> rigtig arkitektur: fasede kanter, karme med fals, hængsler, greb, trappesten, gesimser, tagrender i rendejern, nedløbsrør med
> svanehals, dæksten, kamtakker, nittede gitterdragere og granitbuer.
>
> Lyset **bages med global belysning i Cycles**: himmellys plus alt tilbagekastet lys. Store flader får lysmaps, mens detaljer
> får lys pr. hjørne. Den direkte sol tegnes i realtid med skarpe skygger, så spillerne også kaster skygger.
>
> Banen eksporteres i et kompakt binært format med KTX2/Basis-teksturer.
>
> Kollision og gameplay genereres af **samme layout-data** (`tools/havn/layout.py`), så det man ser og det man rammer passer sammen.
> Det tjekkes automatisk af `test/havn.js`.

## Koncept
En gammel nordisk havnebydel (inspireret af Nyhavn, Christianshavn og Kastellet) en klar sommereftermiddag:
- farvede pudshuse og røde/gule pakhuse langs en kanal,
- granitkajer med nedre kajgange ved vandet,
- en nittet klapbro, en granitbro med segmentbue og en sluse med stemmeporte,
- et hollandsk sejlskib i havneløbet,
- en fiskehal med iskælder,
- en teglstenskirke med vesttårn, kobberspir og kamtakkede gavle,
- en klassicistisk toldbod,
- Kastellets vold med kanoner og Dannebrog.

Hjerte og vartegn: **Kanalen** løber nord–syd gennem midten og deler banen. Den kan krydses i tre højder:
- broer (+1,0 m),
- gaden/slusen (0),
- nede ved vandet (−1,9 m), via ponton og færgepram.

## Niveauer
| Niveau | Højde | Hvor |
|---|---|---|
| Nedre kaj, ponton, pram, mole, iskælder | −1,9 m | Langs kanalen, under broerne (kajmuren på 1,9 m kan ikke klatres). |
| Gade | 0 | Gader, pladser, Torvet, Kirkepladsen, A. |
| Broer, fiskehallens gulv, perronen | +1,0 m | Klapbroen, Sydbroen, B. |
| Baggården | +1,2 m | Hævet gård i Smøgen. |
| Pakhusloftet, voldens top | +3,4 m | T's udsigtspost og CT spawn. |
| Galleriet i fiskehallen | +4,4 m | Over B. |

## Områder og ruter (T vest, CT øst)
- **T spawn – Banegården:** godsbanegård med havnebane (rillespor i brosten), to godsvogne med bogier og prelbukke.
  Man kan se og skyde under vognene, men ikke kravle under dem.
- **Havnefronten → Kajpladsen → Klapbroen** (A lang):
  - Kajen ligger ved det hollandske sejlskib.
  - Kajpladsen har havnekontoret (gule mursten, valmtag, ur-tårn), tønder og kaffevogn.
  - Klapbroen er en nittet stålbro med gitterdragere over kanalmundingen.
- **Pontonen** (A nedre): ned ad kanaltrappen, ad den nedre kaj, over pontonen *under* Klapbroen og ud på træmolen.
  Moletrappen fører op i A.
- **Smøgen** (midt-vest): krogede gyder, den hævede **Baggården** og **Porten** gennem et hus ud på Torvet.
  **Pakhuset** kan gennemgås, og fra loftet og balkonen er der udsigt over Torvet og kanalen.
- **Torvet** (midt): springvand med bronzehval, kiosk (ottekantet, grønt træ, kobbertag), caféborde og bænke.
  **Slusen** har stemmeporte, drivværk og jerngelændere og fører til Kirkepladsen.
- **Bryggergade → Brohovedet → Sydbroen** (B lang): granitbro med segmentbue, voussoirer og brystning (dækning).
  De nedre kajer passerer under broen gennem en passage med granitbjælker.
- **Prammen** (B nedre): en færgepram på tværs af kanalen med last som dækning. En dør i den østlige kajmur fører gennem
  **Krybegangen** ind i **Iskælderen** og op i hallen.
- **Kirkepladsen** (CT-knudepunkt): kirken med vesttårn, våbenhus og stræbepiller. **Toldgade** fører nord til A, og hallens
  nordport fører syd til B.
- **A – Toldbodpladsen:** toldboden (kvaderet stueetage, pilastre, balkon over portalen), kassestabler, tønder og pullerter.
- **B – Fiskehallen:** støbejernssøjler, galleri på to sider, ovenlys, iskælder under, fiskekasser og tønder.
- **CT spawn – Kastellet:** volden har murede skarper, granitsokkel, rundstav og græsklædt brystværn. Der står kanoner bag
  brystværnet og en flagstang med Dannebrog. Ramper og trapper fører ned til A, Kirkepladsen og B.

## Kvalitetskrav (fra brugeren) og hvordan de er løst
- **Sømløse overgange:**
  - Hvor to belægninger mødes, ligger en granitstrimmel.
  - Kajkanter har dæksten (1,1–1,9 m lange, med fuger).
  - Snavs, mos og vådt blandes i shaderen pr. hjørne med en højde-proxy (AO + lyshed), så det samler sig i fugerne først.
    Fx snavs ved murfod og vådt ved vandlinjen.
- **Maksimal realisme:**
  - Døre har karm, overvindue, fyldinger, hængsler, greb, nøgleskilt, brevsprække og granittrin. Trinene har kollision.
  - Vinduer er rigtige huller med lysning, karm, korspost, sprosser, glas og sålbænk.
  - Tagrender hænger i rendejern lige under tagkanten, og tagfladen hviler på hovedgesimsen.
- **Grounded:**
  - Modeller sættes med laveste punkt på fladen, efter modellens målte bundflade.
  - Alt bygges i præcise mål fra layoutet.
  - Mesh-byggeren svejser kun hjørner inden for samme del, så fasninger ikke kan "løbe løbsk".
  - Tests måler afvigelser mellem grafik og kollision.
- **Ingen huller:**
  - Brandmure og bagmure bygges, hvor et hus er højere end naboen eller står ud mod kanten.
  - Kulissen (havneløbet med modsatte kaj og husrække, spir, kran og voldgraven) lukker horisonten.

## Pipeline
```
tools/havn/layout.py            banens data (gulve, trapper, ramper, haller, blokke, rekvisitter …) → out/map.json + topdown.png
tools/havn/export_collision.py  → shared/havn_data.js (kollision inkl. tage, brandmure, trappesten, labels, sites, spawns)
tools/havn/fetch_assets.py      Poly Haven (CC0): materialer (2K), modeller (1K glTF), HDRI → tools/havn/cache
blender -b -P tools/havn/blender_build.py -- preview [kamera …]   testbilleder (out/preview_*.jpg)
blender -b -P tools/havn/blender_build.py -- bake                 lysmaps + world.bin/world.json
tools/havn/textures.py          KTX2 (Basis): farve ETC1S, normal UASTC, ARM ETC1S – også for modellernes teksturer
tools/havn/denoise_lm.py        (kaldes af bagningen) OIDN-støjfjernelse af lysmaps
tools/havn/credits.py           public/assets/havn/CREDITS.md
```
Bagning (`HAVN_LM_DENSITY` pixels/m, `HAVN_BAKE_SAMPLES`; endelig bagning: 10 px/m, 64 samples, kun GPU/Metal):
- To additive pas: A = himmel + lamper (direkte og indirekte, solen slukket), B = solens indirekte lys. Lysmap = A + B.
  Den direkte sol tegnes i realtid i spillet. Ingen subtraktion, så der opstår ingen negativ støj, der klippes til pletter.
- Lysmaps støjfjernes med Intel Open Image Denoise (`tools/havn/denoise_lm.py`, Blenders compositor) og gemmes som PNG (gamma 2,2 × skala).
- Cycles kører kun på GPU'en: blandet CPU + Metal crashede i CPU-stien.

Blender-moduler (`tools/havn/bld/`):

| Modul | Indhold |
|---|---|
| `ground` | Belægninger, kajmure, dæksten, trapper og ramper. |
| `building` | Rækkehuse, facader, tage og brandmure. |
| `halls` | Pakhuset, Fiskehallen og iskælderen. |
| `structures` | Broer, sluse, ponton, pram, mole, kiosk, havnekontor, vogne, vold, kirke, toldbod og loftsbalkon. |
| `props` | Modeller, springvand, pullerter og flag. |
| `backdrop` | Kulisse uden for banen. |
| `bake` | Bagning og eksport. |

Spillet (`public/js/havn.js`):
- Indlæser `world.bin` (kvantiserede positioner og delte hjørner).
- Bruger KTX2-teksturer og lysmaps.
- Shader: bagt indirekte lys, snavs/mos/vådt og bølgende vand.

## Test
- `node test/nav.js havn`: rækkevidde, fysisk gang, spawn-sigtelinjer og CT-først-timings.
- `node test/havn.js`:
  - filer og budget,
  - grafik = kollision set ovenfra (gå-bare flader; tage og vand er ikke med),
  - ingen huller ("usynlige vægge"): vandrette stråler fra gå-bare punkter, ramper som massive kiler, strejf langs mure tæller ikke,
  - ingen spøgelsesvægge,
  - hver rekvisits kollisionskasse indeholder synlig grafik.
- Foto-tur i spillet: `?dev=1&tour=havn` på testserveren (`WD_TEST=1`) → `docs/qa/tour_havn_*.jpg`.
