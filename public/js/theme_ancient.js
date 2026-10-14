// ==========================================================================
// TEMA: de_ancient – jungle-ruiner. Mosbeklædte stenblokke, flisebelagte gange med mos i fugerne, søjler med slyngplanter,
// fakler med fast afstand, træer og bregner i plantebede langs murene (ingen tilfældigt spredte elementer).
// ==========================================================================
export function ancientTheme(L) {
  const { THREE, W, P, mkTex, mat, rnd, hash2, tint, mix, T, TAU, orient, wallCard, floorCard, commonMats, railing, ladderModel, lampFixture, doorLeaf, wallRuns, nearestWall, fern, shrub, grassTuft, vineStrip, jungleTree, ivyPatch, C } = L;
  const M = commonMats();
  const AD = W.data || { torches: [], portals: [], water: [], falls: [], levels: {} };
  const LA_ = 1.6, LB_ = -1.2, LM_ = (AD.levels && AD.levels.mid) || 0;                         // niveauer (A-templet / B-bassinet) – soklen og stuk-zonen deles ved disse højder
  const mossGround = mkTex((c, w, h) => {             // uregelmæssig stenbelægning med mos og jord i fugerne
    const R = rnd(61); c.fillStyle = '#4f4d3c'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { const x = R() * w, y = R() * h, rx = 16 + R() * 26, ry = 12 + R() * 18, v = 128 + R() * 44 | 0, rot = R() * 3; P.wrap(w, h, x, y, rx, (px, py) => { c.fillStyle = `rgb(${v},${v - 6},${v - 26})`; c.beginPath(); c.ellipse(px, py, rx, ry, rot, 0, TAU); c.fill(); c.strokeStyle = 'rgba(35,34,22,.55)'; c.lineWidth = 2.2; c.stroke(); c.fillStyle = 'rgba(255,255,230,.10)'; c.beginPath(); c.ellipse(px - 2, py - 2, rx * 0.7, ry * 0.6, rot, 0, TAU); c.fill(); }); }
    P.blobs(c, w, h, 90, 12, 46, '70,120,42', 0.4, R); P.blobs(c, w, h, 50, 8, 26, '125,160,58', 0.34, R); P.speckle(c, w, h, 5200, 30, 220, 0.22, 2, R);
  }, 512);
  const relief = mkTex((c, w, h) => {                 // udhugget relief-panel
    const R = rnd(59); c.fillStyle = '#b8b09a'; c.fillRect(0, 0, w, h); P.bevel(c, 8, 8, w - 16, h - 16, 'rgba(255,255,255,.3)', 'rgba(0,0,0,.5)');
    c.strokeStyle = 'rgba(40,36,26,.85)'; c.lineWidth = 9; c.lineCap = 'round'; const cx = w / 2, cy = h / 2;
    c.beginPath(); c.arc(cx, cy - 40, 54, 0, TAU); c.stroke(); c.beginPath(); c.arc(cx, cy - 40, 22, 0, TAU); c.stroke();
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8; c.beginPath(); c.moveTo(cx + Math.cos(a) * 66, cy - 40 + Math.sin(a) * 66); c.lineTo(cx + Math.cos(a) * 92, cy - 40 + Math.sin(a) * 92); c.stroke(); }
    c.beginPath(); c.moveTo(cx - 70, cy + 70); c.lineTo(cx - 20, cy + 40); c.lineTo(cx + 20, cy + 100); c.lineTo(cx + 70, cy + 60); c.stroke();
    P.blobs(c, w, h, 24, 14, 50, '70,120,40', 0.5, R); P.speckle(c, w, h, 2500, 60, 220, 0.3, 2, R);
  }, 512, { clamp: true });
  const bark = mkTex((c, w, h) => { const R = rnd(53); c.fillStyle = '#6b5640'; c.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { const x = R() * w, v = 60 + R() * 70 | 0; c.strokeStyle = `rgba(${v},${v - 14},${v - 28},${0.35 + R() * 0.4})`; c.lineWidth = 2 + R() * 5; c.beginPath(); c.moveTo(x, 0); for (let y = 0; y < h; y += 40) c.lineTo(x + (R() - 0.5) * 16, y); c.stroke(); } P.blobs(c, w, h, 14, 20, 60, '70,100,40', 0.3, R); }, 256);
  Object.assign(M, {
    floor: mat(mossGround, { bump: 1.0 }), wall: mat(T.stone(41, true), { bump: 1.1 }), ruin: mat(T.stone(63, true), { bump: 1.1 }), stoneM: mat(T.stone(77, false), { bump: 1.0 }), ramp: mat(T.stone(88, true), { bump: 1.0 }),
    relief: mat(relief), bark: mat(bark), frond: L.leafMat(T.frond(), true), broad: L.leafMat(T.broad(), true), fern: L.leafMat(T.fern(), true), vine: L.leafMat(T.vine(), true), grass: L.leafMat(T.grass(), true), canopy: L.leafMat(T.canopy(), true), ivy: L.leafMat(T.ivy(), false), liana: L.leafMat(T.liana(), true)
  });
  M.mossStone = M.ruin;
  /* ---- v11: fotoscannede CC0-materialer (Poly Haven) når de er indlæst – ellers de procedurale ovenfor ---- */
  const AS = C.assets && C.assets.tex;
  if (AS) {
    const S = (n, o) => C.pbrMat(AS[n], o);
    Object.assign(M, {
      wall: S('mossy_stone_wall', { normal: 1.3 }), ruin: S('old_stone_wall', { normal: 1.3 }), floor: S('mossy_cobblestone', { normal: 1.2 }), ramp: S('mossy_cobblestone'),
      stoneM: S('mossy_sandstone'), bark: S('bark_brown_02', { normal: 1.4 }), ground: S('leaves_forest_ground'), rock: S('rock_pitted_mossy')
    });
    M.mossStone = M.rock;
    if (AS.large_sandstone_blocks_01) M.ashlar = S('large_sandstone_blocks_01', { normal: 1.4 });   // v14: tilhuggede kvadersten (maya-arkitektur som i CS2-Ancient)
    // vegetation og relieffer afstemmes efter de fotoscannede materialer: mindre mættet, dybere grøn (ingen 'tegneserie'-grøn)
    for (const [k, c] of [['vine', [0.55, 0.66, 0.42]], ['broad', [0.46, 0.56, 0.36]], ['fern', [0.62, 0.72, 0.5]], ['grass', [0.7, 0.74, 0.52]], ['frond', [0.62, 0.72, 0.5]], ['canopy', [0.8, 0.88, 0.72]], ['ivy', [1.0, 1.08, 0.92]], ['liana', [0.8, 0.86, 0.72]]]) if (M[k]) M[k].color.setRGB(c[0], c[1], c[2]);
    M.relief.color.setRGB(0.74, 0.71, 0.6);
  }
  const surfKinds = { floor: 1, wall: 1, ceil: 1, slab: 1, stone: 1, ruin: 1 };
  const FT = [[1.6, tint(0xe8dcb2)], [0, tint(0xd6e2b0)], [-1.2, tint(0xb6caa6)]];
  const nearest = y => { let b = FT[0]; for (const f of FT) if (Math.abs(f[0] - y) < Math.abs(b[0] - y)) b = f; return b[1]; };
  // v14: murene er tilhuggede kvadersten (lys kalksten) med en sokkel-skifte forneden; enkelte murløb har rester af rød stuk (som i CS2-Ancient)
  const RED = (x, z) => { const k = hash2(Math.floor(x / 6) * 1.7, Math.floor(z / 6) * 2.3); return k > 0.8; };
  function surf(kind, face, b, x, y, z, n, c0, c1) {
    if (face === 'top') return kind === 'floor' ? { m: M.stoneM, t: AS ? [1.12, 1.1, 0.98] : nearest(y), uvs: AS ? 3.2 : 3.5 } : kind === 'ruin' ? { m: M.ruin, t: tint(0xc9c5a2), uvs: 2 } : { m: M.stoneM, t: tint(0xd6ceae), uvs: 2.4 };
    if (face === 'bottom') return { m: M.stoneM, t: tint(0x9c9682), uvs: 2.4 };
    if (kind === 'ruin') return { m: M.ruin, t: tint(0xd6cfae, 0.92 + hash2(Math.floor(x), Math.floor(z)) * 0.1), uvs: 2.6 };
    const fl = c0 !== undefined ? C.WD.groundAt(W, x + (n ? n[0] : 0) * 0.3, z + (n ? n[2] : 0) * 0.3, c0 + 0.05, 0.3) : -99;
    if (c1 !== undefined && c1 <= fl + 0.61 && c0 >= fl - 0.01) return { m: M.stoneM, t: tint(0xb8b29a), uvs: 1.6, trim: false };   // sokkel
    if (M.ashlar) {
      const covered = W.data && C.WD.raycastWorld(W, x + (n ? n[0] : 0) * 0.3, y, z + (n ? n[2] : 0) * 0.3, 0, 1, 0, 7) < 7;   // overdækkede rum (Cave, Red Room, House, Temple): rå sten, ingen stuk
      if (covered) return { m: M.ashlar, t: [0.92, 0.9, 0.82], uvs: 2.2, trim: false };
      if (RED(x, z) && c0 !== undefined && c1 <= fl + 3.21 && c0 >= fl + 0.59) return { m: M.ashlar, t: [1.12, 0.74, 0.6], uvs: 2.2, trim: false };   // rød stuk (falmet)
      return { m: M.ashlar, t: [1.18, 1.16, 1.06], uvs: 2.2, trim: false };
    }
    return { m: M.wall, t: AS ? [1.25, 1.22, 1.1] : tint(0xd2ccb0), uvs: 3, trim: false };
  }
  // stenblokke, alter, statuer, krukker
  function stoneLib() {
    const o = {};
    o.block = (B, b, h) => {
      const w = b.x1 - b.x0, d = b.z1 - b.z0, H = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, t = tint(0xcfc8b0, 0.85 + h * 0.2);
      if (H > 1.1 && h > 0.35) { const h1 = H * 0.55; B.box(M.stoneM, cx, b.y0 + h1 / 2, cz, w - 0.04, h1, d - 0.04, { tint: t, uvs: 1.6 }); B.box(M.mossStone, cx, b.y0 + h1 + (H - h1) / 2, cz, w * 0.9, H - h1 - 0.02, d * 0.9, { tint: t.map(v => v * 0.95), uvs: 1.4 }); }
      else B.box(M.stoneM, cx, b.y0 + H / 2 - 0.03, cz, w - 0.04, H - 0.06, d - 0.04, { tint: t, uvs: 1.6 });
      B.frustum(M.stoneM, cx, b.y0 + H - 0.06, cz, w - 0.04, d - 0.04, w * 0.84, d * 0.84, 0.06, { tint: t, uvs: 1.6 });
      B.sphere(M.mossStone, cx + w * 0.1, b.y0 + H - 0.01, cz - d * 0.1, w * 0.36, 0.08, d * 0.3, { seg: 7, tint: [0.65, 0.95, 0.45] });
    };
    o.altar = (B, b) => {
      const w = b.x1 - b.x0, d = b.z1 - b.z0, H = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, t = tint(0xd2c9ae);
      B.box(M.stoneM, cx, b.y0 + H * 0.12, cz, w - 0.02, H * 0.24, d - 0.02, { tint: t.map(v => v * 0.9), uvs: 1.6 });
      B.box(M.stoneM, cx, b.y0 + H * 0.36, cz, w * 0.86, H * 0.24, d * 0.86, { tint: t, uvs: 1.6 });
      B.box(M.mossStone, cx, b.y0 + H * 0.62, cz, w * 0.72, H * 0.28, d * 0.72, { tint: t, uvs: 1.4 });
      B.box(M.stoneM, cx, b.y0 + H * 0.87, cz, w * 0.8, H * 0.26, d * 0.8, { tint: t.map(v => v * 1.05), uvs: 1.6 });
    };
    o.statue = (B, b, h) => {
      const w = b.x1 - b.x0, d = b.z1 - b.z0, H = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, t = tint(0xb9b29a), ry = (h - 0.5) * 1.2;
      B.box(M.stoneM, cx, b.y0 + H * 0.14, cz, w - 0.02, H * 0.28, d - 0.02, { tint: t.map(v => v * 0.9), uvs: 1.4 });
      B.frustum(M.mossStone, cx, b.y0 + H * 0.28, cz, w * 0.62, d * 0.5, w * 0.5, d * 0.4, H * 0.36, { tint: t, uvs: 1.2, ry });
      B.sphere(M.stoneM, cx, b.y0 + H * 0.74, cz, w * 0.2, H * 0.12, d * 0.2, { seg: 8, tint: t, ry });
      B.box(M.stoneM, cx, b.y0 + H * 0.87, cz, w * 0.34, H * 0.05, d * 0.3, { tint: t.map(v => v * 1.05), ry });
    };
    o.urn = (B, b, h) => {
      const w = Math.min(b.x1 - b.x0, b.z1 - b.z0), H = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, t = tint(0xc77a46, 0.9 + h * 0.2);
      B.cyl(M.stoneM, cx, b.y0, cz, w * 0.22, w * 0.3, H * 0.12, { seg: 12, tint: t.map(v => v * 0.8), uvs: 1, caps: false });
      B.sphere(M.stoneM, cx, b.y0 + H * 0.42, cz, w * 0.42, H * 0.32, w * 0.42, { seg: 12, tint: t });
      B.cyl(M.stoneM, cx, b.y0 + H * 0.68, cz, w * 0.26, w * 0.16, H * 0.2, { seg: 12, tint: t, uvs: 1, caps: false });
      B.cyl(M.stoneM, cx, b.y0 + H * 0.86, cz, w * 0.22, w * 0.27, H * 0.1, { seg: 12, tint: t.map(v => v * 0.85), uvs: 1 });
    };
    o.serpent = (B, b) => {                         // v14: fjerprydet slangehoved (Kukulkan) ved trappefoden: blok-hoved, åbent gab, øjne, hugtænder, fjerkrave
      const w = b.x1 - b.x0, d = b.z1 - b.z0, H = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, t = tint(0xd0c8ac), fz = -1;   // gabet vender mod syd (+z)
      const front = cz + d / 2, back = cz - d / 2;
      B.box(M.stoneM, cx, b.y0 + H * 0.22, cz, w, H * 0.44, d, { tint: t.map(v => v * 0.92), uvs: 1.2 });                 // underkæbe/plint
      B.box(M.stoneM, cx, b.y0 + H * 0.74, cz - 0.08, w, H * 0.52, d - 0.16, { tint: t, uvs: 1.2 });                      // overkæbe
      B.box(M.dark, cx, b.y0 + H * 0.47, front - 0.18, w * 0.8, H * 0.1, 0.36, { tint: [0.08, 0.07, 0.06] });            // gabet
      for (const s2 of [-1, 1]) {
        B.box(M.stoneM, cx + s2 * w * 0.3, b.y0 + H * 0.42, front - 0.08, 0.08, H * 0.12, 0.08, { tint: tint(0xe6dfc8) });   // hugtænder
        B.sphere(M.stoneM, cx + s2 * (w / 2 - 0.02), b.y0 + H * 0.8, front - 0.45, 0.06, 0.12, 0.12, { seg: 8, tint: tint(0xa89a78) });   // øjne
        B.box(M.stoneM, cx + s2 * (w / 2 - 0.04), b.y0 + H * 0.95, front - 0.45, 0.1, 0.06, 0.3, { tint: t.map(v => v * 0.85) });   // øjenbryn
      }
      for (let i = 0; i < 5; i++) B.box(M.mossStone, cx, b.y0 + H + 0.05 + i * 0.002, back + 0.15 + i * 0.22, w * (1.15 - i * 0.05), 0.1, 0.2, { tint: t.map(v => v * (0.85 + (i % 2) * 0.1)), detail: true });   // fjerkrave
      B.box(M.stoneM, cx, b.y0 + H * 1.02, front - 0.2, w * 0.7, 0.06, 0.25, { tint: t.map(v => v * 0.9), detail: true });   // snude
    };
    return o;
  }
  Object.assign(M, stoneLib());
  // fakler med fast afstand (hver 10. m) på lange mure, kun den ene side af hver gang
  const lamps = [];
  for (const r of wallRuns(6)) {
    if (r.nx + r.nz < 0 || r.open === false) continue;                 // overdækkede rum får deres egne (få) fakler fra banedata
    const len = r.a1 - r.a0, n = Math.max(1, Math.round(len / 10)), step = len / n;
    for (let i = 0; i < n; i++) { const a = r.a0 + step * (i + 0.5), x = r.alongX ? a : r.fixed + r.nx * 0.25, z = r.alongX ? r.fixed + r.nz * 0.25 : a, y = r.L + 2.4; if (!C.insideSolid(x, y, z, false)) lamps.push({ x, y, z, n: [r.nx, r.nz], fix: 'torch', color: 0xff9a40, i: 0.9, range: 9 }); }
  }
  // fontæne (bassin med kant og midtersøjle)
  M.fountain = (B, b) => {
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, r = Math.min(b.x1 - b.x0, b.z1 - b.z0) / 2, H = b.y1 - b.y0, t = tint(0xd8d0b2);
    B.cyl(M.stoneM, cx, b.y0, cz, r, r * 0.97, H * 0.55, { seg: 24, tint: t, uvs: 1.4 });
    B.cyl(M.stoneM, cx, b.y0 + H * 0.55, cz, r * 0.97, r * 0.97, 0.12, { seg: 24, tint: t.map(v => v * 1.05), uvs: 1.4 });
    B.cyl(M.mossStone, cx, b.y0 + H * 0.67, cz, r * 0.8, r * 0.8, 0.02, { seg: 24, tint: [0.45, 0.6, 0.4] });
    B.cyl(M.stoneM, cx, b.y0 + H * 0.67, cz, 0.35, 0.28, H * 0.33, { seg: 12, tint: t, uvs: 1 });
    B.sphere(M.mossStone, cx, b.y0 + H, cz, 0.42, 0.22, 0.42, { seg: 12, tint: [0.7, 0.9, 0.55] });
  };
  for (const [x, y, z, nx, nz] of AD.torches || []) lamps.push({ x, y, z, n: [nx, nz], fix: 'torch', color: 0xffb070, i: 0.6, range: 8 });   // ekstra fakler i mørke rum (Cave)
  function dressProp(B, b, h, ctx) { const st = b.style || 'block'; if (st === 'urn' && ctx && ctx.modelInBox('antique_ceramic_vase_01', null, b, { yaw: h * TAU, tint: [0.72, 0.5, 0.34] })) return; if (st === 'crate') return M.crate(B, b, h, [0x9a7a4a, 0x8a6a3e]); if (M[st]) return M[st](B, b, h, undefined, ctx); return M.block(B, b, h); }
  function dressCyl(B, c) {
    const H = c.y1 - c.y0, r = c.r, h = hash2(c.x, c.z), t = tint(0xd9d2b4, 0.9 + h * 0.12);
    if (c.style === 'stump') {                         // knækket søjlestump (flad top – man kan stå på den)
      B.cyl(M.mossStone, c.x, c.y0, c.z, r, r * 0.97, H - 0.08, { seg: 16, tint: t, uvs: 1.6, caps: false });
      B.cyl(M.stoneM, c.x, c.y0 + H - 0.08, c.z, r * 0.97, r * 0.92, 0.08, { seg: 16, tint: t.map(v => v * 1.05), uvs: 1.4 });
      for (let y = c.y0 + 0.9; y < c.y0 + H - 0.3; y += 1.2) B.cyl(M.stoneM, c.x, y, c.z, r * 1.02, r * 1.02, 0.1, { seg: 16, tint: t.map(v => v * 0.86), uvs: 1, caps: false });
      ivyPatch(B, M, c.x + r * 0.98, c.y0 + H, c.z, 1, 0, 0.5, H * 0.75);
      return;
    }
    const rr = Math.max(r, 0.6);                       // hel søjle med base og kapitæl
    B.box(M.stoneM, c.x, c.y0 + 0.17, c.z, rr * 2.3, 0.34, rr * 2.3, { tint: t.map(v => v * 0.9), uvs: 1.4 }); B.box(M.stoneM, c.x, c.y0 + 0.4, c.z, rr * 1.9, 0.12, rr * 1.9, { tint: t, uvs: 1.4 });
    B.cyl(M.mossStone, c.x, c.y0 + 0.46, c.z, rr * 0.92, rr * 0.84, H - 0.96, { seg: 16, tint: t, uvs: 1.6, caps: false });
    for (let y = c.y0 + 1.4; y < c.y0 + H - 1.0; y += 1.35) B.cyl(M.stoneM, c.x, y, c.z, rr * 0.95, rr * 0.95, 0.12, { seg: 16, tint: t.map(v => v * 0.88), uvs: 1, caps: false });
    B.frustum(M.stoneM, c.x, c.y0 + H - 0.5, c.z, rr * 1.4, rr * 1.4, rr * 2.1, rr * 2.1, 0.4, { tint: t, uvs: 1.4 }); B.box(M.stoneM, c.x, c.y0 + H - 0.05, c.z, rr * 2.3, 0.12, rr * 2.3, { tint: t.map(v => v * 1.05), uvs: 1.4 });
    for (let i = 0; i < 2; i++) { const a = i * TAU / 2 + h * 6; ivyPatch(B, M, c.x + Math.cos(a) * rr * 0.9, c.y0 + H - 0.5, c.z + Math.sin(a) * rr * 0.9, Math.cos(a), Math.sin(a), 0.7, H * (0.45 + h * 0.3)); }
  }
  const dressLadder = (B, l) => ladderModel(B, M.wood, l, tint(0x7a5634), false);
  const dressRail = (B, b) => railing(B, M.wood, b, tint(0x6a4a2a), { toe: false });
  const dressLamp = (B, Lp) => lampFixture(B, M, Lp);
  const doorStyle = d => ({ matOpts: { color: 0x7a5a3a, map: M.wood.map }, build: (w, h, m) => doorLeaf(w, h, m, 'wood') });
  // skybox-ring: tæt junglekrone, klippeblokke og en trappepyramide (tempel) i horisonten
  function skyline(ctx) {
    const D = L.D, SB = new C.Batch(4096, 'skyline', { shadow: false }), bk = [0, 0, 0, 0.9], o = x => Object.assign({ bake: bk, shadow: false }, x);
    let temple = false;
    for (const sl of D.ringSlots(31, { gap: 5, ring2: 14, wMin: 5, wMax: 9, dMin: 5, dMax: 8, gapVar: 1.5 })) {
      const R = rnd(Math.floor(Math.abs(sl.x * 9.7 + sl.z * 4.3)) + 4);
      if (sl.ring === 1 && !temple && sl.r > 0.7) {                            // trappepyramide med helligdom på toppen
        temple = true; const cx = sl.x - sl.nx * 10, cz = sl.z - sl.nz * 10, t = tint(0xc9c2a2);
        for (let i = 0; i < 7; i++) { const s2 = 22 - i * 2.8; SB.box(i % 2 ? M.mossStone : M.stoneM, cx, 4 + i * 2.6 + 1.3, cz, s2, 2.6, s2, o({ tint: t.map(v => v * (0.9 + (i % 2) * 0.08)), uvs: 2.4 })); }
        SB.box(M.stoneM, cx, 4 + 7 * 2.6 + 1.8, cz, 4.4, 3.6, 4.4, o({ tint: t, uvs: 1.6 })); SB.box(M.stoneM, cx, 4 + 7 * 2.6 + 3.9, cz, 5.2, 0.6, 5.2, o({ tint: t.map(v => v * 1.05), uvs: 1.6 }));
        wallCard(SB, M.dark, cx + sl.nx * 2.21, 4 + 7 * 2.6 + 1.4, cz + sl.nz * 2.21, sl.nx, sl.nz, 1.4, 2.0, o({ tint: [0.06, 0.06, 0.05], off: 0.02, bake: [0, 0, 0, 0.1] }));
        for (let i = 0; i < 9; i++) { const a = R() * TAU; ivyPatch(SB, M, cx + Math.cos(a) * 9, 4 + 4 + R() * 8, cz + Math.sin(a) * 9, Math.cos(a), Math.sin(a), 0.9, 4 + R() * 4); }
        continue;
      }
      // fotoscannede klippeblokke: kun inderste ring, én ad gangen, de letteste varianter (≈ 5–8k trekanter), afstands-LOD
      const rocks = ['rock_moss_set_01_rock03', 'rock_moss_set_02_rock08', 'rock_moss_set_02_rock09', 'rock_moss_set_02_rock12'].map(p => [p.startsWith('rock_moss_set_01') ? 'rock_moss_set_01' : 'rock_moss_set_02', p]).filter(rk => ctx.modelParts(rk[0]).includes(rk[1]));
      if (rocks.length && sl.ring === 0 && R() < 0.35) { const rk = rocks[Math.floor(R() * rocks.length)]; ctx.model(rk[0], rk[1], sl.x + (R() - 0.5) * 3, 6.5 + R() * 1.5, sl.z + (R() - 0.5) * 3, R() * TAU, 2.6 + R() * 1.4, { shadow: false, detail: true }); }
      else if (R() < 0.3) { const t = tint(0x9a9580); for (let i = 0; i < 3; i++) SB.sphere(M.mossStone, sl.x + (R() - 0.5) * 4, 7 + R() * 3, sl.z + (R() - 0.5) * 4, 3 + R() * 2, 3.5 + R() * 3, 3 + R() * 2, o({ seg: 8, tint: t })); }   // klippeblokke
      jungleTree(SB, M, sl.x, 4.5 + R() * 2, sl.z, 1.5 + R() * 0.9 + sl.ring * 0.4);
    }
    ctx.extra.push(SB);
  }
  function decor(ctx) {
    const { B } = ctx;
    skyline(ctx);
    // mikro-detaljer: mos- og fugtskjolder, revner langs murene; nedfaldne blade og mospletter på stenbelægningen
    const Di = L.D.ID;
    ctx.decals = L.D.place(ctx, { wallSet: [Di.moss, Di.crack, Di.stain, Di.moss, Di.crack], wallStep: 5.5, floorSet: [Di.leaves, Di.moss, Di.crack, Di.leaves, Di.leaves], floorStep: 4.5, floorDensity: 0.5, tint: { [Di.stain]: [0.75, 0.85, 0.7] } });
    // træer (stammen står på banens kollisions-søjle) og plantebede (stenkant, jord, bregner/buske i fast rytme)
    for (const d of W.deco) {
      if (d.t === 'tree') { const y = C.WD.groundAt(W, d.x, d.z + 0.6, 3, 3); jungleTree(B, M, d.x, y === -Infinity ? 0 : y, d.z, d.s); }
      else if (d.t === 'bed') {
        const cx = (d.x0 + d.x1) / 2, cz = (d.z0 + d.z1) / 2, w = d.x1 - d.x0, dd = d.z1 - d.z0, y = d.y || 0, along = w >= dd, L = along ? w : dd;
        B.box(M.ground || M.stoneM, cx, y + 0.06, cz, w, 0.12, dd, { tint: M.ground ? [1, 1, 1] : tint(0x6b5a40), uvs: 2 });
        const n = Math.max(1, Math.floor(L / 1.5));
        const pickPlant = (x, z, hh) => {                                       // v13: blandet tropisk bed (fotoscannede CC0-planter fra Poly Haven; modellerne er stueplanter ≈ 0,45 m → skaleret til jungle-størrelse)
          const k = hh < 0.35 ? ['calathea_orbifolia_01', 3.0] : hh < 0.6 ? ['shrub_03', 3.2] : hh < 0.85 ? ['fern_02', 2.6] : ['anthurium_botany_01', 2.6];
          let pp = ctx.modelParts(k[0]); if (k[0] === 'anthurium_botany_01') pp = pp.filter(n => /_e$|_f$/.test(n));   // de letteste varianter
          return pp.length && ctx.model(k[0], pp[Math.floor(hash2(z, x) * 97) % pp.length], x, y + 0.1, z, hh * TAU, k[1] * (0.85 + hash2(x, z * 3) * 0.4), { detail: true });
        };
        for (let i = 0; i < n; i++) { const a = (along ? d.x0 : d.z0) + (i + 0.5) * L / n, x = along ? a : cx, z = along ? cz : a; const fp = ctx.modelParts('fern_02'), sp = ctx.modelParts('shrub_02'), hh = hash2(x, z);
          if (pickPlant(x, z, hh)) { if (i % 3 === 1) grassTuft(B, M, x + (along ? 0.5 : 0.25), y + 0.1, z + (along ? 0.25 : 0.5), 0.7); continue; }
          if (i % 2) { if (!(fp.length && ctx.model('fern_02', fp[Math.floor(hh * fp.length)], x, y + 0.1, z, hh * TAU, 1.1 + hh * 0.4, { detail: true }))) fern(B, M, x, y + 0.1, z, 0.9); }
          else if (!(i % 4 === 0 && sp.includes('shrub_02_b') && ctx.model('shrub_02', hh < 0.5 ? 'shrub_02_b' : 'shrub_02_d', x, y + 0.1, z, hh * TAU, 0.7, { detail: true }))) {   // fotoscannet busk ved hvert 4. punkt (letteste varianter), ellers bregne
            if (!(fp.length && ctx.model('fern_02', fp[Math.floor(hh * fp.length)], x, y + 0.1, z, hh * TAU, 1.0 + hh * 0.3, { detail: true }))) shrub(B, M, x, y + 0.1, z, 0.85, false);
          } if (i % 3 === 1) grassTuft(B, M, x + (along ? 0.6 : 0), y + 0.1, z + (along ? 0 : 0.6), 0.8); }
      }
    }
    // slyngplanter på alle mure med fast afstand (3,5 m), hængende fra murkronen
    // v13: efeu-tæpper fra murkronen (uregelmæssig rytme og størrelse) + lave planter og græs langs murfoden
    for (const r of wallRuns(3)) {
      const len = r.a1 - r.a0, n = Math.floor(len / 3.2);
      for (let i = 0; i < n; i++) {
        const a = r.a0 + (i + 0.5) * len / n + (hash2(i, r.fixed) - 0.5) * 1.2, x = r.alongX ? a : r.fixed, z = r.alongX ? r.fixed : a, hh = hash2(x, z);
        if (C.insideSolid(x + r.nx * 0.3, r.L + 1.5, z + r.nz * 0.3, false)) continue;
        let top = r.L + 1; while (top < r.L + 12 && C.insideSolid(x - r.nx * 0.1, top + 0.1, z - r.nz * 0.1, false)) top += 0.25;
        if (top - r.L < 2.2) continue;
        if (hh < 0.72) ivyPatch(B, M, x, top, z, r.nx, r.nz, 1.4 + hh * 1.6, Math.min(top - r.L - 0.6, 2.2 + hh * 3.2));
        const bx = x + r.nx * 0.45, bz = z + r.nz * 0.45;                       // murfod
        if (C.insideSolid(bx, r.L + 0.3, bz, false)) continue;
        if (hh > 0.55) { const wp = ctx.modelParts('weed_plant_02'); if (!(wp.length && ctx.model('weed_plant_02', wp[Math.floor(hh * 7) % wp.length], bx, r.L, bz, hh * TAU, 2.4, { detail: true }))) grassTuft(B, M, bx, r.L, bz, 0.9); }
        else if (hh > 0.3) grassTuft(B, M, bx, r.L, bz, 0.7 + hh);
        else { const sp = ctx.modelParts('shrub_sorrel_01'); if (sp.length) ctx.model('shrub_sorrel_01', sp[Math.floor(hh * 13) % sp.length], bx, r.L, bz, hh * TAU, 3.0, { detail: true }); }
      }
    }
    // obelisken på Plaza: relieffer på alle fire sider + topsten
    // v14: placeres efter selve kollisionsblokken (relieffer svævede 1 m foran, efter at Plaza blev flyttet)
    const OB = AD.obelisk, ob = OB && W.boxes.find(b => b.kind === 'wall' && Math.abs(b.x0 - OB[0]) < 0.01 && Math.abs(b.z0 - OB[1]) < 0.01 && b.y1 > 8.9);
    if (ob) {
      const ox = (ob.x0 + ob.x1) / 2, oz = (ob.z0 + ob.z1) / 2, hx = (ob.x1 - ob.x0) / 2, hz = (ob.z1 - ob.z0) / 2, fy = LM_ + 2.0;
      for (const [x, z, nx, nz] of [[ox, ob.z0, 0, -1], [ox, ob.z1, 0, 1], [ob.x0, oz, -1, 0], [ob.x1, oz, 1, 0]]) wallCard(B, M.relief, x, fy, z, nx, nz, 2.2, 2.2, { detail: false });
      B.box(M.stoneM, ox, LM_ + 0.2, oz, hx * 2 + 0.6, 0.4, hz * 2 + 0.6, { tint: tint(0xc6be9f), uvs: 1.4 });     // sokkel
      B.frustum(M.stoneM, ox, ob.y1, oz, hx * 2, hz * 2, 2.2, 2.2, 1.6, { tint: tint(0xcfc8a8), uvs: 2 });
    }
    L.siteWallLetters(B, '#a8442a');                                      // v14: site-bogstaver på murene (som i CS2)
    dressMaya(B, ctx);
    let nrel = 0; for (const r of wallRuns(5)) { if (nrel > 14 || hash2(r.a0, r.fixed) > 0.45) continue; const a = (r.a0 + r.a1) / 2, x = r.alongX ? a : r.fixed, z = r.alongX ? r.fixed : a; if (C.insideSolid(x + r.nx * 0.4, r.L + 1.6, z + r.nz * 0.4, false)) continue; wallCard(B, M.relief, x, r.L + 1.7, z, r.nx, r.nz, 1.5, 1.5, { detail: true }); nrel++; }
  }
  /* ---- v14: maya-arkitektur – fremspringende gesims og trappetakker på murkronerne, glyf-frise, tempelportaler, lavt vand i Mid ---- */
  const glyphTex = mkTex((c, w, h) => {                       // frise af firkantede glyffer (udhugget, med mos i fordybningerne)
    const R = rnd(83); c.fillStyle = '#bdb59c'; c.fillRect(0, 0, w, h); const n = 4, cw = w / n;
    for (let i = 0; i < n; i++) {
      const x0 = i * cw + 6, y0 = 6, s2 = Math.min(cw, h) - 12; P.bevel(c, x0, y0, cw - 12, h - 12, 'rgba(255,255,255,.28)', 'rgba(0,0,0,.45)');
      c.strokeStyle = 'rgba(45,40,28,.85)'; c.lineWidth = 6; c.lineCap = 'round';
      const k = Math.floor(R() * 4), cx = x0 + (cw - 12) / 2, cy = y0 + (h - 12) / 2, r = s2 * 0.32;
      if (k === 0) { c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke(); c.beginPath(); c.arc(cx, cy, r * 0.4, 0, TAU); c.stroke(); }
      else if (k === 1) { c.strokeRect(cx - r, cy - r, r * 2, r * 2); c.beginPath(); c.moveTo(cx - r, cy); c.lineTo(cx, cy - r); c.lineTo(cx + r, cy); c.lineTo(cx, cy + r); c.closePath(); c.stroke(); }
      else if (k === 2) { c.beginPath(); for (let j = 0; j < 4; j++) { c.moveTo(cx - r + j * r * 0.66, cy - r); c.lineTo(cx - r + j * r * 0.66, cy + r); } c.stroke(); c.beginPath(); c.arc(cx, cy - r * 1.05, r * 0.3, 0, TAU); c.stroke(); }
      else { c.beginPath(); c.moveTo(cx - r, cy + r); c.lineTo(cx - r, cy - r * 0.2); c.lineTo(cx, cy - r); c.lineTo(cx + r, cy - r * 0.2); c.lineTo(cx + r, cy + r); c.stroke(); c.beginPath(); c.arc(cx, cy + r * 0.2, r * 0.25, 0, TAU); c.stroke(); }
    }
    P.blobs(c, w, h, 30, 8, 30, '70,110,40', 0.45, R); P.speckle(c, w, h, 3000, 60, 220, 0.25, 2, R);
  }, 512, { w: 512, h: 128 });
  const waterTex = mkTex((c, w, h) => { const R = rnd(91); const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#2c5a50'); g.addColorStop(1, '#22463f'); c.fillStyle = g; c.fillRect(0, 0, w, h); for (let i = 0; i < 60; i++) { c.strokeStyle = `rgba(200,235,220,${0.05 + R() * 0.08})`; c.lineWidth = 1 + R() * 2; c.beginPath(); const x = R() * w, y = R() * h; c.ellipse(x, y, 10 + R() * 30, 3 + R() * 6, R() * 3, 0, TAU); c.stroke(); } }, 256);
  M.glyph = mat(glyphTex, { bump: 1.2 }); M.water = mat(waterTex, { rough: 0.06, metal: 0.45, transparent: true, opacity: 0.82, depthWrite: false, noWeather: true });
  function dressMaya(B, ctx) {
    const capT = tint(0xd2cab0), stepT = tint(0xc6be9f);
    for (const r of wallRuns(3)) {
      const len = r.a1 - r.a0, mid = (r.a0 + r.a1) / 2, at = (a, out) => r.alongX ? [a, r.fixed + r.nz * out] : [r.fixed + r.nx * out, a];
      let top = r.L + 1; { const [x, z] = at(mid, -0.1); while (top < r.L + 12 && C.insideSolid(x, top + 0.1, z, false)) top += 0.25; }
      if (top - r.L < 3.5) continue;
      // fremspringende gesims 0,6 m under murkronen + trappetakker (maya-'tagkam') på kronen
      const [gx, gz] = at(mid, 0.12); B.box(M.stoneM, gx, top - 0.55, gz, r.alongX ? len : 0.24, 0.3, r.alongX ? 0.24 : len, { tint: capT, uvs: 1.4 });
      const [hx, hz] = at(mid, 0.06); B.box(M.stoneM, hx, top - 0.82, hz, r.alongX ? len : 0.12, 0.12, r.alongX ? 0.12 : len, { tint: stepT, uvs: 1.4, detail: true });
      const nM = Math.floor(len / 1.8);
      for (let i = 0; i < nM; i++) { const a = r.a0 + (i + 0.5) * len / nM, [x, z] = at(a, -0.35); if (!C.insideSolid(x, top - 0.2, z, false)) continue;
        const ty = 20 - C.WD.raycastWorld(W, x, 20, z, 0, -1, 0, 20); if (Math.abs(ty - top) > 0.6) continue;     // præcis murkrone under takken
        B.box(M.stoneM, x, ty + 0.3, z, r.alongX ? 0.9 : 0.6, 0.6, r.alongX ? 0.6 : 0.9, { tint: stepT, uvs: 1 }); B.box(M.stoneM, x, ty + 0.75, z, r.alongX ? 0.5 : 0.4, 0.3, r.alongX ? 0.4 : 0.5, { tint: capT, uvs: 1 }); }
      // glyf-frise over stuk-zonen på lange mure
      if (len >= 4) { const fy = r.L + 3.55, n2 = Math.floor(len / 2.2);
        for (let i = 0; i < n2; i++) { const a = r.a0 + (i + 0.5) * len / n2, [x, z] = at(a, 0); if (C.insideSolid(x + r.nx * 0.3, fy, z + r.nz * 0.3, false) || !C.insideSolid(x - r.nx * 0.1, fy, z - r.nz * 0.1, false)) continue;
          wallCard(B, M.glyph, x, fy, z, r.nx, r.nz, len / n2 - 0.06, 0.5, { off: 0.03, detail: true, tint: [1.05, 1.02, 0.92] }); }
        const [bx, bz] = at(mid, 0.05); B.box(M.stoneM, bx, r.L + 3.24, bz, r.alongX ? len : 0.1, 0.08, r.alongX ? 0.1 : len, { tint: capT, uvs: 1, detail: true });
      }
    }
    // tempelportaler: mørk dør med stenkarm, overligger og maske-relieffer på A-templets nordmur og CT-tempelpladsens nordmur
    for (const [x, y, z] of (AD.portals || []).map(p => [p[0], p[1], p[2] + 0.05])) {
      const n = { nx: 0, ny: 0, nz: 0 }, t = C.WD.raycastWorld(W, x, y + 1.5, z + 3, 0, 0, -1, 8, n); if (t >= 8) continue;
      const wz = z + 3 - t;
      wallCard(B, M.dark, x, y + 1.6, wz, 0, 1, 2.2, 3.2, { off: 0.02, tint: [0.05, 0.045, 0.04], bake: [0, 0, 0, 0.15] });
      for (const s2 of [-1, 1]) B.box(M.stoneM, x + s2 * 1.35, y + 1.7, wz + 0.15, 0.5, 3.4, 0.3, { tint: capT, uvs: 1.2 });
      B.box(M.stoneM, x, y + 3.55, wz + 0.18, 3.4, 0.5, 0.36, { tint: capT, uvs: 1.2 });
      for (const s2 of [-1, 1]) wallCard(B, M.relief, x + s2 * 3.0, y + 2.4, wz, 0, 1, 1.8, 1.8, { off: 0.03 });
      B.box(M.stoneM, x, y + 4.1, wz + 0.12, 5.2, 0.6, 0.24, { tint: stepT, uvs: 1.2 });
    }
    // lavt vand (vandkanalen i Mid, bassinet på B) – ankeldybt med sten der stikker op, kantsten langs kanten (som Water i CS2-Ancient)
    let wi = 0;
    for (const [x0, z0, x1, z1, wy] of AD.water || []) {
      const w = x1 - x0, d = z1 - z0, sy = wy + 0.2;
      B.box(M.water, (x0 + x1) / 2, wy + 0.17, (z0 + z1) / 2, w - 0.02, 0.01, d - 0.02, { tint: [1, 1, 1], shadow: false, noBottom: true });
      const nr = Math.max(2, Math.round(w * d / 9));
      for (let i = 0; i < nr; i++, wi++) { const x = x0 + 0.4 + hash2(wi, 3.3) * (w - 0.8), z = z0 + 0.4 + hash2(7.7, wi) * (d - 0.8); if (C.insideSolid(x, wy + 0.3, z, false)) continue;
        B.sphere(M.mossStone, x, wy + 0.04, z, 0.2 + hash2(wi, wi) * 0.25, 0.14 + hash2(z, wi) * 0.08, 0.18 + hash2(x, wi) * 0.2, { seg: 7, tint: tint(0x9a9580), detail: true }); }
      // kantsten oven på gulvkanten hvor vandet møder gulvet (ikke mod mure, ikke mellem to vandstykker)
      const inWater = (x, z) => (AD.water || []).some(q => x > q[0] && x < q[2] && z > q[1] && z < q[3]);
      for (const [ex, ez, ew, ed, ox, oz] of [[(x0 + x1) / 2, z0, w, 0.3, 0, -1], [(x0 + x1) / 2, z1, w, 0.3, 0, 1], [x0, (z0 + z1) / 2, 0.3, d, -1, 0], [x1, (z0 + z1) / 2, 0.3, d, 1, 0]]) {
        const n = Math.max(1, Math.round((ew > ed ? ew : ed) / 1.0)), L2 = ew > ed ? ew : ed;
        for (let k = 0; k < n; k++) {
          const t = -L2 / 2 + (k + 0.5) * L2 / n, cx2 = ex + (ew > ed ? t : 0) + ox * 0.15, cz2 = ez + (ew > ed ? 0 : t) + oz * 0.15;
          if (inWater(cx2, cz2) || C.insideSolid(cx2, wy + 0.7, cz2, false)) continue;
          const g = C.WD.groundAt(W, cx2, cz2, wy + 0.8, 0.1); if (g === -Infinity || g < wy + 0.1) continue;
          B.box(M.stoneM, cx2, g + 0.04, cz2, ew > ed ? L2 / n - 0.04 : 0.3, 0.08, ew > ed ? 0.3 : L2 / n - 0.04, { tint: tint(0xbcb59c, 0.9 + hash2(cx2, cz2) * 0.15), uvs: 1, detail: true });
        }
      }
    }
  }
  // v14: vandfaldet på B – rindende vandflade (animeret tekstur) ned ad nordmuren, skum i bunden og stænk-partikler
  function fx({ group, ups, THREE: T3, canvasTexture: CT, probe }) {
    for (const [x0, z, x1, y0, y1] of AD.falls || []) {
      const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2;
      const tex = CT((c, W2, H2) => { const R = rnd(17); c.fillStyle = 'rgba(190,225,220,0.35)'; c.fillRect(0, 0, W2, H2); for (let i = 0; i < 90; i++) { const x = R() * W2, l = 20 + R() * 90, a = 0.25 + R() * 0.5; const g = c.createLinearGradient(0, 0, 0, l); g.addColorStop(0, `rgba(255,255,255,0)`); g.addColorStop(0.5, `rgba(240,250,250,${a})`); g.addColorStop(1, `rgba(255,255,255,0)`); c.fillStyle = g; c.save(); c.translate(x, R() * H2); c.fillRect(-1 - R() * 2, 0, 2 + R() * 4, l); c.restore(); } }, 128, 256);
      tex.wrapS = tex.wrapT = T3.RepeatWrapping; tex.repeat.set(w / 2, h / 3);
      const pr = probe(cx, (y0 + y1) / 2, z + 0.6) || [0, 0, 0, 1], lum = 0.45 + 0.55 * (pr[3] === undefined ? 1 : pr[3]);
      const m = new T3.MeshBasicMaterial({ map: tex, color: new T3.Color(0.78 * lum, 0.9 * lum, 0.9 * lum), transparent: true, depthWrite: false, side: T3.DoubleSide });
      const sheet = new T3.Mesh(new T3.PlaneGeometry(w, h), m); sheet.position.set(cx, (y0 + y1) / 2, z + 0.12); group.add(sheet);
      const foamT = CT((c, W2, H2) => { const g = c.createRadialGradient(W2 / 2, H2 / 2, 0, W2 / 2, H2 / 2, W2 / 2); g.addColorStop(0, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, W2, H2); }, 64, 64);
      const foam = new T3.Mesh(new T3.PlaneGeometry(w + 1.2, 1.6), new T3.MeshBasicMaterial({ map: foamT, color: new T3.Color(0.85 * lum, 0.95 * lum, 0.95 * lum), transparent: true, depthWrite: false }));
      foam.rotation.x = -Math.PI / 2; foam.position.set(cx, y0 + 0.2, z + 0.9); group.add(foam);
      const N = 40, sg = new T3.BufferGeometry(), pos = new Float32Array(N * 3), seeds = Array.from({ length: N }, (_, i) => [Math.random(), Math.random(), Math.random()]);
      sg.setAttribute('position', new T3.BufferAttribute(pos, 3));
      const spray = new T3.Points(sg, new T3.PointsMaterial({ map: foamT, size: 0.35, transparent: true, depthWrite: false, opacity: 0.55, color: new T3.Color(0.9 * lum, 0.97 * lum, 1.0 * lum) }));
      spray.frustumCulled = false; group.add(spray);
      ups.push((dt, t) => {
        tex.offset.y = (t * 0.9) % 1;                                          // vandet strømmer nedad
        for (let i = 0; i < N; i++) { const [a, b, c2] = seeds[i], k = (t * (0.6 + c2 * 0.5) + a) % 1;
          pos[i * 3] = cx + (b - 0.5) * w; pos[i * 3 + 1] = y0 + 0.15 + Math.sin(k * Math.PI) * (0.5 + c2 * 0.6); pos[i * 3 + 2] = z + 0.3 + k * (0.8 + c2 * 0.8); }
        sg.attributes.position.needsUpdate = true; foam.material.opacity = 0.75 + Math.sin(t * 3.1) * 0.1;
      });
    }
  }
  const light = {
    sky: { hor: [1.0, 0.84, 0.6], mid: [0.62, 0.8, 0.82], top: [0.24, 0.52, 0.8], gnd: [0.26, 0.36, 0.22], sun: [1.0, 0.88, 0.6], cloud: 1.0 },
    sunColor: 0xffe0a0, sunInt: 1.3, sunPos: [48, 56, 34], hemiSky: 0xd8ecc8, hemiGround: 0x5c7c3e, hemiInt: 0.68, ambInt: 0.1, bg: 0xbcd0a0, fog: { color: 0xbfd2a4, near: 45, far: 150 },
    exposure: 1.0, minSky: 0.08
  };
  // vejrlig: mos og jord op ad murfoden, mørke fugtløb fra murkronerne, mospletter på stenbelægningen, grønlig makrovariation
  const weather = { macro: 0.26, macroCol: [0.9, 1.05, 0.84], grime: 0.85, grimeH: 1.15, grimeCol: [0.36, 0.44, 0.24], streak: 0.75, streakLen: 3.0, streakCol: [0.4, 0.45, 0.34], top: 0.4, topThr: 0.55, topCol: [0.16, 0.25, 0.07], topRough: 0.98 };
  // filmisk look: fugtig, varm jungle – gyldent lys gennem løvet (sol-stråler), grønne mellemtoner, blød dis
  const post = { sat: 1.05, contrast: 1.06, highTint: [1.05, 1.01, 0.9], shadowTint: [0.94, 1.03, 0.98], lift: [0.006, 0.01, 0.006], vignette: 0.24, sharpen: 0.18, shafts: 0.42, shaftCol: [1.0, 0.88, 0.6], mie: 0.45, mieCol: [1.0, 0.86, 0.58], mieDist: 70 };
  const ambient = { color: 0xf2eea0, count: 300, size: 0.03, alpha: 0.46, wind: [0.08, 0.05, 0.06] };   // pollen/frø der svæver i den fugtige luft
  const SKY = C.assets && C.assets.sky;
  if (SKY) {                                                                // v11: fotograferet formiddagshimmel – solens retning fra HDRI'en
    light.skyTex = SKY.tex; light.skyExp = 0.95; light.ibl = 0.5; light.hemiInt = 0.6; light.ambInt = 0.08; light.exposure = 1.05;
    if (SKY.sunDir[1] > 0.12) light.sunPos = SKY.sunDir.map(v => v * 80);
  }
  return { id: 'ancient', siteMark: 'assist', light, weather, post, ambient, bevel: 0.14, bevelKinds: { wall: 1, ruin: 1 }, lamps, mats: M, surfKinds, surf, trim: null, splitY: [0.6, 3.2, LA_ + 0.6, LA_ + 3.2, LB_ + 0.6, LB_ + 3.2, LM_ + 0.6, LM_ + 3.2], dressProp, dressCyl, dressLadder, dressRail, dressLamp, doorStyle, decor, fx, detailDist: 52 };
}
