// ==========================================================================
// v20: SPILLETS LOGO som 3D-medaljon på forsiden (rød stjerne + sort ring, brugerens logo) i SUPERHOT-stil:
//   • tiden går kun (næsten) når du bevæger musen – medaljonen snurrer, svæver og vipper mod musen; skår i baggrunden driver
//   • stjernen er facetteret som rødt glas og splintres i skår (klik, eller af sig selv hvert ~10. sekund) og samler sig igen
//   • egen lille renderer bag menuen; står helt stille (ingen frames) når forsiden ikke vises
// createLogo3D(THREE, canvas, slotEl) -> { start(), stop(), shatter() }
// ==========================================================================
export function createLogo3D(THREE, canvas, slot) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' }); } catch (e) { return { start() {}, stop() {}, shatter() {} }; }
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100); cam.position.set(0, 0, 14);

  // ---- miljø (blank sort ring + glasstjerne skal have noget at spejle): lys studie-kuppel med bløde paneler
  const pm = new THREE.PMREMGenerator(renderer), envS = new THREE.Scene();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 p; void main(){ float y = normalize(p).y; gl_FragColor = vec4(mix(vec3(0.55), vec3(1.0), smoothstep(-0.4, 0.8, y)), 1.0); }' }));
  envS.add(dome);
  for (const [x, y, z, w, h, c] of [[6, 4, 4, 5, 2, 6], [-7, 1, 3, 2, 6, 3], [0, -6, 5, 8, 1, 1.5], [0, 8, -4, 10, 2, 2]]) {
    const pnl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(c), side: THREE.DoubleSide }));
    pnl.position.set(x, y, z); pnl.lookAt(0, 0, 0); envS.add(pnl);
  }
  scene.environment = pm.fromScene(envS, 0.02).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(4, 6, 8); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff4030, 1.4); rim.position.set(-6, 2, -5); scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  // ---- stjernen: 5 takker med rygge (to spidser foran/bagved) – facetteret rødt glas, hver trekant kan splintres
  const R = 1.0, r = 0.4, H = 0.3, pts = [];
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; pts.push(new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, 0)); }
  const pos = [], ctr = [], dir = [], rnd = [];
  const tri = (a, b, c) => {
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    const m = a.clone().add(b).add(c).multiplyScalar(1 / 3), d = m.clone().setZ(m.z * 2.5).normalize();
    const rv = [Math.random(), Math.random(), Math.random()];
    for (let k = 0; k < 3; k++) { ctr.push(m.x, m.y, m.z); dir.push(d.x, d.y, d.z); rnd.push(rv[0], rv[1], rv[2]); }
  };
  const F = new THREE.Vector3(0, 0, H), B = new THREE.Vector3(0, 0, -H);
  for (let i = 0; i < 10; i++) {                                   // hver trekant deles i to (finere skår)
    const p0 = pts[i], p1 = pts[(i + 1) % 10], mid = p0.clone().lerp(p1, 0.5);
    tri(F, p0, mid); tri(F, mid, p1); tri(B, mid, p0); tri(B, p1, mid);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setAttribute('aC', new THREE.Float32BufferAttribute(ctr, 3));
  sg.setAttribute('aD', new THREE.Float32BufferAttribute(dir, 3)); sg.setAttribute('aR', new THREE.Float32BufferAttribute(rnd, 3)); sg.computeVertexNormals();
  const uSh = { value: 0 };
  const starM = new THREE.MeshPhysicalMaterial({ color: 0xb30000, roughness: 0.32, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.06, flatShading: true, emissive: 0x220000, envMapIntensity: 0.55 });
  starM.onBeforeCompile = sh => {
    sh.uniforms.uSh = uSh;
    sh.vertexShader = 'uniform float uSh; attribute vec3 aC, aD, aR;\nmat3 rotA(vec3 ax, float a){ ax = normalize(ax); float s = sin(a), c = cos(a), o = 1.0 - c; return mat3(o*ax.x*ax.x + c, o*ax.x*ax.y + ax.z*s, o*ax.z*ax.x - ax.y*s, o*ax.x*ax.y - ax.z*s, o*ax.y*ax.y + c, o*ax.y*ax.z + ax.x*s, o*ax.z*ax.x + ax.y*s, o*ax.y*ax.z - ax.x*s, o*ax.z*ax.z + c); }\n'
      + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      { float s = uSh * (0.6 + aR.x * 0.9); mat3 Rm = rotA(aR * 2.0 - 1.0 + vec3(0.001), s * (2.0 + aR.y * 5.0));
        transformed = aC + Rm * (transformed - aC) + (aD + (aR - 0.5) * 0.8) * s * (1.6 + aR.z * 2.2); }`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      { float s = uSh * (0.6 + aR.x * 0.9); objectNormal = rotA(aR * 2.0 - 1.0 + vec3(0.001), s * (2.0 + aR.y * 5.0)) * objectNormal; }`);
  };
  const star = new THREE.Mesh(sg, starM);
  // ---- ringen: flad, tyk og blank sort (ligger foran stjernen som i logoet)
  const rs = new THREE.Shape(); rs.absarc(0, 0, 0.8, 0, Math.PI * 2, false); const hole = new THREE.Path(); hole.absarc(0, 0, 0.665, 0, Math.PI * 2, true); rs.holes.push(hole);
  const rgG = new THREE.ExtrudeGeometry(rs, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 3, curveSegments: 96 }); rgG.translate(0, 0, -0.07);
  const ringM = new THREE.MeshPhysicalMaterial({ color: 0x0b0b0c, roughness: 0.22, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2 });
  const ring = new THREE.Mesh(rgG, ringM); ring.position.z = 0.33;                     // foran stjernens ryg (som i logoet: ringen ligger over stjernen)
  const medal = new THREE.Group(); medal.add(star, ring); scene.add(medal);

  // ---- skår i baggrunden (røde og sorte trekanter der driver – SUPERHOT)
  const shardG = new THREE.BufferGeometry(); shardG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.5, 0, -0.35, -0.3, 0.12, 0.4, -0.25, -0.1], 3)); shardG.computeVertexNormals();
  const shards = [], sm = [new THREE.MeshPhysicalMaterial({ color: 0xb30000, roughness: 0.3, clearcoat: 1, flatShading: true, side: THREE.DoubleSide, emissive: 0x1a0000, envMapIntensity: 0.6 }),
    new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.3, clearcoat: 1, flatShading: true, side: THREE.DoubleSide })];
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(shardG, sm[i % 5 === 0 ? 1 : 0]); const s = 0.12 + Math.random() * 0.35; m.scale.setScalar(s);
    m.position.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 9, -2 - Math.random() * 8);
    m.userData = { v: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.15 + Math.random() * 0.4, 0), w: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(1.5) };
    m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); scene.add(m); shards.push(m);
  }

  // ---- styring
  let run = false, raf = 0, last = 0, gtime = 0, ts = 0.08, mouseSpd = 0, mx = 0, my = 0, pmx = null, pmy = null, spin = 0, shT = -1, nextSh = 9;
  addEventListener('pointermove', e => { const nx = e.clientX / innerWidth * 2 - 1, ny = e.clientY / innerHeight * 2 - 1; if (pmx !== null) mouseSpd += Math.hypot(nx - pmx, ny - pmy) * 9; pmx = nx; pmy = ny; mx = nx; my = ny; }, { passive: true });
  canvas.addEventListener('pointerdown', shatter);
  if (slot) slot.addEventListener('pointerdown', shatter);
  function shatter() { if (shT < 0) shT = 0; }
  function size() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    return { w, h };
  }
  const _v = new THREE.Vector3();
  function place() {                                               // medaljonen står over pladsholderen (slot) i menuen
    const { w, h } = size(); if (!slot) return 1;
    const b = slot.getBoundingClientRect(); if (!b.width) return 1;
    const nx = (b.left + b.width / 2) / w * 2 - 1, ny = -((b.top + b.height / 2) / h * 2 - 1);
    _v.set(nx, ny, 0.5).unproject(cam).sub(cam.position).normalize();
    const d = (0 - cam.position.z) / _v.z; medal.position.copy(cam.position).addScaledVector(_v, d);
    const visH = 2 * Math.tan(cam.fov * Math.PI / 360) * cam.position.z;      // verdens-højde der fylder skærmen
    return (b.height / h) * visH / 1.75;
  }
  function frame(tms) {
    if (!run) return; raf = requestAnimationFrame(frame);
    const rdt = Math.min(0.05, (tms - (last || tms)) / 1000); last = tms;
    mouseSpd *= Math.exp(-rdt * 4);
    const want = 0.08 + Math.min(1.2, mouseSpd);                     // SUPERHOT: tiden følger din bevægelse
    ts += (want - ts) * (1 - Math.exp(-rdt * 6));
    const dt = rdt * ts; gtime += dt;
    const sc = place(); medal.scale.setScalar(sc);
    spin += dt * 2.2;
    medal.rotation.set(-my * 0.25 + Math.sin(gtime * 0.7) * 0.06, spin + mx * 0.35, Math.sin(gtime * 0.5) * 0.05);
    medal.position.y += Math.sin(gtime * 1.3) * 0.04 * sc;
    // splintring: ud (0,35 s spil-tid), svæv, saml igen (1,4 s)
    if (shT < 0 && gtime > nextSh) shatter();
    if (shT >= 0) {
      shT += dt * 1.6;
      const out = Math.min(1, shT / 0.35), back = Math.max(0, Math.min(1, (shT - 0.9) / 1.4));
      uSh.value = (1 - Math.pow(1 - out, 3)) * (1 - back * back * (3 - 2 * back));
      if (shT > 2.4) { shT = -1; uSh.value = 0; nextSh = gtime + 9 + Math.random() * 5; }
    }
    for (const m of shards) {
      m.position.addScaledVector(m.userData.v, dt); m.rotation.x += m.userData.w.x * dt; m.rotation.y += m.userData.w.y * dt;
      if (m.position.y > 6) { m.position.y = -6; m.position.x = (Math.random() - 0.5) * 16; }
    }
    renderer.render(scene, cam);
  }
  return {
    start() { if (run) return; run = true; last = 0; raf = requestAnimationFrame(frame); },
    stop() { run = false; cancelAnimationFrame(raf); },
    shatter
  };
}
