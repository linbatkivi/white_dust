// ==========================================================================
// BOTS · HJERNE (v26.12): computerstyrede spillere der erstatter manglende spillere (solo / få spillere i rummet).
//   Arkitektur (hver del kan udskiftes):
//     bots/nav.js    vej-søgning (A* på spillets fysik-graf), hold-positioner, plante-sted
//     bots/aim.js    menneskelig sigtekurve: reaktionstid, dæmpet fjeder, rystelse, recoil-kompensation, spredning
//     bots/brain.js  tilstandsmaskine + opfattelse (syn/lyd) + redskaber (granater) + økonomi + holdplaner
//
//   TILSTANDE  buy → (hij) WAIT → ROUTE → STAGEWAIT → EXEC → PLANT → POST  ·  (swat) HOLD(peek) → ROTATE → RETAKE → DEFUSE · SAVE · CLUTCH
//   ENGAGE (kamp) og SEARCH (lyd/sidst-set) overstyrer rutetilstanden midlertidigt.
//
//   v26.14 · SÅ BOTTERNE TÆNKER I STEDET FOR AT FØLGE ÉT MANUSKRIPT
//   • Hver bot har en personlighed (aggression, tålmodighed, dygtighed) og en rolle (entry · support · lurker · carrier / anker · info · roamer).
//   • Rutespredning: hver rute er en A*-sti der straffer de foregående (nav.routes) – holdet fordeles på forskellige veje og kommer fra flere sider.
//   • Holdets fælles viden (K): sete/hørte fjender og døde makkere meldes ('callout') med 0,5–1 s forsinkelse. Varmen pr. site styrer rotationer, site-skift og hvornår der kastes udstyr.
//   • Strategi pr. runde: default · rush · split (aflæs to sites, vælg det svageste) · slow (mid først) · fake. Forsvaret kører 2-2-1, 3-1-1 osv. og skifter position.
//   • Hold-vinkler: bag en sikker vinkel (safeSpot) med skulder-peeks, info-peeks og tilbagetrækning til dækning når man er såret eller underlegen.
//   • Angreb tonser ikke ind: er der fjender på siten kastes først udstyr, holdet venter på hinanden, svinger i trade-par fra forskellige vinkler og rydder vinkler én ad gangen.
//   • Menneskelige svagheder: reaktionstid 0,2–0,4 s, perifert syn kun med sandsynlighed, større spredning og tremor, uheld og tøven – dygtighed 0,35–0,8 i stedet for 0,55–0,95.
//
//   • Opfattelse: syn = synsfelt + sigtelinje (røg blokerer); lyd = skridt/skud/genladning/plant/defuse med usikkerhed (gæt = position + støj)
//   • 'Slice the pie': ved hjørner og døråbninger går botten (shift) og fejer sigtet over den næste gang, med hoved-højde-sigte
//   • Redskaber: røg før et site-push, blænder lige før, HE mod sidst kendte position – koordineret via holdplanens 'go'-tidspunkt
//   • Økonomi: hele holdet køber ens (full / half / eco-save) ud fra gennemsnitspenge og tabsrække
//   • Situationer: 1vX (clutch) med tidsspil og lyd-baserede skud, rotationer via holdets 'intel', fake-pushes (to bots viser sig på det forkerte site)
//   createBots(ctx) -> { fill, spawn, tick, noise, onKill, remove }
// ==========================================================================
const createNav = require('./bots_nav');
const { createAim, wrap } = require('./bots_aim');

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
    // taktik: alternative ruter fra hver spawn til hvert site (+ mid), og en 'trussel' pr. site = hvor angriberne typisk dukker op (bruges til sikre vinkler)
    N.routes = { hij: {}, swat: {} }; N.rot = {}; N.threat = {}; N.safe = new Map(); N.fwd = {};
    for (const k of Object.keys(W.sites)) {
      try { N.routes.hij[k] = nav.routes(W.spawns.hij[0], N.plant[k], 4); N.routes.swat[k] = nav.routes(W.spawns.swat[0], N.plant[k], 3, { keepEnd: 10 }); } catch (e) { N.routes.hij[k] = []; N.routes.swat[k] = []; console.error('bot-ruter:', e.message); }
      const r0 = N.routes.hij[k][0]; N.threat[k] = r0 ? Object.assign({}, r0.via[1]) : { x: N.plant[k].x, z: N.plant[k].z, y: N.plant[k].y };
      N.fwd[k] = nav.holds(N.plant[k], 14, 24, 5, k.charCodeAt(0) * 29);
    }
    try { N.routes.hij.mid = nav.routes(W.spawns.hij[0], N.mid, 3); N.routes.swat.mid = nav.routes(W.spawns.swat[0], N.mid, 2, { keepEnd: 6 }); } catch (e) { N.routes.hij.mid = []; N.routes.swat.mid = []; }
    W._botNav = N; return N;
  }
  const safeFor = (N, h, target, seed) => { const k = Math.round(h.x * 2) + ',' + Math.round(h.z * 2); if (!N.safe.has(k)) N.safe.set(k, N.nav.safeSpot(h, target, seed)); return N.safe.get(k); };

  /* ------------------------------------------------------------------ opret og fyld */
  function spawn(room, side) {
    const p = S.makePlayer(room, null, pick(NAMES) + ' (BOT)');
    p.bot = { skill: rnd(0.35, 0.8), aggr: rnd(0.15, 0.95), pat: rnd(0.2, 0.9), state: 'idle', body: null, path: null, wi: 0, plan: null, target: 0, seen: {}, sus: null, buyDone: -1, utilT: 0, aim: null, think: 0, per: 0 };
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

  /* ------------------------------------------------------------------ holdets fælles viden (callouts) */
  const KS = room => room.botK || (room.botK = { hij: [], swat: [] });
  function callout(room, side, e) {                                     // en bot melder noget til holdet; makkerne kender det efter 0,45–0,95 s
    const L = KS(room)[side], t = now();
    for (const o of L) if (o.id === e.id && o.kind === e.kind && t - o.t < 2500 && hypot(o.x - e.x, o.z - e.z) < 7) { o.x = e.x; o.y = e.y; o.z = e.z; o.t = t; o.conf = Math.max(o.conf, e.conf || 0); return; }
    L.push(Object.assign({ conf: 1, t, avail: t + 450 + Math.random() * 500 }, e)); while (L.length > 40) L.shift();
  }
  const SITE_NAME = (room, x, z) => { const k = nearSite(room, { x, z }); return k ? k : 'mid'; };
  function radio(room, p, text, key, gap) {                              // kort radiobesked til holdet (spamsikret pr. bot og pr. nøgle)
    const b = p.bot, t = now(); b.radioT = b.radioT || {}; if (t - (b.radioT[key] || 0) < (gap || 9000) || t - (b.radioLast || 0) < 1800) return; b.radioT[key] = t; b.radioLast = t;
    try { S.radio && S.radio(room, p, text); } catch (e) {}
  }
  function recent(room, side, win, notBy) {
    const t = now(); return KS(room)[side].filter(e => t - e.t < win && t >= e.avail && e.by !== notBy);
  }
  function siteCenter(room, k) { const s = room.W.sites[k]; return { x: (s.x0 + s.x1) / 2, z: (s.z0 + s.z1) / 2 }; }
  function heat(room, side, k, win) {                                   // hvor meget holdet ved om fjender ved et site (set = 1, makker død = 1,3, hørt = ~0,5)
    const c = siteCenter(room, k), t = now(); let h = 0;
    for (const e of KS(room)[side]) { const age = t - e.t; if (age > win || t < e.avail) continue; if (hypot(e.x - c.x, e.z - c.z) > 22) continue; h += (e.kind === 'see' ? 1 : e.kind === 'death' ? 1.3 : (e.conf || 0.5) * 0.55) * (1 - age / win * 0.6); }
    return h;
  }
  function hottest(room, side, win, from, minD, maxD) {                 // nyeste/stærkeste kendte fjende-position inden for afstandsvinduet
    const t = now(); let best = null, bs = 0;
    for (const e of KS(room)[side]) { const age = t - e.t; if (age > win || t < e.avail || e.kind === 'death') continue; const d = hypot(e.x - from.x, e.z - from.z); if (d < minD || d > maxD) continue; const sc = (e.kind === 'see' ? 1 : e.conf * 0.5) * (1 - age / win); if (sc > bs) { bs = sc; best = e; } }
    return best;
  }

  /* ------------------------------------------------------------------ holdplaner */
  function planRound(room) {
    const N = navOf(room), W = room.W, sites = Object.keys(W.sites), t = now();
    room.botK = { hij: [], swat: [] };
    const bots = [...room.players.values()].filter(p => p.isBot && p.side);
    const hij = bots.filter(p => p.side === 'hij'), swat = bots.filter(p => p.side === 'swat');
    const r = Math.random(), mode = hij.length < 3 ? 'default' : r < 0.12 ? 'rush' : r < 0.30 ? 'split' : r < 0.46 ? 'slow' : r < 0.60 ? 'fake' : 'default';
    const H = { site: pick(sites), mode, go: 0, firstStage: 0, roles: new Map(), t0: t, committed: false, retry: 0, entryN: 0 };
    const plan = room.botPlan = { round: room.round, hij: H, swat: { posts: new Map(), go: 0 }, t0: t };
    if (process.env.WD_BOTGO) H.go = t + 4000;                          // kun til test: udløs redskaber hurtigt
    H.alt = sites.find(k => k !== H.site) || H.site;
    // ---- angribere: roller og forskellige ruter ----
    const carrier = hij.find(p => p.inv.bomb), others = shuffle(hij.filter(p => p !== carrier));
    const order = mode === 'rush' ? ['entry', 'entry', 'support', 'entry', 'support'] : ['entry', 'support', 'entry', 'lurker', 'support'];
    others.forEach((p, i) => H.roles.set(p.id, order[i % order.length])); if (carrier) H.roles.set(carrier.id, 'carrier');
    if (mode === 'fake' && hij.length >= 3) { H.fake = H.alt; H.fakers = new Set(others.filter(p => H.roles.get(p.id) !== 'lurker').slice(0, 2).map(p => p.id)); }
    if (mode === 'split' && hij.length >= 4) { H.splitAt = t + rnd(26000, 38000); H.groupB = new Set(others.slice(-2).map(p => p.id)); }
    const R = N.routes.hij[H.site] || [], RM = N.routes.hij.mid || [];
    let ei = 0;
    for (const p of hij) {
      const b = p.bot, role = H.roles.get(p.id);
      b.state = 'start'; b.path = null; b.target = 0; b.sus = null; b.hold = null; b.util = null; b.utilDone = 0; b.lastKnown = null; b.stage = false; b.body = null; b.buyDone = -1; b.pk = null; b.fall = null; b.aimAt = null; b.freezeUntil = 0; b.staged = 0; b.holdFail = 0; b.holdSite = null; b.rotTo = null; b.routeI = 0; b.entryIdx = 0; b.rtRoute = null; b.goal = null; b.pathKey = '';
      let idx = 0; b.role = role;
      if (role === 'entry') { b.entryIdx = ei++; idx = b.entryIdx % Math.max(1, R.length); }
      else if (role === 'support') idx = Math.min(R.length - 1, 0);
      else if (role === 'lurker') idx = R.length > 2 ? R.length - 1 : Math.min(1, R.length - 1);
      else idx = (R.length > 1 && Math.random() < 0.35) ? 1 : 0;
      if (H.groupB && H.groupB.has(p.id)) idx = Math.min(1, (N.routes.hij[H.alt] || []).length - 1);
      const rr = (H.groupB && H.groupB.has(p.id) ? N.routes.hij[H.alt] : mode === 'fake' && H.fakers && H.fakers.has(p.id) ? N.routes.hij[H.fake] : R) || [];
      let via = rr.length ? rr[Math.max(0, Math.min(rr.length - 1, idx))].via : [];
      if (mode === 'slow' && RM.length && role !== 'carrier') via = RM[Math.min(RM.length - 1, b.entryIdx % RM.length)].via.slice(0, 1).concat(via.slice(1));        // langsomt: først kontrol af midten
      b.route = via.map(v => Object.assign({}, v));
      b.depart = t + (role === 'lurker' ? rnd(3500, 8000) : role === 'carrier' ? rnd(500, 2200) : role === 'support' ? rnd(300, 1800) : rnd(0, 900)) + rnd(0, 600);
      b.walkAll = Math.random() < 0.18 * (1 - b.aggr + 0.4);            // nogle sniger hele vejen
    }
    // ---- forsvarere: opstilling (2-2-1, 3-1-1, 1-3-1 …), roller og vinkler ----
    const slots = [];
    for (const k of sites) slots.push({ site: k, style: 'passive' });
    const extra = []; for (let i = 0; i < Math.max(0, swat.length - sites.length); i++) extra.push(i === 0 && Math.random() < 0.6 ? { site: 'mid', style: 'info' } : { site: pick(sites), style: Math.random() < 0.5 ? 'info' : 'passive' });
    if (Math.random() < 0.3 && extra.length > 1) { const k = pick(sites); extra[1] = { site: k, style: 'passive' }; extra[0] = { site: k, style: 'passive' }; }      // stak et site
    slots.push(...extra);
    const bySpawn = shuffle(swat); bySpawn.forEach((p, i) => { const sl = slots[i % slots.length]; plan.swat.posts.set(p.id, Object.assign({}, sl)); });
    for (const p of swat) {
      const b = p.bot; b.state = 'start'; b.path = null; b.target = 0; b.sus = null; b.hold = null; b.util = null; b.utilDone = 0; b.lastKnown = null; b.stage = false; b.body = null; b.buyDone = -1; b.pk = null; b.fall = null; b.aimAt = null; b.freezeUntil = 0; b.holdFail = 0; b.rotTo = null; b.routeI = 0; b.rtRoute = null; b.holdKey = null; b.holdShift = 0; b.goal = null; b.pathKey = ''; b.route = null;
      const post = plan.swat.posts.get(p.id); b.role = post.style === 'info' ? 'info' : 'anchor'; b.depart = t + rnd(0, 1800);
      const rr = N.routes.swat[post.site] || []; if (rr.length) b.route = rr[(p.id + (post.style === 'info' ? 1 : 0)) % rr.length].via.map(v => Object.assign({}, v)).slice(0, 1);
      b.infoUntil = t + rnd(18000, 34000);
    }
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
      if (room.botPlan && conf > 0.42 && kind !== 'boom' && Math.random() < 0.6) callout(room, p.side, { id: -1, kind: 'hear', x: b.sus.x, y: b.sus.y, z: b.sus.z, conf, by: p.id });      // 'jeg hørte noget ved …' – hele holdet får det (usikkert)
      if (!was || was.conf < conf) b.walkUntil = now() + 2500 + conf * 2000;      // lytter og sniger (shift) – minimerer egen støj
    }
  }
  function onKill(room, victim, killer) {                               // makker dræbt: 'trade' – nærmeste makker kigger/skubber mod morderen; intel til holdet
    if (!killer || !victim.side) return;
    callout(room, victim.side, { id: killer.id, kind: 'death', x: killer.x, y: killer.y, z: killer.z, conf: 1, by: victim.id });      // makker faldt – morderen stod dér
    callout(room, victim.side, { id: killer.id, kind: 'see', x: killer.x, y: killer.y, z: killer.z, conf: 1, by: victim.id });
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
      if (b.job.run(left)) { const res = b.job.result; b.job = null; b.jobAge = 0; b.path = res || []; b.wi = 0; b.stuck = 0; b.lastProg = 1e9; if (!(res && res.length) && b.goal && hypot(p.x - b.goal.x, p.z - b.goal.z) > 3) b.holdFail = (b.holdFail || 0) + 1; }
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
        if (!b.target) {                                                // menneskeligt syn: kun midten af synsfeltet ses sikkert; periferi og afstand giver chance for at overse
          const dx = q.x - p.x, dz = q.z - p.z, off = Math.abs(wrap(Math.atan2(-dx, -dz) - b.aim.yaw));
          const chance = (off < 0.55 ? 1 : off < 0.95 ? 0.5 : 0.3) * Math.max(0.45, Math.min(1, 1.3 - d / 50)) * (q.speed < 1.5 ? 0.75 : 1) * (0.7 + b.skill * 0.4);
          if (Math.random() > chance) continue;
        }
        if (d < bestD) { bestD = d; bestT = { q, ty, d }; }
      }
      if (bestT) {
        const first = b.target !== bestT.q.id;
        b.contactT = t; b.target = bestT.q.id; b.tgtT = t; b.tgtInfo = bestT; b.lastKnown = { x: bestT.q.x, y: bestT.q.y, z: bestT.q.z, t };
        if (first) { b.aim.since = t; b.aimHead = Math.random() < Math.max(0.06, Math.min(0.5, 0.15 + b.skill * 0.3 - bestT.d / 90)); b.aim.react = Math.max(b.aim.react, t + 190 + (1 - b.skill) * 170 + Math.random() * 90); b.firstAt = b.aim.react; }
        if (room.botPlan && (!b.lastCall || t - b.lastCall > 1100)) { b.lastCall = t; callout(room, side, { id: bestT.q.id, kind: 'see', x: bestT.q.x, y: bestT.q.y, z: bestT.q.z, conf: 1, by: p.id }); const sn = SITE_NAME(room, bestT.q.x, bestT.q.z); radio(room, p, 'Contact ' + (sn === 'mid' ? 'mid' : sn), 'c' + sn, 10000); try { S.ping && S.ping(room, p, bestT.q); } catch (e) {} }
      } else if (b.target && t - b.tgtT > 450) b.target = 0;           // mistede målet: gå til SEARCH
    }
    const tq = b.target ? room.players.get(b.target) : null;
    const engaged = !!(tq && tq.alive && t - b.tgtT < 450);
    if (!engaged) b.target = 0;

    /* ---------- beslutning midt i kampen: trække sig tilbage til dækning? ---------- */
    if (engaged && !b.fall && t > (b.fallCool || 0) && b.state !== 'plant' && b.state !== 'defuse') {
      b.fallCool = t + 2600 + Math.random() * 1500;
      const dd = b.tgtInfo.d, hurt = p.hp < 52, lowAmmo = p.ammo[p.cur] && p.ammo[p.cur].mag <= 3;
      if ((hurt || lowAmmo) && dd > 5 && Math.random() < 0.3 + (1 - b.aggr) * 0.5 + (p.hp < 30 ? 0.2 : 0)) {
        const c = N.nav.cover(p, { x: tq.x, y: tq.y, z: tq.z }, 9);
        if (c) { b.fall = { until: t + 1500 + Math.random() * 1600, goal: c }; b.pathKey = ''; b.path = null; if (hurt) radio(room, p, 'Need backup', 'help', 14000); }
      }
    }
    /* ---------- aim-mål ---------- */
    let walk = !!(b.walkUntil && t < b.walkUntil), crouch = false, halt = false;
    if (engaged) {
      const w = WD.WEAPONS[p.cur] || {}, ty = b.tgtInfo.ty, aimY = (b.aimHead && w.id !== 'awp') ? tq.y + (tq.crouch ? 1.12 : 1.55) : tq.y + (tq.crouch ? 0.8 : 1.15);
      const lead = 0.06, tx = tq.x + (tq.vx || 0) * lead, dx = tx - p.x, dz = tq.z - p.z, dy = aimY - eyeY(p), hd = hypot(dx, dz);
      b.aim.setWant(Math.atan2(-dx, -dz), Math.atan2(dy, hd), t, false);
    } else {
      let ay = b.aim.yaw, ap = 0;
      if (b.aimAt && t < b.aimAt.until) { const dx = b.aimAt.x - p.x, dz = b.aimAt.z - p.z; ay = Math.atan2(-dx, -dz); ap = Math.max(-0.4, Math.min(0.4, Math.atan2(b.aimAt.y + 1.5 - eyeY(p), hypot(dx, dz)))); }      // sigt mod et meldt/hørt sted (pre-aim)
      else if (b.clear && b.scanAt && t < b.scanAt.until) { const dx = b.scanAt.x - p.x, dz = b.scanAt.z - p.z; ay = Math.atan2(-dx, -dz); ap = Math.max(-0.3, Math.min(0.3, Math.atan2(b.scanAt.y + 1.5 - eyeY(p), hypot(dx, dz)))); }   // rydder vinkler ét ad gangen
      else if (b.sus && t - b.sus.t < 5000) { ay = Math.atan2(-(b.sus.x - p.x), -(b.sus.z - p.z)); ap = 0; }                     // sigt mod lyden
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
      reactK(room, p, t);
      if (side === 'hij') thinkHij(room, p, t, N, H, planted, timeLeft);
      else thinkSwat(room, p, t, N, plan, planted, timeLeft);
      if (b.fall) { if (t < b.fall.until) { b.state = 'fall'; b.goal = b.fall.goal; b.goalR = 0.8; } else b.fall = null; }
      if (!engaged && !['plant', 'defuse', 'retake', 'save', 'route'].includes(b.state) && !p.inv.bomb && !(planted && side === 'hij')) {                // SEARCH (sidst set) og INVESTIGATE (lyd) – bots står ikke stille mens der sker noget
        const lk = b.lastKnown, su = b.sus;
        if (lk && t - lk.t < 6000 && lk.t > (b.searchDone || 0)) {
          const mates = [...room.players.values()].filter(q => q !== p && q.alive && q.side === side && hypot(q.x - p.x, q.z - p.z) < 16).length;
          if (hypot(p.x - lk.x, p.z - lk.z) < 3) b.searchDone = t;
          else if (mates < 1 && b.aggr < 0.7 && Math.random() < 0.7) { b.searchDone = t; b.aimAt = { x: lk.x, y: lk.y, z: lk.z, until: t + rnd(1500, 3000) }; b.freezeUntil = t + rnd(900, 2000); b.walkUntil = t + 3000; }      // alene mod en kendt fjende: bliv, sigt og vent på makkere
          else { b.state = 'search'; b.goal = { x: lk.x, y: lk.y, z: lk.z }; b.goalR = 2.4; b.walkUntil = t + 600; }
        } else if (su && t - su.t < 3500 && su.conf > 0.42 && su.t > (b.invDone || 0) && hypot(p.x - su.x, p.z - su.z) < (side === 'swat' ? 17 : 24)) {
          if (hypot(p.x - su.x, p.z - su.z) < 4) b.invDone = t; else { b.state = 'investigate'; b.goal = { x: su.x, y: su.y, z: su.z }; b.goalR = 3; b.walkUntil = t + 600; }
        }
      }
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
    else if (b.fall && t < b.fall.until) { walk = false; }                                                              // tilbagetrækning: løb mod dækning (sigtet bliver på fjenden)
    else if (!engaged && t < (b.freezeUntil || 0)) { halt = true; crouch = !!b.holdCrouch; }                             // 'stop – lyt – sigt'
    else if (!engaged && b.clear && b.bound) { const ph = (t + p.id * 311) % 2600; if (ph > 2000) halt = true; else if (ph > 1400) walk = true; }   // bevæger sig i spring: gå – stop – kig – gå
    else if (engaged) {                                                  // kamp: langt væk → stå stille/hug for præcision, mellem → stop-og-gå, tæt på → strafe
      const d = b.tgtInfo.d;
      if (d > 14) { halt = true; crouch = d > 28 && p.cur !== 'awp'; }
      else if (d > 6) { halt = (t % 700) < 420; }
      else { b.strafeT = b.strafeT || 0; if (t > b.strafeT) { b.strafeT = t + 250 + Math.random() * 450; b.strafe = Math.random() < 0.5 ? -1 : 1; } }
    } else if (b.state === 'hold' && atGoal) { halt = true; crouch = !!b.holdCrouch; }
    else if (b.state === 'peekwait' && atGoal) { halt = true; crouch = !!b.holdCrouch; }
    else if (b.state === 'stagewait' || b.state === 'wait') halt = true;
    if (engaged && !halt && b.strafe && b.tgtInfo.d <= 6 && !b.fall) {              // strafe sidelæns mens der skydes
      const l = { fx: 0, sx: b.strafe, yaw: b.aim.yaw, walk: false, crouch: false };
      WD.stepBody(W, body, l, dt);
    } else steer(room, p, dt, { halt, crouch, walk });
    syncToPlayer(room, p, t, dt);
  }

  /* ------------------------------------------------------------------ fælles adfærd: reaktion på meldinger, hold-vinkler med peeks, vinkelrydning */
  function reactK(room, p, t) {                                         // et menneske hører 'fjende dér' og sigter derhen, stopper op – eller skubber med makker
    const b = p.bot; if (b.target || b.state === 'plant' || b.state === 'defuse') return;
    let e = null, bd = 1e9;
    for (const x of recent(room, p.side, 5000, p.id)) { if (x.kind === 'hear' || x.t <= (b.kSeen || 0)) continue; const d = hypot(x.x - p.x, x.z - p.z); if (d < 36 && d < bd) { bd = d; e = x; } }
    if (!e) return; b.kSeen = e.t;
    b.aimAt = { x: e.x, y: e.y, z: e.z, until: t + rnd(1400, 2800) };
    if (b.pk && b.pk.ph === 'wait') b.pk.until = Math.min(b.pk.until, t + rnd(500, 1600));            // hold-bot: kig ud hurtigere
    if (b.role === 'carrier' || b.role === 'lurker') { b.freezeUntil = t + rnd(500, 1200); return; }
    const pusher = p.side === 'hij' ? (b.role === 'entry' || b.role === 'support') : b.role === 'info';
    if (pusher && bd < 24 && b.aggr > 0.5) { b.sus = { x: e.x, y: e.y, z: e.z, t, conf: 0.85, kind: 'trade' }; b.trade = t + 3000; }
    else { b.freezeUntil = t + rnd(700, 1800); b.walkUntil = t + 2600; }
  }
  function scanClear(room, p, t, N, siteK) {                            // ryd vinkler: sigt mod de steder forsvarere typisk står, ét ad gangen
    const b = p.bot; if (t < (b.scanT || 0)) return; b.scanT = t + 450 + Math.random() * 450;
    const list = (N.holds[siteK] || []).concat(N.fwd[siteK] || []); if (!list.length) { b.scanAt = null; return; }
    const wp = b.path && b.wi < b.path.length ? b.path[Math.min(b.path.length - 1, b.wi + 2)] : null, heading = wp ? Math.atan2(-(wp.x - p.x), -(wp.z - p.z)) : b.aim.yaw;
    const c = list.filter(h => { const d = hypot(h.x - p.x, h.z - p.z); return d > 4 && d < 34 && Math.abs(wrap(Math.atan2(-(h.x - p.x), -(h.z - p.z)) - heading)) < 1.2 && N.nav.losAt(p.x, p.y, p.z, h.x, h.y, h.z); });
    if (!c.length) { b.scanAt = null; return; }
    c.sort((a, d) => Math.abs(wrap(Math.atan2(-(a.x - p.x), -(a.z - p.z)) - heading)) - Math.abs(wrap(Math.atan2(-(d.x - p.x), -(d.z - p.z)) - heading)));
    const h = c[(Math.random() * Math.min(3, c.length)) | 0]; b.scanAt = { x: h.x, y: h.y, z: h.z, until: t + 650 + Math.random() * 450 };
  }
  function pickHold(p, N, list, tgt, threat, shift) {                   // vælg en holdeposition + en sikker vinkel bagved til skulder-peeks
    const b = p.bot, h = list[(p.id * 5 + shift * 3 + (b.holdFail || 0)) % list.length];
    const safe = threat ? safeFor(N, h, threat, p.id * 3 + shift) : null;
    const look = threat && N.nav.losAt(h.x, h.y, h.z, threat.x, threat.y, threat.z) ? threat : tgt;
    b.hold = { x: h.x, y: h.y, z: h.z, yaw: Math.atan2(-(look.x - h.x), -(look.z - h.z)), safe: safe ? { x: safe.x, y: safe.y, z: safe.z } : null };
    b.holdCrouch = Math.random() < 0.4; b.pk = null; b.holdFail = 0; b.holdSince = 0; b.goal = h; b.goalR = 0.8; b.path = null; b.pathKey = '';
  }
  function holdBehaviour(room, p, t, N) {                               // bag den sikre vinkel → ud (skulder-peek) → kig → tilbage; hyppigere når det larmer
    const b = p.bot, h = b.hold; if (!h) return;
    if (!h.safe) { b.goal = h; b.goalR = 0.8; b.state = hypot(p.x - h.x, p.z - h.z) < 1.4 ? 'hold' : 'moving'; return; }
    const pk = b.pk || (b.pk = { ph: 'wait', until: t + rnd(3500, 9000) * (1.5 - b.aggr * 0.7), n: 0 });
    const dS = hypot(p.x - h.safe.x, p.z - h.safe.z), dH = hypot(p.x - h.x, p.z - h.z);
    if (pk.ph === 'wait') {
      b.goal = h.safe; b.goalR = 0.45; b.state = dS < 1.0 ? 'peekwait' : 'moving';
      if (dS < 1.3 && t >= pk.until) { pk.ph = 'out'; pk.until = t + 1500; }
    } else if (pk.ph === 'out') {
      b.goal = h; b.goalR = 0.4; b.walkUntil = t + 400; b.state = 'moving';
      if (dH < 0.8 || t > pk.until) { pk.ph = 'look'; pk.until = t + rnd(380, 950) * (0.7 + b.pat * 0.7); }
    } else if (pk.ph === 'look') {
      b.goal = h; b.goalR = 0.4; b.state = dH < 1.2 ? 'peekwait' : 'moving';
      if (t >= pk.until) { pk.ph = 'back'; pk.until = t + 1700; pk.n++; }
    } else {
      b.goal = h.safe; b.goalR = 0.45; b.walkUntil = t + 400; b.state = 'moving';
      if (dS < 0.9 || t > pk.until) { pk.ph = 'wait'; pk.until = t + rnd(4500, 12000) * (1.5 - b.aggr * 0.7); }
    }
    if (pk.n >= 3 + (p.id % 3)) { pk.n = 0; b.holdShift = (b.holdShift || 0) + 1; b.holdKey = null; b.hold = null; }       // efter nogle peeks: skift position
  }

  /* ---------- hijackere ---------- */
  function stagedStats(room, H) {
    let M = 0, S = 0;
    for (const q of room.players.values()) if (q.isBot && q.alive && q.side === 'hij') { const r = q.bot.role; if (r === 'lurker' || (H.fakers && H.fakers.has(q.id)) || (H.groupB && H.groupB.has(q.id) && !H.committed)) continue; M++; if (q.bot.staged) S++; }
    return { M, S };
  }
  function switchSite(room, H, N, site, t) {                            // hele holdet skifter site: nyt stage-punkt, ny hold-liste
    H.alt = H.site === site ? H.alt : H.site; H.site = site; H.switched = true; H.go = 0; H.firstStage = 0; H.committed = true;
    const R = N.routes.hij[site] || [];
    for (const q of room.players.values()) if (q.isBot && q.alive && q.side === 'hij') {
      const b = q.bot; b.hold = null; b.holdSite = null; b.staged = 0; b.path = null; b.pathKey = ''; b.pk = null;
      const r = R.length ? R[(q.id + (b.entryIdx || 0)) % R.length] : null; b.route = r ? [Object.assign({}, r.via[1])] : []; b.routeI = 0; b.depart = 0;
    }
  }
  function siteDecide(room, H, N, t) {
    if (H.decT === t) return; H.decT = t; const sites = Object.keys(room.W.sites); if (sites.length < 2 || H.go) return;
    if (H.mode === 'split' && !H.committed && H.splitAt && t >= H.splitAt) {                // aflæst begge sites → gå på det med mindst modstand
      const hA = heat(room, 'hij', H.site, 24000), hB = heat(room, 'hij', H.alt, 24000);
      if (hB + 0.2 < hA) switchSite(room, H, N, H.alt, t); else { H.committed = true; for (const q of room.players.values()) if (q.isBot && q.side === 'hij' && H.groupB && H.groupB.has(q.id)) { q.bot.hold = null; q.bot.staged = 0; const r = (N.routes.hij[H.site] || [])[0]; q.bot.route = r ? [Object.assign({}, r.via[1])] : []; q.bot.routeI = 0; } }
    }
    if (H.switchTrait === undefined) H.switchTrait = Math.random() < 0.6;
    if (H.switchTrait && !H.switched && H.mode !== 'fake' && t - H.t0 > 9000) {                 // for stærk modstand: læs det og skift
      if (heat(room, 'hij', H.site, 18000) >= 2.4 && heat(room, 'hij', H.alt, 18000) < 0.9) switchSite(room, H, N, H.alt, t);
    }
  }
  function thinkHij(room, p, t, N, H, planted, timeLeft) {
    const b = p.bot, W = room.W, bomb = room.bomb, carrier = p.inv.bomb, role = b.role || (carrier ? 'carrier' : 'entry');
    b.use = false; b.clear = false; b.bound = false;
    if (planted) return postPlant(room, p, t, N, timeLeft);
    // tabt bombe: nærmeste levende hijacker henter den (ellers planter ingen)
    if (bomb.state === 1 && !carrier) {
      let best = null, bd = 1e9; for (const q of room.players.values()) if (q.isBot && q.alive && q.side === 'hij') { const d = hypot(q.x - bomb.x, q.z - bomb.z); if (d < bd) { bd = d; best = q; } }
      const humanNear = [...room.players.values()].some(q => !q.isBot && q.alive && q.side === 'hij' && hypot(q.x - bomb.x, q.z - bomb.z) < bd - 3);
      if (best === p && !humanNear) { b.state = 'exec'; b.goal = { x: bomb.x, y: bomb.y, z: bomb.z }; b.goalR = 0.6; return; }
    }
    siteDecide(room, H, N, t);
    const isFaker = !!(H.fakers && H.fakers.has(p.id)), inB = !!(H.groupB && H.groupB.has(p.id) && !H.committed);
    const siteK = isFaker ? H.fake : inB ? H.alt : H.site, plant = N.plant[siteK];
    const late = room.phaseEnd - t < 42000;
    if (!H.go && late) H.go = t + 300;                                  // sidste udvej: tiden løber ud
    if (t < (b.depart || 0)) { b.state = 'wait'; b.goal = null; return; }
    /* 1) forskellige veje: følg via-punkterne; sidste punkt = klar-position */
    if (b.route && b.routeI < b.route.length) {
      const v = b.route[b.routeI]; b.state = 'route'; b.goal = v; b.goalR = 3.4;
      if ((hypot(p.x - v.x, p.z - v.z) < 4.4 && Math.abs(p.y - v.y) < 3) || (b.holdFail || 0) > 1) { b.routeI++; b.holdFail = 0; }
      if (b.routeI < b.route.length) {
        if (b.walkAll) b.walkUntil = t + 700;
        if (!isFaker && H.mode !== 'rush' && b.routeI >= 1 && hypot(p.x - plant.x, p.z - plant.z) < 62) { b.clear = true; b.bound = true; scanClear(room, p, t, N, siteK); }      // på vej ind i fjendeland: spring og ryd vinkler
        if (!isFaker) utilityReactive(room, p, t); return;
      }
    }
    if (!b.staged) { b.staged = t; if (!H.firstStage) H.firstStage = t; }
    /* 2) klar-position: vent på holdet (ingen enkelt-spiller stormer ind alene) */
    if (!isFaker && !inB) {
      if (!H.go) {
        const { M, S } = stagedStats(room, H), need = H.mode === 'rush' ? Math.min(3, M) : Math.max(1, Math.ceil(M * 0.7));
        if (S >= need && t - H.firstStage > (H.mode === 'rush' ? 0 : H.waitFor || (H.waitFor = rnd(2500, 6500)))) { H.go = t + (H.mode === 'rush' ? rnd(0, 700) : rnd(1400, 3600)) + (H.mode === 'slow' ? rnd(6000, 11000) : 0); radio(room, p, (H.mode === 'rush' ? 'Rush ' : 'Go ') + siteK, 'go', 25000); }
      }
      const rel = H.go ? H.go + (role === 'entry' ? b.entryIdx * 650 : role === 'support' ? 1500 + (p.id % 4) * 150 : role === 'carrier' ? 3000 : role === 'lurker' ? 9000 + (p.id % 5) * 800 : 0) : 0;
      if (!H.go || t < rel) {
        b.state = 'stagewait'; b.goal = null; b.holdCrouch = role !== 'entry' && (p.id % 2 === 0);
        if (!b.aimAt || t > b.aimAt.until) b.aimAt = { x: plant.x, y: plant.y, z: plant.z, until: t + 1200 };
        if (H.go) utilityExec(room, p, t, N, H, siteK);
        return;
      }
      /* 3) tænk før man går ind: er der fjender på siten kastes udstyr først – og er det for varmt, trækker holdet vejret og venter */
      const hs = heat(room, 'hij', siteK, 14000);
      if (hs >= 1.1 && !b.heatUtil && utilityIntel(room, p, t, N)) { b.heatUtil = 1; b.freezeUntil = t + 1100; b.state = 'stagewait'; return; }
      if (hs >= 2.5 && (H.retry || 0) < 2 && !late) { H.retry = (H.retry || 0) + 1; H.go = t + rnd(5500, 9000); b.heatUtil = 0; b.state = 'stagewait'; b.goal = null; return; }
      if (carrier) {                                                    // bombebæreren planter først når siten er ryddet
        const near = recent(room, 'hij', 3500).some(e => e.kind !== 'hear' && hypot(e.x - plant.x, e.z - plant.z) < 14);
        if (near && !late && t < rel + 14000) { b.state = 'stagewait'; b.goal = null; return; }
        b.goal = plant; b.goalR = 0.5; b.state = 'exec'; b.clear = true; b.bound = hs > 0.6; scanClear(room, p, t, N, siteK);
        const d = hypot(p.x - plant.x, p.z - plant.z);
        if (d < 1.2 && WD.plantSpot(W, p.x, p.y, p.z)) { b.state = 'plant'; b.use = true; }
        utilityExec(room, p, t, N, H, siteK); return;
      }
    }
    if (carrier && (isFaker || inB)) { b.state = 'stagewait'; b.goal = null; return; }
    /* 4) udfør: ind på siten på en holdeposition med sigtelinje til bomben */
    if (!b.hold || b.holdSite !== siteK || (b.holdFail || 0) > 1) {
      const hs2 = N.holds[siteK] || []; b.holdSite = siteK;
      if (hs2.length) pickHold(p, N, hs2.map((h, i) => hs2[(i + (b.entryIdx || 0) * (hs2.length >> 1)) % hs2.length]), plant, null, 0); else { b.hold = { x: plant.x, y: plant.y, z: plant.z, yaw: 0, safe: null }; b.goal = plant; b.goalR = 0.8; }
    }
    const dd = hypot(p.x - b.hold.x, p.z - b.hold.z), dp = hypot(p.x - plant.x, p.z - plant.z);
    b.state = dd < 1.5 ? 'hold' : 'exec';
    if (b.state === 'exec') { b.goal = b.hold; b.goalR = 0.8; b.clear = dp < 30; b.bound = !isFaker && (heat(room, 'hij', siteK, 14000) > 0.5 || b.aggr < 0.35); if (b.clear) scanClear(room, p, t, N, siteK); }
    if (isFaker) {                                                      // fake: vis dig, larm, og rotér efter ~14 s til hovedsiten
      if (dd < 3 && !b.fakeAt) b.fakeAt = t;
      if (b.fakeAt && t - b.fakeAt > 14000) { H.fakers.delete(p.id); b.holdSite = null; b.hold = null; b.fakeAt = 0; b.staged = 0; const r = (N.routes.hij[H.site] || [])[0]; b.route = r ? [Object.assign({}, r.via[1])] : []; b.routeI = 0; }
      if (dd < 8) { b.walkUntil = 0; if (!b.fakeN) { b.fakeN = 1; noise(room, p, 'shot', { x: p.x, y: p.y, z: p.z }); } }
    } else if (b.state === 'hold' && t - (b.holdSince = b.holdSince || t) > 9000 + p.id * 700) { b.holdSince = 0; b.holdFail = 2; }      // skift vinkel i stedet for at stå stille
    utilityExec(room, p, t, N, H, siteK);
  }
  function postPlant(room, p, t, N, timeLeft) {                         // POST: hold vinkler med sigtelinje til bomben – bag en sikker vinkel, med peeks
    const b = p.bot, bomb = room.bomb;
    if (b.postRound !== room.round || !b.hold || b.holdKey !== 'post') {
      b.postRound = room.round; const hs = N.nav.holds({ x: bomb.x, z: bomb.z, y: bomb.y }, 4, 14, 5, p.id * 13); const sk = nearSite(room, bomb) || Object.keys(room.W.sites)[0];
      const rr = N.routes.swat[sk] || [], thr = rr.length ? rr[p.id % rr.length].via[1] : null;
      if (hs.length) pickHold(p, N, hs, { x: bomb.x, y: bomb.y, z: bomb.z }, thr, 0); else b.hold = { x: bomb.x, y: bomb.y, z: bomb.z, yaw: 0, safe: null };
      b.holdKey = 'post';
    }
    b.postPlant = true; b.clear = false;
    if (b.clutch && timeLeft > 8) b.walkUntil = t + 600;
    utilityReactive(room, p, t);
    holdBehaviour(room, p, t, N);
  }
  function markStage() {}

  /* ---------- SWAT ---------- */
  function heatAt(room, side, x, z, r, win) { const t = now(); let h = 0; for (const e of KS(room)[side]) { const age = t - e.t; if (age > win || t < e.avail || hypot(e.x - x, e.z - z) > r) continue; h += (e.kind === 'see' ? 1 : e.kind === 'death' ? 1.3 : (e.conf || 0.5) * 0.55) * (1 - age / win * 0.6); } return h; }
  function swatRotate(room, p, t, N, plan, post) {                      // hver bot vurderer selv – kun den nærmeste forlader siten, og et anker bliver altid
    const b = p.bot, sites = Object.keys(room.W.sites); if (sites.length < 2 || t < (b.rotChk || 0)) return; b.rotChk = t + 700;
    const mine = post.site;
    const mates = [...room.players.values()].filter(q => q.isBot && q.alive && q.side === 'swat' && q !== p && (plan.swat.posts.get(q.id) || {}).site === mine).length;
    let target = null;
    if (mine === 'mid') { let hb = 0; for (const k of sites) { const h = heat(room, 'swat', k, 16000); if (h > hb) { hb = h; target = k; } } if (hb < 1.0) target = null; if (target && b.contactT && t - b.contactT < 6000 && heatAt(room, 'swat', N.mid.x, N.mid.z, 18, 12000) > 1.6) target = null; }
    else {
      const hm = heat(room, 'swat', mine, 16000);
      for (const k of sites) if (k !== mine) {
        const hk = heat(room, 'swat', k, 16000);
        if (hk >= 1.7 && hm < 0.7 && (mates >= 1 || hk >= 3.2)) {
          const pk = N.plant[k]; let nearest = true, md = hypot(p.x - pk.x, p.z - pk.z);
          for (const q of room.players.values()) if (q.isBot && q.alive && q.side === 'swat' && q !== p && (plan.swat.posts.get(q.id) || {}).site === mine && hypot(q.x - pk.x, q.z - pk.z) < md - 0.5) nearest = false;
          if (nearest) target = k;
        }
      }
    }
    if (!target) return;
    if (b.rotPending && b.rotPending.k === target) { if (t >= b.rotPending.at) { post.site = target; post.style = 'passive'; b.rotPending = null; b.holdKey = null; b.hold = null; b.rotated = (b.rotated || 0) + 1; b.rotDone = t;
      const key = mine + '>' + target; if (!N.rot[key]) { try { N.rot[key] = N.nav.routes(N.plant[mine] || N.mid, N.plant[target], 2, { keepEnd: 12, keepStart: 6 }); } catch (e) { N.rot[key] = []; } }
      const rr = N.rot[key]; b.route = rr.length ? [Object.assign({}, rr[(p.id + b.rotated) % rr.length].via[0])] : null; b.routeI = 0; } }
    else if (!b.rotPending && t - (b.rotDone || 0) > 8000) { b.rotPending = { k: target, at: t + rnd(800, 2600) * (1.3 - b.aggr * 0.5) }; radio(room, p, 'Rotating ' + target, 'rot', 12000); }
  }
  function thinkSwat(room, p, t, N, plan, planted, timeLeft) {
    const b = p.bot, W = room.W, bomb = room.bomb, sites = Object.keys(W.sites), post = plan.swat.posts.get(p.id) || { site: 'mid', style: 'info' };
    b.use = false; b.clear = false;
    if (planted) {                                                      // RETAKE
      const bp = { x: bomb.x, y: bomb.y, z: bomb.z }, d = hypot(p.x - bp.x, p.z - bp.z);
      const defuser = bomb.defuser === p.id;
      const est = d / 5.2 + (p.inv.kit ? 5 : 10);
      if (!defuser && est > timeLeft + 2 && b.state !== 'retake' && !b.clutch) { b.state = 'save'; b.goal = W.spawns.swat[0]; b.goalR = 3; return; }
      if (b.rtRound !== room.round) {                                   // hver bot vælger sin egen vej til bomben (crossfire fra flere sider)
        b.rtRound = room.round; const sk = nearSite(room, bp) || sites[0], R = N.routes.swat[sk] || []; radio(room, p, 'Retake ' + sk, 'rt', 30000);
        const Rq = R.filter(r => r.len <= R[0].len * 1.4);                  // tidskritisk: kun veje der ikke er alt for lange
        b.route = Rq.length ? Rq[(p.id + (b.role === 'info' ? 1 : 0) + (b.holdShift || 0)) % Rq.length].via.map(v => Object.assign({}, v)) : null; b.routeI = 0; b.rstaged = 0; b.pk = null;
      }
      if (b.route && b.routeI < b.route.length && d > 22) {
        const v = b.route[b.routeI]; b.state = 'route'; b.goal = v; b.goalR = 3.4;
        if ((hypot(p.x - v.x, p.z - v.z) < 4.4 && Math.abs(p.y - v.y) < 3) || (b.holdFail || 0) > 1) { b.routeI++; b.holdFail = 0; }
        if (b.routeI < b.route.length) return;
      }
      if (!b.rstaged) { b.rstaged = t; if (!plan.swat.rgo) plan.swat.rgo = t + 2500 + Math.random() * 2200; }      // første der er klar sætter holdets go-tid
      const rgo = plan.swat.rgo || 0;
      if (d > 14 && rgo && t < rgo && timeLeft > 16) { b.state = 'stagewait'; b.goal = null; utilityRetake(room, p, t, N, bp); return; }
      if (b.clutch && d > 10 && !b.sus) { b.state = 'stagewait'; b.walkUntil = t + 1000; if (t - (plan.swat.cl || 0) > 4000) plan.swat.cl = t; if (timeLeft < 14) { b.state = 'retake'; } else return; }   // clutch: tid, lyt, gå frem når der er lyst
      b.state = 'retake'; b.goal = bp; b.goalR = defuser ? 1.2 : 2.6; b.clear = d < 30; b.bound = d < 24 && !defuser && timeLeft > 27 && b.aggr < 0.75; if (b.clear) scanClear(room, p, t, N, nearSite(room, bp) || sites[0]);
      const eng = !!b.target;
      if (d < 2.0 && !eng && (!b.sus || t - b.sus.t > 2500 || b.sus.conf < 0.3)) { b.state = 'defuse'; b.use = true; }
      else if (d < 5.5 && !eng && !b.nearBomb) b.nearBomb = t;
      if (b.state === 'defuse' && b.clutch && Math.random() < 0.02) { b.use = false; }          // fake-defuse: afbryd og lad fjenden vise sig
      return;
    }
    if (t < (b.depart || 0)) { b.state = 'wait'; b.goal = null; return; }
    if (b.route && b.routeI < b.route.length) {                         // vej til posten (forskellige veje pr. bot)
      const v = b.route[b.routeI]; b.state = 'route'; b.goal = v; b.goalR = 3.4;
      if ((hypot(p.x - v.x, p.z - v.z) < 4.4 && Math.abs(p.y - v.y) < 3) || (b.holdFail || 0) > 1) { b.routeI++; b.holdFail = 0; }
      if (b.routeI < b.route.length) return;
    }
    swatRotate(room, p, t, N, plan, post);
    let site = post.site, style = post.style;
    if (style === 'info' && (t > b.infoUntil || (b.contactT && t - b.contactT < 5000))) { style = 'passive'; if (site === 'mid') site = b.fallbackSite || (b.fallbackSite = pick(sites)); }      // info-bot trækker sig tilbage efter kontakt/tid
    const sh = b.holdShift || 0, key = site + style + ':' + sh;
    if (!b.hold || b.holdKey !== key || (b.holdFail || 0) > 1) {
      let list, tgt, threat;
      if (site === 'mid') { const k = sh % 4; tgt = N.mid; list = N.nav.holds(N.mid, 3 + 3 * k, 11 + 5 * k, 4, p.id * 5 + k); threat = null; }
      else { tgt = N.plant[site]; threat = N.threat[site]; list = style === 'info' && (N.fwd[site] || []).length ? N.fwd[site] : (N.holds[site] || []); }
      if (!list || !list.length) list = [tgt];
      pickHold(p, N, list, tgt, threat, sh); b.holdKey = key;
    }
    holdBehaviour(room, p, t, N);
    utilityReactive(room, p, t);
  }

  /* ---------- redskaber ---------- */
  function utilityExec(room, p, t, N, H, site) {
    const b = p.bot; if (!H.go || t < H.go - 100 || b.utilDone >= 3 || b.pendingThrow) return;
    const pl = N.plant[site], sw = room.W.spawns.swat[0], role = b.role;
    const dirx = sw.x - pl.x, dirz = sw.z - pl.z, L = hypot(dirx, dirz) || 1;
    const smokeAt = { x: pl.x + dirx / L * 5.5, z: pl.z + dirz / L * 5.5, y: pl.y }, g = WD.groundAt(room.W, smokeAt.x, smokeAt.z, pl.y + 0.5, 1.6); if (g > -Infinity) smokeAt.y = g;
    const k = b.utilDone;
    if (k === 0) {
      if (p.inv.smoke > 0 && (role === 'support' || role === 'carrier' || t > H.go + 2500) && t >= H.go - 100 + (p.id % 3) * 250) { const r = throwNade(room, p, 'smoke', smokeAt); if (r !== 'retry') b.utilDone = 1; }
      else if (!(p.inv.smoke > 0) || t > H.go + 4000) b.utilDone = 1;
    } else if (k === 1) {
      if (p.inv.flash > 0 && role !== 'carrier' && t >= H.go + 800 + (b.entryIdx || 0) * 500) { const r = throwNade(room, p, 'flash', { x: pl.x, y: pl.y + 0.4, z: pl.z }); if (r !== 'retry') b.utilDone = 2; }
      else if (!(p.inv.flash > 0) || t > H.go + 4500) b.utilDone = 3;
    } else b.utilDone = 3;
  }
  function utilityIntel(room, p, t, N) {                                // fjender meldt på siten: HE/molotov/flash på stedet FØR holdet går ind
    const b = p.bot; if (b.pendingThrow || t < (b.reactT || 0)) return false;
    const e = hottest(room, p.side, 9000, p, 6, 34); if (!e) return false;
    const types = p.side === 'hij' ? ['molotov', 'he', 'flash'] : ['incgren', 'he', 'flash']; const type = types.find(x => p.inv[x] > 0); if (!type) return false;
    const r = throwNade(room, p, type, { x: e.x, y: e.y, z: e.z }); if (r === 'retry') return false; if (r) { b.reactT = t + 6000; return true; }
    b.reactT = t + 2500; return false;
  }
  function utilityRetake(room, p, t, N, bp) {
    const b = p.bot; if (b.utilDone >= 2 || b.pendingThrow || !room.botPlan.swat.rgo) return;
    if (t < room.botPlan.swat.rgo - 1700) return;
    if (b.utilDone === 0 && p.inv.smoke > 0 && hypot(p.x - bp.x, p.z - bp.z) < 24) { if (throwNade(room, p, 'smoke', { x: bp.x, y: bp.y, z: bp.z }) !== 'retry') b.utilDone = 1; }
    else if (b.utilDone <= 1 && p.inv.flash > 0 && t > room.botPlan.swat.rgo - 700) { if (throwNade(room, p, 'flash', { x: bp.x, y: bp.y + 0.5, z: bp.z }) !== 'retry') b.utilDone = 2; }
  }
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
    room._tickT = t; if (room.botFreeze) return; let any = false; for (const p of room.players.values()) if (p.isBot) { any = true; break; }
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
