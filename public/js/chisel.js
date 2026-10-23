// ==========================================================================
// STAT-CHISEL (v26.12): våbnets stats ridses direkte ind i metallet/skæftet – jo mere du bruger våbnet, jo mere slidt og detaljeret.
//   Datakilde: Mastery (xp/level 1–10, drab, headshots, vundne runder pr. våben). Tegnes som en gravering (mørke riller + lys kant)
//   på en lille plade langs begge sider af våbnet i første person.
//     level 1  stregtællere (5-bundter) · 2 ridser · 3 DRAB · 4 VUNDNE RUNDER · 5 HS% · 7 ramme · 9 kranie + våbennavn · 10 forgyldt kant
// createChisel(THREE) -> { attach(group, id, stats) }   stats: { lv, k, hs, rw, name }
// ==========================================================================
export function createChisel(THREE) {
  const cache = new Map();
  function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  function paint(st) {
    const key = [st.lv, Math.min(st.k, 400), st.hs, st.rw, st.name].join('|'); if (cache.has(key)) return cache.get(key);
    const W = 640, H = 160, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'), R = rng(st.k * 31 + st.lv * 977 + 7);
    const grooves = (fn) => { c.save(); c.translate(1.5, 1.5); c.strokeStyle = 'rgba(255,235,205,0.55)'; c.fillStyle = 'rgba(255,235,205,0.55)'; fn(); c.restore(); c.strokeStyle = 'rgba(14,10,8,0.95)'; c.fillStyle = 'rgba(14,10,8,0.95)'; fn(); };
    c.lineCap = 'round'; c.lineJoin = 'round';
    const lv = st.lv;
    // ridser (mere slid med level)
    grooves(() => { c.lineWidth = 1; for (let i = 0; i < lv * 5; i++) { const x = R() * W, y = R() * H, a = (R() - 0.5) * 1.2, l = 8 + R() * 40; c.globalAlpha = 0.25 + R() * 0.45; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); } c.globalAlpha = 1; });
    // stregtællere: 5-bundter med skråstreg
    const tally = Math.min(st.k, 60);
    grooves(() => {
      c.lineWidth = 3.2; let x = 26, y = 26;
      for (let i = 0; i < tally; i += 5) {
        const n = Math.min(5, tally - i);
        for (let j = 0; j < Math.min(4, n); j++) { const xx = x + j * 9 + (R() - 0.5) * 1.6; c.beginPath(); c.moveTo(xx, y); c.lineTo(xx + (R() - 0.5) * 2, y + 34 + (R() - 0.5) * 3); c.stroke(); }
        if (n === 5) { c.beginPath(); c.moveTo(x - 6, y + 28); c.lineTo(x + 40, y + 6); c.stroke(); }
        x += 54; if (x > 330) { x = 26; y += 46; }
      }
    });
    c.font = '800 30px "Archivo Black", Impact, sans-serif'; c.textBaseline = 'alphabetic';
    if (lv >= 3) grooves(() => { c.font = '800 34px "Archivo Black", Impact, sans-serif'; c.fillText('DRAB ' + st.k, 352, 52); });
    if (lv >= 4) grooves(() => { c.font = '800 26px "Archivo Black", Impact, sans-serif'; c.fillText('RUNDER VUNDET ' + st.rw, 352, 90); });
    if (lv >= 5) grooves(() => { c.font = '800 26px "Archivo Black", Impact, sans-serif'; c.fillText('HS ' + (st.k ? Math.round(100 * st.hs / st.k) : 0) + '%', 352, 124); });
    if (lv >= 7) grooves(() => { c.lineWidth = 3; c.strokeRect(8, 8, W - 16, H - 16); c.lineWidth = 1.5; c.strokeRect(14, 14, W - 28, H - 28); });
    if (lv >= 9) grooves(() => {
      c.font = '700 22px "Archivo Black", Impact, sans-serif'; c.fillText(st.name, 26, 146);
      c.lineWidth = 3; c.beginPath(); c.arc(565, 78, 32, 0, 7); c.stroke(); c.fillRect(552, 98, 26, 14); c.beginPath(); c.arc(553, 74, 6, 0, 7); c.arc(577, 74, 6, 0, 7); c.fill();   // kranie
    });
    if (lv >= 10) { c.strokeStyle = 'rgba(255,205,90,0.95)'; c.lineWidth = 2.5; c.strokeRect(8, 8, W - 16, H - 16); c.strokeStyle = 'rgba(255,225,140,0.7)'; c.lineWidth = 1; c.strokeRect(14, 14, W - 28, H - 28); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; cache.set(key, t); return t;
  }
  const _b = new THREE.Box3(), _v = new THREE.Vector3(), _rc = new THREE.Raycaster();
  function attach(g, id, st) {
    const body = g.userData && g.userData.body; if (!body) return;
    for (const c of [...body.children]) if (c.name === 'chisel') { body.remove(c); c.traverse(m => { if (m.material) m.material.dispose(); }); }
    if (!st || st.lv < 1 || id === 'knife' || st.k + st.rw < 1) return;
    body.updateMatrixWorld(true);
    _b.setFromObject(body); const inv = body.matrixWorld.clone().invert();
    const mn = _b.min.clone().applyMatrix4(inv), mx = _b.max.clone().applyMatrix4(inv), lo = mn.clone().min(mx), hi = mn.clone().max(mx);
    const zc = hi.z - (hi.z - lo.z) * 0.3, yc = lo.y + (hi.y - lo.y) * 0.56, grp = new THREE.Group(); grp.name = 'chisel';
    const meshes = []; body.traverse(o => { if (o.isMesh && o.name !== 'chisel') meshes.push(o); });
    const map = paint(st), size = Math.min(0.17, Math.max(0.1, (hi.z - lo.z) * 0.2));
    for (const sg of [1, -1]) {
      _v.set(sg * (hi.x - lo.x + 1), yc, zc).add(new THREE.Vector3(sg > 0 ? hi.x : lo.x, 0, 0)); _v.x = sg > 0 ? hi.x + 0.05 : lo.x - 0.05;
      const o = new THREE.Vector3(_v.x, yc, zc).applyMatrix4(body.matrixWorld), d = new THREE.Vector3(-sg, 0, 0).transformDirection(body.matrixWorld);
      _rc.set(o, d); const hit = _rc.intersectObjects(meshes, false)[0];
      const x = hit ? body.worldToLocal(hit.point.clone()).x + sg * 0.0016 : (sg > 0 ? hi.x : lo.x) + sg * 0.001;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.25), new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 0.55, metalness: 0.25, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      m.position.set(x, yc, zc); m.rotation.y = sg > 0 ? Math.PI / 2 : -Math.PI / 2; m.renderOrder = 3; grp.add(m);
    }
    body.add(grp);
  }
  return { attach };
}
