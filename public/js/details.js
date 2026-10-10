// ==========================================================================
// DETAILS (v10): mikro-detaljer + silhuetter – det spilleren organisk opdager, men som aldrig forstyrrer læsbarheden
//   • DECAL-ATLAS: 16 håndmalede motiver i ét 1024² canvas (revner, vandskjolder, rustløb, sod, olie, kridt-kryds/streger,
//     gummi-skrammer, håndsmuds, plakat, graffiti-tag, mos, fodspor, advarselsmærkat, stencil-nummer, blade) => ÉT materiale,
//     alle decals i en 32 m-celle samles i samme mesh (1 draw call pr. celle). Polygon-offset + flad-tjek => ingen z-fighting/klipning.
//   • PLACERING efter faste regler (deterministisk – samme bane ser altid ens ud, også hos alle spillere):
//     slid ved døre/stiger, kridtmærker og sod på bombesites, fodspor ved spawn, skjolder/revner i fast rytme langs murene,
//     gulv-pletter i et fast gitter (temaet vælger motiver). Kun flader der er helt plane og frie modtager decals.
//   • SKYBOX-RING: bygninger/tårne/træer UDEN FOR banens kollision (≥ 4 m fra yderste mur, aldrig over spilbart område)
//     giver kortet en levende, asymmetrisk silhuet over murkronerne – uden at granater kan ramme 'usynlige' tage.
//   • GESIMS: profileret murkrone (under 9 m) langs udendørs murløb bryder den flade, digitale toplinje.
// createDetails(L) – L = temabiblioteket fra themes.js
// ==========================================================================
export function createDetails(L) {
  const { W, P, mkTex, mat, rnd, hash2, tint, TAU, wallCard, fitWallCard, floorCard, C } = L;
  const WD = C.WD;

  /* ======================================================== decal-atlas (4×4 celler à 256 px) ======================================================== */
  const ID = { crack: 0, stain: 1, rust: 2, soot: 3, oil: 4, chalkX: 5, tally: 6, scuff: 7, hand: 8, poster: 9, tag: 10, moss: 11, steps: 12, warn: 13, num: 14, leaves: 15 };
  const atlas = mkTex((c, w, h) => {
    c.clearRect(0, 0, w, h);
    const S = w / 4, R = rnd(101);
    const cell = (i, fn) => { const x = (i % 4) * S, y = Math.floor(i / 4) * S; c.save(); c.beginPath(); c.rect(x + 2, y + 2, S - 4, S - 4); c.clip(); c.translate(x, y); fn(S); c.restore(); };
    const soft = (x, y, r, rgba0, rgba1) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba0); g.addColorStop(1, rgba1); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
    const crackPath = (x, y, a, len, wd, depth) => {
      c.lineWidth = wd; c.beginPath(); c.moveTo(x, y);
      for (let k = 0; k < len; k++) { a += (R() - 0.5) * 0.9; x += Math.cos(a) * 9; y += Math.sin(a) * 9; c.lineTo(x, y); if (depth > 0 && R() < 0.12) { c.stroke(); crackPath(x, y, a + (R() - 0.5) * 2.2, len * 0.45 | 0, wd * 0.6, depth - 1); c.beginPath(); c.moveTo(x, y); } }
      c.stroke();
    };
    cell(ID.crack, s => { c.strokeStyle = 'rgba(28,22,16,.85)'; c.lineCap = 'round'; for (let i = 0; i < 3; i++) crackPath(s / 2, s / 2, i * 2.1 + R(), 13, 2.4, 2); c.strokeStyle = 'rgba(255,245,225,.25)'; c.translate(1, 1); for (let i = 0; i < 2; i++) crackPath(s / 2, s / 2, i * 2.6 + 0.4, 9, 1, 0); });
    cell(ID.stain, s => { for (let i = 0; i < 7; i++) soft(s / 2 + (R() - 0.5) * s * 0.3, s * 0.55 + (R() - 0.5) * s * 0.3, s * (0.16 + R() * 0.16), 'rgba(70,52,30,.28)', 'rgba(70,52,30,0)'); c.strokeStyle = 'rgba(80,58,30,.35)'; c.lineWidth = 3; c.beginPath(); c.ellipse(s / 2, s * 0.55, s * 0.36, s * 0.3, 0.2, 0, TAU); c.stroke(); });
    cell(ID.rust, s => { for (let i = 0; i < 9; i++) { const x = s * (0.3 + R() * 0.4), l = s * (0.4 + R() * 0.55), g = c.createLinearGradient(0, 4, 0, l); g.addColorStop(0, 'rgba(120,58,22,.75)'); g.addColorStop(0.5, 'rgba(140,72,30,.4)'); g.addColorStop(1, 'rgba(140,72,30,0)'); c.fillStyle = g; c.fillRect(x, 4, 3 + R() * 7, l); } soft(s / 2, 10, s * 0.25, 'rgba(110,50,18,.7)', 'rgba(110,50,18,0)'); });
    cell(ID.soot, s => { for (let i = 0; i < 10; i++) soft(s / 2 + (R() - 0.5) * s * 0.25, s / 2 + (R() - 0.5) * s * 0.25, s * (0.12 + R() * 0.25), 'rgba(12,10,8,.4)', 'rgba(12,10,8,0)'); for (let i = 0; i < 26; i++) { const a = R() * TAU, r0 = s * 0.12, r1 = s * (0.3 + R() * 0.18); c.strokeStyle = 'rgba(10,8,6,.35)'; c.lineWidth = 2 + R() * 3; c.beginPath(); c.moveTo(s / 2 + Math.cos(a) * r0, s / 2 + Math.sin(a) * r0); c.lineTo(s / 2 + Math.cos(a) * r1, s / 2 + Math.sin(a) * r1); c.stroke(); } });
    cell(ID.oil, s => { for (let i = 0; i < 6; i++) soft(s / 2 + (R() - 0.5) * s * 0.3, s / 2 + (R() - 0.5) * s * 0.3, s * (0.14 + R() * 0.16), 'rgba(14,13,12,.62)', 'rgba(14,13,12,0)'); for (let i = 0; i < 8; i++) soft(s / 2 + (R() - 0.5) * s * 0.7, s / 2 + (R() - 0.5) * s * 0.7, s * 0.04 + R() * 6, 'rgba(14,13,12,.5)', 'rgba(14,13,12,0)'); });
    cell(ID.chalkX, s => { c.strokeStyle = 'rgba(245,242,232,.82)'; c.lineCap = 'round'; c.lineWidth = 7; c.beginPath(); c.moveTo(s * 0.28, s * 0.3); c.lineTo(s * 0.7, s * 0.72); c.moveTo(s * 0.72, s * 0.28); c.lineTo(s * 0.3, s * 0.7); c.stroke(); c.lineWidth = 4; c.beginPath(); c.ellipse(s / 2, s / 2, s * 0.38, s * 0.35, 0.3, 0.2, TAU - 0.4); c.stroke(); P.speckle(c, s, s, 500, 0, 40, 0.5, 2, R); });
    cell(ID.tally, s => { c.strokeStyle = 'rgba(245,242,232,.8)'; c.lineCap = 'round'; c.lineWidth = 5; for (let g = 0; g < 2; g++) { const ox = s * 0.12 + g * s * 0.42; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(ox + i * 16, s * 0.3); c.lineTo(ox + i * 16 + (R() - 0.5) * 4, s * 0.62); c.stroke(); } c.beginPath(); c.moveTo(ox - 8, s * 0.56); c.lineTo(ox + 60, s * 0.36); c.stroke(); } c.lineWidth = 4; c.beginPath(); c.moveTo(s * 0.15, s * 0.8); c.lineTo(s * 0.8, s * 0.8); c.lineTo(s * 0.7, s * 0.72); c.moveTo(s * 0.8, s * 0.8); c.lineTo(s * 0.7, s * 0.88); c.stroke(); });
    cell(ID.scuff, s => { c.lineCap = 'round'; for (let i = 0; i < 14; i++) { c.strokeStyle = `rgba(16,14,12,${0.25 + R() * 0.35})`; c.lineWidth = 2 + R() * 5; const a = R() * TAU, r = s * (0.15 + R() * 0.25); c.beginPath(); c.arc(s / 2 + (R() - 0.5) * 30, s / 2 + (R() - 0.5) * 30, r, a, a + 0.4 + R() * 0.9); c.stroke(); } });
    cell(ID.hand, s => { for (let i = 0; i < 9; i++) soft(s / 2 + (R() - 0.5) * s * 0.2, s * 0.5 + (R() - 0.5) * s * 0.45, s * (0.1 + R() * 0.12), 'rgba(30,24,18,.33)', 'rgba(30,24,18,0)'); for (let i = 0; i < 4; i++) { c.fillStyle = 'rgba(28,22,16,.3)'; c.beginPath(); c.ellipse(s * (0.4 + i * 0.07), s * 0.3, 6, 16, 0.1 * i - 0.15, 0, TAU); c.fill(); } });
    cell(ID.poster, s => {
      const x0 = s * 0.14, y0 = s * 0.08, pw = s * 0.72, ph = s * 0.84; c.beginPath(); c.moveTo(x0, y0); for (let x = x0; x <= x0 + pw; x += 12) c.lineTo(x, y0 + R() * 6); c.lineTo(x0 + pw, y0 + ph * 0.7); for (let x = x0 + pw; x >= x0; x -= 10) c.lineTo(x, y0 + ph - R() * (x < x0 + pw * 0.5 ? 40 : 8)); c.closePath();
      c.fillStyle = '#e6dcc4'; c.fill(); c.save(); c.clip(); c.fillStyle = '#b8322a'; c.fillRect(x0, y0 + 20, pw, 46); c.fillStyle = '#efe6d0'; c.font = '900 30px Arial'; c.textAlign = 'center'; c.fillText('FIESTA', s / 2, y0 + 54);
      c.fillStyle = 'rgba(40,30,20,.75)'; for (let i = 0; i < 7; i++) c.fillRect(x0 + 16, y0 + 90 + i * 16, pw - 32 - R() * 50, 6); P.blobs(c, s, s, 8, 10, 40, '120,90,50', 0.25, R); c.restore();
    });
    cell(ID.tag, s => { c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = 'rgba(30,90,170,.85)'; c.lineWidth = 11; c.beginPath(); c.moveTo(s * 0.12, s * 0.62); c.bezierCurveTo(s * 0.2, s * 0.2, s * 0.32, s * 0.75, s * 0.42, s * 0.35); c.bezierCurveTo(s * 0.5, s * 0.75, s * 0.6, s * 0.2, s * 0.66, s * 0.6); c.moveTo(s * 0.7, s * 0.3); c.bezierCurveTo(s * 0.95, s * 0.3, s * 0.95, s * 0.68, s * 0.7, s * 0.64); c.lineTo(s * 0.7, s * 0.3); c.stroke(); c.strokeStyle = 'rgba(240,240,240,.6)'; c.lineWidth = 3; c.stroke(); for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(30,90,170,.4)'; c.fillRect(s * 0.1 + R() * s * 0.85, s * 0.2 + R() * s * 0.6, 2, 2); } });
    cell(ID.moss, s => { for (let i = 0; i < 30; i++) soft(s / 2 + (R() - 0.5) * s * 0.55, s / 2 + (R() - 0.5) * s * 0.55, s * (0.05 + R() * 0.14), `rgba(${50 + R() * 40 | 0},${95 + R() * 50 | 0},${25 + R() * 20 | 0},.55)`, 'rgba(60,110,30,0)'); P.tint(c, s, s, 600, '150,170,60', 0.35, 2, R); });
    cell(ID.steps, s => { for (let i = 0; i < 5; i++) { const x = s * 0.3 + (i % 2) * s * 0.3, y = s * 0.88 - i * s * 0.19, a = (R() - 0.5) * 0.3; c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = 'rgba(40,32,22,.38)'; c.beginPath(); c.ellipse(0, -8, 10, 15, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(0, 14, 8, 8, 0, 0, TAU); c.fill(); c.restore(); } });
    cell(ID.warn, s => { c.fillStyle = '#f0c010'; c.beginPath(); c.moveTo(s / 2, s * 0.12); c.lineTo(s * 0.9, s * 0.84); c.lineTo(s * 0.1, s * 0.84); c.closePath(); c.fill(); c.strokeStyle = '#1b1b1b'; c.lineWidth = 10; c.stroke(); c.fillStyle = '#1b1b1b'; c.fillRect(s / 2 - 7, s * 0.36, 14, s * 0.26); c.beginPath(); c.arc(s / 2, s * 0.72, 8, 0, TAU); c.fill(); P.speckle(c, s, s, 300, 60, 200, 0.3, 2, R); });
    cell(ID.num, s => { c.fillStyle = 'rgba(25,25,25,.82)'; c.font = '900 140px "Arial Black", Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('07', s / 2, s / 2 + 6); c.fillStyle = 'rgba(0,0,0,0)'; c.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 3; i++) c.fillRect(s * 0.1, s * (0.36 + i * 0.12), s * 0.8, 5); c.globalCompositeOperation = 'source-over'; for (let i = 0; i < 60; i++) { c.fillStyle = 'rgba(25,25,25,.4)'; c.fillRect(R() * s, s * 0.2 + R() * s * 0.6, 2, 2); } });
    cell(ID.leaves, s => { for (let i = 0; i < 26; i++) { const x = s * 0.1 + R() * s * 0.8, y = s * 0.1 + R() * s * 0.8; c.save(); c.translate(x, y); c.rotate(R() * TAU); c.fillStyle = `rgba(${90 + R() * 80 | 0},${70 + R() * 50 | 0},${25 + R() * 20 | 0},.9)`; c.beginPath(); c.ellipse(0, 0, 6 + R() * 6, 3 + R() * 2.5, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(40,28,10,.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-8, 0); c.lineTo(8, 0); c.stroke(); c.restore(); } });
  }, 1024, { clamp: true });
  // ét decal-materiale (alpha i teksturen, skriver ikke dybde, polygon-offset mod z-fighting) + en blank 'våd' variant til pytter/olie
  const decalOpts = { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, rough: 0.9 };
  const DM = mat(atlas, decalOpts), WET = mat(atlas, Object.assign({}, decalOpts, { rough: 0.08, rv: 0 }));
  DM.userData.noShadow = true; WET.userData.noShadow = true;
  const uvOf = id => { const cx = id % 4, cy = Math.floor(id / 4), e = 0.004; return { u0: cx / 4 + e, u1: (cx + 1) / 4 - e, v0: 1 - (cy + 1) / 4 + e, v1: 1 - cy / 4 - e }; };

  // væg-decal: kun hvor fladen er helt plan og fri (fitWallCard); returnerer true hvis placeret
  function wallDecal(B, id, x, y, z, nx, nz, size, o) {
    o = o || {};
    // massiv mur (ikke gelændere/props) skal stå bag hele decalen – ellers kan den 'hænge' på et gelænder over en lav murkrone
    const hw = size * (o.aspect || 1) / 2 + 0.05, hh = size / 2 + 0.05;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) if (!C.insideSolid(x + nz * a * hw - nx * 0.15, y + b * hh, z - nx * a * hw - nz * 0.15, true)) return false;
    return fitWallCard(B, o.wet ? WET : DM, x, y, z, nx, nz, size * (o.aspect || 1), size, Object.assign({ off: 0.035, tint: o.tint || [1, 1, 1], detail: true, shadow: false, bake: o.bake, tag: 'decal' }, uvOf(id)));
  }
  // gulv-decal: alle 4 hjørner + midten skal ramme samme plane gulvhøjde, og der må ikke stå noget oven på
  function floorFlat(x, y, z, hw, hd, yaw) {
    const c = Math.cos(yaw || 0), s = Math.sin(yaw || 0);
    for (const [a, b] of [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const px = x + a * hw * c + b * hd * s, pz = z - a * hw * s + b * hd * c, f = WD.floorBelow(W, px, y + 0.3, pz, 0.6);
      if (f === null || Math.abs(f - y) > 0.012 || C.insideSolid(px, y + 0.15, pz, false)) return false;
    }
    return true;
  }
  function floorDecal(B, id, x, y, z, size, yaw, o) {
    o = o || {};
    if (!floorFlat(x, y, z, size / 2, size / 2, yaw)) return false;
    floorCard(B, o.wet ? WET : DM, x, y + 0.004, z, size, size, yaw || 0, Object.assign({ tint: o.tint || [1, 1, 1], detail: true, shadow: false, tag: 'decal' }, uvOf(id)));
    return true;
  }
  const floorAt = (x, y, z) => WD.floorBelow(W, x, y + 0.3, z, 0.8);

  /* ======================================================== regelstyret placering ======================================================== */
  // cfg: { wallSet: [ids], floorSet: [ids], floorStep, wallStep, outdoorOnly: {id: true}, indoorOnly: {...}, wet: {id: true}, tint: {id: [r,g,b]} }
  function place(ctx, cfg) {
    const { B } = ctx; let n = 0;
    const tintOf = id => (cfg.tint && cfg.tint[id]) || [1, 1, 1];
    const outdoor = (x, y, z) => WD.raycastWorld(W, x, y + 0.2, z, 0, 1, 0, 25) >= 25 - 1e-6;
    const allowed = (id, x, y, z) => !((cfg.outdoorOnly || {})[id] && !outdoor(x, y, z)) && !((cfg.indoorOnly || {})[id] && outdoor(x, y, z));
    // 1) døre: håndsmuds på begge sider ved håndtaget + gummi-skrammer på gulvet hvor døren svinger
    for (const d of W.doors) for (const s of [-1, 1]) {
      const nx = d.axis === 'x' ? 0 : s, nz = d.axis === 'x' ? s : 0, ex = d.axis === 'x' ? d.w / 2 + 0.32 : 0, ez = d.axis === 'x' ? 0 : d.w / 2 + 0.32;
      const fy = floorAt(d.x + nx * 1.1, d.y + 0.5, d.z + nz * 1.1); if (fy === null) continue;
      if (wallDecal(B, ID.hand, d.x + ex, fy + 1.05, d.z + ez, nx, nz, 0.42)) n++;
      if (floorDecal(B, ID.scuff, d.x + nx * 0.9, fy, d.z + nz * 0.9, 1.3, hash2(d.x, d.z + s) * TAU, { tint: [1, 1, 1] })) n++;
    }
    // døråbninger uden dørblad (overligger-bokse i 2–4 m højde): håndsmuds på begge karme
    for (const b of W.boxes) {
      if (b.kind !== 'wall' || b.y0 < 2 || b.y0 > 4.2 || b.y1 < 8.9 || Math.min(b.x1 - b.x0, b.z1 - b.z0) > 2.1 || Math.max(b.x1 - b.x0, b.z1 - b.z0) > 6.1) continue;
      const along = (b.x1 - b.x0) >= (b.z1 - b.z0), Lh = (along ? b.x1 - b.x0 : b.z1 - b.z0) / 2, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, D = (along ? b.z1 - b.z0 : b.x1 - b.x0) / 2;
      for (const s of [-1, 1]) for (const f of [-1, 1]) {
        const fy = floorAt(along ? cx : cx + f * (D + 0.6), b.y0 - 1, along ? cz + f * (D + 0.6) : cz); if (fy === null) continue;
        const x = along ? cx + s * (Lh + 0.3) : cx + f * (D + 0.02), z = along ? cz + f * (D + 0.02) : cz + s * (Lh + 0.3);
        if (hash2(x * 3, z * 3) < 0.6 && wallDecal(B, ID.hand, x, fy + 1.1, z, along ? 0 : f, along ? f : 0, 0.4)) n++;
      }
    }
    // 2) stiger: slid på væggen bag trinene og skrammer på gulvet ved foden
    for (const l of W.ladders) {
      const cx = (l.x0 + l.x1) / 2, cz = (l.z0 + l.z1) / 2, wx = l.nx > 0 ? l.x0 : l.nx < 0 ? l.x1 : cx, wz = l.nz > 0 ? l.z0 : l.nz < 0 ? l.z1 : cz;
      if (wallDecal(B, ID.scuff, wx, l.y0 + 0.75, wz, l.nx, l.nz, 0.9)) n++;
      if (floorDecal(B, ID.scuff, cx + l.nx * 0.7, l.y0, cz + l.nz * 0.7, 1.1, 0.3)) n++;
    }
    // 3) bombesites: kridt-kryds (planteplads), tællestreger på nærmeste mur, sod og skrammer fra tidligere runder
    for (const lb of W.labels) if (lb.kind === 'site') {
      const R = rnd(Math.floor(Math.abs(lb.x * 31 + lb.z * 17)) + 3);
      for (let i = 0, k = 0; i < 14 && k < 2; i++) { const x = lb.x + (R() - 0.5) * 7, z = lb.z + (R() - 0.5) * 7, fy = floorAt(x, lb.y + 0.5, z); if (fy !== null && floorDecal(B, ID.chalkX, x, fy, z, 1.1, R() * TAU)) { k++; n++; } }
      for (let i = 0, k = 0; i < 14 && k < 2; i++) { const x = lb.x + (R() - 0.5) * 9, z = lb.z + (R() - 0.5) * 9, fy = floorAt(x, lb.y + 0.5, z); if (fy !== null && floorDecal(B, ID.soot, x, fy, z, 2.4, R() * TAU)) { k++; n++; } }
      for (let i = 0, k = 0; i < 10 && k < 3; i++) { const x = lb.x + (R() - 0.5) * 8, z = lb.z + (R() - 0.5) * 8, fy = floorAt(x, lb.y + 0.5, z); if (fy !== null && floorDecal(B, ID.scuff, x, fy, z, 1.4, R() * TAU)) { k++; n++; } }
      const wl = L.nearestWall(lb.x, lb.y + 1.4, lb.z, 10); if (wl && wallDecal(B, ID.tally, wl.x, lb.y + 1.35, wl.z, wl.nx, wl.nz, 0.7, { aspect: 1.3 })) n++;
    }
    // 4) spawn: fodspor fra de første sekunder i hver runde
    for (const lb of W.labels) if (/SPAWN/.test(lb.text)) {
      const R = rnd(Math.floor(Math.abs(lb.x * 13 + lb.z * 7)) + 5);
      for (let i = 0, k = 0; i < 16 && k < 4; i++) { const x = lb.x + (R() - 0.5) * 10, z = lb.z + (R() - 0.5) * 10, fy = floorAt(x, lb.y + 0.5, z); if (fy !== null && floorDecal(B, ID.steps, x, fy, z, 1.2, R() * TAU)) { k++; n++; } }
    }
    // 5) mure: fast rytme (hver ~wallStep m) – motivet vælges deterministisk ud fra positionen
    if (cfg.wallSet && cfg.wallSet.length) for (const r of L.wallRuns(3)) {
      const len = r.a1 - r.a0, cnt = Math.floor(len / (cfg.wallStep || 7));
      for (let i = 0; i < cnt; i++) {
        const a = r.a0 + (i + 0.3 + hash2(r.fixed, i) * 0.4) * len / Math.max(1, cnt), x = r.alongX ? a : r.fixed, z = r.alongX ? r.fixed : a;
        const id = cfg.wallSet[Math.floor(hash2(x * 1.7, z * 2.3) * cfg.wallSet.length) % cfg.wallSet.length];
        const low = id === ID.stain || id === ID.moss || id === ID.scuff, high = id === ID.rust || id === ID.crack && hash2(z, x) > 0.5;
        const y = r.L + (low ? 0.55 : high ? 3.0 + hash2(x, z) * 2 : 1.4 + hash2(z, x) * 0.6), size = id === ID.poster ? 1.0 : id === ID.rust ? 1.4 : id === ID.tag ? 1.3 : id === ID.num ? 0.7 : 1.1;
        if (!allowed(id, x + r.nx * 0.5, r.L, z + r.nz * 0.5)) continue;
        if (wallDecal(B, id, x, y, z, r.nx, r.nz, size, { tint: tintOf(id), aspect: id === ID.poster ? 0.8 : 1 })) n++;
      }
    }
    // 6) gulve: fast gitter (floorStep m) med deterministisk udvalg – kun plane, frie flader
    if (cfg.floorSet && cfg.floorSet.length) {
      const st = cfg.floorStep || 6, b = W.bounds;
      for (let x = b.x0 + st / 2; x < b.x1; x += st) for (let z = b.z0 + st / 2; z < b.z1; z += st) {
        const h = hash2(x * 0.37, z * 0.71); if (h > (cfg.floorDensity || 0.45)) continue;
        const px = x + (hash2(z, x) - 0.5) * st * 0.6, pz = z + (hash2(x + 3, z) - 0.5) * st * 0.6;
        for (const top of [8.4, 4.4, 0.5]) {                                           // flere etager (Nuke): prøv fra oven – aldrig murkroner (9 m)
          const fy = WD.floorBelow(W, px, top, pz, 14); if (fy === null || fy > 8.3 || C.insideSolid(px, fy + 0.5, pz, false) || C.insideSolid(px, fy + 1.6, pz, false)) continue;
          const id = cfg.floorSet[Math.floor(hash2(px, pz * 1.3) * cfg.floorSet.length) % cfg.floorSet.length];
          if (!allowed(id, px, fy, pz)) continue;
          const wet = (cfg.wet || {})[id] || (cfg.wetBelow !== undefined && fy < cfg.wetBelow && id === ID.oil);
          if (floorDecal(B, id, px, fy, pz, id === ID.oil ? 1.6 + h * 1.4 : 1.2 + h, hash2(px, pz) * TAU, { tint: wet && fy < (cfg.wetBelow || -1e9) ? [0.55, 0.62, 0.7] : tintOf(id), wet })) n++;
          break;
        }
      }
    }
    return n;
  }

  /* ======================================================== gesims langs murkronen (under 9 m) ======================================================== */
  // profileret krone: fremspringende bånd + tyndere bånd under. Kun på udendørs murløb der går helt op til 9 m.
  function cornice(B, m, t, o) {
    o = o || {}; const y = o.y || 8.62, out = o.out || 0.16, hh = o.h || 0.24; let n = 0;
    for (const r of L.wallRuns(2)) {
      for (let a = r.a0; a < r.a1 - 0.01; a += 2) {
        const a1 = Math.min(r.a1, a + 2), am = (a + a1) / 2, x = r.alongX ? am : r.fixed, z = r.alongX ? r.fixed : am;
        if (!C.insideSolid(x - r.nx * 0.2, 8.95, z - r.nz * 0.2, false) || C.insideSolid(x + r.nx * 0.4, y, z + r.nz * 0.4, false)) continue;   // muren skal nå 9 m, og luften foran skal være fri
        if (WD.raycastWorld(W, x + r.nx * 0.3, y, z + r.nz * 0.3, 0, 1, 0, 20) < 20) continue;                                                     // kun under åben himmel
        const L2 = a1 - a, sx = r.alongX ? L2 : out, sz = r.alongX ? out : L2;
        B.box(m, x + r.nx * out / 2, y + hh / 2, z + r.nz * out / 2, sx, hh, sz, { tint: t, uvs: 1, noTop: true, wear: [-1e3, 9, 0.4], tag: 'cornice' });
        B.box(m, x + r.nx * out * 0.3, y - 0.12, z + r.nz * out * 0.3, r.alongX ? L2 : out * 0.6, 0.08, r.alongX ? out * 0.6 : L2, { tint: t.map(v => v * 0.92), uvs: 1, noTop: true, wear: [-1e3, 9, 0.4], tag: 'cornice' });
        n++;
      }
    }
    return n;
  }

  /* ======================================================== skybox-ring (uden for banen) ======================================================== */
  // banens faktiske yderkant (fra alle kollisionsbokse) – skybox-elementer holdes ≥ gap m uden for
  function extents() {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const b of W.boxes) { if (b.x0 < x0) x0 = b.x0; if (b.x1 > x1) x1 = b.x1; if (b.z0 < z0) z0 = b.z0; if (b.z1 > z1) z1 = b.z1; }
    for (const c of W.cyls) { x0 = Math.min(x0, c.x - c.r); x1 = Math.max(x1, c.x + c.r); z0 = Math.min(z0, c.z - c.r); z1 = Math.max(z1, c.z + c.r); }
    return { x0, x1, z0, z1 };
  }
  // pladser rundt om banen: { x, z (centrum), nx, nz (ind mod banen), alongX, w (langs kanten), d (dybde ud), ring }
  function ringSlots(seed, o) {
    const e = extents(), gap = o.gap || 4, R = rnd(seed), out = [];
    for (const ring of [0, 1]) {
      const g = gap + ring * (o.ring2 || 16);
      const sides = [[e.x0 - g, e.z1 + g, 1, 0, 0, -1], [e.x0 - g, e.z0 - g, 1, 0, 0, 1], [e.x0 - g, e.z0 - g, 0, 1, 1, 0], [e.x1 + g, e.z0 - g, 0, 1, -1, 0]];   // [startx, startz, dirx, dirz, nx, nz]
      for (const [sx, sz, dx, dz, nx, nz] of sides) {
        const Ls = dx ? e.x1 - e.x0 + 2 * g : e.z1 - e.z0 + 2 * g;
        for (let a = 0; a < Ls;) {
          const w = (o.wMin || 6) + R() * ((o.wMax || 11) - (o.wMin || 6)), d = (o.dMin || 6) + R() * ((o.dMax || 10) - (o.dMin || 6));
          if (a + w > Ls) break;
          const c = a + w / 2;
          out.push({ x: sx + dx * c - nx * d / 2, z: sz + dz * c - nz * d / 2, nx, nz, alongX: !!dx, w, d, ring, r: R() });
          a += w + (o.gapMin || 0.6) + R() * (o.gapVar || 3);
        }
      }
    }
    return out;
  }
  // valmtag (hip) / sadeltag (gable) med verdens-UV (u langs tagfoden, v op ad hældningen) => tagsten forvrænges aldrig
  function roof(B, m, cx, cz, w, d, y, h, over, o) {
    o = o || {}; const t = o.tint || [1, 1, 1], tu = o.tu || 1.6, tv = o.tv || 1.6, longX = w >= d, gable = !!o.gable;
    const hw = w / 2 + over, hd = d / 2 + over, ey = y - over * (h / Math.max(0.1, (longX ? d : w) / 2));   // tagfoden sænkes med udhænget (samme hældning)
    const rl = gable ? (longX ? hw : hd) : Math.max(0, (longX ? w - d : d - w) / 2);                        // halv ridselængde
    const P = (a, b, yy) => longX ? [cx + a, yy, cz + b] : [cx + b, yy, cz + a];                              // a = langs ridsen, b = på tværs
    const A = longX ? hw : hd, Bh = longX ? hd : hw, ry = y + h, sl = Math.hypot(h + (y - ey), Bh);
    const pts = [], uvs = [], bk = [0, 0, 0, 0.92], push = (p, uv) => { pts.push(p); uvs.push(uv); };
    // P() bytter akserne når ridsen går langs z => spejling: vend trekanternes vinding, så forsiden stadig vender udad
    const wind = (ps, us) => { if (!longX) for (let i = 0; i < ps.length; i += 3) { [ps[i + 1], ps[i + 2]] = [ps[i + 2], ps[i + 1]]; [us[i + 1], us[i + 2]] = [us[i + 2], us[i + 1]]; } return [ps, us]; };
    // lange flader (to trapezer / rektangler ved sadeltag)
    for (const s of [1, -1]) {
      const e0 = P(-A * s, Bh * s, ey), e1 = P(A * s, Bh * s, ey), r1 = P(rl * s, 0, ry), r0 = P(-rl * s, 0, ry);
      const ua = v => v / tu;
      const q = [[e0, [ua(-A * s), 0]], [e1, [ua(A * s), 0]], [r1, [ua(rl * s), sl / tv]], [r0, [ua(-rl * s), sl / tv]]];
      for (const k of [0, 1, 2, 0, 2, 3]) push(q[k][0], q[k][1]);
    }
    // gavle-ender: trekant i murmaterialet (sadeltag) eller tagflade (valm)
    for (const s of [1, -1]) {
      const e0 = P(A * s, Bh * s, ey), e1 = P(A * s, -Bh * s, ey), r = P(rl * s, 0, ry);
      if (gable) { const [gp, gu] = wind([P(A * s - 0.02 * s, Bh * s, ey), P(A * s - 0.02 * s, -Bh * s, ey), P(rl * s - 0.02 * s, 0, ry)], [[0, 0], [Bh, 0], [Bh / 2, (ry - ey) / 2]]); B.tris(o.gableMat || m, gp, gu, { tint: o.gableTint || t, bake: bk, shadow: false, wear: [-1e3, -1e3, 0] }); continue; }
      const sl2 = Math.hypot(h + (y - ey), A - rl);
      push(e0, [Bh * s / tu, 0]); push(e1, [-Bh * s / tu, 0]); push(r, [0, sl2 / tv]);
    }
    wind(pts, uvs); B.tris(m, pts, uvs, { tint: t, bake: bk, shadow: false, wear: [-1e3, -1e3, 0] });
    // tagfodens underside (udhænget set nedefra) – mørkere
    if (over > 0.05) B.box(o.underMat || m, cx, ey - 0.03, cz, w + over * 2, 0.06, d + over * 2, { tint: t.map(v => v * 0.5), bake: [0, 0, 0, 0.5], shadow: false, noTop: true, wear: [-1e3, -1e3, 0] });
  }

  return { ID, DM, WET, uvOf, wallDecal, floorDecal, place, cornice, extents, ringSlots, roof };
}
