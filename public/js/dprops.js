// ==========================================================================
// DPROPS (v26.12): FYSISKE OG DESTRUERBARE PROPS
//   Små genstande (krukker, kurve, spande, kasser, kopper, papir, tastaturer, bærbare, kontorstole, ildslukkere) bages ikke ind i banen –
//   de udgives som <bane>/dprops.json og bygges her som egne objekter med bagt lys fra banens prober.
//   Serveren afgør hvad der rammes (skud, HE) og sender hændelser { a: 'b' knus | 'k' væltes/flyver | 's' gnister }.
//   • knus: skår i modellens farver (rigtig tyngdekraft/sammenstød/hvile), jord/væske-plet, lyd pr. materiale
//   • væltes: stift legeme med impuls og drejning (kant-/hjørnekontakt vælter, glider, falder til ro), lyd + evt. gas (ildslukker)
//   • gnister: servere, skærme, kameraer, elskabe m.m. sprøjter gnister, lyser og ryger i nogle sekunder (forbliver på plads)
//   • lamper: skydes løs og svinger i kabel med bevægeligt lys, flimmer og slukker
// ==========================================================================
import { loadGLTF } from '/js/models.js';

// pr. model: palet til skår, lyd, særlige effekter
const CT = {
  planter_pot_clay: { pal: [0x9c5a3b, 0x7a4630, 0xb06b45], snd: 'smash_ceramic', soil: 1, n: 18 },
  ceramic_pot: { pal: [0xe9e2d4, 0xd6cdbb, 0x7e98ad], snd: 'smash_ceramic', soil: 1, n: 16 },
  wicker_basket_01: { pal: [0xb08a52, 0x8a6a3a], snd: 'smash_wood' },
  wooden_bucket_01: { pal: [0x8a6a45, 0x6d5234], snd: 'smash_wood' },
  wooden_crate_01: { pal: [0x9a7a50, 0x7a5c38], snd: 'smash_wood', heavy: 1 },
  wooden_crate_02: { pal: [0x9a7a50, 0x7a5c38], snd: 'smash_wood', heavy: 1 },
  korean_fire_extinguisher_01: { pal: [0xb3231c], snd: 'smash_metal', gas: 1 },
  coffee_cup: { pal: [0xf0f0ee, 0x3a6ea5], snd: 'smash_ceramic', fluid: 0x2c1a10, n: 9 },
  paper_stack: { pal: [0xf2f0e8, 0xe4e2d6], snd: 'smash_paper', paper: 1, n: 14 },
  keyboard_mouse: { pal: [0x26282c, 0xb9bcc2], snd: 'smash_wood' },
  classic_laptop: { pal: [0x3a3d42, 0x8a8e96], snd: 'smash_wood', spark: 1 },
  office_chair: { pal: [0x26282c], snd: 'smash_metal' }
};
const SPARK_SECS = 5.5;

