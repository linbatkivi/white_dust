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
