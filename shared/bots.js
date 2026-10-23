// ==========================================================================
// BOTS · HJERNE (v26.12): computerstyrede spillere der erstatter manglende spillere (solo / få spillere i rummet).
//   Arkitektur (hver del kan udskiftes):
//     bots/nav.js    vej-søgning (A* på spillets fysik-graf), hold-positioner, plante-sted
//     bots/aim.js    menneskelig sigtekurve: reaktionstid, dæmpet fjeder, rystelse, recoil-kompensation, spredning
//     bots/brain.js  tilstandsmaskine + opfattelse (syn/lyd) + redskaber (granater) + økonomi + holdplaner
//
//   TILSTANDE  buy → (hij) STAGE → EXEC → PLANT → POST  ·  (swat) HOLD → ROTATE → STAGE → RETAKE → DEFUSE · SAVE · CLUTCH
//   ENGAGE (kamp) og SEARCH (lyd/sidst-set) overstyrer rutetilstanden midlertidigt.
//
//   • Opfattelse: syn = synsfelt + sigtelinje (røg blokerer); lyd = skridt/skud/genladning/plant/defuse med usikkerhed (gæt = position + støj)
//   • 'Slice the pie': ved hjørner og døråbninger går botten (shift) og fejer sigtet over den næste gang, med hoved-højde-sigte
//   • Redskaber: røg før et site-push, blænder lige før, HE mod sidst kendte position – koordineret via holdplanens 'go'-tidspunkt
//   • Økonomi: hele holdet køber ens (full / half / eco-save) ud fra gennemsnitspenge og tabsrække
//   • Situationer: 1vX (clutch) med tidsspil og lyd-baserede skud, rotationer via holdets 'intel', fake-pushes (to bots viser sig på det forkerte site)
//   createBots(ctx) -> { fill, spawn, tick, noise, onKill, remove }
// ==========================================================================
const createNav = require('./nav');
const { createAim, wrap } = require('./aim');

const NAMES = ['Alex', 'Mads', 'Sofie', 'Jonas', 'Freja', 'Oliver', 'Ida', 'Emil', 'Laura', 'Noah', 'Maja', 'Viktor', 'Clara', 'Lukas', 'Nanna', 'Oscar'];
const HIJ_AGENTS = ['hij4:olive', 'hij4:night', 'hij5:rust', 'hij5:olive', 'hij6:sand', 'hij6:jungle'];
const BOTS_PER_TEAM = 5;

