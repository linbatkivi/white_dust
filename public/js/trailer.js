// ==========================================================================
// White Dust · v26.7 TRAILER – en filmisk trailer instrueret i selve spilmotoren (samme bane, figurer, effekter og lyd som i spillet).
//   Åbningen er de rigtige intro-cutscenes (helikopteren og SWAT-lastbilen); derefter en hurtigt klippet montage med scripted figurer
//   (løb, skud, flashbang, kniv, bombe) og en eksplosion – titler slår ind i spillets egen typografi. Musikken er spillets intro-nummer.
//   createTrailer(host) -> { start(), stop(), update(dt), active, t, DURATION }  ·  host leveres af app.js (kamera, figurer, effekter, lyd)
// ==========================================================================
export function createTrailer(h) {
  const DURATION = 54;
  const S = { t: 0, on: false, puppets: new Map(), ev: [], cur: -1, spawned: false, bombOn: false, noteT: 0, last: 0 };
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const noise = (t, k) => { const a = t * 1.7 + k * 9.1; return Math.sin(a) * 0.55 + Math.sin(a * 2.31 + 1.3) * 0.3 + Math.sin(a * 5.7 + 2.1) * 0.15; };
  const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => v < a ? a : v > b ? b : v, sm = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const yawTo = (x0, z0, x1, z1) => Math.atan2(-(x1 - x0), -(z1 - z0));
  const FL = { alive: 1, crouch: 2, act: 4, ground: 8, reload: 16 };
  const WCODE = { usp: 1, mp5: 2, ak47: 3, m4a1: 4, awp: 5, glock: 9, knife: 18, mac10: 19, c4: 8, he: 6, flash: 15, smoke: 7 };

  /* ---------------- figurer ---------------- */
  function pup(id, side, name, w) { const p = { id, side, name, w, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, flags: FL.alive | FL.ground, on: false }; S.puppets.set(id, p); return p; }
  const P = {};
  function cast() {
    P.s1 = pup(101, 'swat', 'Falk', 'm4a1'); P.s2 = pup(102, 'swat', 'Raven', 'm4a1'); P.s3 = pup(103, 'swat', 'Moth', 'mp5'); P.s4 = pup(104, 'swat', 'Cobra', 'm4a1');
    P.h1 = pup(201, 'hij', 'Viper', 'ak47'); P.h2 = pup(202, 'hij', 'Dune', 'ak47'); P.h3 = pup(203, 'hij', 'Ghost', 'mac10'); P.h4 = pup(204, 'hij', 'Jackal', 'ak47');
    h.setPlayers([...S.puppets.values()]);
  }
  const place = (p, x, y, z, yaw, o) => { p.x = x; p.y = y; p.z = z; p.yaw = yaw; p.on = true; p.pitch = (o && o.pitch) || 0; p.flags = FL.alive | FL.ground | ((o && o.crouch) ? FL.crouch : 0) | ((o && o.act) ? FL.act : 0) | ((o && o.reload) ? FL.reload : 0) | (o && o.dead ? -FL.alive : 0); if (o && o.dead) p.flags = FL.ground; };
  const mv = (p, a, b, u, yaw, o) => place(p, lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u), yaw === undefined ? yawTo(a[0], a[2], b[0], b[2]) : yaw, o);
  const off = () => { for (const p of S.puppets.values()) p.on = false; };
  const muzzle = p => [p.x - Math.sin(p.yaw) * 0.7, p.y + (p.flags & FL.crouch ? 0.85 : 1.38), p.z - Math.cos(p.yaw) * 0.7];
  function fire(p, to, hit, n) { h.shot({ i: p.id, o: muzzle(p), e: to, w: p.w, h: hit ? 1 : 0, n: n || null }); }
  function burst(t0, p, to, count, gap, hit, jitter) { for (let i = 0; i < count; i++) S.ev.push({ t: t0 + i * gap, fn: () => { const j = jitter || 0; fire(p, [to[0] + (Math.random() - 0.5) * j, to[1] + (Math.random() - 0.5) * j, to[2] + (Math.random() - 0.5) * j], hit && i % 2 === 0, [0, 0, 1]); } }); }
  const at = (t, fn) => S.ev.push({ t, fn });

  /* ---------------- kamera ---------------- */
  function cam(pos, look, fov, roll, shake) {
    const k = shake || 0, t = S.t;
    const dx = look[0] - pos[0], dy = look[1] - pos[1], dz = look[2] - pos[2], yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
    h.cam({ x: pos[0] + noise(t, 1) * 0.02 * k, y: pos[1] + noise(t, 2) * 0.02 * k, z: pos[2] + noise(t, 3) * 0.02 * k, yaw: yaw + noise(t, 4) * 0.006 * k, pitch: pitch + noise(t, 5) * 0.006 * k, roll: (roll || 0) + noise(t, 6) * 0.004 * k, fov: fov || 60 });
  }
  const orbit = (c, r, a, hgt) => [c[0] + Math.cos(a) * r, hgt, c[2] + Math.sin(a) * r];

  /* ---------------- titler ---------------- */
  const T = (ms, html, cls) => h.text(html, ms, cls);
  const hit = (t, name, vol) => at(t, () => h.audio(name, { vol: vol === undefined ? 1 : vol }));

  /* ---------------- tidslinje ---------------- */
  // [start, slut, navn, fn(u, lt)] – u = 0..1 gennem klippet
  const ATRIUM = [12.7, 1.5, 2.3];
  const shots = [];
  const shot = (a, b, name, fn, enter, leave) => shots.push({ a, b, name, fn, enter, leave });

  // 1 · helikopteren (rigtig intro, første 9 s)
  shot(1.2, 10.4, 'heli', () => {}, () => { h.bars(true); h.introPlay('hij', 13000); }, () => { h.introStop(); });
  // 2 · SWAT ankommer (rigtig intro)
  shot(10.4, 14.9, 'garage', () => {}, () => { h.introPlay('swat', 12500); }, () => { h.introStop(); });
  // 3 · titel-slag
  shot(14.9, 18.4, 'black', (u, lt) => { h.cam({ x: 12.7, y: 8, z: 12, yaw: 0, pitch: -0.4, roll: 0, fov: 50 }); },
    () => { h.fade(1); T(1500, 'TWO TEAMS.', 'slam'); at(S.t + 1.7, () => T(1400, 'ONE BOMB.', 'slam red')); hit(S.t + 0.05, 'braam', 0.9); hit(S.t + 1.75, 'braam', 0.9); },
    () => { h.fade(0); });
  // 4 · atriet: SWAT trænger ind (lavt, track mod højre) – hijackere bag den sydlige sofa
  const A4 = 18.4;
  shot(A4, 20.7, 'atrium-push', (u, lt) => {
    cam([ATRIUM[0] - 6 + u * 5, 1.9, -6.5], [ATRIUM[0] + 1 + u * 3, 2.4, 3], 56, 0.04, 1.2);
    const x0 = 6.8, z0 = -8.5;
    mv(P.s1, [x0, 1.5, z0], [x0 + 8, 1.5, z0 + 5], clamp(u * 1.05 + 0.02, 0, 1)); mv(P.s2, [x0 - 1.4, 1.5, z0 - 1.2], [x0 + 7, 1.5, z0 + 3.4], clamp(u * 1.05, 0, 1)); mv(P.s3, [x0 - 2.6, 1.5, z0 - 2.0], [x0 + 5.5, 1.5, z0 + 2.2], clamp(u, 0, 1)); mv(P.s4, [x0 - 3.6, 1.5, z0 - 2.8], [x0 + 4.5, 1.5, z0 + 1.0], clamp(u, 0, 1));
    place(P.h1, 11.3, 1.5, 5.6, yawTo(11.3, 5.6, 9, -4), { crouch: true }); place(P.h2, 14.3, 1.5, 5.4, yawTo(14.3, 5.4, 9, -4), { crouch: true });
  }, () => { off(); hit(A4, 'steps', 0.7);
    burst(A4 + 0.5, P.s1, [11.3, 2.0, 5.4], 5, 0.09, true, 0.6); burst(A4 + 0.8, P.s2, [14.3, 2.0, 5.2], 4, 0.1, true, 0.6); burst(A4 + 1.05, P.h1, [8, 2, -3], 5, 0.1, false, 1.2); burst(A4 + 1.5, P.h2, [9, 2, -3], 4, 0.09, false, 1.2); burst(A4 + 1.7, P.s3, [11.5, 1.8, 5.2], 5, 0.07, true, 0.5); });
  // 5 · modsat vinkel: bagfra hijackerne – SWAT i kamp i det fjerne
  const A5 = 20.7;
  shot(A5, 22.7, 'sofa', (u, lt) => {
    cam([12.9 - u * 0.5, 1.95, 8.6], [11.4, 1.85, -3.5], 42, -0.03, 1.5);
    mv(P.h1, [11.3, 1.5, 5.4], [11.0, 1.5, 5.0], u, 0, { crouch: true }); mv(P.h2, [14.1, 1.5, 5.3], [13.9, 1.5, 5.0], u, 0, { crouch: true }); mv(P.h3, [12.6, 1.5, 6.9], [12.6, 1.5, 6.5], u, 0);
    mv(P.s1, [8.4, 1.5, -5.6], [9.6, 1.5, -3.8], u, Math.PI); mv(P.s2, [10.8, 1.5, -7.0], [11.4, 1.5, -4.6], u, Math.PI); mv(P.s3, [6.8, 1.5, -6.8], [7.8, 1.5, -5.0], u, Math.PI);
  }, () => { off(); burst(A5 + 0.1, P.h1, [9, 2, -4], 7, 0.08, false, 1.0); burst(A5 + 0.2, P.h2, [10.5, 1.9, -4], 6, 0.09, false, 1.0); burst(A5 + 0.35, P.h3, [9.6, 2, -4], 8, 0.065, false, 1.0); burst(A5 + 0.7, P.s1, [11.3, 1.7, 5.4], 5, 0.1, true, 0.6); burst(A5 + 0.9, P.s2, [13.9, 1.7, 5.2], 5, 0.09, true, 0.6); });
  // 6 · ovenfra: løbende figurer under lysringen (kran ned)
  const A6 = 22.7;
  shot(A6, 25.3, 'overhead', (u, lt) => {
    cam([ATRIUM[0] - 1 + u * 1.5, 7.2 - u * 1.6, ATRIUM[2] + 4.5 - u * 1.2], [ATRIUM[0] + 0.5, 1.6, ATRIUM[2] - 0.5], 62 - u * 8, 0.2 - u * 0.25, 1.0);
    mv(P.s1, [6, 1.5, -2], [14, 1.5, 3.6], u); mv(P.s2, [5, 1.5, 0], [12.5, 1.5, 5], clamp(u * 1.1, 0, 1)); mv(P.h1, [20, 1.5, 4], [14.5, 1.5, -1.5], u); mv(P.h2, [19, 1.5, 7], [15.5, 1.5, 0.5], clamp(u * 1.1, 0, 1)); mv(P.h3, [18, 1.5, 9], [13, 1.5, 6.5], u);
  }, () => { off(); burst(A6 + 0.1, P.s1, [20, 1.7, 4], 6, 0.08, true, 1.2); burst(A6 + 0.3, P.h1, [6, 1.7, -1], 6, 0.075, false, 1.5); burst(A6 + 0.7, P.s2, [18, 1.7, 7], 6, 0.08, true, 1.2); burst(A6 + 0.9, P.h2, [8, 1.7, 0], 5, 0.09, false, 1.5); hit(A6, 'rise', 0.5); });
  // 7 · flashbang: hvidt glimt midt i lounge'n
  const A7 = 25.3;
  shot(A7, 27.6, 'flashbang', (u, lt) => {
    cam([9.2 + u * 0.8, 1.7, -0.6 + u * 0.4], [13, 1.75, 5.5], 36 - u * 6, 0.05, 0.8);
    mv(P.h3, [12.0, 1.5, 6.2], [12.2, 1.5, 5.9], u, 0); mv(P.h1, [13.8, 1.5, 5.6], [13.9, 1.5, 5.3], u, 0);
    place(P.s2, 8.6, 1.5, -2.6, yawTo(8.6, -2.6, 13, 5), { crouch: true });
  }, () => { off(); h.audio('slowmo', { vol: 0.9 }); at(A7 + 0.35, () => h.audio('heart', { vol: 0.8 })); at(A7 + 0.95, () => { h.flash(12.7, 2.2, 3.0); h.audio('boom', { vol: 0.5 }); h.whiteout(1100); }); burst(A7 + 1.5, P.s2, [12.2, 1.7, 5.9], 6, 0.09, true, 0.5); });
  // 8 · A-sitet: SWAT løber mod hallen (lavt, bagfra)
  const A = [47.0, 4.5, -29.6];
  const A8 = 27.6;
  shot(A8, 30.2, 'rush', (u, lt) => {
    cam([A[0] - 12.8, A[1] + 1.15, A[2] + 0.3 - u * 0.4], [A[0] - 3.0 + u * 1.5, A[1] + 1.3, A[2] - 0.4], 50 - u * 8, 0.04, 1.6);
    mv(P.s1, [A[0] - 10.2, A[1], A[2] - 1.0], [A[0] - 3.4, A[1], A[2] - 1.2], u, -Math.PI / 2); mv(P.s2, [A[0] - 11.4, A[1], A[2] + 1.0], [A[0] - 4.6, A[1], A[2] + 0.4], clamp(u * 1.02, 0, 1), -Math.PI / 2); mv(P.s4, [A[0] - 12.4, A[1], A[2] - 0.2], [A[0] - 5.4, A[1], A[2] - 0.2], clamp(u, 0, 1), -Math.PI / 2);
    place(P.h1, A[0] + 0.9, A[1], A[2] - 0.4, Math.PI / 2, {}); P.h1.w = 'ak47';
  }, () => { off(); burst(A8 + 0.3, P.s1, [A[0] + 0.9, A[1] + 1.2, A[2] - 0.4], 7, 0.08, true, 0.8); burst(A8 + 0.5, P.h1, [A[0] - 9, A[1] + 1.2, A[2]], 6, 0.085, false, 1.2); burst(A8 + 0.9, P.s2, [A[0] + 0.9, A[1] + 1.2, A[2] - 0.4], 6, 0.08, true, 0.8); hit(A8, 'rise', 0.5); });
  // 9 · bomben plantes (makro på C4)
  const A9 = 30.2;
  shot(A9, 33.6, 'plant', (u, lt) => {
    cam([A[0] - 1.4 + u * 0.6, A[1] + 0.5, A[2] + 1.5 - u * 0.5], [A[0], A[1] + 0.25, A[2]], 36 - u * 10, -0.02, 0.7);
    place(P.h1, A[0] + 0.6, A[1], A[2] - 0.5, yawTo(A[0] + 0.6, A[2] - 0.5, A[0], A[2]), { crouch: true, act: true }); P.h1.w = 'c4';
    place(P.h2, A[0] + 2.6, A[1], A[2] + 1.8, yawTo(A[0] + 2.6, A[2] + 1.8, A[0] - 8, A[2] + 8));
  }, () => { off(); h.c4(A[0], A[1], A[2], true); h.audio('radio', { vol: 0.6 }); hit(A9 + 1.4, 'heart', 0.9); }, () => { P.h1.w = 'ak47'; });
  // 10 · bomben tæller ned – den rigtige bombe-film til eksplosionen
  const A10 = 33.6;
  shot(A10, 40.8, 'bomb', () => {}, () => { off(); h.bombPlay(A); at(A10 + 6.55, () => h.boom()); }, () => { h.bombStop(); h.c4(0, 0, 0, false); });
  // 11 · titelkort
  const A11 = 40.8;
  shot(A11, DURATION, 'title', (u, lt) => {
    cam(orbit([ATRIUM[0], 0, ATRIUM[2]], 14 - lt * 0.5, -1.4 + lt * 0.05, 3.2 + lt * 0.15), [ATRIUM[0], 5.2, ATRIUM[2] - 0.5], 50, 0, 0.3);
  }, () => { h.bars(true); h.rain(); h.fade(0); hit(A11, 'braam', 1); hit(A11 + 0.1, 'boom', 0.8); T(3600, 'WHITE_DUST', 'logo'); at(A11 + 3.8, () => T(3000, 'SWAT <i>VS</i> HIJACKERS · 5 ON 5', 'sub')); at(A11 + 6.8, () => T(3300, 'COMING SOON.', 'slam red')); at(DURATION - 2.8, () => h.fade(1, 2.6)); });

  /* ---------------- styring ---------------- */
  function enter(i) {
    const s = shots[i]; if (!s) return; S.cur = i;
    if (s.enter) s.enter(); for (const p of S.puppets.values()) if (p.id) p.on = p.on;
  }
  function start() {
    S.t = 0; S.on = true; S.cur = -1; S.ev.length = 0; S.last = 0; S.bombOn = false; cast(); off();
    h.begin(); h.audio('rain', { vol: 0.35, loop: true }); h.music('music_intro', { vol: 2.2, from: 0 }); at(0.2, () => h.audio('thunder2', { vol: 0.8 })); at(8.2, () => h.audio('thunder3', { vol: 0.9 }));
    // musik-slag på klippene
    h.fade(1); at(0.0, () => h.fade(0, 1.6));
  }
  function stop() { S.on = false; h.introStop(); h.bombStop(); h.end(); }
  function update(dt) {
    if (!S.on) return;
    S.t += dt;
    // events (i tidsorden)
    for (const e of S.ev) if (!e.done && S.t >= e.t) { e.done = true; try { e.fn(); } catch (err) { console.warn('[trailer]', err); } }
    // klip
    let idx = -1; for (let i = 0; i < shots.length; i++) if (S.t >= shots[i].a && S.t < shots[i].b) { idx = i; break; }
    if (idx !== S.cur) { if (S.cur >= 0 && shots[S.cur] && shots[S.cur].leave) shots[S.cur].leave(); S.cur = idx; if (idx >= 0) { S.shotT0 = S.t; if (shots[idx].enter) shots[idx].enter(); } }
    if (idx >= 0) { const s = shots[idx], u = clamp((S.t - s.a) / (s.b - s.a), 0, 1); s.fn(u, S.t - s.a); }
    // figurer → snapshot
    h.pushPuppets([...S.puppets.values()].filter(p => p.on));
    if (S.t >= DURATION) { stop(); h.done && h.done(); }
  }
  // spring direkte til tid t (bruges af kontaktarket): afvikler alle hændelser og klip i små skridt
  function seek(t, dt) { dt = dt || 1 / 30; while (S.t < t - 1e-6) update(Math.min(dt, t - S.t)); }
  return { start, stop, update, seek, DURATION, get active() { return S.on; }, get t() { return S.t; }, shots };
}
