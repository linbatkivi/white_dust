// ==========================================================================
// SPILLERMODELLER (v9): SWAT og Hijackers som ét SkinnedMesh pr. spiller (1 draw call), 17 knogler.
//   • polygon-mesh med realistiske proportioner (1,80 m): tilspidsede lemmer (lathe), tønde-formet torso, afrundet hoved
//   • GLAT SKINNING: lemmernes vertices nær leddene vægtes mellem forælder- og barneknogle (ingen 'knæk' i albuer, knæ, skuldre, hofter)
//   • separate tøjteksturer i et procedurelt teksturatlas pr. hold (PBR: albedo + afledt normal- og roughness-map):
//       SWAT     = mørkeblå ripstop-uniform, sort plate carrier med MOLLE-webbing, high-cut-hjelm med NVG-holder, høreværn,
//                  briller, balaclava, "SWAT"-rygpatch, albue-/knæbeskyttere, benhylster, radio
//       Hijackers= ørken-camo jakke, khaki cargobukser, oliven brystrig med AK-magasinlommer, shemagh om halsen,
//                  balaclava + strikhue, rødt armbind, bælte med dump-pouch, støvler
//   • arme holder våbnet med 2-leds IK (hænderne sidder på greb og forskæfte uanset sigte-vinkel)
//   • skelet-animation med blød interpolation (alle led eases) mellem:
//       idle (åndedræt) · løb/gang/sidelæns (retningsbestemt) · nedhuk + nedhuk-gang · hop · skud/rekyl (krop + arme)
//       genladning (venstre hånd: magasin ud → bæltelomme → ind) · granat: split trukket (armen spændt bagud) + kast (over-/underhånd)
//       plant/desarmér (knæl) · træffer-ryk · dødsfald
//   • lys: materialet får bagt lys fra banens lys-prober (setBake), så modellen matcher rummet den står i
// createCharacters(THREE, WD, opts)  opts: { canvasTexture, dynMat, derivePBR, weaponModel(id, mat, team) }
// ==========================================================================
export function createCharacters(THREE, WD, opts) {
  const o = opts || {};
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  const TEAM = {
    swat: { skin: 0xc8987a },
    hij: { skin: 0xb88b6a }
  };
  const BONES = [
    ['hips', -1, [0, 0.98, 0]], ['spine', 0, [0, 0.1, 0]], ['chest', 1, [0, 0.2, 0]], ['neck', 2, [0, 0.25, 0]], ['head', 3, [0, 0.08, 0]],
    ['uarmR', 2, [0.2, 0.2, 0]], ['farmR', 5, [0, -0.28, 0]], ['handR', 6, [0, -0.26, 0]],
    ['uarmL', 2, [-0.2, 0.2, 0]], ['farmL', 8, [0, -0.28, 0]], ['handL', 9, [0, -0.26, 0]],
    ['thighR', 0, [0.1, -0.06, 0]], ['shinR', 11, [0, -0.44, 0]], ['footR', 12, [0, -0.42, 0]],
    ['thighL', 0, [-0.1, -0.06, 0]], ['shinL', 14, [0, -0.44, 0]], ['footL', 15, [0, -0.42, 0]]
  ];
  const BI = {}; BONES.forEach((b, i) => { BI[b[0]] = i; });
  const bindWorld = BONES.map(() => new THREE.Vector3());
  BONES.forEach((b, i) => { bindWorld[i].set(...b[2]); if (b[1] >= 0) bindWorld[i].add(bindWorld[b[1]]); });

  /* ================= teksturatlas (4×4 regioner à 256 px) ================= */
  const REG = { uni: 0, sleeve: 1, pants: 2, vest: 3, pouch: 4, helm: 5, skin: 6, glove: 7, boot: 8, mask: 9, patch: 10, scarf: 11, metal: 12, sole: 13, plate: 14, strap: 15 };
  const rnd = seed => { let s = (seed >>> 0) % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  function paintAtlas(side) {
    const swat = side === 'swat', R = rnd(swat ? 101 : 202), S = 256;
    return (c) => {
      const reg = (i, fn) => { const x = (i % 4) * S, y = Math.floor(i / 4) * S; c.save(); c.beginPath(); c.rect(x, y, S, S); c.clip(); c.translate(x, y); fn(); c.restore(); };
      const noise = (n, a, sz) => { for (let i = 0; i < n; i++) { const v = R() * 255 | 0; c.fillStyle = `rgba(${v},${v},${v},${a * R()})`; c.fillRect(R() * S, R() * S, sz || 2, sz || 2); } };
      const weave = (a, step) => { c.fillStyle = `rgba(0,0,0,${a})`; for (let y = 0; y < S; y += step) c.fillRect(0, y, S, 1); c.fillStyle = `rgba(255,255,255,${a * 0.6})`; for (let x = 0; x < S; x += step) c.fillRect(x, 0, 1, S); };
      const ripstop = (a) => { c.strokeStyle = `rgba(0,0,0,${a})`; c.lineWidth = 1.2; for (let i = 0; i <= S; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, S); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(S, i); c.stroke(); } };
      const seams = (col) => { c.strokeStyle = col; c.setLineDash && c.setLineDash([4, 3]); c.lineWidth = 1.5; for (const y of [24, S - 24]) { c.beginPath(); c.moveTo(0, y); c.lineTo(S, y); c.stroke(); } c.setLineDash && c.setLineDash([]); };
      const camo = (cols) => { c.fillStyle = cols[0]; c.fillRect(0, 0, S, S); for (let k = 1; k < cols.length; k++) for (let i = 0; i < 30; i++) { c.fillStyle = cols[k]; c.globalAlpha = 0.85; c.beginPath(); const x = R() * S, y = R() * S, r = 10 + R() * 16; for (let j = 0; j < 9; j++) { const a = j / 9 * Math.PI * 2, rr = r * (0.6 + R() * 0.6); c.lineTo(x + Math.cos(a) * rr * 1.4, y + Math.sin(a) * rr); } c.closePath(); c.fill(); c.globalAlpha = 1; } };   // ørken-camo: mindre, bløde pletter
      const molle = (base, band) => { c.fillStyle = base; c.fillRect(0, 0, S, S); noise(2500, 0.12); for (let y = 30; y < S - 10; y += 30) { c.fillStyle = band; c.fillRect(0, y, S, 12); c.fillStyle = 'rgba(0,0,0,.45)'; for (let x = 0; x < S; x += 22) c.fillRect(x, y, 3, 12); c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(0, y, S, 1); } };
      const knit = (base) => { c.fillStyle = base; c.fillRect(0, 0, S, S); for (let x = 0; x < S; x += 4) { c.fillStyle = `rgba(0,0,0,${x % 8 ? 0.25 : 0.08})`; c.fillRect(x, 0, 2, S); } noise(1500, 0.1); };
      const leather = (base, crease) => { c.fillStyle = base; c.fillRect(0, 0, S, S); noise(3000, 0.12); c.strokeStyle = crease; c.lineWidth = 1.4; for (let i = 0; i < 26; i++) { c.beginPath(); const x = R() * S, y = R() * S; c.moveTo(x, y); c.quadraticCurveTo(x + (R() - 0.5) * 30, y + (R() - 0.5) * 10, x + (R() - 0.5) * 50, y + (R() - 0.5) * 14); c.stroke(); } };
      if (swat) {
        reg(REG.uni, () => { c.fillStyle = '#2b3b56'; c.fillRect(0, 0, S, S); noise(4000, 0.12); ripstop(0.22); weave(0.05, 3); seams('rgba(10,14,22,.6)'); });
        reg(REG.sleeve, () => { c.fillStyle = '#25344c'; c.fillRect(0, 0, S, S); noise(4000, 0.12); ripstop(0.22); weave(0.05, 3); c.fillStyle = '#1b2638'; c.fillRect(60, 80, 136, 90); c.fillStyle = '#2f6fd8'; c.fillRect(70, 90, 116, 14); });  // armlomme + blåt flag-felt
        reg(REG.pants, () => { c.fillStyle = '#27364f'; c.fillRect(0, 0, S, S); noise(4000, 0.12); ripstop(0.2); weave(0.05, 3); seams('rgba(10,14,22,.6)'); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(150, 60, 70, 100); });
        reg(REG.vest, () => molle('#1a1d22', '#22262c'));
        reg(REG.pouch, () => { c.fillStyle = '#1d2026'; c.fillRect(0, 0, S, S); noise(2500, 0.14); c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(0, 90, S, 4); c.fillStyle = '#2a2e35'; c.fillRect(90, 40, 76, 40); });
        reg(REG.helm, () => { c.fillStyle = '#16191d'; c.fillRect(0, 0, S, S); noise(6000, 0.08, 1.5); c.fillStyle = '#20242a'; c.fillRect(0, 120, S, 16); });
        reg(REG.patch, () => { c.fillStyle = '#121418'; c.fillRect(0, 0, S, S); c.strokeStyle = '#d8dde3'; c.lineWidth = 6; c.strokeRect(12, 70, S - 24, 116); c.fillStyle = '#e8ecf0'; c.font = '900 72px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('SWAT', S / 2, 130); c.font = '700 22px Arial'; c.fillStyle = '#2f6fd8'; c.fillText('POLICE', S / 2, 200); });
        reg(REG.scarf, () => knit('#16181c'));
        reg(REG.plate, () => { c.fillStyle = '#1b1e23'; c.fillRect(0, 0, S, S); noise(3000, 0.1); c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(0, 0, S, 30); });
        reg(REG.strap, () => { c.fillStyle = '#15171b'; c.fillRect(0, 0, S, S); for (let y = 0; y < S; y += 6) { c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(0, y, S, 2); } });
      } else {
        reg(REG.uni, () => { camo(['#b59b70', '#8a7a52', '#6b5a3c', '#cdb88e']); noise(3500, 0.12); weave(0.06, 3); seams('rgba(40,30,15,.55)'); });
        reg(REG.sleeve, () => { camo(['#ab926a', '#7f704b', '#5f5036']); noise(3500, 0.12); weave(0.06, 3); c.fillStyle = '#b8322a'; c.fillRect(0, 60, S, 50); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, 60, S, 3); c.fillRect(0, 107, S, 3); });   // rødt armbind
        reg(REG.pants, () => { c.fillStyle = '#6e6450'; c.fillRect(0, 0, S, S); noise(4000, 0.14); weave(0.06, 3); seams('rgba(30,24,14,.6)'); c.fillStyle = 'rgba(40,32,20,.35)'; c.fillRect(140, 70, 80, 90); c.fillStyle = 'rgba(30,24,14,.5)'; c.fillRect(140, 70, 80, 4); });   // cargolomme
        reg(REG.vest, () => molle('#4c4d35', '#5a5b3f'));
        reg(REG.pouch, () => { c.fillStyle = '#56573c'; c.fillRect(0, 0, S, S); noise(2500, 0.14); c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(0, 70, S, 5); c.fillStyle = '#3c3d29'; c.fillRect(110, 30, 36, 28); });
        reg(REG.helm, () => knit('#26231f'));
        reg(REG.patch, () => { c.fillStyle = '#b8322a'; c.fillRect(0, 0, S, S); noise(2000, 0.15); });
        reg(REG.scarf, () => { c.fillStyle = '#d9d2bf'; c.fillRect(0, 0, S, S); c.strokeStyle = '#2c2a28'; c.lineWidth = 3; for (let i = 0; i < S; i += 20) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, S); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(S, i); c.stroke(); } c.fillStyle = 'rgba(40,30,20,.3)'; for (let i = 0; i < S; i += 20) for (let j = 0; j < S; j += 20) if ((i + j) % 40 === 0) c.fillRect(i + 5, j + 5, 10, 10); noise(2000, 0.12); });   // shemagh
        reg(REG.plate, () => { c.fillStyle = '#4a4b34'; c.fillRect(0, 0, S, S); noise(3000, 0.12); });
        reg(REG.strap, () => { c.fillStyle = '#3d3e2a'; c.fillRect(0, 0, S, S); for (let y = 0; y < S; y += 6) { c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(0, y, S, 2); } });
      }
      reg(REG.skin, () => { c.fillStyle = swat ? '#c8987a' : '#b4876a'; c.fillRect(0, 0, S, S); for (let i = 0; i < 40; i++) { const x = R() * S, y = R() * S, r = 10 + R() * 30, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(150,80,60,.12)'); g.addColorStop(1, 'rgba(150,80,60,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); } noise(2000, 0.05); });
      reg(REG.glove, () => { leather(swat ? '#17191c' : '#2d2a25', 'rgba(255,255,255,.08)'); c.fillStyle = swat ? '#26292e' : '#3a362f'; for (let i = 0; i < 4; i++) c.fillRect(30 + i * 52, 30, 40, 26); });   // knoer
      reg(REG.boot, () => { leather(swat ? '#121315' : '#3a2d1f', 'rgba(0,0,0,.35)'); c.strokeStyle = swat ? '#2a2c30' : '#c8b896'; c.lineWidth = 3; for (let y = 30; y < 150; y += 18) { c.beginPath(); c.moveTo(100, y); c.lineTo(156, y + 9); c.moveTo(156, y); c.lineTo(100, y + 9); c.stroke(); } });
      reg(REG.mask, () => knit(swat ? '#141518' : '#1c1c1e'));
      reg(REG.metal, () => { c.fillStyle = '#7d8186'; c.fillRect(0, 0, S, S); noise(4000, 0.2); });
      reg(REG.sole, () => { c.fillStyle = '#0c0c0c'; c.fillRect(0, 0, S, S); for (let x = 0; x < S; x += 10) { c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(x, 0, 4, S); } });
    };
  }
  const atlasCache = {};
  function atlasMaps(side) {
    if (atlasCache[side]) return atlasCache[side];
    let map = null, pbr = null;
    if (o.canvasTexture) {
      map = o.canvasTexture(paintAtlas(side), 1024, 1024);
      map.anisotropy = 4;
      if (o.derivePBR) pbr = o.derivePBR(THREE, map, { normal: 0.55, rough: 0.86, metal: 0, rv: 0.25 });
    }
    return (atlasCache[side] = { map, pbr });
  }

  /* ================= geometri-dele (i knoglens lokale rum) ================= */
  // tilspidset lem fra (0,0,0) ned til (0,-L,0) med afrundede ender
  function limb(L, r0, r1, seg) {
    const pts = [], n = 5;
    for (let i = 0; i <= n; i++) { const a = i / n * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(1e-4, r1 * Math.sin(a)), -L - r1 * Math.cos(a) * 0.85)); }
    for (let i = 1; i <= 3; i++) { const t = i / 4; pts.push(new THREE.Vector2(r1 + (r0 - r1) * t + Math.sin(t * Math.PI) * (r0 + r1) * 0.06, -L * (1 - t))); }   // muskel-bue
    for (let i = 0; i <= n; i++) { const a = i / n * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(1e-4, r0 * Math.cos(a)), r0 * Math.sin(a) * 0.85)); }
    return new THREE.LatheGeometry(pts, seg || 16);
  }
  // lathe ud fra profil [[r, y], ...] (bund → top)
  const lathe = (prof, seg) => new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(Math.max(1e-4, p[0]), p[1])), seg || 18);
  const sph = (rx, ry, rz, ws, hs, phiLen, thStart, thLen) => { const g = new THREE.SphereGeometry(1, ws || 16, hs || 12, 0, phiLen || Math.PI * 2, thStart || 0, thLen || Math.PI); g.scale(rx, ry, rz); return g; };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  // afrundet boks (plader, lommer): hver vertex projiceres ud fra en indre kasse => runde kanter med glatte normaler
  const rbox = (w, h, d) => {
    const r = Math.min(w, h, d) * 0.32, g = new THREE.BoxGeometry(w, h, d, 3, 3, 3), p = g.attributes.position, nm = g.attributes.normal, hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ix = clamp(x, -hx, hx), iy = clamp(y, -hy, hy), iz = clamp(z, -hz, hz);
      let nx = x - ix, ny = y - iy, nz = z - iz; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      p.setXYZ(i, ix + nx * r, iy + ny * r, iz + nz * r); nm.setXYZ(i, nx, ny, nz);
    }
    return g;
  };
  const cyl = (r0, r1, h, s) => new THREE.CylinderGeometry(r1, r0, h, s || 12);
  const torus = (R, r, seg) => new THREE.TorusGeometry(R, r, 8, seg || 20);

  function buildGeometry(side) {
    const parts = [];
    // add(bone, geometri, atlas-region, transform, { blend: glat vægtning mod forælder-knoglen ved leddet, tint })
    const add = (bone, g, reg, tf, opt) => {
      if (tf) { const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tf.rx || 0, tf.ry || 0, tf.rz || 0)); m.compose(new THREE.Vector3(tf.x || 0, tf.y || 0, tf.z || 0), q, new THREE.Vector3(tf.sx || 1, tf.sy || 1, tf.sz || 1)); g.applyMatrix4(m); }
      const gg = g.index ? g.toNonIndexed() : g;
      const ly = new Float32Array(gg.attributes.position.count); for (let i = 0; i < ly.length; i++) ly[i] = gg.attributes.position.getY(i);
      gg.translate(bindWorld[BI[bone]].x, bindWorld[BI[bone]].y, bindWorld[BI[bone]].z);
      parts.push({ g: gg, reg, b: BI[bone], ly, blend: !!(opt && opt.blend), bw: (opt && opt.bw) || 0.07, tint: new THREE.Color(opt && opt.tint !== undefined ? opt.tint : 0xffffff) });
    };
    const swat = side === 'swat', B = { blend: true };
    /* ---- bækken, bælte, mave, bryst ---- */
    add('hips', sph(0.17, 0.12, 0.125, 18, 12), REG.pants, { y: -0.02 }, B);
    add('hips', lathe([[0.168, -0.02], [0.176, 0.0], [0.176, 0.045], [0.168, 0.06]], 22), REG.strap, { y: 0.02, sz: 0.76 });          // bælte
    add('hips', box(0.06, 0.05, 0.02), REG.metal, { y: 0.045, z: -0.135 });                                                         // spænde
    add('spine', lathe([[0.152, -0.03], [0.16, 0.06], [0.164, 0.14], [0.17, 0.23]], 22), REG.uni, { sz: 0.72 }, { blend: true, bw: 0.09 });
    add('chest', lathe([[0.172, -0.03], [0.192, 0.06], [0.2, 0.14], [0.192, 0.22], [0.155, 0.27], [0.075, 0.3]], 24), REG.uni, { sz: 0.66 }, { blend: true, bw: 0.09 });
    for (const s of [-1, 1]) add('chest', sph(0.08, 0.06, 0.075, 12, 8), REG.uni, { x: s * 0.165, y: 0.2 });                        // skuldre (deltamuskel)
    if (swat) {
      /* ---- SWAT: plate carrier (for/bag-plader, cummerbund, skulderstropper, MOLLE), radio, "SWAT"-patch ---- */
      add('chest', lathe([[0.188, -0.13], [0.208, -0.05], [0.214, 0.06], [0.21, 0.15], [0.192, 0.2]], 24), REG.vest, { sz: 0.75 });
      add('chest', rbox(0.27, 0.3, 0.05), REG.plate, { y: 0.04, z: -0.148, rx: 0.06 });
      add('chest', rbox(0.27, 0.3, 0.05), REG.plate, { y: 0.06, z: 0.15, rx: -0.05 });
      add('chest', box(0.22, 0.12, 0.012), REG.patch, { y: 0.1, z: 0.178, rx: -0.05, ry: Math.PI });                              // "SWAT POLICE" på ryggen
      for (const x of [-0.08, 0, 0.08]) add('chest', rbox(0.07, 0.11, 0.045), REG.pouch, { x, y: -0.06, z: -0.185 });              // magasinlommer
      add('chest', rbox(0.1, 0.07, 0.04), REG.pouch, { x: -0.06, y: 0.1, z: -0.18 });                                             // admin-lomme
      for (const s of [-1, 1]) add('chest', box(0.06, 0.03, 0.27), REG.strap, { x: s * 0.11, y: 0.235, rx: 0.0 });                // skulderstropper
      add('chest', rbox(0.06, 0.12, 0.045), REG.pouch, { x: 0.15, y: 0.12, z: 0.06 });                                            // radio
      add('chest', cyl(0.007, 0.005, 0.24, 6), REG.metal, { x: 0.15, y: 0.3, z: 0.07 });
      add('spine', lathe([[0.17, 0.02], [0.176, 0.08], [0.172, 0.13]], 22), REG.vest, { sz: 0.74 });                              // cummerbund
    } else {
      /* ---- Hijackers: brystrig med AK-magasinlommer, granatlommer, hydrationspakke, shemagh ---- */
      add('chest', lathe([[0.186, -0.12], [0.204, -0.05], [0.208, 0.04], [0.2, 0.1]], 22), REG.vest, { sz: 0.72 });
      for (const x of [-0.105, -0.035, 0.035, 0.105]) add('chest', rbox(0.062, 0.15, 0.05), REG.pouch, { x, y: -0.05, z: -0.175 });
      for (const s of [-1, 1]) add('chest', sph(0.034, 0.042, 0.034, 10, 8), REG.pouch, { x: s * 0.16, y: -0.06, z: -0.13 });     // granatlommer
      for (const s of [-1, 1]) add('chest', box(0.045, 0.025, 0.3), REG.strap, { x: s * 0.1, y: 0.18, rx: 0.15 });
      add('chest', rbox(0.2, 0.26, 0.07), REG.pouch, { y: 0.05, z: 0.165 });                                                       // rygsæk/hydrationspakke
      add('neck', torus(0.068, 0.03, 22), REG.scarf, { y: -0.01, rx: Math.PI / 2, sx: 1.05 });                                    // shemagh
      add('chest', sph(0.13, 0.05, 0.1, 18, 8, Math.PI * 2, 0, Math.PI * 0.5), REG.scarf, { y: 0.255 });
      add('hips', rbox(0.1, 0.09, 0.06), REG.pouch, { x: -0.1, y: -0.02, z: 0.12 });                                              // dump-pouch
    }
    /* ---- hals + hoved ---- */
    add('neck', cyl(0.056, 0.05, 0.12, 14), REG.mask, { y: 0.03 }, { blend: true, bw: 0.05 });
    add('head', sph(0.098, 0.118, 0.108, 20, 16), REG.mask, { y: 0.085, z: -0.004 });                                             // balaclava (begge hold)
    add('head', box(0.13, 0.035, 0.02), REG.skin, { y: 0.11, z: -0.104 });                                                         // øjenpartiet (hud)
    add('head', sph(0.03, 0.026, 0.026, 8, 6), REG.mask, { y: 0.075, z: -0.106 });                                                // næse
    for (const s of [-1, 1]) add('head', sph(0.012, 0.009, 0.006, 6, 4), REG.sole, { x: s * 0.033, y: 0.11, z: -0.115 });       // øjne
    if (swat) {
      add('head', sph(0.13, 0.118, 0.138, 22, 12, Math.PI * 2, 0, Math.PI * 0.52), REG.helm, { y: 0.112, z: 0.006 });           // high-cut hjelm
      add('head', lathe([[0.139, 0], [0.141, 0.012], [0.133, 0.022]], 22), REG.helm, { y: 0.11, sz: 1.04 });
      for (const s of [-1, 1]) add('head', box(0.012, 0.03, 0.12), REG.metal, { x: s * 0.132, y: 0.135 });                      // sideskinner
      add('head', rbox(0.05, 0.035, 0.03), REG.metal, { y: 0.19, z: -0.12 });                                                     // NVG-holder
      add('head', box(0.06, 0.004, 0.06), REG.strap, { y: 0.232, z: 0.01 });                                                     // velcro
      add('head', rbox(0.17, 0.045, 0.03), REG.sole, { y: 0.115, z: -0.115 });                                                    // briller
      add('head', box(0.21, 0.012, 0.02), REG.strap, { y: 0.115, z: -0.104 });
      for (const s of [-1, 1]) add('head', cyl(0.04, 0.04, 0.04, 14), REG.helm, { x: s * 0.108, y: 0.085, rz: Math.PI / 2 });  // høreværn
    } else {
      add('head', sph(0.108, 0.064, 0.116, 18, 8, Math.PI * 2, 0, Math.PI * 0.5), REG.helm, { y: 0.145 });                     // strikhue
      add('head', lathe([[0.112, 0], [0.115, 0.034]], 18), REG.helm, { y: 0.128 });
    }
    /* ---- arme (overarm: uniform, underarm: ærme, handske med knoer) – glat skinning ved skulder, albue og håndled ---- */
    for (const s of ['R', 'L']) {
      add('uarm' + s, limb(0.27, 0.06, 0.05, 16), REG.sleeve, null, { blend: true, bw: 0.08 });
      add('farm' + s, limb(0.25, 0.051, 0.041, 16), REG.uni, null, { blend: true, bw: 0.06 });
      if (swat) add('farm' + s, sph(0.056, 0.046, 0.06, 12, 8), REG.plate, { y: -0.01, z: 0.022 });                             // albuebeskytter
      add('farm' + s, lathe([[0.043, -0.25], [0.047, -0.2], [0.045, -0.17]], 14), REG.glove);                                    // handskekrave
      add('hand' + s, limb(0.072, 0.041, 0.033, 12), REG.glove, { sz: 0.75 }, { blend: true, bw: 0.03 });
      add('hand' + s, box(0.06, 0.018, 0.03), REG.glove, { y: -0.045, z: -0.018 });                                              // knoer
      add('hand' + s, limb(0.05, 0.016, 0.014, 8), REG.glove, { x: 0.035, y: -0.02, z: -0.02, rz: 0.6 });                        // tommelfinger
    }
    /* ---- ben (lår, skinneben m. knæbeskytter, støvler) – glat skinning ved hofte og knæ ---- */
    for (const s of ['R', 'L']) {
      const sx = s === 'R' ? 1 : -1;
      add('thigh' + s, limb(0.43, 0.094, 0.066, 18), REG.pants, null, { blend: true, bw: 0.1 });
      add('thigh' + s, rbox(0.055, 0.13, 0.13), REG.pants, { x: sx * 0.09, y: -0.2 });                                           // cargolomme
      add('shin' + s, limb(0.4, 0.064, 0.047, 16), REG.pants, null, { blend: true, bw: 0.07 });
      add('shin' + s, sph(0.07, 0.076, 0.06, 14, 8, Math.PI * 2, 0, Math.PI * 0.6), swat ? REG.plate : REG.pouch, { y: -0.02, z: -0.035, rx: -Math.PI / 2 });   // knæbeskytter
      add('shin' + s, lathe([[0.056, -0.4], [0.061, -0.3], [0.057, -0.25]], 14), REG.boot);                                      // støvleskaft
      add('foot' + s, rbox(0.105, 0.09, 0.25), REG.boot, { y: -0.012, z: -0.055 });
      add('foot' + s, sph(0.053, 0.045, 0.06, 12, 8), REG.boot, { y: -0.012, z: -0.17 });
      add('foot' + s, box(0.112, 0.025, 0.27), REG.sole, { y: -0.055, z: -0.06 });
    }
    if (swat) { add('thighR', rbox(0.05, 0.16, 0.08), REG.strap, { x: 0.1, y: -0.16, z: 0.01 }); add('thighR', box(0.03, 0.06, 0.04), REG.sole, { x: 0.1, y: -0.05, z: 0.02 }); }   // benhylster m. pistolgreb
    /* ---- sammensmelt: position, normal, uv (→ atlas-region), farve, skinIndex/Weight (2 knogler ved leddene) ---- */
    let n = 0; for (const p of parts) n += p.g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), colr = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    let k = 0;
    for (const p of parts) {
      const a = p.g.attributes, c = p.tint, ru = (p.reg % 4) / 4, rv = 1 - (Math.floor(p.reg / 4) + 1) / 4, parent = BONES[p.b][1];
      for (let i = 0; i < a.position.count; i++, k++) {
        pos[k * 3] = a.position.getX(i); pos[k * 3 + 1] = a.position.getY(i); pos[k * 3 + 2] = a.position.getZ(i);
        nor[k * 3] = a.normal.getX(i); nor[k * 3 + 1] = a.normal.getY(i); nor[k * 3 + 2] = a.normal.getZ(i);
        const u0 = a.uv ? a.uv.getX(i) : 0.5, v0 = a.uv ? a.uv.getY(i) : 0.5;
        uv[k * 2] = ru + (0.012 + clamp(u0, 0, 1) * 0.976) / 4; uv[k * 2 + 1] = rv + (0.012 + clamp(v0, 0, 1) * 0.976) / 4;
        colr[k * 3] = c.r; colr[k * 3 + 1] = c.g; colr[k * 3 + 2] = c.b;
        si[k * 4] = p.b; sw[k * 4] = 1;
        if (p.blend && parent >= 0) {                     // vertex nær leddet (lokal y ≈ 0): del vægten med forælder-knoglen
          const wc = clamp(0.5 - p.ly[i] / (p.bw * 2), 0, 1), ws = smooth(wc);
          if (ws < 0.999) { si[k * 4 + 1] = parent; sw[k * 4] = ws; sw[k * 4 + 1] = 1 - ws; }
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(colr, 3)); geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    geo.computeBoundingSphere(); geo.boundingSphere.radius = 1.4; geo.boundingSphere.center.set(0, 0.9, 0);
    return geo;
  }
  const geoCache = {};
  const boneInv = BONES.map((b, i) => new THREE.Matrix4().makeTranslation(-bindWorld[i].x, -bindWorld[i].y, -bindWorld[i].z));

  /* ================= byg en spiller ================= */
  function buildHuman(side, agentKey) {
    const geo = geoCache[side] || (geoCache[side] = buildGeometry(side));
    const bones = BONES.map(b => { const bn = new THREE.Bone(); bn.name = b[0]; bn.position.set(...b[2]); return bn; });
    BONES.forEach((b, i) => { if (b[1] >= 0) bones[b[1]].add(bones[i]); });
    const A = atlasMaps(side), mo = { vertexColors: true, map: A.map, roughness: 0.86, metalness: 0 };
    if (A.pbr) { mo.normalMap = A.pbr.normalMap; mo.roughnessMap = A.pbr.orm; mo.roughness = 1; }
    const m = o.dynMat ? o.dynMat(mo) : new THREE.MeshStandardMaterial(mo);
    const mesh = new THREE.SkinnedMesh(geo, m);
    mesh.castShadow = true; mesh.receiveShadow = true;
    const group = new THREE.Group(), body = new THREE.Group();
    group.add(body); body.add(mesh); body.add(bones[0]);
    mesh.bind(new THREE.Skeleton(bones, boneInv), new THREE.Matrix4());
    const Bn = {}; BONES.forEach((b, i) => { Bn[b[0]] = bones[i]; });
    // våben-pivot på brystet (højre side), sigte-pitch lægges her
    const gun = new THREE.Group(); gun.position.set(0.08, 0.17, -0.2); gun.rotation.order = 'YXZ'; Bn.chest.add(gun);   // YXZ: våbnet drejes tilbage mod sigteretningen før det tiltes
    const flash = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 7, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd890).multiplyScalar(3), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    flash.rotation.x = -Math.PI / 2; flash.visible = false; gun.add(flash);
    // v14: magasinet i venstre hånd under genladningen (samme probe-lys som figuren)
    const magM = o.dynMat ? o.dynMat({ color: 0x1b1c1f, roughness: 0.45, metalness: 0.7 }) : new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.45, metalness: 0.7 });
    if (magM.userData.uBake && m.userData.uBake) magM.userData.uBake = m.userData.uBake;
    const rmag = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), magM); rmag.visible = false; rmag.castShadow = true; Bn.chest.add(rmag);
    const hh = {
      side, group, body, mesh, B: Bn, gun, flash, rmag, weapon: null, wid: null, mat: m, label: null,
      init: false, px: 0, pz: 0, vx: 0, vz: 0, ph: Math.random() * 6, seed: Math.random() * 6, cr: 0, act: 0, air: 0, dead: -1, rec: 0, fl: 0, flashT: 0,
      rl: 0, rlT: -1, pin: 0, thr: 1, thrU: false, nade: 0,
      roll: (Math.random() - 0.5) * 0.7, stepCb: null, lastStep: 0, agent: null, agentKey: null
    };
    // v11.3: valgt agent (GLB-figur) – uden model (fx i tests) bruges den procedurale figur
    const at = o.agentTemplate ? o.agentTemplate(side, agentKey) : null;
    if (at && at.pending) hh.mesh.visible = false;                              // v20: figurerne hentes endnu – den gamle procedurale figur vises aldrig
    if (at && at.tpl) { try { attachAgent(hh, at.tpl, at.variant); hh.agentKey = at.key; } catch (e) { console.warn('[agent] kunne ikke bindes', e); hh.mesh.visible = true; hh.agent = null; } }
    return hh;
  }
  function setWeapon(h, id) {
    const skin = h.skins ? h.skins[id] : undefined;
    if (h.wid === id && h.wskin === skin) return;
    h.wid = id; h.wskin = skin;
    if (h.weapon) { h.gun.remove(h.weapon); h.weapon = null; }
    if (o.weaponModel && id) { const wm = o.weaponModel(id, h.mat, h.side, skin); if (wm) { h.weapon = wm; h.gun.add(wm); } }   // spillerens valgte skin
    const mz = h.weapon && h.weapon.userData.muzzle; if (mz) h.flash.position.set(mz.x, mz.y, mz.z - 0.11); else h.flash.position.set(0, 0.03, -0.4);
  }
  function setBake(h, b) { if (h.mat.userData.uBake) h.mat.userData.uBake.value.set(b[0], b[1], b[2], Math.max(0.12, b[3])); }

  /* ================= 2-leds IK (i brystets lokale rum) ================= */
  const _S = new THREE.Vector3(), _T = new THREE.Vector3(), _E = new THREE.Vector3(), _D = new THREE.Vector3(), _P = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _DN = new THREE.Vector3(0, -1, 0), _v = new THREE.Vector3();
  const LA = 0.28, LB2 = 0.26;
  function ikArm(up, fo, hand, target, pole, handQ, k) {
    _S.copy(up.position);
    _D.subVectors(target, _S); let d = _D.length(); d = clamp(d, 0.08, LA + LB2 - 0.002); _D.normalize();
    const cosA = clamp((LA * LA + d * d - LB2 * LB2) / (2 * LA * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    _P.copy(pole).addScaledVector(_D, -pole.dot(_D)).normalize();
    _E.copy(_S).addScaledVector(_D, LA * cosA).addScaledVector(_P, LA * sinA);
    _T.copy(_S).addScaledVector(_D, d);
    _v.subVectors(_E, _S).normalize(); _q.setFromUnitVectors(_DN, _v); up.quaternion.slerp(_q, k);
    _v.subVectors(_T, _E).normalize().applyQuaternion(_q2.copy(up.quaternion).invert()); _q.setFromUnitVectors(_DN, _v); fo.quaternion.slerp(_q, k);
    if (handQ) { _q.copy(up.quaternion).multiply(fo.quaternion).invert().multiply(handQ); hand.quaternion.slerp(_q, k); }
  }
  const POLE_R = new THREE.Vector3(0.6, -0.6, 0.5).normalize(), POLE_L = new THREE.Vector3(-0.7, -0.7, 0.15).normalize(), POLE_UP = new THREE.Vector3(0.7, 0.2, 0.6).normalize();
  const _gr = new THREE.Vector3(), _gl = new THREE.Vector3(), _hq = new THREE.Quaternion(), HAND_OFF = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 * 0.85, 0, 0)), _mw = new THREE.Vector3();
  const _gp = new THREE.Vector3(), _gp2 = new THREE.Vector3();
  const lerp3 = (out, a, b, t) => out.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
  // granat-kast (brystets lokale rum): hvile → spændt bagud (split trukket) → slip foran
  const NADE_REST = [0.08, 0.12, -0.24], NADE_COCK = [0.2, 0.36, 0.14], NADE_REL = [0.06, 0.2, -0.5], NADE_UND_COCK = [0.16, -0.22, 0.12], NADE_UND_REL = [0.06, -0.02, -0.46];

  // s: {x,y,z,yaw,pitch,alive,crouch,grounded,wcode,act,reload,pin}. Alle led eases => flydende overgange selv ved 20 Hz snapshots.
  function animateHuman(h, dt, t, s) {
    dt = clamp(dt || 0.016, 0.001, 0.1);
    const first = !h.init;
    if (!first) {
      let vx = (s.x - h.px) / dt, vz = (s.z - h.pz) / dt;
      if (Math.hypot(vx, vz) > 14) vx = vz = 0;
      const a = 1 - Math.exp(-10 * dt); h.vx += (vx - h.vx) * a; h.vz += (vz - h.vz) * a;
    }
    h.init = true; h.px = s.x; h.pz = s.z;
    h.group.position.set(s.x, s.y, s.z); h.group.rotation.y = s.yaw;
    if (s.wcode !== undefined) setWeapon(h, WD.WEAPON_BY_CODE[s.wcode] || null);
    const B = h.B, sp = Math.hypot(h.vx, h.vz), run = clamp(sp / 5.8, 0, 1);
    const sy = Math.sin(s.yaw), cy = Math.cos(s.yaw), vf = (-sy * h.vx - cy * h.vz), vr = (cy * h.vx - sy * h.vz);
    const fk = sp > 0.2 ? vf / sp : 1, rk = sp > 0.2 ? vr / sp : 0;
    const e = k => 1 - Math.exp(-k * dt);
    const wdef = WD.WEAPONS[h.wid] || null, isNade = !!(wdef && wdef.kind === 'nade');
    h.cr += ((s.crouch ? 1 : 0) - h.cr) * e(12);
    h.act += ((s.act ? 1 : 0) - h.act) * e(8);
    h.air += ((!s.grounded && s.alive ? 1 : 0) - h.air) * e(10);
    h.pin += ((s.pin && isNade ? 1 : 0) - h.pin) * e(9);
    h.nade += ((isNade ? 1 : 0) - h.nade) * e(12);
    // genladning: cyklus over våbnets reload-tid, startes når flaget tændes
    if (s.reload && wdef && wdef.kind === 'gun') { if (h.rlT < 0) h.rlT = 0; h.rlT += dt / wdef.reload; if (h.rlT > 1) h.rlT = 1; } else h.rlT = -1;
    h.rl += ((h.rlT >= 0 && h.rlT < 1 ? 1 : 0) - h.rl) * e(10);
    h.thr = Math.min(1, h.thr + dt / 0.42);
    if (s.alive) h.dead = -1; else { if (h.dead < 0) h.dead = first ? 2 : 0; h.dead += dt; }
    const prevPh = h.ph;
    h.ph += dt * (sp > 0.25 ? 2.2 + sp * 1.25 : 0);
    // fodtrin-callback (lyd) to gange pr. cyklus
    if (h.stepCb && sp > 2.2 && s.grounded && s.alive && !s.crouch && Math.floor(prevPh / Math.PI) !== Math.floor(h.ph / Math.PI)) h.stepCb(h, sp);
    const cr = h.cr, act = h.act, air = h.air, ph = h.ph, idle = Math.sin(t * 1.6 + h.seed), pitch = clamp(s.pitch || 0, -1.3, 1.3);
    const amp = (0.38 + 0.32 * run) * (1 - 0.35 * cr) * (sp > 0.25 ? 1 : 0), sw = Math.sin(ph) * amp;
    const ez = (obj, key, v, k) => { obj[key] += (v - obj[key]) * e(k || 18); };
    // ---- ben: sving i bevægelsesretningen (frem/tilbage/sidelæns), knæbøj i svingfasen, fødder flade; nedhuk-gang = kortere skridt, bøjede knæ
    const legs = [[B.thighL, B.shinL, B.footL, 1], [B.thighR, B.shinR, B.footR, -1]];
    for (const [th, sh, ft, sg] of legs) {
      const s1 = sw * sg, lift = Math.max(0, Math.sin(ph + (sg > 0 ? 0 : Math.PI) + 1.2)) * amp * 1.5;
      let hx = s1 * fk + cr * 1.15, hz = -s1 * rk * 0.6, kn = -(0.06 + lift) - cr * 1.75, fx = cr * 0.62 + lift * 0.4 - s1 * fk * 0.2;
      if (air > 0.01) { hx = hx * (1 - air) + air * (sg > 0 ? 0.6 : 0.15); kn = kn * (1 - air) + air * (sg > 0 ? -1.0 : -0.45); }
      if (act > 0.01) { hx = hx * (1 - act) + act * (sg > 0 ? 1.45 : 0.1); kn = kn * (1 - act) + act * (sg > 0 ? -1.6 : -1.75); fx = fx * (1 - act) + act * (sg > 0 ? 0.2 : 1.0); }
      ez(th.rotation, 'x', hx); ez(th.rotation, 'z', hz + sg * 0.035); ez(sh.rotation, 'x', kn); ez(ft.rotation, 'x', fx);
    }
    // ---- hofte/ryg: højde, bob, læn frem ved løb/nedhuk; sigte fordeles på ryg, bryst og nakke; kast vrider overkroppen
    const thrK = h.thr < 1 ? Math.sin(h.thr * Math.PI) : 0;
    const bob = Math.abs(Math.cos(ph)) * 0.035 * run * (sp > 0.25 ? 1 : 0);
    ez(B.hips.position, 'y', 0.98 - 0.36 * cr - 0.42 * act - bob + idle * 0.004 - air * 0.05, 16);
    ez(B.hips.position, 'z', 0.06 * cr + 0.1 * act, 12);
    ez(B.hips.rotation, 'y', Math.sin(ph) * 0.12 * run * (sp > 0.25 ? 1 : 0), 12);
    const lean = -0.1 * run * fk - 0.28 * cr - 0.35 * act;
    ez(B.spine.rotation, 'x', lean * 0.5 + pitch * 0.25 + idle * 0.012, 14); ez(B.chest.rotation, 'x', lean * 0.5 + pitch * 0.3 + h.rec * 0.08 - h.fl * 0.12 + thrK * 0.25 + idle * 0.01, 16);
    // v14: skrå skydestilling med lange våben (venstre skulder frem) – så støttehånden når forskæftet, og kolben ligger i skulderen
    const wmB = h.weapon && h.weapon.userData, longGun = !!(wmB && wmB.butt !== undefined && !wmB.pistol && !isNade);
    h.blade = (h.blade || 0) + ((longGun && s.alive ? -0.44 * (1 - act) : 0) - (h.blade || 0)) * e(10);
    ez(B.spine.rotation, 'y', -Math.sin(ph) * 0.08 * run * (sp > 0.25 ? 1 : 0) + h.pin * 0.25 - thrK * 0.45 + h.rl * 0.12 + h.blade * 0.45, 12);
    ez(B.chest.rotation, 'y', h.blade * 0.55, 12); ez(B.neck.rotation, 'y', -h.blade * 0.7, 12);
    ez(B.neck.rotation, 'x', pitch * 0.15 - lean * 0.6, 14); ez(B.head.rotation, 'x', pitch * 0.15 - h.fl * 0.25 + h.rl * 0.25, 14);
    ez(B.head.rotation, 'y', -h.pin * 0.2 + thrK * 0.3, 12);
    // ---- våben-pivot: sigte, rekyl, genladnings-tip; granat: hvile → spændt (split trukket) → kast
    const rlp = h.rlT >= 0 ? h.rlT : 1, tilt = h.rl * smooth(rlp / 0.15) * (1 - smooth((rlp - 0.85) / 0.15));
    if (h.nade > 0.5) {
      const under = h.thrU;
      if (h.thr < 1) { const k = smooth(h.thr / 0.85); lerp3(_gp, under ? NADE_UND_COCK : NADE_COCK, under ? NADE_UND_REL : NADE_REL, k); }
      else lerp3(_gp, NADE_REST, NADE_COCK, h.pin);
      ez(h.gun.position, 'x', _gp.x, 22); ez(h.gun.position, 'y', _gp.y, 22); ez(h.gun.position, 'z', _gp.z, 22);
      ez(h.gun.rotation, 'x', pitch * 0.6 - (B.spine.rotation.x + B.chest.rotation.x) * 0.5 + h.pin * 0.8, 18); ez(h.gun.rotation, 'z', 0, 18); ez(h.gun.rotation, 'y', 0, 18);
    } else {
      ez(h.gun.rotation, 'x', pitch - (B.spine.rotation.x + B.chest.rotation.x) + (act > 0.5 ? -1.1 : 0) + h.rec * 0.1 + tilt * 0.35, 20);
      ez(h.gun.rotation, 'z', tilt * 0.6, 14);
      // greb-position i kroppens rum: lange våben med kolben ved skulderen (butt = kolbens afstand bag grebet), pistoler med strakte arme
      const psi = B.spine.rotation.y + B.chest.rotation.y, wu = h.weapon && h.weapon.userData;
      const bx = longGun ? 0.1 : 0.06, bz = (longGun ? -(Math.min(0.42, wu.butt) + 0.03) : wu && wu.pistol ? -0.34 : -0.2) + h.rec * 0.05 + act * 0.05 + tilt * 0.06, by = (longGun ? 0.16 : 0.17) - act * 0.08 - tilt * 0.04;
      const cp = Math.cos(psi), sp2 = Math.sin(psi);
      ez(h.gun.rotation, 'y', -psi, 20);
      ez(h.gun.position, 'x', bx * cp - bz * sp2 - tilt * 0.04, 20); ez(h.gun.position, 'z', bx * sp2 + bz * cp, 20); ez(h.gun.position, 'y', by, 20);
    }
    h.group.updateMatrixWorld(true);
    const alive = s.alive;
    if (alive) {
      const wm = h.weapon, sup = wm && wm.userData.support, pist = wm && wm.userData.pistol;
      _gr.set(0, 0, 0).applyMatrix4(h.gun.matrix);                         // højre hånd på greb (brystets lokale rum)
      h.rmag.visible = false;
      if (h.nade > 0.5) {                                                   // venstre arm: frem som balance/sigte mens granaten er spændt
        _gl.set(-0.2, 0.05 + h.pin * 0.12, -0.18 - h.pin * 0.2);
        _hq.copy(h.gun.quaternion).multiply(HAND_OFF);
        ikArm(B.uarmR, B.farmR, B.handR, _gr, h.pin > 0.3 || h.thr < 1 ? POLE_UP : POLE_R, _hq, e(30));
        ikArm(B.uarmL, B.farmL, B.handL, _gl, POLE_L, null, e(20));
      } else {
        if (sup) _gl.copy(sup).applyMatrix4(h.gun.matrix); else if (pist) _gl.set(-0.02, -0.02, 0.03).applyMatrix4(h.gun.matrix); else _gl.set(-0.12, -0.18, -0.12);
        if (h.rl > 0.01 && wm) {                                            // genladning: magasin ud → bæltelomme → ind → tilbage på forskæftet
          _mw.set(0, pist ? -0.12 : -0.13, pist ? 0.02 : -0.1).applyMatrix4(h.gun.matrix);
          const belt = _gp2.set(-0.12, -0.42, -0.06);
          let tgt;
          if (rlp < 0.2) tgt = _gp.copy(_gl).lerp(_mw, smooth(rlp / 0.2));
          else if (rlp < 0.42) tgt = _gp.copy(_mw).lerp(belt, smooth((rlp - 0.2) / 0.22));
          else if (rlp < 0.6) tgt = _gp.copy(belt);
          else if (rlp < 0.8) tgt = _gp.copy(belt).lerp(_mw, smooth((rlp - 0.6) / 0.2));
          else tgt = _gp.copy(_mw).lerp(_gl, smooth((rlp - 0.8) / 0.2));
          _gl.lerp(tgt, h.rl);
          const show = h.rl > 0.5 && rlp > 0.18 && rlp < 0.8;                // det gamle magasin ud til bæltet, et nyt tilbage og ind
          h.rmag.visible = show;
          if (show) { h.rmag.position.copy(_gl); h.rmag.position.y -= pist ? 0.04 : 0.06; h.rmag.quaternion.copy(h.gun.quaternion); h.rmag.scale.set(pist ? 0.026 : 0.03, pist ? 0.1 : 0.16, pist ? 0.032 : 0.06); }
        } else h.rmag.visible = false;
        _hq.copy(h.gun.quaternion).multiply(HAND_OFF);
        ikArm(B.uarmR, B.farmR, B.handR, _gr, POLE_R, _hq, e(30));
        ikArm(B.uarmL, B.farmL, B.handL, _gl, POLE_L, wm && h.rl < 0.5 ? _hq : null, e(30));
      }
    } else {
      h.rmag.visible = false;
      for (const [u, f, sgn] of [[B.uarmR, B.farmR, 1], [B.uarmL, B.farmL, -1]]) { _q.setFromEuler(new THREE.Euler(-0.6, 0, sgn * 0.5)); u.quaternion.slerp(_q, e(6)); _q.setFromEuler(new THREE.Euler(-0.4, 0, 0)); f.quaternion.slerp(_q, e(6)); }
    }
    // ---- effekter: rekyl, træffer-ryk, mundingsild
    h.rec = Math.max(0, h.rec - dt * 7); h.fl = Math.max(0, h.fl - dt * 4); h.flashT = Math.max(0, h.flashT - dt);
    h.flash.visible = h.flashT > 0 && alive && !!(h.weapon && h.weapon.userData.muzzle);
    if (h.flash.visible) { h.flash.scale.setScalar(0.8 + Math.random() * 0.5); h.flash.rotation.y = Math.random() * 6; }
    if (h.weapon) h.weapon.visible = alive && !(h.nade > 0.5 && h.thr > 0.45 && h.thr < 1);   // granaten forlader hånden midt i kastet
    // ---- død: fald bagover med knæene der giver efter
    const f = alive ? 0 : 1 - Math.pow(1 - Math.min(1, h.dead / 0.55), 2);
    h.body.rotation.x = 1.45 * f; h.body.rotation.z = h.roll * f; h.body.position.y = 0.12 * f; h.body.position.z = 0.25 * f;
    if (!alive) { ez(B.shinL.rotation, 'x', -0.5 * f, 6); ez(B.shinR.rotation, 'x', -0.2 * f, 6); ez(B.hips.position, 'y', 0.98 - 0.2 * f, 6); }
    if (h.label) h.label.visible = alive && h.labelOn !== false;
    h._alive = alive;
    if (h.agent) retarget(h);
  }
  /* ================= v11.3: agent-modeller (GLB) drevet af det procedurale skelet (retargeting) =================
     Det procedurale skelet animerer som før (alle netværkssynkroniserede tilstande); hver GLB-knogle følger sin partner:
       verdens-rotation(GLB) = rotation(proc) · korrektion · hvile(GLB)   – korrektionen drejer GLB-knoglens hvile-retning
       (T-pose) over på den procedurale hvile-retning (armene ned), så lemmerne peger samme vej.
     Fødderne er IK-mål på roden i disse rigs => de flyttes med underbenet. Til sidst sætter en 2-leds IK hænderne på våbnet. */
  // knoglenavne: Quaternius-rigs | MakeHuman/MPFB "game_engine"-rig (v19-figurerne)
  const MAP = [['hips', 'Hips|pelvis'], ['spine', 'Abdomen|spine_01'], ['chest', 'Chest|Torso|spine_03'], ['neck', 'Neck|neck_01'], ['head', 'Head|head'],
    ['uarmR', 'UpperArm.R|upperarm_r'], ['farmR', 'LowerArm.R|lowerarm_r'], ['handR', 'Wrist.R|Palm.R|hand_r'], ['uarmL', 'UpperArm.L|upperarm_l'], ['farmL', 'LowerArm.L|lowerarm_l'], ['handL', 'Wrist.L|Palm.L|hand_l'],
    ['thighR', 'UpperLeg.R|thigh_r'], ['shinR', 'LowerLeg.R|calf_r'], ['footR', 'Foot.R|foot_r'], ['thighL', 'UpperLeg.L|thigh_l'], ['shinL', 'LowerLeg.L|calf_l'], ['footL', 'Foot.L|foot_l']];
  const SEG = { spine: 'chest', chest: 'neck', neck: 'head', uarmR: 'farmR', farmR: 'handR', uarmL: 'farmL', farmL: 'handL', thighR: 'shinR', shinR: 'footR', thighL: 'shinL', shinL: 'footL' };
  const _aq = new THREE.Quaternion(), _aq2 = new THREE.Quaternion(), _aq3 = new THREE.Quaternion(), _av = new THREE.Vector3(), _av2 = new THREE.Vector3(), _am = new THREE.Matrix4();
  function attachAgent(h, tpl, variant) {
    const root = o.cloneSkinned(tpl.scene), holder = new THREE.Group();
    holder.rotation.y = tpl.yaw === undefined ? Math.PI : tpl.yaw; holder.scale.setScalar(tpl.scale); holder.add(root);
    h.body.add(holder);
    const mats = o.recolor(root, variant);
    for (const m of mats) if (m.userData.uBake && h.mat.userData.uBake) m.userData.uBake = h.mat.userData.uBake;   // samme probe-lys som resten af spilleren
    root.traverse(x => { if (x.isMesh) { x.castShadow = true; x.receiveShadow = true; x.frustumCulled = false; } });
    h.mesh.visible = false;
    h.group.updateMatrixWorld(true);
    const byName = {}; root.traverse(x => { if (x.isBone) byName[x.name] = x; });
    const bodyQi = h.body.getWorldQuaternion(new THREE.Quaternion()).invert(), bodyMi = new THREE.Matrix4().copy(h.body.matrixWorld).invert();
    const pairs = [], P = {};
    for (const [pn, gn] of MAP) { const g = gn.split('|').map(n => byName[n]).find(Boolean); if (g) { const pr = { pn, p: h.B[pn], g }; pairs.push(pr); P[pn] = pr; } }
    const wpos = (b, out) => out.setFromMatrixPosition(b.matrixWorld).applyMatrix4(bodyMi);
    for (const pr of pairs) {
      pr.rest = bodyQi.clone().multiply(pr.g.getWorldQuaternion(new THREE.Quaternion()));
      pr.corr = new THREE.Quaternion();
      const ch = SEG[pr.pn] && P[SEG[pr.pn]];
      if (ch) {                                                                       // GLB-segmentets hvile-retning -> procedural hvile-retning
        const dg = wpos(ch.g, new THREE.Vector3()).sub(wpos(pr.g, new THREE.Vector3())).normalize();
        const dp = ch.p.getWorldPosition(new THREE.Vector3()).sub(pr.p.getWorldPosition(new THREE.Vector3())).applyQuaternion(bodyQi).normalize();
        if (dg.lengthSq() > 0.5 && dp.lengthSq() > 0.5) pr.corr.setFromUnitVectors(dg, dp);
      } else if (/^hand/.test(pr.pn) && P['farm' + pr.pn.slice(4)]) pr.corr.copy(P['farm' + pr.pn.slice(4)].corr);
      const shin = /^foot/.test(pr.pn) && P['shin' + pr.pn.slice(4)];
      if (shin && pr.g.parent !== shin.g) { pr.foot = shin; pr.off = shin.g.worldToLocal(pr.g.getWorldPosition(new THREE.Vector3())); }
    }
    const hips = P.hips;
    // v14: fingre (hvis figuren har dem) – krummes om grebet i retarget()
    const fingers = { R: [], L: [] };
    for (const sd of ['R', 'L']) for (const f of ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb']) for (let j = 1; j <= 3; j++) {
      const b = byName[f + j + '.' + sd] || byName[f.toLowerCase() + '_0' + j + '_' + sd.toLowerCase()];
      if (b) fingers[sd].push({ b, rest: b.quaternion.clone(), j, thumb: f === 'Thumb', mh: !byName[f + j + '.' + sd] });
    }
    // v19: LOD – meshes med '_lod1' i navnet vises på afstand (setLod)
    const lodHi = [], lodLo = [];
    root.traverse(x => { if (x.isMesh) { let n = x, lo = false; while (n && n !== root) { if (/_lod1/.test(n.name)) lo = true; n = n.parent; } (lo ? lodLo : lodHi).push(x); } });
    for (const x of lodLo) x.visible = false;
    h.agent = { lodHi, lodLo, lodOn: false, root, holder, pairs, P, fingers, hipsRestW: hips ? hips.g.getWorldPosition(new THREE.Vector3()).applyMatrix4(bodyMi) : null, procHips0: h.B.hips.position.y, scale: tpl.scale };
  }
  function ik2(a, b, c, target) {                                                     // 2-leds IK i verdensrum (a=overarm, b=underarm, c=hånd)
    const A = a.getWorldPosition(new THREE.Vector3()), Bp = b.getWorldPosition(new THREE.Vector3()), Cp = c.getWorldPosition(new THREE.Vector3());
    const lab = A.distanceTo(Bp), lcb = Bp.distanceTo(Cp), lat = clamp(A.distanceTo(target), 0.01, lab + lcb - 0.001);
    const ac = Cp.clone().sub(A).normalize(), ab = Bp.clone().sub(A).normalize(), ba = A.clone().sub(Bp).normalize(), bc = Cp.clone().sub(Bp).normalize(), at = target.clone().sub(A).normalize();
    const ac_ab0 = Math.acos(clamp(ac.dot(ab), -1, 1)), ba_bc0 = Math.acos(clamp(ba.dot(bc), -1, 1)), ac_at0 = Math.acos(clamp(ac.dot(at), -1, 1));
    const ac_ab1 = Math.acos(clamp((lcb * lcb - lab * lab - lat * lat) / (-2 * lab * lat), -1, 1)), ba_bc1 = Math.acos(clamp((lat * lat - lab * lab - lcb * lcb) / (-2 * lab * lcb), -1, 1));
    let ax0 = new THREE.Vector3().crossVectors(ac, ab); if (ax0.lengthSq() < 1e-8) ax0.set(1, 0, 0); ax0.normalize();
    let ax1 = new THREE.Vector3().crossVectors(ac, at); if (ax1.lengthSq() < 1e-8) ax1.copy(ax0); ax1.normalize();
    const aW = a.getWorldQuaternion(new THREE.Quaternion()), bW = b.getWorldQuaternion(new THREE.Quaternion());
    const r0 = new THREE.Quaternion().setFromAxisAngle(ax0.clone().applyQuaternion(aW.clone().invert()), ac_ab1 - ac_ab0);
    const r1 = new THREE.Quaternion().setFromAxisAngle(ax0.clone().applyQuaternion(bW.clone().invert()), ba_bc1 - ba_bc0);
    const r2 = new THREE.Quaternion().setFromAxisAngle(ax1.clone().applyQuaternion(aW.clone().invert()), ac_at0);
    a.quaternion.multiply(r0).multiply(r2); b.quaternion.multiply(r1);
    a.updateMatrixWorld(true);
  }
  function setLocalFromBody(g, desiredBodyQ, bodyQ) {                                  // ønsket rotation (krops-rum) -> lokal rotation
    _aq2.copy(bodyQ).multiply(desiredBodyQ);                                            // verden
    g.parent.getWorldQuaternion(_aq3).invert();
    g.quaternion.copy(_aq3.multiply(_aq2));
  }
  function retarget(h) {
    const A = h.agent; if (!A) return;
    h.body.updateMatrixWorld(true);
    const bodyQ = h.body.getWorldQuaternion(new THREE.Quaternion()), bodyQi = bodyQ.clone().invert();
    // hofte-højde (nedhuk/død) følger det procedurale skelet
    if (A.hipsRestW && A.P.hips) {
      _av.copy(A.hipsRestW); _av.y += (h.B.hips.position.y - A.procHips0);
      _av.applyMatrix4(h.body.matrixWorld); A.P.hips.g.parent.updateWorldMatrix(true, false); A.P.hips.g.position.copy(A.P.hips.g.parent.worldToLocal(_av));
    }
    for (const pr of A.pairs) {
      _aq.copy(bodyQi).multiply(pr.p.getWorldQuaternion(_aq2)).multiply(pr.corr).multiply(pr.rest);
      setLocalFromBody(pr.g, _aq, bodyQ);
      if (pr.foot) { pr.foot.g.updateMatrixWorld(true); _av.copy(pr.off).applyMatrix4(pr.foot.g.matrixWorld); pr.g.parent.updateWorldMatrix(true, false); pr.g.position.copy(pr.g.parent.worldToLocal(_av)); }
      pr.g.updateMatrixWorld(true);
    }
    // hænderne på våbnet (procedurale hænders position), derefter håndens rotation igen
    for (const s of ['R', 'L']) {
      const u = A.P['uarm' + s], f = A.P['farm' + s], hd = A.P['hand' + s]; if (!u || !f || !hd) continue;
      ik2(u.g, f.g, hd.g, hd.p.getWorldPosition(_av2));
      _aq.copy(bodyQi).multiply(hd.p.getWorldQuaternion(_aq2)).multiply(hd.corr).multiply(hd.rest); setLocalFromBody(hd.g, _aq, bodyQ); hd.g.updateMatrixWorld(true);
    }
    // v14: fingrene lukker sig om grebet / forskæftet (åben hånd når der ikke holdes noget)
    const grip = h.weapon && h._alive && h.nade < 0.5 ? 1 : 0, FA = FINGER.axis;
    for (const sd of ['R', 'L']) for (const f of A.fingers[sd]) {
      const k = grip * (f.thumb ? FINGER.thumb[f.j - 1] : (sd === 'R' ? FINGER.r : FINGER.l)[f.j - 1]);
      const ax = f.mh ? (f.thumb ? FINGER.mhThumb : FINGER.mhAxis) : FA;                // MakeHuman-rig: egne lokale akser
      f.b.quaternion.copy(f.rest); if (k) f.b.quaternion.multiply(_aq.setFromAxisAngle(_fa.set(ax[0], ax[1], ax[2] * (!f.mh && f.thumb ? FINGER.tz : 1)), k));
    }
  }
  const _fa = new THREE.Vector3();
  const FINGER = { axis: [-1, 0, 0], r: [1.15, 1.25, 0.9], l: [0.85, 0.95, 0.7], thumb: [0.25, 0.35, 0.3], tz: 1, mhAxis: [1, 0, 0], mhThumb: [0, 0, 1] };
  if (typeof window !== 'undefined') window.__finger = FINGER;          // dev-justering
  function setLod(h, dist) {                                                          // fjern figur (> 16 m) => LOD1 (med lidt hysterese)
    const A = h.agent; if (!A || !A.lodLo.length) return;
    const lo = A.lodOn ? dist > 14 : dist > 16; if (lo === A.lodOn) return;
    A.lodOn = lo; for (const x of A.lodHi) x.visible = !lo; for (const x of A.lodLo) x.visible = lo;
  }
  function fire(h) { h.rec = 1; h.flashT = 0.05; }
  function flinch(h) { h.fl = 1; }
  function throwNade(h, under) { h.thr = 0; h.thrU = !!under; }
  return { buildHuman, animateHuman, setBake, setWeapon, setLod, fire, flinch, throwNade, TEAM, BONES };
}
