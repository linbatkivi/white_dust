'use strict';
/* ==========================================================================
   DE_WHITE_DUST – server
   Én Node-proces: serverer klienten (HTTP) og kører spillet (WebSocket på /ws).
   Kør:  node server.js      (port 3000, eller PORT=xxxx)
   Del med venner:  ngrok http 3000
   ========================================================================== */
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const os = require('os');
const { WebSocketServer } = require('ws');
const WD = require('./shared/wd.js');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const FAST = !!process.env.WD_FAST;   // kun til automatiske tests
const TIMES = FAST
  ? { buy: 2, grace: 3, round: 14, end: 1.2, plant: 0.6, defuse: 1.0, bomb: 6, over: 2, load: 5 }
  : { buy: 12, grace: 10, round: 100, end: 5, plant: 3.2, defuse: 6, bomb: 40, over: 42, load: 90 };   // grace: købe i spawn de første 10 s · over: sejrs-sekvensen (musikken) · load: maks. ventetid på at alle har indlæst banen
const MAX_PLAYERS = 10, WIN_ROUNDS = 7, HALF = 6, START_MONEY = WD.ECON.start, MAX_MONEY = WD.ECON.max;
const GRACE_GAME = 25000, GRACE_LOBBY = 8000;
const SNAP_MS = 50;

const { WEAPONS, ECON } = WD;
const addMoney = (p, v) => { p.money = Math.max(0, Math.min(MAX_MONEY, p.money + v)); };
const now = () => performance.now();
const r2 = v => Math.round(v * 100) / 100;

/* ------------------------------------------------------------------ HTTP (statiske filer) */
const PUB = path.join(__dirname, 'public');
const SHARED = path.join(__dirname, 'shared');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.hdr': 'application/octet-stream', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.md': 'text/plain; charset=utf-8', '.wasm': 'application/wasm', '.ktx2': 'image/ktx2', '.glb': 'model/gltf-binary' };
const fileCache = new Map();

function serveFile(req, res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('404'); }
    let ent = fileCache.get(file);
    if (!ent || ent.mtime !== st.mtimeMs) {
      ent = { mtime: st.mtimeMs, buf: fs.readFileSync(file), gz: null };
      fileCache.set(file, ent);
    }
    const ext = path.extname(file).toLowerCase();
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': (file.includes(path.sep + 'vendor' + path.sep) || file.includes(path.sep + 'assets' + path.sep)) ? 'public, max-age=86400' : 'no-cache',   // tunge assets (teksturer/HDRI) caches i browseren
      'Vary': 'Accept-Encoding'
    };
    let body = ent.buf;
    const compressible = /\.(html|js|css|json|svg|txt|hdr|gltf|bin)$/.test(ext);
    if (compressible && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      if (!ent.gz) ent.gz = zlib.gzipSync(ent.buf, { level: 6 });
      body = ent.gz; headers['Content-Encoding'] = 'gzip';
    }
    headers['Content-Length'] = body.length;
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    res.end(body);
  });
}

const server = http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); return res.end(); }
  if (rel === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  // v14 (kun testserver, WD_TEST=1): foto-turens kontaktark gemmes i docs/qa/ (filnavn renses, maks 20 MB)
  if (rel === '/dev/save' && req.method === 'POST' && process.env.WD_TEST) {
    const f = String(new URL(req.url, 'http://x').searchParams.get('f') || '').replace(/[^a-z0-9_.-]/gi, '');
    if (!/^[a-z0-9_-]+\.(jpg|png|json)$/i.test(f)) { res.writeHead(400); return res.end(); }
    const parts = []; let n = 0;
    req.on('data', d => { n += d.length; if (n > 20e6) req.destroy(); else parts.push(d); });
    req.on('end', () => { const dir = path.join(__dirname, 'docs', 'qa'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, f), Buffer.concat(parts)); res.writeHead(200); res.end('ok'); });
    return;
  }
  if (rel === '/') rel = '/index.html';
  let root = PUB, sub = rel;
  if (rel.startsWith('/shared/')) { root = SHARED; sub = rel.slice(7); }
  const full = path.join(root, sub);
  if (!full.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  serveFile(req, res, full);
});

/* ------------------------------------------------------------------ rum & spillere */
const rooms = new Map();

function send(ws, obj) { if (ws && ws.readyState === 1) ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj)); }
// v17: chat – højst 120 tegn, kontroltegn fjernes, maks. 5 beskeder pr. 4 s pr. spiller; holdchat kun til eget hold (i lobbyen: alle)
function onChat(room, p, m) {
  const txt = String(m.s == null ? '' : m.s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!txt) return;
  const now = Date.now(); p.chatT = (p.chatT || []).filter(t => now - t < 4000);
  if (p.chatT.length >= 5) { sendP(p, { t: 'notice', msg: 'Du skriver for hurtigt' }); return; }
  p.chatT.push(now);
  const team = !!m.tm && !!p.side;
  const out = JSON.stringify({ t: 'chat', id: p.id, n: p.name, s: txt, tm: team ? 1 : 0, side: p.side || null, dead: room.phase !== 'lobby' && p.side && !p.alive ? 1 : 0 });
  for (const q of room.players.values()) if (!team || q.side === p.side) sendP(q, out);
}
function sendP(p, obj) { if (p.ws) send(p.ws, obj); }

class Room {
  constructor(code) {
    this.code = code; this.players = new Map(); this.hostId = 0; this.nextPid = 1; this.nextEnt = 1;
    this.drops = []; this.nextDrop = 1;
    this.map = 'white_dust'; this.W = WD.buildWorld('white_dust');   // værten vælger bane i lobbyen
    this.phase = 'lobby'; this.phaseEnd = 0; this.round = 0; this.score = { swat: 0, hij: 0 };
    this.lossStreak = { swat: 0, hij: 0 }; this.swapped = false;
    this.grenades = []; this.smokes = []; this.fires = []; this.bomb = newBomb(); this.lastSnap = 0; this.liveStart = 0; this.requests = []; this.nextReq = 1;
  }
  bcast(obj, except) {
    const s = JSON.stringify(obj);
    for (const p of this.players.values()) if (p !== except) sendP(p, s);
  }
}
function newBomb() { return { state: 0, carrier: 0, x: 0, y: 0, z: 0, timer: 0, defuser: 0, defT: 0 }; }

function cleanName(n) {
  n = String(n || '').replace(/[^\p{L}\p{N} _\-.]/gu, '').trim().slice(0, 14);
  return n || ('Spiller' + Math.floor(100 + Math.random() * 900));
}
function makeCode() {
  for (let i = 0; i < 200; i++) {
    const c = String(1000 + Math.floor(Math.random() * 9000));
    if (!rooms.has(c)) return c;
  }
  return null;
}
function makePlayer(room, ws, name) {
  const p = {
    id: room.nextPid++, key: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
    name: cleanName(name), ws, connected: true, dcAt: 0, side: null, pref: null,
    alive: false, hp: 100, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, crouch: false, ground: true, speed: 0,
    money: START_MONEY, kills: 0, deaths: 0, inv: null, ammo: {}, cur: 'usp',
    reloadEnd: 0, lastShot: 0, use: false, act: null, actT: 0, actX: 0, actZ: 0, pin: false, fireAcc: 0, plantMsgT: 0,
    hist: [], lastIn: now(), budget: 4, corrId: 0, bought: [], rk: 0, rdmg: 0, lastMelee: 0
  };
  resetLoadout(p);
  room.players.set(p.id, p);
  return p;
}
function resetLoadout(p) {
  const pistol = WD.sidePistol(p.side);      // SWAT: USP-S, Hijackers: Glock-18
  p.inv = { primary: null, pistol, knife: true, he: 0, smoke: 0, flash: 0, molotov: 0, incgren: 0, bomb: false };
  p.ammo = { [pistol]: { mag: WEAPONS[pistol].mag, res: WEAPONS[pistol].res } };
  p.cur = pistol; p.reloadEnd = 0;
}
// v11.3: inventar (agent pr. hold + skin pr. våben) – kun korte id'er accepteres; klienterne slår dem op i deres katalog (ukendt => standard)
function cleanCos(c) {
  const out = { agent: {}, skins: {} };
  if (!c || typeof c !== 'object') return out;
  for (const s of ['swat', 'hij']) { const v = c.agent && c.agent[s]; if (typeof v === 'string' && /^[a-z0-9_]{1,16}:[a-z0-9_]{1,16}$/.test(v)) out.agent[s] = v; }
  if (c.skins && typeof c.skins === 'object') for (const k of Object.keys(WD.WEAPONS)) { const v = c.skins[k]; if (typeof v === 'string' && /^[a-z_]{1,16}$/.test(v)) out.skins[k] = v; }
  return out;
}
function lobbyMsg(room) {
  return { t: 'lobby', ph: room.phase, map: room.map, maps: WD.MAP_LIST, veto: room.vetoMode !== 'host', code: room.code, host: room.hostId, max: MAX_PLAYERS, cap: MAX_PLAYERS / 2, players: [...room.players.values()].map(p => ({ id: p.id, name: p.name, team: p.pref, cos: p.cos || null })) };
}
function sendSelf(p) {
  sendP(p, { t: 'self', hp: p.hp, money: p.money, alive: p.alive, side: p.side, inv: p.inv, cur: p.cur, ammo: p.ammo, bought: p.bought });
}
function roundMsg(room) {
  return {
    t: 'round', map: room.map, n: room.round, ph: room.phase, ms: Math.max(0, Math.round(room.phaseEnd - now())), score: [room.score.swat, room.score.hij], half: room.swapped,
    players: [...room.players.values()].filter(p => p.side).map(p => ({ id: p.id, name: p.name, side: p.side, cos: p.cos || null }))
  };
}
function tpMsg(p) { return { t: 'tp', id: p.corrId, x: r2(p.x), y: r2(p.y), z: r2(p.z), yaw: r2(p.yaw) }; }