module.exports = function createBots(S) {
  const { WD, now, r2 } = S, { PL } = WD;
  const rnd = (a, b) => a + Math.random() * (b - a), pick = arr => arr[(Math.random() * arr.length) | 0];
  const hypot = Math.hypot;

  /* ------------------------------------------------------------------ navigation pr. bane (caches på W) */
  function navOf(room) {
    const W = room.W; if (W._botNav) return W._botNav;
    const nav = createNav(WD, W), N = { nav, plant: {}, holds: {}, mid: null };
    for (const k of Object.keys(W.sites)) N.plant[k] = nav.plantSpot(k);
    for (const k of Object.keys(W.sites)) N.holds[k] = nav.holds(N.plant[k], 5, 13, 6, k.charCodeAt(0) * 17);
    const a = W.spawns.hij[0], b = W.spawns.swat[0], gx = (a.x + b.x) / 2, gz = (a.z + b.z) / 2, g = WD.groundAt(W, gx, gz, 1, 3);
    N.mid = { x: gx, z: gz, y: g > -Infinity ? g : 0 };
    W._botNav = N; return N;
  }

  /* ------------------------------------------------------------------ opret og fyld */
  function spawn(room, side) {
    const p = S.makePlayer(room, null, pick(NAMES) + ' (BOT)');
    p.bot = { skill: rnd(0.55, 0.95), state: 'idle', body: null, path: null, wi: 0, plan: null, target: 0, seen: {}, sus: null, buyDone: -1, utilT: 0, aim: null, think: 0, per: 0 };
    p.bot.aim = createAim(p.bot.skill);
    p.pref = side; p.connected = true; p.loaded = true; p.isBot = true;
    p.cos = side === 'hij' ? { agent: { hij: pick(HIJ_AGENTS) }, skins: {} } : { agent: { swat: pick(['swat:navy', 'swat:black', 'swat:ranger']) }, skins: {} };
    return p;
  }
  function fill(room, T) {                                      // T = { hij: [...], swat: [...] } fra assignTeams (kun mennesker) – udfylder til 5 pr. hold
    for (const side of ['hij', 'swat']) while (T[side].length < BOTS_PER_TEAM) T[side].push(spawn(room, side));
    return T;
  }
  function remove(room) { for (const p of [...room.players.values()]) if (p.isBot) room.players.delete(p.id); }

  /* ------------------------------------------------------------------ økonomi / køb */
  function buyRound(room, p) {
    if (process.env.WD_BOTCASH) p.money = +process.env.WD_BOTCASH;                  // kun til test
    const b = p.bot, side = p.side, team = [...room.players.values()].filter(q => q.side === side && q.isBot);
    const avg = team.reduce((s, q) => s + q.money, 0) / Math.max(1, team.length), min = Math.min(...team.map(q => q.money));
    const mode = min >= 3800 ? 'full' : avg >= 2300 ? 'half' : 'eco';                     // holdets fælles beslutning
    const tryBuy = id => { const w = WD.WEAPONS[id]; if (w && w.price && p.money >= w.price && WD.canBuy(side, id)) S.onBuy(room, p, id); };
    const rifle = side === 'hij' ? 'ak47' : 'm4a1', cheap = side === 'hij' ? 'galil' : 'famas', smg = side === 'hij' ? 'mac10' : 'mp9';
    if (mode === 'full') {
      if (Math.random() < 0.08 && p.money > 6500) tryBuy('awp'); else tryBuy(rifle);
      if (side === 'swat') tryBuy('kit');
      tryBuy('smoke'); tryBuy('flash'); if (Math.random() < 0.6) tryBuy('he'); if (Math.random() < 0.3) tryBuy(side === 'hij' ? 'molotov' : 'incgren');
    } else if (mode === 'half') {
      tryBuy(Math.random() < 0.5 ? cheap : smg); if (side === 'swat' && Math.random() < 0.5) tryBuy('kit'); if (Math.random() < 0.6) tryBuy('flash'); if (Math.random() < 0.5) tryBuy('smoke');
    } else {                                                    // eco: spar, eller kun en pistol-opgradering når der er råd
      if (p.money > 1500) tryBuy(side === 'hij' ? 'tec9' : 'fiveseven');
    }
    S.onSwitch(p, p.inv.primary || p.inv.pistol);                       // tag det bedste våben frem
  }

  /* ------------------------------------------------------------------ holdplaner */
  function planRound(room) {
    const N = navOf(room), W = room.W, sites = Object.keys(W.sites);
    const bots = [...room.players.values()].filter(p => p.isBot && p.side);
    const hij = bots.filter(p => p.side === 'hij'), swat = bots.filter(p => p.side === 'swat');
    const plan = room.botPlan = { round: room.round, hij: { site: pick(sites), mode: 'exec', go: 0, firstStage: 0 }, swat: { anchors: new Map(), go: 0 }, intel: null };
    const H = plan.hij; if (process.env.WD_BOTGO) H.go = now() + 4000;       // kun til test: udløs redskaber hurtigt
    // hvilket site? lidt vægtning mod det site der ikke blev forsvaret sidste gang; 25 % fake (to bots viser sig på det forkerte site)
    if (hij.length >= 3 && Math.random() < 0.25 && sites.length > 1) { H.mode = 'fake'; H.fake = sites.find(k => k !== H.site); H.fakers = new Set(shuffle(hij.filter(p => !p.inv.bomb)).slice(0, 2).map(p => p.id)); }
    // SWAT-ankre: to pr. site + én midt-roamer (rotation)
    const anchors = []; for (const k of sites) { anchors.push(k, k); } anchors.push('mid');
    shuffle(swat).forEach((p, i) => plan.swat.anchors.set(p.id, anchors[i % anchors.length]));
    for (const p of bots) { const b = p.bot; b.state = 'start'; b.path = null; b.target = 0; b.sus = null; b.hold = null; b.util = null; b.utilDone = 0; b.lastKnown = null; b.stage = false; b.body = null; b.buyDone = -1; }
    return plan;
  }
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* ------------------------------------------------------------------ hjælpere */
  const eyeY = p => p.y + (p.crouch ? PL.EYEC : PL.EYE);
  function smokeBlocks(room, a, b) {                                   // en røgsky mellem to punkter?
    for (const s of room.smokes || []) {
      if (now() - s.born < 1400 || now() > s.end) continue;
      const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2], L2 = abx * abx + aby * aby + abz * abz || 1;
      let t = ((s.x - a[0]) * abx + (s.y + 1 - a[1]) * aby + (s.z - a[2]) * abz) / L2; t = Math.max(0, Math.min(1, t));
      if (hypot(a[0] + abx * t - s.x, a[1] + aby * t - (s.y + 1), a[2] + abz * t - s.z) < 2.3) return true;
    }
    return false;
  }
  function canSee(room, p, q) {                                        // sigtelinje til brystet eller hovedet, inkl. røg
    const ey = eyeY(p), cy = q.y + (q.crouch ? 0.8 : 1.2), hy = q.y + (q.crouch ? 1.15 : 1.58);
    for (const ty of [cy, hy]) {
      if (!WD.losClear(room.W, p.x, ey, p.z, q.x, ty, q.z)) continue;
      if (smokeBlocks(room, [p.x, ey, p.z], [q.x, ty, q.z])) continue;
      return ty;
    }
    return null;
  }
  function inFov(p, q, fov) {
    const dx = q.x - p.x, dz = q.z - p.z, ang = Math.atan2(-dx, -dz);
    return Math.abs(wrap(ang - p.bot.aim.yaw)) < fov / 2;
  }
  const dist3 = (a, b) => hypot(a.x - b.x, a.y - b.y, a.z - b.z);

  /* ------------------------------------------------------------------ lyd (kaldes fra serveren ved skud, genladning, plant, defuse, eksplosioner og løb) */
  const RANGE = { shot: 46, step: 21, reload: 14, plant: 30, defuse: 30, boom: 70, glass: 40, bomb: 25 };
  function noise(room, src, kind, pos) {
    const P = pos || src, r = RANGE[kind] || 20;
    for (const p of room.players.values()) {
      if (!p.isBot || !p.alive || !p.side || (src && p.side === src.side)) continue;
      const d = hypot(P.x - p.x, P.z - p.z) + Math.abs(P.y - p.y) * 0.8;
      if (d > r * (0.75 + Math.random() * 0.25)) continue;
      const conf = 1 - d / r, err = d * (0.07 + (1 - conf) * 0.12);        // jo længere væk, jo usikrere
      const b = p.bot, was = b.sus;
      b.sus = { x: P.x + (Math.random() - 0.5) * 2 * err, z: P.z + (Math.random() - 0.5) * 2 * err, y: P.y, t: now(), conf, kind };
      if (kind === 'shot' && d < 30 && !b.target) b.aim.since = now();
      if (!was || was.conf < conf) b.walkUntil = now() + 2500 + conf * 2000;      // lytter og sniger (shift) – minimerer egen støj
    }
  }
  function onKill(room, victim, killer) {                               // makker dræbt: 'trade' – nærmeste makker kigger/skubber mod morderen; intel til holdet
    if (!killer || !victim.side) return;
    const site = WD.siteAt(room.W, victim.x, victim.y, victim.z) || nearSite(room, victim);
    if (room.botPlan && victim.side === 'swat' && site) room.botPlan.intel = { site, t: now() };
    for (const p of room.players.values()) {
      if (!p.isBot || !p.alive || p.side !== victim.side || p === victim) continue;
      const d = hypot(p.x - victim.x, p.z - victim.z); if (d > 24) continue;
      p.bot.sus = { x: killer.x, z: killer.z, y: killer.y, t: now(), conf: 0.9, kind: 'trade' }; p.bot.trade = now() + 3500;
    }
  }
  function nearSite(room, q) { let best = null, bd = 18; for (const k in room.W.sites) { const s = room.W.sites[k], d = hypot((s.x0 + s.x1) / 2 - q.x, (s.z0 + s.z1) / 2 - q.z); if (d < bd) { bd = d; best = k; } } return best; }

  /* ------------------------------------------------------------------ bevægelse */
  function setPath(room, p, goal, r) {                                  // starter et A*-job; tick() fordeler regnetiden (maks. ~3 ms pr. tick til alle bots)
    const b = p.bot, N = navOf(room), t = now();
    b.job = N.nav.job(p.x, p.z, p.y, goal.x, goal.z, goal.y, r || 0.9, 16000); b.jobGoal = goal; b.jobR = r || 0.9;
    b.goal = goal; b.pathKey = Math.round(goal.x) + ',' + Math.round(goal.z); b.repath = t + 3000 + Math.random() * 1000;
  }
  function pumpJobs(room, budgetMs) {
    const bots = [...room.players.values()].filter(p => p.isBot && p.bot.job);
    if (!bots.length) return;
    bots.sort((a, c) => (a.bot.jobAge = a.bot.jobAge || now()) - (c.bot.jobAge = c.bot.jobAge || now()));
    let left = budgetMs;
    for (const p of bots) {
      if (left <= 0) break;
      const b = p.bot, T0 = process.hrtime.bigint();
      if (b.job.run(left)) { const res = b.job.result; b.job = null; b.jobAge = 0; b.path = res || []; b.wi = 0; b.stuck = 0; b.lastProg = 1e9; }
      left -= Number(process.hrtime.bigint() - T0) / 1e6;
    }
  }
  function steer(room, p, dt, opt) {                                    // ét stykke bevægelse mod næste punkt på stien
    const b = p.bot, body = b.body, W = room.W;
    const inp = { fx: 0, sx: 0, yaw: b.aim.yaw, jump: false, crouch: !!opt.crouch, walk: !!opt.walk };
    if (opt.halt) { WD.stepBody(W, body, { fx: 0, sx: 0, yaw: b.aim.yaw, crouch: !!opt.crouch }, dt); return; }
    if (b.lad) { stepLadder(room, p, dt); return; }
    const path = b.path;
    if (path && b.wi < path.length) {
      const wp = path[b.wi];
      if (wp.ladder) {                                                  // stige: gå hen til foden eller toppen og klatr
        const l = wp.ladder; b.lad = { l, up: wp.up, k: 0 };
        if (wp.up) { body.x = (l.x0 + l.x1) / 2 + l.nx * 0.45; body.z = (l.z0 + l.z1) / 2 + l.nz * 0.45; }
        else { const tp = navOf(room).nav.ladderTop(l); if (tp) { body.x = tp.x; body.z = tp.z; body.y = tp.y; } }
        return;
      }
      const dx = wp.x - body.x, dz = wp.z - body.z, d = hypot(dx, dz);
      if (d < 0.32 && Math.abs(body.y - wp.y) < 0.7) { b.wi++; return; }
      const lead = 0.14, ex = dx - body.vx * lead, ez = dz - body.vz * lead;
      const move = Math.atan2(-ex, -ez), rel = wrap(move - b.aim.yaw);
      inp.fx = Math.cos(rel); inp.sx = -Math.sin(rel);                  // bevægelsesretning uafhængig af sigtet (blikretning = aim.yaw)
      inp.jump = !!wp.jump && body.ground && d < 1.2;
      inp.crouch = inp.crouch || !!wp.crouch || !!(path[b.wi + 1] && path[b.wi + 1].crouch);
      if (opt.walk || (body.ground && d < 0.55 && !wp.jump)) inp.walk = true;
    }
    WD.stepBody(W, body, inp, dt);
    const prog = (b.wi * 100) - (path && path[b.wi] ? hypot(path[b.wi].x - body.x, path[b.wi].z - body.z) : 0);
    if (path && b.wi < path.length) { if (prog > b.lastProg + 0.05 || b.lastProg === 1e9) { b.lastProg = prog; b.stuck = 0; } else b.stuck += dt; }
    if (b.stuck > 2.2) { b.path = null; b.stuck = 0; }                      // sidder fast → find ny sti
  }
  function stepLadder(room, p, dt) {
    const b = p.bot, body = b.body, L = b.lad, l = L.l, W = room.W, yaw = Math.atan2(l.nx, l.nz);
    L.k += dt;
    if (L.up) { WD.stepBody(W, body, { fx: 1, sx: 0, yaw, jump: false }, dt); if ((body.ground && Math.abs(body.y - l.y1) < 0.08 && !body.onLadder) || L.k > 8) { b.lad = null; b.wi++; } }
    else {
      const lx = (l.x0 + l.x1) / 2 + l.nx * 0.4, lz = (l.z0 + l.z1) / 2 + l.nz * 0.4, toL = Math.atan2(-(lx - body.x), -(lz - body.z)), on = body.onLadder;
      WD.stepBody(W, body, { fx: on ? -1 : 1, sx: 0, yaw: on ? yaw : toL, jump: false }, dt);
      if ((body.ground && Math.abs(body.y - l.y0) < 0.08) || L.k > 8) { b.lad = null; b.wi++; }
    }
  }
  function syncToPlayer(room, p, t, dt) {
    const body = p.bot.body, W = room.W;
    const dx = body.x - p.x, dz = body.z - p.z, d = hypot(dx, dz);
    p.x = body.x; p.y = body.y; p.z = body.z; p.crouch = !!body.crouch; p.ground = !!body.ground;
    p.speed = p.speed * 0.6 + (d / Math.max(dt, 0.001)) * 0.4;
    p.yaw = p.bot.aim.yaw; p.pitch = p.bot.aim.pitch; p.lastIn = t;
    p.hist.push({ t, x: p.x, y: p.y, z: p.z, c: p.crouch }); while (p.hist.length && t - p.hist[0].t > 700) p.hist.shift();
    p.use = !!p.bot.use;
  }

  /* ------------------------------------------------------------------ redskaber: beregn en kastevinkel mod et mål */
  function lineup(room, p, tgt) {                                       // → { d, pw } eller null
    const W = room.W, o = [p.x, eyeY(p), p.z], dx = tgt.x - o[0], dz = tgt.z - o[2], D = hypot(dx, dz);
    if (D < 3 || D > 40) return null;
    const hy = Math.atan2(-dx, -dz); let best = null, be = 1e9;
    for (let pw = 0.4; pw <= 1.001; pw += 0.2) for (let pit = 0.14; pit <= 1.0; pit += 0.11) {
      const cp = Math.cos(pit), d = [-Math.sin(hy) * cp, Math.sin(pit), -Math.cos(hy) * cp], v = WD.throwVel(d, pw, false), G = WD.THROW.G;
      let x = o[0], y = o[1], z = o[2], blocked = false, landed = false;
      for (let t = 0.08; t < 4; t += 0.08) {
        const nx = o[0] + v[0] * t, ny = o[1] + v[1] * t - 0.5 * G * t * t, nz = o[2] + v[2] * t;
        const h = WD.raycastWorld(W, x, y, z, nx - x, ny - y, nz - z, hypot(nx - x, ny - y, nz - z) + 1e-6);
        if (h < hypot(nx - x, ny - y, nz - z) - 0.05) { blocked = true; break; }
        if (ny <= tgt.y + 0.1 && t > 0.2) { x = nx; z = nz; landed = true; break; }
        x = nx; y = ny; z = nz;
      }
      if (blocked || !landed) continue;
      const e = hypot(x - tgt.x, z - tgt.z); if (e < be) { be = e; best = { d, pw, e }; }
    }
    return best && best.e < 3.2 ? best : null;
  }
  function throwNade(room, p, type, tgt) {
    if (!(p.inv[type] > 0)) return false;
    if (room._lineAt === room._tickT) return 'retry';                           // højst én kast-beregning pr. tick
    room._lineAt = room._tickT; const L = lineup(room, p, tgt); if (!L) return false;
    S.onSwitch(p, type); p.pin = true;
    p.bot.pendingThrow = { t: now() + 520, type, d: L.d, pw: L.pw };
    return true;
  }

  /* ------------------------------------------------------------------ hoved-tænkning pr. bot */
  function think(room, p, t, dt) {
    const b = p.bot, W = room.W, plan = room.botPlan, N = navOf(room), side = p.side, bomb = room.bomb;
    if (!b.body || b.syncRound !== room.round) { b.body = WD.newBody(p.x, p.y, p.z); b.body.crouch = false; b.syncRound = room.round; b.path = null; }
    const body = b.body;
    // eksterne ændringer (teleport ved rundestart, korrektion) → tving kroppen til serverens position
    if (hypot(body.x - p.x, body.z - p.z) > 1.5 || Math.abs(body.y - p.y) > 2) { body.x = p.x; body.y = p.y; body.z = p.z; body.vx = body.vy = body.vz = 0; b.path = null; }

    /* ---------- opfattelse (≈10 Hz) ---------- */
    if (t >= b.per) {
      b.per = t + 100 + Math.random() * 40;
      let bestT = null, bestD = 1e9;
      for (const q of room.players.values()) {
        if (!q.alive || !q.side || q.side === side) continue;
        const d = dist3(p, q); if (d > 70) continue;
        const ty = canSee(room, p, q); if (ty === null) continue;
        const fov = b.target ? 2.4 : 1.9;                               // lidt snævrere periferi uden mål
        if (!inFov(p, q, fov) && d > 5) continue;
        if (d < bestD) { bestD = d; bestT = { q, ty, d }; }
      }
      if (bestT) {
        const first = b.target !== bestT.q.id;
        b.target = bestT.q.id; b.tgtT = t; b.tgtInfo = bestT; b.lastKnown = { x: bestT.q.x, y: bestT.q.y, z: bestT.q.z, t };
        if (first) { b.aim.since = t; b.aimHead = Math.random() < Math.max(0.12, Math.min(0.75, 0.3 + b.skill * 0.35 - bestT.d / 90)); b.aim.react = Math.max(b.aim.react, t + 140 + (1 - b.skill) * 70 + Math.random() * 40); b.firstAt = b.aim.react; }
        if (room.botPlan && side === 'swat') { const st = nearSite(room, bestT.q); if (st) room.botPlan.intel = { site: st, t: now() }; }
      } else if (b.target && t - b.tgtT > 450) b.target = 0;           // mistede målet: gå til SEARCH
    }
    const tq = b.target ? room.players.get(b.target) : null;
    const engaged = !!(tq && tq.alive && t - b.tgtT < 450);
    if (!engaged) b.target = 0;

    /* ---------- aim-mål ---------- */
    let walk = !!(b.walkUntil && t < b.walkUntil), crouch = false, halt = false;
    if (engaged) {
      const w = WD.WEAPONS[p.cur] || {}, ty = b.tgtInfo.ty, aimY = (b.aimHead && w.id !== 'awp') ? tq.y + (tq.crouch ? 1.12 : 1.55) : tq.y + (tq.crouch ? 0.8 : 1.15);
      const lead = 0.06, tx = tq.x + (tq.vx || 0) * lead, dx = tx - p.x, dz = tq.z - p.z, dy = aimY - eyeY(p), hd = hypot(dx, dz);
      b.aim.setWant(Math.atan2(-dx, -dz), Math.atan2(dy, hd), t, false);
    } else {
      let ay = b.aim.yaw, ap = 0;
      if (b.sus && t - b.sus.t < 5000) { ay = Math.atan2(-(b.sus.x - p.x), -(b.sus.z - p.z)); ap = 0; }                     // sigt mod lyden
      else if (b.path && b.wi < b.path.length && !b.lad) {                                                                 // kig dér hvor man går hen – og fej ved hjørner (slice the pie)
        const wp = b.path[Math.min(b.path.length - 1, b.wi + 2)], far = b.path[Math.min(b.path.length - 1, b.wi + 6)];
        ay = Math.atan2(-(wp.x - p.x), -(wp.z - p.z));
        const turn = Math.abs(wrap(Math.atan2(-(far.x - wp.x), -(far.z - wp.z)) - ay));
        if (turn > 0.8 && hypot(wp.x - p.x, wp.z - p.z) < 3.4) { walk = true; ay = wrap(ay + Math.sign(wrap(Math.atan2(-(far.x - wp.x), -(far.z - wp.z)) - ay)) * Math.min(0.9, turn) * (0.5 + 0.5 * Math.sin(t * 0.006))); }
      } else if (b.hold) { ay = b.hold.yaw + Math.sin(t * 0.0018 + p.id) * 0.4; }
      b.aim.setWant(ay, ap, t, !b.fresh && (b.fresh = true));
    }

    /* ---------- tilstandsmaskine (rute) ---------- */
    if (!plan) return;
    const sites = Object.keys(W.sites), H = plan.hij;
    const planted = bomb.state === 2, timeLeft = planted ? bomb.timer : (room.phaseEnd - t) / 1000;
    if (t >= b.think) {
      b.think = t + 220 + Math.random() * 120;
      const alive = [...room.players.values()].filter(q => q.alive && q.side === side).length, foes = [...room.players.values()].filter(q => q.alive && q.side && q.side !== side).length;
      b.clutch = alive === 1 && foes >= 2;
      if (side === 'hij') thinkHij(room, p, t, N, H, planted, timeLeft);
      else thinkSwat(room, p, t, N, plan, planted, timeLeft);
      if (!engaged && b.sus && t - b.sus.t < 1000 && b.sus.conf > 0.55 && (b.trade > t) && b.state !== 'plant' && b.state !== 'defuse') { setPath(room, p, { x: b.sus.x, y: b.sus.y, z: b.sus.z }, 2.2); b.walkUntil = t + 3000; }     // trade-skub mod morderen
      if (b.goal && b.state !== 'plant' && b.state !== 'defuse' && !b.lad) {
        const gk = Math.round(b.goal.x) + ',' + Math.round(b.goal.z);
        if (b.pathKey !== gk) setPath(room, p, b.goal, b.goalR || 0.9);
        else if (!b.job && (!b.path || (b.wi >= b.path.length && hypot(body.x - b.goal.x, body.z - b.goal.z) > 1.6)) && t > (b.repath || 0)) setPath(room, p, b.goal, b.goalR || 0.9);
      }
    }
    /* ---------- skyd ---------- */
    shootLogic(room, p, t, dt, engaged ? tq : null);
    /* ---------- bevægelse ---------- */
    const atGoal = !b.path || b.wi >= b.path.length;
    if (b.state === 'plant' || b.state === 'defuse') halt = true;
    else if (engaged) {                                                  // kamp: langt væk → stå stille/hug for præcision, mellem → stop-og-gå, tæt på → strafe
      const d = b.tgtInfo.d;
      if (d > 14) { halt = true; crouch = d > 28 && p.cur !== 'awp'; }
      else if (d > 6) { halt = (t % 700) < 420; }
      else { b.strafeT = b.strafeT || 0; if (t > b.strafeT) { b.strafeT = t + 250 + Math.random() * 450; b.strafe = Math.random() < 0.5 ? -1 : 1; } }
    } else if (b.state === 'hold' && atGoal) { halt = true; crouch = !!b.holdCrouch; }
    else if (b.state === 'stagewait') halt = true;
    if (engaged && !halt && b.strafe && b.tgtInfo.d <= 6) {              // strafe sidelæns mens der skydes
      const l = { fx: 0, sx: b.strafe, yaw: b.aim.yaw, walk: false, crouch: false };
      WD.stepBody(W, body, l, dt);
    } else steer(room, p, dt, { halt, crouch, walk });
    syncToPlayer(room, p, t, dt);
  }

  /* ---------- hijackere ---------- */
  function thinkHij(room, p, t, N, H, planted, timeLeft) {
    const b = p.bot, W = room.W, bomb = room.bomb, site = H.site, carrier = p.inv.bomb;
    b.use = false;
    if (planted) {                                                      // POST: hold positioner med sigtelinje til bomben
      if (b.state !== 'post') { b.state = 'post'; const hs = N.nav.holds({ x: bomb.x, z: bomb.z, y: bomb.y }, 4, 14, 5, p.id * 13); const h = hs.length ? pick(hs) : { x: bomb.x, y: bomb.y, z: bomb.z }; b.hold = { x: h.x, y: h.y, z: h.z, yaw: Math.atan2(-(bomb.x - h.x), -(bomb.z - h.z)) }; b.holdCrouch = Math.random() < 0.5; setPath(room, p, h, 0.7); }
      b.state = 'hold'; b.postPlant = true;
      if (b.clutch && timeLeft > 8) { b.walkUntil = t + 600; }
      // utility: HE/molotov mod sidst kendt position
      utilityReactive(room, p, t);
      return;
    }
    const mySite = (H.mode === 'fake' && H.fakers && H.fakers.has(p.id)) ? H.fake : site;
    const target = carrier ? N.plant[mySite === H.fake ? site : site] : null;
    if (carrier && H.mode !== 'fake') {
      const pl = N.plant[site];
      b.goal = pl; b.goalR = 0.5;
      const d = hypot(p.x - pl.x, p.z - pl.z);
      if (d < 20 && !H.go) { b.state = 'stagewait'; if (!H.firstStage) H.firstStage = t; markStage(H, t); if (t >= H.go) { b.state = 'exec'; } }
      else b.state = H.go && t < H.go ? 'stagewait' : 'exec';
      if (d < 1.2 && WD.plantSpot(W, p.x, p.y, p.z) && !b.engagedNow) { b.state = 'plant'; b.use = true; }
      utilityExec(room, p, t, N, H, site);
      return;
    }
    // escort / fake
    const siteK = mySite;
    if (!b.hold || b.holdSite !== siteK) { const hs = N.holds[siteK] || []; const h = hs.length ? hs[(p.id * 7 + (hs.length >> 1)) % hs.length] : N.plant[siteK]; b.hold = { x: h.x, y: h.y, z: h.z, yaw: Math.atan2(-(N.plant[siteK].x - h.x), -(N.plant[siteK].z - h.z)) }; b.holdSite = siteK; b.goal = h; b.goalR = 0.8; b.path = null; }
    const dd = hypot(p.x - b.hold.x, p.z - b.hold.z), dp = hypot(p.x - N.plant[siteK].x, p.z - N.plant[siteK].z);
    if (dp < 24 && !H.go && H.mode !== 'fake') { b.state = 'stagewait'; markStage(H, t); }
    else if (H.go && t < H.go && H.mode !== 'fake') b.state = 'stagewait';
    else b.state = dd < 1.5 ? 'hold' : 'exec';
    if (H.mode === 'fake' && H.fakers && H.fakers.has(p.id)) {          // fake: vis dig, kast utility og rotér efter ~14 s
      if (dd < 3 && !b.fakeAt) b.fakeAt = t;
      if (b.fakeAt && t - b.fakeAt > 14000 && H.fakers.has(p.id)) { H.fakers.delete(p.id); b.holdSite = null; b.hold = null; }
      if (dd < 8) { b.walkUntil = 0; if (!b.fakeN) { b.fakeN = 1; noiseBurst(room, p); } }
    }
    utilityExec(room, p, t, N, H, siteK);
    if (b.state === 'stagewait' && H.go && t >= H.go) b.state = 'exec';
  }
  function markStage(H, t) { if (!H.firstStage) H.firstStage = t; if (!H.go && t - H.firstStage > 6500) H.go = t + 600; }     // go ca. 6,5 s efter første ankomst
  function noiseBurst(room, p) { noise(room, p, 'shot', { x: p.x, y: p.y, z: p.z }); }

  /* ---------- SWAT ---------- */
  function thinkSwat(room, p, t, N, plan, planted, timeLeft) {
    const b = p.bot, W = room.W, bomb = room.bomb, anchor = plan.swat.anchors.get(p.id) || 'mid';
    b.use = false;
    if (planted) {                                                      // RETAKE
      const bp = { x: bomb.x, y: bomb.y, z: bomb.z }, d = hypot(p.x - bp.x, p.z - bp.z);
      const defuser = bomb.defuser === p.id;
      const est = d / 5.2 + (p.inv.kit ? 5 : 10);
      if (!defuser && est > timeLeft + 2 && b.state !== 'retake' && !b.clutch) { b.state = 'save'; b.goal = W.spawns.swat[0]; b.goalR = 3; return; }
      if (!plan.swat.rgo && d < 40) { plan.swat.rgo = t + 3500 + Math.random() * 1500; plan.swat.rstage = t; }      // koordineret go efter udstyr
      const rgo = plan.swat.rgo || 0;
      if (d > 14 && rgo && t < rgo) { b.state = 'stagewait'; utilityRetake(room, p, t, N, bp); return; }
      if (b.clutch && d > 10 && !b.sus) { b.state = 'stagewait'; b.walkUntil = t + 1000; if (t - (plan.swat.cl || 0) > 4000) plan.swat.cl = t; if (timeLeft < 14) { b.state = 'retake'; } else return; }   // clutch: tid, lyt, gå frem når der er lyst
      b.state = 'retake'; b.goal = bp; b.goalR = defuser ? 1.2 : 2.6;
      const eng = !!b.target;
      if (d < 2.0 && !eng && (!b.sus || t - b.sus.t > 2500 || b.sus.conf < 0.3)) { b.state = 'defuse'; b.use = true; }
      else if (d < 5.5 && !eng && !b.nearBomb) b.nearBomb = t;
      if (b.state === 'defuse' && b.clutch && Math.random() < 0.02) { b.use = false; }          // fake-defuse: afbryd og lad fjenden vise sig
      return;
    }
    // HOLD / ROTATE
    let site = anchor;
    const I = plan.intel;
    if (I && now() - I.t < 25000 && anchor !== I.site && b.rot !== I.t) {          // rotation efter intel (kun hvis ikke allerede dér)
      if (anchor === 'mid' || Math.random() < 0.55) { b.rot = I.t; b.rotTo = I.site; b.rotAt = t + rnd(900, 2400); }
    }
    if (b.rotTo && t >= b.rotAt) { site = b.rotTo; }
    else if (b.rotTo) site = anchor;
    const key = site + (b.rotTo || '');
    if (!b.hold || b.holdKey !== key) {
      let tgt; let hs;
      if (site === 'mid') { tgt = N.mid; hs = N.nav.holds(N.mid, 3, 11, 4, p.id * 5); } else { tgt = N.plant[site]; hs = N.holds[site] || []; }
      const h = hs.length ? hs[(p.id * 5) % hs.length] : tgt;
      b.hold = { x: h.x, y: h.y, z: h.z, yaw: Math.atan2(-(tgt.x - h.x), -(tgt.z - h.z)) }; b.holdKey = key; b.holdCrouch = Math.random() < 0.4; b.goal = h; b.goalR = 0.8; b.path = null;
    }
    const dd = hypot(p.x - b.hold.x, p.z - b.hold.z);
    b.state = dd < 1.4 ? 'hold' : 'moving';
    utilityHold(room, p, t, N, plan);
  }

  /* ---------- redskaber ---------- */
  function utilityExec(room, p, t, N, H, site) {
    const b = p.bot; if (!H.go || t < H.go - 100 || b.utilDone >= 3 || b.pendingThrow) return;
    const pl = N.plant[site], sw = room.W.spawns.swat[0];
    const dirx = sw.x - pl.x, dirz = sw.z - pl.z, L = hypot(dirx, dirz) || 1;
    const smokeAt = { x: pl.x + dirx / L * 5.5, z: pl.z + dirz / L * 5.5, y: pl.y }, g = WD.groundAt(room.W, smokeAt.x, smokeAt.z, pl.y + 0.5, 1.6); if (g > -Infinity) smokeAt.y = g;
    const k = b.utilDone;
    if (k === 0 && p.inv.smoke > 0 && t >= H.go - 100) { const r = throwNade(room, p, 'smoke', smokeAt); if (r !== 'retry') b.utilDone = 1; }
    else if (k === 1 && p.inv.flash > 0 && t >= H.go + 900) { const r = throwNade(room, p, 'flash', { x: pl.x, y: pl.y + 0.4, z: pl.z }); if (r !== 'retry') b.utilDone = 2; }
    else if (k >= 1 && k < 3 && t >= H.go + 900) b.utilDone = 3;
  }
  function utilityRetake(room, p, t, N, bp) {
    const b = p.bot; if (b.utilDone >= 2 || b.pendingThrow || !room.botPlan.swat.rgo) return;
    if (t < room.botPlan.swat.rgo - 1700) return;
    if (b.utilDone === 0 && p.inv.smoke > 0 && hypot(p.x - bp.x, p.z - bp.z) < 24) { if (throwNade(room, p, 'smoke', { x: bp.x, y: bp.y, z: bp.z }) !== 'retry') b.utilDone = 1; }
    else if (b.utilDone <= 1 && p.inv.flash > 0 && t > room.botPlan.swat.rgo - 700) { if (throwNade(room, p, 'flash', { x: bp.x, y: bp.y + 0.5, z: bp.z }) !== 'retry') b.utilDone = 2; }
  }
  function utilityHold(room, p, t, N, plan) { utilityReactive(room, p, t); }
  function utilityReactive(room, p, t) {                                // HE/molotov mod en sidst kendt fjende (ikke når man selv er i kamp)
    const b = p.bot; if (b.pendingThrow || b.target || !b.lastKnown || t - b.lastKnown.t > 5000 || t < (b.reactT || 0)) return;
    const d = hypot(p.x - b.lastKnown.x, p.z - b.lastKnown.z); if (d < 7 || d > 24) return;
    const type = p.inv.he > 0 ? 'he' : (p.inv[p.side === 'hij' ? 'molotov' : 'incgren'] > 0 ? (p.side === 'hij' ? 'molotov' : 'incgren') : null); if (!type) return;
    b.reactT = t + 9000; if (Math.random() < 0.55) throwNade(room, p, type, { x: b.lastKnown.x, y: b.lastKnown.y, z: b.lastKnown.z });
  }

  /* ------------------------------------------------------------------ skydning */
  function shootLogic(room, p, t, dt, tq) {
    const b = p.bot, aim = b.aim;
    aim.step(dt, t);
    // udskudte kast (efter at have skiftet til granaten)
    if (b.pendingThrow && t >= b.pendingThrow.t) { const q = b.pendingThrow; b.pendingThrow = null; S.onThrow(room, p, { d: q.d, o: [p.x, eyeY(p), p.z], pw: q.pw }); S.onSwitch(p, p.inv.primary || p.inv.pistol); p.pin = false; return; }
    if (b.pendingThrow) return;
    const w = WD.WEAPONS[p.cur]; if (!w || w.kind !== 'gun') { if (tq && p.cur !== (p.inv.primary || p.inv.pistol)) S.onSwitch(p, p.inv.primary || p.inv.pistol); return; }
    const am = p.ammo[p.cur];
    if (am && am.mag <= 0 && !p.reloadEnd) { S.startReload(p); noise(room, p, 'reload'); }
    if (!tq || p.reloadEnd || !am || am.mag <= 0) { if (!tq && am && am.mag < w.mag * 0.5 && !p.reloadEnd && Math.random() < 0.02 && !b.sus) { S.startReload(p); } return; }
    if (t < (b.firstAt || 0)) return;                                   // reaktionstid: først skud efter forsinkelsen
    const d = b.tgtInfo.d, err = aim.error(), tol = Math.atan(0.30 / Math.max(2, d)) * 1.25 + 0.004;
    if (err > tol * 2.2) return;                                        // ikke på mål endnu
    if (err > tol && Math.random() < 0.5) return;
    // standsning før skud for præcision (men tæt på må man gerne bevæge sig)
    if (d > 9 && p.speed > 2.6 && t - (b.lastShotT || 0) > 250) return;
    // burst/kadence
    const auto = w.rate < 0.13, shotGap = w.rate * 1000;
    if (auto) {
      if (!b.burst) b.burst = { n: 0, max: d < 12 ? 12 + (Math.random() * 10 | 0) : d < 25 ? 4 + (Math.random() * 4 | 0) : 2 + (Math.random() * 3 | 0), pause: 0 };
      if (t < b.burst.pause) return;
      if (b.burst.n >= b.burst.max) { b.burst.pause = t + (d < 12 ? 140 : 320 + Math.random() * 200); b.burst = null; return; }
    } else if (t - (b.lastShotT || 0) < shotGap + (p.cur === 'awp' ? 100 : 80 + Math.random() * 140)) return;
    if (t - (b.lastShotT || 0) < shotGap * 0.9) return;
    const dir = aim.dir(w, p.speed, p.crouch, !p.ground);
    b.lastShotT = t; if (b.burst) b.burst.n++;
    S.onShoot(room, p, { d: dir, o: [p.x, eyeY(p), p.z], st: Math.round(t) });
    aim.kick(w);
  }

  /* ------------------------------------------------------------------ tick */
  function tick(room, t, dt) {
    const T0 = process.hrtime.bigint(); try { tick0(room, t, dt); } finally { const ms = Number(process.hrtime.bigint() - T0) / 1e6; room._tmax = Math.max(room._tmax || 0, ms); room._tsum = (room._tsum || 0) + ms; room._tn = (room._tn || 0) + 1; }
  }
  function tick0(room, t, dt) {
    room._tickT = t; let any = false; for (const p of room.players.values()) if (p.isBot) { any = true; break; }
    if (!any) return;
    if (room.phase === 'buy') {
      if (room.botBuyRound !== room.round) {
        room.botBuyRound = room.round; planRound(room);
        for (const p of room.players.values()) if (p.isBot) p.bot.buyAt = t + 400 + Math.random() * 3500;
      }
      for (const p of room.players.values()) if (p.isBot && p.bot.buyDone !== room.round && t >= p.bot.buyAt) { p.bot.buyDone = room.round; try { buyRound(room, p); } catch (e) { console.error('bot-køb:', e); } }
      for (const p of room.players.values()) if (p.isBot) { p.bot.body = null; }
      return;
    }
    if (room.phase !== 'live') return;
    pumpJobs(room, 3);
    for (const q of room.players.values()) {                            // skridt: løb (ikke hug/shift) høres af modstandere
      if (!q.alive || !q.side || q.crouch || q.speed < 3.6 || t - (q.stepT || 0) < 380) continue;
      q.stepT = t; noise(room, q, 'step');
    }
    if (!room.botPlan || room.botPlan.round !== room.round) planRound(room);
    if (process.env.WD_BOTDBG && t - (room._dbgT || 0) > 5000) { room._dbgT = t; console.log('[bots] r' + room.round + ' ' + [...room.players.values()].filter(q => q.isBot).map(q => q.side[0] + ':' + (q.alive ? q.bot.state + (q.bot.target ? '*' : '') + '@' + Math.round(q.x) + ',' + Math.round(q.z) + (q.inv.bomb ? 'B' : '') : 'x')).join(' ') + ' ms avg/max ' + (room._tsum / room._tn).toFixed(2) + '/' + room._tmax.toFixed(1) + ' bomb=' + room.bomb.state + (room.botPlan ? ' plan=' + room.botPlan.hij.mode + ':' + room.botPlan.hij.site + ' go=' + (room.botPlan.hij.go ? 1 : 0) : '')); }
    for (const p of room.players.values()) {
      if (!p.isBot || !p.alive || !p.side) continue;
      try { think(room, p, t, dt); } catch (e) { if (!p.bot.err || t - p.bot.err > 5000) { p.bot.err = t; console.error('bot-fejl:', e); } }
    }
  }

  const prepare = room => { if ([...room.players.values()].some(p => p.isBot)) navOf(room); };      // bygger hold-positioner m.m. under indlæsningen
  return { fill, spawn, tick, noise, onKill, remove, prepare };
};
