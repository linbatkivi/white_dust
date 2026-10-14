// ==========================================================================
// TEMA: de_nuke – atomkraftværk. Kold dagslys-yard, lysstofrør og højloftslamper inde, tofarvede malede mure
// (petroleumsblå sokkel / råhvid), beton, gitterriste, gul/sort faremarkering, reaktortanke og glasindhegnet B-reaktor.
// Alle lamper, skilte, rør og markeringer er placeret eksplicit efter banens rum (se shared/wd.js → mapNuke).
// ==========================================================================
export function nukeTheme(L) {
  const { THREE, W, P, mkTex, mat, unlit, rnd, hash2, tint, mix, T, TAU, orient, wallCard, floorCard, commonMats, railing, ladderModel, lampFixture, doorLeaf, C } = L;
  const LB = (W.data && W.data.levels.B) || -9.3, LU = (W.data && W.data.levels.roofT) || 5.83;   // v12.1: niveauer fra den STL-genererede bane
  const M = commonMats();
  const R0 = rnd(77);

  /* ---------------- teksturer ---------------- */
  const concFloor = mkTex((c, w, h) => {              // indendørs glittet beton med fuger (2 m)
    const R = rnd(31); c.fillStyle = '#a7a8a5'; c.fillRect(0, 0, w, h);
    P.blobs(c, w, h, 30, 40, 150, '80,82,82', 0.16, R); P.blobs(c, w, h, 20, 30, 100, '205,206,202', 0.14, R);
    c.fillStyle = 'rgba(40,42,42,.55)'; c.fillRect(0, 0, w, 3); c.fillRect(0, 0, 3, h); c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(0, 3, w, 1); c.fillRect(3, 0, 1, h);
    P.speckle(c, w, h, 6000, 60, 210, 0.22, 2, R); P.cracks(c, w, h, 3, 'rgba(25,25,25,.35)', 9, R); P.blobs(c, w, h, 6, 16, 44, '30,26,20', 0.22, R);
    for (let i = 0; i < 5; i++) { c.strokeStyle = 'rgba(30,30,30,.12)'; c.lineWidth = 9; c.beginPath(); const x = R() * w, y = R() * h; c.moveTo(x, y); c.quadraticCurveTo(x + 60, y + 30, x + 150, y + 10 + R() * 40); c.stroke(); }
  }, 512);
  const yard = mkTex((c, w, h) => {                   // udendørs betonplader (4 m), slidt, oliepletter
    const R = rnd(35); c.fillStyle = '#9d9b94'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const v = 150 + R() * 22 | 0; c.fillStyle = `rgb(${v},${v - 2},${v - 8})`; c.fillRect(i * w / 2 + 4, j * h / 2 + 4, w / 2 - 8, h / 2 - 8); }
    c.fillStyle = 'rgba(30,30,28,.6)'; for (const p of [0, w / 2]) { c.fillRect(p, 0, 4, h); c.fillRect(0, p, w, 4); }
    P.blobs(c, w, h, 40, 30, 120, '90,88,80', 0.16, R); P.speckle(c, w, h, 7000, 50, 220, 0.25, 2, R); P.cracks(c, w, h, 9, 'rgba(25,25,22,.45)', 10, R);
    P.blobs(c, w, h, 7, 20, 60, '25,22,18', 0.3, R); P.tint(c, w, h, 400, '120,110,90', 0.4, 2, R);
  }, 512);
  const epoxy = mkTex((c, w, h) => {                  // B-etagens forseglede gulv (grønlig grå epoxy) med fuger
    const R = rnd(39); c.fillStyle = '#8f9a94'; c.fillRect(0, 0, w, h);
    P.blobs(c, w, h, 26, 30, 120, '70,80,76', 0.16, R); P.blobs(c, w, h, 16, 20, 80, '190,200,196', 0.12, R);
    c.fillStyle = 'rgba(30,36,34,.5)'; c.fillRect(0, 0, w, 2); c.fillRect(0, 0, 2, h);
    P.speckle(c, w, h, 4000, 60, 210, 0.18, 2, R); P.streaks(c, w, h, 8, '40,44,40', 0.14, 60, 200, 14, R);
  }, 512);
  const block = mkTex((c, w, h) => {                  // malet blokmur (8 skifter pr. 2 m) – indendørs
    const R = rnd(45); c.fillStyle = '#e4e2dc'; c.fillRect(0, 0, w, h);
    const rows = 8, rh = h / rows;
    for (let r = 0; r < rows; r++) for (let b = -1; b < 3; b++) { const x = b * w / 2 + (r % 2 ? w / 4 : 0), v = 228 + R() * 14 | 0; c.fillStyle = `rgb(${v},${v - 1},${v - 5})`; c.fillRect(x + 3, r * rh + 3, w / 2 - 6, rh - 6); P.bevel(c, x + 3, r * rh + 3, w / 2 - 6, rh - 6, 'rgba(255,255,255,.35)', 'rgba(0,0,0,.18)'); }
    P.blobs(c, w, h, 16, 30, 100, '120,118,110', 0.08, R); P.speckle(c, w, h, 2500, 120, 255, 0.14, 2, R); P.streaks(c, w, h, 10, '90,80,70', 0.08, 80, 260, 10, R);
  }, 512);
  const facade = mkTex((c, w, h) => {                 // præfab-betonelementer med lodrette fuger, rustløb – udendørs facader
    const R = rnd(47); c.fillStyle = '#c9c6bd'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2; i++) { const v = 196 + R() * 18 | 0; c.fillStyle = `rgb(${v},${v - 2},${v - 9})`; c.fillRect(i * w / 2 + 5, 0, w / 2 - 10, h); }
    c.fillStyle = 'rgba(40,40,36,.5)'; c.fillRect(0, 0, 5, h); c.fillRect(w / 2 - 2, 0, 5, h); c.fillRect(0, h - 4, w, 4);
    P.blobs(c, w, h, 24, 30, 110, '110,105,95', 0.12, R); P.streaks(c, w, h, 22, '110,70,35', 0.22, 80, 300, 7, R); P.streaks(c, w, h, 16, '60,60,55', 0.16, 100, 300, 12, R);
    P.speckle(c, w, h, 3500, 70, 240, 0.2, 2, R);
    for (const x of [w / 4, 3 * w / 4]) for (const y of [h * 0.2, h * 0.8]) { c.fillStyle = 'rgba(40,40,40,.4)'; c.beginPath(); c.arc(x, y, 4, 0, TAU); c.fill(); }
  }, 512);
  const ceil = mkTex((c, w, h) => {                   // betonloft med forskallingsbrædder
    const R = rnd(49); c.fillStyle = '#b5b3ad'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { const v = 170 + R() * 26 | 0; c.fillStyle = `rgb(${v},${v - 1},${v - 5})`; c.fillRect(0, i * h / 8 + 1, w, h / 8 - 2); }
    P.blobs(c, w, h, 20, 30, 100, '80,78,72', 0.14, R); P.speckle(c, w, h, 3000, 60, 230, 0.2, 2, R);
  }, 512);
  const gravel = mkTex((c, w, h) => {                 // tagpap med grus (T Roof, Mini)
    const R = rnd(53); c.fillStyle = '#6c6a66'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = 70 + R() * 120 | 0; c.fillStyle = `rgba(${v},${v - 3},${v - 8},.8)`; c.fillRect(R() * w, R() * h, 1 + R() * 3, 1 + R() * 3); }
    P.blobs(c, w, h, 16, 30, 90, '40,38,36', 0.2, R); c.fillStyle = 'rgba(20,20,20,.35)'; c.fillRect(0, 0, w, 3);
  }, 512);
  const duct = mkTex((c, w, h) => {                   // galvaniserede kanalplader
    const R = rnd(57); c.fillStyle = '#8d9396'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { const g = c.createLinearGradient(0, i * h / 4, 0, (i + 1) * h / 4); g.addColorStop(0, '#a6adb1'); g.addColorStop(0.5, '#7b8286'); g.addColorStop(1, '#949b9f'); c.fillStyle = g; c.fillRect(0, i * h / 4 + 2, w, h / 4 - 4); }
    c.fillStyle = 'rgba(20,22,24,.6)'; for (let i = 0; i <= 4; i++) c.fillRect(0, i * h / 4 - 2, w, 4);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 8; k++) { c.fillStyle = 'rgba(30,30,30,.6)'; c.beginPath(); c.arc(k * w / 8 + 16, i * h / 4 + 8, 2.5, 0, TAU); c.fill(); }
    P.blobs(c, w, h, 18, 20, 70, '60,62,64', 0.2, R); P.speckle(c, w, h, 2500, 60, 220, 0.2, 2, R); P.streaks(c, w, h, 8, '90,60,30', 0.2, 30, 120, 5, R);
  }, 256);
  const windowTex = mkTex((c, w, h) => {              // facadevindue (mørkt glas, rammer) – uigennemsigtigt
    c.fillStyle = '#3c4246'; c.fillRect(0, 0, w, h); const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#5b6a74'); g.addColorStop(0.5, '#2a3237'); g.addColorStop(1, '#46525a'); c.fillStyle = g; c.fillRect(10, 10, w - 20, h - 20);
    c.fillStyle = '#9aa3a6'; c.fillRect(0, 0, w, 10); c.fillRect(0, h - 10, w, 10); c.fillRect(0, 0, 10, h); c.fillRect(w - 10, 0, 10, h); c.fillRect(w / 2 - 4, 0, 8, h); c.fillRect(0, h * 0.45, w, 6);
    c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.moveTo(20, 20); c.lineTo(80, 20); c.lineTo(20, 110); c.fill();
  }, 256, { clamp: true });
  const radSign = mkTex((c, w, h) => {                // strålingsskilt (trefoil) – gult
    c.fillStyle = '#f0c010'; c.fillRect(0, 0, w, h); c.strokeStyle = '#1b1b1b'; c.lineWidth = 10; c.strokeRect(8, 8, w - 16, h - 16);
    c.fillStyle = '#1b1b1b'; const cx = w / 2, cy = h / 2; c.beginPath(); c.arc(cx, cy, 16, 0, TAU); c.fill();
    for (let i = 0; i < 3; i++) { const a = i * TAU / 3 - Math.PI / 2; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, 82, a - 0.52, a + 0.52); c.closePath(); c.fill(); }
    c.fillStyle = '#f0c010'; c.beginPath(); c.arc(cx, cy, 28, 0, TAU); c.fill(); c.fillStyle = '#1b1b1b'; c.beginPath(); c.arc(cx, cy, 16, 0, TAU); c.fill();
  }, 256, { clamp: true });
  const stencil = (txt, color) => mat(T.text(txt, null, color || '#f2c200', 512, 160, null, 'Arial Black, Arial'), { alphaTest: 0.5 });
  const signMat = (txt, bg, fg) => mat(T.text(txt, bg, fg, 512, 128, fg), {});

  Object.assign(M, {
    floorIn: mat(concFloor, { bump: 0.35, rough: 0.78 }), floorOut: mat(yard, { bump: 0.6, rough: 0.93 }), floorB: mat(epoxy, { bump: 0.25, rough: 0.32, rv: 0.1 }), wallIn: mat(block, { bump: 0.7, rough: 0.92 }), facade: mat(facade, { bump: 0.6, rough: 0.9 }),
    ceil: mat(ceil, { bump: 0.4, rough: 0.9 }), roof: mat(gravel, { bump: 1.0, rough: 0.97 }), grate: mat(T.grate(), { bump: 0.8, rough: 0.45, metal: 0.8 }), diamond: mat(T.diamond(), { bump: 0.9, rough: 0.36, metal: 0.85 }), duct: mat(duct, { bump: 0.5, rough: 0.4, metal: 0.8 }),
    win: mat(windowTex, { rough: 0.12, metal: 0.4 }), rad: mat(radSign, { rough: 0.5, metal: 0.2 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfe2f0, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide, roughness: 0.05, metalness: 0.1 })
  });

  /* ---------------- v11: fotoscannede CC0-materialer (Poly Haven) når de er indlæst – ellers de procedurale ovenfor ---------------- */
  const AS = C.assets && C.assets.tex;
  if (AS) {
    const S = (n, o) => C.pbrMat(AS[n], o);
    Object.assign(M, {
      floorIn: S('concrete_floor_worn_001'), floorB: S('concrete_floor_worn_001', { rough: 0.6 }), floorOut: S('asphalt_02'),
      wallIn: S('concrete_wall_008', { normal: 1.6 }), facade: S('concrete_slab_wall'), ceil: S('concrete_wall_008', { ao: 0.7 }), conc: S('concrete_wall_008'),
      grate: S('metal_grate_rusty', { metalHint: 0.7 }), diamond: S('metal_plate', { metalHint: 0.7 }), corr: S('corrugated_iron_02', { metalHint: 0.6 }),
      contSide: S('container_side', { metalHint: 0.5 }), metal: S('blue_metal_plate', { metalHint: 0.6 }), rusty: S('rusty_metal_02', { metalHint: 0.6 })
    });
  }

  /* ---------------- farver ---------------- */
  const CLAD = C.assets && C.assets.tex ? [2.15, 2.2, 2.22] : tint(0xdfe2e2), WALL_UP = C.assets && C.assets.tex ? [1.32, 1.34, 1.33] : tint(0xe8e8e4), WALL_LO = tint(0x3f5c6a), WALL_LO_B = tint(0x5c6b4f), FACADE = tint(0xd9d6cd), CEIL = tint(0xc9c7c0), STEEL = tint(0x7c858c), YEL = tint(0xe6b83a);
  const outdoor = (x, y, z) => C.WD.raycastWorld(W, x, y + 0.2, z, 0, 1, 0, 30) >= 30 - 1e-6;
  const floorUnder = (x, y, z) => { const g = L.buildingFloor(x, y, z, 0.13); return g === -Infinity ? y : g; };   // v14: props tæller ikke som gulv
  const surfKinds = { floor: 1, wall: 1, ceil: 1, slab: 1, roofslab: 1, grate: 1, stone: 1, vent: 1, steel: 1, steelstairs: 1 };

  function surf(kind, face, b, x, y, z, n, c0, c1) {
    // v14: lodrette celler testes ved deres bund (en høj celle der rager op over et loft er stadig en indendørs væg)
    const yq = face !== 'top' && face !== 'bottom' && c0 !== undefined ? Math.min(y, c0 + 0.3) : y;
    const out = outdoor(x + n[0] * 0.3, yq + (face === 'bottom' ? -0.5 : 0.1), z + n[2] * 0.3);
    if (kind === 'vent') return { m: M.duct, t: tint(0x8a9094), uvs: 1.5, trim: false };
    if (kind === 'steel') return { m: M.steel, t: YEL, uvs: 1, trim: false };
    if (kind === 'steelstairs') return face === 'top' ? { m: M.diamond, t: tint(0x9aa0a4), uvs: 1.2 } : { m: M.steel, t: YEL, uvs: 1, trim: false };
    if (kind === 'grate') return face === 'top' ? { m: M.grate, t: tint(0xb4b9bc), uvs: 1.5 } : face === 'bottom' ? { m: M.steel, t: tint(0x4d5459), uvs: 2 } : { m: M.steel, t: YEL, uvs: 1, trim: false };
    if (kind === 'roofslab') return face === 'top' ? { m: M.roof, t: tint(0xa09c94), uvs: 3 } : face === 'bottom' ? { m: M.ceil, t: CEIL, uvs: 3 } : { m: M.facade, t: FACADE, uvs: 4, trim: false };
    if (kind === 'ceil' && face === 'bottom') return { m: M.ceil, t: y < -1 ? tint(0xa9aca4) : CEIL, uvs: 3 };
    if (kind === 'stone') {
      if (b.style === 'platform') return face === 'top' ? { m: M.diamond, t: tint(0xa3a8ab), uvs: 1.2 } : { m: M.metal, t: tint(0x5d6f78), uvs: 1.4, trim: false };
      return face === 'top' ? { m: M.floorIn, t: tint(0xc2c2bd), uvs: 2 } : { m: M.conc, t: tint(0xbdbbb4), uvs: 2, trim: false };
    }
    if (face === 'top') {
      if (kind === 'wall') {
        if (Math.abs(b.y1 - LU) < 0.01 || Math.abs(b.y1 - 3.0) < 0.01) return { m: M.roof, t: tint(0xa09c94), uvs: 3 };
        return { m: M.conc, t: tint(0xbab7af), uvs: 2 };
      }
      if (Math.abs(y - LU) < 0.05) return { m: M.diamond, t: tint(0xa3a8ab), uvs: 1.2 };
      if (y < -3) return { m: M.floorB, t: AS ? [1.3, 1.45, 1.38] : tint(0xd6e0da), uvs: 3 };
      return out ? { m: M.floorOut, t: AS ? [1.25, 1.24, 1.2] : tint(0xe0ddd5), uvs: 4 } : { m: M.floorIn, t: AS ? [1.55, 1.55, 1.5] : tint(0xe6e6e2), uvs: 3 };   // scannede gulve er mørke fotos => løftes
    }
    if (face === 'bottom') return out ? { m: M.facade, t: FACADE, uvs: 4 } : { m: M.ceil, t: y < -1 ? tint(0xa9aca4) : CEIL, uvs: 3 };
    // lodrette flader: udendørs => v14: industribeklædning som CS2-Nuke (betonsokkel 1,2 m, lys bølgeblikbeklædning, blåt bånd i 4,3–4,9 m);
    //   indendørs => tofarvet maling (sokkel 1,2 m)
    const fx = x + n[0] * 0.3, fz = z + n[2] * 0.3;
    const fl = floorUnder(fx, c0, fz);
    if (out) {
      if (c1 <= fl + 1.21 && c0 >= fl - 0.01) return { m: M.conc, t: tint(0xb3b0a8), uvs: 2, trim: false };
      if (c0 >= 4.29 && c1 <= 4.91 && fl < 1) return { m: M.metal, t: tint(0x2f5878), uvs: 1.5, trim: false };
      return { m: M.corr, t: CLAD, uvs: 2.2, trim: false };
    }
    const lo = c1 <= fl + 1.21 && c0 >= fl - 0.01;
    return { m: M.wallIn, t: lo ? (y < -2 ? WALL_LO_B : WALL_LO) : WALL_UP, uvs: 2 };
  }
  const trimDark = { m: M.metal, t: tint(0x2a2e31), uvs: 1, h: 0.14, d: 0.025 };
  const trim = (kind, b, y) => (kind === 'wall' || kind === 'floor') ? trimDark : null;

  /* ---------------- lamper (bagt lys + armaturer) ---------------- */
  // v12.1: placeres ud fra den STL-genererede banes rum (tage/lofter i W.data.roofs) og valideres med stråler – intet hænger i luften
  const lamps = [];
  const lamp = (x, y, z, o) => lamps.push(Object.assign({ x, y, z, color: 0xfff1dc, i: 1.2, range: 12, fix: 'tube' }, o || {}));
  const ND = W.data || { roofs: [], levels: {} };
  const ceilAbove = (x, y, z, max) => { const t = C.WD.raycastWorld(W, x, y, z, 0, 1, 0, max || 12); return t < (max || 12) ? y + t : null; };
  const freeAt = (x, y, z) => !C.insideSolid(x, y, z, false);
  const floorDown = (x, y, z, max) => { if (C.insideSolid(x, y, z, false)) return -Infinity; const t = C.WD.raycastWorld(W, x, y, z, 0, -1, 0, max || 20); return t < (max || 20) ? y - t : -Infinity; };
  for (const r of ND.roofs) {
    const [x0, z0, x1, z1, yb] = r, name = r[6], w = x1 - x0, d = z1 - z0, big = name === 'A' || name === 'RampRoom' || name === 'Garage';
    const step = big ? 8 : 5.5, nx = Math.max(1, Math.round(w / step)), nz = Math.max(1, Math.round(d / step));
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      const x = x0 + (i + 0.5) * w / nx, z = z0 + (k + 0.5) * d / nz, fy = floorDown(x, yb - 0.3, z, 20);
      if (fy === -Infinity || fy > yb - 2.2 || !freeAt(x, fy + 1.0, z)) continue;
      const cy = ceilAbove(x, fy + 1.0, z, 12); if (cy === null || Math.abs(cy - yb) > 0.3) continue;      // præcis under dette loft
      if (big) lamp(x, cy - 0.05, z, { fix: 'bay', hang: Math.min(1.0, (cy - fy) * 0.15), i: name === 'A' ? 2.0 : 1.6, range: 15, color: 0xffe6c4 });
      else lamp(x, cy - 0.04, z, { ax: w > d ? 'x' : 'z', i: 1.0, range: 9 });
    }
  }
  // underetagen: lysstofrør under A-pladen i et fast raster – kun hvor der er loft lige over og et B-gulv nedenunder
  for (let x = W.bounds.x0 + 4; x < W.bounds.x1; x += 8.5) for (let z = W.bounds.z0 + 4; z < W.bounds.z1; z += 8.5) {
    const fy = floorDown(x, -0.8, z, 10); if (fy === -Infinity || fy > -3.5) continue;
    if (!freeAt(x, fy + 1.0, z)) continue;
    const cy = ceilAbove(x, fy + 1.0, z, 10); if (cy === null || cy > -0.3 || cy - fy < 2.4) continue;
    lamp(x, cy - 0.04, z, { ax: 'z', i: fy < -8 ? 2.2 : 1.5, range: fy < -8 ? 13 : 10, color: 0xe8f2ff });
  }
  // v13: ingen mørke huller – alle overdækkede gangarealer (begge etager) skal have en lampe inden for ~6 m med fri sigt
  {
    const covered = (x, y, z, cy) => lamps.some(L2 => { const dx = L2.x - x, dy = L2.y - y, dz = L2.z - z, d = Math.hypot(dx, dy, dz); if (Math.hypot(L2.x - x, L2.z - z) < 3.5 && Math.abs(L2.y - cy) < 1.5) return true; return d < 7 && C.WD.raycastWorld(W, x, y, z, dx / d, dy / d, dz / d, d - 0.15) >= d - 0.3; });
    for (let z = W.bounds.z0 + 1; z < W.bounds.z1; z += 2) for (let x = W.bounds.x0 + 1; x < W.bounds.x1; x += 2) for (const yy of [6.5, 2.5, -0.8, -5.5]) {
      const fy = floorDown(x, yy, z, 4.5); if (fy === -Infinity || !freeAt(x, fy + 1.0, z) || !freeAt(x, fy + 1.7, z)) continue;
      const cy = ceilAbove(x, fy + 1.0, z, 9.5); if (cy === null || cy - fy < 2.0) continue;        // kun indendørs
      if (covered(x, fy + 1.2, z, cy)) continue;
      lamp(x, cy - 0.04, z, { ax: hash2(x, z) > 0.5 ? 'x' : 'z', i: fy < -3 ? 1.3 : 1.0, range: 9, color: fy < -3 ? 0xe8f2ff : 0xfff1dc });
    }
  }
  // kravlekanalen (Back Vents): svage gule sikkerhedslys
  for (const b of W.boxes) if (b.kind === 'vent') { const x = (b.x0 + b.x1) / 2, z = (b.z0 + b.z1) / 2; if ((b.x1 - b.x0) * (b.z1 - b.z0) > 1.5) lamp(x, b.y0 - 0.05, z, { fix: 'vent', i: 0.5, range: 6, color: 0xffb050 }); }
  for (const c of W.cyls) if (c.style === 'reactorB') lamp(c.x, c.y0 + 2.6, c.z, { fix: 'none', i: 1.8, range: 10, color: 0x6fc8ff });   // reaktorens blå skær
  // lamper over indgange udendørs: ved hver stige og ved Main/Secret
  for (const l of W.ladders) lamp((l.x0 + l.x1) / 2 + l.nx * 0.6, l.y1 + 0.6, (l.z0 + l.z1) / 2 + l.nz * 0.6, { fix: 'none', i: 0.45, range: 5, color: 0xffd9a0 });

  /* ---------------- v14: ydre facader (gården, T Spawn, CT) – fundet i kollisionen: lodrette mursider der vender ud mod himlen ---------------- */
  const EXT = [];
  {
    const raw = [];
    for (const b of W.boxes) {
      if (!(b.kind === 'wall' || b.kind === 'solid') || b.y1 < 3.5) continue;
      for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const alongX = nz !== 0, a0 = alongX ? b.x0 : b.z0, a1 = alongX ? b.x1 : b.z1, fixed = nx > 0 ? b.x1 : nx < 0 ? b.x0 : nz > 0 ? b.z1 : b.z0;
        if (a1 - a0 < 0.9) continue;
        const n = Math.max(2, Math.round((a1 - a0) / 1.2)); let ok = 0, fy = Infinity;
        for (let i = 0; i < n; i++) {
          const a = a0 + (i + 0.5) * (a1 - a0) / n, x = alongX ? a : fixed + nx * 0.3, z = alongX ? fixed + nz * 0.3 : a;
          const g = C.WD.groundAt(W, x, z, Math.min(b.y1 - 0.5, 4), 0); if (g === -Infinity || g < -0.3 || g < b.y0 - 0.1 || b.y1 - g < 3.5) continue;   // kun gården (ikke tomrummet uden for banen, gulv −0,6)
          if (!outdoor(x, g + 1.5, z) || C.insideSolid(x, g + 1.6, z, false)) continue; ok++; fy = Math.min(fy, g);
        }
        if (ok >= n * 0.75) raw.push({ alongX, a0, a1, fixed: +fixed.toFixed(2), nx, nz, fy: +fy.toFixed(2), top: b.y1 });
      }
    }
    raw.sort((p, q) => (p.alongX - q.alongX) || (p.nx - q.nx) || (p.nz - q.nz) || (p.fixed - q.fixed) || (p.a0 - q.a0));
    for (const r of raw) { const l = EXT[EXT.length - 1]; if (l && l.alongX === r.alongX && l.nx === r.nx && l.nz === r.nz && Math.abs(l.fixed - r.fixed) < 0.01 && r.a0 <= l.a1 + 0.05 && Math.abs(l.fy - r.fy) < 0.3) { l.a1 = Math.max(l.a1, r.a1); l.top = Math.min(l.top, r.top); } else EXT.push(Object.assign({}, r)); }
    for (const e of EXT) e.len = e.a1 - e.a0;
  }
  const extPt = (e, a, out) => e.alongX ? [a, e.fixed + e.nz * out] : [e.fixed + e.nx * out, a];
  for (const e of EXT) {                                                   // projektører på facaderne (bagt lys + armatur)
    if (e.len < 6 || e.top - e.fy < 4.5) continue;
    const n = Math.max(1, Math.round(e.len / 15));
    for (let i = 0; i < n; i++) { const a = e.a0 + (i + 0.5) * e.len / n, [x, z] = extPt(e, a, 0.32), y = e.fy + Math.min(5.4, e.top - e.fy - 0.9);
      if (C.insideSolid(x, y, z, false)) continue; lamp(x, y, z, { fix: 'flood', n: [e.nx, e.nz], i: 1.1, range: 14, color: 0xfff0d8 }); }
  }

  /* ---------------- v14: B-sitets hal – mure fundet med stråler fra sitets midte; væglamper (bagt lys) ---------------- */
  const BWALLS = [];
  if (W.sites.B) {
    const sB = W.sites.B, cx = (sB.x0 + sB.x1) / 2, cz = (sB.z0 + sB.z1) / 2, y = sB.y + 1.5;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { nx: 0, ny: 0, nz: 0 }, t = C.WD.raycastWorld(W, cx, y, cz, dx, 0, dz, 25, n); if (t >= 25) continue;
      const wx = cx + dx * t, wz = cz + dz * t, sx = -dz, sz = dx, segs = [];        // langs væggen: find de stykker hvor muren er hel (ikke døråbninger)
      for (let a = -14; a <= 14; a += 0.5) { const x = wx + sx * a - dx * 0.1, z = wz + sz * a - dz * 0.1; const solid = C.insideSolid(x + dx * 0.2, sB.y + 1.0, z + dz * 0.2, false) && C.insideSolid(x + dx * 0.2, sB.y + 2.6, z + dz * 0.2, false) && !C.insideSolid(x - dx * 0.2, sB.y + 1.0, z - dz * 0.2, false);
        const l = segs[segs.length - 1]; if (solid) { if (l && l.a1 === a - 0.5) l.a1 = a; else segs.push({ a0: a, a1: a }); } }
      const ceilY = C.WD.raycastWorld(W, cx, y, cz, 0, 1, 0, 20);
      BWALLS.push({ wx, wz, nx: -dx, nz: -dz, sx, sz, segs: segs.filter(g => g.a1 - g.a0 >= 1.5), y0: sB.y, ceil: y + ceilY });
    }
    for (const w of BWALLS) for (const g of w.segs) for (let a = g.a0 + 1.5; a <= g.a1 - 1; a += 5) lamp(w.wx + w.sx * a + w.nx * 0.2, w.y0 + 3.3, w.wz + w.sz * a + w.nz * 0.2, { fix: 'wall', n: [w.nx, w.nz], i: 1.3, range: 10, color: 0xe8f2ff });
  }

  /* ---------------- v14 QA-runde 2: gangene (især B-etagen, Ramp, Tunnels, Secret) – fundet ved sampling af alle etager ---------------- */
  const RUNS = L.sampleRuns ? L.sampleRuns().filter(r => r.indoor && r.len >= 3) : [];
  const runPt = (r, a, out, y) => [r.alongX ? a : r.fixed + r.nx * out, y, r.alongX ? r.fixed + r.nz * out : a];
  for (const r of RUNS) {                                                      // væglamper i de mørke kældergange (hver 8. m)
    if (r.L > -1 || r.len < 5) continue;
    const n = Math.max(1, Math.round(r.len / 8));
    for (let i = 0; i < n; i++) {
      const a = r.a0 + (i + 0.5) * r.len / n, [x, y, z] = runPt(r, a, 0.2, Math.min(r.g1 + 2.5, r.ceil - 0.3));
      if (C.insideSolid(x, y, z, false) || lamps.some(l => Math.hypot(l.x - x, l.y - y, l.z - z) < 5)) continue;
      lamp(x, y, z, { fix: 'wall', n: [r.nx, r.nz], i: 1.0, range: 9, color: 0xe8f2ff });
    }
  }
  function dressCorridors(B, ctx) {
    const pipeT = [tint(0x8a9296), tint(0x3d7a4a), tint(0x9a5a32)], panelT = tint(0x5a6670), clear = (pts) => pts.every(([x, y, z]) => !C.insideSolid(x, y, z, false));
    for (const r of RUNS) {
      const mid = (r.a0 + r.a1) / 2, h = r.ceil - r.g1;
      // rørføring: to (eller tre) parallelle rør under loftet langs muren, med beslag – kun hvor der er plads over hovedhøjde
      if (r.len >= 4 && h >= 2.7) {
        const y = Math.min(r.g1 + 2.55, r.ceil - 0.35), A0 = r.a0 + 0.3, A1 = r.a1 - 0.3, k = Math.floor(hash2(r.fixed, r.L) * 3);
        const lanes = [[0.085, pipeT[k % 3]], [0.06, pipeT[(k + 1) % 3]]].concat(r.L < -1 && h > 3.2 ? [[0.05, pipeT[(k + 2) % 3]]] : []);
        lanes.forEach(([rad, t], li) => {                                    // rørene ligger mod muren (kontakt), stablet lodret
          const off = rad + 0.012, yy = y - li * 0.24, p0 = runPt(r, A0, off, yy), p1 = runPt(r, A1, off, yy);
          if (!clear([p0, p1, runPt(r, mid, off, yy)])) return;
          B.tube(M.metal, p0, p1, rad, { tint: t, seg: 8, detail: li > 0 });
        });
        for (let a = A0 + 0.4; a < A1; a += 2.5) { const [x, , z] = runPt(r, a, 0.1, y); if (C.insideSolid(x, y, z, false)) continue; B.box(M.steel, x, y - 0.24, z, r.alongX ? 0.05 : 0.2, 0.62, r.alongX ? 0.2 : 0.05, { tint: tint(0x3c4247), detail: true }); }   // rørbøjler
      }
      // el-skabe (hver ~9 m) i brysthøjde, med LED'er – kun på helt glatte murstykker
      const nP = Math.floor(r.len / 9);
      for (let i = 0; i < nP; i++) {
        const a = r.a0 + (i + 0.5) * r.len / nP + (hash2(i, r.fixed) - 0.5), fy = r.g0, [x, y, z] = runPt(r, a, 0.09, fy + 1.45);
        if (r.g1 - r.g0 > 0.05) continue;                                     // ikke på ramper
        if (!clear([[x, fy + 1.0, z], [x, fy + 1.9, z], runPt(r, a - 0.4, 0.09, fy + 1.45), runPt(r, a + 0.4, 0.09, fy + 1.45)])) continue;
        B.box(M.metal, x, y, z, r.alongX ? 0.6 : 0.18, 0.8, r.alongX ? 0.18 : 0.6, { tint: panelT, uvs: 1 });
        const [lx, , lz] = runPt(r, a + 0.15, 0.185, 0); B.box(M.glowGreen, lx, y + 0.28, lz, r.alongX ? 0.04 : 0.02, 0.04, r.alongX ? 0.02 : 0.04, { shadow: false, detail: true });
        const [rx, , rz] = runPt(r, a + 0.22, 0.185, 0); B.box(hash2(a, r.L) > 0.5 ? M.glowRed : M.glowAmber, rx, y + 0.28, rz, r.alongX ? 0.04 : 0.02, 0.04, r.alongX ? 0.02 : 0.04, { shadow: false, detail: true });
        const [cx2, , cz2] = runPt(r, a, 0.03, 0); B.box(M.steel, cx2, (y + 0.4 + Math.min(r.ceil, fy + 3.2)) / 2, cz2, r.alongX ? 0.08 : 0.05, Math.max(0.1, Math.min(r.ceil, fy + 3.2) - y - 0.4), r.alongX ? 0.05 : 0.08, { tint: tint(0x30363a), detail: true });   // kabelrør op
      }
      // faremarkering ved murfoden i kælderen
      if (r.L < -1 && r.g1 - r.g0 < 0.05 && r.len >= 3) { const [x, , z] = runPt(r, mid, 0, 0); if (!C.insideSolid(x + r.nx * 0.2, r.g0 + 0.15, z + r.nz * 0.2, false)) wallCard(B, M.hazard, x, r.g0 + 0.15, z, r.nx, r.nz, r.len - 0.2, 0.3, { off: 0.02, tint: [1, 1, 1], uvs: 1 }); }
    }
  }

  /* ---------------- props ---------------- */
  function dressProp(B, b, h, ctx) {
    const st = b.style || 'crate';
    if (st === 'barrel') return L.modelBarrels(ctx, b, 'barrel_03') || M.barrel(B, b, h, [0xd09a22, 0x3f6f9c, 0xb8322a, 0x4d6b3c]);
    if (st === 'barrier') return M.barrier(B, b, h, true);
    if (st === 'crate') return M.crate(B, b, h, [0x7e8c52, 0x6e7a48, 0x8a8f60, 0xb8975a]);
    if (M[st]) return M[st](B, b, h, undefined, ctx);
    return M.crate(B, b, h);
  }
  // v11.2: el-skab og gasflasker (fotoscannede modeller; procedurale reserver hvis modellerne mangler)
  M.utilbox = (B, b, h, _, ctx) => {
    if (ctx && ctx.modelInBox('utility_box_01', null, b, { yaw: L.faceAway(b) })) return;
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2; B.box(M.metal, cx, (b.y0 + b.y1) / 2, cz, b.x1 - b.x0 - 0.02, b.y1 - b.y0, b.z1 - b.z0 - 0.02, { tint: tint(0x7d8a7a), uvs: 1 });
  };
  M.propane = (B, b, h, _, ctx) => {
    if (L.modelRow(ctx, b, 'propane_tank', 3)) return;
    const w = b.x1 - b.x0, d = b.z1 - b.z0, along = w >= d;
    for (let i = 0; i < 3; i++) { const a = (along ? b.x0 : b.z0) + (along ? w : d) * (i + 0.5) / 3; B.cyl(M.metal, along ? a : (b.x0 + b.x1) / 2, b.y0, along ? (b.z0 + b.z1) / 2 : a, 0.17, 0.17, b.y1 - b.y0 - 0.05, { seg: 12, tint: tint(0xd8d2c8), uvs: 1 }); }
  };
  /* ---- v14: indretning (rummenes funktion som i CS2): skranke, automater, kontrolpulte, skabe, reoler – modeller fra Poly Haven (CC0) ---- */
  const bxOf = b => ({ w: b.x1 - b.x0, d: b.z1 - b.z0, H: b.y1 - b.y0, cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2 });
  const frontOf = b => { const y = L.faceAway(b); return [Math.sin(y), Math.cos(y)]; };           // retning ud i rummet (modellens +z)
  const chairAt = (ctx, b, dist, name) => { const [fx, fz] = frontOf(b), { cx, cz, w, d } = bxOf(b), r = (Math.abs(fx) > 0.5 ? w : d) / 2 + dist, x = cx + fx * r, z = cz + fz * r;
    if (!C.insideSolid(x, b.y0 + 0.5, z, false) && ctx.hasModel(name)) ctx.model(name, null, x, b.y0, z, Math.atan2(-fx, -fz) + (hash2(x, z) - 0.5) * 0.5, 1.0, { detail: true }); };
  const leds = (B, x, y, z, nx, nz, n, w) => { for (let i = 0; i < n; i++) { const a = (i / Math.max(1, n - 1) - 0.5) * w, col = [M.glowRed, M.glowAmber, M.glowBlue || M.glowWhite, M.glowWhite][Math.floor(hash2(x + i, z) * 4)];
    B.box(col, x + nz * a + nx * 0.005, y, z - nx * a + nz * 0.005, 0.035, 0.035, 0.035, { shadow: false, detail: true }); } };
  M.counter = (B, b, h, _, ctx) => {                          // receptionsskranke: laminatfront, hylde, skærm og kontorstol bag den
    const { w, d, H, cx, cz } = bxOf(b), [fx, fz] = frontOf(b), along = w >= d;
    B.box(M.metal, cx, b.y0 + (H - 0.05) / 2, cz, w, H - 0.05, d, { tint: tint(0x55656e), uvs: 1 });
    B.box(M.wood, cx, b.y1 - 0.025, cz, w + 0.06, 0.05, d + 0.06, { tint: tint(0xc8b89a), uvs: 1 });
    B.box(M.metal, cx + fx * (d / 2 + 0.01), b.y0 + H * 0.45, cz + fz * (along ? d / 2 + 0.01 : 0), along ? w - 0.2 : 0.02, 0.12, along ? 0.02 : w - 0.2, { tint: tint(0x2f5878), detail: true });   // blå stribe på fronten
    if (ctx.hasModel('Television_01')) ctx.model('Television_01', null, cx - fx * 0.1, b.y1, cz - fz * 0.1, Math.atan2(-fx, -fz), 0.6, { detail: true });
    chairAt(ctx, b, 0.55, 'modern_arm_chair_01') || 0;
  };
  M.vending = (B, b) => {                                     // sodavandsautomat: lysende front, møntpanel
    const { w, d, H, cx, cz } = bxOf(b), [fx, fz] = frontOf(b), t = hash2(cx, cz) < 0.5 ? tint(0xb8322a) : tint(0x2f5878);
    B.box(M.metal, cx, b.y0 + H / 2, cz, w, H, d, { tint: t, uvs: 1 });
    const fxp = cx + fx * (Math.abs(fx) > 0.5 ? w / 2 : 0) , fzp = cz + fz * (Math.abs(fz) > 0.5 ? d / 2 : 0);
    wallCard(B, M.glowWhite, fxp - (Math.abs(fz) > 0.5 ? 0.12 : 0), b.y0 + H * 0.62, fzp - (Math.abs(fx) > 0.5 ? 0.12 : 0), fx, fz, 0.5, 1.05, { off: 0.01, shadow: false, tint: [0.9, 0.95, 1.05] });
    wallCard(B, M.dark, fxp + (Math.abs(fz) > 0.5 ? 0.3 : 0), b.y0 + H * 0.6, fzp + (Math.abs(fx) > 0.5 ? 0.3 : 0), fx, fz, 0.18, 0.5, { off: 0.012, tint: [0.12, 0.12, 0.13] });
  };
  M.bench = (B, b) => { const { w, d, H, cx, cz } = bxOf(b), along = w >= d;   // stålbænk
    B.box(M.wood, cx, b.y1 - 0.03, cz, w, 0.06, d, { tint: tint(0x8a7454), uvs: 1 });
    for (const s2 of [-1, 1]) B.box(M.steel, cx + (along ? s2 * (w / 2 - 0.15) : 0), b.y0 + (H - 0.06) / 2, cz + (along ? 0 : s2 * (d / 2 - 0.15)), along ? 0.05 : w - 0.1, H - 0.06, along ? d - 0.1 : 0.05, { tint: STEEL }); };
  M.console = (B, b, h, _, ctx) => {                          // kontrolpult: skrå panelplade med lysdioder og knapper, skærme, stol foran
    const { w, d, H, cx, cz } = bxOf(b), [fx, fz] = frontOf(b), along = Math.abs(fz) > 0.5, Lg = along ? w : d;
    B.box(M.metal, cx, b.y0 + (H - 0.1) / 2, cz, w, H - 0.1, d, { tint: tint(0x8b9499), uvs: 1 });
    const tq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(along ? 1 : 0, 0, along ? 0 : 1), (along ? -fz : fx) * 0.35);
    B.box(M.metal, cx + fx * 0.05, b.y1 - 0.02, cz + fz * 0.05, along ? Lg : d + 0.1, 0.06, along ? d + 0.1 : Lg, { quat: tq, tint: tint(0x3d4a52), uvs: 1 });
    for (let i = 0; i < Math.floor(Lg / 0.5); i++) { const a = (i + 0.5) * 0.5 - Lg / 2; leds(B, cx + (along ? a : 0) + fx * (d / 2 - 0.12), b.y1 + 0.02, cz + (along ? 0 : a) + fz * (d / 2 - 0.12), 0, 1, 3, 0.25); }
    const nMon = Math.max(1, Math.floor(Lg / 1.6));
    for (let i = 0; i < nMon; i++) { const a = (i + 0.5) * Lg / nMon - Lg / 2, x = cx + (along ? a : 0) - fx * (d / 2 - 0.2), z = cz + (along ? 0 : a) - fz * (d / 2 - 0.2);
      if (ctx.hasModel('Television_01')) ctx.model('Television_01', null, x, b.y1, z, Math.atan2(fx, fz), 0.75, { detail: true });
      else B.box(M.dark, x, b.y1 + 0.25, z, 0.5, 0.35, 0.3, { tint: [0.1, 0.1, 0.11] }); }
    chairAt(ctx, b, 0.5, 'SchoolChair_01');
  };
  M.desk = (B, b, h, _, ctx) => { if (!L.againstWall(ctx, 'metal_office_desk', b, true)) M.counter(B, b, h, _, ctx); else { const { cx, cz } = bxOf(b); if (ctx.hasModel('Television_01')) ctx.model('Television_01', null, cx, b.y1, cz, L.faceAway(b) + Math.PI, 0.6, { detail: true }); chairAt(ctx, b, 0.45, 'SchoolChair_01'); } };
  M.rack = (B, b, h, _, ctx) => { if (L.againstWall(ctx, 'steel_frame_shelves_01', b, true)) return; M.shelves(B, b, h, _, ctx); };
  M.shelves = (B, b, h, _, ctx) => {                          // stålreol med kasser og dunke på hylderne
    const { w, d, H, cx, cz } = bxOf(b), along = w >= d, Lg = along ? w : d;
    if (!L.againstWall(ctx, 'worn_metal_rack', b, true)) {
      for (const s2 of [-1, 1]) for (const t2 of [-1, 1]) B.box(M.steel, cx + (along ? s2 * (w / 2 - 0.03) : t2 * (w / 2 - 0.03)), b.y0 + H / 2, cz + (along ? t2 * (d / 2 - 0.03) : s2 * (d / 2 - 0.03)), 0.05, H, 0.05, { tint: tint(0x2f5878) });
      for (const y of [0.1, 0.8, 1.5, H - 0.04]) B.box(M.metal, cx, b.y0 + y, cz, w - 0.02, 0.04, d - 0.02, { tint: tint(0x8b9499), uvs: 1 });
    }
    for (const y of [0.12, 0.82, 1.52]) { const n = Math.floor(Lg / 0.6); for (let i = 0; i < n; i++) { if (hash2(i, y + cx) < 0.3) continue; const a = (i + 0.5) * Lg / n - Lg / 2, x = cx + (along ? a : 0), z = cz + (along ? 0 : a);
      if (ctx.hasModel('plastic_crate_02') && hash2(y, i) < 0.6) ctx.model('plastic_crate_02', null, x, b.y0 + y + 0.03, z, along ? 0 : Math.PI / 2, 0.7, { detail: true });
      else B.box(M.wood, x, b.y0 + y + 0.2, z, 0.42, 0.36, Math.min(0.42, along ? d - 0.1 : w - 0.1), { tint: tint(0xb89a6a), uvs: 1, detail: true }); } }
  };
  M.lockers = (B, b) => {                                     // skabsrække: smalle stålskabe med lufteslidser og håndtag
    const { w, d, H, cx, cz } = bxOf(b), [fx, fz] = frontOf(b), along = Math.abs(fz) > 0.5, Lg = along ? w : d, n = Math.max(1, Math.round(Lg / 0.45));
    for (let i = 0; i < n; i++) { const a = (i + 0.5) * Lg / n - Lg / 2, x = cx + (along ? a : 0), z = cz + (along ? 0 : a), t = hash2(i, cx) < 0.15 ? tint(0x7a8a5a) : tint(0x5d7684);
      B.box(M.metal, x, b.y0 + H / 2, z, along ? Lg / n - 0.015 : d, H, along ? d : Lg / n - 0.015, { tint: t, uvs: 1 });
      const ox = fx * (along ? 0 : w / 2 + 0.005), oz = fz * (along ? d / 2 + 0.005 : 0);
      for (const y of [H - 0.25, H - 0.32, 0.25, 0.32]) B.box(M.dark, x + ox, b.y0 + y, z + oz, along ? Lg / n * 0.6 : 0.01, 0.02, along ? 0.01 : Lg / n * 0.6, { tint: [0.08, 0.08, 0.09], detail: true });
      B.box(M.steel, x + ox + (along ? Lg / n * 0.3 : 0), b.y0 + H * 0.55, z + oz + (along ? 0 : Lg / n * 0.3), 0.025, 0.14, 0.025, { tint: [0.7, 0.72, 0.74], detail: true }); }
    B.box(M.metal, cx, b.y1 + 0.02, cz, w + 0.02, 0.04, d + 0.02, { tint: tint(0x4d5f6a) });
  };
  const ring = (B, m, cx, y, cz, r, hh, t) => B.cyl(m, cx, y, cz, r, r, hh, { seg: 28, tint: t, uvs: 2, caps: false });
  let siloVent = null;
  function dressCyl(B, c) {
    const H = c.y1 - c.y0, r = c.r;
    if (c.style === 'tankA') {                         // A-sitets store reaktortanke
      const t = c.col === 'yellow' ? tint(0xd6ad3a) : tint(0xc4cace), dk = t.map(v => v * 0.6);
      B.cyl(M.conc, c.x, c.y0, c.z, r + 0.02, r + 0.02, 0.35, { seg: 32, tint: [0.75, 0.75, 0.74], uvs: 2 });
      B.cyl(M.metal, c.x, c.y0 + 0.35, c.z, r * 0.985, r * 0.985, H - 0.35 - r * 0.45, { seg: 32, tint: t, uvs: 2.2, caps: false });
      B.sphere(M.metal, c.x, c.y0 + H - r * 0.45, c.z, r * 0.985, r * 0.45, r * 0.985, { seg: 28, tint: t.map(v => v * 0.95), half: true });
      for (let y = 1.2; y < H - r * 0.5; y += 1.6) ring(B, M.metal, c.x, c.y0 + y, c.z, r, 0.12, dk);
      B.cyl(M.steel, c.x + r * 0.71, c.y0 + 0.35, c.z - r * 0.71, 0.13, 0.13, H + 1.0, { seg: 8, tint: STEEL });            // stigrør op i loftet
      B.cyl(M.steel, c.x, c.y0 + H - 0.1, c.z, 0.32, 0.32, Math.max(0.2, (c.ceil || 8.4) - c.y0 - H + 0.1), { seg: 12, tint: STEEL, caps: false });          // tilslutning til loftet
      B.cyl(M.steel, c.x, c.y0 + H - 0.2, c.z, 0.55, 0.42, 0.25, { seg: 16, tint: dk });
      for (let k = 0; k < 2; k++) { const a = k * Math.PI + 0.6; wallCardOnCyl(B, M.rad, c, a, 2.0, 0.8); }
      B.cyl(M.metal, c.x - r * 0.98, c.y0 + 1.25, c.z, 0.18, 0.18, 0.05, { seg: 12, tint: tint(0xb8322a), quat: orient(1, 0, 0), detail: true });   // ventilhjul
    } else if (c.style === 'silo') {                   // udendørs silo: korrugeret, ringe, konisk tag
      const t = tint(0xc9ced2);
      B.cyl(M.conc, c.x, c.y0, c.z, r + 0.15, r + 0.15, 0.4, { seg: 36, tint: [0.72, 0.72, 0.7], uvs: 3 });
      B.cyl(M.corr, c.x, c.y0 + 0.4, c.z, r, r, H - 0.4, { seg: 36, tint: t, uvs: 3, caps: false });
      for (let y = 2.4; y < H - 0.5; y += 2.8) ring(B, M.metal, c.x, c.y0 + y, c.z, r + 0.04, 0.16, tint(0x6f7a82));
      B.cyl(M.hazard, c.x, c.y0 + 0.4, c.z, r + 0.03, r + 0.03, 0.6, { seg: 36, tint: [1, 1, 1], uvs: 1.2, caps: false });
      if (H < 7 && r > 3) {                            // v13: T-siloen kan betrædes (gangbro fra T Roof): flad ristetop, kant, rækværk og en lille udluftning i midten
        B.cyl(M.metal, c.x, c.y1 - 0.14, c.z, r + 0.12, r + 0.12, 0.18, { seg: 40, tint: tint(0x7c868d), uvs: 2 });
        B.cyl(M.grate, c.x, c.y1 + 0.035, c.z, r - 0.05, r - 0.05, 0.01, { seg: 40, tint: tint(0xb4b9bc), uvs: 1.5 });
        const R2 = r - 0.22, N = 32, gap = a => Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2))) < 0.28;
        for (let k = 0; k < N; k++) {
          const a = k / N * TAU, a2 = (k + 1) / N * TAU, px = c.x + Math.cos(a) * R2, pz = c.z + Math.sin(a) * R2;
          if (gap(a)) continue;
          B.box(M.steel, px, c.y1 + 0.55, pz, 0.05, 1.1, 0.05, { tint: YEL });
          if (!gap(a2)) for (const hy of [0.55, 1.08]) B.tube(M.steel, [px, c.y1 + hy, pz], [c.x + Math.cos(a2) * R2, c.y1 + hy, c.z + Math.sin(a2) * R2], 0.025, { seg: 5, tint: YEL });
        }
        B.cyl(M.metal, c.x, c.y1, c.z, 0.55, 0.45, 0.5, { seg: 16, tint: tint(0x8a9298) }); B.cyl(M.dark, c.x, c.y1 + 0.5, c.z, 0.6, 0.6, 0.06, { seg: 16, tint: [0.15, 0.16, 0.17] });
        siloVent = [c.x, c.y1 + 0.6, c.z];
      } else {
        B.cyl(M.metal, c.x, c.y0 + H, c.z, r + 0.1, 0.6, r * 0.38, { seg: 36, tint: tint(0xa7b0b6), uvs: 2 });
        B.cyl(M.steel, c.x + r * 0.6, c.y0 + H + r * 0.2, c.z - r * 0.4, 0.25, 0.25, 1.2, { seg: 10, tint: STEEL });
      }
    } else if (c.style === 'silosmall') {              // lav silo ved Secret (man kan hoppe op – flad top)
      const t = tint(0x9aa6ad);
      B.cyl(M.corr, c.x, c.y0, c.z, r * 0.99, r * 0.99, H - 0.12, { seg: 28, tint: t, uvs: 2, caps: false });
      B.cyl(M.metal, c.x, c.y0 + H - 0.12, c.z, r, r, 0.12, { seg: 28, tint: tint(0x6f7a82), uvs: 2 });
      ring(B, M.metal, c.x, c.y0 + 1.2, c.z, r + 0.02, 0.1, tint(0x6f7a82));
      B.cyl(M.steel, c.x, c.y0 + H, c.z, 0.3, 0.3, 0.06, { seg: 12, tint: STEEL, detail: true });
    } else if (c.style === 'tank') {
      const t = tint(0xd8d2c0);
      B.cyl(M.metal, c.x, c.y0, c.z, r, r, H * 0.88, { seg: 24, tint: t, uvs: 1.6, caps: false }); B.sphere(M.metal, c.x, c.y0 + H * 0.88, c.z, r, H * 0.12, r, { seg: 22, tint: t.map(v => v * 0.9), half: true });
      for (const y of [0.25, 0.6]) ring(B, M.metal, c.x, c.y0 + H * y, c.z, r + 0.03, 0.12, t.map(v => v * 0.55));
      B.cyl(M.steel, c.x, c.y0 + H, c.z, 0.18, 0.18, 0.6, { seg: 8, tint: STEEL });
    } else if (c.style === 'reactorB') {               // B-reaktoren: plint, stålsokkel, glasruder i rammer, kerne med blå bånd, rør op i loftet
      const pl = 0.35;
      B.cyl(M.conc, c.x, c.y0, c.z, r, r, pl, { seg: 32, tint: [0.7, 0.71, 0.7], uvs: 2 });
      B.cyl(M.metal, c.x, c.y0 + pl, c.z, r - 0.05, r - 0.05, 0.9, { seg: 32, tint: tint(0x3f5c6a), uvs: 1.6, caps: true });
      const nP = 12, gy0 = c.y0 + pl + 0.9, gy1 = c.y0 + 3.3;
      for (let i = 0; i < nP; i++) { const a = i / nP * TAU; B.box(M.steel, c.x + Math.cos(a) * (r - 0.08), (gy0 + gy1) / 2, c.z + Math.sin(a) * (r - 0.08), 0.09, gy1 - gy0, 0.09, { tint: STEEL }); }
      B.cyl(M.glass, c.x, gy0, c.z, r - 0.09, r - 0.09, gy1 - gy0, { seg: nP, caps: false, shadow: false, tint: [1, 1, 1] });
      ring(B, M.steel, c.x, gy1, c.z, r - 0.08, 0.1, STEEL); ring(B, M.steel, c.x, gy0, c.z, r - 0.08, 0.06, STEEL);
      B.cyl(M.metal, c.x, gy0, c.z, 1.7, 1.55, c.y1 - gy0, { seg: 24, tint: tint(0xcfd6da), uvs: 2, caps: false });
      for (const y of [0.8, 2.0, 3.4]) ring(B, M.glowBlue, c.x, gy0 + y, c.z, 1.66, 0.08, [1, 1, 1]);
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.4; B.cyl(M.steel, c.x + Math.cos(a) * 1.1, gy1 + 0.2, c.z + Math.sin(a) * 1.1, 0.16, 0.16, c.y1 - gy1 - 0.2, { seg: 8, tint: STEEL, caps: false }); }
      B.cyl(M.metal, c.x, c.y1 - 0.25, c.z, r - 0.1, r - 0.1, 0.25, { seg: 32, tint: tint(0x55606a), uvs: 2, bottomCap: true, caps: false });
    }
  }
  function wallCardOnCyl(B, m, c, a, y, s) {
    const nx = Math.cos(a), nz = Math.sin(a);
    wallCard(B, m, c.x + nx * (c.r + 0.02), c.y0 + y, c.z + nz * (c.r + 0.02), nx, nz, s, s, { detail: true });
  }
  const dressLadder = (B, l) => ladderModel(B, M.steel, l, l.y0 < -1 ? tint(0x9aa0a4) : YEL, l.y1 - l.y0 > 3.5 && l.y0 >= 0 && l.x0 < -30);
  const dressRail = (B, b) => railing(B, M.steel, b, YEL);
  const dressLamp = (B, Lp, ctx) => {
    if (Lp.fix === 'bay' && ctx && ctx.hasModel('hanging_industrial_lamp') && C.WD.raycastWorld(W, Lp.x, Lp.y + 0.2, Lp.z, 0, 1, 0, 3) >= 1.15) {   // fotoscannet hængelampe (kun hvor loftshøjden rækker)
      ctx.model('hanging_industrial_lamp', null, Lp.x, Lp.y - 0.04, Lp.z, 0, 1, { shadow: false }); return;
    }
    if (Lp.fix === 'flood') {                                                // projektør på facaden (fotoscannet sikkerhedslampe eller procedural)
      const nx = Lp.n[0], nz = Lp.n[1];
      if (ctx && ctx.hasModel('security_light')) { ctx.model('security_light', null, Lp.x - nx * 0.2, Lp.y - 0.25, Lp.z - nz * 0.2, Math.atan2(nx, nz), 1.4, { shadow: false }); return; }
      B.box(M.steel, Lp.x - nx * 0.22, Lp.y, Lp.z - nz * 0.22, nz ? 0.08 : 0.3, 0.08, nx ? 0.08 : 0.3, { tint: [0.3, 0.32, 0.34] });
      B.box(M.steel, Lp.x, Lp.y, Lp.z, 0.36, 0.26, 0.36, { tint: [0.26, 0.28, 0.3] }); B.box(M.glowWhite, Lp.x + nx * 0.19, Lp.y, Lp.z + nz * 0.19, nz ? 0.3 : 0.02, 0.2, nx ? 0.3 : 0.02, { shadow: false }); return;
    }
    if (Lp.fix === 'vent') { B.box(M.steel, Lp.x, Lp.y + 0.13, Lp.z, 0.16, 0.05, 0.12, { tint: [0.25, 0.25, 0.27] }); B.box(M.glowAmber, Lp.x, Lp.y + 0.09, Lp.z, 0.1, 0.04, 0.07, { shadow: false }); } else if (Lp.fix !== 'none') lampFixture(B, M, Lp); };

  /* ---------------- døre ---------------- */
  const DOOR_COL = { squeaky: 0x8a6a48, wood: 0x9c7a52, metal: 0x5f7380 };
  const doorStyle = d => ({ matOpts: { color: DOOR_COL[d.kind] || 0x6a7a84, map: d.kind === 'metal' ? M.metal.map : M.wood.map }, build: (w, h, m) => doorLeaf(w, h, m, d.kind === 'metal' ? 'metal' : 'wood') });

  /* ---------------- dekor: dørkarme, skilte, rør, markeringer, vinduer, vent-gitre ---------------- */
  let coolTower = null; const drips = [];                                                       // [x, y, z, r] – køletårnets top (damp-fanen i fx)
  // skybox-ring: kraftværkets omgivelser – haller i bølgeblik/beton, køletårn, skorstene med røde/hvide bånd, højspændingsmaster
  // v14: skylinen er én ring rundt om banen – store celler (≈ én mesh pr. materiale pr. kvadrant) i stedet for 96 m-celler sparer ~30 draw calls
  function skyline(ctx) {
    const D = L.D, SB = new C.Batch(4096, 'skyline', { shadow: false }), bk = [0, 0, 0, 0.95], o = (x) => Object.assign({ bake: bk, shadow: false }, x);
    const CLAD = [0xd9d6cd, 0xb9c2c8, 0x8f9ea8, 0xc9c6bd, 0x6f8494].map(c => tint(c));
    const slots = D.ringSlots(23, { gap: 6, ring2: 18, wMin: 9, wMax: 18, dMin: 8, dMax: 14, gapVar: 5 });
    let tower = false, stacks = 0;
    for (const sl of slots) {
      const R = rnd(Math.floor(Math.abs(sl.x * 11.3 + sl.z * 5.9)) + 2), w = sl.alongX ? sl.w : sl.d, d = sl.alongX ? sl.d : sl.w;
      if (sl.ring === 1 && !tower && sl.r > 0.6) {                            // køletårn (hyperboloide-profil af stablede kegler)
        tower = true; const r0 = 11, H = 40, N = 10;
        for (let i = 0; i < N; i++) { const t0 = i / N, t1 = (i + 1) / N, rr = t => r0 * (0.62 + 0.38 * Math.pow(Math.abs(t - 0.72) / 0.72, 1.6)); SB.cyl(M.conc, sl.x - sl.nx * 8, 4 + t0 * H, sl.z - sl.nz * 8, rr(t0), rr(t1), H / N + 0.02, o({ seg: 28, tint: tint(0xcfccc4, 0.92 + (i % 2) * 0.04), uvs: 4, caps: false })); }
        SB.cyl(M.conc, sl.x - sl.nx * 8, 4 + H - 0.4, sl.z - sl.nz * 8, r0 * 0.66, r0 * 0.66, 0.8, o({ seg: 28, tint: tint(0x8f8c86), uvs: 2, caps: false }));
        coolTower = [sl.x - sl.nx * 8, 4 + H, sl.z - sl.nz * 8, r0 * 0.6];
        continue;
      }
      if (sl.ring === 1 && stacks < 2 && sl.r < 0.22) {                       // skorsten med advarselsbånd og lys i toppen
        stacks++; const H = 38 + R() * 8, x = sl.x, z = sl.z;
        for (let y = 5, k = 0; y < H; y += 4, k++) SB.cyl(M.conc, x, y, z, 1.5 - y * 0.012, 1.5 - (y + 4) * 0.012, 4.02, o({ seg: 16, tint: y > H - 13 ? (k % 2 ? tint(0xb8322a) : tint(0xece8e0)) : tint(0xc4c1ba), uvs: 2, caps: false }));
        SB.cyl(M.dark, x, H, z, 1.05, 1.0, 0.4, o({ seg: 16, tint: [0.12, 0.12, 0.12] }));
        SB.box(M.glowRed, x, H + 0.5, z, 0.25, 0.25, 0.25, o({ tint: [1, 1, 1] }));
        continue;
      }
      // hal: beklædt kasse, fladt tag med inddækning, ventilationsaggregater og lysbånd
      const H = sl.ring ? 13 + R() * 8 : 11 + R() * 5, c0 = CLAD[Math.floor(R() * CLAD.length)], corr = R() < 0.55;
      SB.box(corr ? M.corr : M.facade, sl.x, 5 + (H - 5) / 2, sl.z, w, H - 5, d, o({ tint: c0, uvs: corr ? 2.4 : 4, noBottom: true, wear: [-50, H, 1] }));
      SB.box(M.metal, sl.x, H + 0.15, sl.z, w + 0.12, 0.3, d + 0.12, o({ tint: c0.map(v => v * 0.6), uvs: 1.5 }));
      const fx = sl.x + sl.nx * (sl.alongX ? d : w) / 2, fz = sl.z + sl.nz * (sl.alongX ? d : w) / 2, Lw = sl.alongX ? w : d;
      if (R() < 0.6) wallCard(SB, M.win, fx, H - 1.6, fz, sl.nx, sl.nz, Lw * 0.8, 1.1, o({ off: 0.03 }));          // lysbånd under tagkanten
      for (let i = 0, n = 1 + Math.floor(R() * 3); i < n; i++) {             // tagaggregater
        const ax = sl.x + (R() - 0.5) * w * 0.6, az = sl.z + (R() - 0.5) * d * 0.6, aw = 1.4 + R() * 1.6, ah = 0.9 + R() * 1.0;
        SB.box(M.metal, ax, H + 0.3 + ah / 2, az, aw, ah, aw * 0.8, o({ tint: tint(0x9aa3a8), uvs: 1 }));
        SB.cyl(M.dark, ax, H + 0.3 + ah, az, aw * 0.3, aw * 0.3, 0.12, o({ seg: 12, tint: [0.15, 0.16, 0.17] }));
      }
      if (R() < 0.35) SB.cyl(M.steel, sl.x + w * 0.3, H + 0.3, sl.z - d * 0.2, 0.25, 0.25, 4 + R() * 4, o({ seg: 8, tint: tint(0x7c858c), caps: true }));   // udluftningsrør
      if (sl.ring === 1 && R() < 0.22) {                                         // højspændingsmast (gittertårn af tynde stænger)
        const mx = sl.x - sl.nx * (d / 2 + 4), mz = sl.z - sl.nz * (d / 2 + 4), MH = 26;
        for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) SB.tube(M.steel, [mx + a * 2.2, 5, mz + b * 2.2], [mx + a * 0.5, 5 + MH, mz + b * 0.5], 0.09, o({ seg: 4, tint: tint(0x8a9298) }));
        for (let y = 9; y < 5 + MH; y += 4) { const k = 2.2 - (y - 5) / MH * 1.7; SB.box(M.steel, mx, y, mz, k * 2, 0.1, 0.1, o({ tint: tint(0x8a9298) })); SB.box(M.steel, mx, y, mz, 0.1, 0.1, k * 2, o({ tint: tint(0x8a9298) })); }
        for (const yy of [5 + MH * 0.72, 5 + MH * 0.88]) SB.box(M.steel, mx, yy, mz, sl.alongX ? 9 : 0.16, 0.16, sl.alongX ? 0.16 : 9, o({ tint: tint(0x8a9298) }));
      }
    }
    ctx.extra.push(SB);
  }
  function decor(ctx) {
    const { B } = ctx;
    const steelT = tint(0x50585e), beamT = tint(0x6a747b), M2 = M.rusty || M.steel;
    skyline(ctx);
    /* ---- industriarkitektur under de høje lofter (aldrig i spillerhøjde): stål-tagspær med åse ---- */
    const ibeam = (x0, z0, x1, z1, y, hgt) => {
      const along = Math.abs(x1 - x0) > Math.abs(z1 - z0), L2 = along ? x1 - x0 : z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, fw = 0.32;
      B.box(M.steel, cx, y - 0.02, cz, along ? L2 : fw, 0.04, along ? fw : L2, { tint: beamT, uvs: 1 });
      B.box(M.steel, cx, y - hgt + 0.02, cz, along ? L2 : fw, 0.04, along ? fw : L2, { tint: beamT, uvs: 1 });
      B.box(M.steel, cx, y - hgt / 2, cz, along ? L2 : 0.05, hgt - 0.08, along ? 0.05 : L2, { tint: beamT.map(v => v * 0.85), uvs: 1 });
    };
    for (const r of ND.roofs) {
      const [x0, z0, x1, z1, yb] = r, name = r[6]; if (name !== 'A' && name !== 'RampRoom' && name !== 'Garage') continue;
      const alongX = (x1 - x0) >= (z1 - z0), L2 = alongX ? x1 - x0 : z1 - z0, n2 = Math.max(1, Math.round(L2 / 4.6));
      for (let i = 1; i < n2; i++) { const a = (alongX ? x0 : z0) + i * L2 / n2; if (alongX) ibeam(a, z0 + 0.4, a, z1 - 0.4, yb, 0.5); else ibeam(x0 + 0.4, a, x1 - 0.4, a, yb, 0.5); }
    }
    L.D.cornice(B, M.metal, tint(0x8d969c), { y: 7.2, out: 0.12, h: 0.2 });                 // inddækning på de høje facadetoppe
    /* ---- v13: mindre kantet arkitektur – murkroner med afdækning, tagkanter med inddækning, pilastre på de lange facader ---- */
    const WT = C.WD ? 20 : 20, capT = tint(0xc9c6bd);
    for (const b of W.boxes) {
      if (b.kind !== 'wall' || b.y1 - b.y0 < 0.8) continue;
      const w = b.x1 - b.x0, d = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      if (Math.min(w, d) > 2.2 || C.insideSolid(cx, b.y1 + 0.15, cz, false)) continue;                       // kun frie murkroner
      if (C.WD.raycastWorld(W, cx, b.y1 + 0.05, cz, 0, 1, 0, 0.6) < 0.6) continue;                           // lige under et loft
      B.box(M.conc, cx, b.y1 + 0.045, cz, w + 0.07, 0.09, d + 0.07, { tint: capT, uvs: 2 });
      B.box(M.metal, cx, b.y1 - 0.03, cz, w + 0.03, 0.06, d + 0.03, { tint: tint(0x6f777c), uvs: 1, detail: true });   // skyggefuge under afdækningen
    }
    /* ---- v13: haller (A, Ramp-rummet, Garagen): stålsøjler under hvert spær, ovenlys mellem spærene, rørføringer langs murene ---- */
    for (const r of ND.roofs) {
      const [x0, z0, x1, z1, yb] = r, name = r[6]; if (name !== 'A' && name !== 'RampRoom' && name !== 'Garage') continue;
      const alongX = (x1 - x0) >= (z1 - z0), L2 = alongX ? x1 - x0 : z1 - z0, n2 = Math.max(1, Math.round(L2 / 4.6));
      for (let i = 1; i < n2; i++) {
        const a = (alongX ? x0 : z0) + i * L2 / n2;
        for (const sd of [-1, 1]) {                                                       // søjle hvor spæret møder muren
          const px = alongX ? a : (x0 + x1) / 2, pz = alongX ? (z0 + z1) / 2 : a, dx = alongX ? 0 : sd, dz = alongX ? sd : 0;
          const fy = floorDown(px, yb - 0.4, pz, 20); if (fy === -Infinity) continue;
          const t = C.WD.raycastWorld(W, px, fy + 1.5, pz, dx, 0, dz, 14); if (t >= 14) continue;
          const wx = px + dx * (t - 0.11), wz = pz + dz * (t - 0.11), hh = yb - fy;
          if (C.WD.raycastWorld(W, wx - dx * 0.05, fy + 0.3, wz - dz * 0.05, dx, 0, dz, 0.3) > 0.25) continue;   // ingen mur ved foden (døråbning)
          if (C.WD.raycastWorld(W, wx - dx * 0.05, yb - 0.3, wz - dz * 0.05, dx, 0, dz, 0.3) > 0.25) continue;
          B.box(M.steel, wx, fy + hh / 2, wz, alongX ? 0.3 : 0.2, hh, alongX ? 0.2 : 0.3, { tint: beamT, uvs: 1 });
          B.box(M.steel, wx - dx * 0.09, fy + hh / 2, wz - dz * 0.09, alongX ? 0.32 : 0.04, hh, alongX ? 0.04 : 0.32, { tint: beamT.map(v => v * 0.9), uvs: 1 });
          B.box(M.conc, wx - dx * 0.02, fy + 0.2, wz - dz * 0.02, 0.5, 0.4, 0.5, { tint: tint(0xa8a59e), uvs: 2 });   // søjlefod
        }
        if (i < n2) {                                                                     // ovenlys midt mellem to spær
          const a2 = a + L2 / n2 / 2; if (a2 > (alongX ? x1 : z1) - 1) continue;
          const cx = alongX ? a2 : (x0 + x1) / 2, cz = alongX ? (z0 + z1) / 2 : a2, w = alongX ? 1.1 : Math.min(3.2, (x1 - x0) * 0.25), d = alongX ? Math.min(3.2, (z1 - z0) * 0.25) : 1.1;
          if (C.insideSolid(cx, yb - 0.3, cz, false) || floorDown(cx, yb - 0.4, cz, 20) === -Infinity) continue;
          B.box(M.metal, cx, yb - 0.06, cz, w + 0.3, 0.12, d + 0.3, { tint: tint(0x5a6166), uvs: 1 });
          B.box(M.glowWhite, cx, yb - 0.125, cz, w, 0.02, d, { shadow: false, tint: [0.95, 0.98, 1.05] });
          for (let k = 1; k < 4; k++) { const f = k / 4; B.box(M.steel, alongX ? cx : cx - w / 2 + w * f, yb - 0.14, alongX ? cz - d / 2 + d * f : cz, alongX ? w : 0.05, 0.03, alongX ? 0.05 : d, { tint: beamT, detail: true }); }
        }
      }
      // rørføring langs én langside i 5 m højde (to rør + bærebeslag)
      const side = alongX ? [x0 + 0.6, z0, x1 - 0.6, z0] : [x0, z0 + 0.6, x0, z1 - 0.6];
      const sx = (side[0] + side[2]) / 2, sz = (side[1] + side[3]) / 2, inn = alongX ? [0, 1] : [1, 0];
      const fy = floorDown(sx + inn[0] * 2, yb - 0.4, sz + inn[1] * 2, 20);
      if (fy > -Infinity) {
        const t = C.WD.raycastWorld(W, sx + inn[0] * 2, fy + 4.6, sz + inn[1] * 2, -inn[0], 0, -inn[1], 6);
        if (t < 6) {
          const off = 2 - t + 0.35, py = Math.min(yb - 0.7, fy + 4.6);
          for (const [dd, rr, tt] of [[0, 0.16, tint(0x8a9296)], [0.42, 0.11, tint(0xb8322a)]]) {
            const ax = side[0] + inn[0] * (off + dd), az = side[1] + inn[1] * (off + dd), bx = side[2] + inn[0] * (off + dd), bz = side[3] + inn[1] * (off + dd);
            B.tube(M.rusty || M.steel, [ax, py, az], [bx, py, bz], rr, { tint: tt, seg: 10 });
          }
          const Ls = alongX ? x1 - x0 : z1 - z0;
          for (let k = 0.5; k < Ls; k += 2.5) { const bx = alongX ? x0 + k : side[0] + inn[0] * (off - 0.2), bz = alongX ? side[1] + inn[1] * (off - 0.2) : z0 + k; B.box(M.steel, bx, py - 0.2, bz, alongX ? 0.06 : 0.8, 0.06, alongX ? 0.8 : 0.06, { tint: beamT, detail: true }); }
        }
      }
    }
    for (const r of ND.roofs) {                                                                              // tagkant: inddækning hele vejen rundt
      const [x0, z0, x1, z1, , top] = r, e = 0.09, h = 0.28;
      for (const [cx, cz, w, d] of [[(x0 + x1) / 2, z0 + e / 2, x1 - x0 + 0.1, e], [(x0 + x1) / 2, z1 - e / 2, x1 - x0 + 0.1, e], [x0 + e / 2, (z0 + z1) / 2, e, z1 - z0], [x1 - e / 2, (z0 + z1) / 2, e, z1 - z0]])
        B.box(M.metal, cx, top + h / 2 - 0.05, cz, w + 0.08, h, d + 0.08, { tint: tint(0x8d969c), uvs: 1.5 });
    }
    for (const sg of (ND.outline || [])) {                                                                  // pilastre på yderfacaderne
      const [x0, z0, x1, z1] = sg, dx = x1 - x0, dz = z1 - z0, Lg = Math.hypot(dx, dz); if (Lg < 5) continue;
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2; let nx = -dz / Lg, nz = dx / Lg;
      if (!C.insideSolid(mx + nx * 0.35, 3, mz + nz * 0.35, false) && C.insideSolid(mx - nx * 0.35, 3, mz - nz * 0.35, false)) { nx = -nx; nz = -nz; }
      const n = Math.floor(Lg / 4.8), ry = Math.atan2(-dz, dx), PHh = ND.perimH || 7.5;
      for (let k = 1; k < n; k++) {
        const t = k / n, px = x0 + dx * t - nx * 0.06, pz = z0 + dz * t - nz * 0.06;
        if (C.insideSolid(px - nx * 0.4, 1, pz - nz * 0.4, false) || !outdoor(px - nx * 0.8, 2, pz - nz * 0.8)) continue;   // noget står op ad facaden / indendørs
        B.box(M.metal, px, PHh / 2, pz, 0.36, PHh, 0.16, { ry, tint: tint(0xb8bdbf), uvs: 2, wear: [0, PHh, 1] });   // stålsøjle i beklædningen
        B.box(M.conc, px, 0.25, pz, 0.62, 0.5, 0.3, { ry, tint: tint(0xa8a59e), uvs: 2 });
      }
    }
    // v12.1: banens yderkant som glatte facader langs det sporede omrids (kollisionen ligger i usynlige celle-trin lige bagved)
    const PH = ND.perimH || 7.5;
    for (const sg of (ND.outline || [])) {
      const [x0, z0, x1, z1] = sg, dx = x1 - x0, dz = z1 - z0, Lg = Math.hypot(dx, dz); if (Lg < 0.15) continue;
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2; let nx = -dz / Lg, nz = dx / Lg;
      if (!C.insideSolid(mx + nx * 0.35, 3, mz + nz * 0.35, false) && C.insideSolid(mx - nx * 0.35, 3, mz - nz * 0.35, false)) { nx = -nx; nz = -nz; }   // normalen peger UD af banen
      const ry = Math.atan2(-dz, dx), cxw = mx + nx * 0.3, czw = mz + nz * 0.3;
      // v14: samme beklædning som de andre ydre facader (betonsokkel, bølgeblik, blåt bånd) i stedet for glat beton –
      //   men hvor yderkanten er væggen i et rum (fx Ramp-rummet), er den indvendigt malet som de andre rum
      if (!outdoor(mx - nx * 0.8, 2.0, mz - nz * 0.8)) {
        B.box(M.wallIn, cxw, (1.2 - 10.5) / 2, czw, Lg + 0.6, 11.7, 0.6, { ry, tint: WALL_LO, uvs: 2, wear: [0, PH, 1] });
        B.box(M.wallIn, cxw, (1.2 + PH) / 2, czw, Lg + 0.6, PH - 1.2, 0.6, { ry, tint: WALL_UP, uvs: 2, wear: [0, PH, 1], noBottom: true });
        continue;
      }
      B.box(M.conc, cxw, (1.2 - 10.5) / 2, czw, Lg + 0.6, 11.7, 0.6, { ry, tint: tint(0xb3b0a8), uvs: 2, wear: [0, PH, 1] });
      B.box(M.corr, cxw, (1.2 + 4.3) / 2, czw, Lg + 0.6, 3.1, 0.6, { ry, tint: CLAD, uvs: 2.2, wear: [0, PH, 1], noBottom: true });
      B.box(M.metal, cxw, 4.6, czw, Lg + 0.62, 0.6, 0.62, { ry, tint: tint(0x2f5878), uvs: 1.5, noBottom: true });
      B.box(M.corr, cxw, (4.9 + PH) / 2, czw, Lg + 0.6, PH - 4.9, 0.6, { ry, tint: CLAD, uvs: 2.2, wear: [0, PH, 1], noBottom: true });
      B.box(M.metal, cxw, PH + 0.08, czw, Lg + 0.7, 0.16, 0.8, { ry, tint: tint(0x8d969c), uvs: 1 });
    }
    dressExterior(B, ctx); dressInterior(B, ctx); dressBHall(B, ctx); dressCorridors(B, ctx);
    const Di = L.D.ID;
    // kondens-dryp i underetagen (fra loftet, blank pyt nedenunder)
    for (let k = 0; k < 14; k++) {
      const x = W.bounds.x0 + hash2(k * 3.1, 7.7) * (W.bounds.x1 - W.bounds.x0), z = W.bounds.z0 + hash2(k * 1.9, 2.3) * (W.bounds.z1 - W.bounds.z0);
      const fy = floorDown(x, -0.8, z, 10); if (fy === -Infinity || fy > -3.5 || C.insideSolid(x, fy + 1, z, false)) continue;
      const up = C.WD.raycastWorld(W, x, fy + 1, z, 0, 1, 0, 10); if (up >= 10) continue;
      drips.push([x, fy + 1 + up - 0.03, z, fy]);
      L.D.floorDecal(B, Di.oil, x, fy, z, 0.9, hash2(x, z) * TAU, { wet: true, tint: [0.42, 0.5, 0.6] });
    }
    ctx.decals = L.D.place(ctx, { wallSet: [Di.rust, Di.crack, Di.stain, Di.warn, Di.num, Di.scuff, Di.rust, Di.stain], wallStep: 6, floorSet: [Di.oil, Di.crack, Di.scuff, Di.oil, Di.stain], floorStep: 5, floorDensity: 0.42, wetBelow: -3, outdoorOnly: {}, tint: { [Di.stain]: [0.8, 0.85, 0.9] } });
    // site-bogstaver malet på gulvet (stencil)
    for (const k in W.sites) { const st = W.sites[k]; floorCard(B, stencil(k, '#d23a2b'), (st.x0 + st.x1) / 2, st.y, (st.z0 + st.z1) / 2, 3.2, 2.4, Math.PI, { detail: false }); }
    // faremarkering ved stigernes fod og ved vent-hullet; gul ring om skakten
    for (const l of W.ladders) { const cx = (l.x0 + l.x1) / 2 + l.nx * 0.9, cz = (l.z0 + l.z1) / 2 + l.nz * 0.9; const fy = C.WD.groundAt(W, cx, cz, l.y0 + 0.3, 0.6); if (fy > -Infinity) floorCard(B, M.hazard, cx, fy, cz, l.nx ? 0.4 : 1.6, l.nx ? 1.6 : 0.4, 0, { uvs: 1 }); }
    // rør fra printet: rørbroen ved siloen og røret over Bottom Ramp
    // v14: ophæng går OP til loftet (indendørs) eller ned til jorden som stolper (rørbro udendørs) – før hang de frit under røret
    for (const p of (ND.pipes || [])) {
      const [x0, y0, z0, x1, y1, z1, r] = p; B.tube(M2, [x0, y0, z0], [x1, y1, z1], r, { tint: tint(0x8a9296) });
      for (const t of [0.15, 0.5, 0.85]) {
        const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, z = z0 + (z1 - z0) * t, up = C.WD.raycastWorld(W, x, y + r + 0.01, z, 0, 1, 0, 6, null, true);
        if (up < 5.5) { B.tube(M.steel, [x, y + r * 0.6, z], [x, y + r + up + 0.02, z], 0.03, { tint: steelT, detail: true }); B.box(M.steel, x, y + r + up - 0.02, z, 0.16, 0.04, 0.16, { tint: steelT, detail: true }); }
        else { const dn = C.WD.raycastWorld(W, x, y - r - 0.01, z, 0, -1, 0, 14, null, true); if (dn < 13.5) { B.box(M.steel, x, y - r - dn / 2, z, 0.12, dn + 0.02, 0.12, { tint: steelT }); B.box(M.steel, x, y - r - 0.03, z, 0.5, 0.06, 0.14, { tint: steelT }); } }
      }
    }
    // skilte (callouts) på nærmeste væg
    const sign = (txt, x, y, z, w2, bg, fg) => { const nw = L.nearestWall(x, y, z, 7); if (!nw) return; L.fitWallCard(B, signMat(txt, bg || '#1f3a4a', fg || '#f2efe6'), nw.x + nw.nx * 0.02, y, nw.z + nw.nz * 0.02, nw.nx, nw.nz, w2 || 1.8, (w2 || 1.8) / 4, { detail: true }); };
    for (const lb of W.labels) {
      const t = lb.text; if (!/LOBBY|RADIO|RAMP ROOM|LOCKERS|TURNPIKE|GARAGE|SECRET|B SITE|DECON|WINDOW|TUNNELS|SQUEAKY|HUT|MAIN|CONTROL|BOTTOM RAMP/.test(t)) continue;
      const y = (lb.y || 0) + 2.4, yellow = /SECRET|VENT/.test(t);
      sign(t, lb.x, y, lb.z, Math.max(1.6, t.length * 0.2), yellow ? '#f2c200' : t === 'DECON' ? '#1c7a3c' : undefined, yellow ? '#111' : undefined);
    }
    for (const lb of W.labels) if (/A SITE|B SITE/.test(lb.text)) { const nw = L.nearestWall(lb.x, (lb.y || 0) + 3.2, lb.z, 12); if (nw) L.fitWallCard(B, M.rad, nw.x + nw.nx * 0.02, (lb.y || 0) + 3.2, nw.z + nw.nz * 0.02, nw.nx, nw.nz, 0.9, 0.9, { detail: true }); }
  }

  /* ---------------- v14: ydre facader – vinduesbånd, nedløbsrør, rulleporte, el-skabe, rør, tagaggregater ---------------- */
  function dressExterior(B, ctx) {
    const H2 = ctx.hasModel ? ctx.hasModel : () => false, frameT = tint(0x5d666c);
    let doorsN = 0, boxes = 0, pipes = 0;
    for (const e of EXT) {
      const h = hash2(e.a0 * 1.7, e.fixed * 2.3), hh = e.top - e.fy, mid = (e.a0 + e.a1) / 2, ry = e.alongX ? (e.nz > 0 ? 0 : Math.PI) : (e.nx > 0 ? Math.PI / 2 : -Math.PI / 2);
      const P = (a, out, y) => { const [x, z] = extPt(e, a, out); return [x, y, z]; };
      // vinduesbånd højt oppe på lange, høje facader (mørkt glas i stålrammer, opdelt i fag)
      if (e.len >= 8 && hh >= 6.6) {
        const wy = e.top - 1.55, n = Math.floor((e.len - 1.6) / 2.6);
        for (let i = 0; i < n; i++) { const a = e.a0 + 0.8 + (i + 0.5) * (e.len - 1.6) / n, [x, , z] = P(a, 0, 0); wallCard(B, M.win, x, wy, z, e.nx, e.nz, (e.len - 1.6) / n - 0.12, 1.0, { off: 0.03, detail: false }); }
        const [x, , z] = P(mid, 0.06, 0); B.box(M.metal, x, wy - 0.56, z, e.alongX ? e.len - 1.4 : 0.14, 0.08, e.alongX ? 0.14 : e.len - 1.4, { tint: frameT, uvs: 1 });   // sålbænk
      }
      // nedløbsrør ved enderne af facaden
      if (e.len >= 5 && hh > 4) for (const a of [e.a0 + 0.35, e.a1 - 0.35]) { const [x, , z] = P(a, 0.1, 0); if (C.insideSolid(x + e.nx * 0.2, e.fy + 1, z + e.nz * 0.2, false)) continue;
        B.cyl(M.metal, x, e.fy + 0.05, z, 0.065, 0.065, hh - 0.25, { seg: 8, tint: tint(0x9aa2a6), caps: false });
        B.box(M.metal, x, e.top - 0.15, z, e.alongX ? 0.16 : 0.3, 0.12, e.alongX ? 0.3 : 0.16, { tint: tint(0x9aa2a6) }); }
      // rulleport (falsk – mod en lukket mur) på lange facader i gadeniveau, med betonkarm og gul/sort påkørselsbeskyttelse
      if (e.len >= 9 && e.fy < 2.5 && hh > 4.4 && h < 0.55 && doorsN < 9) {
        const [x, , z] = P(mid, 0, 0), free = !C.insideSolid(x + e.nx * 0.8, e.fy + 1, z + e.nz * 0.8, false) && !C.insideSolid(x + e.nx * 0.8 + (e.alongX ? 1.8 : 0), e.fy + 1, z + e.nz * 0.8 + (e.alongX ? 0 : 1.8), false) && !C.insideSolid(x + e.nx * 0.8 - (e.alongX ? 1.8 : 0), e.fy + 1, z + e.nz * 0.8 - (e.alongX ? 0 : 1.8), false);
        if (free) {
          doorsN++;
          if (H2('rollershutter_door')) { const bx = ctx.modelBox('rollershutter_door'), mw = Math.max(bx.max.x - bx.min.x, 0.1), mh = bx.max.y - bx.min.y, s3 = Math.min(3.4 / mw, 3.3 / mh); ctx.model('rollershutter_door', null, x + e.nx * 0.02, e.fy, z + e.nz * 0.02, ry, s3); }
          else wallCard(B, M.corr, x, e.fy + 1.65, z, e.nx, e.nz, 3.4, 3.3, { off: 0.03, tint: tint(0x8a949a) });
          for (const sd of [-1, 1]) { const [px, , pz] = P(mid + sd * 1.95, 0.12, 0); B.box(M.conc, px, e.fy + 1.8, pz, e.alongX ? 0.3 : 0.24, 3.6, e.alongX ? 0.24 : 0.3, { tint: tint(0xbab7af), uvs: 1.5 });
            B.cyl(M.hazard, px + e.nx * 0.3, e.fy, pz + e.nz * 0.3, 0.1, 0.1, 1.0, { seg: 10, tint: [1, 1, 1], uvs: 0.5 }); }
          const [lx, , lz] = P(mid, 0.12, 0); B.box(M.conc, lx, e.fy + 3.75, lz, e.alongX ? 4.2 : 0.24, 0.3, e.alongX ? 0.24 : 4.2, { tint: tint(0xbab7af), uvs: 1.5 });
          continue;
        }
      }
      // el-skab på muren
      if (e.len >= 4 && h > 0.6 && boxes < 14) { const a = e.a0 + e.len * (0.2 + 0.6 * hash2(e.fixed, e.a1)), [x, , z] = P(a, 0, 0);
        if (!C.insideSolid(x + e.nx * 0.5, e.fy + 1.2, z + e.nz * 0.5, false)) { boxes++;
          if (H2('utility_box_02')) ctx.model('utility_box_02', null, x + e.nx * 0.02, e.fy + 0.9, z + e.nz * 0.02, ry, 1.0, { detail: true });
          else B.box(M.metal, x + e.nx * 0.15, e.fy + 1.5, z + e.nz * 0.15, e.alongX ? 0.8 : 0.3, 1.0, e.alongX ? 0.3 : 0.8, { tint: tint(0x8a9a88) }); } }
      // vandrette rør langs facaden (to rør på konsoller) i ~4 m højde
      if (e.len >= 10 && hh > 5.5 && h > 0.25 && h < 0.5 && pipes < 8) { pipes++;
        for (const [dd, rr, tt] of [[0.22, 0.13, tint(0x8a9296)], [0.5, 0.09, tint(0xb8322a)]]) { const [ax, , az] = P(e.a0 + 0.5, dd, 0), [bx, , bz] = P(e.a1 - 0.5, dd, 0); B.tube(M.rusty || M.steel, [ax, e.fy + 3.7, az], [bx, e.fy + 3.7, bz], rr, { tint: tt, seg: 10 }); }
        for (let a = e.a0 + 0.8; a < e.a1 - 0.5; a += 2.4) { const [x, , z] = P(a, 0.3, 0); B.box(M.steel, x, e.fy + 3.52, z, e.alongX ? 0.06 : 0.62, 0.06, e.alongX ? 0.62 : 0.06, { tint: tint(0x50585e), detail: true }); }
      }
    }
    // tagaggregater og udluftninger på hallernes tage (set fra gården over murkronerne)
    for (const r of ND.roofs) {
      const [x0, z0, x1, z1, , top, name, type] = r; if (type === 'roof' && name === 'Lobby') continue;
      if ((x1 - x0) < 5 || (z1 - z0) < 5 || C.insideSolid((x0 + x1) / 2, top + 0.3, (z0 + z1) / 2, false)) continue;
      const n = Math.min(3, Math.floor((x1 - x0) * (z1 - z0) / 80) + 1);
      for (let i = 0; i < n; i++) { const hx = hash2(x0 + i, z1), hz = hash2(z0 + i, x1), x = x0 + 2 + hx * (x1 - x0 - 4), z = z0 + 2 + hz * (z1 - z0 - 4);
        if (H2('exterior_aircon_unit')) ctx.model('exterior_aircon_unit', null, x, top, z, Math.round(hx * 4) * Math.PI / 2, 1.6, { shadow: true });
        else B.box(M.metal, x, top + 0.6, z, 1.8, 1.2, 1.2, { tint: tint(0x9aa3a8), uvs: 1 });
        B.cyl(M.steel, x + 1.6, top, z + 0.4, 0.18, 0.18, 1.6, { seg: 8, tint: tint(0x8a9298) }); B.cyl(M.dark, x + 1.6, top + 1.6, z + 0.4, 0.26, 0.26, 0.08, { seg: 8, tint: [0.2, 0.2, 0.2] }); }
    }
  }

  /* ---------------- v14: indendørs vægudstyr – brandslukker + brandalarm + skilt i hvert rum, kabelbakker og ventilationskanaler under lofterne ---------------- */
  function dressInterior(B, ctx) {
    const H2 = n => ctx.hasModel && ctx.hasModel(n), cableT = tint(0x8a9298);
    for (const r of ND.roofs) {
      const [x0, z0, x1, z1, yb, , name] = r, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const fy = floorDown(cx, yb - 0.4, cz, 20); if (fy === -Infinity || yb - fy < 2.4) continue;
      let placed = 0;
      for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        if (placed >= ((x1 - x0) * (z1 - z0) > 150 ? 2 : 1)) break;
        const n = { nx: 0, ny: 0, nz: 0 }, t = C.WD.raycastWorld(W, cx, fy + 1.3, cz, dx, 0, dz, 16, n); if (t >= 16 || Math.abs(n.ny) > 0.1) continue;
        const wx = cx + dx * t, wz = cz + dz * t, sx = -n.nz, sz = n.nx;                    // langs væggen
        for (const off of [1.4, -1.4, 2.6, -2.6]) {
          const x = wx + sx * off, z = wz + sz * off;
          if (C.insideSolid(x + n.nx * 0.3, fy + 1.0, z + n.nz * 0.3, false) || !C.insideSolid(x - n.nx * 0.08, fy + 1.0, z - n.nz * 0.08, false) || !C.insideSolid(x - n.nx * 0.08, fy + 2.2, z - n.nz * 0.08, false)) continue;
          if (H2('korean_fire_extinguisher_01')) ctx.model('korean_fire_extinguisher_01', null, x + n.nx * 0.14, fy + 0.6, z + n.nz * 0.14, Math.atan2(n.nx, n.nz), 1.0, { detail: true });
          else B.cyl(M.metal, x + n.nx * 0.12, fy + 0.6, z + n.nz * 0.12, 0.08, 0.08, 0.5, { seg: 8, tint: tint(0xc02a20) });
          B.box(M.steel, x + n.nx * 0.03, fy + 0.95, z + n.nz * 0.03, Math.abs(n.nx) > 0.5 ? 0.04 : 0.2, 0.06, Math.abs(n.nx) > 0.5 ? 0.2 : 0.04, { tint: [0.2, 0.2, 0.22], detail: true });   // beslag
          wallCard(B, fireSign, x, fy + 1.75, z, n.nx, n.nz, 0.3, 0.3, { off: 0.02, detail: true });
          if (H2('fire_alarm')) ctx.model('fire_alarm', null, x + sx * 0.6 + n.nx * 0.02, fy + 1.35, z + sz * 0.6 + n.nz * 0.02, Math.atan2(n.nx, n.nz), 1.0, { detail: true });
          placed++; break;
        }
      }
      // kabelbakke langs den længste væg, 0,35 m under loftet (rum over 3 m)
      if (yb - fy > 3.0 && (x1 - x0) * (z1 - z0) > 30) {
        const alongX = (x1 - x0) >= (z1 - z0), n = { nx: 0, ny: 0, nz: 0 }, t = C.WD.raycastWorld(W, cx, yb - 0.4, cz, alongX ? 0 : 1, 0, alongX ? 1 : 0, 14, n);
        if (t < 14) { const y = yb - 0.4, off = t - 0.35, L2 = (alongX ? x1 - x0 : z1 - z0) - 1.0, px = cx + (alongX ? 0 : off), pz = cz + (alongX ? off : 0);
          let free = true; for (let k = -2; k <= 2; k++) { const qx = px + (alongX ? k * L2 / 4 : 0), qz = pz + (alongX ? 0 : k * L2 / 4); if (C.insideSolid(qx, y, qz, false)) free = false; }
          if (free) { B.box(M.steel, px, y, pz, alongX ? L2 : 0.4, 0.04, alongX ? 0.4 : L2, { tint: cableT, detail: true }); for (const sd of [-1, 1]) B.box(M.steel, px + (alongX ? 0 : sd * 0.2), y + 0.05, pz + (alongX ? sd * 0.2 : 0), alongX ? L2 : 0.02, 0.1, alongX ? 0.02 : L2, { tint: cableT, detail: true });
            for (let k = 0; k < 3; k++) B.box(M.dark, px + (alongX ? 0 : (k - 1) * 0.1), y + 0.05, pz + (alongX ? (k - 1) * 0.1 : 0), alongX ? L2 : 0.05, 0.05, alongX ? 0.05 : L2, { tint: [[0.1, 0.1, 0.1], [0.5, 0.2, 0.15], [0.15, 0.25, 0.45]][k], detail: true }); } }
      }
    }
  }
  function dressBHall(B, ctx) {
    let big = null;
    for (const w of BWALLS) {
      const P = (a, out) => [w.wx + w.sx * a + w.nx * out, w.wz + w.sz * a + w.nz * out];
      for (const g of w.segs) {
        const len = g.a1 - g.a0 + 0.5, am = (g.a0 + g.a1) / 2, [mx, mz] = P(am, 0);
        wallCard(B, M.hazard, mx, w.y0 + 0.2, mz, w.nx, w.nz, len, 0.4, { off: 0.025, tint: [1, 1, 1], uvs: 1 });          // gul/sort faremarkering ved murfoden
        if (!big || len > big.len) big = { w, am, len };
        for (let a = g.a0 + 0.8; a < g.a1; a += 6) { const [x, z] = P(a, 0.16);                                              // lodrette rørpar op i loftet
          for (const [o, r, t] of [[0, 0.09, tint(0x8a9296)], [0.28, 0.06, tint(0x3d7a4a)]]) B.cyl(M.metal, x + w.sx * o, w.y0, z + w.sz * o, r, r, Math.max(1, w.ceil - w.y0), { seg: 8, tint: t, caps: false }); }
      }
    }
    if (big) { const [x, z] = [big.w.wx + big.w.sx * big.am, big.w.wz + big.w.sz * big.am]; L.fitWallCard(B, stencil('B', '#f2c200'), x, big.w.y0 + 3.0, z, big.w.nx, big.w.nz, 2.6, 1.6, { detail: false }); }
    // ventilationskanal tværs over hallen under loftet, med ophæng
    const sB = W.sites.B; if (!sB) return;
    const cz = (sB.z0 + sB.z1) / 2, x0 = sB.x0 + 0.5, x1 = sB.x1 - 0.5, up = C.WD.raycastWorld(W, (x0 + x1) / 2, sB.y + 2, cz, 0, 1, 0, 20), y = sB.y + 2 + up - 0.55;
    if (up < 19 && up > 2.2) { B.box(M.duct, (x0 + x1) / 2, y, cz, x1 - x0, 0.6, 0.8, { tint: tint(0x9aa0a4), uvs: 1.5 });
      for (let x = x0 + 0.5; x < x1; x += 2.5) B.box(M.steel, x, y + 0.3 + 0.28, cz, 0.04, 0.56, 0.9, { tint: tint(0x50585e), detail: true }); }
  }
  const fireSign = mat(mkTex((c, w, h) => { c.fillStyle = '#c8261c'; c.fillRect(0, 0, w, h); c.strokeStyle = '#fff'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(w * 0.5, h * 0.18); c.quadraticCurveTo(w * 0.78, h * 0.5, w * 0.62, h * 0.82); c.lineTo(w * 0.38, h * 0.82); c.quadraticCurveTo(w * 0.22, h * 0.5, w * 0.5, h * 0.18); c.fill(); }, 64, { clamp: true }), {});

  /* ---------------- effekter: damp fra tanke i yarden ---------------- */
  function fx({ group, ups, THREE: T3 }) {
    const tex = T.soft();
    if (coolTower) {                                                          // køletårnets dampfane: store, langsomme puffs der driver med vinden
      const [cx, cy, cz, cr] = coolTower, N = 40, geo = new T3.BufferGeometry(), pos = new Float32Array(N * 3), age = new Float32Array(N), R = rnd(91);
      const init = (i, f) => { const a = R() * TAU, r = Math.sqrt(R()) * cr; pos[i * 3] = cx + Math.cos(a) * r; pos[i * 3 + 1] = cy; pos[i * 3 + 2] = cz + Math.sin(a) * r; age[i] = f ? R() : 0; };
      for (let i = 0; i < N; i++) init(i, true);
      geo.setAttribute('position', new T3.BufferAttribute(pos, 3)); geo.setAttribute('aAge', new T3.BufferAttribute(age, 1));
      const m = new T3.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { map: { value: tex } },
        vertexShader: 'attribute float aAge; varying float vA; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp((9.0 + aAge * 22.0) * 520.0 / max(-mv.z, 1.0), 1.0, 300.0); vA = (1.0 - aAge) * smoothstep(0.0, 0.12, aAge); }',
        fragmentShader: 'uniform sampler2D map; varying float vA; void main() { vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vec3(0.9, 0.92, 0.95), t.a * vA * 0.42); }' });
      const pts = new T3.Points(geo, m); pts.frustumCulled = false; pts.renderOrder = -10; group.add(pts);
      ups.push(dt => { for (let i = 0; i < N; i++) { age[i] += dt / 14; if (age[i] >= 1) init(i, false); pos[i * 3 + 1] += (2.2 - age[i] * 1.2) * dt; pos[i * 3] += 1.3 * age[i] * dt; pos[i * 3 + 2] += 0.4 * age[i] * dt; } geo.attributes.position.needsUpdate = true; geo.attributes.aAge.needsUpdate = true; });
    }
    for (const [x, y, z] of siloVent ? [siloVent] : []) {                      // damp fra siloens udluftning
      const N = 24, geo = new T3.BufferGeometry(), pos = new Float32Array(N * 3), age = new Float32Array(N), R = rnd(Math.floor(x * 7));
      const init = (i, f) => { pos[i * 3] = x + (R() - 0.5) * 0.3; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z + (R() - 0.5) * 0.3; age[i] = f ? R() : 0; };
      for (let i = 0; i < N; i++) init(i, true);
      geo.setAttribute('position', new T3.BufferAttribute(pos, 3)); geo.setAttribute('aAge', new T3.BufferAttribute(age, 1));
      const m = new T3.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { map: { value: tex } },
        vertexShader: 'attribute float aAge; varying float vA; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp((1.2 + aAge * 4.0) * 420.0 / max(-mv.z, 0.5), 1.0, 260.0); vA = (1.0 - aAge) * smoothstep(0.0, 0.15, aAge); }',
        fragmentShader: 'uniform sampler2D map; varying float vA; void main() { vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vec3(0.93,0.95,0.97), t.a * vA * 0.32); }' });
      const pts = new T3.Points(geo, m); pts.frustumCulled = false; group.add(pts);
      ups.push(dt => { for (let i = 0; i < N; i++) { age[i] += dt / 4; if (age[i] >= 1) init(i, false); pos[i * 3 + 1] += (0.9 + age[i]) * dt; pos[i * 3] += 0.35 * dt; } geo.attributes.position.needsUpdate = true; geo.attributes.aAge.needsUpdate = true; });
    }
  }

  const light = {
    sky: { hor: [0.8, 0.84, 0.88], mid: [0.6, 0.68, 0.8], top: [0.34, 0.45, 0.64], gnd: [0.34, 0.36, 0.38], sun: [1.0, 0.97, 0.92], cloud: 1.1 },
    sunColor: 0xfff2e2, sunInt: 1.05, sunPos: [-46, 64, -30], hemiSky: 0xcfdcee, hemiGround: 0x75787a, hemiInt: 0.72, ambInt: 0.12, bg: 0xaab6c2, fog: { color: 0xb2bcc5, near: 45, far: 150 },
    exposure: 1.05, minSky: 0.07
  };
  // vejrlig: sod/smuds ved murfoden, rustløb fra facadetoppene, støvpletter, vandpytter og fugtkant i B-kælderen (under -3 m)
  const weather = { macro: 0.18, macroCol: [0.95, 0.98, 1.02], grime: 0.8, grimeH: 0.75, grimeCol: [0.4, 0.4, 0.38], streak: 0.75, streakLen: 4.2, streakCol: [0.52, 0.43, 0.36], top: 0.16, topThr: 0.62, topCol: [0.36, 0.35, 0.32], topRough: 0.96, wetY: -3, wet: 1 };
  // filmisk look: koldt, klinisk og kontrastfyldt – afmættede farver, blålige skygger, skarpt (taktisk læsbarhed i de lange sigtelinjer)
  const post = { sat: 0.9, contrast: 1.13, highTint: [1.0, 1.0, 0.99], shadowTint: [0.94, 0.99, 1.07], lift: [0.004, 0.008, 0.014], gain: [0.99, 1.0, 1.02], vignette: 0.2, sharpen: 0.24, shafts: 0.14, shaftCol: [0.9, 0.95, 1.0], mie: 0.25, mieCol: [0.85, 0.9, 1.0], mieDist: 110 };
  const ambient = { color: 0xe6edf5, count: 160, size: 0.028, alpha: 0.26, wind: [0.05, 0.02, 0.04] };   // fint støv i hallernes lys
  const SKY = C.assets && C.assets.sky;
  if (SKY) {                                                                // v11: fotograferet himmel – solens retning hentes fra HDRI'en (skygger = himmel)
    light.skyTex = SKY.tex; light.skyExp = 0.9; light.ibl = 0.55; light.hemiInt = 0.62; light.ambInt = 0.1; light.exposure = 1.18; light.sunInt = 1.2;
    if (SKY.sunDir[1] > 0.15) light.sunPos = SKY.sunDir.map(v => v * 80);
  }
  return { id: 'nuke', light, weather, post, bevel: 0.16, bevelKinds: { wall: 1 }, ambient, drips, lamps, mats: M, surfKinds, surf, trim, splitY: [1.2, 4.3, 4.9, LB + 1.2, LU + 1.2], dressProp, dressCyl, dressLadder, dressRail, dressLamp, doorStyle, decor, fx, detailDist: 55 };
}
