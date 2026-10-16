// ==========================================================================
// v22: MVP-FILMEN – fylder hele skærmen efter en vundet runde (afløser den lille MvpStage-boks fra v21).
//   Et lille filmstudie i spillets SUPERHOT-stil (hvid cyklorama, holdfarvet modlys, lyskegler, støv, kæmpe holdnavn bagved)
//   og en instrueret sekvens i roligt tempo (~9,5 s), hver indstilling med sit eget kamera:
//     1 SILHUET   lavt forfra, modlys – MVP'en går frem mod kameraet ud af disen
//     2 UDSTYR    tæt kredsløb om hænder/våben → ansigt mens der lades (magasin ud/ind)
//     3 SKUDDET   profil: tre skud mod skiven i slowmotion, mundingsild, sporlys, hylstre der spinner; BULLSEYE knuses
//     4 VENDINGEN lavt bag skiven: våbnet sænkes, MVP'en vender sig mod kameraet – NAVNET slår ind
//     5 POSE      frontal halvtotal med statistik; hvidt blink ud
// createMvpCine({ THREE, WD, chars, Audio, createAgentStage, $ }) -> { play(info), stop(), active }
// ==========================================================================
export function createMvpCine(o) {
  const { THREE, WD } = o;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v, smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }, lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  let root = null, cv = null, st = null, S = null, T = null, built = false;
  const CUTS = [0, 1.7, 3.1, 4.9, 6.2, 8.0];          // + slowmotion ≈ 9,7 s i alt (serverens rundeslut med MVP = 10 s)                                    // indstillingernes starttider (s, filmtid)
  const SHOTS = [3.6, 3.85, 4.12];                                              // skud (filmtid); det sidste = bullseye
  const HITS = [[0.15, 0.11], [-0.11, -0.13], [0, 0]];
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
  function build() {
    built = true;
    root = document.createElement('div'); root.id = 'mvpCine'; root.className = 'mc hidden';
    root.innerHTML = `<canvas class="mc-cv"></canvas><div class="mc-grain"></div><div class="mc-vig"></div><div class="mc-bars"><i></i><i></i></div><div class="mc-flash"></div>
      <div class="mc-top"></div><div class="mc-tag"><b>★</b><span>RUNDENS MVP</span></div><div class="mc-bull">BULLSEYE</div>
      <div class="mc-name"><small></small><b></b></div><div class="mc-stats"></div>`;
    document.body.appendChild(root);
    cv = root.querySelector('.mc-cv');
    st = o.createAgentStage(THREE, cv, { chars: o.chars, weaponCode: id => (WD.WEAPONS[id] || {}).code || 0, fov: 30, exposure: 1.05 });
    if (!st) return;
    const R = st.R, Sc = st.scene;
    R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
    Sc.fog = new THREE.Fog(0xe9e6e0, 9, 26);
    // lys: blødt nøglelys med skygger + holdfarvet modlys (sættes i play)
    Sc.traverse(n => { if (n.isDirectionalLight) n.intensity *= 0.5; if (n.isHemisphereLight) n.intensity *= 0.55; });
    const key = new THREE.SpotLight(0xfff1e0, 60, 18, 0.55, 0.6, 1.6); key.position.set(2.6, 5.2, 4.2); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; Sc.add(key); Sc.add(key.target);
    const rimL = new THREE.SpotLight(0xff3020, 80, 16, 0.5, 0.7, 1.5); rimL.position.set(-2.4, 3.6, -3.6); Sc.add(rimL); Sc.add(rimL.target);
    const rimR = new THREE.SpotLight(0xff3020, 55, 16, 0.5, 0.7, 1.5); rimR.position.set(2.8, 2.8, -3.8); Sc.add(rimR); Sc.add(rimR.target);
    // cyklorama: gulv der krummer op i en bagvæg (hvidt papir), let snavset
    const cyc = new THREE.Group();
    const floorTex = canvasTex(1024, 1024, (g, w, h) => { g.fillStyle = '#ecebe6'; g.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { const v = 200 + Math.random() * 40 | 0; g.fillStyle = `rgba(${v},${v},${v - 6},.18)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } g.strokeStyle = 'rgba(10,10,10,.06)'; g.lineWidth = 2; for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); g.beginPath(); g.moveTo(0, x); g.lineTo(w, x); g.stroke(); } });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(3, 3);
    const fm = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.92 });
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), fm); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; cyc.add(fl);
    const curve = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 40, 32, 1, true, Math.PI, Math.PI / 2), fm); curve.rotation.z = Math.PI / 2; curve.position.set(0, 4, -8); curve.receiveShadow = true; cyc.add(curve);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), fm); wall.position.set(0, 14, -12); cyc.add(wall);
    Sc.add(cyc);
    // kæmpe holdnavn på bagvæggen (konturbogstaver) – tekstur sættes i play
    const bigM = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false });
    const big = new THREE.Mesh(new THREE.PlaneGeometry(18, 4.5), bigM); big.position.set(0, 3.0, -11.6); Sc.add(big);
    // lyskegler (falsk volumetrisk lys) fra modlyset
    const coneM = new THREE.MeshBasicMaterial({ color: 0xff4030, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const cones = [];
    for (const p of [[-2.4, 3.6, -3.6], [2.8, 2.8, -3.8]]) { const c = new THREE.Mesh(new THREE.ConeGeometry(1.5, 5.5, 32, 1, true), coneM); c.position.set(p[0] * 0.55, p[1] * 0.5, p[2] * 0.55); c.lookAt(0, 0, 0); c.rotateX(Math.PI / 2); Sc.add(c); cones.push(c); }
    // støv i luften
    const NP = 420, pg = new THREE.BufferGeometry(), pp = new Float32Array(NP * 3); for (let i = 0; i < NP; i++) { pp[i * 3] = (Math.random() - 0.5) * 9; pp[i * 3 + 1] = Math.random() * 4; pp[i * 3 + 2] = (Math.random() - 0.5) * 9; }
    pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    const dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.018, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); Sc.add(dust);
    // skiven (bullseye)
    const tTex = canvasTex(256, 256, g => { const rings = ['#f4f4f2', '#0a0a0a', '#f4f4f2', '#ff2b1f', '#f4f4f2', '#ff2b1f']; rings.forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(128, 128, 126 - i * 21, 0, Math.PI * 2); g.fill(); }); g.fillStyle = '#0a0a0a'; g.beginPath(); g.arc(128, 128, 10, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#0a0a0a'; g.lineWidth = 3; g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.stroke(); });
    const tgt = new THREE.Group(); tgt.position.set(4.2, 1.45, -0.4);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 48), [new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.6 }), new THREE.MeshStandardMaterial({ map: tTex, roughness: 0.55 }), new THREE.MeshStandardMaterial({ color: 0x0a0a0a })]);
    disc.rotation.z = Math.PI / 2; disc.castShadow = true; tgt.add(disc);
    const legM = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.5 });
    for (const sz of [-0.22, 0.22]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.5, 0.05), legM); l.position.set(0.06, -0.72, sz); l.rotation.x = sz * 0.25; l.castShadow = true; tgt.add(l); }
    Sc.add(tgt);
    const holes = []; for (let i = 0; i < 3; i++) { const hh = new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), new THREE.MeshBasicMaterial({ color: 0x050505 })); hh.rotation.y = -Math.PI / 2; hh.visible = false; tgt.add(hh); holes.push(hh); }
    const tracer = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, depthWrite: false, toneMapped: false })); tracer.visible = false; Sc.add(tracer);
    const ripple = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.46, 48), new THREE.MeshBasicMaterial({ color: 0xff2b1f, transparent: true, side: THREE.DoubleSide, depthWrite: false })); ripple.rotation.y = -Math.PI / 2; ripple.visible = false; tgt.add(ripple);
    const shardG = new THREE.BufferGeometry(); shardG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.06, 0, -0.04, -0.035, 0.01, 0.045, -0.03, -0.01], 3)); shardG.computeVertexNormals();
    const shardM = [new THREE.MeshStandardMaterial({ color: 0xff2b1f, side: THREE.DoubleSide, flatShading: true, emissive: 0x330000 }), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, side: THREE.DoubleSide, flatShading: true })];
    const shards = []; for (let i = 0; i < 34; i++) { const m = new THREE.Mesh(shardG, shardM[i % 4 ? 0 : 1]); m.visible = false; m.castShadow = true; Sc.add(m); shards.push(m); }
    // hylstre (messing) der kastes ud til højre ved hvert skud
    const brassG = new THREE.CylinderGeometry(0.0055, 0.0055, 0.045, 8); const brassM = new THREE.MeshStandardMaterial({ color: 0xc89b3c, metalness: 0.95, roughness: 0.28 });
    const brass = []; for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(brassG, brassM); b.visible = false; b.castShadow = true; Sc.add(b); brass.push(b); }
    // røg/krudtdamp ved mundingen
    const smokeT = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
    const puffs = []; for (let i = 0; i < 8; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeT, color: 0xdedad2, transparent: true, depthWrite: false, opacity: 0 })); sp.visible = false; Sc.add(sp); puffs.push(sp); }
    T = { key, rimL, rimR, coneM, cones, big, bigM, dust, tgt, holes, tracer, ripple, shards, brass, puffs, sim: 0, slow: 1, shot: 0, wob: 0, wobV: 0, trT: 0, ripT: 0 };
    const _a = V3(0, 0, 0), _b = V3(0, 0, 0), _q = new THREE.Quaternion();
    st.onFrame = (dt, t, pose, s) => { if (S) direct(dt, pose); };
    st.afterPose = (dt) => { if (S) effects(dt, _a, _b, _q); };
  }

  // spillets lyde
  function cue(key, at, fn) { if (!S.fired[key] && T.sim >= at) { S.fired[key] = 1; try { fn(); } catch (e) {} } }
  const A = (n, op) => o.Audio.cine && o.Audio.cine(n, op);

  // ---- instruktion: position/retning/handling + kamera pr. indstilling
  function direct(dt, pose) {
    const target = (T.sim > SHOTS[2] - 0.08 && T.sim < SHOTS[2] + 0.34) ? 0.25 : (T.sim > SHOTS[0] - 0.25 && T.sim < SHOTS[2]) ? 0.6 : 1;   // slowmotion omkring skuddene
    T.slow += (target - T.slow) * Math.min(1, dt * 9); const d = dt * T.slow; T.sim += d;
    const t = T.sim, cam = st.cam;
    S.dt = d; st.ts = T.slow;
    // figuren: går frem (0–1.9), lader (1.8–3.0), drejer og sigter mod skiven (+x), sænker våbnet og vender sig mod slutkameraet
    const walk = smooth(t / 1.9);
    pose.x = lerp(-0.15, 0, walk); pose.z = lerp(-3.0, 0, walk); pose.y = 0;
    const aimYaw = -Math.PI / 2 + 0.05, faceYaw = Math.atan2(-0.9, -3.2) + Math.PI * 2;
    let yaw = Math.PI;                                                          // mod kameraet (+z)
    if (t > 2.95) yaw = lerp(Math.PI, aimYaw + Math.PI * 2, smooth((t - 2.95) / 0.55));
    if (t > 6.0) yaw = lerp(aimYaw + Math.PI * 2, faceYaw, ease((t - 6.0) / 0.9));
    pose.yaw = yaw; pose.pitch = t > 3.2 && t < 4.9 ? 0.02 : t > 4.9 ? -0.32 * smooth((t - 4.9) / 0.5) * (1 - smooth((t - 6.0) / 0.8)) - 0.06 : -0.12;
    pose.reload = t > 1.8 && t < 3.0;
    pose.crouch = false;
    // v26: kropssprog – low ready og afsøgning under gangen, våbnet skråt over brystet i slutposen, kort salut
    pose.ready = t < 1.9 ? 1 : t > 6.2 ? 0.55 : 0; pose.look = t < 1.7 ? Math.sin(t * 2.2) * 0.4 : t > 6.9 ? Math.sin((t - 6.9) * 0.9) * 0.12 : 0;
    pose.lean = t > 6.6 ? 0.14 : 0; pose.signal = t > 7.25 && t < 7.85 ? 1 : 0;
    // kamera pr. indstilling
    let p, l, fov;
    if (t < CUTS[1]) { const k = t / CUTS[1]; p = V3(0.3, 0.34, 2.6 - k * 0.2); l = V3(0, 1.2 + k * 0.05, lerp(-1.6, -0.4, k)); fov = 38; }
    else if (t < CUTS[2]) { const k = (t - CUTS[1]) / (CUTS[2] - CUTS[1]), a = lerp(-0.7, 0.5, ease(k)); p = V3(Math.sin(a) * 1.15, lerp(1.05, 1.62, ease(k)), Math.cos(a) * 1.15); l = V3(0, lerp(1.15, 1.58, ease(k)), 0); fov = 28; }
    else if (t < CUTS[3]) { const k = (t - CUTS[2]) / (CUTS[3] - CUTS[2]); p = V3(lerp(1.9, 2.25, k), lerp(1.3, 1.42, k), lerp(4.6, 4.0, k)); l = V3(2.05, 1.3, -0.25); fov = 42; }
    else if (t < CUTS[4]) { const k = (t - CUTS[3]) / (CUTS[4] - CUTS[3]); p = V3(lerp(5.4, 4.9, k), lerp(0.55, 0.75, k), lerp(1.0, 1.25, k)); l = V3(0, 1.3, 0); fov = lerp(30, 25, k); }
    else { const k = (t - CUTS[4]) / (CUTS[5] - CUTS[4]); p = V3(lerp(1.0, 0.8, k), 1.34, lerp(3.4, 3.0, k)); l = V3(0.35, 1.22, 0); fov = 30; }
    cam.position.copy(p); cam.lookAt(l); if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    // lys følger figuren
    T.key.target.position.set(0, 1, pose.z); T.rimL.target.position.set(0, 1.2, pose.z); T.rimR.target.position.set(0, 1.2, pose.z);
    // klip: hvidt blink + whoosh
    for (let i = 1; i < CUTS.length - 1; i++) cue('cut' + i, CUTS[i], () => { flash(0.35); A('whoosh', { vol: 0.5 }); root.dataset.shot = i + 1; });
    cue('heart', 0.05, () => A('heart', { vol: 0.8 }));
    cue('braam', 0.25, () => A('braam', { vol: 0.75 }));
    cue('tag', CUTS[1] + 0.2, () => root.classList.add('tag'));
    cue('rl', 1.85, () => A('reload', { vol: 0.9 }));
    cue('rise', 2.95, () => A('rise', { vol: 0.7 }));
    cue('slowmo', SHOTS[0] - 0.2, () => A('slowmo', { vol: 0.6 }));
    cue('name', CUTS[3] + 0.4, () => { root.classList.add('named'); A('boom', { vol: 0.9 }); A('hit', { vol: 0.6 }); flash(0.6); });
    cue('stats', CUTS[4] + 0.3, () => root.classList.add('stats'));
    cue('out', CUTS[5] - 0.35, () => flash(1));
  }
  function flash(k) { const f = root.querySelector('.mc-flash'); f.style.setProperty('--k', k); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }

  // ---- effekter: skud, sporlys, hylstre, røg, skiven, støv
  function effects(dt, _a, _b, _q) {
    const h = st.h, d = S.dt || dt; if (!h) return;
    const C = o.chars();
    while (T.shot < 3 && T.sim >= SHOTS[T.shot]) {
      const i = T.shot++; C.fire(h);
      h.flash.updateMatrixWorld(true); h.flash.getWorldPosition(_a);
      const hp = HITS[i]; _b.set(T.tgt.position.x - 0.035, T.tgt.position.y + hp[1], T.tgt.position.z + hp[0]);
      const L = _a.distanceTo(_b); T.tracer.position.copy(_a).lerp(_b, 0.5); T.tracer.scale.set(1, L, 1);
      T.tracer.quaternion.setFromUnitVectors(V3(0, 1, 0), _b.clone().sub(_a).normalize()); T.tracer.visible = true; T.tracer.material.opacity = 1; T.trT = 0;
      const hole = T.holes[i]; hole.position.set(-0.035, hp[1], hp[0]); hole.visible = true;
      T.wobV += i === 2 ? 2.6 : 0.9;
      o.Audio.shot(S.gun, null, true);
      const b = T.brass[i * 2], b2 = T.brass[i * 2 + 1];                       // hylster ud til højre + et "spejl"-hylster for fylde
      for (const bb of [b, b2]) { bb.visible = true; bb.position.copy(_a).add(V3(-0.25, -0.02, 0.05)); bb.userData.v = V3(-0.3 - Math.random() * 0.5, 1.6 + Math.random() * 0.8, 1.0 + Math.random() * 0.6); bb.userData.w = V3(Math.random() * 30, Math.random() * 30, Math.random() * 30); }
      for (let k = 0; k < 2; k++) { const pf = T.puffs[(i * 2 + k) % T.puffs.length]; pf.visible = true; pf.position.copy(_a).add(V3(0.05 * k, 0.02, 0)); pf.userData.t = 0; pf.userData.v = V3(0.25 + Math.random() * 0.3, 0.12, (Math.random() - 0.5) * 0.2); }
      if (i === 2) {
        T.ripple.visible = true; T.ripT = 0;
        T.shards.forEach(m => { m.visible = true; m.position.set(T.tgt.position.x + 0.05, T.tgt.position.y, T.tgt.position.z); m.userData.v = V3(1.5 + Math.random() * 3, (Math.random() - 0.3) * 3, (Math.random() - 0.5) * 3.5); m.userData.w = V3(Math.random() * 12, Math.random() * 12, Math.random() * 12); m.scale.setScalar(0.7 + Math.random() * 1.6); });
        root.classList.add('bull'); A('hit', { vol: 0.9 }); A('casings', { vol: 0.7, at: 0.25 }); flash(0.25);
      }
    }
    if (T.tracer.visible) { T.trT += d; T.tracer.material.opacity = Math.max(0, 1 - T.trT / 0.09); if (T.trT > 0.09) T.tracer.visible = false; }
    T.wobV -= T.wob * 60 * d; T.wobV *= Math.exp(-d * 4); T.wob += T.wobV * d; T.tgt.rotation.z = T.wob * 0.25;
    if (T.ripple.visible) { T.ripT += d; const r = 1 + T.ripT * 5; T.ripple.scale.set(r, r, r); T.ripple.material.opacity = Math.max(0, 1 - T.ripT * 1.6); if (T.ripT > 0.7) T.ripple.visible = false; }
    for (const m of T.shards) if (m.visible) { m.userData.v.y -= 6 * d; m.position.addScaledVector(m.userData.v, d); m.rotation.x += m.userData.w.x * d; m.rotation.y += m.userData.w.y * d; if (m.position.y < 0.02) { m.position.y = 0.02; m.userData.v.set(0, 0, 0); m.userData.w.set(0, 0, 0); } }
    for (const b of T.brass) if (b.visible) { b.userData.v.y -= 9.8 * d; b.position.addScaledVector(b.userData.v, d); b.rotation.x += b.userData.w.x * d; b.rotation.z += b.userData.w.z * d; if (b.position.y < 0.01) { b.position.y = 0.01; b.userData.v.multiplyScalar(-0.3); b.userData.v.y = Math.abs(b.userData.v.y) < 0.2 ? 0 : b.userData.v.y; b.userData.w.multiplyScalar(0.5); } }
    for (const pf of T.puffs) if (pf.visible) { pf.userData.t += d; const k = pf.userData.t / 1.6; pf.position.addScaledVector(pf.userData.v, d); pf.scale.setScalar(0.12 + k * 0.7); pf.material.opacity = Math.max(0, 0.5 * (1 - k)); if (k >= 1) pf.visible = false; }
    T.dust.rotation.y += d * 0.03; T.dust.position.y = Math.sin(T.sim * 0.4) * 0.05;
    T.coneM.opacity = 0.05 + 0.02 * Math.sin(T.sim * 3.1);
    if (T.sim >= CUTS[5]) stop();
  }

  function play(info) {
    try {
      if (!built) build(); if (!st) return false;
      stop(true);
      const side = info.side === 'hij' ? 'hij' : 'swat', col = side === 'hij' ? 0xff3020 : 0x2a6bff, css = side === 'hij' ? '#ff2b1f' : '#1f6fff';
      st.setAgent(side, info.agent || null, info.gun || (side === 'hij' ? 'ak47' : 'm4a1')); if (st.h) st.h.skins = info.skins || {};
      T.rimL.color.setHex(col); T.rimR.color.setHex(col); T.coneM.color.setHex(col);
      T.bigM.map && T.bigM.map.dispose();
      T.bigM.map = canvasTex(2048, 512, (g, w, h) => { g.font = '900 360px "Archivo Black", Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 10; g.strokeStyle = 'rgba(10,10,10,.22)'; g.strokeText(side === 'hij' ? 'HIJACKERS' : 'SWAT', w / 2, h / 2 + 20); g.fillStyle = 'rgba(255,255,255,0)'; });
      T.bigM.needsUpdate = true;
      T.sim = 0; T.slow = 1; T.shot = 0; T.wob = 0; T.wobV = 0; T.tracer.visible = false; T.ripple.visible = false;
      T.holes.forEach(h => { h.visible = false; }); T.shards.forEach(m => { m.visible = false; }); T.brass.forEach(b => { b.visible = false; }); T.puffs.forEach(p => { p.visible = false; });
      S = { fired: {}, gun: info.gun || (side === 'hij' ? 'ak47' : 'm4a1') };
      root.style.setProperty('--tc', css);
      root.className = 'mc ' + side;
      root.querySelector('.mc-top').innerHTML = info.top || '';
      root.querySelector('.mc-name small').textContent = info.me ? 'DET ER DIG' : (side === 'hij' ? 'HIJACKERS' : 'SWAT');
      root.querySelector('.mc-name b').textContent = info.name || '';
      root.querySelector('.mc-stats').innerHTML = info.stats || '';
      st.t = 0; st.start();
      return true;
    } catch (e) { console.warn('[mvp] film', e); return false; }
  }
  function stop(keep) {
    if (!st) return;
    st.stop(); S = null;
    if (root && !keep) root.classList.add('hidden');
    if (o.onStop && !keep) o.onStop();
  }
  return { play, stop, get active() { return !!S; } };
}
