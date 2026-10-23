// ==========================================================================
// v25: NAT OG REGN (de_ascension og senere nat-baner) – alt i få draw calls og uden at ændre banens bagte lys:
//   • regn: ~9000 strimer i en kasse om kameraet (positioner i vertex-shaderen, ingen CPU-arbejde). Et "tag-kort" (højeste
//     kollisionsflade pr. 0,5 m, fra banens colliders) skjuler regnen under tage og i gange – tørt indenfor, vådt udenfor.
//   • plask: små ringe på den øverste flade omkring spilleren (gulv i gården, tagsten på taget)
//   • lampernes glorier i den fugtige luft (lights.json fra Blender-bygningen) – stearinlys, olielamper og lanterner flimrer
//   • glans: en lille pulje rigtige punktlys flyttes til de nærmeste lamper → spejlinger i de våde sten
//   • lyn: månen blinker op i et par ryk (hårde skygger), himlen lyser – tordenen følger efter (afstand ~ forsinkelse)
//   • lyd: regn ude, dæmpet regn + tagrende inde (krydsfade efter tag-kortet)
// createNight({ THREE, WD, W, scene, Audio, sun, sky, lightsUrl, rain }) -> { update(dt, cam, t), dispose(), lightning() }
// ==========================================================================
export function createNight(o) {
  const { THREE, WD, W } = o;
  const group = new THREE.Group(); group.name = 'night'; o.scene.add(group);
  const timeU = { value: 0 }, camU = { value: new THREE.Vector3() }, flashU = { value: 0 };
  const R = Object.assign({ rate: 1.0, wind: [1.4, 0, 0.6], lightning: true }, o.rain || {});
  const DRY = !!(o.rain && o.rain.dry);                        // v26.13: tør nat (Niseko) – ingen regn, plask, torden eller regnlyd; kun lampeglorier

  // ---------------------------------------------------------------- tag-kort: højeste kollisionsflade pr. celle
  const b = W.bounds, CS = 0.5, NX = Math.ceil((b.x1 - b.x0) / CS) + 2, NZ = Math.ceil((b.z1 - b.z0) / CS) + 2, X0 = b.x0 - CS, Z0 = b.z0 - CS;
  const top = new Float32Array(NX * NZ).fill(-50);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = X0 + (i + 0.5) * CS, z = Z0 + (j + 0.5) * CS, cs = WD.query(W, x - 0.05, z - 0.05, x + 0.05, z + 0.05);
    let h = -50;
    for (const c of cs) if (c.k !== 'clip' && x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1 && c.y1 > h) h = c.y1;
    top[j * NX + i] = h;
  }
  const topTex = new THREE.DataTexture(top, NX, NZ, THREE.RedFormat, THREE.FloatType); topTex.needsUpdate = true;
  topTex.magFilter = THREE.NearestFilter; topTex.minFilter = THREE.NearestFilter;
  const mapU = { value: new THREE.Vector4(X0, Z0, NX * CS, NZ * CS) };
  const topAt = (x, z) => { const i = Math.floor((x - X0) / CS), j = Math.floor((z - Z0) / CS); return i < 0 || j < 0 || i >= NX || j >= NZ ? -50 : top[j * NX + i]; };
  const TOPFN = `
    uniform sampler2D topMap; uniform vec4 mapR;
    float roofAt( vec2 xz ) { vec2 uv = ( xz - mapR.xy ) / mapR.zw; if ( any( lessThan( uv, vec2( 0.0 ) ) ) || any( greaterThan( uv, vec2( 1.0 ) ) ) ) return -50.0; return texture2D( topMap, uv ).r; }`;

  // ---------------------------------------------------------------- regnstrimer
  const N = Math.round(9000 * R.rate), BOX = new THREE.Vector3(34, 20, 34);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
  const off = new Float32Array(N * 4); for (let k = 0; k < N * 4; k++) off[k] = Math.random();
  g.setAttribute('off', new THREE.InstancedBufferAttribute(off, 4)); g.instanceCount = N;
  const rainM = new THREE.ShaderMaterial({
    uniforms: { uT: timeU, uCam: camU, uBox: { value: BOX }, uWind: { value: new THREE.Vector3(...R.wind) }, topMap: { value: topTex }, mapR: mapU, uFlash: flashU },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
    vertexShader: `
      attribute vec4 off; uniform float uT, uFlash; uniform vec3 uCam, uBox, uWind; varying float vA; varying vec2 vUv;` + TOPFN + `
      void main() {
        float speed = 9.0 + off.w * 4.0;
        vec3 p = off.xyz * uBox; p.y -= uT * speed; p.xz += uWind.xz * uT * ( 0.85 + 0.3 * off.w );
        p = mod( p - uCam + uBox * 0.5, uBox ) + uCam - uBox * 0.5;
        vec3 dir = normalize( vec3( uWind.x, -speed, uWind.z ) );
        float len = 0.55 + off.w * 0.35;
        vec3 view = normalize( p - cameraPosition ), side = normalize( cross( dir, view ) );
        vec3 wp = p + side * position.x * 0.016 + dir * position.y * len;
        float roof = roofAt( p.xz );
        float d = length( p.xz - uCam.xz );
        vA = ( p.y > roof + 0.05 ? 1.0 : 0.0 ) * smoothstep( 17.0, 9.0, d ) * smoothstep( 0.6, 2.0, length( p - cameraPosition ) );
        vA *= 0.32 + uFlash * 1.2;
        vUv = position.xy + vec2( 0.5, 0.0 );
        gl_Position = projectionMatrix * viewMatrix * vec4( wp, 1.0 );
      }`,
    fragmentShader: `
      varying float vA; varying vec2 vUv;
      void main() { float e = 1.0 - abs( vUv.x * 2.0 - 1.0 ); float t = smoothstep( 0.0, 0.3, vUv.y ) * smoothstep( 1.0, 0.6, vUv.y );
        float a = vA * e * t; if ( a < 0.003 ) discard; gl_FragColor = vec4( vec3( 0.62, 0.68, 0.78 ) * a, a ); }`
  });
  const rain = new THREE.Mesh(g, rainM); rain.frustumCulled = false; rain.renderOrder = 5; rain.visible = !DRY; group.add(rain);

  // ---------------------------------------------------------------- plask (ringe på den øverste flade)
  const NS = 900, gs = new THREE.InstancedBufferGeometry();
  gs.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1], 3)); gs.setIndex([0, 2, 1, 0, 3, 2]);
  const so = new Float32Array(NS * 2); for (let k = 0; k < NS * 2; k++) so[k] = Math.random();
  gs.setAttribute('seed', new THREE.InstancedBufferAttribute(so, 2)); gs.instanceCount = NS;
  const splM = new THREE.ShaderMaterial({
    uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), { uT: timeU, uCam: camU, topMap: { value: topTex }, mapR: mapU }),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true, side: THREE.DoubleSide,
    vertexShader: `
      attribute vec2 seed; uniform float uT; uniform vec3 uCam; varying vec2 vP; varying float vA;` + TOPFN + `
      float h1( float n ) { return fract( sin( n ) * 43758.5453 ); }
      #include <fog_pars_vertex>
      void main() {
        float rate = 2.2 + seed.y * 1.6, cyc = uT * rate + seed.x * 17.0, k = floor( cyc ), ph = fract( cyc );
        float a = h1( k * 12.9898 + seed.x * 78.233 ) * 6.2831, r = sqrt( h1( k * 4.1414 + seed.y * 31.7 ) ) * 13.0;
        vec2 xz = uCam.xz + vec2( cos( a ), sin( a ) ) * r;
        float y = roofAt( xz ) + 0.02;
        float s = 0.03 + ph * 0.13;
        vP = position.xz; vA = ( 1.0 - ph ) * ( y > -40.0 && y < uCam.y + 6.0 ? 1.0 : 0.0 );
        vec4 mvPosition = viewMatrix * vec4( xz.x + position.x * s, y, xz.y + position.z * s, 1.0 );
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      varying vec2 vP; varying float vA;
      #include <fog_pars_fragment>
      void main() { float d = length( vP ); float ring = smoothstep( 0.62, 0.86, d ) * smoothstep( 1.0, 0.88, d ); float a = ring * vA * 0.32;
        if ( a < 0.004 ) discard; gl_FragColor = vec4( vec3( 0.55, 0.6, 0.68 ) * a, a );
        #include <fog_fragment>
      }`
  });
  const spl = new THREE.Mesh(gs, splM); spl.frustumCulled = false; spl.visible = !DRY; group.add(spl);

  // ---------------------------------------------------------------- lamper: glorier + glans-pulje
  const lamps = [];
  const glow = { pts: null };
  const POOL = 6, pool = [];
  for (let k = 0; k < POOL; k++) { const L = new THREE.PointLight(0xffa060, 0, 7, 2); L.castShadow = false; L.userData.base = 0; group.add(L); pool.push(L); }
  fetch(o.lightsUrl, { cache: 'no-cache' }).then(r => r.ok ? r.json() : { lights: [] }).then(J => {
    for (const l of J.lights || []) lamps.push(l);
    const n = lamps.length; if (!n) return;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), prm = new Float32Array(n * 2);
    const SZ = { lantern: 1.1, chandelier: 1.6, oil: 0.75, candle: 0.32, work: 1.3, sconce: 0.9, searchlight: 2.2, belfry: 3.5, uplight: 0.0, window: 0.0 };
    const FL = { candle: 1.0, oil: 0.55, lantern: 0.35, chandelier: 0.3, belfry: 0.4 };
    lamps.forEach((l, k) => { pos[k * 3] = l.x; pos[k * 3 + 1] = l.y; pos[k * 3 + 2] = l.z; col.set(l.col, k * 3); prm[k * 2] = SZ[l.kind] !== undefined ? SZ[l.kind] : 0.8; prm[k * 2 + 1] = FL[l.kind] || 0; });
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gg.setAttribute('color', new THREE.BufferAttribute(col, 3)); gg.setAttribute('prm', new THREE.BufferAttribute(prm, 2));
    const gm = new THREE.ShaderMaterial({
      uniforms: { uT: timeU, uScale: { value: 900 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: `attribute vec3 color; attribute vec2 prm; uniform float uT, uScale; varying vec3 vC; varying float vF;
        void main() { vec4 mv = modelViewMatrix * vec4( position, 1.0 ); float fl = prm.y;
          float f = 1.0 - fl * ( 0.25 * sin( uT * 13.0 + position.x * 7.0 ) + 0.15 * sin( uT * 23.0 + position.z * 3.0 ) + 0.1 * sin( uT * 5.3 ) );
          vC = color * f; vF = smoothstep( 70.0, 20.0, -mv.z ); gl_PointSize = prm.x * uScale / max( 0.5, -mv.z ); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vF; void main() { vec2 p = gl_PointCoord * 2.0 - 1.0; float r = dot( p, p ); if ( r > 1.0 ) discard;
          float a = ( exp( -r * 5.0 ) * 0.55 + exp( -r * 26.0 ) * 0.9 ) * vF; gl_FragColor = vec4( vC * a, a ); }`
    });
    glow.pts = new THREE.Points(gg, gm); glow.pts.frustumCulled = false; glow.pts.renderOrder = 4; group.add(glow.pts);
  }).catch(() => {});
  let poolT = 0;
  function updatePool(cam) {
    const near = lamps.filter(l => l.kind !== 'window' && l.kind !== 'uplight').map(l => [l, (l.x - cam.x) ** 2 + (l.y - cam.y) ** 2 + (l.z - cam.z) ** 2]).sort((a, c) => a[1] - c[1]).slice(0, POOL);
    pool.forEach((L, k) => {
      const e = near[k]; if (!e) { L.intensity = 0; L.userData.base = 0; L.userData.fl = 0; return; }       // altid synlig: antal lys må ikke ændre sig (ellers genoversættes alle shadere)
      const l = e[0]; L.position.set(l.x, l.y, l.z); L.color.setRGB(l.col[0], l.col[1], l.col[2]);
      L.userData.base = Math.min(6, l.w / 16); L.userData.fl = { candle: 1, oil: 0.5, lantern: 0.3, chandelier: 0.25 }[l.kind] || 0; L.distance = l.kind === 'candle' ? 3.5 : 8;
    });
  }

  // ---------------------------------------------------------------- lyn og torden
  let nextBolt = 6 + Math.random() * 10, bolt = null, storm = false;
  const sunBase = o.sun ? o.sun.intensity : 0;
  function lightning() {
    const dist = 0.3 + Math.random() * 2.8;                                        // "afstand": kort = kraftigt blink og brag
    bolt = { t: 0, pulses: [0, 0.09 + Math.random() * 0.05, 0.22 + Math.random() * 0.1].slice(0, 2 + (Math.random() < 0.6 ? 1 : 0)), str: 1.4 / (0.6 + dist), dist };
    const snd = dist < 0.9 ? (Math.random() < 0.5 ? 'thunder1' : 'thunder2') : dist < 1.9 ? 'thunder3' : 'thunder4';
    setTimeout(() => o.Audio.cine && o.Audio.cine(snd, { vol: Math.min(0.16, 0.2 / (0.4 + dist)), music: false }), dist * 1100);   // v26.5: torden meget lavere (brugerønske)
  }

  // ---------------------------------------------------------------- lyd: regn ude / inde
  let rainOut = null, rainIn = null, gutter = null, inside = 0;
  function startAudio() {
    if (rainOut || !o.Audio.cine || DRY) return;
    rainOut = o.Audio.cine('rain', { loop: true, vol: 0.0001, fadeIn: 2 }); rainIn = o.Audio.cine('rain_in', { loop: true, vol: 0.0001 }); gutter = o.Audio.cine('gutter', { loop: true, vol: 0.0001 });
  }
  if (o.Audio.cinePreload) o.Audio.cinePreload().then(startAudio);

  // ---------------------------------------------------------------- pr. frame
  function update(dt, cam, t) {
    timeU.value = t; camU.value.copy(cam);
    if ((poolT -= dt) <= 0) { poolT = 0.25; updatePool(cam); }
    for (const L of pool) if (L.userData.base) { const f = L.userData.fl; L.intensity = L.userData.base * (1 - f * (0.25 * Math.sin(t * 13 + L.position.x * 7) + 0.15 * Math.sin(t * 23 + L.position.z * 3))); }
    // lyn
    if (R.lightning && !DRY) { nextBolt -= dt; if (nextBolt <= 0) { nextBolt = storm ? 6 + Math.random() * 9 : 35 + Math.random() * 40; lightning(); } }   // v26.6: skybrud – lyn langt oftere
    let fl = 0;
    if (bolt) {
      bolt.t += dt;
      for (const p0 of bolt.pulses) { const x = (bolt.t - p0) / 0.07; if (x > 0 && x < 2.5) fl = Math.max(fl, Math.exp(-x * 1.4) * (x < 0.3 ? x / 0.3 : 1)); }
      fl *= bolt.str; if (bolt.t > 0.6) bolt = null;
    }
    flashU.value = fl;
    if (o.sun) o.sun.intensity = sunBase + fl * 9.0;
    if (o.sky && o.sky.material && o.sky.material.uniforms && o.sky.material.uniforms.uExp) { const U = o.sky.material.uniforms.uExp; if (U.base === undefined) U.base = U.value; U.value = U.base * (1 + fl * 6); }
    // lyd efter tag-kortet: under tag → dæmpet regn + tagrende
    const roof = topAt(cam.x, cam.z) > cam.y + 0.2 ? 1 : 0;
    inside += (roof - inside) * Math.min(1, dt * 2.5);
    const sk = storm ? 1.8 : 1;
    if (rainOut) { rainOut.setVol(0.06 * sk * (1 - inside) + 0.0001, 0.3); rainIn.setVol(0.035 * sk * inside + 0.0001, 0.3); gutter.setVol(0.018 * sk * inside + 0.006, 0.3); }   // v26.5: regnen langt lavere – kun en stemning i baggrunden
  }
  function dispose() {
    o.scene.remove(group); topTex.dispose(); g.dispose(); gs.dispose(); rainM.dispose(); splM.dispose();
    if (glow.pts) { glow.pts.geometry.dispose(); glow.pts.material.dispose(); }
    for (const h of [rainOut, rainIn, gutter]) if (h) h.stop(1.0);
    if (o.sun) o.sun.intensity = sunBase;
  }
  return { setStorm: on => { storm = !!on; if (on) nextBolt = Math.min(nextBolt, 3); if (rainM && rainM.uniforms && rainM.uniforms.uRate) rainM.uniforms.uRate.value = on ? 2.2 : 1; }, group, rainM, update, dispose, lightning, topAt, get flash() { return flashU.value; } };
}