/* ------------------------------------------------------------------ WebSocket */
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8192, perMessageDeflate: false });
wss.on('connection', ws => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.ctx = { room: null, p: null, cnt: 0, cntT: Date.now() };
  ws.on('message', data => {
    const c = ws.ctx, t = Date.now();
    if (t - c.cntT > 1000) { c.cnt = 0; c.cntT = t; }
    if (++c.cnt > 500) { ws.terminate(); return; }
    let m;
    try { m = JSON.parse(data); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    try { handle(ws, m); } catch (e) { console.error('handler-fejl:', e); }
  });
  ws.on('close', () => onClose(ws));
  ws.on('error', () => {});
});
setInterval(() => {
  wss.clients.forEach(ws => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; try { ws.ping(); } catch (e) {} });
}, 20000);

function attach(ws, room, p) {
  if (p.ws && p.ws !== ws) { p.ws.ctx.p = null; try { p.ws.close(); } catch (e) {} }
  p.ws = ws; p.connected = true; p.dcAt = 0;
  ws.ctx.room = room; ws.ctx.p = p;
}
function onClose(ws) {
  const { room, p } = ws.ctx;
  if (!room || !p || p.ws !== ws) return;
  p.ws = null; p.connected = false; p.dcAt = now(); p.use = false;
}

function handle(ws, m) {
  const c = ws.ctx;
  switch (m.t) {
    case 'ping': send(ws, { t: 'pong', c: m.c }); return;
    case 'create': {
      if (c.p) return;
      const code = makeCode();
      if (!code) return send(ws, { t: 'err', msg: 'Kunne ikke lave et rum – prøv igen' });
      const room = new Room(code); rooms.set(code, room);
      const p = makePlayer(room, ws, m.name);
      room.hostId = p.id; attach(ws, room, p);
      send(ws, { t: 'joined', code, id: p.id, key: p.key });
      room.bcast(lobbyMsg(room));
      return;
    }
    case 'join': {
      if (c.p) return;
      const code = String(m.code || '').trim();
      const room = rooms.get(code);
      if (!/^\d{4}$/.test(code) || !room) return send(ws, { t: 'err', msg: 'Ukendt kode – tjek de fire cifre' });
      if (room.phase !== 'lobby') return send(ws, { t: 'err', msg: 'Spillet er allerede i gang' });
      if (room.players.size >= MAX_PLAYERS) return send(ws, { t: 'err', msg: 'Rummet er fuldt (' + MAX_PLAYERS + ' spillere)' });
      const p = makePlayer(room, ws, m.name);
      attach(ws, room, p);
      send(ws, { t: 'joined', code, id: p.id, key: p.key });
      room.bcast(lobbyMsg(room));
      return;
    }
    case 'rejoin': {
      if (c.p) return;
      const room = rooms.get(String(m.code || ''));
      const p = room && room.players.get(m.id | 0);
      if (!p || p.key !== m.key) return send(ws, { t: 'err', msg: 'Sessionen er udløbet', fatal: true });
      attach(ws, room, p);
      send(ws, { t: 'joined', code: room.code, id: p.id, key: p.key, rejoin: true });
      send(ws, lobbyMsg(room));
      if (room.phase === 'loading') send(ws, loadMsg(room));
      else if (room.phase === 'veto') send(ws, vetoMsg(room));
      else if (room.phase !== 'lobby') {
        p.corrId++; send(ws, roundMsg(room)); send(ws, tpMsg(p)); sendSelf(p);
      }
      return;
    }
  }
  const room = c.room, p = c.p;
  if (!room || !p) return;
  switch (m.t) {
    case 'map':   // kun værten, kun i lobbyen
      if (p.id === room.hostId && room.phase === 'lobby' && WD.MAP_LIST.some(mp => mp.id === m.id)) { room.map = m.id; room.bcast(lobbyMsg(room)); }
      break;
    case 'team':   // holdvalg i venteværelset
      if (room.phase === 'lobby') {
        const s = m.side === 'hij' || m.side === 'swat' ? m.side : null;
        if (s && [...room.players.values()].filter(q => q.id !== p.id && q.pref === s).length >= MAX_PLAYERS / 2) sendP(p, { t: 'notice', msg: 'Holdet er fuldt' });
        else p.pref = s;
        room.bcast(lobbyMsg(room));
      }
      break;
    case 'start':
      if (p.id === room.hostId && room.phase === 'lobby') { if (room.vetoMode !== 'host' && (!FAST || m.veto)) startVeto(room); else startGame(room); }   // tests: afstemning kun med {veto:1}
      break;
    case 'vmode':   // v20: værten vælger banevalg: 'premier' (holdene stemmer baner ud) eller 'host' (værten vælger)
      if (p.id === room.hostId && room.phase === 'lobby') { room.vetoMode = m.mode === 'host' ? 'host' : 'premier'; room.bcast(lobbyMsg(room)); }
      break;
    case 'vban':    // v20: stemme på at bandlyse en bane (kun holdet hvis tur det er)
      if (room.phase === 'veto') voteBan(room, p, String(m.id || ''));
      break;
    case 'restart':   // værten genstarter kampen med det samme (nyt hold, score 0)
      if (p.id === room.hostId && room.phase !== 'lobby') startGame(room);
      break;
    case 'endgame':   // værten afslutter kampen og sender alle tilbage til venteværelset
      if (p.id === room.hostId && room.phase !== 'lobby') backToLobby(room);
      break;
    case 'in': onInput(room, p, m); break;
    case 'dbg':   // kun til automatiske tests (WD_TEST=1)
      if (process.env.WD_TEST) {
        if (m.x !== undefined) { p.x = +m.x; p.y = +m.y; p.z = +m.z; p.hist = []; p.lastIn = now(); p.corrId++; sendP(p, tpMsg(p)); }
        if (m.money !== undefined) { p.money = +m.money; sendSelf(p); }
        if (m.hp !== undefined) { p.hp = +m.hp; sendSelf(p); }
        if (m.strip) { const bomb = p.inv.bomb; resetLoadout(p); p.inv.bomb = bomb; sendSelf(p); }
      }
      break;
    case 'kick': {   // v20: kun værten (party leader) kan smide en spiller ud
      const q = room.players.get(m.id | 0);
      if (p.id !== room.hostId || !q || q.id === p.id) break;
      const ws2 = q.ws; if (ws2) { ws2.ctx.p = null; ws2.ctx.room = null; send(ws2, { t: 'err', msg: 'Du blev smidt ud af partyet af værten', fatal: true, kicked: true }); setTimeout(() => { try { ws2.close(); } catch (e) {} }, 100); }
      q.ws = null; q.connected = false;
      removePlayer(room, q);
      if (rooms.has(room.code)) { room.bcast({ t: 'notice', msg: q.name + ' blev smidt ud af værten' }); if (room.phase === 'loading') checkLoaded(room); }
      break;
    }
    case 'loaded':   // v20: klienten har indlæst bane, figurer og lyde
      if (room.phase === 'loading' && !p.loaded) { p.loaded = true; room.bcast(loadStMsg(room)); checkLoaded(room); }
      break;
    case 'chat': onChat(room, p, m); break;   // v17: chat (alle / holdet) – Y / U i klienten
    case 'cos': p.cos = cleanCos(m.c); room.bcast({ t: 'cos', id: p.id, c: p.cos }); break;   // inventar-valg -> alle i rummet
    case 'shoot': onShoot(room, p, m); break;
    case 'reload': startReload(p); break;
    case 'sw': onSwitch(p, m.w); break;
    case 'pickup': onPickup(room, p, m.i); break;
    case 'buy': onBuy(room, p, m.i); break;
    case 'sell': onSell(room, p, m.i); break;
    case 'req': onRequest(room, p, m.i); break;
    case 'gift': onGift(room, p, m.r | 0); break;
    case 'drop': onDropWeapon(room, p); break;
    case 'throw': onThrow(room, p, m); break;
    case 'sb': sendP(p, { t: 'sb', p: [...room.players.values()].filter(q => q.side).map(q => [q.id, q.name, q.side, q.kills, q.deaths, q.alive ? 1 : 0, q.connected ? 1 : 0]) }); break;
  }
}

/* ------------------------------------------------------------------ spilflow */
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// manuelt holdvalg (p.pref); uden valg fordeles spillerne så holdene bliver lige store
function assignTeams(room) {
  const ps = [...room.players.values()];
  const hij = ps.filter(p => p.pref === 'hij'), swat = ps.filter(p => p.pref === 'swat');
  for (const p of shuffle(ps.filter(p => !p.pref))) {
    if (hij.length < swat.length) hij.push(p); else if (swat.length < hij.length) swat.push(p); else (Math.random() < 0.5 ? hij : swat).push(p);
  }
  if (ps.length > 1 && (!hij.length || !swat.length)) return null;
  return { hij, swat };
}
function startGame(room, teams) {
  const T = teams || assignTeams(room);
  if (!T) { const h = room.players.get(room.hostId); if (h) sendP(h, { t: 'notice', msg: 'Begge hold skal have mindst én spiller' }); return false; }
  room.W = WD.buildWorld(room.map);                       // banen låses ved spilstart (skifter ikke af sig selv)
  T.hij.forEach(p => { p.side = 'hij'; }); T.swat.forEach(p => { p.side = 'swat'; });
  const ps = [...room.players.values()];
  ps.forEach(p => {
    p.kills = 0; p.deaths = 0; p.dmgTot = 0; p.hsK = 0; p.mvps = 0; p.money = START_MONEY; p.alive = false; p.act = null; resetLoadout(p);
  });
  room.score = { swat: 0, hij: 0 }; room.round = 0; room.lossStreak = { swat: 0, hij: 0 }; room.swapped = false;
  // v20: kampen starter først når ALLE har indlæst banen (eller efter TIMES.load sekunder, så én hængende klient ikke blokerer)
  room.phase = 'loading'; room.phaseEnd = now() + TIMES.load * 1000;
  ps.forEach(p => { p.loaded = false; });
  room.bcast(loadMsg(room));
  return true;
}
/* ------------------------------------------------------------------ v20: PREMIER-banevalg (map veto)
   Holdene fordeles først; derefter skiftes Hijackers og SWAT til at bandlyse én bane ad gangen (holdets flertal, ellers tilfældig ved
   tidsudløb), indtil én bane er tilbage – den spilles. Et hold uden spillere får sine ture overtaget af det andet hold. */
