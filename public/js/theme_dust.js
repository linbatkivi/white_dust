// ==========================================================================
// TEMA: de_white_dust – ørkenby i varm eftermiddagssol. Sandstensbrosten, kalkede murstensmure med pudsflager,
// træbjælkelofter i tunnelerne, lygter med fast afstand langs murene, palmer og tørre buske i plantebede.
// ==========================================================================
export function dustTheme(L) {
  const { THREE, W, P, mkTex, mat, rnd, hash2, tint, mix, T, TAU, orient, wallCard, floorCard, commonMats, railing, ladderModel, lampFixture, doorLeaf, wallRuns, nearestWall, palm, shrub, C } = L;
  const M = commonMats();

  /* ---------------- teksturer ---------------- */
  const paving = mkTex((c, w, h) => {                 // sandstensfliser (uregelmæssige rækker) med sand i fugerne
    const R = rnd(11); c.fillStyle = '#b9a785'; c.fillRect(0, 0, w, h);
    const rows = 6, rh = h / rows;
    for (let r = 0; r < rows; r++) { let x = -R() * 80; while (x < w) { const bw = 70 + R() * 90, v = 214 + R() * 26 | 0; c.fillStyle = `rgb(${v},${v - 14},${v - 42})`; c.fillRect(x + 3, r * rh + 3, bw - 6, rh - 6); P.bevel(c, x + 3, r * rh + 3, bw - 6, rh - 6, 'rgba(255,248,225,.35)', 'rgba(90,70,40,.35)'); x += bw; } }
    P.blobs(c, w, h, 26, 30, 120, '190,160,110', 0.16, R); P.blobs(c, w, h, 18, 30, 90, '250,240,215', 0.12, R);
    P.speckle(c, w, h, 5000, 130, 250, 0.28, 2, R); P.cracks(c, w, h, 6, 'rgba(80,60,35,.35)', 9, R);
    for (let i = 0; i < 50; i++) { c.fillStyle = 'rgba(70,55,35,.3)'; c.beginPath(); c.arc(R() * w, R() * h, 1 + R() * 2.5, 0, TAU); c.fill(); }
  }, 512);
  const brick = mkTex((c, w, h) => {                  // kalket mursten med pudsflager og støvede striber
    const R = rnd(23); c.fillStyle = '#c9b796'; c.fillRect(0, 0, w, h);
    for (let r = 0; r < 8; r++) for (let b = -1; b < 5; b++) { const x = b * 128 + (r % 2 ? 64 : 0), y = r * 64, v = 205 + R() * 34 | 0; c.fillStyle = `rgb(${v},${v - 12},${v - 36})`; c.fillRect(x + 3, y + 3, 122, 58); P.bevel(c, x + 3, y + 3, 122, 58, 'rgba(255,245,220,.32)', 'rgba(70,50,25,.32)'); }
    for (let i = 0; i < 5; i++) { const x = R() * w, y = R() * h, rw = 90 + R() * 150, rh = 60 + R() * 100; P.wrap(w, h, x, y, Math.max(rw, rh), (px, py) => { const g = c.createRadialGradient(px, py, 0, px, py, Math.max(rw, rh) / 2); g.addColorStop(0, 'rgba(236,226,204,.72)'); g.addColorStop(0.7, 'rgba(236,226,204,.6)'); g.addColorStop(1, 'rgba(236,226,204,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(px, py, rw / 2, rh / 2, 0.3, 0, TAU); c.fill(); }); }   // puds (bløde kanter)
    P.blobs(c, w, h, 22, 40, 120, '120,90,55', 0.09, R); P.streaks(c, w, h, 16, '90,65,35', 0.13, 80, 260, 10, R); P.cracks(c, w, h, 6, 'rgba(60,45,25,.3)', 10, R); P.speckle(c, w, h, 4500, 70, 255, 0.16, 2, R);
  }, 512);
  const planks = mkTex((c, w, h) => {                 // træbjælkeloft
    const R = rnd(27); c.fillStyle = '#5b4632'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) { const v = 110 + R() * 40 | 0; c.fillStyle = `rgb(${v},${v - 30},${v - 60})`; c.fillRect(0, i * h / 6 + 3, w, h / 6 - 6); for (let k = 0; k < 30; k++) { c.strokeStyle = 'rgba(40,25,10,.25)'; c.beginPath(); const y = i * h / 6 + 6 + R() * (h / 6 - 12); c.moveTo(R() * w, y); c.lineTo(R() * w, y + (R() - 0.5) * 3); c.stroke(); } }
    P.speckle(c, w, h, 1500, 30, 120, 0.25, 2, R);
  }, 256);
  Object.assign(M, { floor: mat(paving, { bump: 0.8 }), wall: mat(brick, { bump: 0.9 }), ceil: mat(planks, { bump: 0.6 }), bark: mat(T.wood()), frond: L.leafMat(T.frond(), true), dry: L.leafMat(T.dry(), true), broad: L.leafMat(T.broad(), true) });

  const FL = [[1.2, tint(0xf3dcae)], [0, tint(0xeedfc0)], [-0.8, tint(0xd3d4bd)], [-1.8, tint(0xc8b896)], [3.2, tint(0xe6d3ad)], [2.8, tint(0xe6d3ad)]];
  const nearestFloor = y => { let b = FL[0]; for (const f of FL) if (Math.abs(f[0] - y) < Math.abs(b[0] - y)) b = f; return b[1]; };
  const WA = tint(0xe9bf93), WB = tint(0xc9cfc6), WM = tint(0xe9d6b3);
  const wallT = x => x > 14 ? WA : x < -14 ? WB : WM;
  const surfKinds = { floor: 1, wall: 1, ceil: 1, slab: 1, stone: 1, ruin: 1 };
  function surf(kind, face, b, x, y, z) {
    if (face === 'top') {
      if (kind === 'wall' || kind === 'ruin') return { m: M.wall, t: wallT(x).map(v => v * 0.92), uvs: 2 };
      if (kind === 'slab') return { m: M.wood, t: tint(0xc49456), uvs: 2 };
      return { m: M.floor, t: AS ? (kind === 'stone' ? [1.25, 1.12, 0.92] : nearestFloor(y).map(v => v * 1.18)) : kind === 'stone' ? tint(0xe8d6b0) : nearestFloor(y), uvs: AS ? 4 : 3 };
    }
    if (face === 'bottom') return kind === 'slab' ? { m: M.wood, t: tint(0x9a7046), uvs: 2 } : { m: M.ceil, t: AS ? [0.82, 0.62, 0.44] : [1, 1, 1], uvs: 2.5 };
    return { m: M.wall, t: wallT(x), uvs: 3.2, trim: kind !== 'slab' };
  }
  const trimM = { m: M.conc, t: tint(0xc9b28a), uvs: 1, h: 0.3, d: 0.06 };
  const trim = kind => kind === 'wall' ? trimM : null;

  /* ---------------- lys: lygter med fast afstand langs lange mure + lamper under tunneltage ---------------- */
  const lamps = [];
  for (const r of wallRuns(8)) {
    if (r.nx + r.nz < 0) continue;                       // kun mure der vender mod +x/+z (én side pr. gade => rytmisk, ikke spejlet)
    const len = r.a1 - r.a0, n = Math.max(1, Math.round(len / 11)), step = len / n;
    for (let i = 0; i < n; i++) {
      const a = r.a0 + step * (i + 0.5), x = r.alongX ? a : r.fixed + r.nx * 0.3, z = r.alongX ? r.fixed + r.nz * 0.3 : a, y = r.L + 3.0;
      if (C.insideSolid(x, y, z, false) || C.insideSolid(x, y - 1.5, z, false)) continue;
      lamps.push({ x, y, z, n: [r.nx, r.nz], fix: 'lantern', color: 0xffb060, i: 0.9, range: 9 });
    }
  }
  for (const b of W.boxes) if (b.kind === 'wall' && b.y1 >= 8.9 && b.y0 > 2 && b.y0 < 5 && (b.x1 - b.x0) >= 4 && (b.z1 - b.z0) >= 4) {
    const along = (b.x1 - b.x0) >= (b.z1 - b.z0), Ln = along ? b.x1 - b.x0 : b.z1 - b.z0, n = Math.max(1, Math.floor(Ln / 7));
    for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * Ln, x = along ? b.x0 + a : (b.x0 + b.x1) / 2, z = along ? (b.z0 + b.z1) / 2 : b.z0 + a; if (!C.insideSolid(x, b.y0 - 0.6, z, false)) lamps.push({ x, y: b.y0 - 0.45, z, fix: 'bay', hang: 0.3, color: 0xffc27a, i: 1.0, range: 10 }); }
  }

  function dressProp(B, b, h, ctx) {
    const w = b.x1 - b.x0, d = b.z1 - b.z0, H = b.y1 - b.y0, Lm = Math.max(w, d), st = b.style;
    if (st && M[st]) return M[st](B, b, h, undefined, ctx);
    if (Lm >= 5 && H >= 2) return M.container(B, b, h);
    if (Lm >= 3.5 && Math.min(w, d) >= 2.5 && H <= 1.0) return M.plinth(B, b, h);   // lav, bred platform (fx på A-site) – ikke en flad 'container'
    if (Lm >= 2.8 && H <= 1.2) return h < 0.5 ? M.sandbags(B, b, h) : M.barrier(B, b, h, false);
    if (w <= 1.7 && d <= 1.7 && H <= 1.25 && h < 0.3) return L.modelBarrels(ctx, b, 'wine_barrel_01') || M.barrel(B, b, h);
    if (Lm >= 2.2 && H <= 1.1 && h > 0.8) return M.pallet(B, b, h);
    return M.crate(B, b, h);
  }
  // stenplint: kalket murkerne med mørkere sokkel + afrundet fliseoverkant præcis i kollisionens tophøjde (man står på den)
  M.plinth = (B, b, h) => {
    const w = b.x1 - b.x0, d = b.z1 - b.z0, H = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, t = WM.map(v => v * (0.9 + h * 0.08));
    B.box(M.wall, cx, b.y0 + (H - 0.1) / 2, cz, w - 0.06, H - 0.1, d - 0.06, { tint: t, uvs: 2.2, noTop: true });
    B.box(M.conc, cx, b.y0 + 0.09, cz, w - 0.02, 0.18, d - 0.02, { tint: tint(0xb39a74), uvs: 1.2, noTop: true });
    B.frustum(M.floor, cx, b.y1 - 0.1, cz, w, d, w - 0.05, d - 0.05, 0.1, { tint: nearestFloor(b.y1), uvs: 3 });
  };
  // v11.2: amfora og lerkrukker (fotoscannede modeller; procedurale reserver)
  M.amphora = (B, b, h, _, ctx) => {
    if (ctx && ctx.modelInBox('antique_ceramic_vase_01', null, b, { yaw: hash2(b.x0, b.z0) * TAU, tint: [0.86, 0.47, 0.28] })) return;   // terracotta-glasur: mønstret bliver mørkebrunt (malet amfora)
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, H = b.y1 - b.y0; B.sphere(M.conc, cx, b.y0 + H * 0.42, cz, 0.33, H * 0.42, 0.33, { seg: 12, tint: tint(0xb9744a) }); B.cyl(M.conc, cx, b.y0 + H * 0.78, cz, 0.14, 0.11, H * 0.22, { seg: 10, tint: tint(0xb9744a), caps: false });
  };
  M.jars = (B, b, h, _, ctx) => {
    if (L.modelRow(ctx, b, 'ceramic_vase_02', 3)) return;
    const w = b.x1 - b.x0, d = b.z1 - b.z0, along = w >= d;
    for (let i = 0; i < 3; i++) { const a = (along ? b.x0 : b.z0) + (along ? w : d) * (i + 0.5) / 3; B.sphere(M.conc, along ? a : (b.x0 + b.x1) / 2, b.y0 + 0.25, along ? (b.z0 + b.z1) / 2 : a, 0.15, 0.25, 0.15, { seg: 10, tint: tint(0xa8643c) }); }
  };
  const dressCyl = () => {};
  const dressLadder = (B, l) => ladderModel(B, M.wood, l, tint(0x9a7046), false);
  const dressRail = (B, b) => railing(B, M.wood, b, tint(0x7a5634), { toe: false });
  const dressLamp = (B, Lp) => lampFixture(B, M, Lp);
  const doorStyle = d => ({ matOpts: { color: M.door ? 0xffffff : 0x8a6440, map: (M.door || M.wood).map }, build: (w, h, m) => doorLeaf(w, h, m, 'wood') });

  // skodder-vindue (træramme, lukkede skodder, lille gesims) – til facader
  const shutter = mkTex((c, w, h) => {
    const R = rnd(41); c.fillStyle = '#3c2a1c'; c.fillRect(0, 0, w, h);
    for (const x0 of [8, w / 2 + 2]) { c.fillStyle = '#5a7a8c'; c.fillRect(x0, 8, w / 2 - 10, h - 16); for (let y = 16; y < h - 12; y += 10) { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x0 + 4, y, w / 2 - 18, 3); c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(x0 + 4, y + 3, w / 2 - 18, 1); } }
    P.blobs(c, w, h, 10, 10, 40, '200,190,160', 0.2, R); P.speckle(c, w, h, 900, 60, 220, 0.2, 2, R);
  }, 256, { w: 128, h: 192, clamp: true });
  M.shutter = mat(shutter);
  const awnTex = mkTex((c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#efe4cc' : '#a8382a'; c.fillRect(i * w / 8, 0, w / 8, h); } P.blobs(c, w, h, 12, 20, 60, '90,70,40', 0.18, rnd(5)); }, 256);
  M.awning = mat(awnTex);
  // terracotta-munkesten (rækker af buede tegl med skygge under hver række, lav og alger i pletter) – til skybox-tagene
  const tileTex = mkTex((c, w, h) => {
    const R = rnd(71), rows = 8, rh = h / rows, cols = 8, cw = w / cols;
    c.fillStyle = '#7a3a22'; c.fillRect(0, 0, w, h);
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const x = k * cw + (r % 2 ? cw / 2 : 0), y = r * rh, v = R();
      for (const ox of [0, -w]) { const g = c.createLinearGradient(x + ox, 0, x + ox + cw, 0); g.addColorStop(0, `rgb(${120 + v * 30 | 0},${52 + v * 18 | 0},${30 + v * 10 | 0})`); g.addColorStop(0.45, `rgb(${196 + v * 40 | 0},${102 + v * 30 | 0},${62 + v * 20 | 0})`); g.addColorStop(1, `rgb(${110 + v * 30 | 0},${48 + v * 16 | 0},${28 + v * 8 | 0})`); c.fillStyle = g; c.fillRect(x + ox + 1, y, cw - 2, rh - 3); }
      c.fillStyle = 'rgba(40,16,8,.55)'; c.fillRect(x, y + rh - 4, cw, 4);
    }
    P.blobs(c, w, h, 16, 20, 70, '60,70,40', 0.22, R); P.blobs(c, w, h, 10, 20, 60, '230,210,180', 0.14, R); P.speckle(c, w, h, 2500, 40, 200, 0.18, 2, R);
  }, 512);
  const cypTex = mkTex((c, w, h) => { const R = rnd(73); c.fillStyle = '#1f3a1e'; c.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { const v = R(); c.fillStyle = `rgba(${30 + v * 50 | 0},${60 + v * 60 | 0},${28 + v * 30 | 0},.7)`; c.beginPath(); c.ellipse(R() * w, R() * h, 3 + R() * 5, 6 + R() * 8, R() * 3, 0, TAU); c.fill(); } }, 256);
  M.roofTile = mat(tileTex, { bump: 1.0, rough: 0.82 }); M.cypress = mat(cypTex, { bump: 1.2, rough: 0.95, noWeather: true });
  /* ---- v11: fotoscannede CC0-materialer (Poly Haven) når de er indlæst – ellers de procedurale ovenfor ---- */
  const AS = C.assets && C.assets.tex;
  if (AS) {
    const S = (n, o) => C.pbrMat(AS[n], o);
    Object.assign(M, {
      wall: S('sandstone_blocks_08', { normal: 1.3 }), floor: S('large_sandstone_blocks_01'), ceil: S('brown_planks_05'), wood: S('brown_planks_05'),
      house: S('clay_plaster', { normal: 1.2 }), stoneWall: S('plastered_stone_wall'), roofTile: S('clay_roof_tiles', { normal: 1.2 }), door: S('wood_shutter')
    });
    for (const [k, c] of [['frond', [0.7, 0.76, 0.55]], ['broad', [0.66, 0.74, 0.52]], ['dry', [0.85, 0.8, 0.68]]]) if (M[k]) M[k].color.setRGB(c[0], c[1], c[2]);   // naturlige toner
  }
  // skybox-ring: middelhavsby uden for banen (aldrig over spilbart område – se details.ringSlots)
  function skyline(ctx) {
    const D = L.D, SB = new C.Batch(4096, 'skyline', { shadow: false }), PAL = [0xefe0c2, 0xf0c98e, 0xeab49a, 0xdcd6c6, 0xf3dcae, 0xe2a77a].map(c => tint(c)), bk = [0, 0, 0, 0.95];
    let towers = 0;
    for (const sl of D.ringSlots(17, { gap: 5, ring2: 15, wMin: 6, wMax: 12, dMin: 6, dMax: 11 })) {
      const R = rnd(Math.floor(Math.abs(sl.x * 13.1 + sl.z * 7.7)) + 1), tw = sl.ring === 1 && towers < 2 && sl.r > 0.82;
      const H = tw ? 23 + R() * 5 : sl.ring ? 14.5 + R() * 7 : 12 + R() * 4.5, y0 = 5, wc = PAL[Math.floor(R() * PAL.length)];
      const w = tw ? 4.4 : sl.alongX ? sl.w : sl.d, d = tw ? 4.4 : sl.alongX ? sl.d : sl.w;
      SB.box(M.house || M.wall, sl.x, y0 + (H - y0) / 2, sl.z, w, H - y0, d, { tint: wc, uvs: 3.2, bake: bk, shadow: false, noBottom: true, wear: [y0 - 50, H, 1] });
      if (tw) {                                                               // klokketårn: glamhuller, gesimser, pyramidetag med spir
        towers++;
        for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) wallCard(SB, M.dark, sl.x + nx * 2.2, H - 2.2, sl.z + nz * 2.2, nx, nz, 1.3, 2.2, { bake: [0, 0, 0, 0.15], tint: [0.08, 0.07, 0.06], off: 0.02 });
        SB.box(M.wall, sl.x, H - 3.6, sl.z, w + 0.4, 0.35, d + 0.4, { tint: wc.map(v => v * 0.9), uvs: 1, bake: bk, shadow: false });
        SB.box(M.wall, sl.x, H + 0.15, sl.z, w + 0.5, 0.3, d + 0.5, { tint: wc.map(v => v * 0.92), uvs: 1, bake: bk, shadow: false });
        D.roof(SB, M.roofTile, sl.x, sl.z, w, d, H + 0.3, 3.2, 0.3, { tint: [1, 0.95, 0.9], tu: AS ? 2.6 : 1.6, tv: AS ? 2.6 : 1.6 });
        SB.cyl(M.dark, sl.x, H + 3.4, sl.z, 0.04, 0.02, 1.6, { seg: 5, tint: [0.15, 0.13, 0.1], bake: bk, shadow: false });
        continue;
      }
      // tag: valm eller sadel; flade tage med brystning på enkelte (variation i silhuetten)
      const kind = R();
      if (kind < 0.16) { SB.box(M.wall, sl.x, H + 0.4, sl.z, w + 0.1, 0.8, d + 0.1, { tint: wc.map(v => v * 0.95), uvs: 2, bake: bk, shadow: false, noTop: true }); SB.box(M.wall, sl.x, H + 0.05, sl.z, w - 0.3, 0.1, d - 0.3, { tint: tint(0xb8a07c), uvs: 3, bake: bk, shadow: false }); }
      else D.roof(SB, M.roofTile, sl.x, sl.z, w, d, H, Math.min(w, d) * (0.24 + R() * 0.1), 0.45, { gable: kind > 0.62, gableMat: M.house || M.wall, gableTint: wc, tu: AS ? 2.6 : 1.6, tv: AS ? 2.6 : 1.6, tint: [1, 0.9 + R() * 0.15, 0.85 + R() * 0.2] });
      // vinduer med skodder på facaden mod banen (over murkronen) + overligger, enkelte altaner
      const fx = sl.x + sl.nx * (sl.alongX ? d : w) / 2, fz = sl.z + sl.nz * (sl.alongX ? d : w) / 2, Lw = sl.alongX ? w : d, nW = Math.max(1, Math.floor(Lw / 3));
      for (let fy = 9.6; fy < H - 1.4; fy += 3) for (let i = 0; i < nW; i++) {
        if (R() < 0.25) continue;
        const a = (i + 0.5) * Lw / nW - Lw / 2, x = fx + (sl.alongX ? a : 0), z = fz + (sl.alongX ? 0 : a);
        wallCard(SB, M.shutter, x, fy, z, sl.nx, sl.nz, 1.0, 1.5, { bake: bk, off: 0.03 });
        SB.box(M.wood, x + sl.nx * 0.08, fy + 0.85, z + sl.nz * 0.08, sl.alongX ? 1.3 : 0.16, 0.12, sl.alongX ? 0.16 : 1.3, { tint: tint(0x6a4a2a), uvs: 1, bake: bk, shadow: false });
        if (R() < 0.18) SB.box(M.wood, x + sl.nx * 0.35, fy - 0.8, z + sl.nz * 0.35, sl.alongX ? 1.4 : 0.7, 0.08, sl.alongX ? 0.7 : 1.4, { tint: tint(0x5a3a20), uvs: 1, bake: bk, shadow: false });
      }
      if (kind >= 0.16 && R() < 0.45) { const cxh = sl.x + (R() - 0.5) * w * 0.5, czh = sl.z + (R() - 0.5) * d * 0.5; SB.box(M.wall, cxh, H + 1.2, czh, 0.7, 2.4, 0.7, { tint: wc.map(v => v * 0.9), uvs: 1, bake: bk, shadow: false }); SB.box(M.roofTile, cxh, H + 2.5, czh, 0.95, 0.18, 0.95, { tint: [0.9, 0.8, 0.75], uvs: 1, bake: bk, shadow: false }); }   // skorsten
      if (sl.ring === 1 && R() < 0.3) { const ox = sl.x - sl.nx * (w / 2 + 1.2), oz = sl.z - sl.nz * (d / 2 + 1.2); SB.cyl(M.cypress, ox, 6, oz, 1.0, 0.05, 9 + R() * 5, { seg: 9, tint: [0.9, 1, 0.9], uvs: 2, bake: bk, shadow: false }); }   // cypres bag husene
    }
    ctx.extra.push(SB);
  }
  function decor(ctx) {
    const { B } = ctx;
    skyline(ctx);
    L.D.cornice(B, M.wall, WM.map(v => v * 1.04), { y: 8.6, out: 0.18, h: 0.26 });
    // mikro-detaljer: skjolder, revner, plakater, tags og stencil-numre i fast rytme langs murene; revner/skrammer på fliserne
    const Di = L.D.ID;
    ctx.decals = L.D.place(ctx, { wallSet: [Di.stain, Di.crack, Di.poster, Di.stain, Di.tag, Di.crack, Di.num, Di.stain], wallStep: 6.5, floorSet: [Di.crack, Di.scuff, Di.stain, Di.crack], floorStep: 5, floorDensity: 0.4, outdoorOnly: { [Di.poster]: true, [Di.tag]: true } });
    const out =(x, y, z) => C.WD.raycastWorld(W, x, y, z, 0, 1, 0, 25) >= 25 - 1e-6;
    // facadevinduer med skodder: fast rytme (hver 7. m) på lange udendørs mure, i 2. sals højde
    for (const r of wallRuns(4)) {
      const len = r.a1 - r.a0, n = Math.max(len >= 4 ? 1 : 0, Math.floor(len / 7));
      for (let i = 0; i < n; i++) {
        const a = r.a0 + (i + 0.5) * len / n, x = r.alongX ? a : r.fixed, z = r.alongX ? r.fixed : a, y = r.L + 5.6;
        if (!out(x + r.nx * 0.5, y, z + r.nz * 0.5) || C.insideSolid(x + r.nx * 0.3, y, z + r.nz * 0.3, false)) continue;
        wallCard(B, M.shutter, x, y, z, r.nx, r.nz, 1.2, 1.8, { off: 0.04 });
        const sx = r.alongX ? 1.5 : 0.3, sz = r.alongX ? 0.3 : 1.5;
        B.box(M.wall, x + r.nx * 0.12, y - 1.0, z + r.nz * 0.12, sx, 0.12, sz, { tint: wallT(x).map(v => v * 0.85), uvs: 1 });    // karm
        B.box(M.wood, x + r.nx * 0.1, y + 1.0, z + r.nz * 0.1, r.alongX ? 1.5 : 0.2, 0.16, r.alongX ? 0.2 : 1.5, { tint: tint(0x6a4a2a), uvs: 1 });   // overligger
      }
    }
    // stenbuer under alle døråbningers overliggere (overligger = væg-boks der starter i 2–4 m og går til toppen)
    for (const b of W.boxes) {
      if (b.kind !== 'wall' || b.y1 < 8.9 || b.y0 < 2 || b.y0 > 4 || Math.min(b.x1 - b.x0, b.z1 - b.z0) > 2.1 || Math.max(b.x1 - b.x0, b.z1 - b.z0) > 6.1) continue;
      const along = (b.x1 - b.x0) >= (b.z1 - b.z0), L = along ? b.x1 - b.x0 : b.z1 - b.z0, D = along ? b.z1 - b.z0 : b.x1 - b.x0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, t = wallT(cx).map(v => v * 0.9);
      B.box(M.wall, cx, b.y0 - 0.12, cz, along ? L : D + 0.06, 0.24, along ? D + 0.06 : L, { tint: t, uvs: 1.2 });
      for (const s of [-1, 1]) B.frustum(M.wall, cx + (along ? s * (L / 2 - 0.25) : 0), b.y0 - 0.6, cz + (along ? 0 : s * (L / 2 - 0.25)), along ? 0.2 : D + 0.06, along ? D + 0.06 : 0.2, along ? 0.5 : D + 0.06, along ? D + 0.06 : 0.5, 0.48, { tint: t, uvs: 1.2 });
    }
    // markiser over de tre hoveddøre (Mid-døren, Long-dørene, B-døren)
    const awn = (x, y, z, alongX, ww, nx, nz) => { B.box(M.awning, x + nx * 0.6, y, z + nz * 0.6, alongX ? ww : 1.3, 0.05, alongX ? 1.3 : ww, { rx: alongX ? -nz * 0.35 : 0, rz: alongX ? 0 : nx * 0.35, tint: [1, 1, 1], uvs: 2 }); for (const s of [-1, 1]) B.cyl(M.wood, x + (alongX ? s * ww / 2 : nx * 1.1), y - 0.35, z + (alongX ? nz * 1.1 : s * ww / 2), 0.03, 0.03, 0.4, { seg: 5, tint: tint(0x5a3a20), detail: true }); };
    awn(-4, 3.3, -23.95, true, 4.4, 0, 1); awn(31, 3.2, 10.05, true, 6.2, 0, 1); awn(-12.05, 2.9, -12, false, 4.4, -1, 0);
    // skilte ved callouts (monteres på nærmeste mur)
    for (const lb of W.labels) {
      if (lb.kind === 'site') continue;
      const wl = nearestWall(lb.x, lb.y + 2.6, lb.z, 9); if (!wl) continue;
      const accent = /SWAT/.test(lb.text) ? '#4a8cff' : /HIJACK/.test(lb.text) ? '#ff5a40' : '#e8b04a';   // holdfarve på spawn-skiltene
      L.fitWallCard(B, L.panelMat(lb.text, accent), wl.x, lb.y + 2.6, wl.z, wl.nx, wl.nz, 2.4, 0.6, { detail: true });
    }
    for (const lb of W.labels) if (lb.kind === 'site') floorCard(B, mat(T.text(lb.text, null, '#b8322a', 256, 256, null, 'Arial Black, Arial'), { alphaTest: 0.5 }), lb.x, lb.y, lb.z, 4, 4, 0);
    // plantebede: palme + buske ved udvalgte murhjørner i de åbne gårde (fast regel: hvert 3. lange murløb i spawn-områderne)
    let k = 0;
    for (const r of wallRuns(10)) {
      if (k++ % 3) continue;
      const a = r.a0 + 1.4, x = r.alongX ? a : r.fixed + r.nx * 1.0, z = r.alongX ? r.fixed + r.nz * 1.0 : a;
      if (C.insideSolid(x, r.L + 0.5, z, false) || C.WD.raycastWorld(W, x, r.L + 0.5, z, 0, 1, 0, 20) < 20) continue;
      const pot = ctx.model('planter_pot_clay', null, x, r.L, z, hash2(x, z) * TAU, [6.0, 2.6, 6.0]);      // fotoscannet lerkrukke som plantekumme
      if (!pot) B.cyl(M.conc, x, r.L, z, 0.8, 0.85, 0.35, { seg: 14, tint: tint(0xcdb48c), uvs: 1 });
      palm(B, M, x, r.L + (pot ? 0.5 : 0.3), z, 1.0, [r.nx * 0.5, r.nz * 0.5]);
      const sx = x + (r.alongX ? 1.2 : 0), sz = z + (r.alongX ? 0 : 1.2), sp = ctx.modelParts('shrub_02');
      if (!(sp.length && ctx.model('shrub_02', sp[Math.floor(hash2(sx, sz) * sp.length)], sx, r.L, sz, hash2(sz, sx) * TAU, 0.75, { detail: true }))) shrub(B, M, sx, r.L, sz, 0.8, true);
    }
  }
  const light = {
    sky: { hor: [1.0, 0.72, 0.46], mid: [0.82, 0.55, 0.5], top: [0.2, 0.3, 0.55], gnd: [0.55, 0.4, 0.3], sun: [1.0, 0.72, 0.42], cloud: 0.7 },
    sunColor: 0xffc890, sunInt: 1.25, sunPos: [62, 46, 38], hemiSky: 0xffdcb8, hemiGround: 0xa07c58, hemiInt: 0.7, ambInt: 0.1, bg: 0xe6ad84, fog: { color: 0xe3b48e, near: 70, far: 180 },
    exposure: 1.0, minSky: 0.08
  };
  // vejrlig: sandfygning op ad murfoden og i pletter på fliserne, mørke regnløb fra murkronerne, varm makrovariation i pudsen
  const weather = { macro: 0.24, macroCol: [1.06, 0.96, 0.84], grime: 0.85, grimeH: 1.0, grimeCol: [0.46, 0.38, 0.29], streak: 0.75, streakLen: 3.6, streakCol: [0.42, 0.37, 0.32], top: 0.4, topThr: 0.6, topCol: [0.72, 0.52, 0.3], topRough: 0.98 };
  // filmisk look: varm eftermiddag – gyldne højlys, let kølige skygger, sol-stråler gennem gaderne og varm dis mod solen
  const post = { sat: 1.07, contrast: 1.08, highTint: [1.04, 1.0, 0.93], shadowTint: [0.95, 0.98, 1.06], lift: [0.008, 0.006, 0.012], vignette: 0.22, sharpen: 0.2, shafts: 0.32, shaftCol: [1.0, 0.78, 0.5], mie: 0.5, mieCol: [1.0, 0.72, 0.45], mieDist: 90 };
  const ambient = { color: 0xffdcaa, count: 240, size: 0.032, alpha: 0.42, wind: [0.35, 0.03, 0.12] };   // fygende sandstøv i solen
  const SKY = C.assets && C.assets.sky;
  if (SKY) {                                                                // v11: fotograferet eftermiddagshimmel – solens retning fra HDRI'en
    light.skyTex = SKY.tex; light.skyExp = 0.95; light.ibl = 0.5; light.hemiInt = 0.6; light.ambInt = 0.08; light.exposure = 1.05;
    if (SKY.sunDir[1] > 0.12) light.sunPos = SKY.sunDir.map(v => v * 80);
  }
  return { id: 'white_dust', light, weather, post, ambient, bevel: 0.1, bevelKinds: { wall: 1 }, lamps, mats: M, surfKinds, surf, trim, splitY: [], dressProp, dressCyl, dressLadder, dressRail, dressLamp, doorStyle, decor, detailDist: 55 };
}
