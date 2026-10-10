# QA-værktøjer (v14, fase 1)

| Værktøj | Kommando | Resultat |
|---|---|---|
| **Bane-QA** (svævere, huller, tomhed, lys) | `npm run qa` (eller `node test/mapqa.js nuke`) | `docs/qa/<bane>_qa.png` + `.json`. Køres strengt i `npm test` (0 svævere, 0 huller). |
| **Foto-tur** (kontaktark) | Start testserveren (`WD_TEST=1 PORT=3200 node server.js`) og åbn `http://localhost:3200/?dev=1&tour=inferno` | `docs/qa/tour_<bane>_<n>.jpg` (12 billeder pr. ark: alle callouts, 4 vinkler pr. site, 2 pr. spawn, 2 oversigter) |
| Udvalgte billeder | `?dev=1&tour=nuke&shots=3,7,12` | `tour_<bane>_valg_<n>.jpg` |
| Egne kameraer (konsol) | `await __wd.tour('nuke', [{n:'navn', x, y, z, yaw, pitch}])` | `tour_<bane>_dbg_<n>.jpg` |
| **Ydelse** (fase 8) | Åbn `?dev=1&tour=nuke&shots=1`, sæt vinduet til 2560×1440, og kør i konsollen: `(await import('/dev/helpers.js')).perf({ q: 'medium', pr: 1 })` | ms pr. frame (median/p90/maks) og draw calls over alle foto-turens kameraer |
| Genladning (kontaktark) | `__wd.Renderer.vmSheet(['ak47@0.25', 'glock@0.13'], 4, 480, 270)` – `@p` = punkt i genladningen (0–1); `tpSheet(['ak47@0.3'])` i tredjeperson | `docs/qa/genladning_ud/ind/spaend.jpg`, `genladning_dele.jpg` (rødt = magasinet der skiftes) |
| Førstepersons-våben | `__wd.Renderer.vmSheet(ids, 4, 360, 220, side)` | dataURL med kontaktark |

**Varmekort:** venstre panel = dekor-tæthed inden for 6 m (rød = tomt, grøn = tæt). Magenta = svævende objekt, cyan = hul ud af banen, hvide prikker = callouts. Højre panel = lys (bagt himmel + lamper i 1,2 m højde). Én række pr. etage (kælder / gade / øvre).

`docs/qa/foer/` indeholder foto-turene fra før v14-banearbejdet, til før/efter-sammenligning.