const VETO_TURN = 15, VETO_FINAL = 3.2;
function startVeto(room) {
  const T = assignTeams(room);
  if (!T) { const h = room.players.get(room.hostId); if (h) sendP(h, { t: 'notice', msg: 'Begge hold skal have mindst én spiller' }); return; }
  const pool = WD.MAP_LIST.map(mp => mp.id);
  if (pool.length < 2) return startGame(room, T);
  T.hij.forEach(q => { q.vside = 'hij'; }); T.swat.forEach(q => { q.vside = 'swat'; });
  room.veto = { T, pool, banned: [], turn: Math.random() < 0.5 ? 'hij' : 'swat', end: now() + VETO_TURN * 1000, votes: new Map(), final: null, finalAt: 0 };
  room.phase = 'veto';
  fixVetoTurn(room); room.bcast(vetoMsg(room));
}
function vetoTeam(room, side) { return [...room.players.values()].filter(q => q.vside === side && q.connected); }
function fixVetoTurn(room) {                       // tomt hold => det andet hold banner
  const v = room.veto; if (!vetoTeam(room, v.turn).length) v.turn = v.turn === 'hij' ? 'swat' : 'hij';
}
function vetoMsg(room) {
  const v = room.veto, tally = {};
  for (const id of v.votes.values()) tally[id] = (tally[id] || 0) + 1;
  return { t: 'veto', pool: v.pool, banned: v.banned, turn: v.turn, ms: Math.max(0, Math.round((v.final ? v.finalAt : v.end) - now())), votes: tally,
    my: Object.fromEntries([...v.votes.entries()]), final: v.final, teams: { hij: v.T.hij.map(q => q.id), swat: v.T.swat.map(q => q.id) } };
}
function voteBan(room, p, id) {
  const v = room.veto; if (v.final || p.vside !== v.turn || !v.pool.includes(id) || v.banned.some(b => b.id === id)) return;
  v.votes.set(p.id, id);
  if (vetoTeam(room, v.turn).every(q => v.votes.has(q.id))) resolveBan(room);
  else room.bcast(vetoMsg(room));
}
function resolveBan(room) {
  const v = room.veto, left = v.pool.filter(id => !v.banned.some(b => b.id === id));
  const tally = {}; for (const id of v.votes.values()) if (left.includes(id)) tally[id] = (tally[id] || 0) + 1;
  const top = Math.max(0, ...Object.values(tally)), cand = top ? Object.keys(tally).filter(id => tally[id] === top) : left;
  const ban = cand[Math.floor(Math.random() * cand.length)];
  v.banned.push({ id: ban, by: v.turn, auto: !top }); v.votes.clear();
  const rest = left.filter(id => id !== ban);
  if (rest.length === 1) { v.final = rest[0]; v.finalAt = now() + VETO_FINAL * 1000; room.map = v.final; }
  else { v.turn = v.turn === 'hij' ? 'swat' : 'hij'; fixVetoTurn(room); v.end = now() + VETO_TURN * 1000; }
  room.bcast(vetoMsg(room));
}
function tickVeto(room, t) {
  const v = room.veto;
  if (v.final) { if (t >= v.finalAt) { const T = v.T; for (const q of room.players.values()) q.vside = null; T.hij = T.hij.filter(q => room.players.has(q.id)); T.swat = T.swat.filter(q => room.players.has(q.id)); room.veto = null; startGame(room, T.hij.length || T.swat.length ? T : null); } return; }
  if (!vetoTeam(room, 'hij').length && !vetoTeam(room, 'swat').length) { backToLobby(room); return; }
  fixVetoTurn(room);
  if (t >= v.end) resolveBan(room);
}
function loadMsg(room) {
  return { t: 'load', map: room.map, ms: Math.max(0, Math.round(room.phaseEnd - now())),
    players: [...room.players.values()].filter(p => p.side).map(p => ({ id: p.id, name: p.name, side: p.side, cos: p.cos || null })), ready: loadReady(room) };
}
const loadReady = room => [...room.players.values()].filter(p => p.side && p.loaded).map(p => p.id);
function loadStMsg(room) { return { t: 'loadst', ready: loadReady(room), n: [...room.players.values()].filter(p => p.side && p.connected).length }; }
function checkLoaded(room) {
  const need = [...room.players.values()].filter(p => p.side && p.connected);
  if (room.phase === 'loading' && need.every(p => p.loaded)) newRound(room);
}

function newRound(room) {
  const t = now();
  room.round++;
  room.phase = 'buy'; room.phaseEnd = t + TIMES.buy * 1000;
  room.grenades = []; room.smokes = []; room.fires = []; room.bomb = newBomb(); room.drops = []; room.requests = [];
  room.planter = 0; room.defuser = 0; room.snapHist = [];
  const idx = { swat: 0, hij: 0 };
  const hijs = [];
  for (const p of room.players.values()) {
    if (!p.side) continue;
    if (!p.alive) resetLoadout(p);            // døde mister udstyr, overlevende beholder
    else { for (const w of ['primary', 'pistol']) { const id = p.inv[w]; if (id) p.ammo[id] = { mag: WEAPONS[id].mag, res: WEAPONS[id].res }; } }
    p.inv.bomb = false;
    p.reloadEnd = 0;
    p.alive = true; p.hp = 100;
    const list = room.W.spawns[p.side], sp = list[idx[p.side]++ % list.length];
    p.x = sp.x; p.y = sp.y; p.z = sp.z; p.yaw = sp.yaw; p.pitch = 0; p.crouch = false; p.ground = true; p.speed = 0;
    p.bought = []; p.rk = 0; p.rdmg = 0;
    p.hist = []; p.act = null; p.use = false; p.pin = false; p.fireAcc = 0; p.lastIn = t; p.budget = 4; p.corrId++;
    if (p.side === 'hij') hijs.push(p);
  }
  if (hijs.length) { const c = hijs[Math.floor(Math.random() * hijs.length)]; c.inv.bomb = true; room.bomb.carrier = c.id; }
  room.bcast(roundMsg(room));
  for (const p of room.players.values()) if (p.side) { sendP(p, tpMsg(p)); sendSelf(p); }
  sendReqs(room);
}

function endRound(room, win, reason) {
  if (room.phase !== 'live') return;
  const lose = win === 'hij' ? 'swat' : 'hij';
  room.phase = 'end'; room.phaseEnd = now() + TIMES.end * 1000;
  room.score[win]++;
  // v12: CS-økonomi. Tabs-serien stiger for taberen (max 5) og falder med 1 for vinderen (CS2) – så en enkelt sejr ikke nulstiller tabsbonussen helt
  room.lossStreak[lose] = Math.min(room.lossStreak[lose] + 1, ECON.loss.length);
  room.lossStreak[win] = Math.max(0, room.lossStreak[win] - 1);
  const winPay = ECON.win[reason] || ECON.win.elim, lossPay = WD.lossBonus(room.lossStreak[lose]);
  const planted = room.bomb.state >= 2;
  for (const p of room.players.values()) {
    if (!p.side) continue;
    let amt, why;
    if (p.side === win) { amt = winPay; why = 'win'; }
    else {
      amt = lossPay; why = 'loss';
      if (p.side === 'hij' && planted) { amt += ECON.plantTeam; why = 'lossplant'; }          // bomben blev plantet: +800 til hele holdet trods tabet
      if (p.side === 'hij' && reason === 'time' && p.alive) { amt = 0; why = 'saved'; }        // CS: overlevende Hijackers ved udløbet tid får ingen tabsbonus
    }
    addMoney(p, amt);
    if (p.act) cancelAct(room, p);
    sendP(p, { t: 'ev', k: 'pay', amt, why, streak: room.lossStreak[p.side] });
  }
  // MVP (som i CS): desarmering → desarmøren, detonation → planteren, ellers flest kills på vinderholdet (uafgjort: mest skade)
  let mvp = null, mvpWhy = 'kills';
  if (reason === 'defuse' && room.players.get(room.defuser)) { mvp = room.players.get(room.defuser); mvpWhy = 'defuse'; }
  else if (reason === 'bomb' && room.players.get(room.planter)) { mvp = room.players.get(room.planter); mvpWhy = 'plant'; }
  else for (const p of room.players.values()) if (p.side === win && (!mvp || p.rk > mvp.rk || (p.rk === mvp.rk && p.rdmg > mvp.rdmg))) mvp = p;
  if (mvp) mvp.mvps = (mvp.mvps || 0) + 1;
  room.bcast({ t: 'ev', k: 'end', win, reason, score: [room.score.swat, room.score.hij], ms: TIMES.end * 1000,
    mvp: mvp ? { id: mvp.id, name: mvp.name, k: mvp.rk, dmg: Math.round(mvp.rdmg), why: mvpWhy } : null,
    by: reason === 'defuse' ? room.defuser : reason === 'bomb' ? room.planter : 0 });
  for (const p of room.players.values()) if (p.side) sendSelf(p);
  sendEco(room);
}
// v12: holdets økonomi (kun ens egne holdkammerater, som i CS) + tabsserie → købsmenuens økonomi-panel
function sendEco(room) {
  for (const side of ['swat', 'hij']) {
    const team = [...room.players.values()].filter(q => q.side === side);
    if (!team.length) continue;
    const msg = JSON.stringify({ t: 'eco', side, streak: room.lossStreak[side], l: team.map(q => [q.id, Math.round(q.money), q.alive ? 1 : 0, q.inv && q.inv.primary ? WEAPONS[q.inv.primary].code : 0]) });
    for (const q of team) sendP(q, msg);
  }
}

