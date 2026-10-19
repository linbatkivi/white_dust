// ==========================================================================
// White Dust · v26.6 HIDEOUT – dit eget rum over byen: 3D-trofævæg (bronze/sølv/guld-pokaler for hvert trofæ, tomme pladser
//   for dem du mangler), mastery-plader for dine våben, rank-banner, fraktionsflag og dekorationer købt i BUTIKKEN.
//   Træk for at kigge rundt, scroll for zoom, hold musen over en pokal for at se trofæet. Venner kan se din hideout (Venner-fanen).
// createHideout({ THREE, Profile, Trophies, Mastery, Shop, Factions, esc }) -> { snap(), mount(canvas, data, tipEl), DECO }
// ==========================================================================
export function createHideout(o) {
  const THREE = o.THREE, Pf = o.Profile, esc = o.esc, WD = window.WD;
  const DECO = [
    { ref: 'taeppe', name: 'Persisk tæppe', price: 600, icon: '▦' },
    { ref: 'sofa', name: 'Chesterfield-sofa', price: 900, icon: '🛋' },
    { ref: 'plante', name: 'Monstera', price: 300, icon: '🌿' },
    { ref: 'kaffe', name: 'Espressomaskine', price: 600, icon: '☕' },
    { ref: 'plakat', name: 'Plakat: de_bureau', price: 400, icon: '▤' },
    { ref: 'globus', name: 'Globus', price: 500, icon: '🌐' },
    { ref: 'neon', name: 'Neonskilt: WHITE DUST', price: 1200, icon: '✦' },
    { ref: 'arkade', name: 'Arkademaskine', price: 1600, icon: '🕹' },
    { ref: 'jukebox', name: 'Jukebox', price: 1400, icon: '♫' },
    { ref: 'akvarie', name: 'Akvarie', price: 1100, icon: '🐟' },
    { ref: 'c4', name: 'Desarmeret C4 på sokkel', price: 1800, icon: '✹' },
    { ref: 'statue', name: 'Guldstatue', price: 3000, icon: '♛' }
  ];
  if (o.Shop) o.Shop.addItems(DECO.map(d => ({ id: 'deco:' + d.ref, kind: 'deco', ref: d.ref, name: d.name, price: d.price, icon: d.icon })));
  const st = () => { const D = Pf.data; D.ho = D.ho || { off: {} }; return D.ho; };
  const ownedDeco = () => DECO.filter(d => Pf.data.owned['deco:' + d.ref]);
  // et øjebliksbillede af en hideout (dit eget eller en vens, fra vennekortet)
  function snap() {
    const tr = {}; for (const t of o.Trophies.list) { const n = o.Trophies.tierOf(t); if (n) tr[t.id] = n; }
    const mx = {}; for (const id of o.Mastery.IDS) { const t = o.Mastery.tierOf(id); if (t) mx[id] = t; }
    return { n: (o.name && o.name()) || 'Spiller', lvl: window.WDP.levelOf(Pf.data.xp).level, f: (o.Factions && o.Factions.cur()) || '', tr, mx, deco: ownedDeco().filter(d => !st().off[d.ref]).map(d => d.ref) };
  }

  // ---------------- 3D ----------------
  const TIERC = [0xc07a45, 0xc9ced4, 0xe4ae39];
  function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
  const M = (col, r, m, e) => new THREE.MeshStandardMaterial({ color: col, roughness: r === undefined ? 0.7 : r, metalness: m || 0, emissive: e || 0x000000 });
  function box(w, h, d, mat, x, y, z, parent) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; parent.add(b); return b; }
  function cyl(rt, rb, h, mat, x, y, z, parent, seg) { const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 24), mat); c.position.set(x, y, z); c.castShadow = true; parent.add(c); return c; }
  const BOWL = [[0, 0.16], [0.045, 0.165], [0.085, 0.19], [0.11, 0.24], [0.12, 0.3], [0.118, 0.31], [0.105, 0.25], [0.08, 0.205], [0.04, 0.185], [0, 0.18]].map(p => new THREE.Vector2(p[0], p[1]));
  function cup(tier, locked) {
    const g = new THREE.Group(), mat = locked ? new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.9, transparent: true, opacity: 0.28 }) : M(TIERC[tier], 0.28, 1);
    box(0.17, 0.045, 0.17, locked ? mat : M(0x15161a, 0.5), 0, 0.022, 0, g);
    cyl(0.018, 0.03, 0.12, mat, 0, 0.1, 0, g, 12);
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(BOWL, 28), mat); bowl.castShadow = true; g.add(bowl);
    for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.009, 8, 16, Math.PI), mat); h.position.set(s * 0.115, 0.255, 0); h.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(h); }
    if (tier === 2 && !locked) { const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.035), M(0xffe9a8, 0.2, 1, 0x553800)); st.position.y = 0.36; st.userData.spin = true; g.add(st); }
    return g;
  }
  function build(scene, data) {
    const room = new THREE.Group(); scene.add(room);
    const W = 12, Dp = 9, H = 3.4;
    // gulv: mørke egeplanker
    const floorTex = canvasTex(1024, 1024, (c, w, h) => { for (let i = 0; i < 16; i++) { const v = 52 + ((i * 37) % 17); c.fillStyle = `rgb(${v + 20},${v + 8},${v - 6})`; c.fillRect(0, i * 64, w, 64); c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, i * 64, w, 3); for (let k = 0; k < 3; k++) { const x = ((i * 271 + k * 397) % 1024); c.fillRect(x, i * 64, 3, 64); } for (let k = 0; k < 40; k++) { c.fillStyle = `rgba(0,0,0,${0.05 + (k % 5) * 0.02})`; c.fillRect((k * 131 + i * 17) % w, i * 64 + 8 + (k * 7) % 48, 120, 1.5); } } });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(2, 1.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, Dp), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; room.add(floor);
    // bagvæg: valnøddepaneler; sidevægge: beton
    const panel = canvasTex(1024, 512, (c, w, h) => { c.fillStyle = '#3a2416'; c.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#43291a' : '#3d2517'; c.fillRect(i * 128 + 3, 0, 122, h); c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(i * 128, 0, 3, h); } for (let k = 0; k < 300; k++) { c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect((k * 53) % w, (k * 97) % h, 1.2, 40 + k % 60); } });
    box(W, H, 0.2, new THREE.MeshStandardMaterial({ map: panel, roughness: 0.6 }), 0, H / 2, -Dp / 2, room);
    const conc = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#8f8d88'; c.fillRect(0, 0, w, h); for (let k = 0; k < 2500; k++) { const v = Math.floor(120 + ((k * 7919) % 50)); c.fillStyle = `rgba(${v},${v - 2},${v - 6},.35)`; c.fillRect((k * 131) % w, (k * 197) % h, 2, 2); } c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 2; c.strokeRect(1, 1, w - 2, h - 2); });
    conc.wrapS = conc.wrapT = THREE.RepeatWrapping; conc.repeat.set(3, 1);
    const concM = new THREE.MeshStandardMaterial({ map: conc, roughness: 0.9 });
    box(0.2, H, Dp, concM, -W / 2, H / 2, 0, room);
    box(W, 0.2, Dp, M(0x2a2826, 0.95), 0, H + 0.1, 0, room);   // loft
    // højre væg: stort vindue ud over byen om natten
    box(0.2, 0.6, Dp, concM, W / 2, 0.3, 0, room); box(0.2, 0.5, Dp, concM, W / 2, H - 0.25, 0, room);
    const sky = canvasTex(1024, 512, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0b1222'); g.addColorStop(1, '#2a2f45'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { const bw = 20 + (i * 37) % 50, bh = 80 + (i * 71) % 300, x = (i * 97) % w; c.fillStyle = '#0a0d16'; c.fillRect(x, h - bh, bw, bh); for (let y = h - bh + 8; y < h - 6; y += 12) for (let xx = x + 4; xx < x + bw - 4; xx += 8) if (((xx * 13 + y * 7) % 11) < 4) { c.fillStyle = ((xx + y) % 3) ? '#e8c27a' : '#9fc3ff'; c.fillRect(xx, y, 3, 5); } } });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(Dp - 0.4, H - 1.1), new THREE.MeshBasicMaterial({ map: sky })); win.position.set(W / 2 - 0.05, 0.6 + (H - 1.1) / 2, 0); win.rotation.y = -Math.PI / 2; room.add(win);
    for (let i = 0; i <= 4; i++) box(0.12, H - 1.1, 0.08, M(0x101114, 0.4, 0.6), W / 2 - 0.08, 0.6 + (H - 1.1) / 2, -Dp / 2 + 0.2 + i * (Dp - 0.4) / 4, room);
    // ---- trofævæggen: 3 hylder ----
    const T = o.Trophies.list, picks = [];
    const shelfM = M(0x16171a, 0.35, 0.5), led = new THREE.MeshBasicMaterial({ color: 0xffe2a8 });
    const rows = [T.slice(0, 9), T.slice(9, 18), T.slice(18)];
    rows.forEach((row, ri) => {
      const y = 0.95 + ri * 0.62, z = -Dp / 2 + 0.32;
      box(5.9, 0.05, 0.42, shelfM, 0, y, z, room); box(5.9, 0.012, 0.02, led, 0, y - 0.03, z + 0.2, room);
      row.forEach((t, i) => {
        const n = (data.tr || {})[t.id] || 0, single = t.tiers.length === 1, locked = !n, tier = single ? 2 : Math.max(0, n - 1);
        const c = cup(tier, locked); c.position.set(-2.6 + i * 0.65, y + 0.025, z); room.add(c);
        const pl = box(0.2, 0.05, 0.01, M(locked ? 0x2a2b2e : TIERC[tier], 0.4, locked ? 0 : 0.8), -2.6 + i * 0.65, y - 0.06, z + 0.215, room);
        const hit = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.45, 0.3), new THREE.MeshBasicMaterial({ visible: false })); hit.position.set(-2.6 + i * 0.65, y + 0.22, z); room.add(hit);
        hit.userData.tip = locked ? (t.secret ? 'Hemmeligt trofæ' : t.name + ' · ikke låst op') : t.name + ' · ' + (single ? 'GULD' : ['BRONZE', 'SØLV', 'GULD'][n - 1]); picks.push(hit);
      });
    });
    // spots over hylderne
    for (const x of [-2.2, 0, 2.2]) { const s = new THREE.SpotLight(0xffe0b0, 9, 6, 0.6, 0.6, 1.2); s.position.set(x, 3.2, -Dp / 2 + 1.4); s.target.position.set(x, 1.4, -Dp / 2 + 0.2); s.castShadow = x === 0; room.add(s, s.target); }
    // rank-banner over hylderne
    const lvl = data.lvl || 1, rk = window.WDP.rankOf(lvl);
    const bannerTex = canvasTex(1024, 256, (c, w, h) => { c.fillStyle = '#0a0a0a'; c.fillRect(0, 0, w, h); c.fillStyle = rk.col; c.fillRect(0, h - 16, w, 16); c.fillStyle = '#f4f4f2'; c.font = '900 84px "Archivo Black", "Arial Black", sans-serif'; c.textAlign = 'left'; c.fillText(String(data.n || 'SPILLER').toUpperCase().slice(0, 16), 230, 128); c.font = '700 40px "JetBrains Mono", monospace'; c.fillStyle = rk.col; c.fillText(rk.label + '  ·  LEVEL ' + lvl, 232, 196); });
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: bannerTex, toneMapped: false })); banner.position.set(0, 2.88, -Dp / 2 + 0.11); room.add(banner);
    const img = new Image(); img.onload = () => { const c = bannerTex.image.getContext('2d'); c.drawImage(img, 36, 18, 180, 196); bannerTex.needsUpdate = true; }; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(Pf.emblem(lvl, 180).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
    // fraktionsflag
    const fc = o.Factions && data.f && o.Factions.fac(data.f);
    if (fc) for (const x of [-3.6, 3.6]) { const ft = canvasTex(256, 512, (c, w, h) => { c.fillStyle = fc.col; c.fillRect(0, 0, w, h); c.fillStyle = '#0a0a0a'; c.fillRect(0, 0, w, 18); c.beginPath(); c.moveTo(0, h); c.lineTo(w / 2, h - 60); c.lineTo(w, h); c.fill(); c.font = '900 150px "Archivo Black", "Arial Black", sans-serif'; c.textAlign = 'center'; c.fillText(fc.sym, w / 2, 250); c.font = '700 22px "JetBrains Mono", monospace'; c.fillText(fc.name, w / 2, 330); });
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.8), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.9, side: THREE.DoubleSide })); fl.position.set(x, 2.15, -Dp / 2 + 0.13); room.add(fl); box(1.0, 0.04, 0.04, M(0x111111, 0.3, 0.8), x, 3.07, -Dp / 2 + 0.14, room); }
    // ---- mastery-plader på venstre væg ----
    const mx = Object.entries(data.mx || {}).sort((a, b) => b[1] - a[1]).slice(0, 12);
    mx.forEach(([id, t], i) => {
      const nm = (WD.WEAPONS[id] || {}).name || id.toUpperCase(), col = ['#c07a45', '#c9ced4', '#e4ae39'][t - 1];
      const tx = canvasTex(512, 256, (c, w, h) => { c.fillStyle = '#121316'; c.fillRect(0, 0, w, h); c.strokeStyle = col; c.lineWidth = 14; c.strokeRect(7, 7, w - 14, h - 14); c.fillStyle = col; c.font = '700 28px "JetBrains Mono", monospace'; c.textAlign = 'center'; c.fillText('MASTERY · ' + ['BRONZE', 'SØLV', 'GULD'][t - 1], w / 2, 70); c.fillStyle = '#f4f4f2'; c.font = '900 64px "Archivo Black", "Arial Black", sans-serif'; c.fillText(nm.toUpperCase().slice(0, 12), w / 2, 160); c.fillStyle = col; for (let k = 0; k < 3; k++) { c.globalAlpha = k < t ? 1 : 0.2; c.beginPath(); c.arc(w / 2 - 40 + k * 40, 205, 12, 0, 7); c.fill(); } c.globalAlpha = 1; });
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.5, metalness: 0.2 }));
      pl.position.set(-W / 2 + 0.12, 2.6 - Math.floor(i / 3) * 0.62, -2.8 + (i % 3) * 1.15); pl.rotation.y = Math.PI / 2; room.add(pl);
    });
    if (!mx.length) { const tx = canvasTex(512, 128, (c, w, h) => { c.fillStyle = '#121316'; c.fillRect(0, 0, w, h); c.fillStyle = '#8a8a86'; c.font = '700 26px "JetBrains Mono", monospace'; c.textAlign = 'center'; c.fillText('MASTERY-PLADER: LEVEL 3+', w / 2, 74); });
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshStandardMaterial({ map: tx })); pl.position.set(-W / 2 + 0.12, 2.2, -1.6); pl.rotation.y = Math.PI / 2; room.add(pl); }
    // ---- dekorationer ----
    const has = new Set(data.deco || []);
    if (has.has('taeppe')) { const rt = canvasTex(512, 768, (c, w, h) => { c.fillStyle = '#6e1a16'; c.fillRect(0, 0, w, h); c.strokeStyle = '#d9a84a'; c.lineWidth = 16; c.strokeRect(24, 24, w - 48, h - 48); c.strokeStyle = '#1d2a4a'; c.lineWidth = 10; c.strokeRect(52, 52, w - 104, h - 104); c.fillStyle = '#d9a84a'; for (let y = 120; y < h - 100; y += 90) for (let x = 120; x < w - 100; x += 90) { c.beginPath(); c.moveTo(x, y - 26); c.lineTo(x + 26, y); c.lineTo(x, y + 26); c.lineTo(x - 26, y); c.fill(); } c.fillStyle = '#1d2a4a'; c.beginPath(); c.ellipse(w / 2, h / 2, 90, 140, 0, 0, 7); c.fill(); });
      const r = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.6), new THREE.MeshStandardMaterial({ map: rt, roughness: 1 })); r.rotation.x = -Math.PI / 2; r.rotation.z = Math.PI / 2; r.position.set(0, 0.006, 0.6); r.receiveShadow = true; room.add(r); }
    if (has.has('sofa')) { const g = new THREE.Group(), lea = M(0x5a2a14, 0.45, 0.05); box(2.4, 0.42, 0.95, lea, 0, 0.21, 0, g); box(2.4, 0.55, 0.22, lea, 0, 0.62, 0.38, g); for (const s of [-1, 1]) box(0.25, 0.62, 0.95, lea, s * 1.2, 0.31, 0, g); for (let i = 0; i < 3; i++) box(0.74, 0.12, 0.7, M(0x6a3218, 0.5), -0.78 + i * 0.78, 0.48, -0.05, g); g.position.set(0, 0, 0.4); room.add(g); }
    if (has.has('plante')) { const g = new THREE.Group(); cyl(0.26, 0.2, 0.5, M(0xe8e4dc, 0.6), 0, 0.25, 0, g); for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 6), M(0x2f6b32, 0.7)); const a = i * 2.4; l.scale.set(1, 0.18, 0.55); l.position.set(Math.cos(a) * 0.3, 0.75 + (i % 3) * 0.28, Math.sin(a) * 0.3); l.rotation.set(0.5, a, 0.4); l.castShadow = true; g.add(l); } g.position.set(-5.2, 0, -3.7); room.add(g); }
    if (has.has('kaffe')) { const g = new THREE.Group(); box(1.2, 0.95, 0.6, M(0x1a1b1e, 0.4, 0.3), 0, 0.475, 0, g); box(0.45, 0.42, 0.38, M(0xcfd3d8, 0.25, 1), 0, 1.16, 0, g); box(0.1, 0.06, 0.1, M(0x111111, 0.4), 0, 1.0, 0.16, g); cyl(0.04, 0.035, 0.07, M(0xf4f4f2, 0.4), 0.25, 0.99, 0.1, g, 12); g.position.set(-5.4, 0, 2.6); g.rotation.y = Math.PI / 2; room.add(g); }
    if (has.has('plakat')) { const pt = canvasTex(512, 768, (c, w, h) => { c.fillStyle = '#f4f4f2'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff2b1f'; c.fillRect(0, 0, w, 300); c.fillStyle = '#0a0a0a'; c.font = '900 86px "Archivo Black", "Arial Black", sans-serif'; c.textAlign = 'center'; c.fillText('DE_', w / 2, 140); c.fillText('BUREAU', w / 2, 240); c.font = '700 28px "JetBrains Mono", monospace'; c.fillText('WHITE DUST · SÆSON 1', w / 2, 360); for (let i = 0; i < 6; i++) { c.fillRect(70 + i * 64, 700 - i * 50 - 160, 48, 160 + i * 50); } c.fillStyle = '#ff2b1f'; c.fillRect(0, h - 40, w, 40); });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.5), new THREE.MeshStandardMaterial({ map: pt, roughness: 0.8 })); p.position.set(-W / 2 + 0.12, 1.75, 1.9); p.rotation.y = Math.PI / 2; room.add(p); }
    if (has.has('globus')) { const g = new THREE.Group(); cyl(0.2, 0.25, 0.05, M(0x3a2416, 0.5), 0, 0.025, 0, g); cyl(0.025, 0.025, 0.8, M(0x3a2416, 0.5), 0, 0.42, 0, g); const gt = canvasTex(512, 256, (c, w, h) => { c.fillStyle = '#2a5d8a'; c.fillRect(0, 0, w, h); c.fillStyle = '#c9b47a'; for (let i = 0; i < 14; i++) { c.beginPath(); c.ellipse((i * 137) % w, 40 + (i * 53) % 180, 30 + i % 4 * 14, 18 + i % 3 * 12, i, 0, 7); c.fill(); } });
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 16), new THREE.MeshStandardMaterial({ map: gt, roughness: 0.4 })); s.position.y = 1.05; s.rotation.z = 0.4; s.userData.spinY = 0.25; s.castShadow = true; g.add(s); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.012, 8, 40, Math.PI), M(0xc9a24a, 0.3, 1)); ring.position.y = 1.05; ring.rotation.z = 0.4 + Math.PI / 2; g.add(ring); g.position.set(4.6, 0, -3.4); room.add(g); }
    if (has.has('neon')) { const nt = canvasTex(1024, 256, (c, w, h) => { c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, w, h); c.font = '900 128px "Archivo Black", "Arial Black", sans-serif'; c.textAlign = 'center'; c.shadowColor = '#ff2bd6'; c.shadowBlur = 30; c.strokeStyle = '#ff7be6'; c.lineWidth = 8; c.strokeText('WHITE DUST', w / 2, 170); c.shadowBlur = 0; c.strokeStyle = '#ffe1fa'; c.lineWidth = 3; c.strokeText('WHITE DUST', w / 2, 170); });
      const n = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({ map: nt, transparent: true, toneMapped: false })); n.position.set(-W / 2 + 0.13, 2.95, 1.2); n.rotation.y = Math.PI / 2; room.add(n); const pl = new THREE.PointLight(0xff2bd6, 3, 5, 1.6); pl.position.set(-W / 2 + 0.8, 2.9, 1.2); room.add(pl); }
    if (has.has('arkade')) { const g = new THREE.Group(); box(0.75, 1.75, 0.7, M(0x1d1f6a, 0.4), 0, 0.875, 0, g); box(0.75, 0.25, 0.2, M(0xffd23a, 0.4, 0, 0x553f00), 0, 1.86, 0.28, g); const sc = canvasTex(256, 192, (c, w, h) => { c.fillStyle = '#05060a'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff2b1f'; c.font = '700 22px "JetBrains Mono", monospace'; c.textAlign = 'center'; c.fillText('HIGH SCORE', w / 2, 40); c.fillStyle = '#8dff3a'; for (let i = 0; i < 5; i++) c.fillRect(30 + i * 44, 80 + (i % 2) * 30, 24, 24); c.fillStyle = '#7fe3ff'; c.fillText('INSERT COIN', w / 2, 170); });
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.44), new THREE.MeshBasicMaterial({ map: sc, toneMapped: false })); s.position.set(0, 1.4, 0.36); s.rotation.x = -0.15; g.add(s); box(0.75, 0.08, 0.35, M(0x111111, 0.5), 0, 1.05, 0.45, g); g.position.set(4.9, 0, -1.6); g.rotation.y = -Math.PI / 2; room.add(g); }
    if (has.has('jukebox')) { const g = new THREE.Group(); box(0.9, 1.3, 0.55, M(0x7a1c12, 0.35, 0.2), 0, 0.65, 0, g); const top = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.55, 24, 1, false, 0, Math.PI), M(0x7a1c12, 0.35, 0.2)); top.rotation.set(Math.PI / 2, 0, Math.PI / 2); top.position.y = 1.3; g.add(top); for (let i = 0; i < 4; i++) box(0.06, 1.1, 0.04, new THREE.MeshBasicMaterial({ color: [0xffd23a, 0xff2bd6, 0x7fe3ff, 0x8dff3a][i] }), -0.27 + i * 0.18, 0.75, 0.28, g); g.position.set(-3.5, 0, -3.95); room.add(g); }
    if (has.has('akvarie')) { const g = new THREE.Group(); box(1.5, 0.75, 0.55, M(0x1a1b1e, 0.4), 0, 0.375, 0, g); const gl = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.5), new THREE.MeshStandardMaterial({ color: 0x3a8acf, transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.1, emissive: 0x0a2a4a })); gl.position.y = 1.1; g.add(gl); for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 6), M([0xff8a1f, 0xffd23a, 0xff2b6e][i % 3], 0.4)); f.rotation.z = Math.PI / 2; f.position.set(-0.5 + i * 0.2, 0.95 + (i % 3) * 0.12, -0.1 + (i % 2) * 0.2); f.userData.fish = i; g.add(f); } const al = new THREE.PointLight(0x5ab0ff, 1.5, 3); al.position.y = 1.2; g.add(al); g.position.set(5.0, 0, 2.3); g.rotation.y = -Math.PI / 2; room.add(g); }
    if (has.has('c4')) { const g = new THREE.Group(); box(0.5, 1.0, 0.5, M(0xe8e4dc, 0.6), 0, 0.5, 0, g); const cs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, roughness: 0.05, transmission: 0 })); cs.position.y = 1.22; g.add(cs); for (let i = 0; i < 3; i++) box(0.07, 0.07, 0.24, M(0xc2b07a, 0.8), -0.08 + i * 0.08, 1.05, 0, g); box(0.12, 0.05, 0.08, M(0x111111, 0.4), 0, 1.11, 0.06, g); const ledm = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: 0x00ff55 })); ledm.position.set(0.03, 1.14, 0.1); g.add(ledm); g.position.set(-4.5, 0, -1.2); room.add(g); }
    if (has.has('statue')) { const g = new THREE.Group(), gold = M(0xe4ae39, 0.22, 1); box(0.6, 0.8, 0.6, M(0x15161a, 0.4), 0, 0.4, 0, g); const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.42, 6, 16), gold); body.position.y = 1.2; body.castShadow = true; g.add(body); const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 12), gold); head.position.y = 1.62; g.add(head); const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.42, 4, 10), gold); arm.position.set(0.17, 1.55, 0); arm.rotation.z = -0.35; g.add(arm); const tr = cup(2, false); tr.position.set(0.28, 1.78, 0); tr.scale.setScalar(0.8); g.add(tr); g.position.set(4.3, 0, 0.6); g.rotation.y = -0.6; room.add(g); }
    // grundlys
    scene.add(new THREE.HemisphereLight(0xcad6ff, 0x3a2a1c, 0.55));
    const lamp = new THREE.PointLight(0xffd6a0, 14, 12, 1.6); lamp.position.set(0, 3.2, 1); lamp.castShadow = true; lamp.shadow.mapSize.set(1024, 1024); scene.add(lamp);
    const moon = new THREE.DirectionalLight(0x8fb0ff, 0.6); moon.position.set(8, 4, 1); scene.add(moon);
    return picks;
  }
  // monterer en hideout i et canvas (rydder selv op når canvasset forsvinder)
  function mount(canvas, data, tipEl) {
    let R; try { R = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' }); } catch (e) { return null; }
    R.setPixelRatio(Math.min(2, devicePixelRatio || 1)); R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05; R.outputColorSpace = THREE.SRGBColorSpace;
    R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0a0b0e);
    // miljø-refleksioner til metallet (pokalerne)
    const pm = new THREE.PMREMGenerator(R), es = new THREE.Scene(); es.background = new THREE.Color(0x221a14);
    for (const [x, y, z, c] of [[0, 4, 0, 0xffe2b0], [6, 1.5, 0, 0x8fb0ff], [-6, 2, 2, 0xffffff], [0, 1, 6, 0xffcf8a]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial({ color: c })); b.position.set(x, y, z); es.add(b); }
    scene.environment = pm.fromScene(es, 0.04).texture; scene.environmentIntensity = 0.55;
    const picks = build(scene, data);
    const cam = new THREE.PerspectiveCamera(46, 1, 0.05, 60), target = new THREE.Vector3(0, 1.45, -2.2);
    let yaw = 0, pitch = 0.2, dist = 6.6, drag = null, idle = 0;
    const place = () => { cam.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * dist, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * Math.cos(pitch) * dist); cam.lookAt(target); };
    canvas.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY, yaw, pitch]; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointerup', () => { drag = null; idle = 0; });
    const ray = new THREE.Raycaster(), mv = new THREE.Vector2();
    canvas.addEventListener('pointermove', e => {
      if (drag) { yaw = Math.max(-0.75, Math.min(0.75, drag[2] - (e.clientX - drag[0]) * 0.005)); pitch = Math.max(-0.05, Math.min(0.5, drag[3] + (e.clientY - drag[1]) * 0.004)); idle = 0; }
      if (!tipEl) return; const r = canvas.getBoundingClientRect(); mv.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(mv, cam);
      const h = ray.intersectObjects(picks)[0]; if (h) { tipEl.textContent = h.object.userData.tip; tipEl.style.left = (e.clientX - r.left + 14) + 'px'; tipEl.style.top = (e.clientY - r.top + 10) + 'px'; tipEl.classList.add('on'); } else tipEl.classList.remove('on');
    });
    canvas.addEventListener('pointerleave', () => tipEl && tipEl.classList.remove('on'));
    canvas.addEventListener('wheel', e => { e.preventDefault(); dist = Math.max(2.6, Math.min(7.6, dist + e.deltaY * 0.004)); }, { passive: false });
    let last = performance.now(), alive = true;
    function frame(now) {
      if (!canvas.isConnected) { alive = false; R.dispose(); pm.dispose(); scene.traverse(n => { if (n.geometry) n.geometry.dispose(); if (n.material) { if (n.material.map) n.material.map.dispose(); n.material.dispose(); } }); return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now; idle += dt;
      const w = canvas.clientWidth, h = canvas.clientHeight; if (canvas.width !== Math.floor(w * R.getPixelRatio()) || canvas.height !== Math.floor(h * R.getPixelRatio())) { R.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); }
      if (!drag && idle > 3) yaw = Math.sin((now / 1000) * 0.12) * 0.35;   // langsom drift når man ikke rører
      place();
      scene.traverse(n => { if (n.userData.spin) n.rotation.y += dt * 1.5; if (n.userData.spinY) n.rotation.y += dt * n.userData.spinY; if (n.userData.fish !== undefined) n.position.x = -0.55 + ((now / 1000 * 0.12 + n.userData.fish * 0.17) % 1.1); });
      R.render(scene, cam); requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return { stop: () => { alive = false; } };
  }
  // ---- fanen ----
  function render() {
    const S = st(), own = ownedDeco(), d = snap(), trc = Object.keys(d.tr).length;
    return `<div class="ho-wrap"><div class="ho-view"><canvas id="hoCanvas"></canvas><div class="ho-tip"></div><div class="ho-hint">TRÆK FOR AT KIGGE RUNDT · SCROLL = ZOOM · MUS OVER EN POKAL</div></div>
      <div class="ho-side"><h3 class="ms-h">HIDEOUT <small>${trc} / ${o.Trophies.list.length} trofæer på væggen · ${Object.keys(d.mx).length} mastery-plader</small></h3>
        <p class="ho-note">Pokalerne følger dine trofæer (bronze → sølv → guld), pladerne dine våben fra mastery-level 3. Dekorationer købes for mønter i BUTIKKEN – dine venner kan se din hideout.</p>
        <h3>DEKORATIONER</h3><ul class="ho-deco">${DECO.map(x => { const ow = own.includes(x); return `<li class="${ow ? 'own' : ''}"><i>${x.icon}</i><b>${esc(x.name)}</b>${ow ? `<button class="sh-btn ${S.off[x.ref] ? '' : 'on'}" data-hotoggle="${x.ref}">${S.off[x.ref] ? 'GEMT VÆK' : 'STILLET OP'}</button>` : `<button class="sh-btn buy" data-hoshop>${x.price} MØNTER</button>`}</li>`; }).join('')}</ul></div></div>`;
  }
  function after(hub) { const cv = hub.querySelector('#hoCanvas'); if (cv) mount(cv, snap(), hub.querySelector('.ho-tip')); }
  function click(b) {
    if (b.dataset.hotoggle) { const S = st(); if (S.off[b.dataset.hotoggle]) delete S.off[b.dataset.hotoggle]; else S.off[b.dataset.hotoggle] = 1; Pf.save(); Pf.render(); }
    if (b.dataset.hoshop !== undefined) Pf.open('butik');
  }
  Pf.addTab('hideout', 'HIDEOUT', render, click, after);
  return { snap, mount, DECO };
}