export function createDProps(o) {
  const { THREE, WD, scene } = o;
  const items = new Map(), stats = new Map(), sparks = [], bodies = new Set(), models = new Map(), lamps = [];
  let loadedFor = '', gen = 0;
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _m4 = new THREE.Matrix4(), _e = new THREE.Euler(), _bk = [0, 0, 0, 1];
  const W = () => o.getW(), V = () => o.getV();
  const ground = (x, z, y) => { const g = WD.groundAt(W(), x, z, y + 0.4, 1.6); return g === -Infinity ? null : g; };

  /* ---------------- modeller ---------------- */
  async function getModel(name, custom) {
    if (!models.has(name)) models.set(name, loadGLTF(THREE, custom ? '/assets/models/custom/' + name + '.glb' : '/assets/models/' + name + '/' + name + '.gltf', o.maxAniso || 4).catch(e => { console.warn('[dprops] model', name, e); return null; }));
    return models.get(name);
  }
  function matFor(p) {
    const s = p.mat, m = V().dynMat({
      map: s.map || undefined, normalMap: s.normal || undefined, roughnessMap: s.orm || undefined, metalnessMap: s.orm || undefined, aoMap: s.ao || undefined,
      color: new THREE.Color(s.color[0], s.color[1], s.color[2]), roughness: s.rough, metalness: s.metal, side: s.double ? THREE.DoubleSide : THREE.FrontSide, alphaTest: s.alpha === 'MASK' ? s.cutoff : 0
    });
    if (s.alpha === 'BLEND') { m.transparent = true; m.depthWrite = false; }
    return m;
  }
  function setBake(it, x, y, z) {
    const v = V(); if (!v) return; v.probe(x === undefined ? it.px : x, (y === undefined ? it.py : y) + 0.3, z === undefined ? it.pz : z, _bk);
    for (const m of it.mats) m.userData.uBake.value.set(_bk[0], _bk[1], _bk[2], Math.max(0.12, _bk[3]));
  }

  async function load(mapId) {
    clear(); const my = ++gen; loadedFor = mapId;
    let list = null;
    try { const r = await fetch('/assets/' + mapId + '/dprops.json', { cache: 'no-cache' }); if (r.ok) list = await r.json(); } catch (e) {}
    if (!list || my !== gen) return;
    list.forEach((e, i) => { if (e.st) { const c = e.c; stats.set(i, { x: c[0], y: c[1], z: c[2], hy: c[4] / 2 }); } });
    const need = [...new Set(list.filter(e => !e.st && CT[e.m]).map(e => e.m + '|' + (e.c ? 1 : 0)))];
    await Promise.all(need.map(k => getModel(k.split('|')[0], k.endsWith('|1'))));
    if (my !== gen || !V()) return;
    for (let i = 0; i < list.length; i++) {
      const e = list[i]; if (e.st || !CT[e.m]) continue;
      const M = await getModel(e.m, !!e.c); if (!M) continue;
      const s = e.s || 1, g = new THREE.Group(), mats = [];
      for (const p of M.all) { const mt = matFor(p); mats.push(mt); const me = new THREE.Mesh(p.geo, mt); me.castShadow = true; me.receiveShadow = true; g.add(me); }
      const bx = M.box, ext = [(bx.max.x - bx.min.x) * s, (bx.max.y - bx.min.y) * s, (bx.max.z - bx.min.z) * s];
      const cOff = new THREE.Vector3((bx.min.x + bx.max.x) / 2 * s, (bx.min.y + bx.max.y) / 2 * s, (bx.min.z + bx.max.z) / 2 * s);     // modellens midte i lokalt rum
      const y0 = e.c ? e.p[1] : e.p[1] - bx.min.y * s;
      g.scale.setScalar(s); g.position.set(e.p[0], y0, e.p[2]); const yaw = THREE.MathUtils.degToRad(e.yaw); g.rotation.y = yaw;
      scene.add(g);
      const it = { i, m: e.m, g, mats, px: e.p[0], py: y0, pz: e.p[2], yaw, s, ext, cOff, state: 0, body: null };
      it.q0 = g.quaternion.clone(); items.set(i, it); setBake(it);
    }
  }
  function clear() {
    for (const it of items.values()) { scene.remove(it.g); for (const m of it.mats) m.dispose(); }
    items.clear(); stats.clear(); sparks.length = 0; bodies.clear();
    for (const l of lamps) l.kill(true); lamps.length = 0; gen++;
  }
  function reset() {                                                    // ny runde: alt står som i starten igen
    for (const it of items.values()) {
      it.state = 0; it.body = null; it.g.visible = true; it.g.position.set(it.px, it.py, it.pz); it.g.quaternion.copy(it.q0); it.g.scale.setScalar(it.s);
    }
    bodies.clear(); sparks.length = 0; for (const l of lamps) l.kill(true); lamps.length = 0;
    clearDebris(); clearPools();
  }

  /* ---------------- skår / debris ---------------- */
  const MAXD = 520, deb = { mesh: null, p: [], n: 0, head: 0 };
  function ensureDebris() {
    if (deb.mesh) return;
    deb.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.02, color: 0x666666 }), MAXD);
    deb.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); deb.mesh.frustumCulled = false; deb.mesh.castShadow = true; deb.mesh.receiveShadow = true; deb.mesh.count = 0;
    deb.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXD * 3), 3); scene.add(deb.mesh);
  }
  function clearDebris() { deb.p.length = 0; deb.n = 0; deb.head = 0; if (deb.mesh) deb.mesh.count = 0; }
  const poolsMade = [];
  function clearPools() { poolsMade.length = 0; }
  const _c = new THREE.Color();
  function addDebris(x, y, z, vx, vy, vz, sx, sy, sz, col) {
    ensureDebris();
    const d = { x, y, z, vx, vy, vz, rx: Math.random() * 6, ry: Math.random() * 6, rz: Math.random() * 6, wx: (Math.random() - 0.5) * 18, wy: (Math.random() - 0.5) * 18, wz: (Math.random() - 0.5) * 18, sx, sy, sz, rest: false };
    const slot = deb.p.length < MAXD ? deb.p.length : (deb.head = (deb.head + 1) % MAXD);
    deb.p[slot] = d; deb.n = Math.min(MAXD, deb.n + 1); deb.mesh.count = deb.p.length;
    _c.setHex(col); deb.mesh.setColorAt(slot, _c); deb.mesh.instanceColor.needsUpdate = true;
    d.slot = slot; return d;
  }
  function stepDebris(dt) {
    if (!deb.mesh || !deb.p.length) return;
    let dirty = false; const w = W();
    for (let k = 0; k < deb.p.length; k++) {
      const d = deb.p[k]; if (!d || d.rest) continue;
      d.vy -= 9.8 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.rx += d.wx * dt; d.ry += d.wy * dt; d.rz += d.wz * dt;
      const g = ground(d.x, d.z, d.y), hs = d.sy * 0.5;
      if (g !== null && d.y - hs <= g) {
        d.y = g + hs; if (d.vy < -0.5) d.vy *= -0.32; else d.vy = 0; const f = Math.exp(-6 * dt); d.vx *= f; d.vz *= f; d.wx *= 0.5; d.wy *= 0.5; d.wz *= 0.5;
        if (Math.hypot(d.vx, d.vz) < 0.15 && Math.abs(d.vy) < 0.2) { d.rest = true; d.rx = Math.round(d.rx / 1.5708) * 1.5708 * 0.2; d.rz = Math.round(d.rz / 1.5708) * 1.5708 * 0.2; }
      }
      _e.set(d.rx, d.ry, d.rz); _q.setFromEuler(_e); _m4.compose(_v.set(d.x, d.y, d.z), _q, _v2.set(d.sx, d.sy, d.sz)); deb.mesh.setMatrixAt(d.slot, _m4); dirty = true;
    }
    if (dirty) deb.mesh.instanceMatrix.needsUpdate = true;
  }

  /* ---------------- stive legemer ---------------- */
  function startBody(it, dx, dz, power, hy) {
    const w = W(), c = it.cOff.clone().applyQuaternion(it.q0).add(_v.set(it.px, it.py, it.pz));     // midte i verdensrum
    const hx = it.ext[0] / 2, hyy = it.ext[1] / 2, hz = it.ext[2] / 2;
    const heavy = (CT[it.m] || {}).heavy ? 0.45 : 1;
    const sp = (2.6 + power * 3.8) * heavy;
    const b = it.body = {
      p: c.clone(), q: it.g.quaternion.clone(), v: new THREE.Vector3(dx * sp, 1.8 + Math.random() * 1.4 * heavy, dz * sp), w: new THREE.Vector3((Math.random() - 0.5) * 9 + dz * 5, (Math.random() - 0.5) * 7, (Math.random() - 0.5) * 9 - dx * 5),
      half: [hx, hyy, hz], inv: 1 / ((hx * hx + hyy * hyy + hz * hz) / 3 + 1e-4), cOff: it.cOff.clone(), sleep: 0, t: 0, it, hits: 0
    };
    bodies.add(b);
  }
  const _R = new THREE.Matrix3(), _r = new THREE.Vector3(), _n = new THREE.Vector3(0, 1, 0), _t1 = new THREE.Vector3();
  function stepBody(b, dt) {
    const w = W(); b.t += dt;
    b.v.y -= 9.8 * dt; if (WD.inWater && WD.inWater(w, b.p.x, b.p.y - b.half[1], b.p.z)) { b.v.multiplyScalar(Math.exp(-3 * dt)); b.w.multiplyScalar(Math.exp(-3 * dt)); }
    // vægge: midten må ikke ind i fast geometri
    const nx = b.p.x + b.v.x * dt, nz = b.p.z + b.v.z * dt, by = b.p.y - b.half[1];
    if (WD.isBlocked(w, nx, b.p.z, by + 0.1, 0.15, 0.05)) { b.v.x *= -0.35; } else b.p.x = nx;
    if (WD.isBlocked(w, b.p.x, nz, by + 0.1, 0.15, 0.05)) { b.v.z *= -0.35; } else b.p.z = nz;
    b.p.y += b.v.y * dt;
    // orientering
    const wl = b.w.length();
    if (wl > 1e-4) { _q2.setFromAxisAngle(_t1.copy(b.w).multiplyScalar(1 / wl), wl * dt); b.q.premultiply(_q2).normalize(); }
    // nederste hjørne
    _R.setFromMatrix4(_m4.makeRotationFromQuaternion(b.q)); const e = _R.elements;                 // kolonne-major: akse j = e[3j..3j+2]
    let low = 0, cx = 0, cy = 0, cz = 0;
    const H = b.half, sg = [0, 0, 0];
    for (let j = 0; j < 3; j++) { const up = e[3 * j + 1]; sg[j] = up > 0 ? -1 : 1; low += Math.abs(up) * H[j]; }
    const g = ground(b.p.x, b.p.z, b.p.y);
    const floor = g === null ? -50 : g;
    if (b.p.y - low < floor) {
      // kontaktpunkt = nederste hjørne
      _r.set(0, 0, 0); for (let j = 0; j < 3; j++) _r.x += e[3 * j] * sg[j] * H[j], _r.y += e[3 * j + 1] * sg[j] * H[j], _r.z += e[3 * j + 2] * sg[j] * H[j];
      b.p.y = floor + low;
      const vc = _t1.copy(b.w).cross(_r).add(b.v);                                                     // fart i kontaktpunktet
      if (vc.y < 0) {
        const e1 = Math.abs(vc.y) > 1.2 ? 0.3 : 0.05, rxn = _v.copy(_r).cross(_n), den = 1 + b.inv * rxn.lengthSq(), j = -(1 + e1) * vc.y / den;
        b.v.y += j; const dw = rxn.multiplyScalar(j * b.inv); b.w.add(dw);
        if (Math.abs(vc.y) > 0.9 && b.t - (b.lastHit || -1) > 0.12) { b.lastHit = b.t; b.hits++; o.onThud && o.onThud(b.p, b.it.m, Math.min(1, Math.abs(vc.y) / 5)); }
      }
      const f = Math.exp(-5.5 * dt); b.v.x *= f; b.v.z *= f; b.w.multiplyScalar(Math.exp(-3.2 * dt));
    }
    // hvile
    if (b.v.lengthSq() < 0.012 && b.w.lengthSq() < 0.5 && b.p.y - low <= floor + 0.02) { if ((b.sleep += dt) > 0.4) { b.sleeping = true; } } else b.sleep = 0;
    // grafik: gruppens placering = midte − (q · cOff)
    const it = b.it; it.g.quaternion.copy(b.q); _v.copy(b.cOff).applyQuaternion(b.q); it.g.position.copy(b.p).sub(_v);
    if ((it._bt = (it._bt || 0) + dt) > 0.25) { it._bt = 0; setBake(it, it.g.position.x, it.g.position.y, it.g.position.z); }
    if (b.t > 7) b.sleeping = true;
  }

  /* ---------------- hændelser ---------------- */
  function apply(m, silent) {
    const a = m.a;
    if (a === 's') { const st = stats.get(m.i); const pt = m.hp ? { x: m.hp[0], y: m.hp[1], z: m.hp[2] } : (st || null); if (pt && !silent) startSparks(pt, st && st.hy); return; }
    const it = items.get(m.i); if (!it || it.state) return; it.state = a === 'b' ? 2 : 1;
    const C = CT[it.m] || {}, dx = m.dx || 0, dz = m.dz || 0;
    if (a === 'b') {
      it.g.visible = false;
      if (silent) return;
      const c = _v.copy(it.cOff).applyQuaternion(it.q0).add(_v2.set(it.px, it.py, it.pz)).clone();
      const n = C.n || 14, pal = C.pal || [0x888888];
      for (let k = 0; k < n; k++) {
        const s = 0.025 + Math.random() * 0.06, sp = 1.2 + Math.random() * 3.2 * (m.v || 1);
        addDebris(c.x + (Math.random() - 0.5) * it.ext[0] * 0.8, c.y + (Math.random() - 0.3) * it.ext[1] * 0.6, c.z + (Math.random() - 0.5) * it.ext[2] * 0.8,
          dx * sp * 0.6 + (Math.random() - 0.5) * 3, 1 + Math.random() * 2.6, dz * sp * 0.6 + (Math.random() - 0.5) * 3, s * (0.6 + Math.random()), s * (0.3 + Math.random() * 0.8), s * (0.6 + Math.random()), pal[(Math.random() * pal.length) | 0]);
      }
      if (C.soil) for (let k = 0; k < 10; k++) addDebris(c.x + (Math.random() - 0.5) * 0.3, c.y + 0.1, c.z + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 2.4, 1 + Math.random() * 2, (Math.random() - 0.5) * 2.4, 0.03, 0.03, 0.03, 0x3b2a1c);
      const g = ground(c.x, c.z, c.y);
      if (g !== null && o.fxs) { if (C.soil) o.fxs.pool(c.x, g, c.z, 0.9, 0x3b2a1c, 0.9); if (C.fluid) o.fxs.pool(c.x, g, c.z, 0.45, C.fluid, 0.9); }
      if (o.fxs && C.soil) o.fxs.puff(c.x, c.y, c.z, 0, 0.5, 0, 0.35, 0.28, 0.2, 0.9);
      o.audio && o.audio.detail(C.snd || 'smash_ceramic', { x: c.x, y: c.y, z: c.z });
      return;
    }
    // væltes
    if (silent) { it.g.visible = true; return; }
    startBody(it, dx, dz, m.v || 1, m.hy || 0);
    const c = it.g.position; o.audio && o.audio.detail(C.snd || 'smash_wood', { x: c.x, y: c.y + 0.3, z: c.z });
    if (C.paper && o.fxs) for (let k = 0; k < (C.n || 12); k++) addDebris(it.px + (Math.random() - 0.5) * 0.2, it.py + 0.1, it.pz + (Math.random() - 0.5) * 0.2, dx * 2 + (Math.random() - 0.5) * 3, 1.2 + Math.random() * 2, dz * 2 + (Math.random() - 0.5) * 3, 0.2, 0.004, 0.28, 0xf2f0e8);
    if (C.gas && o.fxs) { it.gas = { t: 0, dir: [dx, dz] }; }
    if (C.spark) startSparks({ x: it.px, y: it.py + 0.1, z: it.pz }, 0.1, 3.2);
  }
  function startSparks(pt, hy, secs) { sparks.push({ x: pt.x, y: pt.y, z: pt.z, t: 0, dur: secs || SPARK_SECS, next: 0, smokeT: 0 }); if (sparks.length > 12) sparks.shift(); o.audio && o.audio.detail('spark', pt); }
  function applyState(dpb, lampb) { for (const [i, a] of dpb || []) apply({ i, a }, true); }

  /* ---------------- lamper (pendul) ---------------- */
  const LCOL = [0xffe9c8, 0xdfeaff, 0xf0f4ff, 0xfff0d8, 0xff3020];
  function lamp(m, restore) {
    let L = o.lightPool.find(x => !lamps.some(q => q.light === x));
    if (!L) { const old = lamps.find(q => q.light); if (old) { L = old.light; old.light = null; } }
    const grp = new THREE.Group(), cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 5), new THREE.MeshBasicMaterial({ color: 0x151515 }));
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.12, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.6, metalness: 0.5, side: THREE.DoubleSide }));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    bulb.material.color.setHex(LCOL[m.q] || 0xfff0d8).multiplyScalar(4);
    shade.position.y = 0.04; grp.add(shade, bulb); scene.add(cord); scene.add(grp);
    const Ln = 0.55 + Math.random() * 0.35, ay = m.y, dirx = m.dx || 0, dirz = m.dz || 0, p = { ax: 0, az: 0, vx: dirz * 3.2 + (Math.random() - 0.5) * 0.8, vz: -dirx * 3.2 + (Math.random() - 0.5) * 0.8 };
    p.vx = (m.dz || 0) * -3.0 + (Math.random() - 0.5) * 0.8; p.vz = (m.dx || 0) * 3.0 + (Math.random() - 0.5) * 0.8;                                   // retning: skudretningen skubber lampen væk
    const l = { x: m.x, y: ay, z: m.z, t: 0, L: Ln, p, grp, cord, bulb, shade, light: L, col: LCOL[m.q] || 0xfff0d8, life: 16, dead: false,
      kill(now) { scene.remove(cord); scene.remove(grp); cord.geometry.dispose(); shade.geometry.dispose(); bulb.geometry.dispose(); if (this.light) this.light.intensity = 0; this.light = null; this.dead = true; } };
    if (L) { L.color.setHex(l.col); L.intensity = 0; }
    lamps.push(l);
    if (!restore) { o.fxs && o.fxs.impact(m.x, m.y - 0.05, m.z, 0, -1, 0, true); o.audio && o.audio.detail('spark', { x: m.x, y: m.y - 0.2, z: m.z }); o.audio && o.audio.glass({ x: m.x, y: m.y - 0.2, z: m.z }, 1); }
  }
  function stepLamp(l, dt) {
    l.t += dt; const p = l.p, g = 9.8 / l.L;
    p.vx += (-g * Math.sin(p.ax) - 0.55 * p.vx) * dt; p.vz += (-g * Math.sin(p.az) - 0.55 * p.vz) * dt; p.ax += p.vx * dt; p.az += p.vz * dt;
    const dx = Math.sin(p.ax), dz = Math.sin(p.az), dy = -Math.sqrt(Math.max(0.05, 1 - dx * dx - dz * dz));
    const bx = l.x + dx * l.L, by = l.y + dy * l.L, bz = l.z + dz * l.L;
    l.grp.position.set(bx, by, bz); l.grp.rotation.set(-p.az * 0.9, 0, p.ax * 0.9);
    l.cord.position.set((l.x + bx) / 2, (l.y + by) / 2, (l.z + bz) / 2); l.cord.scale.y = l.L; l.cord.quaternion.setFromUnitVectors(_v.set(0, 1, 0), _v2.set(bx - l.x, by - l.y, bz - l.z).normalize());
    const flick = l.t < 2.2 ? (Math.random() < 0.55 ? 1 : 0.1) : (l.t > l.life - 2.5 ? Math.random() * (l.life - l.t) / 2.5 : 1), k = l.t > l.life ? 0 : flick;
    if (l.light) { l.light.position.set(bx, by - 0.1, bz); l.light.intensity = 9 * k * Math.min(1, l.t * 3); l.light.distance = 13; }
    l.bulb.visible = k > 0.05; l.bulb.material.color.setHex(l.col).multiplyScalar(4 * Math.max(0.2, k));
    if (l.t < 2.2 && Math.random() < dt * 5 && o.fxs) o.fxs.impact(bx, by, bz, 0, -1, 0, true);
    if (l.t > l.life + 0.2 && l.light) { l.light.intensity = 0; l.light = null; }
  }

  /* ---------------- hovedløkke ---------------- */
  function update(dt) {
    dt = Math.min(dt, 0.05);
    for (const b of bodies) {
      if (b.sleeping) { bodies.delete(b); b.it.state = 3; continue; }
      stepBody(b, dt);
      const it = b.it;
      if (it.gas) { it.gas.t += dt; if (it.gas.t < 1.6 && o.fxs) { if (Math.random() < 0.8) o.fxs.puff(it.g.position.x, it.g.position.y + 0.3, it.g.position.z, it.gas.dir[0] * 1.6 + (Math.random() - 0.5), 0.3 + Math.random() * 0.6, it.gas.dir[1] * 1.6 + (Math.random() - 0.5), 0.95, 0.97, 1.0, 0.9); if (it.gas.t < dt * 1.5 && o.audio) o.audio.detail('hiss', { x: it.g.position.x, y: it.g.position.y, z: it.g.position.z }); } else it.gas = null; }
    }
    stepDebris(dt);
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]; s.t += dt; if (s.t > s.dur) { sparks.splice(i, 1); continue; }
      s.next -= dt; const fade = 1 - s.t / s.dur;
      if (s.next <= 0) {
        s.next = 0.1 + Math.random() * 0.35 * (1.4 - fade); const nx = (Math.random() - 0.5) * 0.8, nz = (Math.random() - 0.5) * 0.8;
        o.fxs && o.fxs.impact(s.x, s.y, s.z, nx, 0.6, nz, true); o.pulse && o.pulse(s.x, s.y + 0.1, s.z, 4 + 5 * fade, 0xffa860, 0.06);
        if (Math.random() < 0.4) o.audio && o.audio.detail('spark', { x: s.x, y: s.y, z: s.z });
      }
      if ((s.smokeT -= dt) <= 0) { s.smokeT = 0.28; o.fxs && o.fxs.puff(s.x, s.y + 0.05, s.z, (Math.random() - 0.5) * 0.2, 0.55, (Math.random() - 0.5) * 0.2, 0.22, 0.22, 0.23, 1.5); }
    }
    for (let i = lamps.length - 1; i >= 0; i--) { const l = lamps[i]; if (l.dead) { lamps.splice(i, 1); continue; } stepLamp(l, dt); }
  }

  return { load, clear, reset, apply, applyState, lamp, update, get loaded() { return loadedFor; }, get count() { return items.size; }, items, debris: deb };
}