function afterRoundEnd(room) {
  const win = room.score.swat >= WIN_ROUNDS ? 'swat' : room.score.hij >= WIN_ROUNDS ? 'hij' : null;
  if (win) {
    room.phase = 'over'; room.phaseEnd = now() + TIMES.over * 1000;
    // v20: slutstatistik til sejrs-sekvensen og leaderboardet (K, D, ADR, HS %, MVP'er)
    const rounds = Math.max(1, room.round);
    const board = [...room.players.values()].filter(q => q.side).map(q => ({ id: q.id, name: q.name, side: q.side, k: q.kills, d: q.deaths, adr: Math.round((q.dmgTot || 0) / rounds),
      hs: q.kills > 0 ? Math.round(100 * (q.hsK || 0) / q.kills) : 0, mvp: q.mvps || 0, cos: q.cos || null }));
    room.bcast({ t: 'ev', k: 'over', win, score: [room.score.swat, room.score.hij], board, ms: TIMES.over * 1000 });
    return;
  }
  if (room.round === HALF) {          // halvleg: skift side, nulstil penge og udstyr
    for (const p of room.players.values()) {
      if (!p.side) continue;
      p.side = p.side === 'hij' ? 'swat' : 'hij';
      p.money = START_MONEY; p.alive = false;
    }
    [room.score.swat, room.score.hij] = [room.score.hij, room.score.swat];
    room.lossStreak = { swat: 0, hij: 0 }; room.swapped = !room.swapped;
    room.bcast({ t: 'ev', k: 'half' });
  }
  newRound(room);
}

function backToLobby(room) {
  room.veto = null; for (const q of room.players.values()) q.vside = null;
  room.phase = 'lobby'; room.grenades = []; room.smokes = []; room.fires = []; room.bomb = newBomb(); room.drops = [];
  for (const p of [...room.players.values()]) {
    if (!p.connected) { removePlayer(room, p); continue; }
    p.side = null; p.alive = false; p.act = null;
  }
  if (rooms.has(room.code)) room.bcast(lobbyMsg(room));
}

function removePlayer(room, p) {
  if (p.alive) { p.alive = false; if (p.inv && p.inv.bomb) dropBomb(room, p); dropLoot(room, p); }
  room.players.delete(p.id);
  if (room.bomb.defuser === p.id) { room.bomb.defuser = 0; room.bomb.defT = 0; }
  if (!room.players.size) { rooms.delete(room.code); return; }
  if (room.hostId === p.id) {
    const nh = [...room.players.values()].find(q => q.connected) || room.players.values().next().value;
    room.hostId = nh.id;
  }
  room.bcast(lobbyMsg(room));   // ny vært skal også kende sin rolle midt i et spil
}

/* ------------------------------------------------------------------ input, bevægelse, lag-kompensation */
function onInput(room, p, m) {
  if (room.phase === 'lobby' || room.phase === 'loading') return;
  const t = now();
  if (typeof m.cs === 'number' && m.cs < p.corrId) return;    // gammel besked fra før en teleport/korrektion
  const yaw = +m.yaw, pitch = +m.pitch;
  if (Number.isFinite(yaw) && Number.isFinite(pitch)) { p.yaw = yaw; p.pitch = Math.max(-1.6, Math.min(1.6, pitch)); }
  p.use = !!m.u;
  p.pin = !!m.n && p.alive && !!WEAPONS[p.cur] && WEAPONS[p.cur].kind === 'nade';    // splitten er trukket (3.-persons-animation)
  if (!p.alive || room.phase === 'buy') { p.lastIn = t; return; }
  let x = +m.x, y = +m.y, z = +m.z;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
  const b = room.W.bounds;
  x = Math.max(b.x0, Math.min(b.x1, x)); z = Math.max(b.z0, Math.min(b.z1, z)); y = Math.max(-12, Math.min(30, y));
  const dt = Math.min(0.5, Math.max(0.001, (t - p.lastIn) / 1000));
  p.lastIn = t;
  p.budget = Math.min(4, p.budget + dt * 9);
  const dx = x - p.x, dz = z - p.z, dist = Math.hypot(dx, dz);
  if (dist > p.budget + 0.4 || Math.abs(y - p.y) > 45 * dt + 2.5) {
    p.corrId++; sendP(p, tpMsg(p)); return;                   // urealistisk hop – ryk spilleren tilbage
  }
  p.budget = Math.max(0, p.budget - dist);
  p.speed = p.speed * 0.6 + (dist / dt) * 0.4;
  p.x = x; p.y = y; p.z = z; p.crouch = !!m.c; p.ground = !!m.g;
  p.hist.push({ t, x, y, z, c: p.crouch });
  while (p.hist.length && t - p.hist[0].t > 700) p.hist.shift();
}

// v12: præcis lag-kompensation – serveren gemmer de positioner den har SENDT i hvert snapshot. Klienten viser modstanderne
// interpoleret mellem to snapshots ved servertiden 'st'; her genskabes præcis samme interpolation (ikke blot input-historikken)
function posAtSnap(room, q, st) {
  const H = room.snapHist; if (!H || H.length < 2 || st < H[0].t) return posAt(q, st);
  let i = H.length - 1; while (i > 0 && H[i - 1].t > st) i--;
  const b = H[i], a = H[Math.max(0, i - 1)], pb = b.P.get(q.id), pa = a.P.get(q.id) || pb;
  if (!pb) return posAt(q, st);
  if (st >= b.t) return { x: pb[0], y: pb[1], z: pb[2], c: pb[3] };
  const f = Math.max(0, Math.min(1, (st - a.t) / ((b.t - a.t) || 1)));
  return { x: pa[0] + (pb[0] - pa[0]) * f, y: pa[1] + (pb[1] - pa[1]) * f, z: pa[2] + (pb[2] - pa[2]) * f, c: f < 0.5 ? pa[3] : pb[3] };
}
function posAt(p, tt) {
  const h = p.hist;
  if (!h.length) return { x: p.x, y: p.y, z: p.z, c: p.crouch };
  if (tt >= h[h.length - 1].t) return h[h.length - 1];
  if (tt <= h[0].t) return h[0];
  for (let i = h.length - 1; i > 0; i--) {
    if (h[i - 1].t <= tt) {
      const a = h[i - 1], b = h[i], f = (tt - a.t) / ((b.t - a.t) || 1);
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f, c: b.c };
    }
  }
  return h[h.length - 1];
}

