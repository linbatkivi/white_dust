// ==========================================================================
// VÅBEN (v9): detaljerede 3D-modeller bygget af ekstruderede sideprofiler (skarpe silhuetter med fasede kanter),
// cylindre og drejede dele – med holdspecifikke PBR-finish:
//   Hijackers «Worn Factory»: ru, slidt fabriksfinish (parkeriseret stål med kantslid/rust, slidt valnøddetræ på AK-47, mørkt metal på Tec-9)
//   SWAT «Tactical Graphite»: rent militært look (kulsort/mørkegrå grafit-cerakote med blå-taktiske accenter)
//   Modeller: AK-47, Galil AR, Tec-9 · M4A1, FAMAS, Five-SeveN · AWP, Desert Eagle, MP5, USP-S, Glock-18
//             HE, flashbang, smoke, molotov, brandgranat (sikringsring der kan trækkes) og C4.
// Koordinater: origo = pistolgrebet (højre hånd), løbet peger mod -Z, op = +Y, enheder i meter.
//   createWeapons(THREE, WD, { canvasTexture, dynMat, withBake, derivePBR })
//     -> { viewmodel(id, team), worldModel(id, sharedBakeMat, team), c4Model(), c4View(), skinName(id, team), MODELS }
// ==========================================================================
export function createWeapons(THREE, WD, opts) {
  const o = opts || {}, TAU = Math.PI * 2;
  const rnd = seed => { let s = (seed >>> 0) % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

  /* ======================================================== hold-finish (canvas-teksturer) ========================================================
     Hijackers: ru, slidt og taktisk fabriksfinish – parkeriseret mørkt metal med kantslid, ridser og rustpletter, slidt valnøddetræ.
     SWAT: rent, professionelt militært look – kulsort/mørkegrå grafit-cerakote med fin struktur + blå-taktiske accenter (anodiseret). */
  const texCache = {};
  const tex = (key, draw, size) => {
    if (texCache[key]) return texCache[key];
    const t = o.canvasTexture(draw, size || 512, size || 512); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return (texCache[key] = t);
  };
  const SK = {};
  SK.hijMetal = () => tex('hijMetal', (c, w, h) => {      // parkeriseret stål: mørk grå-brun, kantslid (lyst stål), ridser, rust, fedtpletter
    const R = rnd(31); c.fillStyle = '#3a3935'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = 40 + R() * 30 | 0; c.fillStyle = `rgba(${v + 6},${v + 4},${v},${0.25 + R() * 0.3})`; c.fillRect(R() * w, R() * h, 2, 2); }
    for (let i = 0; i < 40; i++) { const x = R() * w, y = R() * h, r = 10 + R() * 40, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(120,118,110,.32)'); g.addColorStop(1, 'rgba(120,118,110,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }   // slidte, blankere områder
    for (let i = 0; i < 26; i++) { const x = R() * w, y = R() * h, r = 4 + R() * 18, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(110,62,30,.55)'); g.addColorStop(1, 'rgba(110,62,30,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }        // rust
    for (let i = 0; i < 220; i++) { c.strokeStyle = `rgba(${170 + R() * 60 | 0},${165 + R() * 55 | 0},${150 + R() * 50 | 0},${0.25 + R() * 0.45})`; c.lineWidth = 0.6 + R() * 1.1; c.beginPath(); const x = R() * w, y = R() * h, a = R() * 6.28, l = 6 + R() * 40; c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }   // ridser
    for (let i = 0; i < 12; i++) { c.fillStyle = `rgba(20,18,14,${0.15 + R() * 0.2})`; c.beginPath(); c.ellipse(R() * w, R() * h, 10 + R() * 30, 6 + R() * 18, R() * 3, 0, TAU); c.fill(); }   // fedt/snavs
  });
  SK.hijWood = () => tex('hijWood', (c, w, h) => {        // slidt valnød: mørk ådring, lysere slidte kanter, hak og ridser
    const R = rnd(7); c.fillStyle = '#5b3418'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 180; i++) { c.strokeStyle = `rgba(${60 + R() * 50 | 0},${30 + R() * 22 | 0},${10 + R() * 12 | 0},${0.3 + R() * 0.45})`; c.lineWidth = 1 + R() * 3; c.beginPath(); const y = R() * h; c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + (R() - 0.5) * 30, w * 0.6, y + (R() - 0.5) * 30, w, y + (R() - 0.5) * 20); c.stroke(); }
    for (let i = 0; i < 18; i++) { const x = R() * w, y = R() * h, r = 20 + R() * 60, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(170,120,70,.35)'); g.addColorStop(1, 'rgba(170,120,70,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
    for (let i = 0; i < 140; i++) { c.strokeStyle = `rgba(${25 + R() * 20 | 0},14,6,${0.3 + R() * 0.4})`; c.lineWidth = 0.8 + R(); c.beginPath(); const x = R() * w, y = R() * h; c.moveTo(x, y); c.lineTo(x + (R() - 0.5) * 30, y + (R() - 0.5) * 8); c.stroke(); }
    for (let i = 0; i < 30; i++) { c.fillStyle = 'rgba(30,16,6,.55)'; c.beginPath(); c.arc(R() * w, R() * h, 1 + R() * 3, 0, TAU); c.fill(); }   // hak
  });
  SK.hijPoly = () => tex('hijPoly', (c, w, h) => {        // falmet sort-brun polymer
    const R = rnd(41); c.fillStyle = '#2c2925'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 7000; i++) { const v = 30 + R() * 30 | 0; c.fillStyle = `rgba(${v + 8},${v + 5},${v},.35)`; c.fillRect(R() * w, R() * h, 2, 2); }
    for (let i = 0; i < 26; i++) { const x = R() * w, y = R() * h, r = 15 + R() * 50, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(95,88,74,.3)'); g.addColorStop(1, 'rgba(95,88,74,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
  });
  SK.swatMetal = () => tex('swatMetal', (c, w, h) => {    // grafit-cerakote: kulsort/mørkegrå, meget fin struktur, ingen slid
    const R = rnd(11); c.fillStyle = '#2a2c30'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 16000; i++) { const v = 36 + R() * 14 | 0; c.fillStyle = `rgba(${v},${v + 1},${v + 4},.5)`; c.fillRect(R() * w, R() * h, 1.5, 1.5); }
    c.strokeStyle = 'rgba(255,255,255,.025)'; c.lineWidth = 1; for (let i = -h; i < w; i += 6) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke(); }   // subtil vævet struktur
    for (let i = 0; i < 10; i++) { const x = R() * w, y = R() * h, r = 40 + R() * 80, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(70,74,82,.12)'); g.addColorStop(1, 'rgba(70,74,82,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
  });
  SK.swatPoly = () => tex('swatPoly', (c, w, h) => {      // mørkegrå polymer med greb-tekstur
    const R = rnd(23); c.fillStyle = '#212327'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 6) for (let x = (y / 6) % 2 * 3; x < w; x += 6) { c.fillStyle = 'rgba(255,255,255,.035)'; c.fillRect(x, y, 2, 2); }
    for (let i = 0; i < 5000; i++) { c.fillStyle = `rgba(0,0,0,${R() * 0.18})`; c.fillRect(R() * w, R() * h, 2, 2); }
  });
  SK.c4 = () => tex('c4', (c, w, h) => {                // C4-indpakning: olivengrå folie med påskrift og tape
    c.fillStyle = '#6f7356'; c.fillRect(0, 0, w, h); const R = rnd(29);
    for (let i = 0; i < 4000; i++) { c.fillStyle = `rgba(0,0,0,${R() * 0.12})`; c.fillRect(R() * w, R() * h, 2, 2); }
    c.fillStyle = '#1a1a1a'; c.font = '900 40px Arial'; c.fillText('CHARGE, DEMOLITION', 20, 90); c.font = '700 26px Arial'; c.fillText('M112  C-4  1.25 LB', 20, 140);
    c.fillStyle = '#2a2a2a'; c.fillRect(0, h * 0.62, w, 46); c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(0, h * 0.62 + 8, w, 6);
  });
  SK.rag = () => tex('rag', (c, w, h) => {                // molotov-klud: snavset bomuld
    const R = rnd(61); c.fillStyle = '#b9a98a'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(90,70,40,.3)'; for (let i = 0; i < w; i += 4) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); }
    for (let i = 0; i < 20; i++) { const x = R() * w, y = R() * h, r = 20 + R() * 60, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(60,40,20,.5)'); g.addColorStop(1, 'rgba(60,40,20,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
  }, 256);
  // hvilket hold-finish et våben får: holdets egne våben altid deres holds finish; fælles våben (AWP, Deagle, nades) følger ejerens hold
  const FINISH_NAME = { hij: 'Worn Factory', swat: 'Tactical Graphite' };
  const finishTeam = (id, team) => { const w = WD.WEAPONS[id]; return (w && w.team) || (team === 'hij' ? 'hij' : 'swat'); };
  const skinName = (id, team) => { const w = WD.WEAPONS[id]; return w && w.kind === 'gun' ? FINISH_NAME[finishTeam(id, team)] : null; };
  const SKIN_NAME = {}; for (const k in WD.WEAPONS) if (WD.WEAPONS[k].kind === 'gun') SKIN_NAME[k] = FINISH_NAME[finishTeam(k, 'swat')];

  /* ======================================================== geometri-hjælpere ======================================================== */
  // sideprofil i (z,y) – z bagud positiv – ekstruderet i bredde w langs x, centreret
  function prof(pts, w, bevel) {
    const s = new THREE.Shape(); pts.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]));
    const bv = bevel === undefined ? Math.min(0.004, w * 0.15) : bevel;
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, w - bv * 2), bevelEnabled: bv > 0, bevelThickness: bv, bevelSize: bv * 0.9, bevelSegments: 2, curveSegments: 6 });
    g.rotateY(-Math.PI / 2); g.translate(w / 2 - bv, 0, 0);
    return g;
  }
  const cylZ = (r0, r1, len, seg) => { const g = new THREE.CylinderGeometry(r1, r0, len, seg || 14); g.rotateX(-Math.PI / 2); return g; };   // langs Z (r0 bagest? => r1 forrest)
  const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  function curvedMag(top, bottom, curve, depth, w) {   // bananmagasin: profil langs en kurve
    const pts = [], n = 10;
    for (let i = 0; i <= n; i++) { const t = i / n, y = -t * top; pts.push([curve * t * t, y]); }
    const front = pts.map(p => [p[0] - depth / 2, p[1]]), back = pts.map(p => [p[0] + depth / 2, p[1]]).reverse();
    return prof(front.concat(back), w, 0.003);
  }

  /* ======================================================== materialer ========================================================
     viewmodel: PBR (MeshStandard) med roughness/metalness-maps afledt af finish-teksturen + miljø-refleksion; verden: PBR med bagt probe-lys */
  function mats(id, kind, team) {
    const view = kind === 'view', ft = finishTeam(id, team), hij = ft === 'hij';
    const mk = (opt) => {
      if (view) {
        const { nrm, rv, ...p } = opt, m = new THREE.MeshStandardMaterial(p);
        if (p.map && o.derivePBR) { const d = o.derivePBR(THREE, p.map, { normal: nrm || 0.25, rough: p.roughness, metal: p.metalness, rv }); if (d) { if (d.normalMap) { m.normalMap = d.normalMap; m.normalScale.set(0.6, 0.6); } m.roughnessMap = d.orm; m.metalnessMap = d.orm; m.roughness = 1; m.metalness = 1; } }
        if (o.withBake) o.withBake(m, true);
        return m;
      }
      return o.dynMat ? o.dynMat({ color: opt.color, map: opt.map || null, roughness: opt.roughness, metalness: opt.metalness }) : new THREE.MeshLambertMaterial({ color: opt.color, map: opt.map || null });
    };
    const rep = t => { if (t) t.repeat.set(3, 3); return t; };
    const metalT = rep(hij ? SK.hijMetal() : SK.swatMetal()), polyT = rep(hij ? SK.hijPoly() : SK.swatPoly());
    const M = {
      // finish er belægninger (parkerisering / cerakote) – ikke blankt metal: lav metalness, så formen læses tydeligt; kanter/stål reflekterer
      skin: mk({ color: 0xffffff, map: metalT, metalness: hij ? 0.32 : 0.14, roughness: hij ? 0.6 : 0.42, rv: hij ? 0.4 : 0.1, nrm: hij ? 0.45 : 0.15 }),
      metal: mk({ color: hij ? 0x46433d : 0x3a3d42, metalness: 0.6, roughness: hij ? 0.48 : 0.34 }),
      dark: mk({ color: hij ? 0x26231f : 0x1f2124, metalness: 0.28, roughness: 0.55 }),
      poly: mk({ color: 0xffffff, map: polyT, metalness: 0.04, roughness: hij ? 0.78 : 0.62, nrm: 0.2 }),
      bright: mk({ color: hij ? 0x8a8478 : 0x8e9398, metalness: 0.95, roughness: hij ? 0.4 : 0.22 }),
      wood: hij ? mk({ color: 0xffffff, map: rep(SK.hijWood()), metalness: 0.02, roughness: 0.62, rv: 0.35, nrm: 0.5 }) : mk({ color: 0xffffff, map: polyT, metalness: 0.04, roughness: 0.62 }),
      accent: hij ? mk({ color: 0x6b5a3c, metalness: 0.3, roughness: 0.7 }) : mk({ color: 0x2a63c8, metalness: 0.75, roughness: 0.28 }),   // SWAT: blå anodiseret
      glass: mk({ color: 0x1a3a4a, metalness: 0.9, roughness: 0.08 }),
      brass: mk({ color: 0xc89a3a, metalness: 0.9, roughness: 0.3 })
    };
    M.mk = mk;
    return M;
  }

  /* ======================================================== modelbyggere ======================================================== */
  // hver funktion bygger dele i gruppen g og returnerer metadata: { muzzle, support, mag?, bolt?, slide? }
  const B = {};
  B.ak47 = (g, M) => {
    const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); g.add(me); return me; };
    // underdel/receiver + støvdæksel (skin)
    add(prof([[-0.29, 0.005], [0.07, 0.005], [0.1, 0.02], [0.1, 0.055], [0.04, 0.066], [-0.29, 0.066]], 0.046), M.skin);
    add(prof([[-0.2, 0.066], [0.06, 0.066], [0.075, 0.074], [-0.2, 0.078]], 0.044), M.skin);
    for (let i = 0; i < 4; i++) add(boxG(0.046, 0.004, 0.006), M.dark, 0, 0.076, -0.15 + i * 0.05);         // ribber på dækslet
    add(boxG(0.012, 0.012, 0.03), M.bright, 0.026, 0.05, -0.07);                                            // ladegreb
    add(prof([[-0.06, 0.04], [-0.06, 0.02], [0.0, 0.02], [0.0, 0.04]], 0.05), M.dark);                      // sikringsarm
    // pistolgreb (træ) + aftrækkerbøjle
    add(prof([[-0.02, 0.008], [0.03, 0.008], [0.065, -0.095], [0.035, -0.105], [0.0, -0.02]], 0.034), M.wood);
    add(new THREE.TorusGeometry(0.03, 0.004, 6, 14, Math.PI), M.metal, 0, -0.005, -0.03).rotation.set(0, Math.PI / 2, Math.PI);
    add(boxG(0.006, 0.026, 0.008), M.metal, 0, -0.01, -0.02);
    // kolbe (træ, skin-indlæg)
    add(prof([[0.09, 0.06], [0.33, 0.035], [0.34, -0.06], [0.31, -0.07], [0.12, -0.015], [0.09, 0.0]], 0.042), M.wood);
    add(prof([[0.335, 0.036], [0.348, 0.034], [0.355, -0.062], [0.342, -0.064]], 0.044, 0.002), M.dark);      // kolbeplade
    // nedre + øvre håndbeskytter (træ)
    add(prof([[-0.48, 0.02], [-0.29, 0.02], [-0.29, 0.06], [-0.48, 0.055]], 0.05), M.wood);
    add(prof([[-0.45, 0.062], [-0.3, 0.062], [-0.3, 0.085], [-0.45, 0.08]], 0.038), M.wood);
    // løb, gasrør, sigte, mundingsbremse
    add(cylZ(0.011, 0.011, 0.3, 12), M.metal, 0, 0.04, -0.63);
    add(cylZ(0.012, 0.012, 0.18, 10), M.metal, 0, 0.073, -0.39);
    add(boxG(0.012, 0.03, 0.02), M.metal, 0, 0.062, -0.47);
    add(prof([[-0.67, 0.04], [-0.65, 0.04], [-0.655, 0.095], [-0.665, 0.095]], 0.012, 0.001), M.metal);      // forsigte
    add(new THREE.TorusGeometry(0.014, 0.003, 6, 12), M.metal, 0, 0.088, -0.66).rotation.y = Math.PI / 2;
    add(boxG(0.028, 0.016, 0.03), M.metal, 0, 0.082, -0.31);                                                 // bagsigte-blok
    add(cylZ(0.016, 0.014, 0.05, 10), M.dark, 0, 0.04, -0.8);
    add(boxG(0.004, 0.006, 0.02), M.bright, 0.0, 0.056, -0.8);
    // bananmagasin
    const mag = add(curvedMag(0.22, 0, 0.09, 0.05, 0.03), M.skin, 0, 0.0, -0.1);
    add(boxG(0.034, 0.012, 0.06), M.dark, 0, -0.002, -0.1);
    return { muzzle: new THREE.Vector3(0, 0.04, -0.83), support: new THREE.Vector3(-0.005, 0.03, -0.39), mag, magPos: mag.position.clone(), eject: new THREE.Vector3(0.03, 0.065, -0.1) };
  };
  B.m4a1 = (g, M) => {
    const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); g.add(me); return me; };
    add(prof([[-0.2, 0.0], [0.07, 0.0], [0.09, 0.02], [0.09, 0.045], [-0.2, 0.045]], 0.05), M.skin);          // nedre receiver
    add(prof([[-0.24, 0.045], [0.09, 0.045], [0.09, 0.085], [-0.24, 0.085]], 0.046), M.skin);                // øvre receiver
    for (let i = 0; i < 14; i++) add(boxG(0.024, 0.008, 0.01), M.dark, 0, 0.09, -0.22 + i * 0.022);          // picatinny-skinne
    add(boxG(0.016, 0.03, 0.04), M.dark, 0, 0.1, 0.06);                                                       // bagsigte
    add(prof([[-0.01, 0.005], [0.03, 0.005], [0.06, -0.09], [0.032, -0.098], [0.0, -0.02]], 0.032), M.poly);  // greb
    add(new THREE.TorusGeometry(0.028, 0.004, 6, 14, Math.PI), M.metal, 0, -0.004, -0.03).rotation.set(0, Math.PI / 2, Math.PI);
    add(cylZ(0.016, 0.016, 0.2, 12), M.dark, 0, 0.065, 0.19);                                                 // bufferrør
    add(prof([[0.12, 0.09], [0.29, 0.085], [0.3, -0.045], [0.27, -0.05], [0.2, 0.02], [0.12, 0.04]], 0.04), M.poly);   // kolbe
    // håndbeskytter (cylindrisk m. skinner), løb, flammedæmper, forsigte
    add(cylZ(0.03, 0.03, 0.22, 14), M.skin, 0, 0.06, -0.35);
    for (const a of [0, Math.PI / 2, -Math.PI / 2]) { const r = add(boxG(0.012, 0.012, 0.2), M.dark, Math.sin(a) * 0.031, 0.06 + Math.cos(a) * 0.031, -0.35); r.rotation.z = a; }
    add(cylZ(0.01, 0.01, 0.22, 12), M.metal, 0, 0.06, -0.56);
    add(cylZ(0.014, 0.013, 0.05, 10), M.dark, 0, 0.06, -0.69);
    add(prof([[-0.48, 0.06], [-0.46, 0.06], [-0.465, 0.115], [-0.475, 0.115]], 0.014, 0.001), M.dark);
    add(boxG(0.03, 0.03, 0.04), M.dark, 0, 0.075, -0.47);
    const mag = add(curvedMag(0.19, 0, 0.025, 0.055, 0.026), M.metal, 0, 0.002, -0.085);
    const mb = new THREE.Mesh(boxG(0.03, 0.012, 0.064), M.accent); mb.position.set(0, -0.188, 0.022); mag.add(mb);   // blå magasinbund
    add(boxG(0.032, 0.04, 0.06), M.skin, 0, -0.015, -0.085);                                                // magasinbrønd
    add(boxG(0.026, 0.01, 0.05), M.accent, 0, 0.1, 0.0);                                                     // ladegreb (accent)
    for (const z of [-0.3, -0.4]) add(boxG(0.034, 0.012, 0.06), M.accent, 0, 0.094, z);                      // skinnedæksler
    return { muzzle: new THREE.Vector3(0, 0.06, -0.72), support: new THREE.Vector3(-0.005, 0.03, -0.36), mag, magPos: mag.position.clone(), eject: new THREE.Vector3(0.03, 0.065, -0.05) };
  };
  B.awp = (g, M) => {
    const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); g.add(me); return me; };
    // skæfte med tommelfingerhul (skin)
    add(prof([[-0.5, 0.0], [-0.12, 0.0], [-0.06, -0.01], [0.02, -0.02], [0.07, -0.11], [0.04, -0.12], [0.1, -0.12], [0.12, -0.02], [0.4, -0.01], [0.42, -0.08], [0.45, -0.09], [0.47, 0.06], [0.12, 0.05], [-0.5, 0.05]], 0.058), M.skin);
    add(prof([[0.455, 0.06], [0.475, 0.06], [0.48, -0.09], [0.46, -0.092]], 0.06, 0.002), M.dark);           // kolbeplade
    add(prof([[0.25, 0.05], [0.4, 0.05], [0.4, 0.085], [0.25, 0.075]], 0.03), M.skin);                       // kindstøtte
    // receiver, bolt, løb
    add(cylZ(0.022, 0.022, 0.26, 16), M.metal, 0, 0.065, -0.06);
    const bolt = new THREE.Group(); bolt.position.set(0.0, 0.065, 0.05); g.add(bolt);
    const bh = new THREE.Mesh(cylZ(0.006, 0.006, 0.06, 8), M.bright); bh.rotation.y = Math.PI / 2; bh.position.set(0.035, 0, 0); bolt.add(bh);
    const bk = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), M.dark); bk.position.set(0.066, 0, 0); bolt.add(bk);
    add(cylZ(0.016, 0.012, 0.62, 14), M.metal, 0, 0.065, -0.5);
    add(cylZ(0.019, 0.019, 0.07, 12), M.dark, 0, 0.065, -0.84);
    for (let i = 0; i < 3; i++) add(boxG(0.02, 0.004, 0.012), M.metal, 0, 0.083, -0.84 + i * 0.02 - 0.02);
    // kikkert m. ringe
    add(cylZ(0.022, 0.022, 0.2, 18), M.metal, 0, 0.135, -0.05);
    add(cylZ(0.022, 0.032, 0.06, 18), M.metal, 0, 0.135, -0.18); add(cylZ(0.032, 0.032, 0.05, 18), M.metal, 0, 0.135, -0.235);
    add(cylZ(0.022, 0.03, 0.05, 18), M.metal, 0, 0.135, 0.075);
    add(cylZ(0.029, 0.029, 0.003, 18), M.glass, 0, 0.135, -0.262); add(cylZ(0.027, 0.027, 0.003, 18), M.glass, 0, 0.135, 0.1);
    add(cylZ(0.008, 0.008, 0.02, 8), M.dark, 0, 0.17, -0.06); add(new THREE.CylinderGeometry(0.009, 0.009, 0.02, 8), M.dark, 0.03, 0.135, -0.06).rotation.z = Math.PI / 2;
    for (const z of [-0.12, 0.02]) add(boxG(0.03, 0.05, 0.016), M.dark, 0, 0.1, z);
    add(new THREE.TorusGeometry(0.03, 0.004, 6, 14, Math.PI), M.metal, 0, -0.005, -0.04).rotation.set(0, Math.PI / 2, Math.PI);
    const mag = add(boxG(0.03, 0.07, 0.07), M.dark, 0, -0.025, -0.11);
    // sammenfoldet tofod
    for (const s of [-1, 1]) { const l = add(cylZ(0.006, 0.006, 0.2, 6), M.dark, s * 0.02, -0.005, -0.4); l.rotation.x = -0.05; }
    return { muzzle: new THREE.Vector3(0, 0.065, -0.88), support: new THREE.Vector3(-0.005, 0.0, -0.33), mag, magPos: mag.position.clone(), bolt, scope: true, eject: new THREE.Vector3(0.03, 0.07, -0.02) };
  };
  B.mp5 = (g, M) => {
    const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); g.add(me); return me; };
    add(cylZ(0.024, 0.024, 0.32, 14), M.skin, 0, 0.06, -0.1);
    add(prof([[-0.08, 0.0], [0.08, 0.0], [0.08, 0.045], [-0.08, 0.045]], 0.042), M.skin);
    add(prof([[-0.01, 0.005], [0.03, 0.005], [0.058, -0.09], [0.03, -0.097], [0.0, -0.02]], 0.032), M.poly);
    add(new THREE.TorusGeometry(0.027, 0.004, 6, 14, Math.PI), M.metal, 0, -0.004, -0.03).rotation.set(0, Math.PI / 2, Math.PI);
    add(prof([[-0.36, 0.02], [-0.18, 0.02], [-0.18, 0.08], [-0.36, 0.075]], 0.05), M.poly);                 // forskæfte
    add(cylZ(0.01, 0.01, 0.08, 10), M.metal, 0, 0.06, -0.4); add(cylZ(0.016, 0.016, 0.03, 10), M.dark, 0, 0.06, -0.445);
    add(boxG(0.012, 0.035, 0.012), M.metal, 0, 0.098, -0.33); add(new THREE.TorusGeometry(0.012, 0.003, 6, 12), M.metal, 0, 0.11, -0.33).rotation.y = Math.PI / 2;
    add(boxG(0.03, 0.03, 0.03), M.metal, 0, 0.098, 0.04);
    for (const s of [-1, 1]) add(cylZ(0.006, 0.006, 0.2, 6), M.metal, s * 0.022, 0.05, 0.16);                // teleskopkolbe
    add(prof([[0.25, 0.08], [0.27, 0.08], [0.27, -0.03], [0.25, -0.03]], 0.05), M.poly);
    const mag = add(curvedMag(0.17, 0, 0.05, 0.035, 0.024), M.metal, 0, 0.0, -0.07);
    return { muzzle: new THREE.Vector3(0, 0.06, -0.47), support: new THREE.Vector3(-0.005, 0.02, -0.27), mag, magPos: mag.position.clone(), eject: new THREE.Vector3(0.03, 0.06, -0.06) };
  };
  /* ---- v13: maskinpistoler. Generisk SMG-skabelon (receiver, greb, magasin, kolbe, løb) – mål pr. model; GLB-modellen (poly.pizza, CC0) passes ind i kassen ---- */
  function smgB(d) {
    return (g, M) => {
      const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); g.add(me); return me; };
      const h = d.h || 0.07, by = h * 0.72;
      add(prof([[d.front, 0.0], [d.rear, 0.0], [d.rear, h], [d.front, h]], d.w || 0.042), M.skin);                            // receiver
      add(prof([[-0.01 + d.grip, 0.004], [0.03 + d.grip, 0.004], [0.056 + d.grip, -0.088], [0.028 + d.grip, -0.096], [d.grip, -0.02]], 0.032), M.poly);   // pistolgreb
      add(new THREE.TorusGeometry(0.025, 0.004, 6, 14, Math.PI), M.metal, 0, -0.004, d.grip - 0.03).rotation.set(0, Math.PI / 2, Math.PI);
      add(cylZ(0.011, 0.011, d.front - d.muzzle, 12), M.metal, 0, by, (d.front + d.muzzle) / 2);                            // løb
      add(cylZ(0.015, 0.015, 0.03, 10), M.dark, 0, by, d.muzzle + 0.015);
      for (let i = 0; i < Math.round((d.rear - d.front) / 0.03); i++) add(boxG(0.02, 0.006, 0.01), M.dark, 0, h + 0.004, d.front + 0.015 + i * 0.03);   // skinne
      let mag;
      if (d.topMag) { mag = add(boxG(0.04, 0.03, d.rear - d.front - 0.04), M.poly, 0, h + 0.02, (d.front + d.rear) / 2); }    // P90: magasin på toppen
      else mag = add(d.curve ? curvedMag(d.magLen, 0, d.curve, 0.032, 0.024) : boxG(0.024, d.magLen, 0.03), M.metal, 0, d.curve ? 0.0 : -d.magLen / 2, d.magZ);
      if (d.stock) { add(cylZ(0.008, 0.008, d.stock, 6), M.metal, 0.018, h * 0.6, d.rear + d.stock / 2); add(cylZ(0.008, 0.008, d.stock, 6), M.metal, -0.018, h * 0.6, d.rear + d.stock / 2); add(prof([[d.rear + d.stock - 0.02, h + 0.01], [d.rear + d.stock, h + 0.01], [d.rear + d.stock, -0.04], [d.rear + d.stock - 0.02, -0.04]], 0.045), M.poly); }
      if (d.fore) add(prof([[d.fore[0], -0.005], [d.fore[1], -0.005], [d.fore[1], 0.02], [d.fore[0], 0.02]], 0.03), M.poly);   // forgreb
      return { muzzle: new THREE.Vector3(0, by, d.muzzle - 0.01), support: new THREE.Vector3(-0.005, d.supY || 0.0, d.sup), mag, magPos: mag.position.clone(), eject: new THREE.Vector3(0.03, h, (d.front + d.rear) / 2 + 0.04) };
    };
  }
  B.mac10 = smgB({ front: -0.15, rear: 0.09, h: 0.075, w: 0.046, muzzle: -0.24, grip: -0.02, magZ: -0.02, magLen: 0.17, stock: 0.17, sup: -0.13, supY: -0.01 });   // magasinet sidder i greb
  B.mp9 = smgB({ front: -0.2, rear: 0.08, h: 0.068, w: 0.04, muzzle: -0.3, grip: -0.03, magZ: -0.03, magLen: 0.17, stock: 0.2, fore: [-0.18, -0.12], sup: -0.16, supY: -0.03 });
  B.mp7 = smgB({ front: -0.24, rear: 0.07, h: 0.072, w: 0.042, muzzle: -0.33, grip: -0.03, magZ: -0.03, magLen: 0.19, stock: 0.2, fore: [-0.2, -0.14], sup: -0.18, supY: -0.03 });
  B.ump45 = smgB({ front: -0.3, rear: 0.1, h: 0.08, w: 0.046, muzzle: -0.42, grip: -0.0, magZ: -0.11, magLen: 0.17, curve: 0.02, stock: 0.24, sup: -0.25, supY: 0.0 });
  B.p90 = smgB({ front: -0.33, rear: 0.16, h: 0.11, w: 0.05, muzzle: -0.44, grip: -0.16, magZ: -0.1, magLen: 0.04, topMag: true, sup: -0.28, supY: 0.0 });
  B.usp = (g, M) => {
    const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); g.add(me); return me; };
    const slide = new THREE.Group(); g.add(slide);
    const sl = new THREE.Mesh(prof([[-0.16, 0.035], [0.03, 0.035], [0.03, 0.075], [0.0, 0.08], [-0.16, 0.08]], 0.03), M.skin); slide.add(sl);
    for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(boxG(0.031, 0.03, 0.003), M.dark); s.position.set(0, 0.058, 0.0 - i * 0.007); slide.add(s); }
    add(prof([[-0.15, 0.01], [0.02, 0.01], [0.02, 0.035], [-0.15, 0.035]], 0.028), M.poly);                  // ramme
    add(prof([[-0.012, 0.012], [0.03, 0.012], [0.05, -0.09], [0.012, -0.095], [-0.008, -0.02]], 0.03), M.poly); // greb
    add(new THREE.TorusGeometry(0.022, 0.0035, 6, 12, Math.PI), M.poly, 0, 0.0, -0.03).rotation.set(0, Math.PI / 2, Math.PI);
    add(cylZ(0.0085, 0.0085, 0.02, 10), M.metal, 0, 0.058, -0.17);
    add(cylZ(0.016, 0.016, 0.15, 16), M.dark, 0, 0.058, -0.255);                                              // lyddæmper
    add(cylZ(0.0165, 0.0165, 0.01, 16), M.skin, 0, 0.058, -0.19); add(cylZ(0.0165, 0.0165, 0.01, 16), M.skin, 0, 0.058, -0.325);
    add(boxG(0.006, 0.012, 0.006), M.metal, 0, 0.086, -0.15); add(boxG(0.022, 0.01, 0.008), M.metal, 0, 0.085, 0.02);
    const mag = add(boxG(0.022, 0.02, 0.03), M.dark, 0, -0.095, 0.02);
    return { muzzle: new THREE.Vector3(0, 0.058, -0.335), pistol: true, slide, mag, magPos: mag.position.clone(), eject: new THREE.Vector3(0.02, 0.07, -0.04) };
  };
  B.glock = (g, M) => {
    const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); g.add(me); return me; };
    const slide = new THREE.Group(); g.add(slide);
    slide.add(new THREE.Mesh(prof([[-0.16, 0.035], [0.025, 0.035], [0.025, 0.078], [-0.16, 0.078]], 0.028, 0.002), M.skin));
    for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(boxG(0.029, 0.03, 0.003), M.dark); s.position.set(0, 0.058, 0.0 - i * 0.007); slide.add(s); }
    add(prof([[-0.15, 0.012], [0.02, 0.012], [0.02, 0.035], [-0.15, 0.035]], 0.027), M.poly);
    add(prof([[-0.01, 0.012], [0.028, 0.012], [0.045, -0.09], [0.01, -0.095], [-0.008, -0.02]], 0.03), M.poly);
    add(new THREE.TorusGeometry(0.022, 0.0035, 6, 12, Math.PI), M.poly, 0, 0.0, -0.03).rotation.set(0, Math.PI / 2, Math.PI);
    add(cylZ(0.0075, 0.0075, 0.012, 10), M.metal, 0, 0.058, -0.165);
    add(boxG(0.006, 0.01, 0.006), M.bright, 0, 0.083, -0.15); add(boxG(0.02, 0.01, 0.008), M.dark, 0, 0.083, 0.015);
    const mag = add(boxG(0.022, 0.02, 0.03), M.dark, 0, -0.095, 0.015);
    return { muzzle: new THREE.Vector3(0, 0.058, -0.175), pistol: true, slide, mag, magPos: mag.position.clone(), eject: new THREE.Vector3(0.02, 0.07, -0.04) };
  };
  /* ---------------- v9: holdenes nye våben ---------------- */
  B.galil = (g, M) => {                                   // Galil AR (Hijackers): AK-afledt receiver, skeletkolbe, ventileret håndbeskytter
    const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); g.add(me); return me; };
    add(prof([[-0.27, 0.004], [0.07, 0.004], [0.1, 0.022], [0.1, 0.058], [0.04, 0.066], [-0.27, 0.066]], 0.046), M.skin);
    add(prof([[-0.19, 0.066], [0.06, 0.066], [0.075, 0.073], [-0.19, 0.078]], 0.044), M.skin);
    add(boxG(0.012, 0.012, 0.03), M.bright, 0.026, 0.052, -0.07);                                             // ladegreb (op-vinklet)
    add(prof([[-0.02, 0.008], [0.03, 0.008], [0.064, -0.096], [0.034, -0.106], [0.0, -0.02]], 0.034), M.poly);
    add(new THREE.TorusGeometry(0.03, 0.004, 6, 14, Math.PI), M.metal, 0, -0.005, -0.03).rotation.set(0, Math.PI / 2, Math.PI);
    // skeletkolbe: rørramme + kolbeplade
    add(cylZ(0.009, 0.009, 0.28, 8), M.dark, 0.0, 0.05, 0.24); add(cylZ(0.008, 0.008, 0.26, 8), M.dark, 0.0, -0.035, 0.25);
    const st = add(cylZ(0.008, 0.008, 0.1, 8), M.dark, 0, 0.007, 0.37); st.rotation.x = Math.PI / 2 * 0.95;
    add(prof([[0.37, 0.065], [0.395, 0.065], [0.4, -0.06], [0.375, -0.062]], 0.042, 0.002), M.poly);
    // håndbeskytter (polymer med ventilationsslidser), løb, gasrør, sigter, flammedæmper
    add(prof([[-0.47, 0.018], [-0.27, 0.018], [-0.27, 0.088], [-0.47, 0.082]], 0.054), M.poly);
    for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) add(boxG(0.004, 0.012, 0.022), M.dark, sx * 0.027, 0.055, -0.3 - i * 0.034);
    add(cylZ(0.011, 0.011, 0.3, 12), M.metal, 0, 0.042, -0.62);
    add(cylZ(0.011, 0.011, 0.16, 10), M.metal, 0, 0.075, -0.4);
    add(prof([[-0.66, 0.042], [-0.645, 0.042], [-0.65, 0.1], [-0.66, 0.1]], 0.012, 0.001), M.metal);
    add(boxG(0.026, 0.02, 0.03), M.metal, 0, 0.084, -0.3);
    for (let i = 0; i < 4; i++) { const sl = add(boxG(0.026, 0.004, 0.04), M.dark, 0, 0.042, -0.79); sl.rotation.z = i * Math.PI / 4; }
    add(cylZ(0.015, 0.015, 0.045, 10), M.dark, 0, 0.042, -0.79);
    add(boxG(0.012, 0.03, 0.05), M.dark, 0, 0.115, -0.06);                                                    // bæregreb-fod
    const mag = add(curvedMag(0.21, 0, 0.05, 0.05, 0.03), M.metal, 0, 0.0, -0.1);
    add(boxG(0.034, 0.012, 0.06), M.dark, 0, -0.002, -0.1);
    return { muzzle: new THREE.Vector3(0, 0.042, -0.82), support: new THREE.Vector3(-0.005, 0.03, -0.37), mag, magPos: mag.position.clone(), eject: new THREE.Vector3(0.03, 0.065, -0.1) };
  };
  B.famas = (g, M) => {                                   // FAMAS (SWAT): bullpup – magasinet BAG greb, langt bæregreb på toppen
    const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); g.add(me); return me; };
    add(prof([[-0.3, 0.0], [0.4, 0.0], [0.42, -0.02], [0.43, -0.1], [0.4, -0.105], [0.3, -0.05], [0.16, -0.035], [0.06, -0.01], [0.04, 0.0]], 0.05), M.skin);   // underkrop + kolbe
    add(prof([[-0.3, 0.0], [0.4, 0.0], [0.4, 0.075], [0.2, 0.085], [-0.3, 0.075]], 0.054), M.skin);           // overkrop
    add(prof([[0.4, 0.078], [0.445, 0.078], [0.45, -0.1], [0.43, -0.105]], 0.058, 0.002), M.poly);             // kolbeplade
    // bæregreb: to stolper + lang bøjle
    add(prof([[-0.26, 0.075], [-0.235, 0.075], [-0.23, 0.13], [-0.265, 0.13]], 0.02), M.dark);
    add(prof([[0.16, 0.085], [0.19, 0.085], [0.19, 0.13], [0.155, 0.13]], 0.02), M.dark);
    add(boxG(0.022, 0.016, 0.47), M.dark, 0, 0.137, -0.04);
    add(boxG(0.024, 0.005, 0.4), M.accent, 0, 0.147, -0.04);                                                  // blå accentstribe
    add(prof([[-0.22, 0.13], [-0.2, 0.13], [-0.205, 0.16], [-0.215, 0.16]], 0.012, 0.001), M.dark);            // forsigte
    // greb FORAN magasinet + stor aftrækkerbøjle
    add(prof([[-0.015, 0.0], [0.028, 0.0], [0.05, -0.095], [0.02, -0.103], [-0.008, -0.02]], 0.034), M.poly);
    add(prof([[-0.07, -0.005], [0.04, -0.005], [0.06, -0.11], [0.04, -0.115], [0.03, -0.02], [-0.05, -0.02], [-0.07, -0.01]], 0.03, 0.002), M.poly);   // håndbeskytter-bøjle
    add(boxG(0.006, 0.03, 0.008), M.metal, 0, -0.012, -0.02);
    // løb, flammedæmper, sammenfoldet tofod
    add(cylZ(0.011, 0.011, 0.26, 12), M.metal, 0, 0.04, -0.43); add(cylZ(0.015, 0.014, 0.05, 10), M.dark, 0, 0.04, -0.57);
    for (const sx of [-1, 1]) { const l = add(cylZ(0.005, 0.005, 0.22, 6), M.dark, sx * 0.018, 0.012, -0.38); l.rotation.y = sx * 0.04; }
    const mag = add(curvedMag(0.13, 0, 0.012, 0.05, 0.026), M.metal, 0, 0.0, 0.13);
    const mb = new THREE.Mesh(boxG(0.03, 0.012, 0.058), M.accent); mb.position.set(0, -0.135, 0.012); mag.add(mb);
    return { muzzle: new THREE.Vector3(0, 0.04, -0.6), support: new THREE.Vector3(-0.005, 0.015, -0.2), mag, magPos: mag.position.clone(), eject: new THREE.Vector3(0.03, 0.06, 0.16) };
  };
  B.tec9 = (g, M) => {                                    // Tec-9 (Hijackers): mørkt metal, magasin foran aftrækkeren, perforeret løbskappe
    const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); g.add(me); return me; };
    const slide = new THREE.Group(); g.add(slide);
    slide.add(new THREE.Mesh(prof([[-0.17, 0.02], [0.07, 0.02], [0.07, 0.068], [-0.17, 0.068]], 0.034), M.skin));
    add(prof([[-0.17, 0.0], [0.06, 0.0], [0.06, 0.022], [-0.17, 0.022]], 0.036), M.skin);
    add(boxG(0.012, 0.014, 0.02), M.bright, 0.022, 0.06, 0.04);                                              // ladeknap
    add(prof([[-0.008, 0.002], [0.032, 0.002], [0.048, -0.088], [0.016, -0.094], [0.0, -0.02]], 0.03), M.poly);
    add(new THREE.TorusGeometry(0.022, 0.0035, 6, 12, Math.PI), M.metal, 0, -0.002, -0.03).rotation.set(0, Math.PI / 2, Math.PI);
    add(cylZ(0.016, 0.016, 0.13, 14), M.dark, 0, 0.044, -0.235);                                             // løbskappe
    for (let i = 0; i < 5; i++) for (const a of [0.7, -0.7, 0]) { const h2 = add(new THREE.CylinderGeometry(0.0045, 0.0045, 0.035, 6), M.metal, Math.sin(a) * 0.013, 0.044 + Math.cos(a) * 0.013, -0.185 - i * 0.022); h2.rotation.z = a; }
    add(cylZ(0.008, 0.008, 0.03, 10), M.metal, 0, 0.044, -0.31);
    add(boxG(0.006, 0.012, 0.006), M.bright, 0, 0.074, -0.16); add(boxG(0.018, 0.01, 0.008), M.metal, 0, 0.073, 0.05);
    const mag = add(boxG(0.024, 0.15, 0.03), M.metal, 0, -0.065, -0.085); mag.rotation.x = -0.1;
    return { muzzle: new THREE.Vector3(0, 0.044, -0.33), pistol: true, slide, mag, magPos: mag.position.clone(), eject: new THREE.Vector3(0.02, 0.07, -0.02) };
  };
  B.fiveseven = (g, M) => {                               // Five-SeveN (SWAT): slank polymer-pistol, grafit-slæde, blå accenter
    const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); g.add(me); return me; };
    const slide = new THREE.Group(); g.add(slide);
    slide.add(new THREE.Mesh(prof([[-0.17, 0.034], [0.028, 0.034], [0.028, 0.072], [0.005, 0.077], [-0.155, 0.077], [-0.17, 0.068]], 0.027, 0.003), M.skin));
    for (let i = 0; i < 8; i++) { const sr = new THREE.Mesh(boxG(0.028, 0.026, 0.0025), M.dark); sr.position.set(0, 0.056, 0.0 - i * 0.006); slide.add(sr); }
    add(prof([[-0.16, 0.012], [0.02, 0.012], [0.02, 0.034], [-0.16, 0.034]], 0.026), M.poly);
    for (let i = 0; i < 3; i++) add(boxG(0.03, 0.004, 0.008), M.dark, 0, 0.012, -0.08 - i * 0.02);            // skinne
    add(prof([[-0.012, 0.012], [0.03, 0.012], [0.052, -0.095], [0.012, -0.1], [-0.01, -0.02]], 0.03), M.poly);
    add(new THREE.TorusGeometry(0.022, 0.0035, 6, 12, Math.PI), M.poly, 0, 0.0, -0.032).rotation.set(0, Math.PI / 2, Math.PI);
    add(cylZ(0.007, 0.007, 0.012, 10), M.metal, 0, 0.056, -0.176);
    add(boxG(0.006, 0.01, 0.006), M.accent, 0, 0.082, -0.155); add(boxG(0.022, 0.01, 0.008), M.dark, 0, 0.081, 0.015);
    add(boxG(0.006, 0.014, 0.02), M.accent, 0.016, 0.022, -0.01);                                             // blå magasinudløser
    const mag = add(boxG(0.022, 0.02, 0.03), M.accent, 0, -0.1, 0.02);
    return { muzzle: new THREE.Vector3(0, 0.056, -0.185), pistol: true, slide, mag, magPos: mag.position.clone(), eject: new THREE.Vector3(0.02, 0.07, -0.04) };
  };
  B.deagle = (g, M) => {                                  // Desert Eagle (fælles): massiv slæde med trekantet løbsprofil
    const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); g.add(me); return me; };
    const slide = new THREE.Group(); g.add(slide);
    slide.add(new THREE.Mesh(prof([[-0.06, 0.036], [0.035, 0.036], [0.035, 0.088], [0.0, 0.094], [-0.06, 0.094]], 0.036, 0.004), M.skin));
    for (let i = 0; i < 9; i++) { const sr = new THREE.Mesh(boxG(0.037, 0.04, 0.0025), M.dark); sr.position.set(0, 0.062, 0.03 - i * 0.0055); slide.add(sr); }
    add(prof([[-0.27, 0.036], [-0.06, 0.036], [-0.06, 0.094], [-0.27, 0.09]], 0.032, 0.004), M.skin);        // løbsblok
    add(boxG(0.014, 0.008, 0.2), M.dark, 0, 0.097, -0.165);                                                   // trekantet top-rib
    add(cylZ(0.0085, 0.0085, 0.01, 10), M.dark, 0, 0.066, -0.275);
    add(prof([[-0.2, 0.01], [0.03, 0.01], [0.03, 0.036], [-0.2, 0.036]], 0.034), M.metal);
    add(prof([[-0.014, 0.012], [0.034, 0.012], [0.058, -0.1], [0.012, -0.106], [-0.012, -0.022]], 0.036), M.poly);
    add(new THREE.TorusGeometry(0.026, 0.004, 6, 12, Math.PI), M.metal, 0, 0.0, -0.035).rotation.set(0, Math.PI / 2, Math.PI);
    add(boxG(0.008, 0.016, 0.008), M.bright, 0, 0.1, -0.255); add(boxG(0.026, 0.012, 0.01), M.metal, 0, 0.1, 0.025);
    add(boxG(0.008, 0.012, 0.02), M.accent, 0.02, 0.07, 0.01);                                                // sikring (accent)
    const mag = add(boxG(0.026, 0.02, 0.034), M.dark, 0, -0.102, 0.022);
    return { muzzle: new THREE.Vector3(0, 0.066, -0.28), pistol: true, slide, mag, magPos: mag.position.clone(), eject: new THREE.Vector3(0.022, 0.08, -0.04) };
  };
  /* ---------------- granater (meta.ring = sikringsringen der trækkes ud med venstre hånd) ---------------- */
  const nadeMat = (key, col, rough, metal) => mats[key] || (mats[key] = new THREE.MeshStandardMaterial({ color: col, roughness: rough, metalness: metal }));
  const spoon = (g, M, x, y, z, h) => { const s = new THREE.Mesh(boxG(0.012, h, 0.008), M.metal); s.position.set(x, y, z); s.rotation.z = -0.2; g.add(s); return s; };
  const ring = (g, M, x, y, z) => { const r = new THREE.Group(); r.position.set(x, y, z); const t = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0022, 6, 14), M.bright); r.add(t); const pin = new THREE.Mesh(cylZ(0.0015, 0.0015, 0.022, 4), M.bright); pin.rotation.y = Math.PI / 2; pin.position.set(0.016, 0, 0); r.add(pin); g.add(r); return r; };
  B.he = (g, M) => {
    const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); g.add(me); return me; };
    const body = new THREE.SphereGeometry(0.036, 16, 12); body.scale(1, 1.18, 1); add(body, nadeMat('heGreen', 0x4a5a32, 0.6, 0.2), 0, 0.04, -0.02);
    for (let i = 0; i < 4; i++) add(new THREE.TorusGeometry(0.0365, 0.002, 4, 18), M.dark, 0, 0.022 + i * 0.012, -0.02).rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.012, 0.014, 0.02, 10), M.metal, 0, 0.088, -0.02);
    spoon(g, M, 0.016, 0.06, -0.02, 0.08);
    return { nade: true, ring: ring(g, M, -0.018, 0.09, -0.02) };
  };
  B.smoke = (g, M) => {
    const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); g.add(me); return me; };
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.11, 18), nadeMat('smokeGray', 0x8b9094, 0.5, 0.4), 0, 0.05, -0.02);
    add(new THREE.CylinderGeometry(0.0305, 0.0305, 0.02, 18), nadeMat('smokeBand', 0xe8e8e0, 0.6, 0), 0, 0.05, -0.02);
    add(new THREE.CylinderGeometry(0.014, 0.016, 0.02, 10), M.metal, 0, 0.115, -0.02);
    spoon(g, M, 0.02, 0.07, -0.02, 0.09);
    return { nade: true, ring: ring(g, M, -0.018, 0.12, -0.02) };
  };
  B.flash = (g, M) => {                                   // flashbang: slank cylinder med huller og lysegrå/hvide bånd
    const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); g.add(me); return me; };
    add(new THREE.CylinderGeometry(0.024, 0.024, 0.115, 16), nadeMat('flashBody', 0xb8bcbf, 0.35, 0.7), 0, 0.05, -0.02);
    for (const y of [0.012, 0.088]) add(new THREE.CylinderGeometry(0.0245, 0.0245, 0.012, 16), nadeMat('flashBand', 0x2a62c8, 0.4, 0.3), 0, y, -0.02);
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; add(new THREE.CylinderGeometry(0.004, 0.004, 0.003, 6), M.dark, Math.cos(a) * 0.0235, 0.05, -0.02 + Math.sin(a) * 0.0235).rotation.set(Math.PI / 2, 0, -a + Math.PI / 2); }
    add(new THREE.CylinderGeometry(0.013, 0.015, 0.02, 10), M.metal, 0, 0.117, -0.02);
    spoon(g, M, 0.019, 0.075, -0.02, 0.09);
    return { nade: true, ring: ring(g, M, -0.017, 0.121, -0.02) };
  };
  B.incgren = (g, M) => {                                 // brandgranat (SWAT): oliven cylinder med rødt bånd og "INC"-markering
    const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); g.add(me); return me; };
    add(new THREE.CylinderGeometry(0.029, 0.029, 0.11, 18), nadeMat('incBody', 0x4d5038, 0.55, 0.3), 0, 0.05, -0.02);
    add(new THREE.CylinderGeometry(0.0295, 0.0295, 0.018, 18), nadeMat('incBand', 0xb0281e, 0.5, 0.2), 0, 0.075, -0.02);
    add(new THREE.CylinderGeometry(0.0295, 0.0295, 0.008, 18), nadeMat('incBand2', 0xd8c24a, 0.5, 0.2), 0, 0.03, -0.02);
    add(new THREE.CylinderGeometry(0.014, 0.016, 0.02, 10), M.metal, 0, 0.115, -0.02);
    spoon(g, M, 0.02, 0.07, -0.02, 0.09);
    return { nade: true, ring: ring(g, M, -0.018, 0.12, -0.02) };
  };
  B.molotov = (g, M) => {                                 // molotov (Hijackers): glasflaske med benzin og en klud i halsen
    const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); g.add(me); return me; };
    const glass = mats.molGlass || (mats.molGlass = new THREE.MeshStandardMaterial({ color: 0x4f6a2a, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.78 }));
    const fuel = mats.molFuel || (mats.molFuel = new THREE.MeshStandardMaterial({ color: 0x8a5a14, roughness: 0.2, metalness: 0, transparent: true, opacity: 0.9 }));
    const rag = mats.molRag || (mats.molRag = new THREE.MeshStandardMaterial({ color: 0xffffff, map: SK.rag(), roughness: 0.95, metalness: 0 }));
    const prof2 = [[0.001, 0], [0.03, 0.002], [0.032, 0.012], [0.032, 0.09], [0.027, 0.11], [0.012, 0.14], [0.0105, 0.18], [0.012, 0.185], [0.0105, 0.19]].map(p => new THREE.Vector2(p[0], p[1]));
    add(new THREE.LatheGeometry(prof2, 18), glass, 0, -0.01, -0.02);
    add(new THREE.CylinderGeometry(0.029, 0.029, 0.07, 16), fuel, 0, 0.03, -0.02);
    const wick = add(new THREE.CylinderGeometry(0.008, 0.011, 0.05, 8), rag, 0, 0.2, -0.02); wick.rotation.z = 0.25;
    const rg = add(new THREE.SphereGeometry(0.016, 8, 6), rag, 0.008, 0.215, -0.02); rg.scale.set(1, 0.7, 1.2);
    return { nade: true, wick: new THREE.Vector3(0.012, 0.225, -0.02) };
  };
  // C4: tre plastisk-sprængstof-stænger med tape, tastatur, LCD og ledninger
  function buildC4(M, displayText) {
    const g = new THREE.Group(), add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); g.add(me); return me; };
    const wrap = M.c4wrap || (M.c4wrap = (o.dynMat ? o.dynMat({ color: 0xffffff, map: SK.c4() }) : new THREE.MeshLambertMaterial({ map: SK.c4() })));
    const tape = M.tape || (M.tape = (o.dynMat ? o.dynMat({ color: 0x232323 }) : new THREE.MeshLambertMaterial({ color: 0x232323 })));
    for (let i = 0; i < 3; i++) add(boxG(0.085, 0.05, 0.27), wrap, -0.087 + i * 0.087, 0.025, 0);
    for (const z of [-0.09, 0.09]) add(boxG(0.27, 0.054, 0.035), tape, 0, 0.026, z);
    add(boxG(0.11, 0.02, 0.15), M.poly, 0, 0.06, 0);                                                         // styreenhed
    const lcd = add(boxG(0.075, 0.004, 0.035), M.lcd || (M.lcd = new THREE.MeshBasicMaterial({ map: lcdTex(displayText || '7355608') })), 0, 0.072, -0.04);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) add(boxG(0.018, 0.006, 0.014), M.keys || (M.keys = new THREE.MeshLambertMaterial({ color: 0x9aa0a6 })), -0.022 + c * 0.022, 0.071, 0.005 + r * 0.018);
    const led = add(new THREE.SphereGeometry(0.007, 8, 6), M.led || (M.led = new THREE.MeshBasicMaterial({ color: 0xff2a1a })), 0.045, 0.075, -0.06);
    for (const [col, x] of [[0xc82a20, -0.03], [0xe0c020, 0.0], [0x2050c0, 0.03]]) { const w = add(new THREE.TorusGeometry(0.035, 0.0035, 5, 12, Math.PI), M['w' + col] || (M['w' + col] = new THREE.MeshLambertMaterial({ color: col })), x, 0.06, 0.085); w.rotation.y = Math.PI / 2; }
    g.userData.led = led; g.userData.lcd = lcd;
    g.traverse(n => { if (n.isMesh) n.castShadow = true; });
    return g;
  }
  function lcdTex(txt) {
    return o.canvasTexture((c, w, h) => { c.fillStyle = '#122a12'; c.fillRect(0, 0, w, h); c.fillStyle = '#7dff6a'; c.font = '700 44px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, w / 2, h / 2 + 2); }, 256, 64);
  }


  /* ======================================================== v12: KNIVE ========================================================
     Fire procedurale modeller (Karambit, Butterfly, M9 Bayonet, Talon) med 6 finishes malet på canvas og lagt på klingen i model-rum:
     Vanilla (børstet stål) · Damascus (lagdelt smedestål) · Crimson Web (rødt spindelvæv) · Fade (anodiseret gul→pink→lilla) ·
     Doppler (mørk galakse med glimmer) · Tiger Tooth (guld med mørke 'tiger'-striber). Grebet = origo, klingen peger mod -Z. */
  const KF = {};
  const knifeTex = id => tex('knife_' + id, (c, w, h) => {
    const R = rnd(id.length * 97 + 13);
    if (id === 'vanilla' || id === 'damascus') {
      c.fillStyle = '#9da3a8'; c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y++) { const v = 140 + R() * 40 | 0; c.fillStyle = `rgba(${v},${v + 3},${v + 6},.35)`; c.fillRect(0, y, w, 1); }   // børstede linjer langs klingen
      if (id === 'damascus') for (let i = 0; i < 60; i++) {                 // lag i smedestålet: bølgede bånd
        c.strokeStyle = i % 2 ? 'rgba(40,44,48,.55)' : 'rgba(215,220,225,.5)'; c.lineWidth = 3 + R() * 4; c.beginPath();
        const y0 = i / 60 * h * 1.4 - h * 0.2; c.moveTo(0, y0);
        for (let x = 0; x <= w; x += 16) c.lineTo(x, y0 + Math.sin(x / 38 + i * 0.7) * 14 + Math.sin(x / 11 + i) * 5);
        c.stroke();
      }
    } else if (id === 'crimson') {
      c.fillStyle = '#6e0c10'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 4000; i++) { c.fillStyle = `rgba(${120 + R() * 60 | 0},10,14,.25)`; c.fillRect(R() * w, R() * h, 3, 3); }
      c.strokeStyle = 'rgba(10,6,6,.9)'; c.lineWidth = 2.2;
      for (const [cx, cy] of [[w * 0.3, h * 0.45], [w * 0.75, h * 0.55]]) {      // spindelvæv: eger + koncentriske tråde
        for (let k = 0; k < 14; k++) { const a = k / 14 * TAU; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * w, cy + Math.sin(a) * w); c.stroke(); }
        for (let r = 18; r < w; r += 22 + R() * 10) { c.beginPath(); for (let k = 0; k <= 14; k++) { const a = k / 14 * TAU, rr = r * (0.92 + R() * 0.1); const X = cx + Math.cos(a) * rr, Y = cy + Math.sin(a) * rr; k ? c.quadraticCurveTo(cx + Math.cos(a - 0.22) * rr * 0.9, cy + Math.sin(a - 0.22) * rr * 0.9, X, Y) : c.moveTo(X, Y); } c.stroke(); }
      }
    } else if (id === 'fade') {
      const g = c.createLinearGradient(0, 0, w, 0);                    // u = 0 ved spidsen, 1 ved grebet
      g.addColorStop(0, '#ffe85a'); g.addColorStop(0.22, '#ffd36a'); g.addColorStop(0.42, '#ff6fae'); g.addColorStop(0.66, '#b445e6'); g.addColorStop(0.88, '#4a3ad8'); g.addColorStop(1, '#30349a');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 3000; i++) { c.fillStyle = `rgba(255,255,255,${R() * 0.06})`; c.fillRect(R() * w, R() * h, 2, 1); }
    } else if (id === 'doppler') {
      c.fillStyle = '#120a22'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) { const x = R() * w, y = R() * h, r = 30 + R() * 110, g = c.createRadialGradient(x, y, 0, x, y, r); const col = ['90,30,160', '30,60,200', '200,40,140', '20,130,190'][i % 4]; g.addColorStop(0, `rgba(${col},.45)`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
      for (let i = 0; i < 900; i++) { const v = R(); c.fillStyle = `rgba(255,${200 + R() * 55 | 0},255,${v * v * 0.9})`; c.fillRect(R() * w, R() * h, 1 + (v > 0.95 ? 2 : 0), 1 + (v > 0.95 ? 2 : 0)); }   // glimmer
    } else if (id === 'tiger') {
      c.fillStyle = '#e0a434'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) {                                      // flammende striber på tværs af klingen
        const x0 = i / 26 * w * 1.1; c.fillStyle = `rgba(${120 + R() * 40 | 0},${48 + R() * 20 | 0},10,.85)`; c.beginPath(); c.moveTo(x0, 0);
        for (let y = 0; y <= h; y += 24) c.lineTo(x0 + Math.sin(y / 40 + i) * 10 + (R() - 0.5) * 6, y);
        for (let y = h; y >= 0; y -= 24) c.lineTo(x0 + 8 + R() * 10 + Math.sin(y / 30 + i * 2) * 6, y);
        c.fill();
      }
      for (let i = 0; i < 2000; i++) { c.fillStyle = `rgba(255,240,180,${R() * 0.12})`; c.fillRect(R() * w, R() * h, 2, 1); }
    }
  }, 512);
  const KNIFE_PBR = { vanilla: [1, 0.24], damascus: [1, 0.3], crimson: [0.55, 0.34], fade: [0.45, 0.24], doppler: [0.6, 0.16], tiger: [0.9, 0.22] };   // [metalness, roughness] – farvede finishes er 'candy'-lak på metal
  function bladeMat(M, finish, z0, z1, y0, y1) {
    const t = knifeTex(finish).clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    // UV = (z, y) i meter (ExtrudeGeometry-caps) → hele klingen dækker teksturen én gang (u: spids→greb)
    t.repeat.set(1 / (z1 - z0), 1 / (y1 - y0)); t.offset.set(-z0 / (z1 - z0), -y0 / (y1 - y0));
    const pb = KNIFE_PBR[finish] || KNIFE_PBR.vanilla;
    return M.mk({ color: 0xffffff, map: t, metalness: pb[0], roughness: pb[1], rv: 0.1, nrm: 0.08 });
  }
  // lukket kurve (Shape bygget af callback) ekstruderet i bredde w langs x; samme akser som prof()
  function shapeG(build, w, bevel, holes) {
    const s = new THREE.Shape(); build(s);
    if (holes) for (const hb of holes) { const hp = new THREE.Path(); hb(hp); s.holes.push(hp); }
    const bv = bevel === undefined ? Math.min(0.0025, w * 0.3) : bevel;
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.0004, w - bv * 2), bevelEnabled: bv > 0, bevelThickness: bv, bevelSize: bv * 0.85, bevelSegments: 2, curveSegments: 22 });
    g.rotateY(-Math.PI / 2); g.translate(w / 2 - bv, 0, 0);
    return g;
  }
  const kMats = (M) => ({
    steel: M.knSteel || (M.knSteel = M.mk({ color: 0xb8bec4, metalness: 1, roughness: 0.22 })),
    edge: M.knEdge || (M.knEdge = M.mk({ color: 0xe8edf2, metalness: 1, roughness: 0.12 })),
    grip: M.knGrip || (M.knGrip = M.mk({ color: 0x1d1f22, map: SK.swatPoly(), metalness: 0.05, roughness: 0.82, nrm: 0.4 })),
    wood: M.knWood || (M.knWood = M.mk({ color: 0xffffff, map: SK.hijWood(), metalness: 0.02, roughness: 0.55, nrm: 0.4 })),
    dark: M.knDark || (M.knDark = M.mk({ color: 0x18191b, metalness: 0.7, roughness: 0.35 }))
  });
  KF.karambit = (g, M, fin) => {                           // buet klo-klinge, fingerring, G10-greb med skruer
    const K = kMats(M), add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); g.add(me); return me; };
    add(shapeG(s => { s.moveTo(-0.004, 0.012); s.quadraticCurveTo(-0.07, 0.03, -0.098, -0.052); s.quadraticCurveTo(-0.058, -0.004, -0.004, -0.012); s.lineTo(-0.004, 0.012); }, 0.0042, 0.0017), bladeMat(M, fin, -0.1, 0.0, -0.055, 0.032));
    add(shapeG(s => { s.moveTo(-0.098, -0.052); s.quadraticCurveTo(-0.058, -0.004, -0.004, -0.012); s.lineTo(-0.004, -0.0085); s.quadraticCurveTo(-0.056, 0.0, -0.093, -0.045); s.lineTo(-0.098, -0.052); }, 0.0016, 0.0005), K.edge);   // slebet æg
    add(shapeG(s => { s.moveTo(-0.004, 0.016); s.lineTo(0.08, 0.012); s.quadraticCurveTo(0.104, 0.008, 0.11, -0.006); s.lineTo(0.104, -0.016); s.quadraticCurveTo(0.06, -0.012, 0.03, -0.019); s.quadraticCurveTo(0.014, -0.026, 0.0, -0.016); s.lineTo(-0.004, -0.016); }, 0.016, 0.003), K.grip);
    add(shapeG(s => { s.moveTo(-0.012, 0.018); s.lineTo(-0.002, 0.018); s.lineTo(-0.002, -0.022); s.quadraticCurveTo(-0.012, -0.03, -0.018, -0.02); s.lineTo(-0.012, 0.018); }, 0.017, 0.002), K.dark);   // fingerbeskytter
    const ringM = add(new THREE.TorusGeometry(0.0185, 0.0048, 10, 28), K.steel, 0, -0.006, 0.124); ringM.rotation.y = Math.PI / 2;
    for (const z of [0.018, 0.05, 0.082]) for (const x of [-0.0085, 0.0085]) { const sc = add(new THREE.CylinderGeometry(0.0028, 0.0028, 0.0016, 10), K.steel, x, -0.001, z); sc.rotation.z = Math.PI / 2; }
    for (let i = 0; i < 9; i++) add(boxG(0.0165, 0.002, 0.004), K.dark, 0, -0.0175 + (i % 2) * 0.0005, 0.02 + i * 0.008);   // fingerriller
    return { knife: true, model: 'karambit', tip: new THREE.Vector3(0, -0.05, -0.098) };
  };
  KF.butterfly = (g, M, fin) => {                          // lige klinge med clip-point + to håndtag-kanaler der folder (animeres ved træk/inspect)
    const K = kMats(M), add = (geo, m, x, y, z, par) => { const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); (par || g).add(me); return me; };
    add(shapeG(s => { s.moveTo(0.0, 0.011); s.lineTo(-0.085, 0.011); s.lineTo(-0.112, 0.005); s.quadraticCurveTo(-0.128, 0.001, -0.135, -0.002); s.quadraticCurveTo(-0.1, -0.013, -0.02, -0.012); s.lineTo(0.0, -0.01); s.lineTo(0.0, 0.011); }, 0.0036, 0.0014), bladeMat(M, fin, -0.136, 0.0, -0.014, 0.012));
    add(shapeG(s => { s.moveTo(-0.135, -0.002); s.quadraticCurveTo(-0.1, -0.013, -0.02, -0.012); s.lineTo(-0.02, -0.009); s.quadraticCurveTo(-0.1, -0.009, -0.128, 0.0); s.lineTo(-0.135, -0.002); }, 0.0015, 0.0005), K.edge);
    add(new THREE.CylinderGeometry(0.0045, 0.0045, 0.022, 14), K.steel, 0, 0.0, 0.004).rotation.z = Math.PI / 2;   // pivot
    const handles = [];
    for (const sd of [-1, 1]) {                                            // kanal: profil med 'huller' (skeletoniseret stål)
      const piv = new THREE.Group(); piv.position.set(sd * 0.0065, 0, 0.004); g.add(piv);
      const holes = []; for (let i = 0; i < 5; i++) { const z0 = 0.02 + i * 0.02; holes.push(hp => { hp.moveTo(z0, 0.004); hp.lineTo(z0 + 0.012, 0.004); hp.lineTo(z0 + 0.012, -0.004); hp.lineTo(z0, -0.004); hp.lineTo(z0, 0.004); }); }
      add(shapeG(s => { s.moveTo(0.004, 0.011); s.lineTo(0.128, 0.011); s.quadraticCurveTo(0.136, 0.0, 0.128, -0.011); s.lineTo(0.004, -0.011); s.quadraticCurveTo(-0.004, 0, 0.004, 0.011); }, 0.006, 0.0018, holes), K.steel, 0, 0, -0.004, piv);
      add(boxG(0.0035, 0.018, 0.1), K.dark, -sd * 0.0035, 0, 0.065, piv);  // indvendig 'liner'
      handles.push(piv);
    }
    const latch = add(boxG(0.004, 0.004, 0.02), K.dark, 0.0065, -0.012, 0.13); latch.rotation.x = 0.2;
    return { knife: true, model: 'butterfly', handles, tip: new THREE.Vector3(0, -0.002, -0.135) };
  };
  KF.bayonet = (g, M, fin) => {                            // M9: lang klinge med savtakker på ryggen, parérstang og riflet gummigreb
    const K = kMats(M), add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); g.add(me); return me; };
    add(shapeG(s => {
      s.moveTo(-0.012, 0.013); for (let i = 0; i < 9; i++) { const z = -0.02 - i * 0.0085; s.lineTo(z, 0.0165); s.lineTo(z - 0.0042, 0.013); }   // savtakker
      s.lineTo(-0.1, 0.013); s.lineTo(-0.14, 0.004); s.quadraticCurveTo(-0.158, -0.002, -0.165, -0.003); s.quadraticCurveTo(-0.13, -0.016, -0.03, -0.016); s.lineTo(-0.012, -0.015); s.lineTo(-0.012, 0.013);
    }, 0.0048, 0.0018), bladeMat(M, fin, -0.166, -0.01, -0.018, 0.017));
    add(shapeG(s => { s.moveTo(-0.165, -0.003); s.quadraticCurveTo(-0.13, -0.016, -0.03, -0.016); s.lineTo(-0.03, -0.0125); s.quadraticCurveTo(-0.13, -0.012, -0.158, -0.001); s.lineTo(-0.165, -0.003); }, 0.0018, 0.0006), K.edge);
    add(boxG(0.0012, 0.004, 0.11), K.dark, 0.0025, 0.004, -0.075); add(boxG(0.0012, 0.004, 0.11), K.dark, -0.0025, 0.004, -0.075);   // blodrende
    add(boxG(0.024, 0.048, 0.007), K.steel, 0, -0.004, -0.009);                                    // parérstang
    const lp = add(new THREE.TorusGeometry(0.009, 0.0026, 8, 18), K.steel, 0, 0.026, -0.009); lp.rotation.y = Math.PI / 2;   // bajonet-ring
    const grip = add(cylZ(0.0135, 0.0125, 0.11, 18), K.grip, 0, 0.0, 0.05);
    for (let i = 0; i < 12; i++) add(new THREE.TorusGeometry(0.0132, 0.0016, 6, 18), K.dark, 0, 0, 0.0 + i * 0.0085 + 0.004);
    add(cylZ(0.0145, 0.012, 0.016, 18), K.steel, 0, 0, 0.112);                                   // pommel
    add(boxG(0.006, 0.007, 0.012), K.steel, 0, 0.012, 0.11);
    return { knife: true, model: 'bayonet', tip: new THREE.Vector3(0, -0.003, -0.165), grip };
  };
  KF.talon = (g, M, fin) => {                              // bred, buet sabel-klinge, skeletoniseret greb med ring og elfenbensskaller
    const K = kMats(M), add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); g.add(me); return me; };
    add(shapeG(s => { s.moveTo(-0.006, 0.016); s.quadraticCurveTo(-0.075, 0.04, -0.142, -0.03); s.quadraticCurveTo(-0.09, -0.006, -0.006, -0.016); s.lineTo(-0.006, 0.016); }, 0.0046, 0.0018), bladeMat(M, fin, -0.143, -0.006, -0.033, 0.034));
    add(shapeG(s => { s.moveTo(-0.142, -0.03); s.quadraticCurveTo(-0.09, -0.006, -0.006, -0.016); s.lineTo(-0.006, -0.0125); s.quadraticCurveTo(-0.088, -0.002, -0.136, -0.024); s.lineTo(-0.142, -0.03); }, 0.0017, 0.0006), K.edge);
    const ivory = M.knIvory || (M.knIvory = M.mk({ color: 0xe6dcc6, metalness: 0.05, roughness: 0.4 }));
    add(shapeG(s => { s.moveTo(-0.006, 0.016); s.lineTo(0.085, 0.012); s.quadraticCurveTo(0.11, 0.008, 0.112, -0.008); s.lineTo(0.098, -0.017); s.quadraticCurveTo(0.05, -0.02, -0.006, -0.018); s.lineTo(-0.006, 0.016); }, 0.0105, 0.002), K.steel);
    for (const x of [-0.0072, 0.0072]) add(shapeG(s => { s.moveTo(0.004, 0.012); s.lineTo(0.08, 0.009); s.quadraticCurveTo(0.098, 0.004, 0.096, -0.01); s.quadraticCurveTo(0.05, -0.016, 0.004, -0.014); s.lineTo(0.004, 0.012); }, 0.004, 0.0014), ivory, x, 0, 0);
    const rg = add(new THREE.TorusGeometry(0.016, 0.0045, 10, 26), K.steel, 0, -0.004, 0.125); rg.rotation.y = Math.PI / 2;
    for (const z of [0.022, 0.07]) { const sc = add(new THREE.CylinderGeometry(0.003, 0.003, 0.019, 10), K.dark, 0, -0.002, z); sc.rotation.z = Math.PI / 2; }
    return { knife: true, model: 'talon', tip: new THREE.Vector3(0, -0.03, -0.142) };
  };
  // v19: realistiske knive modelleret i Blender (tools/knives/build.py: ægte slibning, blodrille, savtakker, afrundede greb, skruer).
  //   Geometrien kommer fra GLB'en; materialerne er spillets egne (pr. materialenavn), så finishes og lys er uændrede.
  //   Klingens UV = (z, y) i meter som ExtrudeGeometry => bladeMat med samme klinge-grænser som de procedurale modeller.
  const KMETA = {
    karambit: { blade: [-0.1, 0.0, -0.055, 0.032], tip: [0, -0.05, -0.098] }, butterfly: { blade: [-0.136, 0.0, -0.014, 0.012], tip: [0, -0.002, -0.135] },
    bayonet: { blade: [-0.166, -0.01, -0.018, 0.017], tip: [0, -0.003, -0.165] }, talon: { blade: [-0.143, -0.006, -0.033, 0.034], tip: [0, -0.03, -0.142] }
  };
  function knifeFromGLB(g, M, model, fin, tpl) {
    const K = kMats(M), km = KMETA[model], bm = bladeMat(M, fin, ...km.blade);
    const ivory = M.knIvory || (M.knIvory = M.mk({ color: 0xe6dcc6, metalness: 0.05, roughness: 0.4 }));
    const BY = { Blade: bm, Edge: K.edge, Steel: K.steel, Grip: K.grip, Wood: K.wood, Dark: K.dark, Ivory: ivory };
    const root = tpl.clone(true), handles = [];
    root.traverse(x => {
      if (x.isMesh) { const nm = (x.material && x.material.name || '').replace(/\.\d+$/, ''); x.material = BY[nm] || K.steel; x.castShadow = true; }
      if (/^handle\d$/.test(x.name)) handles[+x.name.slice(6)] = x;
    });
    for (const c of root.children.slice()) g.add(c);
    const meta = { knife: true, model, tip: new THREE.Vector3(...km.tip), glb: true };
    if (handles.length === 2) meta.handles = handles;
    return meta;
  }
  B.knife = (g, M, skinKey) => {
    const key = String(skinKey || 'karambit_fade'), [m, f] = key.split('_');
    const model = KF[m] ? m : 'karambit', fin = KNIFE_PBR[f] ? f : 'fade';
    const tpl = o.knifeTemplate && !(typeof window !== 'undefined' && window.__noKnifeGLB) ? o.knifeTemplate(model) : null;   // __noKnifeGLB: dev-sammenligning
    if (tpl && KMETA[model]) { try { return knifeFromGLB(g, M, model, fin, tpl); } catch (e) { console.warn('[kniv] GLB', model, e); } }
    return KF[model](g, M, fin);                                   // procedural reserve (fx før GLB'en er hentet / i tests)
  };

  /* ======================================================== førstepersons-arme (v13) ========================================================
     Rigtige hænder i stedet for to mørke cylindre: knyttet hånd med fire leddelte fingre (kapsler der slutter sig om grebet), tommelfinger,
     knoer og håndryg, et håndled (underarmen har sin egen retning), handskemanchet og ærme med folder og stoftekstur.
       SWAT: sorte Nomex-handsker med knobeskyttere i kulfiber + navy ærme med velcro-strop
       Hijackers: slidte brune læderhandsker uden fingerspidser (hud) + oliven feltjakke
     Ramme (lokal): origo = grebets akse midt i hånden, +Y mod håndleddet, +Z = pegefingerens retning langs grebet, fingrene krummer mod +X. */
  SK.fabric = (team) => tex('fabric_' + team, (c, w, h) => {
    const R = rnd(team === 'hij' ? 71 : 73), base = team === 'hij' ? [74, 72, 52] : [34, 46, 70];
    c.fillStyle = `rgb(${base})`; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) { c.fillStyle = `rgba(0,0,0,${0.08 + R() * 0.06})`; c.fillRect(0, y, w, 1); }            // vævning (skrå køber)
    for (let x = 0; x < w; x += 3) { c.fillStyle = `rgba(255,255,255,${0.03 + R() * 0.03})`; c.fillRect(x, 0, 1, h); }
    for (let i = 0; i < 5000; i++) { const v = R() * 40 - 20 | 0; c.fillStyle = `rgba(${base[0] + v},${base[1] + v},${base[2] + v},.4)`; c.fillRect(R() * w, R() * h, 2, 2); }
    for (let i = 0; i < 26; i++) { const x = R() * w, y = R() * h, r = 20 + R() * 70, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, team === 'hij' ? 'rgba(40,32,20,.28)' : 'rgba(10,14,24,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }   // snavs/slid
    c.strokeStyle = team === 'hij' ? 'rgba(30,26,16,.55)' : 'rgba(10,12,18,.6)'; c.setLineDash([5, 4]); c.lineWidth = 1.5;   // syninger
    for (const y of [h * 0.08, h * 0.92]) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.setLineDash([]);
  }, 256);
  SK.glove = (team) => tex('glove_' + team, (c, w, h) => {
    const R = rnd(team === 'hij' ? 81 : 83);
    if (team === 'hij') {                                   // slidt brunt læder: krakeleringer og lyse slidpletter
      c.fillStyle = '#4a3220'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 6000; i++) { const v = R() * 30 | 0; c.fillStyle = `rgba(${70 + v},${46 + v},${28 + v / 2},.35)`; c.fillRect(R() * w, R() * h, 2, 2); }
      for (let i = 0; i < 260; i++) { c.strokeStyle = `rgba(20,12,6,${0.2 + R() * 0.3})`; c.lineWidth = 0.6; c.beginPath(); const x = R() * w, y = R() * h; c.moveTo(x, y); c.lineTo(x + R() * 14 - 7, y + R() * 14 - 7); c.stroke(); }
      for (let i = 0; i < 16; i++) { const x = R() * w, y = R() * h, r = 12 + R() * 40, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(150,110,70,.3)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
    } else {                                                // sort Nomex: fin strik-struktur
      c.fillStyle = '#1b1c1f'; c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 2) for (let x = (y % 4); x < w; x += 4) { c.fillStyle = 'rgba(255,255,255,.035)'; c.fillRect(x, y, 2, 1); }
      for (let i = 0; i < 3000; i++) { c.fillStyle = `rgba(0,0,0,${R() * 0.25})`; c.fillRect(R() * w, R() * h, 2, 2); }
    }
  }, 256);
  const armMatCache = {};
  function armMats(team) {
    if (armMatCache[team]) return armMatCache[team];
    const hij = team === 'hij', mk = (p, nrm) => {
      const m = new THREE.MeshStandardMaterial(p);
      if (p.map && o.derivePBR) { const d = o.derivePBR(THREE, p.map, { normal: nrm || 0.5, rough: p.roughness, metal: p.metalness }); if (d && d.normalMap) { m.normalMap = d.normalMap; m.normalScale.set(0.8, 0.8); } }
      if (o.withBake) o.withBake(m, true); return m;
    };
    const fab = SK.fabric(team), glv = SK.glove(team); fab.repeat.set(2, 3); glv.repeat.set(1.5, 1.5);
    return (armMatCache[team] = {
      sleeve: mk({ color: 0xffffff, map: fab, roughness: 0.92, metalness: 0 }, 0.9),
      glove: mk({ color: 0xffffff, map: glv, roughness: hij ? 0.62 : 0.78, metalness: 0.02 }, 0.6),
      skin: mk({ color: hij ? 0xb98a68 : 0xc49474, roughness: 0.55, metalness: 0 }),
      armor: mk({ color: 0x0d0e10, roughness: 0.35, metalness: 0.25 }),
      strap: mk({ color: hij ? 0x2a2418 : 0x15181d, roughness: 0.85, metalness: 0 }),
      metal: mk({ color: 0x9a9da2, roughness: 0.3, metalness: 0.9 })
    });
  }
  const capsule = (r, len) => new THREE.CapsuleGeometry(r, Math.max(0.0005, len), 4, 10);
  function rbox(w, h, d, r) {                               // afrundet kasse (ekstruderet afrundet rektangel med fas) – håndryg, knobeskytter
    const s = new THREE.Shape(), x = w / 2 - r, y = h / 2 - r;
    s.moveTo(-x, -h / 2); s.lineTo(x, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -y); s.lineTo(w / 2, y); s.quadraticCurveTo(w / 2, h / 2, x, h / 2);
    s.lineTo(-x, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, y); s.lineTo(-w / 2, -y); s.quadraticCurveTo(-w / 2, -h / 2, -x, -h / 2);
    const bv = Math.min(r, d / 2 - 1e-4), g = new THREE.ExtrudeGeometry(s, { depth: Math.max(1e-4, d - bv * 2), bevelEnabled: true, bevelThickness: bv, bevelSize: bv * 0.8, bevelSegments: 3, curveSegments: 4 });
    g.translate(0, 0, -(d - bv * 2) / 2); return g;
  }
  function seg(parent, a, b, r, m) {                        // kapsel fra punkt a til b
    const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), L = A.distanceTo(Bv);
    const me = new THREE.Mesh(capsule(r, L), m); me.position.addVectors(A, Bv).multiplyScalar(0.5);
    me.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), Bv.clone().sub(A).normalize()); parent.add(me); return me;
  }
  function armsFor(team) {
    const T = armMats(team), hij = team === 'hij';
    return (opt) => {
      opt = opt || {};
      const rg = opt.rg || 0.016, arm = new THREE.Group(), hand = new THREE.Group(); arm.add(hand);
      // fire fingre om en cylinder (grebet) med radius rg langs Z: knoen på håndryggen, derefter tre led der krummer rundt
      const Z = [0.031, 0.0105, -0.0105, -0.03], FR = [0.0094, 0.0098, 0.0092, 0.0082], LEN = [[0.042, 0.026, 0.021], [0.046, 0.028, 0.022], [0.043, 0.027, 0.021], [0.034, 0.021, 0.018]];
      const curl = opt.curl === undefined ? 1 : opt.curl;
      for (let f = 0; f < 4; f++) {
        const R = rg + FR[f], z = Z[f]; let ang = 200 * Math.PI / 180, prev = [Math.cos(ang) * R, Math.sin(ang) * R, z];
        for (let k = 0; k < 3; k++) {
          ang += (LEN[f][k] / R) * (0.55 + 0.45 * curl);
          const nx = [Math.cos(ang) * R, Math.sin(ang) * R, z];
          const fingerless = hij && k === 2;                // Hijackers: fingerløse handsker – yderste led er bar hud
          seg(hand, prev, nx, FR[f] * (k === 2 ? 0.9 : 1), fingerless ? T.skin : T.glove);
          if (k === 0) { const kn = new THREE.Mesh(new THREE.SphereGeometry(FR[f] * 1.12, 10, 8), T.glove); kn.position.set(...prev); hand.add(kn); }
          prev = nx;
        }
      }
      // håndryg (fra knoerne til håndleddet) + håndflade
      const back = new THREE.Mesh(rbox(0.088, 0.085, 0.028, 0.012), T.glove); back.rotation.y = Math.PI / 2; back.position.set(-(rg + 0.012), 0.034, 0); hand.add(back);
      const palm = new THREE.Mesh(rbox(0.07, 0.05, 0.02, 0.008), T.glove); palm.rotation.y = Math.PI / 2; palm.position.set(-(rg - 0.004), 0.045, -0.004); hand.add(palm);
      // tommelfinger: fra håndroden på pegefingersiden, hen over grebet (modsat fingrene)
      const tz = 0.046, tR = rg + 0.01, ta = [-0.032, 0.05, 0.036], tb = [Math.cos(2.4) * tR, Math.sin(2.4) * tR, tz], tc = [Math.cos(1.45) * tR, Math.sin(1.45) * tR, tz + 0.002], td = [Math.cos(0.75) * tR, Math.sin(0.75) * tR, tz];
      seg(hand, ta, tb, 0.0115, T.glove); seg(hand, tb, tc, 0.0102, T.glove); seg(hand, tc, td, 0.0095, hij ? T.skin : T.glove);
      if (!hij) {                                           // SWAT: knobeskytter i kulfiber over knoerne + velcro-strop ved håndleddet
        const kp = new THREE.Mesh(rbox(0.078, 0.022, 0.012, 0.005), T.armor); kp.rotation.y = Math.PI / 2; kp.position.set(-(rg + 0.03), -0.004, 0); hand.add(kp);
        const st = new THREE.Mesh(rbox(0.07, 0.016, 0.034, 0.006), T.strap); st.rotation.y = Math.PI / 2; st.position.set(-(rg + 0.006), 0.07, 0); hand.add(st);
      } else {                                              // Hijackers: syning over håndryggen
        const st = new THREE.Mesh(rbox(0.004, 0.06, 0.03, 0.0015), T.strap); st.rotation.y = Math.PI / 2; st.position.set(-(rg + 0.026), 0.04, 0.0); hand.add(st);
      }
      // håndled + underarm (egen retning): manchet, ærme med folder (drejet profil) og ærmekant
      const wrist = new THREE.Group(); wrist.position.set(-(rg + 0.008), 0.085, 0); arm.add(wrist);
      const prof = (pts, seg2) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg2 || 18);
      const cuff = new THREE.Mesh(prof([[0.001, -0.02], [0.03, -0.02], [0.034, -0.012], [0.035, 0.03], [0.031, 0.036], [0.001, 0.036]]), T.glove); wrist.add(cuff);
      const sl = [[0.001, 0.02], [0.04, 0.02], [0.046, 0.03]];
      for (let i = 0; i < 9; i++) { const y = 0.05 + i * 0.045, r = 0.046 + i * 0.0026; sl.push([r + (i % 2 ? 0.004 : -0.001), y], [r + 0.001, y + 0.022]); }   // folder
      sl.push([0.07, 0.48], [0.001, 0.48]);
      const sleeve = new THREE.Mesh(prof(sl, 20), T.sleeve); wrist.add(sleeve);
      const hem = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.006, 6, 20), T.sleeve); hem.rotation.x = Math.PI / 2; hem.position.y = 0.028; wrist.add(hem);
      if (!hij) { const wt = new THREE.Mesh(prof([[0.001, 0], [0.036, 0], [0.037, 0.016], [0.001, 0.016]], 16), T.strap); wt.position.y = 0.0; wrist.add(wt); }
      // orientering: hånden fra (hånd-retning, grebsakse); underarmen peger selvstændigt (håndleddet bøjer)
      const _X = new THREE.Vector3(), _Y = new THREE.Vector3(), _Z = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
      // mirror = venstre hånd: modellen spejles i X (fingrene krummer den anden vej), så ryggen af hånden ligger i retning Y×Z
      const point = (d, grip, fore, mirror) => {
        _Y.set(...d).normalize(); _Z.set(...(grip || [0, 0.85, -0.52])); _Z.addScaledVector(_Y, -_Z.dot(_Y));
        if (_Z.lengthSq() < 1e-6) _Z.set(0, 0, 1).addScaledVector(_Y, -_Y.z); _Z.normalize(); _X.crossVectors(_Y, _Z).normalize();
        _m.makeBasis(_X, _Y, _Z); arm.quaternion.setFromRotationMatrix(_m);
        const sc = Math.abs(arm.scale.y) || 1; arm.scale.set(mirror ? -sc : sc, sc, sc);
        const f = new THREE.Vector3(...(fore || d)).normalize().applyQuaternion(_q.copy(arm.quaternion).invert()); if (mirror) f.x = -f.x;
        wrist.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), f);
        return arm;
      };
      return { arm, point, wrist, mats: Object.values(T) };
    };
  }

  /* ======================================================== offentlige fabrikker ======================================================== */
  /* ---- v11.3: fotoscannet/modelleret våben (GLB, normaliseret af skins.prepGun) passes ind i den procedurale models mål ----
     hænder, munding, sigte og magasin-animation bevares (de er bundet til de procedurale mål); kun geometrien udskiftes */
  /* ---- v14: GLB-våben placeres efter deres EGNE ankerpunkter (ikke presset ind i den procedurale models kasse) ----
     Rigtig længde i meter (som i virkeligheden) → modellens bundprofil analyseres: pistolgreb (dal bag magasinet / bagerste dal),
     magasin, håndbeskytter og munding findes automatisk, og modellen flyttes så grebet ligger præcis i højre hånd.
     ANCHOR_ADJ = finjustering pr. våben (m) efter visuel kontrol på kontaktark (greb / støttehånd). */
  const REAL_LEN = { ak47: 0.88, galil: 0.97, m4a1: 0.86, famas: 0.76, awp: 1.15, mp5: 0.78, mac10: 0.55, mp9: 0.52, mp7: 0.64, ump45: 0.69, p90: 0.52,
    glock: 0.19, usp: 0.21, fiveseven: 0.21, deagle: 0.27, tec9: 0.31 };
  const BULLPUP = { p90: 1 };                                 // v14: FAMAS-modellen er AR-opbygget (greb bag magasinet) – ikke bullpup
  const GRIP_FRAC = { ak47: 0.7, m4a1: 0.67, famas: 0.71, galil: 0.72, awp: 0.8, mac10: 0.47, mp9: 0.585, mp7: 0.645, ump45: 0.635, p90: 0.52, mp5: 0.585, tec9: 0.395, deagle: 0.85, glock: 0.8, usp: 0.8, fiveseven: 0.8 };   // målt i bundprofilen (andel af længden fra mundingen)
  const ANCHOR_ADJ = {};                                      // id -> { g: [dx,dy,dz], s: [dx,dy,dz] }  (udfyldes ved kalibrering)
  function analyzeGun(clone, id, isPistol) {
    clone.updateMatrixWorld(true);
    const pts = [], v = new THREE.Vector3(), inv = new THREE.Matrix4().copy(clone.matrixWorld).invert();
    // punkter langs alle trekant-kanter (lange low-poly-flader har kun hjørner i enderne – derfor tætte prøver langs kanterne)
    const va = new THREE.Vector3(), vb = new THREE.Vector3();
    clone.traverse(n => { if (!n.isMesh) return; const G = n.geometry, P = G.attributes.position, I = G.index, M2 = new THREE.Matrix4().multiplyMatrices(inv, n.matrixWorld).premultiply(new THREE.Matrix4().makeScale(clone.scale.x, clone.scale.y, clone.scale.z));
      const nt = I ? I.count : P.count, idx = k => I ? I.getX(k) : k;
      for (let t = 0; t < nt; t += 3) for (let e = 0; e < 3; e++) {
        va.fromBufferAttribute(P, idx(t + e)).applyMatrix4(M2); vb.fromBufferAttribute(P, idx(t + (e + 1) % 3)).applyMatrix4(M2);
        const m = Math.min(24, Math.max(1, Math.ceil(va.distanceTo(vb) / 0.01)));
        for (let q = 0; q <= m; q++) { v.lerpVectors(va, vb, q / m); pts.push([v.x, v.y, v.z]); }
      } });
    let z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { if (p[2] < z0) z0 = p[2]; if (p[2] > z1) z1 = p[2]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    const N = 48, L = z1 - z0, lo = new Array(N).fill(Infinity), hi = new Array(N).fill(-Infinity), bin = z => Math.max(0, Math.min(N - 1, Math.floor((z - z0) / L * N)));
    for (const p of pts) { const k = bin(p[2]); if (p[1] < lo[k]) lo[k] = p[1]; if (p[1] > hi[k]) hi[k] = p[1]; }
    for (let k = 0; k < N; k++) if (lo[k] === Infinity) { lo[k] = hi[k] = (y0 + y1) / 2; }
    const mid = lo.slice(Math.floor(N * 0.3), Math.ceil(N * 0.8)).sort((a, b) => a - b), base = mid[Math.floor(mid.length * 0.7)];   // receiverens underkant (midterste del af våbnet)
    const depth = base - y0, thr = base - Math.max(0.025, depth * (isPistol ? 0.3 : 0.32));
    let valleys = []; for (let k = 0; k < N;) { if (lo[k] < thr) { let k2 = k; while (k2 + 1 < N && lo[k2 + 1] < thr) k2++; let m = Infinity; for (let q = k; q <= k2; q++) m = Math.min(m, lo[q]); valleys.push({ k0: k, k1: k2, z0: z0 + k * L / N, z1: z0 + (k2 + 1) * L / N, min: m }); k = k2 + 1; } else k++; }
    for (let i = valleys.length - 1; i > 0; i--) if (valleys[i].k0 - valleys[i - 1].k1 <= (isPistol ? 3 : 1)) { const a = valleys[i - 1], b2 = valleys[i]; a.k1 = b2.k1; a.z1 = b2.z1; a.min = Math.min(a.min, b2.min); valleys.splice(i, 1); }   // aftrækkerbøjlen deler grebet i to – saml dem
    if (!isPistol) valleys = valleys.filter(q => q.z0 < z0 + L * 0.8 || q.min < base - depth * 0.6);   // kolben bagerst er ikke et greb
    // munding = forreste ende (−z), løbets højde = middel af de forreste 3 %
    let my = 0, mn = 0; for (const p of pts) if (p[2] < z0 + L * 0.03) { my += p[1]; mn++; } my = mn ? my / mn : (y0 + y1) / 2;
    // grebet = dalen nærmest den forventede grebsposition for våbentypen (andel af længden fra mundingen); magasinet = dybeste af de andre
    let grip = null, mag = null; const fr = GRIP_FRAC[id] || (isPistol ? 0.85 : 0.58), want = z0 + fr * L;
    if (valleys.length) {
      const near = valleys.reduce((a, b2) => Math.abs((b2.z0 + b2.z1) / 2 - want) < Math.abs((a.z0 + a.z1) / 2 - want) ? b2 : a, valleys[0]);
      if (Math.abs((near.z0 + near.z1) / 2 - want) < L * 0.06 && near.z1 - near.z0 < L * 0.14) grip = near;   // kun en tydelig, kort dal tæt på det forventede – ellers det målte tal
      const others = valleys.filter(q => q !== grip && (BULLPUP[id] ? q.z0 > want : (q.z0 + q.z1) / 2 < want - L * 0.04));
      if (others.length) mag = others.reduce((a, b2) => b2.min < a.min ? b2 : a, others[0]);
    }
    const gz = grip ? (grip.z0 + grip.z1) / 2 + (isPistol ? 0.0 : (grip.z1 - grip.z0) * 0.15) : want;
    return { z0, z1, y0, y1, L, base, my, lo, hi, N, bin, grip: { y: base, z: gz }, mag, valleys };
  }
  function fitTemplate(body, id, team, skinId, mk, meta) {
    const tpl = o.gunTemplate ? o.gunTemplate(id, team) : null; if (!tpl) return null;
    const parts = body.children.slice(); body.updateMatrixWorld(true);
    const box = new THREE.Box3(); for (const p of parts) box.expandByObject(p);
    if (box.isEmpty()) return null;
    for (const p of parts) body.remove(p);
    const clone = tpl.clone(true);
    o.skinGun(clone, skinId, team, mk);
    const tb = new THREE.Box3(); clone.traverse(n => { if (n.isMesh) { n.geometry.computeBoundingBox(); tb.union(n.geometry.boundingBox); } });
    const tz = tb.max.z - tb.min.z, ty = tb.max.y - tb.min.y, pz = box.max.z - box.min.z, py = box.max.y - box.min.y;
    if (meta && (meta.nade || !REAL_LEN[id])) {                                   // granater o.l.: som før (passes ind i kassen)
      const s = meta && meta.nade ? py / Math.max(1e-3, ty) : Math.min(pz / Math.max(1e-3, tz), py * 1.05 / Math.max(1e-3, ty));
      clone.scale.setScalar(s); box.getCenter(clone.position);
      if (!(meta && meta.nade)) clone.position.z = box.min.z - tb.min.z * s;
      body.add(clone); return clone;
    }
    const s = REAL_LEN[id] / Math.max(1e-3, tz); clone.scale.setScalar(s); clone.position.set(0, 0, 0);
    const A = analyzeGun(clone, id, !!meta.pistol), adj = ANCHOR_ADJ[id] || {};
    // højre hånd: håndens midte sidder ARM.r.p i våbnets rum → flyt modellen så grebets top (receiverens underkant) ligger 5 cm over hånden
    const hand = meta.pistol ? [0.003, -0.032, 0.012] : [0.004, -0.05, 0.032], g = adj.g || [0, 0, 0];
    const off = new THREE.Vector3(hand[0] + g[0], hand[1] + 0.05 + g[1] - A.grip.y, hand[2] + g[2] - (A.grip.z + (meta.pistol ? 0.012 : 0.0)));
    clone.position.copy(off); body.add(clone);
    // ankre til arme, mundingsild, sigte og genladning
    meta.muzzle = new THREE.Vector3(0, A.my + off.y, A.z0 + off.z);
    if (!meta.pistol) {
      const mf = A.mag ? A.mag.z0 : A.grip.z - A.L * 0.18, zs = Math.max(A.z0 + A.L * 0.12, mf - Math.max(0.06, (mf - A.z0) * 0.34)), k = A.bin(zs), sa = adj.s || [0, 0, 0];
      meta.support = new THREE.Vector3(sa[0], A.lo[k] + 0.012 + off.y + sa[1], zs + off.z + sa[2]);
    }
    if (A.mag) { meta.magPos = new THREE.Vector3(0, A.mag.min + 0.04 + off.y, (A.mag.z0 + A.mag.z1) / 2 + off.z); meta.mag = null; }
    meta.eject = new THREE.Vector3(0.03, A.base + off.y + 0.05, A.grip.z + off.z - 0.06);
    meta.butt = A.z0 + A.L + off.z;                                                 // v14: bagerste punkt (kolbe) – tredjeperson lægger kolben mod skulderen
    meta.anchored = true; meta.anchor = A;
    if (meta.view) splitReload(body, clone, A, off, id, meta, mk);
    return clone;
  }
  /* ---- v14: GENLADNING – magasinet (og AK'ens ladegreb) som egne dele + punkter til venstre hånd ----
     RELOAD[id] = [magasin-type, spænde-type]:
       magasin: 'front' (foran grebet), 'rear' (bullpup: bag grebet), 'grip' (i pistolgrebet: pistoler, MAC-10),
                'top' (P90: proceduralt magasin oven på – modellens overdel er ét stykke), 'hidden' (AWP: lille magasin under receiveren, ikke en del af modellen)
       spænding: 'slide' (pistolslæde), 'side' (ladegreb i højre side), 'rear' (bagerst foroven), 'top' (foroven), 'hk' (forrest venstre), 'bolt' (AWP)
     Magasinet findes i rækkefølgen: mærkede dele (procedurale skabeloner: userData.part = 'mag') → sammenhængende geometri-øer i
     magasinzonen fra bundprofilen → trekanter helt inde i zonen (magasinet er svejset til receiveren, fx UMP-45) → et proceduralt
     magasin der kun ses, når det er trukket ud (pistolgreb, AWP). */
  const RELOAD = { usp: ['grip', 'slide'], glock: ['grip', 'slide'], fiveseven: ['grip', 'slide'], deagle: ['grip', 'slide'], tec9: ['grip', 'top'],
    mac10: ['grip', 'top'], mp9: ['front', 'rear'], mp7: ['front', 'rear'], mp5: ['front', 'hk'], ump45: ['front', 'hk'], p90: ['top', 'side'],
    galil: ['front', 'side'], ak47: ['front', 'side'], m4a1: ['front', 'rear'], famas: ['front', 'rear'], awp: ['hidden', 'bolt'] };   // (MP7/MP9/FAMAS: modellernes magasin sidder foran grebet)
  function islands(geo) {                                    // sammenhængende øer; hjørner svejses på position (UV-sømme deler ikke en ø)
    const P = geo.attributes.position, I = geo.index, n = P.count, key = new Map(), vid = new Int32Array(n), par = [];
    const find = a => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
    for (let i = 0; i < n; i++) { const k = Math.round(P.getX(i) * 2e4) + ',' + Math.round(P.getY(i) * 2e4) + ',' + Math.round(P.getZ(i) * 2e4); let q = key.get(k); if (q === undefined) { q = par.length; key.set(k, q); par.push(q); } vid[i] = q; }
    const ix = k => I ? I.getX(k) : k, nt = (I ? I.count : n) / 3;
    for (let t = 0; t < nt; t++) { const a = find(vid[ix(t * 3)]), b = find(vid[ix(t * 3 + 1)]), c = find(vid[ix(t * 3 + 2)]); par[b] = a; par[find(c)] = a; }
    return { nt, ix, isl: i => find(vid[i]) };
  }
  function subGeo(geo, tris, ix) {                          // samme hjørne-attributter, kun de valgte trekanter
    const g2 = new THREE.BufferGeometry(); for (const k in geo.attributes) g2.setAttribute(k, geo.attributes[k]);
    const arr = new (geo.attributes.position.count > 65535 ? Uint32Array : Uint16Array)(tris.length * 3);
    tris.forEach((t, j) => { arr[j * 3] = ix(t * 3); arr[j * 3 + 1] = ix(t * 3 + 1); arr[j * 3 + 2] = ix(t * 3 + 2); });
    g2.setIndex(new THREE.BufferAttribute(arr, 1)); g2.computeBoundingSphere(); g2.computeBoundingBox(); return g2;
  }
  function splitReload(body, clone, A, off, id, meta, mk) {
    const RT = RELOAD[id]; if (!RT) return;
    const [style, rack] = RT, V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const baseY = A.base + off.y, gz = A.grip.z + off.z, hiAt = z => A.hi[A.bin(z - off.z)] + off.y, loAt = z => A.lo[A.bin(z - off.z)] + off.y;
    body.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(body.matrixWorld).invert(), v = new THREE.Vector3();
    const meshes = []; clone.traverse(n => { if (n.isMesh && !Array.isArray(n.material)) meshes.push(n); });
    const picks = new Map(), pts = [];                      // mesh -> trekanter der hører til magasinet; pts = magasinets hjørner (body-rum)
    const pick = (n, tris, M, I) => { if (!tris.length) return; picks.set(n, tris); const P = n.geometry.attributes.position; for (const t of tris) for (let e = 0; e < 3; e++) pts.push(v.fromBufferAttribute(P, I.ix(t * 3 + e)).applyMatrix4(M).clone()); };
    const tagged = meshes.filter(n => n.userData.part === 'mag');
    if (tagged.length) for (const n of tagged) { const M = new THREE.Matrix4().multiplyMatrices(inv, n.matrixWorld), I = islands(n.geometry); pick(n, Array.from({ length: I.nt }, (_, t) => t), M, I); }
    else if (style === 'front' || style === 'rear' || style === 'grip') {
      // magasinzonen (body-rum): fra bundprofilens magasin-dal, aldrig ind over pistolgrebet. 'grip': kun en separat ø der stikker ud under grebet (TEC-9)
      const gv = A.valleys.reduce((a, q) => !a || Math.abs((q.z0 + q.z1) / 2 - A.grip.z) < Math.abs((a.z0 + a.z1) / 2 - A.grip.z) ? q : a, null);
      const src = style === 'grip' ? gv : A.mag; if (!src) return procMag();
      let z0 = src.z0 + off.z - (style === 'grip' ? 0.01 : 0.05), z1 = src.z1 + off.z + (style === 'grip' ? 0.01 : 0.05); const yMin = src.min + off.y;
      if (style === 'front') z1 = Math.min(z1, gz - 0.035); else if (style === 'rear') z0 = Math.max(z0, gz + 0.035);
      const topY = A.y1 + off.y, deep = yMin + 0.3 * (baseY - yMin), maxY = style === 'grip' ? baseY - 0.02 : baseY + 0.5 * (topY - baseY);
      const isMag = b => b.min.y < deep && b.max.y < maxY && b.min.z > z0 - 0.01 && b.max.z < z1 + 0.01 && b.max.x - b.min.x < (style === 'grip' ? 0.06 : 0.08) && b.max.z - b.min.z < 0.18;
      const info = [], prim = new THREE.Box3();
      for (const n of meshes) {
        const M = new THREE.Matrix4().multiplyMatrices(inv, n.matrixWorld), I = islands(n.geometry), P = n.geometry.attributes.position, box = new Map();
        for (let i = 0; i < P.count; i++) { const r = I.isl(i); let b = box.get(r); if (!b) box.set(r, b = new THREE.Box3()); b.expandByPoint(v.fromBufferAttribute(P, i).applyMatrix4(M)); }
        info.push({ n, M, I, box });
        for (const b of box.values()) if (isMag(b)) prim.union(b);
      }
      if (!prim.isEmpty()) {                                // øer der er mag-agtige, plus små dele inde i deres samlede kasse (ribber, bundplade)
        const outer = prim.clone().expandByScalar(0.004);
        for (const { n, M, I, box } of info) {
          const keep = new Set(); for (const [r, b] of box) if (isMag(b) || outer.containsBox(b)) keep.add(r);
          if (!keep.size) continue; const tris = []; for (let t = 0; t < I.nt; t++) if (keep.has(I.isl(I.ix(t * 3)))) tris.push(t);
          pick(n, tris, M, I);
        }
      } else if (style === 'grip') return procMag();
      else {                                                // svejset til receiveren: trekanter i zonen (midtpunkt under receiverens underkant, hjørnerne højst lidt oppe i den)
        for (const { n, M, I } of info) {
          const P = n.geometry.attributes.position, tris = [];
          for (let t = 0; t < I.nt; t++) { let ok = true, cy = 0; for (let e = 0; e < 3 && ok; e++) { v.fromBufferAttribute(P, I.ix(t * 3 + e)).applyMatrix4(M); cy += v.y / 3; ok = v.y < baseY + 0.04 && v.y > yMin - 0.01 && v.z > z0 && v.z < z1 && Math.abs(v.x) < 0.04; }
            if (ok && cy < baseY - 0.01) tris.push(t); }
          pick(n, tris, M, I);
        }
      }
    }
    let tot = 0; for (const n of meshes) tot += islands(n.geometry).nt; let nm = 0; for (const t of picks.values()) nm += t.length;
    if (!picks.size || nm > tot * 0.6) { picks.clear(); return procMag(); }
    // magasinets akse: fra toppen (ved receiveren) mod bunden – top- og bundbåndets midtpunkter
    const bb = new THREE.Box3(); for (const q of pts) bb.expandByPoint(q);
    const h = bb.max.y - bb.min.y, band = (lo, hi2) => { const c = new THREE.Vector3(); let k = 0; for (const q of pts) if (q.y >= lo && q.y <= hi2) { c.add(q); k++; } return k ? c.divideScalar(k) : null; };
    const topC = band(bb.max.y - h * 0.2, bb.max.y) || V3(0, bb.max.y, (bb.min.z + bb.max.z) / 2), botC = band(bb.min.y, bb.min.y + h * 0.2) || V3(0, bb.min.y, topC.z);
    const midC = band(bb.max.y - h * 0.55, bb.max.y - h * 0.3) || botC; topC.y = Math.min(topC.y, baseY); const axis = midC.clone().sub(topC).normalize();
    const mag = new THREE.Group(); mag.position.copy(topC); body.add(mag); body.updateMatrixWorld(true);
    for (const [n, tris] of picks) {
      const I = islands(n.geometry), all = picks.get(n).length === I.nt, sel = new Set(tris);
      const mm = new THREE.Mesh(subGeo(n.geometry, tris, I.ix), n.material); mm.name = (n.name || '') + '_mag';
      n.parent.add(mm); mm.position.copy(n.position); mm.quaternion.copy(n.quaternion); mm.scale.copy(n.scale); mm.updateMatrixWorld(true); mag.attach(mm);
      if (all) n.visible = false; else { const rest = []; for (let t = 0; t < I.nt; t++) if (!sel.has(t)) rest.push(t); n.geometry = subGeo(n.geometry, rest, I.ix); }
    }
    let charge = null;
    meshes.filter(n => n.userData.part === 'charge').forEach(n => { if (!charge) { charge = new THREE.Group(); body.add(charge); body.updateMatrixWorld(true); } charge.attach(n); });
    finish(mag, false, topC, axis, Math.max(0.05, topC.distanceTo(botC)), charge);
    function procMag() {                                    // proceduralt magasin (pistolgreb / AWP): ses kun når det er trukket ud af våbnet
      const pist = !!meta.pistol;
      let topC, axis, len, w, d;
      if (style === 'grip') {                               // grebets hældning: fra grebets top (ved receiveren) mod det dybeste punkt i grebs-dalen
        const gv = A.valleys.reduce((a, q) => !a || Math.abs((q.z0 + q.z1) / 2 - A.grip.z) < Math.abs((a.z0 + a.z1) / 2 - A.grip.z) ? q : a, null);
        let bz = A.grip.z, by = A.y0;                       // bunden: midten af de bins der ligger inden for 1 cm af grebets dybeste punkt (lodret kasse => kassens midte)
        if (gv) { const k0 = A.bin(gv.z0 + 1e-4), k1 = A.bin(gv.z1 - 1e-4); let m = Infinity; for (let k = k0; k <= k1; k++) m = Math.min(m, A.lo[k]); let sz = 0, n2 = 0; for (let k = k0; k <= k1; k++) if (A.lo[k] < m + 0.01) { sz += A.z0 + (k + 0.5) * A.L / A.N; n2++; } bz = sz / n2; by = m; }
        topC = V3(0, baseY - 0.006, gz); const bot = V3(0, by + off.y + 0.004, bz + off.z + (pist ? 0.004 : 0));
        axis = bot.clone().sub(topC); len = Math.max(0.06, axis.length()); axis.normalize();
        if (axis.y > -0.7) axis.set(0, -0.94, 0.34).normalize();
        w = pist ? 0.019 : 0.022; d = pist ? 0.03 : 0.034;
      } else if (style === 'top') {                         // P90: langt magasin oven på receiveren – løftes op bagtil og trækkes bagud
        const zc = gz - A.L * 0.18; topC = V3(0, hiAt(zc) - 0.012, zc); axis = V3(0, 0.6, 0.8).normalize(); len = 0.02;
        const g = new THREE.Group(); g.position.copy(topC); body.add(g);
        const shell = mk({ color: 0x2a2c2a, roughness: 0.3, metalness: 0.2, transparent: true, opacity: 0.85 }), brass = mk({ color: 0xc89a3a, roughness: 0.3, metalness: 0.9 });
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.026, 0.23), shell); g.add(b);
        const rr = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.2), brass); rr.position.y = -0.002; g.add(rr);
        return finish(g, true, topC, axis, len, null);
      } else { topC = V3(0, baseY - 0.004, gz - Math.min(0.13, A.L * 0.12)); axis = V3(0, -1, 0); len = 0.055; w = 0.03; d = 0.075; }
      const g = new THREE.Group(); g.position.copy(topC); body.add(g);
      const steel = mk({ color: 0x1b1c1f, roughness: 0.42, metalness: 0.75 }), brass = mk({ color: 0xc89a3a, roughness: 0.3, metalness: 0.9 });
      const inner = new THREE.Group(); inner.quaternion.setFromUnitVectors(V3(0, -1, 0), axis); g.add(inner);
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, len, d), steel); b.position.y = -len / 2; inner.add(b);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(w + 0.004, 0.008, d + 0.006), steel); plate.position.y = -len - 0.002; inner.add(plate);
      const rnd = new THREE.Mesh(new THREE.CylinderGeometry(pist ? 0.0045 : 0.005, pist ? 0.0045 : 0.005, d * 0.7, 10), brass); rnd.rotation.x = Math.PI / 2; rnd.position.set(0, -0.004, 0); inner.add(rnd);
      finish(g, true, topC, axis, len, null);
    }
    function finish(mag, hidden, topC, axis, len, charge) {
      const rp = { slide: [0, A.z1 + off.z - 0.035], top: [0, gz - 0.07], rear: [0, gz + 0.03], side: [0.032, gz - 0.13], hk: [-0.022, (meta.support ? meta.support.z : gz - 0.2) - 0.07], bolt: [0.03, gz - 0.02] }[rack];
      let r0;
      if (charge) { const cb = new THREE.Box3().setFromObject(charge); const c = cb.getCenter(new THREE.Vector3()); body.worldToLocal(c); r0 = c.add(V3(0.012, 0.004, 0)); }
      else if (rack === 'side' || rack === 'bolt') r0 = V3(rp[0], baseY + 0.035, rp[1]);
      else if (rack === 'hk') r0 = V3(rp[0], hiAt(rp[1]) - 0.012, rp[1]);
      else r0 = V3(rp[0], hiAt(rp[1]) + 0.004, rp[1]);
      meta.reload = { style, rack, mag, hidden, rest: mag.position.clone(), restQ: mag.quaternion.clone(), axis, len, charge, chargeZ: charge ? charge.position.z : 0,
        rack0: r0, rackLen: rack === 'slide' ? 0.045 : rack === 'hk' ? 0.075 : 0.065, pistol: !!meta.pistol, gripZ: gz, baseY };
      mag.visible = !hidden;
    }
  }
  const ARM = {
    rifle: { r: { p: [0.004, -0.05, 0.032], d: [0.2, 0.1, 0.97], g: [0, 0.85, -0.52], f: [0.36, -0.42, 0.83] },
             l: { p: [-0.004, 0.008, 0], d: [-0.95, -0.3, 0.1], g: [0, 0, -1], f: [-0.28, -0.4, 0.87], m: true } },
    pistol: { r: { p: [0.003, -0.032, 0.012], d: [0.15, 0.1, 0.98], g: [0, 0.9, -0.42], f: [0.3, -0.45, 0.84], s: 0.84 },
              l: { p: [-0.008, -0.046, 0.006], d: [-0.15, -0.05, 0.98], g: [0, 0.9, -0.42], f: [-0.42, -0.5, 0.76], m: true, s: 0.84 } },
    nade: { r: { p: [0.004, 0.0, 0.03], d: [0.2, -0.1, 0.97], g: [0, 1, 0], f: [0.25, -0.55, 0.8] },
            l: { p: [-0.1, -0.08, 0.06], d: [-0.3, -0.5, 0.8], g: [0, 1, 0], f: [-0.3, -0.5, 0.8], m: true } },
    knife: {}
  };
  // venstre hånd under genladning (som ARM: d = håndens akse mod håndleddet, g = grebsakse, f = underarmen): om et lodret magasin / hen over receiveren
  const LPOSE = { mag: { d: [-0.45, -0.7, 0.55], g: [0, 1, 0.1], f: [-0.35, -0.75, 0.55] }, rack: { d: [-0.8, 0.1, 0.55], g: [0, 0, 1], f: [-0.38, -0.86, 0.34] } };   // rack: håndryggen op (venstre hånd er spejlet => grebsaksen bagud)
  function viewmodel(id, team, skinId) {
    const M = mats(id, 'view', team), g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const build = B[id]; if (!build) return null;
    const meta = build(body, M, skinId) || {};
    if (meta.knife) {                                      // v13: kniven holdes i et rigtigt hammergreb: grebet i hånden, klingen op/ind mod midten, æggen væk fra armen
      const kp = new THREE.Group(), kids = body.children.slice(); for (const c of kids) { body.remove(c); kp.add(c); }
      // v14: karambit holdes i OMVENDT greb (pegefingeren i ringen, klingen ud under lillefingeren og buet fremad) – de andre i hammergreb
      const rev = meta.model === 'karambit', KG = (typeof window !== 'undefined' && window.__kgrip) || {};
      const gz = meta.gripZ !== undefined ? meta.gripZ : rev ? 0.07 : 0.055, S = 1.45;   // førstepersons-kniv: lidt større end virkeligheden (som i CS)
      const b = new THREE.Vector3(...(rev ? (KG.b || [0.5, 0.7, 0.3]) : [-0.5, 0.78, -0.38])).normalize();   // tommelfinger-siden af grebet (hammer: klingens retning, omvendt: ringens)
      const f = new THREE.Vector3(...(rev ? (KG.f || [0.42, -0.62, 0.66]) : [0.5, -0.55, 0.67])).normalize();   // underarmen: mod nederste højre hjørne
      const hy = f.clone().addScaledVector(b, -f.dot(b)).normalize();                // håndens akse ⟂ grebet (håndleddet bøjer resten)
      const zK = rev ? b.clone() : b.clone().negate(), yK = hy.clone().multiplyScalar(rev ? (KG.flip ? -1 : 1) : -1), xK = new THREE.Vector3().crossVectors(yK, zK).normalize(); yK.crossVectors(zK, xK);
      kp.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xK, yK, zK)); kp.scale.setScalar(S);
      kp.position.copy(new THREE.Vector3(0, 0, gz * S).applyQuaternion(kp.quaternion).negate());   // grebets midte i hånden (origo)
      body.add(kp); meta.kpivot = kp;
      meta.grip = new THREE.Vector3(0, 0, 0); meta.handDir = hy.toArray(); meta.gripAxis = b.toArray(); meta.foreDir = f.toArray();
      if (meta.tip) meta.tip = meta.tip.clone().multiplyScalar(S).add(new THREE.Vector3(0, 0, 0)).applyQuaternion(kp.quaternion).add(kp.position);
    }
    meta.view = true;                                      // førsteperson: magasin/ladegreb skilles ud til genladningen (splitReload)
    const glb = fitTemplate(body, id, team, skinId, p => { const m = new THREE.MeshStandardMaterial(p); if (o.withBake) o.withBake(m, true); return m; }, meta);
    const mkArm = armsFor(finishTeam('knife', team)), right = mkArm({ rg: meta.knife ? 0.013 : meta.nade ? 0.03 : 0.016 }), left = mkArm({ rg: meta.pistol ? 0.032 : 0.025, curl: meta.pistol ? 0.85 : 0.8 });
    // armstillinger: p = håndens placering (grebets akse), d = håndens akse mod håndleddet, g = grebsakse (pegefingerens retning), f = underarmens retning
    const kindA = meta.knife ? 'knife' : meta.nade ? 'nade' : meta.pistol ? 'pistol' : 'rifle', A = Object.assign({}, ARM[kindA], (typeof window !== 'undefined' && window.__armTune && window.__armTune[kindA]) || {});
    const placeArm = (h, c, base) => { h.arm.position.set(...c.p); if (base) h.arm.position.add(base); h.arm.scale.setScalar(c.s || 0.92); h.point(c.d, c.g, c.f, c.m); body.add(h.arm); };
    if (meta.knife) { right.arm.position.copy(meta.grip); right.arm.scale.setScalar(0.92); right.point(meta.handDir, meta.gripAxis, meta.foreDir); body.add(right.arm); }
    else placeArm(right, A.r);
    if (meta.support && A.l) placeArm(left, A.l, meta.support);
    else if (meta.pistol && A.l) placeArm(left, A.l);
    else if (meta.nade) {                                  // venstre hånd: trækker splitten (eller holder lighteren til molotov-kluden)
      placeArm(left, A.l);
      if (meta.wick) {                                    // lighter + flamme (vises mens kluden antændes)
        const lt = new THREE.Mesh(boxG(0.022, 0.05, 0.012), M.accent); lt.position.set(0.0, 0.02, -0.02); left.arm.add(lt);
        const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.085), new THREE.MeshBasicMaterial({ map: wickTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(1.6, 0.75, 0.25) }));
        fl.position.copy(meta.wick).add(new THREE.Vector3(0, 0.03, 0)); fl.visible = false; body.add(fl); meta.wickFlame = fl;
      }
    }
    // v14: venstre hånds greb under genladningen (om magasinet, hen over ladegrebet/slæden) – arm- og håndleds-rotationer beregnes én gang
    let leftPose = null;
    if (meta.reload && (meta.support || meta.pistol)) {
      const a0 = left.arm.quaternion.clone(), w0 = left.wrist.quaternion.clone(), s0 = left.arm.scale.clone(); leftPose = { base: { a: a0, w: w0 } };
      for (const k in LPOSE) { const c = LPOSE[k]; left.point(c.d, c.g, c.f, true); leftPose[k] = { a: left.arm.quaternion.clone(), w: left.wrist.quaternion.clone() }; }
      left.arm.quaternion.copy(a0); left.wrist.quaternion.copy(w0); left.arm.scale.copy(s0);
    }
    const allMats = [];
    g.traverse(n => { if (n.isMesh) { n.castShadow = false; n.receiveShadow = false; if (n.material && !allMats.includes(n.material)) allMats.push(n.material); } });
    // mundingsild (additiv stjerne) + lys-blink håndteres af appen
    let flash = null;
    if (meta.muzzle) {
      const ft = flashTex();
      flash = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), new THREE.MeshBasicMaterial({ map: ft, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(0xffe0a0).multiplyScalar(4) }));   // HDR => bloom
      flash.position.copy(meta.muzzle).add(new THREE.Vector3(0, 0, -0.04)); flash.visible = false; body.add(flash);
      const side = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.09), flash.material); side.rotation.y = Math.PI / 2; side.position.z = -0.08; flash.add(side);
    }
    g.userData = { id, meta, body, flash, parts: body.children.filter(c => c !== right.arm && c !== left.arm && c !== flash && c !== meta.wickFlame), mats: allMats, leftArm: left.arm, leftBase: left.arm.position.clone(), leftQuat: left.arm.quaternion.clone(), leftWrist: left.wrist, leftPose, rightArm: right.arm, rightBase: right.arm.position.clone(), skin: glb ? glb.userData.skin : skinName(id, team), glb: !!glb };
    return g;
  }
  let _wickTex = null;
  function wickTex() {                                   // lille flamme (blå bund, gul/orange tunge)
    if (_wickTex) return _wickTex;
    _wickTex = o.canvasTexture((c, w, h) => {
      const g = c.createRadialGradient(w / 2, h * 0.72, 0, w / 2, h * 0.6, w * 0.45); g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.4, 'rgba(255,200,120,.85)'); g.addColorStop(1, 'rgba(255,120,40,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(w / 2, h * 0.03); c.bezierCurveTo(w * 0.85, h * 0.45, w * 0.8, h * 0.95, w / 2, h * 0.96); c.bezierCurveTo(w * 0.2, h * 0.95, w * 0.15, h * 0.45, w / 2, h * 0.03); c.fill();
      const b = c.createRadialGradient(w / 2, h * 0.9, 0, w / 2, h * 0.9, w * 0.2); b.addColorStop(0, 'rgba(120,160,255,.8)'); b.addColorStop(1, 'rgba(120,160,255,0)'); c.fillStyle = b; c.fillRect(0, 0, w, h);
    }, 64, 128);
    return _wickTex;
  }
  let _flashTex = null;
  function flashTex() {
    if (_flashTex) return _flashTex;
    _flashTex = o.canvasTexture((c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.25, 'rgba(255,210,120,.9)'); g.addColorStop(1, 'rgba(255,120,30,0)'); c.fillStyle = g;
      c.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, r = i % 2 ? w * 0.18 : w * 0.5; c.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); } c.fill();
    }, 128, 128);
    return _flashTex;
  }
  // sammensmelt alle dele pr. materiale (ét draw call pr. materiale i stedet for ét pr. del)
  function mergeByMaterial(root) {
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), groups = new Map();
    root.traverse(n => { if (!n.isMesh) return; const g = (n.geometry.index ? n.geometry.toNonIndexed() : n.geometry.clone()); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, n.matrixWorld)); if (!groups.has(n.material)) groups.set(n.material, []); groups.get(n.material).push(g); });
    const out = new THREE.Group();
    for (const [m, list] of groups) {
      let n = 0; for (const g of list) n += g.attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let k = 0;
      for (const g of list) { const a = g.attributes; pos.set(a.position.array, k * 3); nor.set(a.normal.array, k * 3); if (a.uv) uv.set(a.uv.array, k * 2); k += a.position.count; g.dispose(); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.computeBoundingSphere();
      out.add(new THREE.Mesh(geo, m));
    }
    return out;
  }
  // 3.-persons-model (deler spillerens bagte lys via sharedMat.userData.uBake); geometrien bygges én gang pr. våben og deles
  const worldGeo = {};
  function worldModel(id, sharedMat, team, skinId) {
    const build = B[id]; if (!build) return null;
    const M = mats(id, 'world', team);
    if (sharedMat && sharedMat.userData.uBake) for (const k in M) if (M[k].userData && M[k].userData.uBake) M[k].userData.uBake = sharedMat.userData.uBake;
    const tmp = new THREE.Group(); const meta = build(tmp, M, skinId) || {};
    const mkW = p => { const m = o.dynMat ? o.dynMat(p) : new THREE.MeshLambertMaterial({ color: p.color, map: p.map || null }); if (sharedMat && sharedMat.userData.uBake && m.userData.uBake) m.userData.uBake = sharedMat.userData.uBake; return m; };
    const glb = fitTemplate(tmp, id, team, skinId, mkW, meta);
    if (glb) {                                                                       // GLB-model: behold som den er (allerede få dele), uden skygger fra våbnet
      glb.traverse(n => { if (n.isMesh) { n.castShadow = false; n.receiveShadow = true; } });
      tmp.userData = Object.assign({}, meta, { mag: null, bolt: null, slide: null, ring: null, wickFlame: null, skin: glb.userData.skin });
      return tmp;
    }
    const merged = mergeByMaterial(tmp);
    tmp.traverse(n => { if (n.isMesh && n.geometry) n.geometry.dispose(); });
    merged.traverse(n => { if (n.isMesh) { n.castShadow = false; n.receiveShadow = true; } });
    merged.userData = Object.assign({}, meta, { mag: null, bolt: null, slide: null, ring: null, wickFlame: null });
    return merged;
  }
  function c4Model(text) { const M = { poly: new THREE.MeshLambertMaterial({ color: 0x2a2c2e }) }; if (o.dynMat) M.poly = o.dynMat({ color: 0x2a2c2e }); return buildC4(M, text); }
  function c4View() {
    const M = mats('c4', 'view', 'hij'), g = new THREE.Group(), c4 = buildC4(M); c4.position.set(-0.02, -0.02, -0.08); c4.rotation.set(0.5, 0.2, 0); g.add(c4);
    const mkArm = armsFor('hij', M), r = mkArm(), l = mkArm(); r.arm.position.set(0.11, -0.04, -0.02); r.point([0.3, -0.45, 0.84]); l.arm.position.set(-0.13, -0.04, -0.02); l.point([-0.3, -0.45, 0.84]); g.add(r.arm, l.arm);
    g.userData = { id: 'c4', c4, rightArm: r.arm, mats: [] }; g.traverse(n => { if (n.isMesh && !g.userData.mats.includes(n.material)) g.userData.mats.push(n.material); });
    return g;
  }
  return { viewmodel, worldModel, c4Model, c4View, SKIN_NAME, skinName, MODELS: Object.keys(B), SKINS: (o.skinList || []), reloadStyle: id => RELOAD[id] || null };
}
