// ==========================================================================
// v26.13 · koi: svømmende karper i kanalen og dammene (Niseko). Data: assets/niseko/water.json (vandlegemer som polygoner + antal fisk).
// Hver fisk har et mønster (kohaku/sanke/ogon/shusui/tancho), svømmer mod tilfældige mål inde i vandet (blød drejning, ingen uden for kanten),
// og slår med halen (vertex-bøjning). Kun fisk inden for 45 m opdateres/tegnes.
//   createKoi({ THREE, scene, url }) -> { update(dt, camPos, t), dispose() }
// ==========================================================================
export function createKoi(o) {
  const { THREE, scene } = o;
  const group = new THREE.Group(); group.name = 'koi'; scene.add(group);
  const fish = []; let disposed = false;
  // ---- mønstre (lærred 256×64: u langs kroppen, hoved til venstre)
  function pattern(kind, seed) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const c = cv.getContext('2d');
    let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const base = { kohaku: '#f4efe6', sanke: '#f2ede4', ogon: '#d4a228', shusui: '#8a9db0', tancho: '#f6f1e8', showa: '#1a1818' }[kind];
    c.fillStyle = base; c.fillRect(0, 0, 256, 64);
    const blob = (x, y, rx, ry, col, a = 1) => { c.globalAlpha = a; c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, rnd() * 0.6 - 0.3, 0, 7); c.fill(); c.globalAlpha = 1; };
    if (kind === 'kohaku') for (let i = 0; i < 5; i++) blob(30 + rnd() * 190, 8 + rnd() * 48, 14 + rnd() * 28, 10 + rnd() * 14, '#d8342a');
    else if (kind === 'sanke') { for (let i = 0; i < 4; i++) blob(30 + rnd() * 190, 10 + rnd() * 44, 14 + rnd() * 24, 10 + rnd() * 12, '#d8402c'); for (let i = 0; i < 5; i++) blob(50 + rnd() * 190, 6 + rnd() * 52, 5 + rnd() * 10, 4 + rnd() * 8, '#16161a'); }
    else if (kind === 'ogon') { const g = c.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, '#e8c050'); g.addColorStop(1, '#b8861a'); c.fillStyle = g; c.fillRect(0, 0, 256, 64); }
    else if (kind === 'shusui') { for (let i = 0; i < 4; i++) blob(40 + rnd() * 180, 14 + rnd() * 36, 16 + rnd() * 20, 8 + rnd() * 10, '#e86a2a', 0.9); c.fillStyle = '#6a7e94'; c.fillRect(0, 0, 256, 14); }
    else if (kind === 'tancho') blob(34, 32, 16, 16, '#d6281e');
    else { for (let i = 0; i < 4; i++) blob(30 + rnd() * 190, 10 + rnd() * 44, 14 + rnd() * 24, 10 + rnd() * 12, '#d64a2e'); blob(40, 30, 30, 20, '#2a2626', 0.7); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  // ---- fiskens krop: spindel langs +z (hoved ved z = +0.5), tværsnit ellipse; hale = flad vifte
  function body() {
    const N = 14, M = 8, pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, z = 0.5 - t;                                      // hoved→hale
      const w = (t < 0.12 ? Math.sqrt(t / 0.12) * 0.55 : 0.55 + 0.45 * Math.sin(Math.min(1, (t - 0.12) / 0.4) * Math.PI / 2)) * (t > 0.5 ? 1 - ((t - 0.5) / 0.5) * 0.88 : 1) * 0.062;
      const h = w * 0.82;
      for (let j = 0; j < M; j++) { const a = j / M * Math.PI * 2; pos.push(Math.cos(a) * w, Math.sin(a) * h * (Math.sin(a) < 0 ? 0.7 : 1), z); uv.push(t, j / M); }
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { const a = i * M + j, b = i * M + (j + 1) % M, c = (i + 1) * M + j, d = (i + 1) * M + (j + 1) % M; idx.push(a, c, b, b, c, d); }
    // halefinne (to flader) og brystfinner
    const base = pos.length / 3, tz = -0.5;
    pos.push(0, 0, tz + 0.02, 0.0, 0.07, tz - 0.17, 0.0, -0.01, tz - 0.17, 0.0, 0.0, tz + 0.02); uv.push(0.98, 0.5, 1, 0.1, 1, 0.9, 0.98, 0.5);
    idx.push(base, base + 1, base + 2); idx.push(base, base + 2, base + 1);
    const pf = pos.length / 3;
    for (const sgn of [-1, 1]) { pos.push(sgn * 0.05, -0.02, 0.28, sgn * 0.13, -0.035, 0.18, sgn * 0.05, -0.02, 0.17); uv.push(0.2, 0.5, 0.3, 0.5, 0.3, 0.5); }
    idx.push(pf, pf + 1, pf + 2, pf, pf + 2, pf + 1, pf + 3, pf + 4, pf + 5, pf + 3, pf + 5, pf + 4);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  const geo = body();
  const WT = { value: 0 };
  function mat(kind, seed) {
    const m = new THREE.MeshStandardMaterial({ map: pattern(kind, seed), roughness: kind === 'ogon' ? 0.28 : 0.45, metalness: kind === 'ogon' ? 0.55 : 0.0, side: THREE.DoubleSide });
    m.onBeforeCompile = sh => {
      sh.uniforms.uKT = WT; sh.uniforms.uPh = { value: 0 };
      sh.vertexShader = 'uniform float uKT; attribute float kph;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float kt = clamp( 0.5 - position.z, 0.0, 1.0 ); transformed.x += sin( uKT * 7.5 + kph - kt * 5.0 ) * 0.07 * kt * kt * 1.6;`);
    };
    m.customProgramCacheKey = () => 'koi'; return m;
  }
  const KINDS = ['kohaku', 'sanke', 'ogon', 'shusui', 'tancho', 'showa'], mats = KINDS.map((k, i) => mat(k, 11 + i * 37));
  function inside(poly, x, z) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  function edgeDist(poly, x, z) { let best = 1e9; for (let i = 0; i < poly.length - 1; i++) { const a = poly[i], b = poly[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1; let t = ((x - a[0]) * dx + (z - a[1]) * dz) / l2; t = Math.max(0, Math.min(1, t)); best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t)); } return best; }
  fetch(o.url).then(r => r.ok ? r.json() : null).then(J => {
    if (!J || disposed) return;
    let rs = 7;
    const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
    for (const bd of J.bodies) {
      const poly = bd.ring; let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9; for (const p of poly) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); minz = Math.min(minz, p[1]); maxz = Math.max(maxz, p[1]); }
      const rndPt = () => { for (let k = 0; k < 80; k++) { const x = minx + rnd() * (maxx - minx), z = minz + rnd() * (maxz - minz); if (inside(poly, x, z) && edgeDist(poly, x, z) > 0.32) return [x, z]; } return null; };
      for (let n = 0; n < bd.n; n++) {
        const p0 = rndPt(); if (!p0) continue;
        const f = { poly, minx, maxx, minz, maxz, rndPt, x: p0[0], z: p0[1], yaw: rnd() * 6.28, tgt: rndPt() || p0, sp: 0.22 + rnd() * 0.3, sc: 0.75 + rnd() * 0.65, depth: bd.y - 0.17 - rnd() * 0.12, ph: rnd() * 6.28, idle: 0 };
        const ph = new Float32Array(geo.attributes.position.count).fill(f.ph);
        const g = geo.clone(); g.setAttribute('kph', new THREE.BufferAttribute(ph, 1));
        const mesh = new THREE.Mesh(g, mats[(rnd() * KINDS.length) | 0]); mesh.scale.setScalar(f.sc); mesh.castShadow = false; mesh.receiveShadow = false; mesh.frustumCulled = true; group.add(mesh); f.mesh = mesh; fish.push(f);
      }
    }
  }).catch(() => {});
  function update(dt, cam, t) {
    WT.value = t; if (dt > 0.1) dt = 0.1;
    for (const f of fish) {
      const dx = f.x - cam.x, dz = f.z - cam.z, near = dx * dx + dz * dz < 45 * 45; f.mesh.visible = near; if (!near) continue;
      if (f.idle > 0) { f.idle -= dt; } else {
        let tx = f.tgt[0] - f.x, tz = f.tgt[1] - f.z; const d = Math.hypot(tx, tz);
        if (d < 0.35) { f.tgt = f.rndPt() || f.tgt; f.idle = Math.random() < 0.3 ? 0.5 + Math.random() * 2 : 0; f.sp = 0.2 + Math.random() * 0.34; }
        else {
          const want = Math.atan2(tx, tz); let da = want - f.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); f.yaw += Math.max(-1.6 * dt, Math.min(1.6 * dt, da));
          const nx = f.x + Math.sin(f.yaw) * f.sp * dt, nz = f.z + Math.cos(f.yaw) * f.sp * dt;
          if (inside(f.poly, nx, nz) && edgeDist(f.poly, nx, nz) > 0.2) { f.x = nx; f.z = nz; } else { f.tgt = f.rndPt() || f.tgt; f.yaw += 2.4 * dt; }
        }
      }
      f.mesh.position.set(f.x, f.depth + Math.sin(t * 0.7 + f.ph) * 0.012, f.z); f.mesh.rotation.set(0, f.yaw, 0);
    }
  }
  function dispose() { disposed = true; scene.remove(group); for (const f of fish) f.mesh.geometry.dispose(); geo.dispose(); for (const m of mats) { m.map.dispose(); m.dispose(); } }
  return { update, dispose, group };
}