/* ------------------------------------------------------------------ våben */
function onSwitch(p, w) {
  if (!p.alive || !WEAPONS[w]) return;
  const ok = (w === p.inv.primary) || (w === p.inv.pistol) || (w === 'knife') || (WEAPONS[w].kind === 'nade' && p.inv[w] > 0);
  if (ok && w !== p.cur) { p.cur = w; p.reloadEnd = 0; }
  sendSelf(p);   // altid bekræft/ret klientens HUD (våben, ammo)
}
function startReload(p) {
  const w = WEAPONS[p.cur];
  if (!p.alive || !w || w.kind !== 'gun' || p.reloadEnd) return;
  const am = p.ammo[p.cur];
  if (!am || am.mag >= w.mag || am.res <= 0) return;
  p.reloadEnd = now() + w.reload * 1000;
}
function finishReload(p) {
  const w = WEAPONS[p.cur], am = p.ammo[p.cur];
  p.reloadEnd = 0;
  if (!w || !am) return;
  const take = Math.min(w.mag - am.mag, am.res);
  am.mag += take; am.res -= take;
  sendSelf(p);
}
/* ---- køb: i købsfasen, og de første TIMES.grace sekunder af runden så længe man står i holdets spawn (buy zone) ---- */
function buyLeftMs(room, t) {
  if (room.phase === 'buy') return room.phaseEnd - t + TIMES.grace * 1000;
  if (room.phase === 'live') return Math.max(0, room.liveStart + TIMES.grace * 1000 - t);
  return 0;
}
function inBuyZone(room, p) {
  return (room.W.spawns[p.side] || []).some(sp => Math.hypot(p.x - sp.x, p.z - sp.z) < 14 && Math.abs(p.y - sp.y) < 3);
}
function canBuyNow(room, p) {
  if (!p.alive || !p.side) return false;
  if (room.phase === 'buy') return true;
  return room.phase === 'live' && buyLeftMs(room, now()) > 0 && inBuyZone(room, p);
}
// giv et våben til en spiller (køb, gave). Returnerer false hvis det ikke kan modtages.
function giveItem(room, p, item) {
  const w = WEAPONS[item];
  if (w.kind === 'gun' && w.slot === 1) {
    if (p.inv.primary === item) return false;
    if (p.inv.primary) addDrop(room, p, p.inv.primary, p.ammo[p.inv.primary], 0, 1);     // gammelt primærvåben lægges på jorden (som i CS)
    p.inv.primary = item; p.ammo[item] = { mag: w.mag, res: w.res }; p.cur = item; p.reloadEnd = 0;
  } else if (w.kind === 'gun') {
    if (p.inv.pistol === item) return false;
    if (p.inv.pistol) addDrop(room, p, p.inv.pistol, p.ammo[p.inv.pistol], 0, 1);
    p.inv.pistol = item; p.ammo[item] = { mag: w.mag, res: w.res }; p.cur = item; p.reloadEnd = 0;
  } else if (w.kind === 'nade') {
    if (!WD.canTakeNade(p.inv, item)) return false;
    p.inv[item] = (p.inv[item] || 0) + 1;
  } else return false;
  return true;
}
function onBuy(room, p, item) {
  if (!canBuyNow(room, p)) return;
  const w = WEAPONS[item];
  if (!w || !w.price || p.money < w.price) return;
  if (!WD.canBuy(p.side, item)) { sendP(p, { t: 'notice', msg: w.name + ' kan kun købes af ' + (w.team === 'hij' ? 'HIJACKERS' : 'SWAT') }); return; }
  if (!giveItem(room, p, item)) return;
  p.money -= w.price; p.bought.push(item);
  room.requests = room.requests.filter(r => !(r.from === p.id && r.item === item));   // eget ønske opfyldt
  sendReqs(room);
  sendSelf(p);
}
/* ---- salg: kun noget man selv har købt i denne runde, kun mens man stadig kan købe – fuld refusion ---- */
function onSell(room, p, item) {
  if (!canBuyNow(room, p)) return;
  const w = WEAPONS[item], k = p.bought.lastIndexOf(item);
  if (!w || k < 0) return;
  if (w.kind === 'gun' && w.slot === 1) {
    if (p.inv.primary !== item) return;
    p.inv.primary = null; delete p.ammo[item];
  } else if (w.kind === 'gun') {
    if (p.inv.pistol !== item) return;
    const def = WD.sidePistol(p.side); p.inv.pistol = def; p.ammo[def] = { mag: WEAPONS[def].mag, res: WEAPONS[def].res }; delete p.ammo[item];
  } else if (w.kind === 'nade') {
    if (!(p.inv[item] > 0)) return;
    p.inv[item]--;
  } else return;
  if (p.cur === item && !(w.kind === 'nade' && p.inv[item] > 0)) p.cur = p.inv.primary || p.inv.pistol;
  p.reloadEnd = 0; p.bought.splice(k, 1); p.money = Math.min(MAX_MONEY, p.money + w.price);
  sendSelf(p);
}
/* ---- ønsker: en spiller beder holdet om et våben; en holdkammerat kan købe det som gave ---- */
function sendReqs(room) {
  for (const q of room.players.values()) {
    if (!q.side) continue;
    sendP(q, { t: 'reqs', l: room.requests.filter(r => r.side === q.side).map(r => ({ id: r.id, from: r.from, item: r.item })) });
  }
}
function onRequest(room, p, item) {
  if (!canBuyNow(room, p)) return;
  room.requests = room.requests.filter(r => r.from !== p.id);       // ét ønske pr. spiller (nyt erstatter gammelt); item=null annullerer
  const w = WEAPONS[item];
  if (w && w.price && WD.canBuy(p.side, item)) {
    room.requests.push({ id: room.nextReq++, from: p.id, side: p.side, item });
    for (const q of room.players.values()) if (q !== p && q.side === p.side) sendP(q, { t: 'notice', k: 'req', msg: p.name + ' ønsker ' + w.name + ' ($' + w.price + ') – åbn købsmenuen (B) for at give' });
  }
  sendReqs(room);
}
function onGift(room, p, rid) {
  const r = room.requests.find(q => q.id === rid);
  if (!r || r.side !== p.side || r.from === p.id || !canBuyNow(room, p)) return;
  const to = room.players.get(r.from), w = WEAPONS[r.item];
  if (!to || !to.alive || to.side !== p.side || p.money < w.price) return;
  if (!giveItem(room, to, r.item)) { sendP(p, { t: 'notice', msg: to.name + ' kan ikke modtage ' + w.name }); return; }
  p.money -= w.price;
  room.requests = room.requests.filter(q => q !== r);
  sendSelf(p); sendSelf(to); sendReqs(room);
  sendP(to, { t: 'notice', k: 'gift', msg: p.name + ' gav dig ' + w.name + '!' });
  sendP(p, { t: 'notice', k: 'gift', msg: 'Du gav ' + to.name + ' ' + w.name });
}
/* ---- smid primærvåbnet (G) – så en holdkammerat kan samle det op ---- */
function onDropWeapon(room, p) {
  if (!p.alive || room.phase === 'lobby' || room.phase === 'over' || !p.inv.primary) return;
  const id = p.inv.primary, fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  let x = p.x + fx * 1.0, z = p.z + fz * 1.0;
  const g = WD.groundAt(room.W, x, z, p.y, 0.3);
  if (!(g > -Infinity && Math.abs(g - p.y) < 0.3 && !WD.isBlocked(room.W, x, z, p.y, 0.6))) { x = p.x; z = p.z; }
  room.drops.push({ id: room.nextDrop++, item: id, ammo: p.ammo[id] ? { mag: p.ammo[id].mag, res: p.ammo[id].res } : null, x, y: p.y, z });
  while (room.drops.length > MAX_DROPS) room.drops.shift();
  p.inv.primary = null; delete p.ammo[id]; if (p.cur === id) p.cur = p.inv.pistol; p.reloadEnd = 0;
  const k = p.bought.lastIndexOf(id); if (k >= 0) p.bought.splice(k, 1);     // smidt = kan ikke sælges tilbage
  sendSelf(p);
}

function unit(a) {
  if (!Array.isArray(a) || a.length < 3) return null;
  const x = +a[0], y = +a[1], z = +a[2];
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  const l = Math.hypot(x, y, z);
  return l < 0.5 ? null : [x / l, y / l, z / l];
}
function eyeOf(p) { return p.y + (p.crouch ? WD.PL.EYEC : WD.PL.EYE); }
function validOrigin(p, o) {
  const ey = eyeOf(p);
  if (Array.isArray(o) && o.length >= 3) {
    const x = +o[0], y = +o[1], z = +o[2];
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) && Math.hypot(x - p.x, y - ey, z - p.z) < 3.5) return [x, y, z];
  }
  return [p.x, ey, p.z];
}

function onShoot(room, p, m) {
  if ((room.phase !== 'live' && room.phase !== 'end') || !p.alive) return;      // v12: man kan også skyde i pausen efter en vundet runde
  const w = WEAPONS[p.cur];
  if (w && w.kind === 'knife') return onMelee(room, p, m);
  if (!w || w.kind !== 'gun') return;
  const t = now();
  if (p.reloadEnd) { if (t >= p.reloadEnd - 150) finishReload(p); else return; }
  const am = p.ammo[p.cur];
  if (!am || am.mag <= 0) return;
  // v12: jitter-tolerant skudrate. Netværket kan klumpe to skud sammen (fx 100 ms → 30 ms imellem ved ankomst); før blev det
  // andet skud stille afvist ("jeg skød, men intet skete"). Nu: hårdt gulv på 45 % af kadencen + glidende 1-sekunds-vindue mod snyd.
  if (t - p.lastShot < w.rate * 1000 * 0.45) return;
  const log = p.shotLog || (p.shotLog = []);
  while (log.length && t - log[0] > 1000) log.shift();
  if (log.length >= Math.ceil(1 / w.rate) + 1) return;
  const d = unit(m.d);
  if (!d) return;
  log.push(t);
  p.lastShot = t; am.mag--;
  const o = validOrigin(p, m.o);
  // lag-kompensation: klienten sender det SERVER-tidspunkt den viste modstanderne ved (interpoleret snapshot-tid) – ofrene spoles tilbage dertil
  const st = Math.max(t - 400, Math.min(t, Number.isFinite(+m.st) ? +m.st : t));
  const range = 220;
  const nrm = { nx: 0, ny: 1, nz: 0 };
  const tw = WD.raycastWorld(room.W, o[0], o[1], o[2], d[0], d[1], d[2], range, nrm);
  const noWallHit = tw >= range - 1e-6;   // raycastWorld returns `range` itself (not Infinity) when nothing was hit
  let best = null, victim = null;
  for (const q of room.players.values()) {
    if (q === p || !q.alive || q.side === p.side) continue;
    const pos = posAtSnap(room, q, st);
    const h = WD.rayPlayer(o[0], o[1], o[2], d[0], d[1], d[2], pos.x, pos.y, pos.z, pos.c, Math.min(tw, range));
    if (h && (!best || h.t < best.t)) { best = h; victim = q; }
  }
  const tEnd = best ? best.t : tw;
  const e = [r2(o[0] + d[0] * tEnd), r2(o[1] + d[1] * tEnd), r2(o[2] + d[2] * tEnd)];
  room.bcast({ t: 'ev', k: 'shot', i: p.id, w: p.cur, o: [r2(o[0]), r2(o[1]), r2(o[2])], e, h: best ? 1 : 0, n: (best || noWallHit) ? 0 : [r2(nrm.nx), r2(nrm.ny), r2(nrm.nz)] }, p);
  if (best) {
    const hs = best.part === 'head';
    const dmg = Math.round(w.dmg * WD.HIT_MUL[best.part]);
    const killed = damage(room, victim, dmg, p, p.cur, hs);
    sendP(p, { t: 'ev', k: 'hit', hs, dmg, kill: killed, v: victim.id });
    if (victim.connected) sendP(victim, { t: 'ev', k: 'hurt', dx: r2(p.x - victim.x), dz: r2(p.z - victim.z), dmg, hs });
  }
}
/* ---- v12: kniv. Hug (a='s') eller stik (a='k'); rækkevidde ~1,75 m, en lille kegle af stråler (som CS' hull-trace), rygstik = langt mere skade ---- */
function onMelee(room, p, m) {
  const w = WEAPONS.knife, t = now(), stab = m.a === 'k';
  if (t - p.lastMelee < (stab ? w.stabRate : w.slashRate) * 1000 * 0.8) return;
  const d = unit(m.d); if (!d) return;
  p.lastMelee = t;
  const o = validOrigin(p, m.o), st = Math.max(t - 400, Math.min(t, Number.isFinite(+m.st) ? +m.st : t));
  const range = w.range, nrm = { nx: 0, ny: 1, nz: 0 };
  // stråle-kegle: midten + 8 retninger ~7° ude
  const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw), rays = [[0, 0]];
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; rays.push([Math.cos(a) * 0.12, Math.sin(a) * 0.12]); }
  let best = null, victim = null, tw = range;
  for (const [ox, oy] of rays) {
    let dx = d[0] + rx * ox, dy = d[1] + oy, dz = d[2] + rz * ox; const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
    const twr = WD.raycastWorld(room.W, o[0], o[1], o[2], dx, dy, dz, range, ox === 0 && oy === 0 ? nrm : undefined);
    if (ox === 0 && oy === 0) tw = twr;
    for (const q of room.players.values()) {
      if (q === p || !q.alive || q.side === p.side) continue;
      const pos = posAtSnap(room, q, st);
      const h = WD.rayPlayer(o[0], o[1], o[2], dx, dy, dz, pos.x, pos.y, pos.z, pos.c, Math.min(twr, range));
      if (h && (!best || h.t < best.t)) { best = h; victim = q; }
    }
  }
  const hitWall = !best && tw < range - 1e-6;
  const e = best ? null : [r2(o[0] + d[0] * tw), r2(o[1] + d[1] * tw), r2(o[2] + d[2] * tw)];
  room.bcast({ t: 'ev', k: 'melee', i: p.id, a: stab ? 'k' : 's', h: best ? 1 : hitWall ? 2 : 0, e: hitWall ? e : 0, n: hitWall ? [r2(nrm.nx), r2(nrm.ny), r2(nrm.nz)] : 0 }, p);
  if (hitWall) sendP(p, { t: 'ev', k: 'mwall', e, n: [r2(nrm.nx), r2(nrm.ny), r2(nrm.nz)] });
  if (!best) return;
  // rygstik: angriberen står bag offeret (offerets blikretning peger væk fra angriberen)
  const vf = [-Math.sin(victim.yaw), -Math.cos(victim.yaw)], ax = victim.x - p.x, az = victim.z - p.z, al = Math.hypot(ax, az) || 1;
  const back = (vf[0] * ax + vf[1] * az) / al > 0.45;
  const dmg = stab ? (back ? w.stabBack : w.stab) : (back ? w.slashBack : w.slash);
  const killed = damage(room, victim, dmg, p, 'knife', false);
  sendP(p, { t: 'ev', k: 'hit', hs: false, dmg, kill: killed, v: victim.id, knife: 1, back: back ? 1 : 0 });
  if (victim.connected) sendP(victim, { t: 'ev', k: 'hurt', dx: r2(p.x - victim.x), dz: r2(p.z - victim.z), dmg });
}

