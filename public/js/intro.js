// ==========================================================================
// v22: INTRO-CUTSCENE ved kampstart (kan ikke springes over) – holdet ankommer til sin spawn på den aktuelle bane:
//   SWAT      : pansret køretøj kører ind, luftbremser, bagdørene slås op, operatørerne springer ud med lasersigter og spreder sig
//   HIJACKERS : slidt pickup (technical) drøner ind og laver et håndbremse-sving i en sky af støv; hijackerne springer ud over ladet
// v25: spillerens egne modeller – SWAT i en MaxxPro MRAP (bagrampen sænkes hydraulisk, operatørerne løber ned ad den),
//   hijackerne i en gammel GAZ-53-ladvogn (tung opbremsning med let udskridning, bagsmækken slås ned). Mål fra <id>.json.
//   Om natten tænder køretøjet forlygterne (ét fast spotlys, så shaderne aldrig genoversættes), og i regn sprøjter vand i stedet for støv.
//   Køretøjets vej findes automatisk på hver bane (fri, flad strækning ind mod holdets spawn – kollisions-test mod banens colliders),
//   kameraet klippes mellem filmiske vinkler (lavt ved jorden, følgende, slowmotion, kran) og flyver til sidst ind i spillerens øjne.
// createIntro(o) -> { preload(), play(info, ms), update(dt) -> bool (styrer kameraet), stop(), active }
//   o: { THREE, WD, scene, camera, W(), chars(), V(), loadGLB, Audio, $, myPos(), matePos(id), onStart(), onEnd() }
// ==========================================================================
export function createIntro(o) {
  const { THREE, WD } = o;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v, smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }, lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3), easeInOut = t => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const TPL = {}; let loadP = null;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const SPEC = {
    swat: { file: 'maxxpro', len: 6.4, wid: 2.7, wheelR: 0.66, gun: 'm4a1', rear: -2.75, rearY: 1.25, tailOpen: 2.13, tailT: 4.35, tailDur: 1.1 },
    hij: { file: 'gaz', len: 6.2, wid: 2.5, wheelR: 0.46, gun: 'ak47', rear: -3.1, rearY: 1.16, tailOpen: 1.5, tailT: 4.3, tailDur: 0.35,
      seats: [[0.55, 1.16, -2.31], [-0.55, 1.16, -1.71], [0.0, 1.16, -1.11], [0.5, 0.0, 1.11], [-0.5, 0.0, 1.11]] }
  };
  let headL = null;

  function preload() {
    if (loadP) return loadP;
    try { lights(); } catch (e) {}                                          // forlygten findes fra start (fast antal lys i scenen)
    loadP = Promise.all([
      ...Object.values(SPEC).map(async s => {
        try {
          const [g, meta] = await Promise.all([o.loadGLB(THREE, '/assets/vehicles/' + s.file + '.glb?v25'), fetch('/assets/vehicles/' + s.file + '.json?v25').then(r => r.ok ? r.json() : null).catch(() => null)]);
          TPL[s.file] = g.scene;
          if (meta) for (const k of ['len', 'wheelR', 'rear', 'rearY', 'tailOpen']) if (meta[k] !== undefined) s[k] = meta[k];
          if (meta && meta.wid) s.wid = Math.min(meta.wid, 2.7);
          if (meta && meta.seats) s.seats = meta.seats;
        } catch (e) { console.warn('[intro] køretøj', s.file, e); }
      }),
      o.Audio.cinePreload ? o.Audio.cinePreload() : null
    ]);
    return loadP;
  }

  /* ---------------- vej-planlægning: fri, flad strækning ind mod holdets spawn ---------------- */
  function footprintOk(W, x, z, hx, hz, len, wid, y0) {
    const rx = hz, rz = -hx;                                           // højre-vektor
    for (let a = -len / 2; a <= len / 2 + 1e-3; a += Math.min(1.0, len / 4)) for (const b of [-wid / 2, 0, wid / 2]) {
      const px = x + hx * a + rx * b, pz = z + hz * a + rz * b;
      if (WD.isBlocked(W, px, pz, y0 + 0.05, 2.6, 0.45)) return false;
      const g = WD.groundAt(W, px, pz, y0 + 0.6, 0.8);
      if (!isFinite(g) || Math.abs(g - y0) > 0.55) return false;
    }
    return true;
  }
  function plan(W, side) {
    const sp = (W.spawns && W.spawns[side]) || []; if (!sp.length) return null;
    const S = SPEC[side];
    let cx = 0, cz = 0, fx = 0, fz = 0; for (const p of sp) { cx += p.x; cz += p.z; fx += -Math.sin(p.yaw || 0); fz += -Math.cos(p.yaw || 0); }
    cx /= sp.length; cz /= sp.length; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
    const ys = sp.map(p => p.y).sort((a, b) => a - b), y0 = ys[ys.length >> 1];
    let best = null;
    for (let ai = 0; ai < 24; ai++) {
      const a = ai / 24 * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);          // retning ud fra spawn (køretøjet kommer herfra)
      for (const d of [4.5, 6, 7.5, 9, 11]) {
        const sx = cx + dx * d, sz = cz + dz * d;
        if (!footprintOk(W, sx, sz, -dx, -dz, S.len, S.wid, y0)) continue;
        let clear = 0;
        for (let k = 1; k <= 30; k++) { if (!footprintOk(W, sx + dx * k, sz + dz * k, -dx, -dz, S.len, S.wid, y0)) break; clear = k; }
        const score = Math.min(clear, 24) - d * 0.35 + (dx * fx + dz * fz < -0.2 ? 3 : 0) + (clear >= 10 ? 4 : 0);   // helst bagfra (spillerne kigger fremad)
        if (!best || score > best.score) best = { score, stop: V3(sx, y0, sz), dir: V3(dx, 0, dz), clear, d, c: V3(cx, y0, cz), f: V3(fx, 0, fz) };
      }
    }
    if (!best) best = { score: 0, stop: V3(cx - fx * 5, y0, cz - fz * 5), dir: V3(-fx, 0, -fz), clear: 0, d: 5, c: V3(cx, y0, cz), f: V3(fx, 0, fz) };
    best.drive = Math.max(0, Math.min(best.clear, 24));                             // ingen fri strækning => køretøjet holder allerede der
    return best;
  }

  // fallback når der ikke er plads til et køretøj (lukkede gårde/gyder): holdet kommer løbende ind ad den længste frie vej
  function planFoot(W, side, P) {
    const c = P.c, y0 = c.y; let best = null;
    for (let ai = 0; ai < 36; ai++) {
      const a = ai / 36 * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a); let clear = 0, y = y0;
      for (let k = 1; k <= 22; k++) {
        const x = c.x + dx * k, z = c.z + dz * k;
        if (WD.isBlocked(W, x, z, y + 0.05, 1.8, 0.5)) break;
        const g = WD.groundAt(W, x, z, y + 0.6, 0.9); if (!isFinite(g) || Math.abs(g - y) > 0.6) break;
        y = g; clear = k;
      }
      const score = clear + (dx * P.f.x + dz * P.f.z < -0.2 ? 3 : 0);
      if (!best || score > best.score) best = { score, dir: V3(dx, 0, dz), clear, start: V3(c.x + dx * Math.min(clear, 16), y, c.z + dz * Math.min(clear, 16)) };
    }
    return best;
  }

  /* ---------------- køretøj: kopi af skabelonen med probe-belyste materialer ---------------- */
  function makeVehicle(file) {
    const tpl = TPL[file]; if (!tpl) return null;
    const root = tpl.clone(true), V = o.V(), bake = { value: new THREE.Vector4(1, 1, 1, 1) };
    const nodes = {};
    root.traverse(n => {
      if (n.name) nodes[n.name] = n;
      if (!n.isMesh) return;
      n.castShadow = true; n.receiveShadow = true;
      const mats = Array.isArray(n.material) ? n.material : [n.material];
      const nm = mats.map(m => {
        if (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.05) return new THREE.MeshBasicMaterial({ color: m.emissive.clone().multiplyScalar(n.name === 'lights_inner' ? 0.55 : 1.6), toneMapped: false });
        const p = { color: m.color, map: m.map || null, normalMap: m.normalMap || undefined, roughness: m.roughness, metalness: m.metalness };
        const d = V && V.dynMat ? V.dynMat(p) : new THREE.MeshStandardMaterial(p);
        if (d.userData.uBake) d.userData.uBake = bake;
        return d;
      });
      n.material = Array.isArray(n.material) ? nm : nm[0];
    });
    const wheels = ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].map(k => nodes[k]).filter(Boolean);
    const g = new THREE.Group(); g.add(root);
    return { g, root, nodes, wheels, bake, doorL: nodes.door_l, doorR: nodes.door_r, tail: nodes.tailgate, lamp: nodes.lights_inner, d0: {} };
  }

  /* ---------------- effekter: støv, lasere ---------------- */
  let dustTex = null;
  function dustTexture() {
    if (dustTex) return dustTex;
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); dustTex = new THREE.CanvasTexture(c); return dustTex;
  }
  function makeDust(col) {
    const N = 90, geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), al = new Float32Array(N), sz = new Float32Array(N);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('a', new THREE.BufferAttribute(al, 1)); geo.setAttribute('s', new THREE.BufferAttribute(sz, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: dustTexture() }, col: { value: new THREE.Color(col) } }, transparent: true, depthWrite: false,
      vertexShader: 'attribute float a; attribute float s; varying float va; void main(){ va=a; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize = s*420./max(0.5,-mv.z); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform sampler2D map; uniform vec3 col; varying float va; void main(){ vec4 t=texture2D(map, gl_PointCoord); gl_FragColor=vec4(col, t.a*va); }'
    });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
    const P = []; for (let i = 0; i < N; i++) P.push({ x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, t: 9, life: 1, s: 1 });
    let k = 0;
    return {
      obj: pts,
      emit(x, y, z, n, spd, up, size) { for (let i = 0; i < n; i++) { const p = P[k++ % N]; p.x = x + (Math.random() - 0.5) * 0.6; p.y = y + Math.random() * 0.2; p.z = z + (Math.random() - 0.5) * 0.6; const a = Math.random() * 6.283; p.vx = Math.cos(a) * spd * Math.random(); p.vz = Math.sin(a) * spd * Math.random(); p.vy = up * (0.4 + Math.random()); p.t = 0; p.life = 1.4 + Math.random() * 1.6; p.s = (size || 1) * (0.6 + Math.random() * 0.8); } },
      update(dt) {
        for (let i = 0; i < N; i++) {
          const p = P[i]; p.t += dt; const f = p.t / p.life;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vx *= Math.exp(-dt * 1.4); p.vz *= Math.exp(-dt * 1.4); p.vy *= Math.exp(-dt * 1.2);
          pos[i * 3] = p.x; pos[i * 3 + 1] = f < 1 ? p.y : -999; pos[i * 3 + 2] = p.z;
          al[i] = f < 1 ? Math.sin(Math.PI * Math.min(1, f * 1.4)) * 0.45 * (1 - f) : 0; sz[i] = p.s * (1 + f * 2.2);
        }
        geo.attributes.position.needsUpdate = true; geo.attributes.a.needsUpdate = true; geo.attributes.s.needsUpdate = true;
      }
    };
  }
  function makeLaser(color) {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 1, 5, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    beam.geometry.translate(0, 0.5, 0); beam.geometry.rotateX(Math.PI / 2);         // langs +z fra origo
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    const g = new THREE.Group(); g.add(beam); g.add(dot); g.frustumCulled = false;
    return { g, beam, dot };
  }

  /* ---------------- tilstand ---------------- */
  let S = null; const parked = [];
  const _v = V3(0, 0, 0), _w = V3(0, 0, 0), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();

  function lights() {
    if (headL) return headL;
    const sp = new THREE.SpotLight(0xfff0d8, 0, 38, 0.5, 0.55, 1.6); sp.castShadow = false; const tg = new THREE.Object3D(); sp.target = tg;
    const strobe = new THREE.PointLight(0xff2010, 0, 16, 1.6), inner = new THREE.PointLight(0xffc37a, 0, 7, 1.8);   // politiblink · lys fra mandskabsrummet
    for (const l of [sp, tg, strobe, inner]) o.scene().add(l);
    headL = { sp, tg, strobe, inner }; return headL;
  }
  function play(info, ms) {
    stop(); clearParked(); lights();
    const W = o.W(), side = info.side === 'hij' ? 'hij' : 'swat', spec = SPEC[side], C = o.chars();
    const P = plan(W, side); if (!P || !C) return false;
    const foot = P.drive < 6 ? planFoot(W, side, P) : null;              // ingen plads til køretøjet => til fods
    const veh = foot ? null : makeVehicle(spec.file);
    const T = Math.max(6, (ms || 12000) / 1000);
    const th = (o.V() && o.V().theme) || {}, wet = !!th.rain;
    S = { t: 0, T, side, spec, P, veh, foot, men: [], shot: -1, slow: 1, sounds: [], wet, night: !!th.night, dust: makeDust(wet ? 0x7d8590 : side === 'hij' ? 0xcdb48e : 0xbab4a8), lasers: [], fired: {}, info, startCam: null };
    o.scene().add(S.dust.obj);
    if (veh) { o.scene().add(veh.g); }
    // holdkammerater (inkl. en selv) – rifler i cutscenen
    const mates = info.mates.slice(0, 5);
    mates.forEach((m, i) => {
      const h = C.buildHuman(side, m.cos && m.cos.agent ? m.cos.agent[side] : null); h.skins = (m.cos && m.cos.skins) || {};
      o.scene().add(h.group); h.group.visible = false;
      const man = { h, id: m.id, me: !!m.me, i, ph: 'wait', x: 0, y: 0, z: 0, yaw: 0, tx: 0, tz: 0, ty: P.stop.y, exitT: 0, crouch: false, air: false, landT: -1 };
      if (side === 'swat') { const l = makeLaser(i % 2 ? 0x30ff60 : 0xff2a1a); o.scene().add(l.g); man.laser = l; }
      S.men.push(man);
    });
    o.onStart && o.onStart();
    return true;
  }

  // køretøjets placering ved tid t: kører ind langs -dir og bremser til stop (pickup: håndbremse-sving til sidst)
  function vehiclePose(t, out) {
    const P = S.P, drive = P.drive, side = S.side, Tin = side === 'hij' ? 3.8 : 4.2;
    const k = drive > 0 ? easeOut(t / Tin) : 1, dist = drive * (1 - k);
    out.x = P.stop.x + P.dir.x * dist; out.z = P.stop.z + P.dir.z * dist; out.y = P.stop.y;
    let yaw = Math.atan2(-P.dir.x, -P.dir.z), slide = 0;
    if (side === 'hij') {                                                    // tung lastbil: hård opbremsning, bagenden skrider lidt ud (~30°)
      const s = smooth((t - (Tin - 1.4)) / 1.4); yaw += s * 0.55; slide = s;
      const rx = -P.dir.z, rz = P.dir.x; out.x += rx * slide * 0.7; out.z += rz * slide * 0.7;
    }
    out.yaw = yaw; out.v = drive > 0 && t < Tin ? drive * 3 * Math.pow(1 - clamp(t / Tin, 0, 1), 2) / Tin : 0; out.slide = slide; out.Tin = Tin;
    return out;
  }
  const VP = { x: 0, y: 0, z: 0, yaw: 0, v: 0, slide: 0, Tin: 4 };

  // lokale punkter i køretøjet -> verden
  function vlocal(lx, ly, lz, out) { return out.set(lx, ly, lz).applyMatrix4(S.veh.g.matrixWorld); }

  /* ---------------- kamera-regi: skud i køretøjets stop-ramme (f = fremad, r = højre); stråle-tjek mod vægge ---------------- */
  function camSafe(target, want, out) {
    const W = o.W(), dx = want.x - target.x, dy = want.y - target.y, dz = want.z - target.z, d = Math.hypot(dx, dy, dz);
    if (d < 0.01) return out.copy(want);
    const t = WD.raycastWorld(W, target.x, target.y, target.z, dx / d, dy / d, dz / d, d);
    const k = t < d ? Math.max(0.6, t - 0.35) / d : 1;
    return out.set(target.x + dx * k, target.y + dy * k, target.z + dz * k);
  }
  function frameAt(px, pz, yaw) {                                            // f/r ud fra en position og retning
    const f = V3(Math.sin(yaw), 0, Math.cos(yaw)), r = V3(-f.z, 0, f.x);
    return { p: V3(px, S.P.stop.y, pz), f, r };
  }
  function at(F, a, up, b) { return F.p.clone().addScaledVector(F.f, a).addScaledVector(F.r, b).setY(F.p.y + up); }

  function shotsFoot(t) {
    const F = S.foot, c = S.P.c, d = F.dir, r = V3(-d.z, 0, d.x), mid = c.clone().addScaledVector(d, Math.min(F.clear, 16) * 0.45);
    if (t < 1.6) { const k = t / 1.6; return { pos: c.clone().addScaledVector(d, -1.5).addScaledVector(r, 1.4).setY(c.y + 0.35 + k * 0.1), look: F.start.clone().setY(F.start.y + 1.2), fov: 44 }; }
    if (t < 4.6) { const k = (t - 1.6) / 3.0; return { pos: mid.clone().addScaledVector(r, 2.7).setY(mid.y + 0.3 + k * 0.2), look: mid.clone().addScaledVector(d, 1.5 - k * 3.5).setY(mid.y + 1.1), fov: 50 }; }
    if (t < 6.8) { const k = (t - 4.6) / 2.2, lead = S.men[0]; const lp = lead ? V3(lead.x, lead.y, lead.z) : c; return { pos: lp.clone().addScaledVector(d, 3.2 - k * 0.6).addScaledVector(r, -0.9).setY(lp.y + 1.6), look: lp.clone().addScaledVector(d, -3).setY(lp.y + 1.0), fov: 46 }; }
    return null;
  }
  function shots(t) {
    if (S.foot) { const f = shotsFoot(t); if (f) return f; return finalShots(t, 6.8); }
    const side = S.side, vp = VP, Fv = frameAt(vp.x, vp.z, vp.yaw), Fs = frameAt(S.P.stop.x, S.P.stop.z, vehiclePose(99, {}).yaw);
    const L = S.spec.len;
    if (side === 'swat') {
      if (t < 2.3) {                                                            // A: lavt ved vejkanten, køretøjet buldrer frem mod kameraet
        const k = t / 2.3; return { pos: at(Fs, L * 0.9 + 2, 0.45, 3.4 + k * 0.4), look: at(Fv, L * 0.3, 1.3, 0), fov: 46 };
      }
      if (t < 4.3) {                                                            // B: tæt på forhjulet, kameraet følger med og stopper
        const k = (t - 2.3) / 2.0; return { pos: at(Fv, L * 0.5 + 1.6 - k * 0.8, 0.8 + k * 0.35, 3.9 + k * 0.5), look: at(Fv, L * 0.15, 1.15, 0.9), fov: 40 };
      }
      if (t < 5.3) {                                                            // C: bagdørene – de slås op
        return { pos: at(Fs, -L / 2 - 3.6, 1.6, 1.4), look: at(Fs, -L / 2, 1.7, 0), fov: 40 };
      }
      if (t < 7.6) {                                                            // D: lavt bag køretøjet – operatørerne springer ud mod kameraet (slowmotion)
        const k = (t - 5.3) / 2.3; return { pos: at(Fs, -L / 2 - 5.5 + k * 0.8, 0.35, -1.6 + k * 0.9), look: at(Fs, -L / 2 - 1.2, 1.15, 0), fov: 52 };
      }
    } else {
      if (t < 2.0) {                                                            // A: lavt foran – pickuppen drøner ind
        const k = t / 2.0; return { pos: at(Fs, L * 0.5 + 6.5, 0.4, -2.8 + k * 0.5), look: at(Fv, 0, 1.0, 0), fov: 44 };
      }
      if (t < 3.9) {                                                            // B: side-sving i støvskyen
        const k = (t - 2.0) / 1.9; return { pos: at(Fs, 1.5 - k * 1.5, 1.2, -6.2 + k * 0.8), look: at(Fv, 0, 0.9, 0), fov: 50 };
      }
      if (t < 6.8) {                                                            // C: fra jorden – hijackerne springer over ladet (slowmotion)
        const F = frameAt(vp.x, vp.z, vp.yaw), k = (t - 3.9) / 2.9; return { pos: at(F, -1.0 + k * 0.6, 0.3, 5.6 - k * 0.6), look: at(F, -0.6, 1.25, 1.0), fov: 54 };
      }
    }
    return finalShots(t, side === 'swat' ? 7.6 : 6.8);
  }
  function finalShots(t, t0) {
    // E: kran tæt bag holdet (langsomt kredsløb), F: ind i spillerens øjne
    const me = S.men.find(m => m.me), mp = o.myPos(), tF = S.T - 2.2;
    const focus = me ? V3(me.x, me.y, me.z) : S.P.c.clone();
    const yaw0 = mp ? mp.yaw : Math.atan2(-S.P.f.x, -S.P.f.z), fwd0 = V3(-Math.sin(yaw0), 0, -Math.cos(yaw0)), rgt0 = V3(-fwd0.z, 0, fwd0.x);
    const orbit = (t - t0) * 0.16, cs = Math.cos(orbit), sn = Math.sin(orbit);
    const back = V3(-fwd0.x * cs + rgt0.x * sn, 0, -fwd0.z * cs + rgt0.z * sn);
    const crane = focus.clone().addScaledVector(back, 4.2).addScaledVector(rgt0, 1.6).setY(focus.y + 2.6);
    const look = focus.clone().setY(focus.y + 1.1).addScaledVector(fwd0, 2.5);
    if (t < tF) { const k = smooth((t - t0) / 0.9); return { pos: crane.clone().setY(crane.y + (1 - k) * 2.5), look, fov: 48 }; }
    const k = easeInOut((t - tF) / 2.2), eye = mp ? V3(mp.x, mp.y + 1.62, mp.z) : look;
    return { pos: V3(lerp(crane.x, eye.x, k), lerp(crane.y, eye.y, k), lerp(crane.z, eye.z, k)), look: V3(lerp(look.x, eye.x + fwd0.x * 10, k), lerp(look.y, eye.y, k), lerp(look.z, eye.z + fwd0.z * 10, k)), fov: lerp(48, 90, k), fp: k };
  }

  /* ---------------- lyd ---------------- */
  function snd(name, op) { const h = o.Audio.cine && o.Audio.cine(name, op); if (h) S.sounds.push(h); return h; }
  function cue(key, t, fn) { if (!S.fired[key] && S.t >= t) { S.fired[key] = 1; try { fn(); } catch (e) { console.warn('[intro] lyd', e); } } }

  /* ---------------- figurerne ---------------- */
  function updateMen(dt, t) {
    const C = o.chars(), side = S.side, L = S.spec.len, vp = VP;
    const Fs = frameAt(S.P.stop.x, S.P.stop.z, vehiclePose(99, {}).yaw), tsec = performance.now() / 1000;
    S.men.forEach((m, i) => {
      const h = m.h;
      // mål: spillerens egen spawn (fra serveren) eller holdkammeratens position; ellers spawn-listen
      if (m.ph === 'run' && !m.tgtFixed) {
        const p = m.me ? o.myPos() : o.matePos(m.id); const sp = (o.W().spawns[side] || [])[i % Math.max(1, (o.W().spawns[side] || []).length)];
        const q = p || sp; if (q) { m.tx = q.x; m.tz = q.z; m.ty = q.y; m.tyaw = q.yaw !== undefined ? q.yaw : 0; m.tgtFixed = !!p; }
      }
      if (S.foot) {
        const st0 = 1.2 + i * 0.38;
        if (t < st0) { m.ph = 'wait'; h.group.visible = false; return; }
        if (m.ph === 'wait') { const F = S.foot, r = V3(-F.dir.z, 0, F.dir.x), off = (i % 2 ? 1 : -1) * 0.55 * Math.min(1, i); m.x = F.start.x + r.x * off + F.dir.x * i * 0.6; m.z = F.start.z + r.z * off + F.dir.z * i * 0.6; m.y = F.start.y; m.ph = 'run'; h.group.visible = true; }
      } else if (side === 'swat') {
        const exitT = 5.55 + i * 0.45;
        if (t < exitT) { m.ph = 'wait'; h.group.visible = false; return; }
        if (m.ph === 'wait') { m.ph = 'jump'; m.j0 = t; const sp = S.spec, a = vlocal((i % 2 ? 0.3 : -0.3), sp.rearY, sp.rear + 0.5, V3(0, 0, 0)); m.x = a.x; m.y = a.y; m.z = a.z; const b = vlocal((i % 2 ? 0.75 : -0.75), 0, sp.rear - 2.3, V3(0, 0, 0)); m.jx = b.x; m.jz = b.z; m.jy = S.P.stop.y; m.ax = a.x; m.ay = a.y; m.az = a.z; h.group.visible = true; snd('land', { vol: 0.6, at: 0.45, pos: { x: b.x, y: m.jy, z: b.z } }); }
      } else {
        // hijackerne står/sidder på ladet under kørslen, springer ud over siden efter svinget
        const exitT = 4.0 + i * 0.3;
        if (m.ph === 'wait' || m.ph === 'ride') {
          m.ph = 'ride'; h.group.visible = i < 3 || t > exitT;
          const seat = (S.spec.seats || [[0.45, 0.78, -1.3], [-0.45, 0.78, -1.75], [0.0, 0.78, -2.2], [0.5, 0.0, 0.55], [-0.5, 0.0, 0.55]])[i];
          const a = vlocal(seat[0], seat[1], seat[2], V3(0, 0, 0)); m.x = a.x; m.y = a.y; m.z = a.z; m.yaw = vp.yaw + (i < 3 ? (i % 2 ? 0.6 : -0.6) : 0);
          m.crouch = i < 3;
          if (t >= exitT) {
            m.ph = 'jump'; m.j0 = t; m.ax = a.x; m.ay = a.y; m.az = a.z; m.crouch = false;
            const hw = S.spec.wid / 2, b = i < 3 ? vlocal(seat[0] * 0.6, 0, S.spec.rear - 1.4 - i * 0.15, V3(0, 0, 0)) : vlocal(i === 3 ? hw + 0.45 : -hw - 0.45, 0, seat[2] + 0.3, V3(0, 0, 0));
            if (i >= 3) { m.ay = S.P.stop.y; }                                        // fra førerhuset: træder bare ud
            m.jx = b.x; m.jz = b.z; m.jy = S.P.stop.y;
            snd('land', { vol: 0.6, at: 0.5, pos: { x: b.x, y: m.jy, z: b.z } });
          }
        }
      }
      if (m.ph === 'jump') {
        const dur = side === 'swat' && !S.foot ? 0.75 : 0.62, k = clamp((t - m.j0) / dur, 0, 1);
        m.x = lerp(m.ax, m.jx, k); m.z = lerp(m.az, m.jz, k);
        m.y = side === 'swat' && !S.foot ? lerp(m.ay, m.jy, k) + Math.sin(k * Math.PI) * 0.12 : lerp(m.ay, m.jy, k * k) + Math.sin(k * Math.PI) * 0.45;   // SWAT løber ned ad rampen, hijackerne springer
        m.air = k < 0.95; m.yaw = Math.atan2(-(m.jx - m.ax), -(m.jz - m.az));
        if (k >= 1) { m.ph = 'land'; m.l0 = t; m.air = false; }
      } else if (m.ph === 'land') {
        m.crouch = t - m.l0 < 0.35;
        if (t - m.l0 > 0.4) { m.ph = 'run'; }
      } else if (m.ph === 'run') {
        const dx = m.tx - m.x, dz = m.tz - m.z, d = Math.hypot(dx, dz), sp = Math.min(5.2, d * 2.2) * dt;
        if (d > 0.08) { m.x += dx / d * Math.min(d, sp); m.z += dz / d * Math.min(d, sp); m.yaw = Math.atan2(-dx, -dz); }
        else { m.yaw = m.yaw + (((m.tyaw || 0) - m.yaw + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 6); }
        const g = WD.groundAt(o.W(), m.x, m.z, m.y + 0.6, 0.9); if (isFinite(g)) m.y += (g - m.y) * Math.min(1, dt * 12);
      }
      C.animateHuman(h, dt, tsec, { x: m.x, y: m.y, z: m.z, yaw: m.yaw, pitch: m.ph === 'run' ? -0.12 : 0, alive: true, crouch: m.crouch, grounded: !m.air, wcode: (WD.WEAPONS[S.spec.gun] || {}).code || 0 });
      if (!m.bakeT || tsec - m.bakeT > 0.15) { m.bakeT = tsec; const V = o.V(); if (V && V.probe) { const bk = [0, 0, 0, 0]; V.probe(m.x, m.y + 1.1, m.z, bk); C.setBake(h, bk); } }
      // lasersigte langs våbnet
      if (m.laser) {
        const on = h.group.visible && h.flash; m.laser.g.visible = !!on;
        if (on) {
          h.flash.updateMatrixWorld(true); h.flash.getWorldPosition(_v); h.gun.getWorldQuaternion(_q); _w.set(0, 0, -1).applyQuaternion(_q);
          const W = o.W(), hit = Math.min(40, WD.raycastWorld(W, _v.x, _v.y, _v.z, _w.x, _w.y, _w.z, 40));
          m.laser.g.position.copy(_v); m.laser.g.quaternion.setFromUnitVectors(V3(0, 0, 1), _w); m.laser.beam.scale.set(1, 1, hit); m.laser.dot.position.set(0, 0, hit - 0.01);
          m.laser.beam.material.opacity = 0.35 + Math.random() * 0.15;
        }
      }
    });
  }

  /* ---------------- hovedløkke ---------------- */
  function update(dt) {
    if (!S) return false;
    const target = S.slowT !== undefined ? S.slowT : 1; S.slow += (target - S.slow) * Math.min(1, dt * 6);
    const sdt = dt * S.slow; S.t += sdt; const t = S.t, side = S.side, cam = o.camera();
    // slowmotion: SWAT idet den første springer ud / hijackerne over ladet
    S.slowT = S.foot ? (t > 2.6 && t < 3.6 ? 0.45 : 1) : side === 'swat' ? (t > 5.5 && t < 6.6 ? 0.42 : 1) : (t > 4.05 && t < 5.0 ? 0.4 : 1);
    // køretøj
    const vp = vehiclePose(t, VP);
    if (S.veh) {
      const v = S.veh, g = v.g;
      const decel = side === 'swat' ? (t > vp.Tin - 1.2 && t < vp.Tin + 0.5 ? Math.sin(clamp((t - (vp.Tin - 1.2)) / 1.7, 0, 1) * Math.PI) : 0) : vp.slide * (1 - vp.slide) * 4;
      g.position.set(vp.x, vp.y, vp.z); g.rotation.set(0, vp.yaw, 0);
      v.root.rotation.x = decel * 0.035; v.root.rotation.z = side === 'hij' ? Math.sin(vp.slide * Math.PI) * 0.06 : 0; v.root.position.y = -decel * 0.05;
      for (const w of v.wheels) w.rotation.x += vp.v * sdt / S.spec.wheelR;
      if (v.doorL && v.doorR) { const k = easeOut((t - 4.55) / 0.5); v.doorL.rotation.y = k * 1.9; v.doorR.rotation.y = -k * 1.9; }
      if (v.tail) {                                                          // MaxxPro: hydraulisk rampe (blød start, lille fjedring i bunden) · GAZ: smækken slås ned
        const sp = S.spec, u = clamp((t - sp.tailT) / sp.tailDur, 0, 1);
        const k = side === 'swat' ? easeInOut(u) + Math.sin(clamp((t - sp.tailT - sp.tailDur) / 0.35, 0, 1) * Math.PI) * 0.025 : Math.min(1, u * u * 1.15) - (u >= 1 ? Math.sin(clamp((t - sp.tailT - sp.tailDur) / 0.3, 0, 1) * Math.PI) * 0.06 : 0);
        v.tail.rotation.x = -k * sp.tailOpen;
      }
      // forlygter om natten
      if (headL) {
        const nk = S.night ? 1 : 0.35;
        if (S.night) { vlocal(0, 1.1, S.spec.len / 2 - 0.2, headL.sp.position); vlocal(0, 0.2, S.spec.len / 2 + 14, headL.tg.position); headL.sp.intensity = 120 * (t < vp.Tin + 6 ? 1 : 0.45); }
        if (side === 'swat') {
          // blink: dobbelt-blink skiftevis rødt/blåt (4 Hz), ud over den våde gade
          const ph = (t * 2) % 1, red = Math.floor(t * 2) % 2 === 0, on = ph < 0.12 || (ph > 0.2 && ph < 0.32);
          vlocal(0, 2.0, S.spec.len / 2 - 0.6, headL.strobe.position); headL.strobe.color.setHex(red ? 0xff2010 : 0x2448ff); headL.strobe.intensity = on ? 38 * nk : 0;
          const u = clamp((t - S.spec.tailT) / S.spec.tailDur, 0, 1);
          vlocal(0, S.spec.rearY + 1.2, S.spec.rear + 0.9, headL.inner.position); headL.inner.intensity = u * 9 * (S.night ? 1 : 0.5);
        }
      }
      g.updateMatrixWorld(true);
      if (!v.bakeT || t - v.bakeT > 0.15) { v.bakeT = t; const V = o.V(); if (V && V.probe) { const bk = [0, 0, 0, 0]; V.probe(vp.x, vp.y + 1.4, vp.z, bk); v.bake.value.set(bk[0], bk[1], bk[2], Math.max(0.12, bk[3])); } }
      // støv fra hjulene (meget ved håndbremse-svinget)
      if (vp.v > 0.5 || (side === 'hij' && vp.slide > 0.02 && vp.slide < 0.98)) {
        S.dAcc = (S.dAcc || 0) + sdt * (side === 'hij' ? 26 : 10) * (S.wet ? 0.5 : 1) * (1 + (side === 'hij' ? vp.slide * (1 - vp.slide) * 10 : 0));
        while (S.dAcc > 1) { S.dAcc--; const wh = v.wheels[2 + (Math.random() < 0.5 ? 0 : 1)] || v.wheels[0]; if (wh) { wh.getWorldPosition(_v); S.dust.emit(_v.x, vp.y + 0.1, _v.z, 1, 1.5 + vp.v * 0.08, 0.6, side === 'hij' ? 1.4 : 1); } }
      }
      if (side === 'swat' && t > vp.Tin - 0.1 && !S.fired.puff) { S.fired.puff = 1; for (const w of v.wheels) { w.getWorldPosition(_v); S.dust.emit(_v.x, vp.y + 0.1, _v.z, S.wet ? 3 : 6, 1.2, S.wet ? 0.3 : 0.5, 1.2); } }
      if (v.lamp) v.lamp.visible = t > 4.4;
    }
    S.dust.update(sdt);
    updateMen(sdt, t);
    // lyd-cues
    const V0 = S.veh ? S.veh.g.position : S.P.stop, vpos = { x: V0.x, y: V0.y + 1, z: V0.z };
    if (S.foot) {
      cue('radio', 0.2, () => snd(side === 'swat' ? 'radio' : 'battlecry', { vol: side === 'swat' ? 0.35 : 0.7 }));
      cue('steps', 1.1, () => { snd('steps', { vol: 0.9 }); snd('gear', { vol: 0.8, at: 0.3 }); });
      cue('steps2', 2.9, () => snd('steps', { vol: 0.8, rate: 1.05 }));
      cue('slow', 2.6, () => snd('slowmo', { vol: 0.6 }));
      cue('cock', 4.8, () => { snd('cock', { vol: 0.85 }); snd('cock', { vol: 0.6, at: 0.32, rate: 0.9 }); });
    } else if (side === 'swat') {
      cue('arr', 0, () => { S.eng = snd('truck_arrive', { vol: 1.0, pos: vpos, ref: 8 }); });
      cue('radio', 0.6, () => snd('radio', { vol: 0.32 }));
      cue('brake', 2.9, () => snd('truck_brake', { vol: 0.9, pos: vpos, ref: 8 }));
      cue('hiss', 4.1, () => { snd('air_hiss', { vol: 0.8, pos: vpos }); S.idle = snd('idle', { vol: 0.35, loop: true, pos: vpos, fadeIn: 0.5 }); });
      cue('doors', 4.5, () => { snd('van_doors', { vol: 1.0, pos: vpos }); snd('metal_door', { vol: 0.6, pos: vpos, at: 0.05 }); });
      cue('slow', 5.45, () => { snd('slowmo', { vol: 0.7 }); snd('gear', { vol: 0.8 }); });
      cue('cock', 6.7, () => { snd('cock', { vol: 0.8 }); snd('cock', { vol: 0.6, at: 0.35, rate: 0.96 }); });
      cue('steps', 7.0, () => snd('steps', { vol: 0.7 }));
      cue('radio2', 7.8, () => snd('radio', { vol: 0.28, offset: 2.5 }));
    } else {
      cue('arr', 0, () => { S.eng = snd('pickup', { vol: 1.0, pos: vpos, ref: 7 }); snd('rev', { vol: 0.8, at: 0.4, pos: vpos }); });
      cue('skid', 2.15, () => snd('skid', { vol: 1.0, pos: vpos, ref: 9 }));
      cue('squeal', 2.9, () => snd('brake_squeal', { vol: 0.6, pos: vpos }));
      cue('cry', 4.0, () => snd('battlecry', { vol: 0.75 }));
      cue('slow', 4.05, () => { snd('slowmo', { vol: 0.7 }); snd('gear', { vol: 0.8 }); });
      cue('door', 4.3, () => snd('car_door', { vol: 0.9, pos: vpos }));
      cue('cock', 5.6, () => { snd('cock', { vol: 0.85, rate: 0.9 }); snd('cock', { vol: 0.6, at: 0.3, rate: 0.85 }); });
      cue('steps', 5.9, () => snd('steps', { vol: 0.7 }));
    }
    cue('fx', S.T - 4.8, () => snd('arrive_fx', { vol: 0.7, music: true }));
    if (S.eng && S.veh) S.eng.setPos(vpos);
    if (S.idle) S.idle.setPos(vpos);
    // kamera
    const sh = shots(t), tgt = sh.look;
    camSafe(tgt, sh.pos, cam.position);
    cam.lookAt(tgt);
    if (Math.abs(cam.fov - sh.fov) > 0.01) { cam.fov = sh.fov; cam.updateProjectionMatrix(); }
    if (sh.fp !== undefined) {                                              // sidste skud: egen figur skjules når kameraet når øjnene
      const me = S.men.find(m => m.me); if (me) me.h.group.visible = sh.fp < 0.75;
      const L = o.$('introBars'); if (L) L.style.setProperty('--bar', ((1 - sh.fp) * 11).toFixed(2) + 'vh');
    }
    if (t >= S.T) { stop(); return false; }
    return true;
  }

  function stop() {
    if (!S) return;
    const s = S; S = null;
    if (headL) { headL.sp.intensity = 0; headL.strobe.intensity = 0; headL.inner.intensity = 0; }
    for (const m of s.men) { o.scene().remove(m.h.group); if (m.laser) o.scene().remove(m.laser.g); }
    // køretøjet bliver holdende (parkeret) resten af købsfasen – så det ikke forsvinder for øjnene af spilleren
    if (s.veh) { const left = o.keepMs ? o.keepMs() : 0; if (left > 200) { parked.push(s.veh.g); setTimeout(() => { o.scene().remove(s.veh.g); parked.splice(parked.indexOf(s.veh.g), 1); }, left); } else o.scene().remove(s.veh.g); }
    o.scene().remove(s.dust.obj);
    for (const h of s.sounds) try { h.stop(0.6); } catch (e) {}
    o.onEnd && o.onEnd();
  }
  function clearParked() { for (const g of parked.splice(0)) o.scene().remove(g); }
  return { preload, play, update, stop, plan, planFoot, clearParked, get active() { return !!S; }, get t() { return S ? S.t : 0; } };
}
