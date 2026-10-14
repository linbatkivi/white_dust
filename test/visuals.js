// Visuals-test (uden browser): bygger verdensmesh (med bagt lys), dekor, døre, effekter, himmel, spillermodeller og våben
// for ALLE baner med stub-canvas. Tjekker:
//   • ingen NaN i geometri/bagt lys · trekant-/draw-call-budget · byggetid
//   • mesh = kollision set ovenfra · gulve/lofter er ikke gennemsigtige (set nedefra) · ingen 'svævende' lofter uden bund
//   • indendørs er mørkere end udendørs (bagt himmel-synlighed) · alle stiger/døre/props får en model
const fs = require('fs'), os = require('os'), path = require('path'), url = require('url');
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdvis-'));
  const pub = path.join(__dirname, '..', 'public');
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  fs.copyFileSync(path.join(pub, 'vendor', 'three.module.min.js'), path.join(dir, 'three.module.min.js'));
  for (const f of fs.readdirSync(path.join(pub, 'js'))) if (f.endsWith('.js') && f !== 'app.js') fs.copyFileSync(path.join(pub, 'js', f), path.join(dir, f));
  const imp = f => import(url.pathToFileURL(path.join(dir, f)).href);
  const THREE = await imp('three.module.min.js');
  const { createVisuals } = await imp('visuals.js');
  const { createThemes } = await imp('themes.js');
  const { createCharacters } = await imp('characters.js');
  const { createWeapons } = await imp('weapons.js');
  const WD = require('../shared/wd.js');
  const mkProxy = () => { const p = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : (k in t ? t[k] : (typeof k === 'symbol' ? undefined : () => p)), set: (t, k, v) => { t[k] = v; return true; }, apply: () => p }); return p; };
  const ctx = mkProxy(), ct = (d, w, h) => { d(ctx, w, h); return new THREE.Texture(); };
  let bad = 0;
  const ok = (c, m) => { console.log((c ? '  ok   ' : '  FEJL ') + m); if (!c) bad++; };
  const BUDGET = { tris: 260000, meshes: 520, ms: 6000 };
  for (const mp of WD.MAP_LIST) {
    if (mp.id === 'inferno' || mp.id === 'canals') { console.log('\n' + mp.id + ': forfattet bane (world.bin) – motorens reservegeometri af kollisionskasserne testes ikke her (test/nav.js + foto-tur)'); continue; }
    const W = WD.buildWorld(mp.id), t0 = Date.now(), V = createVisuals(THREE, WD, W, ct, 4, createThemes);
    const world = V.buildWorldMesh(), decor = V.buildDecor(), doors = V.buildDoors(), fx = V.buildFx(), ms = Date.now() - t0;
    let tris = 0, nan = 0, meshes = 0, noBake = 0;
    for (const g of [world, decor]) g.traverse(o => { if (o.isMesh) { meshes++; const a = o.geometry.attributes; tris += a.position.count / 3; if (!a.bake) noBake++; for (const k of ['position', 'normal', 'uv', 'color', 'bake']) if (a[k]) for (const v of a[k].array) if (!Number.isFinite(v)) nan++; } });
    console.log(`\n${mp.id}: ${meshes} meshes, ${Math.round(tris)} trekanter (verden ${Math.round(world.userData.tris)}, dekor ${Math.round(decor.userData.tris)}), ${world.userData.bakeN} bagte punkter, ${doors.count} døre, bygget på ${ms} ms`);
    ok(nan === 0, 'ingen NaN i geometri eller bagt lys'); ok(noBake === 0, 'alle statiske meshes har bagt lys');
    // de_havn er FORFATTET (Blender-bygget, bagt GI – tjekkes af test/havn.js); her bygges kun motorens enkle reserve-geometri
    const authored = mp.id === 'havn' || mp.id === 'inferno';                                    // v16: Inferno er også forfattet (tools/inferno/)
    const meshBudget = mp.id === 'inferno' ? 600 : BUDGET.meshes;   // v13: Inferno har flere materialer (puds, tegl, brosten, skodder, blomster, vasketøj)
    const triBudget = mp.id === 'inferno' ? 300000 : authored ? 420000 : BUDGET.tris;    // v14: Inferno har hvælv, kirke og tæt facadedekor
    ok(tris < triBudget && meshes < meshBudget, `budget: <${triBudget} trekanter og <${meshBudget} meshes`);
    // Nuke (v12.1) er bygget celle for celle fra STL-modellen (to etager, ~1400 bokse): større budget – i browseren ~4–5 s
    const msBudget = mp.id === 'nuke' || authored ? 11000 : BUDGET.ms;
    ok(ms < msBudget, `banen bygges på under ${msBudget} ms (inkl. bagt lys)`);
    fx.update(0.016, 1, { x: 0, y: 1, z: 0 }); V.update(0.3, 1, new THREE.Vector3(0, 1.6, 0), decor);
    doors.update(0.1, [{ x: 0, y: 0, z: 0 }], () => {});
    // mesh vs kollision (ovenfra) + bundflader skal ikke ses nedefra + lofter har en synlig underside
    const rc = new THREE.Raycaster(), b = W.bounds; let n = 0, mism = 0, down = 0, ceilN = 0, ceilMiss = 0;
    const STRUCT = { floor: 1, wall: 1, ceil: 1, slab: 1, roofslab: 1, grate: 1, stone: 1, ruin: 1, vent: 1, steel: 1, steelstairs: 1 };
    const top = (x, z) => { let best = -Infinity; for (const q of W.boxes) { if (!STRUCT[q.kind] || q.y1 >= 8.99) continue; if (x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1 && q.y1 > best) best = q.y1; } for (const r of W.ramps) if (x > r.bx0 && x < r.bx1 && z > r.bz0 && z < r.bz1) { const h = WD.rampHeight(r, r.axis === 'x' ? x : z); if (h > best) best = h; } return best; };
    const meshes2 = world.children;
    for (let i = 0; i < 500; i++) {
      const x = b.x0 + Math.random() * (b.x1 - b.x0), z = b.z0 + Math.random() * (b.z1 - b.z0), want = top(x, z); if (want === -Infinity) continue;
      if (W.boxes.some(q => STRUCT[q.kind] && q.y1 >= 8.99 && q.y0 <= want + 0.01 && x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1)) continue;   // inde i en massiv mur
      n++;
      rc.set(new THREE.Vector3(x, 8.95, z), new THREE.Vector3(0, -1, 0)); const h = rc.intersectObjects(meshes2, false)[0]; if (!h || Math.abs(h.point.y - want) > 0.03) mism++;
      rc.set(new THREE.Vector3(x, want - 0.3, z), new THREE.Vector3(0, 1, 0)); const u = rc.intersectObjects(meshes2, false)[0]; if (u && Math.abs(u.point.y - want) < 0.02 && want < 8) down++;
    }
    // lofter: fra en gå-bar position under et loft skal en stråle opad ramme en flade (ikke se himlen gennem loftet)
    for (const q of W.boxes) {
      if (q.kind !== 'ceil' && q.kind !== 'roofslab' && !(q.kind === 'floor' && W.layers.length > 1 && q.layer === 'G')) continue;
      for (let k = 0; k < 6; k++) {
        const x = q.x0 + 0.2 + Math.random() * (q.x1 - q.x0 - 0.4), z = q.z0 + 0.2 + Math.random() * (q.z1 - q.z0 - 0.4), y0 = q.y0 - 0.3;
        const g = WD.groundAt(W, x, z, y0, 0); if (g === -Infinity || y0 - g < 1.0) continue;
        if (V.insideSolid(x, y0, z, false)) continue;
        ceilN++; rc.set(new THREE.Vector3(x, y0, z), new THREE.Vector3(0, 1, 0)); const hh = rc.intersectObjects(meshes2, false)[0]; if (!hh || hh.distance > 0.4) ceilMiss++;
      }
    }
    ok(mism <= n * 0.04, `mesh matcher kollision set ovenfra (${mism}/${n} afvigelser)`); ok(down === 0, 'gulv/rampe ikke synlig nedefra (culling korrekt)');
    // v9 QA: face-normaler – (1) vindingsretningen (front face) stemmer med vertex-normalen for ALLE trekanter med enkeltsidet materiale
    //        (ingen inverterede flader / backface-culling-fejl), (2) verdens-flader vender ud mod åbent rum (ikke ind i massiv geometri)
    let triN = 0, inv = 0, walls = 0, intoSolid = 0;
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3(), vn = new THREE.Vector3();
    for (const [grp, isWorld] of [[world, true], [decor, false]]) grp.traverse(o => {
      if (!o.isMesh || !o.material || o.material.side === THREE.DoubleSide) return;
      const P = o.geometry.attributes.position.array, N = o.geometry.attributes.normal.array;
      for (let i = 0; i < P.length; i += 9) {
        e1.set(P[i + 3] - P[i], P[i + 4] - P[i + 1], P[i + 5] - P[i + 2]); e2.set(P[i + 6] - P[i], P[i + 7] - P[i + 1], P[i + 8] - P[i + 2]);
        fn.crossVectors(e1, e2); if (fn.lengthSq() < 1e-12) continue; fn.normalize();
        vn.set(N[i] + N[i + 3] + N[i + 6], N[i + 1] + N[i + 4] + N[i + 7], N[i + 2] + N[i + 5] + N[i + 8]); if (vn.lengthSq() < 1e-9) continue; vn.normalize();
        triN++; if (fn.dot(vn) < -0.05) { inv++; if (process.env.WD_DBGN) console.log('inv', o.userData.tag || o.name || (isWorld ? 'world' : 'decor'), P[i].toFixed(2), P[i + 1].toFixed(2), P[i + 2].toFixed(2), 'fn', fn.toArray().map(v => v.toFixed(2)).join(','), 'vn', vn.toArray().map(v => v.toFixed(2)).join(',')); }
        if (isWorld && Math.abs(fn.y) < 0.2) {
          walls++;
          const cx = (P[i] + P[i + 3] + P[i + 6]) / 3, cy = (P[i + 1] + P[i + 4] + P[i + 7]) / 3, cz = (P[i + 2] + P[i + 5] + P[i + 8]) / 3;
          // vendt forkert = forsiden peger ind i massiv geometri MENS bagsiden vender ud mod åbent rum (så man ville se bagsiden / et hul)
          if (V.insideSolid(cx + fn.x * 0.06, cy, cz + fn.z * 0.06, true) && !V.insideSolid(cx - fn.x * 0.06, cy, cz - fn.z * 0.06, false)) { intoSolid++; if (process.env.WD_DBGN) console.log('into', cx.toFixed(2), cy.toFixed(2), cz.toFixed(2), fn.toArray().map(v => v.toFixed(2)).join(',')); }
        }
      }
    });
    ok(inv === 0, `face-normaler: ${triN} trekanter, ${inv} inverterede (vinding ≠ normal)`);
    ok(intoSolid === 0, `vægflader vender ud mod åbent rum: ${walls} lodrette flader, ${intoSolid} vendt forkert (forside ind i væg, bagside mod rummet)`);
    ok(ceilMiss === 0, `lofter/etageadskillelser er lukkede nedefra – intet gennemsigtigt (${ceilN} prøver)`);
    // v10 QA: vejrlig (wear-attribut), decals, gesims og skybox-ring
    let noWear = 0, badWear = 0; const tagged = { skyline: [], cornice: [], decal: [] };
    for (const g of [world, decor]) g.traverse(o => { if (!o.isMesh) return; const a = o.geometry.attributes; if (!a.wear) noWear++; else for (const v of a.wear.array) if (!Number.isFinite(v)) badWear++; if (o.userData.tag) tagged[o.userData.tag].push(o); });
    ok(noWear === 0 && badWear === 0, 'vejrlig: alle statiske meshes har en gyldig wear-attribut (gulv, murkrone, vægt)');
    ok(!!(V.theme.weather && V.theme.post && V.theme.ambient), 'temaet har vejrligs-profil, filmisk look og ambient-partikler');
    let ex0 = Infinity, ex1 = -Infinity, ez0 = Infinity, ez1 = -Infinity;
    for (const q of W.boxes) { ex0 = Math.min(ex0, q.x0); ex1 = Math.max(ex1, q.x1); ez0 = Math.min(ez0, q.z0); ez1 = Math.max(ez1, q.z1); }
    let skyV = 0, skyIn = 0, skyShadow = 0;
    for (const m of tagged.skyline) { if (m.castShadow) skyShadow++; const P = m.geometry.attributes.position.array; for (let i = 0; i < P.length; i += 3) { skyV++; if (P[i] > ex0 - 1 && P[i] < ex1 + 1 && P[i + 2] > ez0 - 1 && P[i + 2] < ez1 + 1 && P[i + 1] < 11) skyIn++; } }
    if (!authored) ok(skyV > 500 && skyIn === 0, `skybox-ring: ${skyV} vertices uden for banen – ${skyIn} inde over spilbart område under 11 m (granater/kugler kan ikke ramme usynlige tage)`);
    ok(skyShadow === 0, 'skybox-ring kaster ingen skygger ind på banen (uændret taktisk lys)');
    let corN = 0, corBad = 0;
    for (const m of tagged.cornice) { const P = m.geometry.attributes.position.array; for (let i = 1; i < P.length; i += 3) { corN++; if (P[i] < 8.3 || P[i] > 9.0 + 1e-6) corBad++; } }
    // Nuke (v12.1, fra STL): yderkanten har sin egen afdækning langs omridset – derfor ingen gesims-tjek dér
    if (mp.id !== 'ancient' && mp.id !== 'nuke' && mp.id !== 'inferno' && !authored) ok(corN > 0 && corBad === 0, `gesims/inddækning ligger helt under murkronen (8,3–9,0 m): ${corN} vertices, ${corBad} udenfor`);
    // decals: hvert kort (2 trekanter) skal ligge fladt på en kollisionsflade 0–6 cm bag sig – aldrig svævende eller inde i væggen
    let dN = 0, dFloat = 0, dHigh = 0;
    for (const m of tagged.decal) {
      const P = m.geometry.attributes.position.array, N = m.geometry.attributes.normal.array;
      for (let i = 0; i < P.length; i += 18) {
        let cx = 0, cy = 0, cz = 0; for (let k = 0; k < 18; k += 3) { cx += P[i + k]; cy += P[i + k + 1]; cz += P[i + k + 2]; } cx /= 6; cy /= 6; cz /= 6;
        const nx = N[i], ny = N[i + 1], nz = N[i + 2]; dN++; if (cy > 8.4) dHigh++;
        const t = WD.raycastWorld(W, cx + nx * 0.3, cy + ny * 0.3, cz + nz * 0.3, -nx, -ny, -nz, 0.6);
        if (t < 0.3 - 0.005 || t > 0.3 + 0.065) { dFloat++; if (process.env.WD_DBG) console.log('    decal', cx.toFixed(2), cy.toFixed(2), cz.toFixed(2), 'n', nx, ny, nz, 't', t.toFixed(3)); }
      }
    }
    if (!authored) ok(dN >= 40 && dFloat === 0 && dHigh === 0, `decals: ${dN} mikro-detaljer, ${dFloat} svævende/klippende, ${dHigh} på murkroner`);
    // bagt lys: indendørs mørkere end udendørs
    const out = [], ins = [];
    for (let i = 0; i < 400; i++) { const x = b.x0 + Math.random() * (b.x1 - b.x0), z = b.z0 + Math.random() * (b.z1 - b.z0), g = WD.groundAt(W, x, z, 8, 0); if (g === -Infinity || V.insideSolid(x, g + 1, z, false)) continue; const open = WD.raycastWorld(W, x, g + 1, z, 0, 1, 0, 30) >= 29.99; (open ? out : ins).push(V.probe(x, g + 1, z)[3]); }
    const avg = a => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
    if (ins.length > 5 && out.length > 5) ok(avg(ins) < avg(out) * 0.6, `indendørs (${avg(ins).toFixed(2)}) er markant mørkere end udendørs (${avg(out).toFixed(2)})`);
    // spillermodeller + våben
    const Chars = createCharacters(THREE, WD, { canvasTexture: ct, dynMat: V.dynMat });
    const Weap = createWeapons(THREE, WD, { canvasTexture: ct, dynMat: V.dynMat, withBake: V.withBake });
    for (const side of ['swat', 'hij']) {
      const h = Chars.buildHuman(side); let badPose = 0;
      const codes = Object.values(WD.WEAPONS).filter(w => w.kind !== 'bomb').map(w => w.code);
      for (let i = 0; i < 240; i++) {
        if (i === 150) Chars.throwNade(h, false); if (i === 170) Chars.throwNade(h, true);
        Chars.animateHuman(h, 1 / 60, i / 60, { x: i * 0.05, y: 0, z: 0, yaw: i / 60, pitch: Math.sin(i / 20), alive: i < 220, crouch: i > 30 && i < 50, act: i > 60 && i < 75, grounded: i < 80 || i > 90, reload: i > 95 && i < 140, pin: i > 140 && i < 150, wcode: i < 140 ? codes[(i >> 3) % codes.length] : 6 });
        h.group.updateMatrixWorld(true); for (const bn of h.mesh.skeleton.bones) if (!Number.isFinite(bn.matrixWorld.elements[13])) badPose++;
      }
      const sw = h.mesh.geometry.attributes.skinWeight.array; let blended = 0; for (let i = 1; i < sw.length; i += 4) if (sw[i] > 0.01) blended++;
      const tris2 = h.mesh.geometry.attributes.position.count / 3;
      ok(badPose === 0 && tris2 > 6000, `${side}-model animerer uden NaN gennem alle tilstande (idle/løb/nedhuk/hop/plant/genladning/split/kast/død) – ${Math.round(tris2)} trekanter, ${h.mesh.skeleton.bones.length} knogler`);
      ok(blended > 500, `${side}-model: glat skinning ved leddene (${blended} vertices vægtet mellem 2 knogler)`);
    }
    if (mp.id === 'nuke') {
      const ids = Object.keys(WD.WEAPONS).filter(k => WD.WEAPONS[k].kind !== 'bomb');
      ok(ids.every(id => Weap.MODELS.includes(id)), 'alle ' + ids.length + ' våben/granater har en 3D-model');
      for (const id of ids) for (const team of ['hij', 'swat']) {
        const v = Weap.viewmodel(id, team), w = Weap.worldModel(id, null, team); let c = 0, nan = 0;
        v.traverse(o => { if (o.isMesh) { c++; for (const x of o.geometry.attributes.position.array) if (!Number.isFinite(x)) nan++; } });
        const wt = WD.WEAPONS[id].team, fin = Weap.skinName(id, team);
        if (team === 'swat' || wt === undefined) ok(c >= 5 && !!w && nan === 0 && (WD.WEAPONS[id].kind !== 'gun' || fin === (wt ? (wt === 'hij' ? 'Worn Factory' : 'Tactical Graphite') : (team === 'hij' ? 'Worn Factory' : 'Tactical Graphite'))), `våben ${id} (${team}): førsteperson (${c} dele) + 3.-person${fin ? ' · finish «' + fin + '»' : ''}`);
        if (WD.WEAPONS[id].kind === 'nade') ok(!!(v.userData.meta.ring || v.userData.meta.wick), `granat ${id}: sikringsring/klud til opladnings-animationen`);
      }
    }
  }
  // v11.3: inventar-katalog (agenter, skins, våbenmodeller) – alle filer findes, alle id'er er gyldige, sanitize falder tilbage til standard
  {
    const SK = await imp('skins.js');
    const A = path.join(__dirname, '..', 'public', 'assets');
    const charsOk = Object.values(SK.AGENTS).flat().every(a => fs.existsSync(path.join(A, 'chars', a.model + '.glb')) && a.variants.length > 0 && a.variants.every(v => SK.RARITY[v.rarity]));
    ok(charsOk, 'agenter: ' + Object.values(SK.AGENTS).flat().length + ' figurer med farvevarianter – alle GLB-filer findes');
    const files = Object.values(SK.GUN_FILE).flatMap(f => typeof f === 'object' ? Object.values(f) : [f]);
    ok(files.every(f => fs.existsSync(path.join(A, 'weapons', f + '.glb'))), 'våbenmodeller: ' + new Set(files).size + ' GLB-filer findes');
    ok(SK.GUNS.every(g => WD.WEAPONS[g] && WD.WEAPONS[g].kind === 'gun' && SK.GUN_FILE[g]), 'alle skydevåben i inventaret findes i spillet og har en model');
    ok(SK.WEAPON_SKINS.length >= 8 && SK.WEAPON_SKINS.every(s => SK.RARITY[s.rarity]), SK.WEAPON_SKINS.length + ' våben-skins med sjældenhed');
    const bad = SK.sanitize({ agent: { swat: 'findes:ikke', hij: 42 }, skins: { ak47: 'tiger', awp: 'xxx', foo: 'gold' } });
    ok(bad.agent.swat === SK.defaultAgent('swat') && bad.agent.hij === SK.defaultAgent('hij') && bad.skins.ak47 === 'tiger' && !bad.skins.awp && !bad.skins.foo, 'sanitize: ukendte agenter/skins falder tilbage til standard');
  }
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(bad ? `\nFEJL: ${bad}` : '\nALT OK'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