function damage(room, victim, dmg, attacker, weapon, hs) {
  if (!victim.alive) return false;
  if (attacker && attacker !== victim && attacker.side !== victim.side) { const d_ = Math.min(dmg, victim.hp); attacker.rdmg += d_; attacker.dmgTot = (attacker.dmgTot || 0) + d_; }
  victim.hp -= dmg;
  if (victim.hp > 0) { sendSelf(victim); return false; }
  victim.hp = 0; victim.alive = false; victim.deaths++;
  if (attacker && attacker !== victim) {
    if (attacker.side !== victim.side) { attacker.kills++; attacker.rk++; if (hs) attacker.hsK = (attacker.hsK || 0) + 1; const rw = WD.killReward(weapon); addMoney(attacker, rw); if (rw) sendP(attacker, { t: 'ev', k: 'pay', amt: rw, why: 'kill', w: weapon }); }
    else { attacker.kills--; addMoney(attacker, -300); }                     // holdkammerat-drab (fx egen HE/ild): straf som i CS
    sendSelf(attacker);
  }
  if (victim.act) cancelAct(room, victim);
  victim.use = false; victim.reloadEnd = 0;
  if (victim.inv.bomb) dropBomb(room, victim);
  dropLoot(room, victim);
  room.bcast({ t: 'ev', k: 'kill', a: attacker ? attacker.id : 0, v: victim.id, w: weapon, hs: !!hs });
  sendSelf(victim);
  return true;
}

/* ------------------------------------------------------------------ item-drops */
const MAX_DROPS = 40;
function addDrop(room, p, item, ammo, k, n) {
  // forskudt i en ring omkring liget; kun hvor der er frit gulv i samme højde
  let x = p.x, z = p.z;
  const a0 = Math.random() * 6.28;
  for (let i = 0; i < 8 && n > 1; i++) {
    const a = a0 + i * 0.785, tx = p.x + Math.cos(a) * 0.55, tz = p.z + Math.sin(a) * 0.55;
    const g = WD.groundAt(room.W, tx, tz, p.y, 0.3);
    if (g > -Infinity && Math.abs(g - p.y) < 0.3 && !WD.isBlocked(room.W, tx, tz, p.y, 0.6)) { x = tx; z = tz; break; }
  }
  room.drops.push({ id: room.nextDrop++, item, ammo: ammo ? { mag: ammo.mag, res: ammo.res } : null, x, y: p.y, z });
  while (room.drops.length > MAX_DROPS) room.drops.shift();
}
function dropLoot(room, p) {   // død/frakoblet: alt udstyr (undtagen C4, som har sin egen drop) ligger på jorden
  const list = [];
  if (p.inv.primary) list.push([p.inv.primary, p.ammo[p.inv.primary]]);
  if (p.inv.pistol) list.push([p.inv.pistol, p.ammo[p.inv.pistol]]);
  for (const n of WD.NADES) for (let i = 0; i < (p.inv[n] || 0); i++) list.push([n]);
  list.forEach((it, k) => addDrop(room, p, it[0], it[1], k, list.length));
}
function onPickup(room, p, id, auto) {
  if (!p.alive || (room.phase !== 'live' && room.phase !== 'end' && room.phase !== 'buy')) return;   // også i købsfasen (holdkammerater kan smide våben til hinanden) og slutfasen
  const d = room.drops.find(q => q.id === id);
  if (!d || Math.hypot(p.x - d.x, p.z - d.z) > 2.0 || Math.abs(p.y - d.y) > 1.6) return;
  const w = WEAPONS[d.item];
  if (w.kind === 'gun' && w.slot === 1) {
    if (p.inv.primary) addDrop(room, p, p.inv.primary, p.ammo[p.inv.primary], 0, 1);   // byt: eget våben ned på jorden
    p.inv.primary = d.item; p.ammo[d.item] = d.ammo || { mag: w.mag, res: w.res }; if (!auto || !WEAPONS[p.cur] || WEAPONS[p.cur].kind !== 'nade') p.cur = d.item; p.reloadEnd = 0;
  } else if (w.kind === 'gun') {
    if (p.inv.pistol === d.item) {                                  // samme pistol: genopfyld ammo hvis vi mangler
      const am = p.ammo[d.item] || (p.ammo[d.item] = { mag: 0, res: 0 });
      if (am.mag >= w.mag && am.res >= w.res) return;
      p.ammo[d.item] = { mag: w.mag, res: w.res };
    } else {                                                        // anden pistol: byt (egen pistol ned på jorden)
      if (p.inv.pistol) addDrop(room, p, p.inv.pistol, p.ammo[p.inv.pistol], 0, 1);
      p.inv.pistol = d.item; p.ammo[d.item] = d.ammo || { mag: w.mag, res: w.res };
      if (WEAPONS[p.cur] && WEAPONS[p.cur].slot === 2) p.cur = d.item;
    }
  } else if (w.kind === 'nade') { if (!WD.canTakeNade(p.inv, d.item)) return; p.inv[d.item] = (p.inv[d.item] || 0) + 1; }
  else return;
  room.drops = room.drops.filter(q => q.id !== d.id);
  sendP(p, { t: 'ev', k: 'picked', w: d.item });
  sendSelf(p);
}

// v12: som i CS samles et våben automatisk op når man går hen over det og har plads til det (tomt primær-slot,
// standardpistol mod en købt pistol er IKKE automatisk – brug E). Granater samles op hvis reglerne tillader det.
function autoPickup(room) {
  if (!room.drops.length) return;
  for (const p of room.players.values()) {
    if (!p.alive) continue;
    for (const d of room.drops) {
      if (Math.hypot(p.x - d.x, p.z - d.z) > 0.9 || Math.abs(p.y - d.y) > 1.2) continue;
      const w = WEAPONS[d.item];
      if ((w.kind === 'gun' && w.slot === 1 && !p.inv.primary) || (w.kind === 'nade' && WD.canTakeNade(p.inv, d.item))) { onPickup(room, p, d.id, true); break; }
    }
  }
}

