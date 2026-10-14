// ==========================================================================
// EFFEKTER (v9): GPU-billboard-partikler + røg, ild og flashbang
//   • Partikler tegnes som instancede kamera-vendte firkanter (ikke GL-punkter): ingen maks. punktstørrelse,
//     så røg ser PRÆCIS ens ud uanset FOV – også gennem AWP-zoom (fov 26°), hvor punkt-sprites før blev klippet og røgen blev gennemsigtig.
//   • RØG: tæt sky af bløde puffs (sorteret bagfra-og-frem, gennemsigtig kø) OMKRING en uigennemsigtig kerne der SKRIVER TIL DYBDEBUFFEREN.
//     Kernen garanterer at intet bag røgen kan ses – heller ikke med scope. Lyset tages fra banens lys-prober.
//   • ILD (molotov/brandgranat): 3D-polygon-zone på gulvet (samme polygon som serverens skadeszone – WD.fireZone), glødende gulvflade,
//     forkullet plet, flamme-/røg-/gnistpartikler og en flimrende orange PointLight (fra en fast pulje => ingen shader-genkompilering).
//   • FLASHBANG: hvidt HDR-glimt (bloom) + kraftigt lysblink.
//   • v12: KUGLE-NEDSLAG: gnister + støvpust (impact) – også for ens egne skud.
// createFx(THREE, { scene, probe, canvasTexture, WD, getW, audio, lights:[PointLight…] }) -> { smoke, fire, flashPop, trailFlame, impact, update(dt, cam), clear() }
// ==========================================================================
export function createFx(THREE, o) {
  const { scene, WD } = o;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  const rnd = seed => { let s = (seed >>> 0) % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

  /* ---------------- teksturer ---------------- */
  const tex = (draw, size) => { const t = o.canvasTexture(draw, size, size); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; };
  const puffTex = tex((c, w, h) => {                       // blød, uregelmæssig røg-puf
    const R = rnd(7);
    for (let i = 0; i < 26; i++) { const x = w / 2 + (R() - 0.5) * w * 0.42, y = h / 2 + (R() - 0.5) * h * 0.42, r = w * (0.16 + R() * 0.22), g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,255,255,${0.28 + R() * 0.2})`); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }
    const g = c.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(0.7, 'rgba(255,255,255,.25)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    const id = c.getImageData ? c.getImageData(0, 0, w, h) : null;
    if (id && id.data) { const d = id.data; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = (y * w + x) * 4, dx = x / w - 0.5, dy = y / h - 0.5, fall = clamp(1 - Math.hypot(dx, dy) * 2, 0, 1); d[k + 3] = Math.min(255, d[k + 3] * Math.pow(fall, 0.6)); d[k] = d[k + 1] = d[k + 2] = 255; } c.putImageData(id, 0, 0); }
  }, 128);
  const flameTex = tex((c, w, h) => {                      // flamme-tunge: blød, flosset kant, lysere kerne forneden (alpha bærer formen)
    const R = rnd(13);
    for (let i = 0; i < 18; i++) {
      const t = i / 17, cx = w / 2 + (R() - 0.5) * w * 0.18 * t, cy = h * (0.86 - t * 0.66), r = w * (0.3 - t * 0.2) * (0.8 + R() * 0.4);
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(255,255,255,${0.32 - t * 0.18})`); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    }
  }, 128);
  const dotTex = tex((c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }, 64);
  const glowTex = tex((c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.6, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }, 128);

  /* ---------------- instancet billboard-lag ---------------- */
  function layer(map, additive, cap, fog) {
    const base = new THREE.PlaneGeometry(1, 1), geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index; geo.setAttribute('position', base.attributes.position); geo.setAttribute('uv', base.attributes.uv);
    const P = new Float32Array(cap * 4), Cc = new Float32Array(cap * 4), Rr = new Float32Array(cap);
    const aP = new THREE.InstancedBufferAttribute(P, 4), aC = new THREE.InstancedBufferAttribute(Cc, 4), aR = new THREE.InstancedBufferAttribute(Rr, 1);
    aP.setUsage(THREE.DynamicDrawUsage); aC.setUsage(THREE.DynamicDrawUsage); aR.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', aP); geo.setAttribute('iCol', aC); geo.setAttribute('iRot', aR); geo.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
      uniforms: Object.assign({ map: { value: map } }, fog ? THREE.UniformsUtils.clone(THREE.UniformsLib.fog) : {}),
      vertexShader: `attribute vec4 iPos; attribute vec4 iCol; attribute float iRot; varying vec2 vUv; varying vec4 vCol;
        #include <fog_pars_vertex>
        void main() {
          vUv = uv; vCol = iCol;
          vec4 mvPosition = modelViewMatrix * vec4(iPos.xyz, 1.0);
          float c = cos(iRot), s = sin(iRot);
          mvPosition.xy += mat2(c, s, -s, c) * position.xy * iPos.w;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying vec4 vCol;
        #include <fog_pars_fragment>
        void main() { vec4 t = texture2D(map, vUv); gl_FragColor = vec4(vCol.rgb * t.rgb, t.a * vCol.a); if (gl_FragColor.a < 0.004) discard;
        #include <fog_fragment>
        }`,
      transparent: true, depthWrite: false, depthTest: true, fog: !!fog,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = additive ? 12 : 10;
    scene.add(mesh);
    const L = { mesh, n: 0, cap, P, Cc, Rr, sort: !additive, items: [] };
    L.push = (x, y, z, size, r, g, b, a, rot) => { if (L.n >= cap) return; const i = L.n++; L.items.push(i); P[i * 4] = x; P[i * 4 + 1] = y; P[i * 4 + 2] = z; P[i * 4 + 3] = size; Cc[i * 4] = r; Cc[i * 4 + 1] = g; Cc[i * 4 + 2] = b; Cc[i * 4 + 3] = a; Rr[i] = rot || 0; };
    L.begin = () => { L.n = 0; L.items.length = 0; };
    const tmpP = new Float32Array(cap * 4), tmpC = new Float32Array(cap * 4), tmpR = new Float32Array(cap), dist = new Float32Array(cap), idx = [];
    L.end = cam => {
      if (L.sort && L.n > 1) {                             // gennemsigtig kø: bagfra og frem
        idx.length = L.n; for (let i = 0; i < L.n; i++) { idx[i] = i; const dx = P[i * 4] - cam.x, dy = P[i * 4 + 1] - cam.y, dz = P[i * 4 + 2] - cam.z; dist[i] = dx * dx + dy * dy + dz * dz; }
        idx.sort((a, b) => dist[b] - dist[a]);
        for (let k = 0; k < L.n; k++) { const i = idx[k]; for (let j = 0; j < 4; j++) { tmpP[k * 4 + j] = P[i * 4 + j]; tmpC[k * 4 + j] = Cc[i * 4 + j]; } tmpR[k] = Rr[i]; }
        P.set(tmpP.subarray(0, L.n * 4)); Cc.set(tmpC.subarray(0, L.n * 4)); Rr.set(tmpR.subarray(0, L.n));
      }
      geo.instanceCount = L.n;
      if (L.n) { aP.needsUpdate = true; aC.needsUpdate = true; aR.needsUpdate = true; }
    };
    return L;
  }
  const LSmoke = layer(puffTex, false, 900, true), LFire = layer(flameTex, true, 700, false), LDot = layer(dotTex, true, 400, false), LGlow = layer(glowTex, true, 32, false);

  const systems = new Set(), _pr = [0, 0, 0, 0];
  const lightPool = (o.lights || []).map(l => ({ light: l, owner: null }));
  const takeLight = owner => { const s = lightPool.find(p => !p.owner); if (s) s.owner = owner; return s || null; };
  const freeLight = s => { if (s) { s.owner = null; s.light.intensity = 0; } };

  /* ---------------- RØG ---------------- */
  const coreGeo = new THREE.IcosahedronGeometry(1, 2);
  function smoke(x, y, z) {
    o.probe(x, y + 1.2, z, _pr);
    const lum = 0.42 + 0.58 * _pr[3], col = [lum * 0.84 + _pr[0] * 0.15, lum * 0.85 + _pr[1] * 0.15, lum * 0.87 + _pr[2] * 0.15];
    const R = rnd((x * 131 + z * 71 + 9973) | 0), N = 60, puffs = [];
    for (let i = 0; i < N; i++) {                          // fyld en fladtrykt ellipsoide (helt ned til jorden); flest puffs i skallen
      const u = R(), v = R(), th = u * Math.PI * 2, ph = Math.acos(1 - 2 * v), rr = Math.pow(R(), 0.4);
      puffs.push({ dx: Math.sin(ph) * Math.cos(th) * rr, dy: Math.cos(ph) * rr, dz: Math.sin(ph) * Math.sin(th) * rr, s: 0.75 + R() * 0.5, rot: R() * 6.28, spin: (R() - 0.5) * 0.25, ph: R() * 6.28 });
    }
    // uigennemsigtig kerne (skriver dybde) – samme farve som røgen
    const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(col[0] * 0.86, col[1] * 0.86, col[2] * 0.86), side: THREE.DoubleSide, fog: true }));
    core.renderOrder = 5; core.visible = false; scene.add(core);
    const S = { grow: 0, fade: 1, t: 0, x, y, z, R0: 3.3, H0: 2.6,
      set(grow, fade) { S.grow = grow; S.fade = fade; },
      draw(dt) {
        S.t += dt;
        const g = smooth(S.grow), f = S.fade, Rh = 0.5 + S.R0 * g, Hh = 0.4 + S.H0 * g, cy = y + 0.2 + Hh * 0.5;
        for (const p of puffs) {
          const wob = Math.sin(S.t * 0.4 + p.ph) * 0.12;
          const sh = 0.84 + 0.2 * (p.dy * 0.5 + 0.5);                       // lysere top, mørkere bund (blødt volumen-indtryk)
          LSmoke.push(x + p.dx * Rh * (1.08 - 0.25 * Math.max(0, p.dy)) + wob, Math.max(y + 0.35, cy + p.dy * Hh * 0.62), z + p.dz * Rh * (1.08 - 0.25 * Math.max(0, p.dy)) - wob, (1.0 + 2.4 * g) * p.s * (0.75 + 0.25 * f), col[0] * sh, col[1] * sh, col[2] * sh, 0.94 * f, p.rot + S.t * p.spin);
        }
        const kc = g > 0.55 ? smooth((g - 0.55) / 0.3) * clamp((f - 0.15) / 0.5, 0, 1) : 0;
        core.visible = kc > 0.02;
        if (core.visible) { core.position.set(x, cy, z); core.scale.set(Rh * 0.6 * kc, Hh * 0.52 * kc, Rh * 0.6 * kc); }   // skjult inde i puf-skallen
      },
      remove() { scene.remove(core); core.material.dispose(); systems.delete(S); }
    };
    systems.add(S);
    return S;
  }

  /* ---------------- ILD ---------------- */
  function fire(x, y, z, type) {
    const W = o.getW(), zone = WD.fireZone(W, x, y, z), N = zone.rad.length, R = rnd((x * 977 + z * 313) | 0);
    // glødende gulvflade (trekant-vifte ud til polygonens hjørner) + forkullet plet
    const pos = [], col = [], sc = [];
    for (let i = 0; i < N; i++) {
      const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2, r0 = zone.rad[i], r1 = zone.rad[(i + 1) % N];
      pos.push(0, 0, 0, Math.cos(a1) * r1, 0, Math.sin(a1) * r1, Math.cos(a0) * r0, 0, Math.sin(a0) * r0);
      col.push(1, 1, 1, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15);
      sc.push(0, 0, 0, Math.cos(a1) * (r1 + 0.25), 0, Math.sin(a1) * (r1 + 0.25), Math.cos(a0) * (r0 + 0.25), 0, Math.sin(a0) * (r0 + 0.25));
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.0, 0.42, 0.12).multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const glow = new THREE.Mesh(gg, glowMat); glow.position.set(x, y + 0.03, z); glow.renderOrder = 8; scene.add(glow);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sc, 3));
    const scorch = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0x0a0806, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    scorch.position.set(x, y + 0.02, z); scorch.renderOrder = 7; scene.add(scorch);
    const sample = () => { const a = R() * Math.PI * 2, r = Math.sqrt(R()) * WD.fireRadiusAt(zone, a) * 0.95; return [x + Math.cos(a) * r, z + Math.sin(a) * r]; };
    const flames = [], smokeP = [], embers = [];
    const L = takeLight(true), snd = o.audio ? o.audio.fireLoop({ x, y: y + 0.5, z }) : null;
    const inc = type === 'incgren';
    const S = { t: 0, life: 1, zone, dying: false,
      set(leftMs) { S.life = clamp(leftMs / 900, 0, 1); },
      draw(dt) {
        S.t += dt;
        const k = S.life, area = zone.rad.reduce((s, r) => s + r * r, 0) / N;
        // nye partikler (rate ∝ areal og resterende liv)
        let nf = dt * (28 + area * 5.5) * k; while (nf > 0) { if (nf < 1 && R() > nf) break; nf--; const [px, pz] = sample(); flames.push({ x: px, z: pz, y: y, t: 0, life: 0.45 + R() * 0.55, s: 0.45 + R() * 0.55, vy: 1.1 + R() * 1.3, rot: (R() - 0.5) * 0.5, dx: (R() - 0.5) * 0.3 }); }
        let ns = dt * (3 + area * 0.5) * k; while (ns > 0) { if (ns < 1 && R() > ns) break; ns--; const [px, pz] = sample(); smokeP.push({ x: px, z: pz, y: y + 0.9, t: 0, life: 2.2 + R() * 1.2, s: 0.8 + R() * 0.6, rot: R() * 6, vx: (R() - 0.5) * 0.3, vz: (R() - 0.5) * 0.3 }); }
        let ne = dt * 14 * k; while (ne > 0) { if (ne < 1 && R() > ne) break; ne--; const [px, pz] = sample(); embers.push({ x: px, z: pz, y: y + 0.2, t: 0, life: 0.6 + R() * 0.9, vx: (R() - 0.5) * 1.2, vy: 1.8 + R() * 2.5, vz: (R() - 0.5) * 1.2 }); }
        for (let i = flames.length - 1; i >= 0; i--) {
          const p = flames[i]; p.t += dt; const a = p.t / p.life; if (a >= 1) { flames.splice(i, 1); continue; }
          p.y += p.vy * dt; p.x += p.dx * dt;
          const sz = p.s * (0.7 + Math.sin(a * Math.PI) * 1.0), hot = 1 - a;
          // gul kerne → orange → mørkerød; kun de varmeste/overlappende dele overstiger 1 (=> subtil bloom). Brandgranat lidt mere gul.
          LFire.push(p.x, p.y + sz * 0.38, p.z, sz, 1.05 + hot * 0.75, (0.26 + hot * 0.5) * (inc ? 1.2 : 1), 0.04 + hot * 0.1, Math.sin(a * Math.PI) * 0.62, p.rot);
        }
        o.probe(x, y + 1, z, _pr); const sl = 0.12 + 0.3 * _pr[3];
        for (let i = smokeP.length - 1; i >= 0; i--) {
          const p = smokeP[i]; p.t += dt; const a = p.t / p.life; if (a >= 1) { smokeP.splice(i, 1); continue; }
          p.y += (0.9 - a * 0.4) * dt; p.x += p.vx * dt; p.z += p.vz * dt;
          LSmoke.push(p.x, p.y, p.z, p.s * (1 + a * 2.2), sl, sl * 0.95, sl * 0.9, 0.42 * Math.sin(a * Math.PI), p.rot + a);
        }
        for (let i = embers.length - 1; i >= 0; i--) {
          const p = embers[i]; p.t += dt; const a = p.t / p.life; if (a >= 1) { embers.splice(i, 1); continue; }
          p.vy -= 2.5 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          LDot.push(p.x, p.y, p.z, 0.06, 4, 1.6, 0.4, 1 - a, 0);
        }
        glowMat.opacity = 0.75 * k + Math.sin(S.t * 13) * 0.05;
        if (L) { L.light.position.set(x, y + 0.9, z); L.light.color.setRGB(1, 0.5, 0.18); L.light.distance = 11; L.light.intensity = (34 + Math.sin(S.t * 17) * 5 + Math.sin(S.t * 6.3) * 4) * k; }
      },
      remove() { scene.remove(glow); scene.remove(scorch); gg.dispose(); sg.dispose(); glowMat.dispose(); scorch.material.dispose(); freeLight(L); if (snd) snd.stop(); systems.delete(S); }
    };
    systems.add(S);
    return S;
  }

  /* ---------------- flashbang-glimt + flammer i luften (molotov) ---------------- */
  const pops = [];
  function flashPop(x, y, z) { pops.push({ x, y, z, t: 0 }); }
  const trail = [];
  function trailFlame(x, y, z) { trail.push({ x, y, z, t: 0, life: 0.25, rot: Math.random() * 6 }); if (trail.length > 120) trail.shift(); }

  /* ---------------- v12: kugle-nedslag: gnister (metal/sten) + støvpust i overfladens retning, belyst af banens prober ---------------- */
  const imps = [];
  function impact(x, y, z, nx, ny, nz, metal) {
    const pr = o.probe(x + nx * 0.2, y + ny * 0.2, z + nz * 0.2, _pr), lr = 0.35 + pr[0] * 0.9, lg = 0.33 + pr[1] * 0.9, lb = 0.3 + pr[2] * 0.9;
    const n = metal ? 9 : 5;
    for (let i = 0; i < n; i++) {
      const sp = 2.5 + Math.random() * (metal ? 6 : 3.5), rx = (Math.random() - 0.5) * 1.4, ry = Math.random() * 0.9, rz = (Math.random() - 0.5) * 1.4;
      imps.push({ k: 0, x, y, z, vx: (nx + rx) * sp, vy: (ny + ry) * sp, vz: (nz + rz) * sp, t: 0, life: 0.18 + Math.random() * 0.22 });
    }
    for (let i = 0; i < 3; i++) imps.push({ k: 1, x: x + nx * 0.05, y: y + ny * 0.05, z: z + nz * 0.05, vx: (nx + (Math.random() - 0.5) * 0.6) * (0.5 + i * 0.35), vy: (ny + 0.25) * (0.5 + i * 0.3), vz: (nz + (Math.random() - 0.5) * 0.6) * (0.5 + i * 0.35), t: 0, life: 0.55 + Math.random() * 0.35, r: lr, g: lg, b: lb, rot: Math.random() * 6 });
    if (imps.length > 360) imps.splice(0, imps.length - 360);
  }
  function stepImpacts(dt) {
    for (let i = imps.length - 1; i >= 0; i--) {
      const p = imps[i]; p.t += dt; if (p.t > p.life) { imps.splice(i, 1); continue; }
      const a = p.t / p.life;
      if (p.k === 0) { p.vy -= 9.8 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; LDot.push(p.x, p.y, p.z, 0.035 * (1 - a * 0.6), 6, 3.6, 1.4, 1 - a, 0); }
      else { const d = Math.exp(-4 * dt); p.vx *= d; p.vy *= d; p.vz *= d; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; LSmoke.push(p.x, p.y, p.z, 0.16 + a * 0.55, p.r, p.g, p.b, 0.55 * (1 - a) * (1 - a), p.rot + a); }
    }
  }

  function update(dt, cam) {
    LSmoke.begin(); LFire.begin(); LDot.begin(); LGlow.begin();
    for (const s of systems) s.draw(dt);
    stepImpacts(dt);
    for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.t += dt; if (p.t > 0.35) { pops.splice(i, 1); continue; } const k = 1 - p.t / 0.35; LGlow.push(p.x, p.y, p.z, 2.5 + p.t * 18, 8 * k, 8 * k, 8 * k, k, 0); }
    for (let i = trail.length - 1; i >= 0; i--) { const p = trail[i]; p.t += dt; if (p.t > p.life) { trail.splice(i, 1); continue; } const a = p.t / p.life; LFire.push(p.x, p.y + a * 0.12, p.z, 0.2 * (1 - a * 0.5), 1.6, 0.6, 0.12, 0.8 * (1 - a), p.rot); }
    LSmoke.end(cam); LFire.end(cam); LDot.end(cam); LGlow.end(cam);
  }
  function clear() { for (const s of [...systems]) s.remove(); pops.length = 0; trail.length = 0; imps.length = 0; }
  return { smoke, fire, flashPop, trailFlame, impact, update, clear };
}
