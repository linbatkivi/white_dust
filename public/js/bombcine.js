// ==========================================================================
// v26: BOMBE-FILMEN – når serveren er HELT sikker på, at ingen SWAT kan nå at desarmere ('doom'), ser ALLE en instrueret sekvens,
//   der ender i eksplosionen (serveren spoler timeren frem til filmens længde, så ingen venter):
//     MAKRO   tæt på C4'en – LED'en blinker, bippet accelererer, kameraet kryber ind
//     KRAN    bred bevægelse rundt om sitet i det røde pulserende lys
//     DOLLY   lavt hen over gulvet ind mod bomben
//     LED     ekstremt nærbillede, hjerteslag – tiden går i stå
//     BANG    hvidt glimt, flerlags ildkugle (kerne, flammer, sort røg), chokbølge langs gulvet, vragdele der flyver og hopper,
//             gnister, støvring, røgsøjle, kamerarystelser og slowmotion – to vinkler og en kran op gennem røgen
//   Tidslinjen er bundet til eksplosionstidspunktet (serverens 'explode'), så filmen altid rammer bomben præcist.
// createBombCine({ THREE, WD, scene(), camera(), W(), V(), Audio, $, onStart(), onEnd() }) -> { start(m), explode(m), cancel(), update(dt) -> bool, active }
// ==========================================================================
export function createBombCine(o) {
  const { THREE, WD } = o;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v, smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }, lerp = (a, b, t) => a + (b - a) * t;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  let S = null, tex = null;

  /* ---------------- teksturer (procedurale): røg/ild-puf, gnist, chokbølge ---------------- */
  function canvasTex(n, draw) { const c = document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d'), n); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
  function textures() {
    if (tex) return tex;
    const puff = canvasTex(128, (g, n) => {                                  // blødt, uregelmæssigt puf (mange overlappende klatter)
      const R = mulberry(7);
      for (let i = 0; i < 46; i++) { const a = R() * 6.283, r = R() * n * 0.24, x = n / 2 + Math.cos(a) * r, y = n / 2 + Math.sin(a) * r, s = n * (0.12 + R() * 0.2);
        const gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, 'rgba(255,255,255,0.32)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, n, n); }
    });
    const spark = canvasTex(32, (g, n) => { const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,200,120,.8)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, n, n); });
    const ring = canvasTex(256, (g, n) => { const gr = g.createRadialGradient(n / 2, n / 2, n * 0.3, n / 2, n / 2, n / 2); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.75, 'rgba(255,220,180,.0)'); gr.addColorStop(0.9, 'rgba(255,230,200,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, n, n); });
    tex = { puff, spark, ring }; return tex;
  }
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ---------------- partikel-system (få draw calls): puf-sprites, gnister, vragdele ---------------- */
  function makePuffs(N, blending) {
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), col = new Float32Array(N * 4), sz = new Float32Array(N), rot = new Float32Array(N);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('c', new THREE.BufferAttribute(col, 4)); geo.setAttribute('s', new THREE.BufferAttribute(sz, 1)); geo.setAttribute('r', new THREE.BufferAttribute(rot, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: textures().puff }, scale: { value: 600 } }, transparent: true, depthWrite: false, blending,
      vertexShader: 'attribute vec4 c; attribute float s; attribute float r; varying vec4 vc; varying float vr; uniform float scale; void main(){ vc=c; vr=r; vec4 mv=modelViewMatrix*vec4(position,1.); float d=-mv.z; vc.a*=smoothstep(0.8, 3.0, d); gl_PointSize=min(s*scale/max(0.3,d), 700.); gl_Position=projectionMatrix*mv; }',   // tæt på kameraet: tones ud (intet slør over hele skærmen)
      fragmentShader: 'uniform sampler2D map; varying vec4 vc; varying float vr; void main(){ vec2 p=gl_PointCoord-0.5; float cs=cos(vr), sn=sin(vr); p=vec2(cs*p.x-sn*p.y, sn*p.x+cs*p.y)+0.5; vec4 t=texture2D(map,p); gl_FragColor=vec4(vc.rgb, t.a*vc.a); }'
    });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5;
    const P = []; for (let i = 0; i < N; i++) P.push({ live: false });
    return { pts, P, pos, col, sz, rot, geo, mat, k: 0 };
  }
  function spawnPuff(sys, o2) { const p = sys.P[sys.k++ % sys.P.length]; Object.assign(p, { live: true, t: 0 }, o2); }
  function updatePuffs(sys, dt, colorFn) {
    for (let i = 0; i < sys.P.length; i++) {
      const p = sys.P[i];
      if (!p.live) { sys.col[i * 4 + 3] = 0; continue; }
      p.t += dt; const f = p.t / p.life; if (f >= 1) { p.live = false; sys.col[i * 4 + 3] = 0; continue; }
      const dr = Math.exp(-dt * (p.drag || 2.0)); p.vx *= dr; p.vy = p.vy * dr + (p.lift || 0) * dt; p.vz *= dr;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.ceil !== undefined && p.y > p.ceil) { p.y = p.ceil; p.vy = 0; p.vx *= 1.02; p.vz *= 1.02; }
      sys.pos[i * 3] = p.x; sys.pos[i * 3 + 1] = p.y; sys.pos[i * 3 + 2] = p.z;
      const c = colorFn(p, f); sys.col[i * 4] = c[0]; sys.col[i * 4 + 1] = c[1]; sys.col[i * 4 + 2] = c[2]; sys.col[i * 4 + 3] = c[3];
      sys.sz[i] = p.s0 + (p.s1 - p.s0) * (1 - Math.pow(1 - f, 2.2)); sys.rot[i] = (p.r0 || 0) + p.t * (p.rs || 0);
    }
    sys.geo.attributes.position.needsUpdate = true; sys.geo.attributes.c.needsUpdate = true; sys.geo.attributes.s.needsUpdate = true; sys.geo.attributes.r.needsUpdate = true;
  }
  const FIRE = (p, f) => {                                                    // gnister/kerne (additive): hvid-gul → orange → væk
    const h = clamp(f * 1.6, 0, 1), k = p.hot || 1;
    const r = lerp(1.9 * k, 0.12, smooth(h)), g = lerp(1.25 * k, 0.06, smooth(h * 1.15)), b = lerp(0.55 * k, 0.05, smooth(h * 1.5));
    return [r, g, b, Math.min(1, (1 - f) * 1.6) * (p.a || 1)];
  };
  // flammer (normal blanding – ingen hvid mætning): lysende orangegul (HDR → bloom) → dyb orange → rødbrun glød → sodsort
  const FLAME = (p, f) => {
    const k = p.hot || 1, a = Math.min(1, (1 - f) * 2.2) * Math.min(1, f * 14 + 0.3);
    if (f < 0.12) { const u = f / 0.12; return [lerp(1.45, 1.15, u) * k, lerp(0.9, 0.48, u) * k, lerp(0.32, 0.1, u) * k, a]; }
    if (f < 0.38) { const u = (f - 0.12) / 0.26; return [lerp(1.15, 0.32, u) * k, lerp(0.48, 0.07, u) * k, lerp(0.1, 0.025, u) * k, a]; }
    const u = (f - 0.38) / 0.62; return [lerp(0.32, 0.035, u), lerp(0.07, 0.032, u), lerp(0.025, 0.03, u), a * (1 - u * 0.25)];
  };
  const SMOKE = (p, f) => {                                                   // sod: lyst op i orange nederst ved ilden (det første sekund), sort når den stiger og køles
    const l = (p.l || 0.09) * 0.6, g = p.by === undefined ? 0 : Math.max(0, 1 - (p.y - p.by) / 3.2) * Math.max(0, 1 - p.t / 1.6);
    return [l + g * 0.55, l * 0.96 + g * 0.22, l * 0.93 + g * 0.06, Math.sin(Math.PI * Math.min(1, f * 1.15)) * (p.a || 0.85)];
  };

  /* ---------------- vragdele (instanced) ---------------- */
  function makeDebris(N) {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x3a3836, roughness: 0.85, metalness: 0.1, emissive: 0x401000, emissiveIntensity: 0.0 }), N);
    m.frustumCulled = false; const D = [];
    for (let i = 0; i < N; i++) D.push({ x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, sx: 0.1, sy: 0.05, sz: 0.1, w: [0, 0, 0], live: false });
    return { m, D, dummy: new THREE.Object3D() };
  }

  /* ---------------- start ---------------- */
  function start(m) {
    if (S) stop(false);
    const sc = o.scene(), W = o.W(), B = V3(m.x, m.y, m.z), T = clamp((m.ms || 9000) / 1000, 1.2, 12);
    // det mest åbne lodrette plan omkring bomben (kameraerne må ikke stå i en væg)
    let dirs = [];
    for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a); dirs.push({ a, dx, dz, free: Math.min(12, WD.raycastWorld(W, B.x, B.y + 1.1, B.z, dx, 0, dz, 12)) }); }
    dirs.sort((p, q) => q.free - p.free);
    const open = dirs[0], ceil = Math.min(9, WD.raycastWorld(W, B.x, B.y + 0.2, B.z, 0, 1, 0, 9) + 0.2);
    const tx = textures();
    const fire = makePuffs(70, THREE.AdditiveBlending), flame = makePuffs(260, THREE.NormalBlending), smoke = makePuffs(160, THREE.NormalBlending), sparks = makePuffs(260, THREE.AdditiveBlending), dust = makePuffs(90, THREE.NormalBlending);
    sparks.mat.uniforms.map.value = tx.spark;
    for (const s2 of [smoke, dust, flame, fire, sparks]) sc.add(s2.pts);
    const debris = makeDebris(70); sc.add(debris.m);
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tx.ring, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, color: new THREE.Color(3, 2.2, 1.5) }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(B.x, B.y + 0.05, B.z); ring.visible = false; sc.add(ring);
    const light = new THREE.PointLight(0xffb070, 0, 45, 1.6); light.position.set(B.x, B.y + 1.2, B.z); sc.add(light);
    const red = new THREE.PointLight(0xff1a0a, 0, 4, 2.0); red.position.set(B.x, B.y + 0.22, B.z); sc.add(red);
    S = { t: 0, T, tx: T, B, open, dirs, ceil, fire, flame, smoke, sparks, dust, debris, ring, light, red, exploded: false, ended: false, shake: 0, fired: {}, slow: 1, beepT: 0, flashEl: o.$('bcFlash') };
    o.onStart && o.onStart();
    return true;
  }
  function explode(m) {
    if (!S) return;
    S.tx = S.t; if (m) S.B.set(m.x, m.y, m.z);
    detonate();
  }
  function cancel() { if (S) stop(true); }                                    // desarmeret alligevel (fx efter et teleport-hack) → væk

  /* ---------------- eksplosionen ---------------- */
  function detonate() {
    if (S.exploded) return; S.exploded = true; S.shake = 1.4;
    const B = S.B, R = mulberry((B.x * 100 | 0) ^ 0x51), ceil = B.y + S.ceil - 0.3;
    // kerne: et kort, hvidglødende glimt (additivt) – lever kun et kvart sekund
    for (let i = 0; i < 14; i++) spawnPuff(S.fire, { x: B.x + (R() - 0.5) * 0.5, y: B.y + 0.5 + R() * 0.4, z: B.z + (R() - 0.5) * 0.5, vx: (R() - 0.5) * 5, vy: 1 + R() * 3, vz: (R() - 0.5) * 5, drag: 4, lift: 1, life: 0.22 + R() * 0.12, s0: 0.8, s1: 3.0, hot: 1.6, r0: R() * 6 });
    // flammer: kugleformet udvidelse der ruller ud langs gulv og loft – lysende orange → glød → sod
    for (let i = 0; i < 170; i++) { const a = R() * 6.283, u = R() * 2 - 1, sp = 3 + R() * 11, h = Math.sqrt(1 - u * u);
      spawnPuff(S.flame, { x: B.x, y: B.y + 0.5 + R() * 0.8, z: B.z, vx: Math.cos(a) * h * sp, vy: Math.abs(u) * sp * 0.8 + 1.8, vz: Math.sin(a) * h * sp, drag: 3.2, lift: 2.4, life: 1.0 + R() * 1.2, s0: 0.7, s1: 2.6 + R() * 2.4, hot: 0.85 + R() * 0.4, ceil, r0: R() * 6, rs: (R() - 0.5) * 2.5 }); }
    // ildsøjlen: en tæt kerne af flammer der vælter op mod loftet og breder sig ud under det (svampeformen)
    for (let i = 0; i < 40; i++) spawnPuff(S.flame, { x: B.x + (R() - 0.5) * 0.8, y: B.y + 0.6, z: B.z + (R() - 0.5) * 0.8, vx: (R() - 0.5) * 2, vy: 6 + R() * 7, vz: (R() - 0.5) * 2, drag: 2.0, lift: 2, life: 1.1 + R() * 0.8, s0: 1.0, s1: 3.2 + R() * 1.6, hot: 1.0, ceil, r0: R() * 6, rs: (R() - 0.5) * 2 });
    // sort røg: tung, ruller op og ud under loftet og bliver hængende
    for (let i = 0; i < 90; i++) { const a = R() * 6.283, sp = 1 + R() * 5;
      spawnPuff(S.smoke, { by: B.y, x: B.x + (R() - 0.5) * 1.5, y: B.y + 1 + R() * 1.5, z: B.z + (R() - 0.5) * 1.5, vx: Math.cos(a) * sp, vy: 1.5 + R() * 4, vz: Math.sin(a) * sp, drag: 1.1, lift: 0.6, life: 3.5 + R() * 3, s0: 1.5, s1: 7 + R() * 5, l: 0.03 + R() * 0.05, a: 1.0, ceil: ceil - 0.6, r0: R() * 6, rs: (R() - 0.5) * 0.6 }); }
    // gnister: hurtige, tunge, med tyngdekraft
    for (let i = 0; i < 240; i++) { const a = R() * 6.283, u = R() * 1.2 - 0.2, sp = 8 + R() * 18;
      spawnPuff(S.sparks, { x: B.x, y: B.y + 0.5, z: B.z, vx: Math.cos(a) * sp, vy: u * sp * 0.7 + 3, vz: Math.sin(a) * sp, drag: 0.6, lift: -14, life: 0.6 + R() * 1.4, s0: 0.12, s1: 0.04, hot: 1, ceil }); }
    // støvring langs gulvet
    for (let i = 0; i < 70; i++) { const a = i / 70 * 6.283, sp = 9 + R() * 6;
      spawnPuff(S.dust, { x: B.x, y: B.y + 0.3, z: B.z, vx: Math.cos(a) * sp, vy: 0.4 + R(), vz: Math.sin(a) * sp, drag: 2.4, lift: 0.2, life: 1.8 + R() * 1.2, s0: 0.6, s1: 2.6 + R() * 1.4, l: 0.13, a: 0.4, r0: R() * 6, rs: 0.4 }); }
    // vragdele (dele af C4, gulvfliser, metal)
    S.debris.D.forEach(d => { const a = R() * 6.283, sp = 5 + R() * 13; Object.assign(d, { live: true, x: B.x, y: B.y + 0.3, z: B.z, vx: Math.cos(a) * sp, vy: 3 + R() * 9, vz: Math.sin(a) * sp, rx: R() * 6, ry: R() * 6, rz: R() * 6, w: [(R() - 0.5) * 20, (R() - 0.5) * 20, (R() - 0.5) * 20], sx: 0.05 + R() * 0.22, sy: 0.02 + R() * 0.06, sz: 0.05 + R() * 0.25, floor: B.y }); });
    S.debris.m.material.emissiveIntensity = 3;
    S.ring.visible = true; S.ring.scale.setScalar(0.5);
    if (S.flashEl) { S.flashEl.classList.remove('on'); void S.flashEl.offsetWidth; S.flashEl.classList.add('on'); }
    const A = o.Audio, pos = { x: B.x, y: B.y, z: B.z };
    try { A.boom && A.boom(pos, true); A.cine && A.cine('boom', { vol: 1.0 }); A.cine && A.cine('braam', { vol: 0.85, at: 0.05 }); A.cine && A.cine('hit', { vol: 0.7, at: 0.02 }); A.glass && A.glass(pos); } catch (e) {}
  }

  /* ---------------- kamera ---------------- */
  function frameDir(a) { return V3(Math.sin(a), 0, Math.cos(a)); }
  function shot(t) {
    const B = S.B, tt = t - S.tx, d = frameDir(S.open.a), r = V3(-d.z, 0, d.x), far = Math.max(2.5, Math.min(S.open.free - 0.6, 9)), up = S.ceil;
    const at = (a, h, b) => B.clone().addScaledVector(d, a).addScaledVector(r, b).setY(B.y + h);
    if (!S.exploded) {
      if (tt < -5.2) { const k = smooth((t) / Math.max(0.5, S.tx - 5.2)); return { pos: at(0.95 - k * 0.35, 0.16 + k * 0.04, 0.25 - k * 0.15), look: at(0, 0.07, 0), fov: 28 - k * 6 }; }
      if (tt < -2.6) { const k = (tt + 5.2) / 2.6, ang = -0.9 + k * 1.4, rr = Math.min(far, 5.5); return { pos: B.clone().add(V3(Math.sin(S.open.a + ang) * rr, Math.min(up - 0.4, 2.4), Math.cos(S.open.a + ang) * rr)), look: at(0, 0.3, 0), fov: 48 }; }
      if (tt < -0.9) { const k = smooth((tt + 2.6) / 1.7); return { pos: at(lerp(Math.min(far, 3.4), 1.0, k), 0.28 - k * 0.1, 0.6), look: at(0, 0.1, 0), fov: 36 - k * 6 }; }
      const k = smooth((tt + 0.9) / 0.9); return { pos: at(0.42 - k * 0.12, 0.13, 0.12), look: at(0, 0.07, -0.02), fov: 22 - k * 4 };
    }
    if (tt < 1.5) { const k = tt / 1.5, fx = Math.min(far, 6.2); return { pos: at(fx * (0.92 + k * 0.08), Math.min(up - 0.3, 1.4 + k * 0.5), fx * 0.22), look: at(0, 1.3 + k * 0.5, 0), fov: 60 + k * 4 }; }
    if (tt < 3.1) { const k = (tt - 1.5) / 1.6, d2 = frameDir(S.open.a + 1.9), f2 = Math.max(3, Math.min(S.dirs.find(q => Math.abs(((q.a - S.open.a - 1.9) % 6.283 + 6.283) % 6.283) < 0.4) ? 7 : 5, 7));
      return { pos: B.clone().addScaledVector(d2, f2 - k * 0.6).setY(B.y + 0.5 + k * 0.3), look: B.clone().setY(B.y + Math.min(up, 3.5) * 0.7), fov: 66 }; }
    const k = smooth((tt - 3.1) / 1.4); return { pos: at(far * 0.8, Math.min(up - 0.3, 1.8 + k * 1.2), -far * 0.3), look: at(0, 1.5 + k, 0), fov: 60 };
  }
  function camSafe(target, want) {
    const W = o.W(), dx = want.x - target.x, dy = want.y - target.y, dz = want.z - target.z, dd = Math.hypot(dx, dy, dz);
    if (dd < 0.01) return want;
    const hit = WD.raycastWorld(W, target.x, target.y, target.z, dx / dd, dy / dd, dz / dd, dd);
    const k = hit < dd ? Math.max(0.25, hit - 0.25) / dd : 1; return V3(target.x + dx * k, target.y + dy * k, target.z + dz * k);
  }

  /* ---------------- hovedløkke ---------------- */
  function update(dt) {
    if (!S) return false;
    const tt0 = S.t - S.tx;
    S.slow = S.exploded ? (tt0 < 0.15 ? 0.2 : tt0 < 1.3 ? lerp(0.2, 1, smooth((tt0 - 0.15) / 1.15)) : 1) : 1;
    const sdt = dt * S.slow; S.t += S.exploded ? sdt : dt;                       // før eksplosionen: realtid (synkront med serveren)
    if (!S.exploded && S.t >= S.tx + 0.35) detonate();                          // nødløsning: kom 'explode' ikke frem, springer den selv
    const tt = S.t - S.tx, cam = o.camera(), A = o.Audio;
    // lyde op til eksplosionen
    const cue = (k, at, fn) => { if (!S.fired[k] && tt >= at) { S.fired[k] = 1; try { fn(); } catch (e) {} } };
    cue('heart', -2.4, () => A.cine && A.cine('heart', { vol: 0.8 }));
    cue('rise', -1.6, () => A.cine && A.cine('rise', { vol: 0.75 }));
    cue('slow', -0.95, () => A.cine && A.cine('slowmo', { vol: 0.7 }));
    cue('whoosh', 1.5, () => A.cine && A.cine('whoosh', { vol: 0.6 }));
    // rødt pulserende lys fra C4'en (følger bippet: hurtigere og hurtigere)
    if (!S.exploded) { const per = clamp(-tt / 9, 0.06, 1) * 0.9; S.beepT += dt; const on = (S.beepT % per) < 0.07; S.red.intensity = on ? 3.2 : 0.35; }
    else S.red.intensity = 0;
    // eksplosionens lys og effekter
    if (S.exploded) {
      S.light.intensity = 70 * Math.exp(-tt * 4.5) + 14 * Math.max(0, 1 - tt / 4) * (0.7 + 0.3 * Math.sin(tt * 37));
      S.ring.scale.setScalar(0.5 + Math.min(1, tt / 0.55) * 36); S.ring.material.opacity = Math.max(0, 1 - tt / 0.6); if (tt > 0.7) S.ring.visible = false;
      S.debris.m.material.emissiveIntensity = Math.max(0, 3 - tt * 2.2);
      const dm = S.debris.dummy;
      S.debris.D.forEach((d, i) => {
        if (d.live) { d.vy -= 18 * sdt; d.x += d.vx * sdt; d.y += d.vy * sdt; d.z += d.vz * sdt; d.rx += d.w[0] * sdt; d.ry += d.w[1] * sdt; d.rz += d.w[2] * sdt;
          if (d.y < d.floor + d.sy / 2) { d.y = d.floor + d.sy / 2; d.vy *= -0.35; d.vx *= 0.6; d.vz *= 0.6; d.w = d.w.map(v => v * 0.5); }
          if (d.y > d.floor + S.ceil - 0.2) { d.y = d.floor + S.ceil - 0.2; d.vy = -Math.abs(d.vy) * 0.3; } }
        dm.position.set(d.x, d.y, d.z); dm.rotation.set(d.rx, d.ry, d.rz); dm.scale.set(d.sx, d.sy, d.sz); dm.updateMatrix(); S.debris.m.setMatrixAt(i, dm.matrix);
      });
      S.debris.m.instanceMatrix.needsUpdate = true;
      // efterbrænding: små flammer og røg der bliver ved at vælte op fra krateret
      if (tt > 0.3 && tt < 3.6) { S.emitT = (S.emitT || 0) + sdt; while (S.emitT > 0.05) { S.emitT -= 0.05; const R = Math.random;
        spawnPuff(S.flame, { x: S.B.x + (R() - 0.5) * 1.2, y: S.B.y + 0.15, z: S.B.z + (R() - 0.5) * 1.2, vx: (R() - 0.5), vy: 1.2 + R() * 1.8, vz: (R() - 0.5), drag: 1.5, lift: 1.6, life: 0.7 + R() * 0.6, s0: 0.3, s1: 1.1, hot: 0.9, r0: R() * 6, rs: 1 });
        spawnPuff(S.smoke, { by: S.B.y, x: S.B.x + (R() - 0.5), y: S.B.y + 0.8, z: S.B.z + (R() - 0.5), vx: (R() - 0.5) * 0.6, vy: 1.6 + R(), vz: (R() - 0.5) * 0.6, drag: 0.8, lift: 0.5, life: 3 + R() * 2, s0: 1, s1: 4.5, l: 0.06, a: 0.75, ceil: S.B.y + S.ceil - 0.8, r0: R() * 6, rs: 0.3 }); } }
    }
    updatePuffs(S.fire, sdt, FIRE); updatePuffs(S.flame, sdt, FLAME); updatePuffs(S.smoke, sdt, SMOKE); updatePuffs(S.dust, sdt, SMOKE); updatePuffs(S.sparks, sdt, FIRE);
    // kamera + rystelser
    const sh = shot(S.t), tgt = sh.look;
    const p = camSafe(tgt, sh.pos);
    S.shake *= Math.exp(-dt * 2.4);
    const n = S.shake * 0.12; p.x += (Math.random() - 0.5) * n; p.y += (Math.random() - 0.5) * n; p.z += (Math.random() - 0.5) * n;
    if (!S.exploded) { const hh = 0.006; p.x += Math.sin(S.t * 1.7) * hh; p.y += Math.sin(S.t * 2.3) * hh; }
    cam.position.copy(p); cam.lookAt(tgt);
    S.fov = sh.fov; if (Math.abs(cam.fov - sh.fov) > 0.01) { cam.fov = sh.fov; cam.updateProjectionMatrix(); }
    const bars = o.$('introBars'); if (bars) bars.style.setProperty('--bar', '11vh');
    if (S.exploded && tt > 4.6) { stop(true); return false; }
    return true;
  }
  function stop(callEnd) {
    if (!S) return;
    const s = S, sc = o.scene(); S = null;
    for (const x of [s.fire, s.flame, s.smoke, s.sparks, s.dust]) { sc.remove(x.pts); x.geo.dispose(); x.mat.dispose(); }
    sc.remove(s.debris.m); s.debris.m.geometry.dispose(); s.debris.m.material.dispose();
    sc.remove(s.ring); s.ring.geometry.dispose(); s.ring.material.dispose(); sc.remove(s.light); sc.remove(s.red);
    if (callEnd !== false) o.onEnd && o.onEnd();
  }
  return { start, explode, cancel, update, get active() { return !!S; }, get exploded() { return !!(S && S.exploded); }, get fov() { return S ? S.fov : null; } };
}