/* ------------------------------------------------------------------ bombe */
function dropBomb(room, p) {
  const b = room.bomb;
  p.inv.bomb = false;
  if (b.state === 0 && b.carrier === p.id) {
    b.state = 1; b.carrier = 0; b.x = p.x; b.y = p.y; b.z = p.z;
    room.bcast({ t: 'ev', k: 'bombdrop', x: r2(p.x), y: r2(p.y), z: r2(p.z) });
  }
}
function startAct(room, p, kind) {
  p.act = kind; p.actT = 0; p.actX = p.x; p.actZ = p.z;
  sendP(p, { t: 'act', k: kind, dur: kind === 'plant' ? TIMES.plant : TIMES.defuse });
}
function cancelAct(room, p) {
  if (p.act === 'defuse' && room.bomb.defuser === p.id) { room.bomb.defuser = 0; room.bomb.defT = 0; }
  p.act = null; p.actT = 0;
  sendP(p, { t: 'act', k: null });
}
function updateActions(room, p, dt) {
  const b = room.bomb;
  if (p.act === 'plant') {
    const ok = p.use && p.alive && b.state === 0 && b.carrier === p.id && WD.plantSpot(room.W, p.x, p.y, p.z) && Math.hypot(p.x - p.actX, p.z - p.actZ) < 1.5;
    if (!ok) return cancelAct(room, p);
    p.actT += dt;
    if (p.actT >= TIMES.plant) {
      const site = WD.plantSpot(room.W, p.x, p.y, p.z);
      b.state = 2; b.x = p.x; b.y = WD.groundAt(room.W, p.x, p.z, p.y, 0.05); b.z = p.z; b.timer = TIMES.bomb; b.carrier = 0; p.inv.bomb = false;
      addMoney(p, ECON.plant); p.act = null; p.actT = 0; room.planter = p.id;
      sendP(p, { t: 'act', k: null }); sendP(p, { t: 'ev', k: 'pay', amt: ECON.plant, why: 'plant' }); sendSelf(p);
      room.bcast({ t: 'ev', k: 'plant', site, by: p.id, x: r2(b.x), y: r2(b.y), z: r2(b.z) });
    }
  } else if (p.act === 'defuse') {
    const ok = p.use && p.alive && b.state === 2 && b.defuser === p.id && Math.hypot(p.x - b.x, p.z - b.z) < 2.8;
    if (!ok) return cancelAct(room, p);
    p.actT += dt; b.defT = p.actT;
    if (p.actT >= TIMES.defuse) {
      b.state = 3; p.act = null; b.defuser = 0; addMoney(p, ECON.defuse); room.defuser = p.id;
      sendP(p, { t: 'act', k: null }); sendP(p, { t: 'ev', k: 'pay', amt: ECON.defuse, why: 'defuse' }); sendSelf(p);
      room.bcast({ t: 'ev', k: 'defuse', by: p.id });
      endRound(room, 'swat', 'defuse');
    }
  } else if (p.use && p.alive) {
    if (p.side === 'hij' && b.state === 0 && b.carrier === p.id && WD.plantSpot(room.W, p.x, p.y, p.z)) startAct(room, p, 'plant');
    else if (p.side === 'hij' && b.state === 0 && b.carrier === p.id && WD.inSiteBox(room.W, p.x, p.y, p.z) && now() - p.plantMsgT > 2500) {
      p.plantMsgT = now();                                          // inden for sitets zone, men ikke på gulvet (kasse/prop/væg): afvis med besked
      sendP(p, { t: 'notice', k: 'plant', msg: 'C4 kan ikke plantes her – stil dig direkte på site-gulvet (ikke på kasser, props eller ved vægge)' });
    }
    else if (p.side === 'swat' && b.state === 2 && !b.defuser && Math.hypot(p.x - b.x, p.z - b.z) < 2.4 && Math.abs(p.y - b.y) < 1.6) { b.defuser = p.id; b.defT = 0; startAct(room, p, 'defuse'); }
  }
}
function explodeBomb(room) {
  const b = room.bomb;
  b.state = 4;
  room.bcast({ t: 'ev', k: 'explode', x: r2(b.x), y: r2(b.y), z: r2(b.z) });
  for (const q of room.players.values()) {
    if (!q.alive) continue;
    const d = Math.hypot(q.x - b.x, q.y + 0.9 - b.y, q.z - b.z);
    if (d >= 18) continue;
    const dmg = Math.round(320 * (1 - d / 18));
    if (dmg > 0) damage(room, q, dmg, null, 'c4', false);
  }
  endRound(room, 'hij', 'bomb');
}

/* ------------------------------------------------------------------ granater
   Kast: m.pw = kraft (0..1, opbygget mens venstre knap holdes), m.u = 1 for blødt underhåndskast (højreklik).
   Parabelbane med tyngdekraft (WD.THROW.G), afprelning på vægge/gulv. Typer: he, flash, smoke, molotov, incgren. */
function onThrow(room, p, m) {
  if ((room.phase !== 'live' && room.phase !== 'end') || !p.alive) return;
  const type = p.cur, w = WEAPONS[type];
  if (!w || w.kind !== 'nade' || !(p.inv[type] > 0)) return;
  const d = unit(m.d);
  if (!d) return;
  const o = validOrigin(p, m.o), under = !!m.u, pw = Number.isFinite(+m.pw) ? Math.max(0, Math.min(1, +m.pw)) : 1;
  if (under) o[1] -= WD.THROW.underDrop;                                   // underhånd: slippes ved hoften
  p.inv[type]--; p.pin = false;
  if (p.inv[type] <= 0) p.cur = p.inv.primary || p.inv.pistol || 'knife';
  const v = WD.throwVel(d, pw, under);
  // spillerens egen fart arves delvist (løbekast)
  const sp = p.speed > 0.5 ? Math.min(1, p.speed / 6) : 0, fy = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  room.grenades.push({ id: room.nextEnt++, type, owner: p.id, side: p.side, x: o[0], y: o[1], z: o[2], vx: v[0] + fy * sp * 1.2, vy: v[1], vz: v[2] + fz * sp * 1.2, fuse: w.fuse, rest: 0, hit: 0 });
  room.bcast({ t: 'ev', k: 'throw', i: p.id, w: type, u: under ? 1 : 0 });
  sendSelf(p);
}
function stepGrenade(room, g, dt) {
  g.fuse -= dt;
  g.vy -= WD.THROW.G * dt;
  const dx = g.vx * dt, dy = g.vy * dt, dz = g.vz * dt, len = Math.hypot(dx, dy, dz);
  if (len > 1e-6) {
    const out = { nx: 0, ny: 1, nz: 0 }, R = 0.12;
    const t = WD.raycastWorld(room.W, g.x, g.y, g.z, dx / len, dy / len, dz / len, len + R, out);
    if (t < len + R) {
      const back = Math.max(0, t - R);
      g.x += dx / len * back; g.y += dy / len * back; g.z += dz / len * back;
      const vn = g.vx * out.nx + g.vy * out.ny + g.vz * out.nz;
      if (vn < -0.8 && !g.hit) g.hit = out.ny > 0.6 ? 2 : 1;                  // første rigtige kontakt: 2 = gulv, 1 = væg
      if (vn < 0) {
        const e = 0.45;
        g.vx -= (1 + e) * vn * out.nx; g.vy -= (1 + e) * vn * out.ny; g.vz -= (1 + e) * vn * out.nz;
        if (out.ny > 0.5) { g.vx *= 0.78; g.vz *= 0.78; }
        if (vn < -3) room.bcast({ t: 'ev', k: 'bounce', x: r2(g.x), y: r2(g.y), z: r2(g.z), w: g.type });
      }
      g.x += out.nx * 0.04; g.y += out.ny * 0.04; g.z += out.nz * 0.04;
      if (out.ny > 0.6 && Math.hypot(g.vx, g.vy, g.vz) < 1.0) { g.vx = g.vy = g.vz = 0; g.rest += dt; }
    } else { g.x += dx; g.y += dy; g.z += dz; g.rest = 0; }
  }
  const b = room.W.bounds;
  if (g.y < -12 || g.x < b.x0 - 2 || g.x > b.x1 + 2 || g.z < b.z0 - 2 || g.z > b.z1 + 2) { g.fuse = 0; g.lost = true; }
}
function smokeSpheres(room, t) {   // aktive røgskyer som kugler (til flash-sigtelinje og ild-slukning)
  return room.smokes.map(s => ({ x: s.x, y: s.y + 1.4, z: s.z, r: 3.4 * Math.min(1, (t - s.born) / 1400 + 0.25) }));
}
function popFire(room, g, t) {
  const W = room.W, smk = smokeSpheres(room, t);
  // ved væg-kontakt eller timeout i luften: ilden falder ned på gulvet under granaten (max 4 m – ellers brænder den ud i luften)
  const fy = WD.floorBelow(W, g.x, g.y + 0.1, g.z, 4.0);
  if (fy === null || g.lost) { room.bcast({ t: 'ev', k: 'fizzle', x: r2(g.x), y: r2(g.y), z: r2(g.z) }); return; }
  if (smk.some(s => Math.hypot(g.x - s.x, g.z - s.z) < s.r && Math.abs(fy - (s.y - 1.4)) < 2)) { room.bcast({ t: 'ev', k: 'fizzle', x: r2(g.x), y: r2(fy), z: r2(g.z) }); return; }
  const f = { id: room.nextEnt++, type: g.type, owner: g.owner, side: g.side, x: g.x, y: fy, z: g.z, born: t, end: t + WD.FIRE.DUR * 1000 };
  f.zone = WD.fireZone(W, f.x, f.y, f.z);
  room.fires.push(f);
  room.bcast({ t: 'ev', k: 'fire', id: f.id, w: g.type, x: r2(f.x), y: r2(f.y), z: r2(f.z) });
}
function popFlash(room, g, t) {
  room.bcast({ t: 'ev', k: 'flash', x: r2(g.x), y: r2(g.y), z: r2(g.z) });
  const smk = smokeSpheres(room, t);
  for (const q of room.players.values()) {   // raycast-analyse mod ALLE levende spillere i radius (også holdkammerater og kasteren selv)
    if (!q.alive) continue;
    const a = WD.flashAmount(room.W, g.x, g.y + 0.1, g.z, [q.x, eyeOf(q), q.z], q.yaw, q.pitch, smk);
    if (a && q.connected) sendP(q, { t: 'ev', k: 'flashed', dur: r2(a.dur), full: a.full ? 1 : 0, x: r2(g.x), y: r2(g.y), z: r2(g.z), by: g.owner });
  }
}
function updateProjectiles(room, t, dt) {
  for (let i = room.grenades.length - 1; i >= 0; i--) {
    const g = room.grenades[i];
    stepGrenade(room, g, dt);
    const fire = WEAPONS[g.type].fire;
    const pop = g.type === 'smoke' ? (g.fuse <= 0 || g.rest > 0.35) : fire ? (g.fuse <= 0 || g.hit > 0) : g.fuse <= 0;
    if (!pop) continue;
    room.grenades.splice(i, 1);
    if (g.type === 'he') {
      room.bcast({ t: 'ev', k: 'boom', x: r2(g.x), y: r2(g.y), z: r2(g.z) });
      const owner = room.players.get(g.owner);
      for (const q of room.players.values()) {
        if (!q.alive) continue;
        if (owner && q !== owner && q.side === owner.side) continue;
        const cx = q.x, cy = q.y + 0.9, cz = q.z, d = Math.hypot(cx - g.x, cy - g.y, cz - g.z);
        if (d >= 9 || !WD.losClear(room.W, g.x, g.y + 0.1, g.z, cx, cy, cz)) continue;
        let dmg = Math.round(130 * Math.pow(1 - d / 9, 1.3));
        if (q === owner) dmg = Math.round(dmg * 0.6);
        if (dmg <= 0) continue;
        damage(room, q, dmg, owner || null, 'he', false);
        if (q.connected) sendP(q, { t: 'ev', k: 'hurt', dx: r2(g.x - q.x), dz: r2(g.z - q.z), dmg });
      }
    } else if (g.type === 'flash') popFlash(room, g, t);
    else if (fire) popFire(room, g, t);
    else {
      const s = { id: room.nextEnt++, x: g.x, y: g.y, z: g.z, born: t, end: t + 15000 };
      room.smokes.push(s);
      room.bcast({ t: 'ev', k: 'smoke', x: r2(g.x), y: r2(g.y), z: r2(g.z) });
      // røg slukker ild den lander i (som i CS)
      for (const f of room.fires) if (Math.hypot(f.x - s.x, f.z - s.z) < WD.FIRE.R + 1.0 && Math.abs(f.y - s.y) < 2.5) { f.end = t; room.bcast({ t: 'ev', k: 'fireout', id: f.id }); }
    }
  }
  room.smokes = room.smokes.filter(s => s.end > t);
  // ild: 15 HP/s til alle der står i zonen (holdkammerater skånes, kasteren selv gør ikke)
  for (const f of room.fires) {
    if (f.end <= t) continue;
    const owner = room.players.get(f.owner);
    for (const q of room.players.values()) {
      if (!q.alive || (owner && q !== owner && q.side === owner.side) || (!owner && q.side === f.side && q.id !== f.owner)) continue;
      if (!WD.inFire(f.zone, q.x, q.y, q.z)) continue;
      q.fireAcc += WD.FIRE.DPS * dt;
      if (q.fireAcc >= 3) {
        const dmg = Math.floor(q.fireAcc); q.fireAcc -= dmg;
        damage(room, q, dmg, owner || null, f.type, false);
        if (q.connected) sendP(q, { t: 'ev', k: 'burn', dmg });
      }
    }
  }
  room.fires = room.fires.filter(f => f.end > t);
}

