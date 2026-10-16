// ==========================================================================
// White Dust · v26.3: RUNDESLUT-FILMEN – alle ser den, uanset hvordan runden ender (elimination, desarmering, udløbet tid)
//   En kort (≈ 4,8 s), filmisk sekvens i selve banen med rigtige positioner: helteskud af den der afgjorde runden, offeret / bomben /
//   sitet, og et kran-skud der trækker op og ud mens titlen slår ind. Bagefter følger MVP-filmen (app.js: HUD.roundEnd).
//   (Bomben der springer har sin egen film: bombcine.js.)
// createRoundCine({ THREE, WD, scene(), camera(), W(), chars(), Audio, $, onStart(), onEnd() }) -> { start(info), update(dt) -> bool, stop(), active }
//   info: { reason: 'elim'|'defuse'|'time', win, round, focus: {x,y,z,yaw,self,side,agent,alive,name}, victim?: {x,y,z,name,self,side,agent},
//           bomb?: {x,y,z}, site?: {x,y,z}, title, sub, kicker }
// ==========================================================================
export function createRoundCine(o) {
  const { THREE, WD } = o;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v, smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }, lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); };
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const T = 4.8;
  let S = null;

  /* ---------------- kamera-hjælpere ---------------- */
  function camSafe(target, want) {
    const W = o.W(), dx = want.x - target.x, dy = want.y - target.y, dz = want.z - target.z, dd = Math.hypot(dx, dy, dz);
    if (dd < 0.01) return want.clone();
    const hit = WD.raycastWorld(W, target.x, target.y, target.z, dx / dd, dy / dd, dz / dd, dd);
    const k = hit < dd ? Math.max(0.3, hit - 0.28) / dd : 1; return V3(target.x + dx * k, target.y + dy * k, target.z + dz * k);
  }
  function freeDirs(p, y, R) {                                        // 24 vandrette retninger, sorteret efter fri afstand
    const W = o.W(), out = [];
    for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a); out.push({ a, dx, dz, free: Math.min(R, WD.raycastWorld(W, p.x, y, p.z, dx, 0, dz, R)) }); }
    return out;
  }
  function bestNear(dirs, a0, minFree) {                              // den frieste retning tæt på vinklen a0
    let best = null, bs = -1e9;
    for (const d of dirs) { let da = Math.abs(((d.a - a0) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI); const s = Math.min(d.free, 6) - da * 1.4 - (d.free < minFree ? 8 : 0); if (s > bs) { bs = s; best = d; } }
    return best;
  }
  const dirA = a => V3(Math.sin(a), 0, Math.cos(a));

  /* ---------------- egen krop (man ser sig selv i filmen) ---------------- */
  function selfProxy(p) {
    const C = o.chars && o.chars(); if (!C || !C.buildHuman) return null;
    try {
      const h = C.buildHuman(p.side, p.agent || null); o.scene().add(h.group);
      const st = { x: p.x, y: p.y, z: p.z, yaw: p.yaw || 0, pitch: -0.12, ready: true, alive: p.alive !== false, crouch: false, act: false, grounded: true, reload: false, pin: false, wcode: p.wcode || 0 };
      for (let f = 0; f < 40; f++) C.animateHuman(h, 1 / 60, f / 60, st);
      return { h, st };
    } catch (e) { return null; }
  }

  /* ---------------- titel-lag (HTML) ---------------- */
  function overlay(info) {
    const el = o.$('rcOv'); if (!el) return null;
    const side = info.win === 'swat' ? 'swat' : 'hij';
    const letters = [...info.title].map((c, i) => c === ' ' ? '<span class="sp"> </span>' : `<span style="--i:${i}">${c}</span>`).join('');
    el.className = 'rc ' + side;
    el.innerHTML = `<div class="rc-flash"></div><div class="rc-vig"></div><div class="rc-grain"></div>
      <div class="rc-slash a"></div><div class="rc-slash b"></div>
      <div class="rc-tag"><b>${info.kicker || ''}</b></div>
      <div class="rc-t"><small>${info.team}</small><h1>${letters}</h1><p>${info.sub || ''}</p><i class="rc-line"></i></div>`;
    return el;
  }

  /* ---------------- kamera-rig: hvert skud vælger på forhånd den retning, hvor hele bevægelsen har fri sigtelinje ---------------- */
  const angd = (a, b) => Math.abs(((a - b) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
  function rig(tgt, prefer, sh) {
    const W = o.W(); let best = null;
    for (let k = 0; k < 32; k++) {
      const a = k / 32 * Math.PI * 2; let ratio = 1;
      for (const u of [0, 0.5, 1]) {
        const aa = a + lerp(sh.arc[0], sh.arc[1], u), r = Math.max(sh.r[0], sh.r[1]), hh = lerp(sh.h[0], sh.h[1], u);
        const dx = Math.sin(aa) * r, dz = Math.cos(aa) * r, len = Math.hypot(dx, hh, dz);
        const free = WD.raycastWorld(W, tgt.x, tgt.y, tgt.z, dx / len, hh / len, dz / len, len + 0.3);
        ratio = Math.min(ratio, clamp((free - 0.3) / len, 0, 1));
      }
      const sc = ratio * 10 - angd(a, prefer) * 1.1 + (ratio > 0.97 ? 3 : 0);
      if (!best || sc > best.sc) best = { sc, a, k: clamp(ratio, 0.4, 1) };
    }
    return Object.assign({}, sh, { tgt, a: best.a, scale: best.k });
  }
  function rigPose(R, k, lookTo) {
    const a = R.a + lerp(R.arc[0], R.arc[1], k), r = lerp(R.r[0], R.r[1], k) * R.scale, h = lerp(R.h[0], R.h[1], k);
    const look = lookTo ? V3(lerp(R.tgt.x, lookTo.x, R.drift * k), lerp(R.tgt.y, lookTo.y, R.drift * k), lerp(R.tgt.z, lookTo.z, R.drift * k)) : R.tgt;
    return { pos: V3(R.tgt.x + Math.sin(a) * r, R.tgt.y + h, R.tgt.z + Math.cos(a) * r), look, fov: lerp(R.fov[0], R.fov[1], k) };
  }

  /* ---------------- start ---------------- */
  function start(info) {
    if (S) stop(false);
    const F = info.focus; if (!F) return false;
    const P = V3(F.x, F.y, F.z), H = V3(F.x, F.y + 1.45, F.z);
    const faceA = Math.atan2(-Math.sin(F.yaw || 0), -Math.cos(F.yaw || 0));      // spillerens blikretning (vinkel i sin/cos-form)
    const V = info.victim ? V3(info.victim.x, info.victim.y, info.victim.z) : null;
    const B = info.bomb ? V3(info.bomb.x, info.bomb.y, info.bomb.z) : null;
    const aFront = V ? Math.atan2(V.x - P.x, V.z - P.z) : B ? Math.atan2(B.x - P.x, B.z - P.z) : faceA;
    const away = B ? Math.atan2(B.x - P.x, B.z - P.z) : aFront;               // fra helten forbi bomben
    const mid = V ? V3((P.x + V.x) / 2, (P.y + V.y) / 2 + 0.7, (P.z + V.z) / 2) : B ? V3((P.x + B.x) / 2, P.y + 0.7, (P.z + B.z) / 2) : V3(P.x, P.y + 1.1, P.z);
    const R = {};
    // A: helteskud – lavt, kredser og skubber ind (desarmering: makro på bomben med desarmøren knælende bag den)
    if (info.reason === 'defuse' && B) R.A = rig(V3(B.x, B.y + 0.08, B.z), away, { r: [1.0, 0.62], h: [0.24, 0.14], arc: [-0.4, 0.3], fov: [34, 26] });
    else R.A = rig(V3(H.x, H.y - 0.25, H.z), aFront + 0.6, { r: [1.9, 1.35], h: [-0.7, -0.4], arc: [-0.38, 0.32], fov: [36, 27] });
    // B: modtrækket
    if (info.reason === 'elim' && V) R.B = rig(V3(V.x, V.y + 0.3, V.z), Math.atan2(P.x - V.x, P.z - V.z) + 2.2, { r: [1.9, 1.6], h: [0.7, 0.35], arc: [0, 0.3], fov: [36, 30], drift: 0.22 });
    else if (info.reason === 'time' && info.site) R.B = rig(V3(info.site.x, info.site.y + 0.6, info.site.z), Math.atan2(P.x - info.site.x, P.z - info.site.z), { r: [8, 7.4], h: [2.6, 1.8], arc: [-0.25, 0.25], fov: [46, 44] });
    else if (info.reason === 'defuse' && B) R.B = rig(V3(H.x, H.y - 0.35, H.z), away, { r: [1.25 + Math.hypot(B.x - P.x, B.z - P.z), 1.1 + Math.hypot(B.x - P.x, B.z - P.z)], h: [-0.85, -0.6], arc: [0.35, 0.1], fov: [34, 29] });
    else R.B = rig(V3(H.x, H.y - 0.05, H.z), aFront - 0.9, { r: [1.7, 1.5], h: [-0.1, 0.0], arc: [0, 0.5], fov: [30, 27] });
    // C: kran – op og ud bag helten, mens titlen står
    R.C = rig(mid, aFront + Math.PI, { r: [1.5, 5.2], h: [0.4, 2.6], arc: [0, 0.25], fov: [42, 52] });
    const proxies = [];
    if (F.self) {
      const f2 = Object.assign({}, F); if (info.reason === 'defuse' && B) f2.yaw = Math.atan2(-(B.x - F.x), -(B.z - F.z));   // desarmøren vender mod bomben
      const pr = selfProxy(f2); if (pr) proxies.push(pr); }
    if (info.victim && info.victim.self) { const pr = selfProxy(Object.assign({}, info.victim, { alive: false })); if (pr) proxies.push(pr); }
    // lys på helten (natbanen er mørk): et blødt key-light der følger kameraet + et rim-light bagfra i holdfarven
    const sc = o.scene(), col = info.win === 'swat' ? 0x5c9dff : 0xff5040;
    const key = new THREE.PointLight(0xfff0e0, 0, 9, 1.6), rim = new THREE.PointLight(col, 0, 7, 1.8), led = new THREE.PointLight(0x30ff70, 0, 3, 2);
    sc.add(key); sc.add(rim); sc.add(led);
    S = { info, t: 0, P, head: H, V, B, R, mid, proxies, key, rim, led, fired: {}, ov: overlay(info), shake: 0 };
    o.onStart && o.onStart();
    return true;
  }

  /* ---------------- skuddene ---------------- */
  function shot(t) {
    const s = S;
    if (t < 1.75) return rigPose(s.R.A, smooth(t / 1.75) * 0.75 + t / 1.75 * 0.25);
    if (t < 3.05) return rigPose(s.R.B, ease((t - 1.75) / 1.3), s.R.B.drift ? s.P : null);
    return rigPose(s.R.C, ease((t - 3.05) / (T - 3.05)));
  }

  /* ---------------- hovedløkke ---------------- */
  function update(dt) {
    if (!S) return false;
    S.t += dt; const t = S.t, cam = o.camera(), A = o.Audio, i = S.info;
    const cue = (k, at, fn) => { if (!S.fired[k] && t >= at) { S.fired[k] = 1; try { fn(); } catch (e) {} } };
    cue('hit', 0.0, () => { A.cine && A.cine('hit', { vol: 0.7 }); A.cine && A.cine('slowmo', { vol: 0.45 }); });
    cue('whoosh', 1.65, () => A.cine && A.cine('whoosh', { vol: 0.55 }));
    cue('braam', 3.0, () => { A.cine && A.cine('braam', { vol: 0.85 }); S.shake = 0.6; if (S.ov) S.ov.classList.add('go'); });
    cue('ann', 3.25, () => A.announce && A.announce(i.win === 'swat' ? 'SWAT win' : 'Hijackers win'));
    if (S.ov && t > 0.02 && !S.ov.classList.contains('in')) S.ov.classList.add('in');
    // egen krop: stå (eller ligge) og trække vejret
    const C = o.chars && o.chars();
    for (const pr of S.proxies) { if (i.reason === 'defuse' && pr.st.alive) pr.st.act = t < 2.0; try { C.animateHuman(pr.h, dt, performance.now() / 1000, pr.st); } catch (e) {} }
    // lys: key-light ved kameraet (blødt), rim bag helten, grøn LED på bomben ved desarmering
    const sh = shot(t), p = camSafe(sh.look, sh.pos);
    S.shake *= Math.exp(-dt * 3); const n = S.shake * 0.08; p.x += (Math.random() - 0.5) * n; p.y += (Math.random() - 0.5) * n; p.z += (Math.random() - 0.5) * n;
    p.y += Math.sin(t * 1.9) * 0.008; p.x += Math.sin(t * 1.3) * 0.006;                // håndholdt
    S.key.position.set(lerp(p.x, sh.look.x, 0.35), lerp(p.y, sh.look.y, 0.35) + 0.4, lerp(p.z, sh.look.z, 0.35)); S.key.intensity = 6 * smooth(t / 0.4);
    S.rim.position.set(S.P.x - (p.x - S.P.x) * 0.35, S.P.y + 2.0, S.P.z - (p.z - S.P.z) * 0.35); S.rim.intensity = 9 * smooth(t / 0.5);
    if (S.B) { S.led.position.set(S.B.x, S.B.y + 0.2, S.B.z); S.led.intensity = i.reason === 'defuse' ? (t > 0.55 ? 1.6 + Math.sin(t * 9) * 0.4 : 0) : 0; }
    cam.position.copy(p); cam.lookAt(sh.look);
    if (Math.abs(cam.fov - sh.fov) > 0.01) { cam.fov = sh.fov; cam.updateProjectionMatrix(); }
    const bars = o.$('introBars'); if (bars) bars.style.setProperty('--bar', '10vh');
    if (t >= T) { stop(true); return false; }
    return true;
  }
  function stop(callEnd) {
    if (!S) return;
    const s = S, sc = o.scene(); S = null;
    for (const pr of s.proxies) sc.remove(pr.h.group);
    sc.remove(s.key); sc.remove(s.rim); sc.remove(s.led);
    if (s.ov) { s.ov.className = 'rc hidden'; s.ov.innerHTML = ''; }
    if (callEnd !== false) o.onEnd && o.onEnd();
  }
  return { start, update, stop, get active() { return !!S; }, get _s() { return S; }, T };
}