/* ------------------------------------------------------------------ hovedløkke */
function checkEnd(room, t) {
  const cnt = { swat: 0, hij: 0 }, tot = { swat: 0, hij: 0 };
  for (const p of room.players.values()) { if (!p.side) continue; tot[p.side]++; if (p.alive) cnt[p.side]++; }
  const b = room.bomb;
  if (b.state === 2) { if (tot.swat > 0 && cnt.swat === 0) endRound(room, 'hij', 'elim'); return; }
  if (tot.hij > 0 && cnt.hij === 0) return endRound(room, 'swat', 'elim');
  if (tot.swat > 0 && cnt.swat === 0) return endRound(room, 'hij', 'elim');
  if (t >= room.phaseEnd) endRound(room, 'swat', 'time');
}

function tickRoom(room, t, dt) {
  for (const p of [...room.players.values()]) {
    if (!p.connected && t - p.dcAt > (room.phase === 'lobby' ? GRACE_LOBBY : GRACE_GAME)) removePlayer(room, p);
  }
  if (!rooms.has(room.code)) return;
  if (room.phase === 'lobby') return;
  if (room.phase === 'veto') { tickVeto(room, t); return; }
  if (room.phase === 'loading') { if (t >= room.phaseEnd) newRound(room); else checkLoaded(room); return; }   // frakoblede spillere blokerer ikke
  if (room.phase === 'buy') {
    if (t >= room.phaseEnd) { room.phase = 'live'; room.phaseEnd = t + TIMES.round * 1000; room.liveStart = t; }
  } else if (room.phase === 'live') {
    for (const p of room.players.values()) {
      if (!p.alive) continue;
      if (p.reloadEnd && t >= p.reloadEnd) finishReload(p);
      updateActions(room, p, dt);
    }
    const b = room.bomb;
    if (b.state === 1) {
      for (const p of room.players.values()) {
        if (p.alive && p.side === 'hij' && Math.hypot(p.x - b.x, p.z - b.z) < 1.6 && Math.abs(p.y - b.y) < 1.6) {
          b.state = 0; b.carrier = p.id; p.inv.bomb = true; sendSelf(p);
          room.bcast({ t: 'ev', k: 'bombpick', by: p.id });
          break;
        }
      }
    }
    if (b.state === 2 && room.phase === 'live') { b.timer -= dt; if (b.timer <= 0) explodeBomb(room); }
    if (room.phase === 'live') updateProjectiles(room, t, dt);
    if (room.phase === 'live') checkEnd(room, t);
  } else if (room.phase === 'end') {
    for (const p of room.players.values()) if (p.alive && p.reloadEnd && t >= p.reloadEnd) finishReload(p);
    updateProjectiles(room, t, dt);
    if (t >= room.phaseEnd) afterRoundEnd(room);
  } else if (room.phase === 'over') {
    if (t >= room.phaseEnd) backToLobby(room);
  }
  if (rooms.has(room.code) && (room.phase === 'live' || room.phase === 'end' || room.phase === 'buy')) autoPickup(room);
  if (rooms.has(room.code) && room.phase !== 'lobby' && t - (room.lastEco || 0) >= 500) { room.lastEco = t; sendEco(room); }
  if (rooms.has(room.code) && room.phase !== 'lobby' && t - room.lastSnap >= SNAP_MS - 4) { room.lastSnap = t; sendSnap(room, t); }
}

function sendSnap(room, t) {
  const P = [], SP = new Map();
  for (const p of room.players.values()) {
    if (!p.side) continue;
    SP.set(p.id, [r2(p.x), r2(p.y), r2(p.z), p.crouch]);
    P.push([p.id, r2(p.x), r2(p.y), r2(p.z), r2(p.yaw), r2(p.pitch), (p.alive ? 1 : 0) | (p.crouch ? 2 : 0) | (p.act ? 4 : 0) | (p.ground ? 8 : 0) | (p.reloadEnd ? 16 : 0) | (p.pin ? 32 : 0), (WEAPONS[p.cur] || {}).code || 0]);
  }
  const b = room.bomb;
  (room.snapHist || (room.snapHist = [])).push({ t: Math.round(t), P: SP });
  while (room.snapHist.length > 24) room.snapHist.shift();          // ~1,2 s historik
  const msg = JSON.stringify({
    t: 's', st: Math.round(t), ph: room.phase, pl: Math.max(0, Math.round(room.phaseEnd - t)), bw: Math.round(buyLeftMs(room, t)), r: room.round, sc: [room.score.swat, room.score.hij],
    p: P,
    g: room.grenades.map(g => [g.id, WD.NADE_TYPE[g.type], r2(g.x), r2(g.y), r2(g.z)]),
    f: room.fires.map(f => [f.id, WD.NADE_TYPE[f.type], r2(f.x), r2(f.y), r2(f.z), Math.max(0, Math.round(f.end - t)), Math.round(t - f.born)]),
    d: room.drops.map(d => [d.id, WEAPONS[d.item].code, r2(d.x), r2(d.y), r2(d.z)]),
    sm: room.smokes.map(s => [s.id, r2(s.x), r2(s.y), r2(s.z), Math.round(s.end - t), Math.round(t - s.born)]),
    b: [b.state, r2(b.x), r2(b.y), r2(b.z), b.state === 2 ? Math.max(0, Math.round(b.timer * 1000)) : 0, b.carrier, b.state === 2 && b.defuser ? r2(b.defT / TIMES.defuse) : 0]
  });
  for (const p of room.players.values()) {
    if (p.ws && p.ws.bufferedAmount < 262144) send(p.ws, msg);
  }
}

let lastTick = now();
setInterval(() => {
  const t = now(), dt = Math.min(0.1, (t - lastTick) / 1000);
  lastTick = t;
  for (const room of [...rooms.values()]) {
    try { tickRoom(room, t, dt); } catch (e) { console.error('tick-fejl:', e); }
  }
}, 1000 / 30);

/* ------------------------------------------------------------------ start */
server.listen(PORT, '0.0.0.0', () => {
  const ips = [];
  const ifs = os.networkInterfaces();
  for (const k in ifs) for (const a of ifs[k]) if (a.family === 'IPv4' && !a.internal) ips.push(a.address);
  console.log('\n  DE_WHITE_DUST kører!\n');
  console.log('  Lokalt:         http://localhost:' + PORT);
  ips.forEach(ip => console.log('  På dit netværk: http://' + ip + ':' + PORT));
  console.log('\n  Spil over internettet:  ngrok http ' + PORT);
  console.log('  (send den https://…ngrok…-adresse til dine venner)\n');
});
process.on('SIGINT', () => { console.log('\nLukker ned…'); process.exit(0); });
