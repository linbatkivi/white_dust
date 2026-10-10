// ==========================================================================
// DE_WHITE_DUST — klient (v9 · v12: servertids-interpolation + præcis lag-kompensation, CS-bevægelse, kniv, rundeslut, bombe-kamera, plant-zoner)
// Bruger samme fysik/kort-modul som serveren (window.WD, indlæst via <script> før dette modul),
// så lokal bevægelses-prædiktion altid matcher serverens regler.
// Rendering: visuals.js (bane, PBR, bagt lys), post.js (SSAO, bloom, FXAA, tonemapping), fx.js (røg/ild/flash-partikler),
//            characters.js (spillere), weapons.js (våben/hold-finish), audio.js (lyd), settings.js (crosshair, mus, volumen).
// ==========================================================================
import * as THREE from '/vendor/three.module.min.js';
import { createVisuals } from '/js/visuals.js';
import { createThemes } from '/js/themes.js';
import { createCharacters } from '/js/characters.js';
import { createWeapons } from '/js/weapons.js';
import { createAudio } from '/js/audio.js';
import { createPost } from '/js/post.js';
import { createFx } from '/js/fx.js';
import { createSettings } from '/js/settings.js';
import { derivePBR } from '/js/pbr.js';
import { loadThemeAssets } from '/js/assets.js';
import { havnUniforms } from '/js/havn.js';
import { createVictory } from '/js/victory.js';
import { createLogo3D } from '/js/logo3d.js';
import * as SK from '/js/skins.js';
import { createInventory } from '/js/inventory.js';
import { buildAK47 } from '/js/procguns.js';
import { loadGLB, cloneSkinned, bakeStatic } from '/js/models.js';

const WD = window.WD;
let W = WD.buildWorld('white_dust');          // aktiv bane (skiftes via setMap når serveren melder en anden)
function setMap(id) {
  if (W.id !== id) { W = WD.buildWorld(id); Game.mapId = W.id; }
  if (inited3d && Renderer.mapId !== W.id) Renderer.loadMap();       // loadMap samler gentagne kald mens banen bygges
}
const { PL, WEAPONS } = WD;
const Audio = createAudio();
const DEV = /[?&]dev\b/.test(location.search);
/* v13: brugerfladen skaleres efter skærmen (HUD, minimap, killfeed, scoreboard og købsmenu) – designet til ≈1440×860 */
function fitUI() {
  const w = innerWidth, h = innerHeight, touch = document.documentElement.classList.contains('touch') || document.body.classList.contains('touch');
  const k = touch ? 1 : Math.max(0.72, Math.min(1.6, Math.min(w / 1440, h / 860)));
  document.documentElement.style.setProperty('--ui', k.toFixed(3));
}
window.addEventListener('resize', fitUI);
const NOPOST = /[?&]post=0\b/.test(location.search);
// touch-enhed (iPad/telefon): ingen pointer lock – virtuel joystick + knapper. ?touch=1 tvinger tilstanden (test på desktop)
const TOUCH = /[?&]touch=1\b/.test(location.search) || (!!window.matchMedia && matchMedia('(pointer: coarse)').matches && (navigator.maxTouchPoints || 0) > 0);
document.body.classList.toggle('touch', TOUCH);
fitUI();
/* ---- indstillinger (crosshair, mus, volumen) – anvendes i realtid ---- */
const Settings = createSettings({ onChange: applySettings });
// v11.3: inventar (agenter + våben-skins). Ændringer sendes til serveren og anvendes straks på førstepersonsvåbnet.
const Inv = createInventory({ THREE, skins: SK, chars: () => Renderer.chars(), weap: () => Renderer.weap(), weaponCode: id => (WD.WEAPONS[id] || {}).code || 0,
  onChange: inv => { if (Net.connected) Net.send({ t: 'cos', c: inv }); Renderer.onCosmetics(); } });
const uiOpen = () => Settings.isOpen() || Inv.isOpen() || Chat.isOpen();
function applySettings(S) {
  Audio.setVolumes({ master: S.vol / 100, sfx: S.sfx / 100, music: S.music / 100, voice: S.voice / 100 });
  const xh = document.getElementById('crosshair'); if (xh) Settings.drawCrosshair(xh, S.xh, 1);
  if (inited3d && S.gfx !== applySettings._gfx) { applySettings._gfx = S.gfx; Renderer.setQuality(S.gfx); }   // (før init: sættes i Renderer.init)
  const xr = document.getElementById('crosshairHit'); if (xr) Settings.drawCrosshair(xr, Object.assign({}, S.xh, { color: '#FF2B1F', alpha: 1, outline: true }), 1);   // rødt træf-glimt
}
applySettings(Settings.get());

/* ------------------------------------------------------------------------ hjælpere */
const _el = {};
const $ = id => _el[id] || (_el[id] = document.getElementById(id));   // cachede opslag (kaldes mange gange pr. frame)
const _txt = new Map();
function setText(id, v) { v = String(v); if (_txt.get(id) !== v) { _txt.set(id, v); $(id).textContent = v; } }   // rør kun DOM ved ændring
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const lerpAngle = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
const fmtTime = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);

function canvasTexture(draw, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true;
  return tex;
}
function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ==========================================================================
   NETVÆRK
   ========================================================================== */
const Net = {
  ws: null, connected: false, session: null,
  handlers: {},
  connect() {
    return new Promise((resolve, reject) => {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(proto + '//' + location.host + '/ws');
      let settled = false;
      ws.onopen = () => { if (this.ws && this.ws !== ws && this.ws.readyState <= 1) try { this.ws.close(); } catch (e) {} this.ws = ws; this.connected = true; settled = true; this._pingLoop(); resolve(); };
      ws.onmessage = ev => { if (this.ws !== ws) return; let m; try { m = JSON.parse(ev.data); } catch (e) { return; } this._dispatch(m); };
      ws.onclose = () => {
        if (!settled) { settled = true; reject(new Error('kunne ikke forbinde')); return; }
        if (this.ws !== ws) return;                        // en forældet socket (erstattet af en nyere) må ikke afbryde den aktive forbindelse
        this.connected = false; this._onDisconnect();
      };
      ws.onerror = () => {};
    });
  },
  _pingLoop() {
    clearInterval(this._pi);
    this._pi = setInterval(() => { if (this.connected) this.send({ t: 'ping', c: performance.now() }); }, 2000);   // v12.1: ping hvert 2. s (vises i FPS/ping-visningen)
  },
  _onDisconnect() {
    clearInterval(this._pi);
    if (Game.state === 'game' || Game.state === 'lobby') {
      UI.toast('Forbindelsen tabt — forsøger at genoprette…');
      this._tryReconnect();
    }
  },
  async _tryReconnect(delay = 1000) {
    if (!this.session || this._reconnecting) return;
    this._reconnecting = true;
    for (;;) {
      await new Promise(r => setTimeout(r, delay));
      if (this.connected) break;
      try {
        await this.connect();
        this.send({ t: 'rejoin', code: this.session.code, id: this.session.id, key: this.session.key });
        break;
      } catch (e) { delay = Math.min(delay * 1.6, 6000); }
    }
    this._reconnecting = false;
  },
  send(o) { if (this.connected) this.ws.send(JSON.stringify(o)); },
  on(t, fn) { (this.handlers[t] = this.handlers[t] || []).push(fn); },
  _dispatch(m) { const hs = this.handlers[m.t]; if (hs) for (const h of hs) h(m); }
};

/* ==========================================================================
   TILSTAND
   ========================================================================== */
const Game = {
  state: 'menu',       // menu | lobby | game
  meId: 0, side: null, host: 0,
  phase: 'lobby', phaseEnd: 0, round: 0, score: [0, 0], half: false,
  self: { hp: 100, money: 800, alive: false, inv: null, cur: 'usp', ammo: {} },
  players: new Map(),   // id -> {name, side}
  remotes: new Map(),   // id -> render/interp state
  drops: [], specId: 0,
  bomb: { state: 0, x: 0, y: 0, z: 0, msLeft: 0, carrier: 0, defFrac: 0 },
  grenadesFly: new Map(), smokes: new Map(),
  act: null, actDur: 0,
  reloading: null,   // { start, dur } — klient-lokal reload-progress
  body: WD.newBody(0, 0, 0), yaw: 0, pitch: 0,
  input: { fw: 0, sd: 0, jump: false, crouch: false, walk: false, use: false },
  corrId: 0,
  snapBuf: [],          // buffer af snapshots til interpolation af andre spillere
  lastFire: 0, reloadUntil: 0,
  muzzleT: 0, firing: false, scoped: false, fov: 90,
  nade: null,           // { under, t0 } – split trukket, kastet opbygger kraft (slippes ved mouseup)
  punch: { yaw: 0, pitch: 0 }, sprayN: 0, lastShotT: 0,   // procedural pattern recoil
  flash: null,          // { t0, dur, full } – blænding fra flashbang
  _lobbyCode: '', mapId: 'white_dust', maps: [],
  // v12
  clk: null,            // estimeret (servertid - performance.now()) → glat interpolation på servertid + korrekt lag-kompensation
  renderST: 0,          // den servertid modstanderne vises ved lige nu (sendes med hvert skud)
  stepOff: 0,           // kamera-udjævning når man træder op på trin/kanter
  endT: 0, endInfo: null, eco: null, lastWeapon: null, stabbing: false, knifeT: 0,
  specYaw: 0, specPitch: -0.35, hurts: []
};
/* ---- v12: mus. Rå bevægelse samles i en akkumulator og lægges på i hver frame (valgfri udjævning på få ms fjerner 'hak' når
        musens polling (fx 125/500 Hz) og skærmens frekvens ikke går op i hinanden – uden mærkbar forsinkelse) ---- */
const MouseIn = { x: 0, y: 0 };
/* v17: fuldskærm + tastaturlås (Chrome/Edge): Esc forlader hverken fuldskærm eller musefangst – spillet håndterer selv Esc (pausemenu).
   Hold Esc nede i 2 s for at forlade fuldskærm (browserens nødudgang). Safari har ikke tastaturlås – der virker Esc som før. */
function enterFullscreen() {
  if (TOUCH || Settings.get().fullscreen === false) return Promise.resolve();
  const lockKeys = () => { try { if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock(['Escape']).catch(() => {}); } catch (e) {} };
  if (document.fullscreenElement) { lockKeys(); return Promise.resolve(); }
  try { const r = document.documentElement.requestFullscreen({ navigationUI: 'hide' }); return (r && r.then) ? r.then(lockKeys, () => {}) : Promise.resolve(); } catch (e) { return Promise.resolve(); }
}
function lockPointer() {
  if (!document.fullscreenElement && !TOUCH && Settings.get().fullscreen !== false) { enterFullscreen().then(() => lockPointerNow()); return; }
  lockPointerNow();
}
// Esc i spillet: med tastaturlåsen kommer Esc til siden – åbn/luk pausemenuen selv (menuer/købshjul/chat lukker deres egne ting)
window.addEventListener('keydown', e => {
  if (e.code !== 'Escape' || Game.state !== 'game' || e.repeat) return;
  if (Chat.isOpen()) { e.preventDefault(); return; }                                         // Esc lukker ikke chatten (Enter på tom linje gør)
  if (uiOpen() || BuyMenu.open) return;
  e.preventDefault();
  if (document.pointerLockElement) exitPointerLock(); else if (!TOUCH) lockPointer();
});
function lockPointerNow() {
  const gl = $('gl'), raw = !!Settings.get().raw;
  try {
    const r = raw ? gl.requestPointerLock({ unadjustedMovement: true }) : gl.requestPointerLock();
    if (r && r.catch) r.catch(() => { if (raw) { try { const r2 = gl.requestPointerLock(); if (r2 && r2.catch) r2.catch(() => {}); } catch (e) {} } });
  } catch (e) { try { gl.requestPointerLock(); } catch (e2) {} }
}

/* ==========================================================================
   MENU-SKÆRM
   ========================================================================== */
const UI = {
  toast(msg, ms = 3200) {
    const el = $('toast'); el.textContent = msg; el.classList.remove('hidden');
    clearTimeout(this._tt); this._tt = setTimeout(() => el.classList.add('hidden'), ms);
  },
  menuErr(msg) { $('menuErr').textContent = msg || ''; },
  showScreen(which) {
    $('scr-menu').classList.toggle('hidden', which !== 'menu');
    $('scr-lobby').classList.toggle('hidden', which !== 'lobby');
    Settings.close();
    $('hud').classList.toggle('hidden', which !== 'game');
    if (which === 'menu') Logo3D.start(); else Logo3D.stop();          // v20: medaljonen tegnes kun når forsiden vises
    // v20: menumusik i menu/lobby (sejrsmusikken får lov at spille færdig over lobbyen), stilhed i spillet
    if (which === 'game') Audio.stopMusic(1.2);
    else if (!Audio.musicPlaying('music_win')) Audio.playMusic('music_menu', { loop: true, fade: 1.5, vol: 0.85 });
  }
};
Audio.playMusic('music_menu', { loop: true, fade: 2, vol: 0.85 });     // starter ved første klik/tast hvis browseren blokerer autoplay
// v20: logoet som 3D-medaljon på forsiden (SUPERHOT: tiden går når du bevæger musen)
const Logo3D = createLogo3D(THREE, $('logo3d'), $('logoSlot'));
if (!$('scr-menu').classList.contains('hidden')) Logo3D.start();
{ const lg = document.querySelector('#scr-menu .logo'); if (lg) lg.dataset.g = lg.textContent.replace('▮', ''); }

function loadName() { try { return localStorage.getItem('wd_name') || ''; } catch (e) { return ''; } }
function saveName(n) { try { localStorage.setItem('wd_name', n); } catch (e) {} }
function loadSession() { try { return JSON.parse(localStorage.getItem('wd_session') || 'null'); } catch (e) { return null; } }
function saveSession(s) { try { localStorage.setItem('wd_session', JSON.stringify(s)); } catch (e) {} }
function clearSession() { try { localStorage.removeItem('wd_session'); } catch (e) {} }

$('nameInput').value = loadName();
$('btnShowJoin').addEventListener('click', () => {
  $('joinRow').classList.toggle('hidden');
  if (!$('joinRow').classList.contains('hidden')) $('codeInput').focus();
});
$('codeInput').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });
$('codeInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnJoin').click(); });
$('nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnCreate').click(); });
window.addEventListener('pointerdown', () => Audio.init(), { capture: true });
window.addEventListener('keydown', () => Audio.init(), { capture: true });

$('btnCreate').addEventListener('click', async () => {
  UI.menuErr('');
  const name = $('nameInput').value.trim() || 'Spiller'; saveName(name);
  try { if (!Net.connected) await Net.connect(); } catch (e) { return UI.menuErr('Kunne ikke forbinde til serveren.'); }
  Net.send({ t: 'create', name });
});
$('btnJoin').addEventListener('click', async () => {
  UI.menuErr('');
  const code = $('codeInput').value.trim();
  if (!/^\d{4}$/.test(code)) return UI.menuErr('Indtast en 4-cifret kode.');
  const name = $('nameInput').value.trim() || 'Spiller'; saveName(name);
  try { if (!Net.connected) await Net.connect(); } catch (e) { return UI.menuErr('Kunne ikke forbinde til serveren.'); }
  Net.send({ t: 'join', code, name });
});
$('btnLeave').addEventListener('click', () => { clearSession(); location.reload(); });
$('btnSettings').addEventListener('click', () => Settings.open());
$('btnSettingsGame').addEventListener('click', e => { e.stopPropagation(); Settings.open(); });
for (const id of ['btnInventory', 'btnInventoryLobby']) $(id).addEventListener('click', () => Inv.open());
$('btnInventoryGame').addEventListener('click', e => { e.stopPropagation(); if (document.pointerLockElement) document.exitPointerLock(); Inv.open(); });
$('btnStart').addEventListener('click', () => Net.send({ t: 'start' }));
$('btnTeamHij').addEventListener('click', () => Net.send({ t: 'team', side: 'hij' }));
$('btnTeamSwat').addEventListener('click', () => Net.send({ t: 'team', side: 'swat' }));
$('btnTeamAuto').addEventListener('click', () => Net.send({ t: 'team', side: null }));
Net.on('notice', m => UI.toast(m.msg, 3500));
/* ---------------- v17: chat (Y = alle, U = holdet, Enter sender, Esc lukker) ---------------- */
const Chat = {
  _open: false, team: false,
  isOpen() { return this._open; },
  open(team) {
    if (this._open || Game.state !== 'game') return;
    this._open = true; this.team = !!team;
    for (const k in KEY) KEY[k] = false; Game.firing = false;
    $('chat').classList.add('open'); $('chatRow').classList.remove('hidden');
    const md = $('chatMode'); md.textContent = team ? 'HOLD' : 'ALLE'; md.classList.toggle('team', !!team);
    const inp = $('chatInput'); inp.value = ''; setTimeout(() => inp.focus(), 0);
  },
  close() { if (!this._open) return; this._open = false; $('chat').classList.remove('open'); $('chatRow').classList.add('hidden'); $('chatInput').blur(); if (Game.state === 'game' && !TOUCH && !uiOpen()) lockPointer(); },
  send() { const v = $('chatInput').value.trim(); if (v) Net.send({ t: 'chat', s: v.slice(0, 120), tm: this.team ? 1 : 0 }); this.close(); },
  add(m) {
    const log = $('chatLog'), line = document.createElement('div'); line.className = 'chat-line';
    const tag = (m.dead ? '*DØD* ' : '') + (m.tm ? '(HOLD) ' : '');
    if (tag) { const t = document.createElement('span'); t.className = 'tag'; t.textContent = tag; line.appendChild(t); }
    const n = document.createElement('span'); n.className = 'cn ' + (m.side || 'none'); n.textContent = m.n; line.appendChild(n);
    line.appendChild(document.createTextNode(': ' + m.s));                // tekst som tekst – aldrig HTML
    log.appendChild(line); while (log.children.length > 9) log.removeChild(log.firstChild);
    setTimeout(() => line.classList.add('old'), 10000);
  }
};
Net.on('chat', m => Chat.add(m));
$('chatInput').addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Enter') { e.preventDefault(); Chat.send(); } else if (e.key === 'Escape') e.preventDefault();   // v17: Esc lukker ikke chatten (Mac: ville forlade fuldskærm) – Enter på tom linje lukker
});
Net.on('pong', m => { const rtt = performance.now() - m.c; if (rtt >= 0 && rtt < 5000) Game.ping = Game.ping ? Game.ping * 0.6 + rtt * 0.4 : rtt; });
Net.on('cos', m => { const e = Game.players.get(m.id); if (e) e.cos = SK.sanitize(m.c); });   // en anden spiller skiftede agent/skins

/* ---- v12.1: radar/minimap for baner bygget af bokse: gulve i lagets højdebånd (lyse), ramper, mure ovenpå (mørke) ---- */
function drawBoxLayer(c, L, S, ox, oz, top, Wm) {
  Wm = Wm || W;
  const inBand = y => y >= L.yb - 0.05 && y < L.yt;
  c.fillStyle = top ? 'rgba(236,236,232,.95)' : 'rgba(200,214,222,.92)';
  for (const b of Wm.boxes) if (b.kind === 'floor' && inBand(b.y1) && b.y1 < L.yt - 1.5) c.fillRect(b.x0 * S + ox, b.z0 * S + oz, (b.x1 - b.x0) * S + 0.6, (b.z1 - b.z0) * S + 0.6);
  for (const r of Wm.ramps) if (inBand(Math.max(r.ya, r.yb)) || inBand(Math.min(r.ya, r.yb))) { c.fillStyle = 'rgba(205,205,200,.95)'; c.fillRect(r.bx0 * S + ox, r.bz0 * S + oz, (r.bx1 - r.bx0) * S, (r.bz1 - r.bz0) * S); }
  c.fillStyle = 'rgba(40,42,44,.9)';
  for (const b of Wm.boxes) if (b.kind === 'wall' && b.y1 > L.yb + 1 && b.y1 - Math.max(b.y0, L.yb) > 0.8 && (top ? b.y1 > 0.5 : b.y0 > -12 && b.y1 < 0.5 && b.y1 > L.yb + 1)) c.fillRect(b.x0 * S + ox, b.z0 * S + oz, (b.x1 - b.x0) * S + 0.4, (b.z1 - b.z0) * S + 0.4);
}
/* ---- map pool: kort med radar-forhåndsvisning (tegnet fra banens geometri) ---- */
/* ---- v16: rene radarbilleder (tools/radar/ – nåbare flader, lige kanter, højdeniveauer; Canals bruger den rigtige CS-radar) ---- */
const RADAR = {};
function radarImages(id, done) {
  if (RADAR[id]) { if (!RADAR[id].ready && done) RADAR[id].cbs.push(done); return RADAR[id].ready ? RADAR[id] : null; }   // klar: brug direkte (ingen genkald)
  const R = RADAR[id] = { ready: false, cbs: done ? [done] : [], meta: null, imgs: [] };
  fetch('/assets/radar/' + id + '.json').then(r => r.ok ? r.json() : null).then(meta => {
    if (!meta) return;
    R.meta = meta; let left = meta.layers.length;
    meta.layers.forEach((L, i) => { const im = new Image(); im.onload = () => { if (--left === 0) { R.ready = true; R.cbs.forEach(f => f(R)); R.cbs = []; } }; im.src = '/assets/radar/' + L.img; R.imgs[i] = im; });
  }).catch(() => {});
  return null;
}
// tegner radarlaget for højden y (eller øverste lag) i et koordinatsystem hvor verdens (x, z) → (x·S + ox, z·S + oz)
function drawRadarImage(c, R, S, ox, oz, li) {
  const m = R.meta, L = m.layers[li], im = R.imgs[li]; if (!L || !im) return false;
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(im, m.x0 * S + ox, m.z0 * S + oz, L.w * m.scale * S, L.h * m.scale * S); return true;
}
function drawRadar(canvas, mapId) {
  const RI = radarImages(mapId, () => drawRadar(canvas, mapId));
  if (RI) {
    const Wm = WD.buildWorld(mapId), c = canvas.getContext('2d'), b = Wm.bounds, S = Math.min(canvas.width / (b.x1 - b.x0), canvas.height / (b.z1 - b.z0)) * 0.94;
    const ox = canvas.width / 2 - (b.x0 + b.x1) / 2 * S, oz = canvas.height / 2 - (b.z0 + b.z1) / 2 * S;
    c.fillStyle = '#1b1d1f'; c.fillRect(0, 0, canvas.width, canvas.height);
    for (let li = 0; li < RI.meta.layers.length; li++) { c.globalAlpha = li === RI.meta.layers.length - 1 ? 1 : 0.55; drawRadarImage(c, RI, S, ox, oz, li); }
    c.globalAlpha = 1;
    if (!RI.meta.labels) {
      c.strokeStyle = '#ff2b1f'; c.lineWidth = 2;
      for (const k in Wm.sites) { const s = Wm.sites[k]; c.strokeRect(s.x0 * S + ox, s.z0 * S + oz, (s.x1 - s.x0) * S, (s.z1 - s.z0) * S); c.fillStyle = '#ff2b1f'; c.font = '900 14px Arial'; c.fillText(k, s.x0 * S + ox + 3, s.z0 * S + oz + 14); }
    }
    for (const [side, colr] of [['hij', '#ff5a40'], ['swat', '#4a8cff']]) { const p = Wm.spawns[side][0]; c.fillStyle = colr; c.beginPath(); c.arc(p.x * S + ox, p.z * S + oz, 4, 0, 7); c.fill(); }
    return;
  }
  drawRadarOld(canvas, mapId);
}
function drawRadarOld(canvas, mapId) {
  const Wm = WD.buildWorld(mapId), c = canvas.getContext('2d'), b = Wm.bounds, S = Math.min(canvas.width / (b.x1 - b.x0), canvas.height / (b.z1 - b.z0)) * 0.94;
  const ox = canvas.width / 2 - (b.x0 + b.x1) / 2 * S, oz = canvas.height / 2 - (b.z0 + b.z1) / 2 * S;
  c.fillStyle = '#1b1d1f'; c.fillRect(0, 0, canvas.width, canvas.height);
  const Tt = Wm.tile;
  Wm.layers.forEach((L, li) => {
    const top = li === Wm.layers.length - 1;
    if (Wm.data) { drawBoxLayer(c, L, S, ox, oz, top, Wm); return; }
    for (let r = 0; r < Tt.GH; r++) for (let q = 0; q < Tt.GW; q++) {
      const t = L.tiles[L.grid[r][q]]; if (!t || t.solid || t.void) continue;
      c.fillStyle = top ? '#cfd0cb' : 'rgba(120,150,170,.55)';
      c.fillRect(Math.floor((Tt.GX0 + q * Tt.TILE) * S + ox), Math.floor((Tt.GZ0 + r * Tt.TILE) * S + oz), Math.ceil(Tt.TILE * S), Math.ceil(Tt.TILE * S));
    }
  });
  c.strokeStyle = '#ff2b1f'; c.lineWidth = 2;
  for (const k in Wm.sites) { const s = Wm.sites[k]; c.strokeRect(s.x0 * S + ox, s.z0 * S + oz, (s.x1 - s.x0) * S, (s.z1 - s.z0) * S); c.fillStyle = '#ff2b1f'; c.font = '900 14px Arial'; c.fillText(k, s.x0 * S + ox + 3, s.z0 * S + oz + 14); }
  for (const [side, colr] of [['hij', '#ff5a40'], ['swat', '#4a8cff']]) { const p = Wm.spawns[side][0]; c.fillStyle = colr; c.beginPath(); c.arc(p.x * S + ox, p.z * S + oz, 4, 0, 7); c.fill(); }
}
function renderMapCards(maps, cur, amHost) {
  const box = $('mapCards');
  if (box.childElementCount !== maps.length) {
    box.innerHTML = '';
    for (const mp of maps) {
      const b = document.createElement('button'); b.className = 'map-card'; b.dataset.id = mp.id;
      const cv = document.createElement('canvas'); cv.width = 160; cv.height = 160; b.appendChild(cv);
      const nm = document.createElement('div'); nm.className = 'mc-name'; nm.innerHTML = `<span>de_${mp.id}</span>`; b.appendChild(nm);
      b.addEventListener('click', () => { if (Game.host === Game.meId) Net.send({ t: 'map', id: mp.id }); });
      box.appendChild(b);
      try { drawRadar(cv, mp.id); } catch (e) { /* forhåndsvisning er kun pynt */ }
    }
  }
  const veto = Game.vetoMode !== false;
  for (const b of box.children) { b.classList.toggle('sel', !veto && b.dataset.id === cur); b.disabled = !amHost || veto; }
  $('mapHostHint').textContent = veto ? 'holdene stemmer baner ud når spillet startes' : amHost ? 'klik for at vælge bane' : 'værten vælger banen';
  for (const b of document.querySelectorAll('[data-vmode]')) { b.classList.toggle('sel', (b.dataset.vmode === 'premier') === veto); b.disabled = !amHost; }
  const mp = maps.find(m => m.id === cur); $('mapDesc').textContent = mp ? mp.desc || '' : '';
}

/* ---- match-kontrol i pause-menuen (Esc): kun værten kan genstarte/afslutte ---- */
function refreshMatchButtons() {
  const host = Game.host === Game.meId;
  $('btnRestart').classList.toggle('hidden', !host); $('btnEndGame').classList.toggle('hidden', !host);
}
function confirmBtn(id, action) {
  const b = $(id); b.dataset.l = b.textContent; let t = 0;
  b.addEventListener('click', e => {
    e.stopPropagation();
    if (t) { clearTimeout(t); t = 0; b.textContent = b.dataset.l; action(); return; }
    b.textContent = 'SIKKER? KLIK IGEN'; t = setTimeout(() => { t = 0; b.textContent = b.dataset.l; }, 3000);
  });
}
confirmBtn('btnRestart', () => { Net.send({ t: 'restart' }); lockPointer(); });
confirmBtn('btnEndGame', () => Net.send({ t: 'endgame' }));
confirmBtn('btnLeaveGame', () => { clearSession(); location.reload(); });
// tilbage til venteværelset (slut på kamp / værten afsluttede)
function leaveGameView() {
  try { if (Victory.active) Victory.hide(); } catch (e) {}
  Game.state = 'lobby'; Game.scoped = false; Game.firing = false; Game.reloading = null; Game.phase = 'lobby'; Game.nade = null; endFlash();
  Game.snapBuf.length = 0; Game.remotes.clear(); Game.drops = []; Game.specId = 0; Game.clk = null; Game.eco = null;
  Audio.stopAmbience(); HUD.hideRoundEnd(); for (const h of Game.hurts) h.el.remove(); Game.hurts.length = 0;
  for (const id of ['gameOverBanner', 'roundBanner', 'deadOverlay', 'scoreboard', 'buyHint', 'scopeOv', 'burnOv']) $(id).classList.add('hidden');
  BuyMenu.hide();
  $('clickToPlay').classList.add('hidden'); hideActBar(); Touch.hide();
  UI.showScreen('lobby'); exitPointerLock();
}
$('btnCopyCode').addEventListener('click', async () => {
  const url = location.origin + '/?join=' + Game._lobbyCode;
  try { await navigator.clipboard.writeText(url); UI.toast('Link kopieret!'); } catch (e) { UI.toast(url, 6000); }
});

Net.on('err', m => {
  if (m.kicked) Game.kickedAt = performance.now();
  else if (Game.kickedAt && performance.now() - Game.kickedAt < 5000) return;     // automatisk genforbindelse efter kick: behold kick-beskeden
  UI.menuErr(m.msg);
  if (m.fatal) { clearSession(); if (Game.state !== 'lobby' && Game.state !== 'menu') try { leaveGameView(); } catch (e) {} UI.showScreen('menu'); if (m.kicked) UI.toast(m.msg, 5000); }
});
Net.on('joined', m => {
  Game.meId = m.id;
  Game._lobbyCode = m.code;
  Net.session = { code: m.code, id: m.id, key: m.key };
  saveSession(Net.session);
  UI.menuErr('');
});
/* ---- v20: PREMIER-banevalg (holdene bandlyser baner på skift; den sidste spilles) ---- */
for (const b of document.querySelectorAll('[data-vmode]')) b.addEventListener('click', () => { if (Game.host === Game.meId) Net.send({ t: 'vmode', mode: b.dataset.vmode }); });
const Veto = { last: null, end: 0, raf: 0, total: 15000 };
function hideVeto() { $('veto').classList.add('hidden'); $('veto').classList.remove('done'); cancelAnimationFrame(Veto.raf); Veto.last = null; }
Net.on('veto', m => {
  const el = $('veto'), box = $('vetoCards'), first = el.classList.contains('hidden');
  el.classList.remove('hidden');
  const mySide = m.teams.hij.includes(Game.meId) ? 'hij' : m.teams.swat.includes(Game.meId) ? 'swat' : null;
  const myTurn = !m.final && mySide === m.turn, myVote = m.my[Game.meId];
  if (first || box.childElementCount !== m.pool.length) {
    box.innerHTML = '';
    for (const id of m.pool) {
      const b = document.createElement('button'); b.className = 'vcard'; b.dataset.id = id;
      const cv = document.createElement('canvas'); cv.width = 200; cv.height = 200; b.appendChild(cv);
      b.insertAdjacentHTML('beforeend', `<div class="vc-name"><span>de_${id}</span><span class="vc-votes hidden"></span></div>`);
      b.addEventListener('click', () => { if (b.classList.contains('can')) { Net.send({ t: 'vban', id }); Audio.click('buy'); } });
      box.appendChild(b); try { drawRadar(cv, id); } catch (e) {}
    }
  }
  const banned = Object.fromEntries(m.banned.map(b => [b.id, b]));
  const newBan = Veto.last && m.banned.length > Veto.last.banned.length ? m.banned[m.banned.length - 1].id : null;
  for (const b of box.children) {
    const id = b.dataset.id, bn = banned[id], n = (m.votes || {})[id] || 0;
    b.classList.toggle('banned', !!bn); b.classList.toggle('can', myTurn && !bn); b.classList.toggle('mine', myVote === id && !bn);
    b.classList.toggle('last', m.final === id);
    let tag = b.querySelector('.vc-ban'); if (bn && !tag) { tag = document.createElement('div'); b.appendChild(tag); }
    if (tag) { tag.className = 'vc-ban ' + (bn ? bn.by : ''); tag.textContent = bn ? (bn.by === 'hij' ? 'HIJACKERS' : 'SWAT') + (bn.auto ? ' · TID' : '') : ''; tag.classList.toggle('hidden', !bn); }
    const vv = b.querySelector('.vc-votes'); vv.textContent = n + (n === 1 ? ' stemme' : ' stemmer'); vv.classList.toggle('hidden', !n || !!bn || !!m.final);
    if (id === newBan) { b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); Audio.click('clank'); }
  }
  const tn = $('vetoTurn');
  if (m.final) { tn.className = 'veto-turn'; tn.textContent = 'BANEN ER VALGT'; }
  else { tn.className = 'veto-turn ' + m.turn + (myTurn ? ' mine' : ''); tn.textContent = (m.turn === 'hij' ? 'HIJACKERS' : 'SWAT') + ' BANDLYSER'; }
  $('vetoHint').textContent = m.final ? '' : myTurn ? 'Klik på en bane for at stemme den ud – holdets flertal afgør. Ingen stemmer = tilfældig.' : mySide ? 'Det andet hold vælger hvilken bane der ryger…' : '';
  el.classList.toggle('done', !!m.final);
  $('vetoFinal').classList.toggle('hidden', !m.final);
  if (m.final && (!Veto.last || !Veto.last.final)) { $('vetoFinalName').textContent = 'DE_' + m.final.toUpperCase(); Audio.click('kill'); }
  Veto.end = performance.now() + m.ms; Veto.total = m.final ? 3200 : 15000; Veto.last = m;
  cancelAnimationFrame(Veto.raf);
  const tick = () => { const f = Math.max(0, (Veto.end - performance.now()) / Veto.total); $('vetoBar').style.width = (f * 100).toFixed(1) + '%'; if (f > 0) Veto.raf = requestAnimationFrame(tick); };
  tick();
});
// v20: kick (kun værten ser knappen; serveren tjekker også)
$('scr-lobby').addEventListener('click', e => {
  const b = e.target.closest('[data-kick]'); if (!b) return;
  const id = +b.dataset.kick, pl = Game.players.get(id);
  if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'SIKKER?'; setTimeout(() => { if (b.isConnected) { b.dataset.confirm = ''; b.textContent = 'KICK'; } }, 2500); return; }
  Net.send({ t: 'kick', id }); b.disabled = true; if (pl) UI.toast(pl.name + ' er smidt ud');
});
Net.on('lobby', m => {
  Game.host = m.host;
  refreshMatchButtons();
  if (m.ph && m.ph !== 'lobby') return;     // værtsskifte midt i spillet: kun rolle-opdatering
  Game.players.clear();
  m.players.forEach(p => Game.players.set(p.id, { name: p.name, side: null, cos: SK.sanitize(p.cos) }));
  if (!Game.cosSent) { Game.cosSent = true; Net.send({ t: 'cos', c: Inv.get() }); }   // mit inventar til de andre spillere
  if (Game.state !== 'lobby') leaveGameView();
  $('lobbyCode').textContent = m.code;
  const lists = { hij: $('listHij'), swat: $('listSwat'), none: $('lobbyList') }, cnt = { hij: 0, swat: 0, none: 0 };
  for (const k in lists) lists[k].innerHTML = '';
  Game.myTeam = null;
  for (const p of m.players) {
    const k = p.team || 'none'; cnt[k]++;
    if (p.id === Game.meId) Game.myTeam = p.team || null;
    const li = document.createElement('li');
    li.innerHTML = `<span>${escapeHtml(p.name)}${p.id === Game.meId ? ' <i style="opacity:.55">(dig)</i>' : ''}</span>` + (p.id === m.host ? '<span class="host-tag">VÆRT</span>' : '')
      + (m.host === Game.meId && p.id !== Game.meId ? `<button class="kick-btn" data-kick="${p.id}" title="Smid ${escapeHtml(p.name)} ud af partyet">KICK</button>` : '');   // v20: kun værten kan kicke
    lists[k].appendChild(li);
  }
  const cap = m.cap || 5;
  $('cntHij').textContent = cnt.hij + '/' + cap; $('cntSwat').textContent = cnt.swat + '/' + cap;
  $('btnTeamHij').classList.toggle('sel', Game.myTeam === 'hij'); $('btnTeamSwat').classList.toggle('sel', Game.myTeam === 'swat');
  $('btnTeamAuto').classList.toggle('hidden', !Game.myTeam);
  // hold-balance: simulér automatisk fordeling af dem uden hold
  let h = cnt.hij, sw = cnt.swat; for (let i = 0; i < cnt.none; i++) { if (h <= sw) h++; else sw++; }
  const bal = $('lobbyBalance'), total = m.players.length;
  let msg = '', warn = false;
  if (total > 1 && (!h || !sw)) { msg = 'Begge hold skal have mindst én spiller'; warn = true; }
  else if (Math.abs(h - sw) >= 2) { msg = 'Ulige hold: ' + h + ' mod ' + sw; warn = true; }
  else if (total > 1) msg = 'Holdene er balancerede (' + h + ' mod ' + sw + ')';
  bal.textContent = msg; bal.classList.toggle('warn', warn);
  const amHost = m.host === Game.meId;
  Game.vetoMode = m.veto !== false; hideVeto();
  if (m.maps) { Game.maps = m.maps; renderMapCards(m.maps, m.map, amHost); }
  $('btnStart').classList.toggle('hidden', !amHost);
  $('lobbyHint').textContent = amHost ? (total < 2 ? 'Vent på flere spillere, eller start alene for at teste.' : 'Klar til at starte!') : 'Venter på at værten starter spillet…';
});

/* ==========================================================================
   RUNDE / SELV / HANDLINGER
   ========================================================================== */
Net.on('round', m => {
  if (m.map) setMap(m.map);
  if (Game.state !== 'game') enterGame();
  Game.phase = m.ph; Game.phaseEnd = performance.now() + m.ms; Game.round = m.n; Game.score = m.score; Game.half = m.half;
  m.players.forEach(p => { const e = Game.players.get(p.id) || {}; e.name = p.name; e.side = p.side; if (p.cos) e.cos = SK.sanitize(p.cos); Game.players.set(p.id, e); });
  const me = Game.players.get(Game.meId); if (me) Game.side = me.side;
  $('roundBanner').classList.add('hidden'); HUD.hideRoundEnd(); showLoadWait();
  if (m.ph === 'buy' && Game.lastRoundN !== m.n) { Game.lastRoundN = m.n; Audio.music('start'); }
  Game.stabbing = false; Game.hurts.length = 0;
  Game.reloading = null; Game.firing = false; Game.scoped = false; Game.nade = null; Game.sprayN = 0; Game.punch.yaw = Game.punch.pitch = 0; endFlash();
  hideActBar(); BuyMenu.build();
  Renderer.onRoundStart();
});
/* v20: sejrs-sekvens når kampen er vundet (victory.js) */
const Victory = createVictory({ Audio, $, esc: escapeHtml, onHide: () => { document.body.classList.remove('cine'); try { Renderer.setCine(false); } catch (e) {} } });
function startVictory(m) {
  for (const id of ['scoreboard', 'deadOverlay', 'roundBanner', 'buyHint']) $(id).classList.add('hidden');
  BuyMenu.hide(); HUD.hideRoundEnd(); exitPointerLock();
  document.body.classList.add('cine'); try { Renderer.setCine(true); } catch (e) {}
  Victory.show(m, Game.meId);
}
$('vcSkip').addEventListener('click', () => { Victory.hide(); Audio.stopMusic(2.5); });
/* v20: spillet starter først når alle har indlæst banen – serveren sender 'load', klienten svarer 'loaded' når bane, figurer og lyde er klar */
let audioReady = false;
Audio.loaded.then(() => { audioReady = true; tryLoadAck(); });
setTimeout(() => { audioReady = true; tryLoadAck(); }, 20000);           // lyd må aldrig blokere spillet helt
Net.on('load', m => {
  hideVeto(); if (Victory.active) Victory.hide();
  if (m.map) setMap(m.map);
  Game.phase = 'loading'; Game.loadAcked = false; Game.round = 0;
  m.players.forEach(p => { const e = Game.players.get(p.id) || {}; e.name = p.name; e.side = p.side; if (p.cos) e.cos = SK.sanitize(p.cos); Game.players.set(p.id, e); });
  const me = Game.players.get(Game.meId); if (me) Game.side = me.side;
  if (Game.state !== 'game') enterGame();
  Renderer.chars();                                                    // figurer/knive hentes nu (ikke først når de ses)
  Game.loadReady = m.ready || []; Game.loadN = m.players.length;
  showLoadWait(); tryLoadAck();
});
Net.on('loadst', m => { Game.loadReady = m.ready || []; Game.loadN = m.n; showLoadWait(); });
function showLoadWait() {
  if (Game.phase !== 'loading') { $('loadingMap').classList.add('hidden'); $('loadingMap').classList.remove('wait'); return; }
  const n = Game.loadN || 1, k = Math.min(n, (Game.loadReady || []).length);
  $('loadingMap').classList.remove('hidden'); $('loadingMap').classList.add('wait');
  $('loadingMap').querySelector('.lm-title').textContent = Game.loadAcked ? 'VENTER PÅ SPILLERE' : 'INDLÆSER BANEN';
  $('loadingMapName').textContent = 'de_' + W.id + ' · ' + k + ' / ' + n + ' klar' + (Game.loadAcked ? ' – kampen starter når alle har indlæst banen' : '');
  $('loadingMap').style.setProperty('--lm-p', (k / n).toFixed(3));
}
function tryLoadAck() {
  if (Game.phase !== 'loading' || Game.loadAcked) return;
  if (!inited3d || !Renderer.mapReady() || !Renderer.cosReady() || !audioReady) { showLoadWait(); return; }
  Game.loadAcked = true; Net.send({ t: 'loaded' }); showLoadWait();
}
Net.on('tp', m => {
  if (m.id < Game.corrId) return;
  Game.corrId = m.id;
  Game.body.onLadder = false; Game.body.x = m.x; Game.body.y = m.y; Game.body.z = m.z; Game.body.vx = 0; Game.body.vy = 0; Game.body.vz = 0; Game.body.ground = true;
  Game.yaw = m.yaw; Game.pitch = 0;
});
Net.on('self', m => {
  const prev = Game.self;
  Game.self = m; Game.side = m.side;
  if (prev && prev.cur !== m.cur) { Renderer.onWeaponChange(); Game.nade = null; Game.sprayN = 0; }
  else if (prev && m.cur && WEAPONS[m.cur] && WEAPONS[m.cur].kind === 'nade' && prev.inv && m.inv && (m.inv[m.cur] || 0) < (prev.inv[m.cur] || 0)) Renderer.onWeaponChange();   // næste granat af samme type trækkes frem
  if (prev && prev.side !== m.side) BuyMenu.build();
  HUD.updateSelf();
});
Net.on('act', m => {
  Game.act = m.k; Game.actDur = m.dur || 1; Game.actStart = performance.now();
  if (!m.k) hideActBar();
});
Net.on('sb', m => HUD.renderScoreboard(m.p));
Net.on('eco', m => { Game.eco = m; if (BuyMenu.open) BuyMenu.renderEco(); });

/* ---- events (ev) ---- */
Net.on('ev', m => {
  switch (m.k) {
    case 'shot': Renderer.onShotFx(m); break;
    case 'hit': HUD.hitmarker(m.kill, m.hs); Renderer.flinchAim(); Audio.click(m.knife ? 'flesh' : m.hs ? 'hs' : 'hit'); if (m.kill) Audio.click('kill'); break;
    case 'hurt': HUD.damageIndicator(m.dx, m.dz, m.dmg); Renderer.shake(m.hs ? 0.3 : 0.18); break;
    case 'kill': HUD.killfeed(m); if (m.v === Game.meId) { HUD.showDead(); Game.nade = null; Game.firing = false; } break;
    case 'end': HUD.roundEnd(m); break;
    case 'pay': HUD.pay(m); break;
    case 'over': startVictory(m); break;
    case 'half': UI.toast('HALVLEG — I skifter side'); Audio.announce('Switching sides'); break;
    case 'plant': Renderer.onPlant(m); UI.toast('Bomben er plantet på site ' + m.site + '!'); Audio.announce('Bomb has been planted', { hi: true }); Audio.music('planted'); break;
    case 'defuse': UI.toast('Bomben er desarmeret!'); Audio.announce('Bomb has been defused'); break;
    case 'melee': Renderer.onRemoteMelee(m); break;
    case 'mwall': Renderer.onMeleeWall(m); break;
    case 'picked': Audio.click('pickup'); break;
    case 'explode': Renderer.onExplode(m); break;
    case 'bombdrop': case 'bombpick': break;
    case 'boom': Renderer.onBoom(m); break;
    case 'smoke': Renderer.onSmokePop(m); break;
    case 'flash': Renderer.onFlashPop(m); break;
    case 'flashed': if (Game.self.alive) startFlash(m.dur, !!m.full); break;
    case 'fire': Renderer.onFirePop(m); break;
    case 'fireout': Renderer.onFireOut(m); break;
    case 'fizzle': Audio.fizzle({ x: m.x, y: m.y, z: m.z }); break;
    case 'bounce': Audio.bounce({ x: m.x, y: m.y, z: m.z }, m.w); break;
    case 'burn': HUD.burn(); break;
    case 'throw': Renderer.onRemoteThrow(m); break;
  }
});

/* ---- snapshot ---- */
Net.on('s', m => {
  // v12: servertids-offset (min-filter: forsinkede pakker trækker ikke uret) → interpolation på servertid i stedet for modtagetid
  const pn = performance.now(), off = m.st - pn;
  if (Game.clk === null || Math.abs(off - Game.clk) > 1000) Game.clk = off;
  else Game.clk += (off - Game.clk) * (off > Game.clk ? 0.25 : 0.015);
  if (Game.phase !== 'end' && m.ph === 'end' && !Game.endT) Game.endT = pn;
  if (m.ph !== 'end') Game.endT = 0;
  Game.phase = m.ph; Game.phaseEnd = performance.now() + m.pl; Game.round = m.r; Game.score = m.sc;
  Game.bomb = { state: m.b[0], x: m.b[1], y: m.b[2], z: m.b[3], msLeft: m.b[4], carrier: m.b[5], defFrac: m.b[6] };
  Game.drops = m.d || [];
  Game.buyEnd = performance.now() + (m.bw || 0);
  Game.snapBuf.push({ recv: performance.now(), st: m.st, p: m.p, g: m.g, sm: m.sm, f: m.f || [] });
  while (Game.snapBuf.length > 12) Game.snapBuf.shift();
});

/* ==========================================================================
   INDGANG TIL SPILLET
   ========================================================================== */
var inited3d = false;   // var: læses af applySettings() før denne linje køres
function enterGame() {
  Game.state = 'game';
  UI.showScreen('game');
  Audio.ambience(W.id);
  if (!inited3d) { Renderer.init(); inited3d = true; }
  Input.requestLockSoon();
}

function hideActBar() { $('actBar').classList.add('hidden'); $('promptE').classList.add('hidden'); }

/* ==========================================================================
   INPUT
   ========================================================================== */
const KEY = {};
// v12: 3 = kniv, 4 = bladr gennem granater (CS), 5 = HE, 6 = smoke, 7 = molotov/brandgranat, 8 = flashbang, Q = forrige våben
const NADE_KEYS = { Digit5: ['he'], Digit6: ['smoke'], Digit7: ['molotov', 'incgren'], Digit8: ['flash'] };
const Input = {
  requestLockSoon() { if (TOUCH) { Touch.show(); return; } $('clickToPlay').classList.remove('hidden'); },
  init() {
    window.addEventListener('keydown', e => this._key(e, true));
    window.addEventListener('keyup', e => this._key(e, false));
    window.addEventListener('blur', () => { for (const k in KEY) KEY[k] = false; });
    const gl = $('gl');
    gl.addEventListener('click', () => { if (Game.state === 'game' && !uiOpen() && document.pointerLockElement !== gl) lockPointer(); });
    $('clickToPlay').addEventListener('click', () => { if (uiOpen()) return; if (TOUCH) Touch.resume(); else lockPointer(); });
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === gl;
      $('clickToPlay').classList.toggle('hidden', locked);
      if (!locked) { Game.scoped = false; Game.firing = false; if (!BuyMenu.open) { KEY.KeyW = KEY.KeyA = KEY.KeyS = KEY.KeyD = false; } if (Game.nade) nadeRelease(Game.nade.under); }
      if (!locked && BuyMenu.open) $('clickToPlay').classList.add('hidden');   // købshjulet bruger musemarkøren – ingen 'klik for at sigte'
    });
    document.addEventListener('mousemove', e => {
      if (document.pointerLockElement !== gl) return;
      const mx = e.movementX, my = e.movementY;
      if (!Number.isFinite(mx) || !Number.isFinite(my) || Math.abs(mx) > 900 || Math.abs(my) > 900) return;   // kendt browser-fejl: falske kæmpespring
      MouseIn.x += mx; MouseIn.y += my;                          // lægges på i applyMouse() én gang pr. frame
    });
    gl.addEventListener('mousedown', e => {
      if (document.pointerLockElement !== gl) return;
      if (!Game.self.alive && Game.phase !== 'buy') { cycleSpec(e.button === 2 ? -1 : 1); return; }
      const w = WEAPONS[Game.self.cur];
      if (w && w.kind === 'nade') { if (e.button === 0) nadeStart(false); else if (e.button === 2) nadeStart(true); return; }
      if (w && w.kind === 'knife') { if (e.button === 0) fireStart(); else if (e.button === 2) Game.stabbing = true; return; }
      if (e.button === 0) fireStart(); else if (e.button === 2) toggleScope();
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 2) Game.stabbing = false;
      if (e.button === 0) { fireEnd(); if (Game.nade && !Game.nade.under) nadeRelease(false); }
      else if (e.button === 2 && Game.nade && Game.nade.under) nadeRelease(true);
    });
    gl.addEventListener('wheel', e => {
      if (Game.state !== 'game' || Game.phase === 'buy' || !Game.self.inv || document.pointerLockElement !== gl) return;
      e.preventDefault();
      const order = invOrder();
      if (order.length < 2) return;
      const i = Math.max(0, order.indexOf(Game.self.cur));
      switchWeapon(order[(i + (e.deltaY > 0 ? 1 : -1) + order.length) % order.length]);
    }, { passive: false });
    gl.addEventListener('contextmenu', e => e.preventDefault());
  },
  _key(e, down) {
    const k = e.code;
    if (down && !uiOpen() && Game.state === 'game' && (k === 'KeyY' || k === 'KeyU') && !e.repeat) { e.preventDefault(); Chat.open(k === 'KeyU'); return; }
    if (uiOpen()) return;                                           // indstillinger/inventar åbne: ingen spil-input
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyR', 'KeyE', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'KeyC', 'Tab', 'KeyB', 'KeyF', 'KeyQ', 'ArrowLeft', 'ArrowRight',
      'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Backspace', 'KeyG'].includes(k) && Game.state === 'game') e.preventDefault();
    KEY[k] = down;
    if (!down) return;
    if (Game.state !== 'game') return;
    if (!Game.self.alive && Game.phase !== 'buy') { if (k === 'Space' || k === 'ArrowRight') cycleSpec(1); else if (k === 'ArrowLeft') cycleSpec(-1); return; }
    if (k === 'KeyR') startReloadLocal();
    if (k === 'KeyF') { if (Game.self.cur === 'knife') Renderer.inspect(); else toggleScope(); }   // F: scope (AWP) / inspicér kniven
    if (k === 'KeyE') tryPickup();
    if (k === 'KeyB') { BuyMenu.toggle(); return; }
    if (BuyMenu.hotkey(k)) return;
    if (k === 'KeyG') Net.send({ t: 'drop' });
    if (Game.phase !== 'buy' && Game.self.inv) {
      const inv = Game.self.inv;
      if (k === 'Digit1' && inv.primary) switchWeapon(inv.primary);
      if (k === 'Digit2') switchWeapon(inv.pistol);
      if (k === 'Digit3') switchWeapon('knife');
      if (k === 'KeyQ' && Game.lastWeapon) { const lw = Game.lastWeapon, ok = lw === 'knife' || lw === inv.pistol || lw === inv.primary || (inv[lw] > 0); if (ok) switchWeapon(lw); }
      if (k === 'Digit4') {                                        // CS: 4 bladrer gennem granaterne
        const nl = ['flash', 'he', 'smoke', 'molotov', 'incgren'].filter(n => inv[n] > 0);
        if (nl.length) switchWeapon(nl[(nl.indexOf(Game.self.cur) + 1) % nl.length]);
      }
      if (NADE_KEYS[k]) { const id = NADE_KEYS[k].find(n => inv[n] > 0); if (id) switchWeapon(id); }
    }
  }
};
// rækkefølge for musehjul: primær, pistol, flash, HE, smoke, ild
function invOrder() {
  const inv = Game.self.inv || {}, order = [];
  if (inv.primary) order.push(inv.primary);
  order.push(inv.pistol || WD.sidePistol(Game.side));
  order.push('knife');
  for (const n of ['flash', 'he', 'smoke', 'molotov', 'incgren']) if (inv[n] > 0) order.push(n);
  return order;
}
function fireStart() {
  const cur = Game.self.cur, w = WEAPONS[cur];
  if (!w || (w.kind !== 'gun' && w.kind !== 'knife')) return;
  if (Game.reloading && w.kind === 'gun') return;
  Game.firing = true;
}
const endFrozen = () => Game.phase === 'end' && performance.now() - Game.endT < 600;   // v12: kort frys når runden slutter (dramatisk), derefter fri – man kan skyde i pausen
function fireEnd() { Game.firing = false; }
/* ---- granater: hold-og-slip. Trykket trækker splitten (lyd + animation) og opbygger kraft; kastet sker i det øjeblik knappen slippes ---- */
const PIN_TIME = 0.22;                              // splitten skal være ude før granaten kan forlade hånden
function nadeStart(under) {
  if (Game.nade || (Game.phase !== 'live' && Game.phase !== 'end') || !Game.self.alive || Game.reloading) return;
  const w = WEAPONS[Game.self.cur]; if (!w || w.kind !== 'nade' || !(Game.self.inv && Game.self.inv[w.id] > 0)) return;
  Game.nade = { under, t0: performance.now(), id: w.id };
  Audio.pin(); Renderer.onPinPull(under);
}
function nadePower() { return Game.nade ? clamp((performance.now() - Game.nade.t0) / 1000 / WD.THROW.charge, 0, 1) : 0; }
function nadeRelease(under) {
  const n = Game.nade; if (!n || n.under !== under || n.releasing) return;
  const held = (performance.now() - n.t0) / 1000;
  if (held < PIN_TIME) { n.releasing = true; setTimeout(() => { n.releasing = false; if (Game.nade === n) nadeRelease(under); }, (PIN_TIME - held) * 1000 + 5); return; }
  Game.nade = null;
  if (!Game.self.alive || (Game.phase !== 'live' && Game.phase !== 'end') || Game.self.cur !== n.id) return;
  const dir = camForward(), o = camEyePos(), pw = under ? 0 : clamp(held / WD.THROW.charge, 0, 1);
  Net.send({ t: 'throw', o: [o.x, o.y, o.z], d: [dir.x, dir.y, dir.z], pw, u: under ? 1 : 0 });
  Renderer.onThrowLocal(under); Audio.throwSnd(null, true);
}
/* ---- spectator: kun levende holdkammerater ---- */
function specList() {
  const out = [];
  for (const [id, r] of Game.remotes) if (r.alive && id !== Game.meId && (Game.players.get(id) || {}).side === Game.side) out.push(id);
  return out.sort((a, b) => a - b);
}
function cycleSpec(d) {
  const l = specList(); if (!l.length) { Game.specId = 0; return; }
  const i = l.indexOf(Game.specId);
  Game.specId = l[((i < 0 ? (d > 0 ? -1 : 0) : i) + d + l.length) % l.length];
}
/* ---- opsamling af droppede våben (E) ---- */
function nearestDrop() {
  const b = Game.body; let best = null, bd = 1.8;
  for (const d of Game.drops) { const dist = Math.hypot(d[2] - b.x, d[4] - b.z); if (dist < bd && Math.abs(d[3] - b.y) < 1.6) { bd = dist; best = d; } }
  return best;
}
function tryPickup() {
  if (!Game.self.alive || Game.phase === 'lobby' || Game.phase === 'over') return;
  const d = nearestDrop(); if (d) Net.send({ t: 'pickup', i: d[0] });
}
function toggleScope() {
  const w = WEAPONS[Game.self.cur];
  if (!w || !w.scope || !Game.self.alive || Game.phase === 'buy' || Game.reloading) { Game.scoped = false; return; }
  Game.scoped = !Game.scoped;
}
function switchWeapon(id) {
  if (!id || id === Game.self.cur || Game.phase === 'buy' || !Game.self.alive) return;
  Game.lastWeapon = Game.self.cur;
  Game.reloading = null; Game.firing = false; Game.scoped = false; Game.nade = null; Game.sprayN = 0; Game.stabbing = false;
  Game.self.cur = id; HUD.updateSelf(); Renderer.onWeaponChange(); Audio.click('switch');      // optimistisk — serverens 'self' bekræfter/retter
  Net.send({ t: 'sw', w: id });
}
function startReloadLocal() {
  if (Game.reloading || (Game.phase !== 'live' && Game.phase !== 'end') || !Game.self.alive) return;
  const w = WEAPONS[Game.self.cur];
  if (!w || w.kind !== 'gun') return;
  const am = Game.self.ammo && Game.self.ammo[w.id];
  if (!am || am.mag >= w.mag || am.res <= 0) return;
  Game.reloading = { start: performance.now(), dur: w.reload, s1: false, s2: false };
  Game.firing = false; Game.scoped = false;
  Net.send({ t: 'reload' });
}
function exitPointerLock() { if (document.pointerLockElement) document.exitPointerLock(); }
// sigteretning inkl. rekyl-punch (det er her kuglerne går hen – og kameraet/sigtekornet følger med)
function aimYaw() { return Game.yaw + Game.punch.yaw; }
function aimPitch() { return clamp(Game.pitch + Game.punch.pitch, -1.55, 1.55); }
function camForward() {
  const yw = aimYaw(), pt = aimPitch(), cy = Math.cos(yw), sy = Math.sin(yw), cp = Math.cos(pt), sp = Math.sin(pt);
  return { x: -sy * cp, y: sp, z: -cy * cp };
}
function camEyePos() {
  const eye = Game.body.crouch ? PL.EYEC : PL.EYE;
  return { x: Game.body.x, y: Game.body.y + eye, z: Game.body.z };
}
/* ---- flashbang-blænding: intenst hvidt overlay + 'efterbillede' af skærmen, klinger langsomt af; tinnitus + dæmpede spillyde ---- */
function startFlash(dur, full) {
  const now = performance.now(), cur = Game.flash;
  if (cur) { const left = cur.dur - (now - cur.t0) / 1000; if (left > dur) return; }
  Game.flash = { t0: now, dur, full, cap: true };
  Audio.tinnitus(dur, full ? 1 : clamp(dur / 3.5 + 0.25, 0.3, 0.9));
  $('flashOv').classList.remove('hidden');
}
function endFlash() { Game.flash = null; $('flashOv').classList.add('hidden'); $('flashImg').style.opacity = 0; $('flashWhite').style.opacity = 0; }
function updateFlash() {
  const f = Game.flash; if (!f) return;
  const e = (performance.now() - f.t0) / 1000;
  if (e >= f.dur || !Game.self.alive) { endFlash(); return; }
  const hold = f.full ? f.dur * 0.5 : f.dur * 0.18, k = e < hold ? 1 : Math.pow(1 - (e - hold) / (f.dur - hold), 1.7);
  $('flashWhite').style.opacity = (f.full ? 1 : 0.92) * k;
  $('flashImg').style.opacity = Math.min(1, 1.25 * Math.pow(Math.max(0, 1 - e / f.dur), 0.8)) * 0.6;
}

/* ---- v12: mus → kamera én gang pr. frame (valgfri udjævning: tidskonstant = indstillingen i ms) ---- */
function bombCam() {
  return !Game.self.alive && Game.phase !== 'buy' && Game.bomb.state >= 2 && Game.bomb.state <= 4 && !specList().length;
}
function applyMouse(dt) {
  if (!MouseIn.x && !MouseIn.y) return;
  const bc = bombCam();
  if (!(Game.self.alive || Game.phase === 'buy' || bc)) { MouseIn.x = MouseIn.y = 0; return; }   // død: kameraet følger holdkammeraten
  const tau = (Settings.get().smooth || 0) / 1000, k = tau > 0 ? 1 - Math.exp(-dt / tau) : 1;
  let dx = MouseIn.x * k, dy = MouseIn.y * k;
  if (Math.abs(MouseIn.x - dx) < 0.02 && Math.abs(MouseIn.y - dy) < 0.02) { dx = MouseIn.x; dy = MouseIn.y; }
  MouseIn.x -= dx; MouseIn.y -= dy;
  const sens = Settings.sensRad() * (Game.fov / 90);         // Mouse Sensitivity (0,1–10) fra indstillingerne; skaleres med zoom
  if (bc) { Game.specYaw -= dx * sens; Game.specPitch = clamp(Game.specPitch - dy * sens, -1.35, 1.2); return; }
  Game.yaw -= dx * sens;
  Game.pitch = clamp(Game.pitch - dy * sens, -1.55, 1.55);
  Renderer.mouseDelta(dx * sens, dy * sens);
}

/* ==========================================================================
   KØBSMENU
   ========================================================================== */
/* ==========================================================================
   TOUCH (iPad/telefon): venstre side = joystick (opstår hvor man trykker), resten = træk for at kigge.
   SKYD: hold = skyd / spænd granat (slip = kast) – man kan trække på knappen for at sigte samtidig.
   SIGT: AWP-scope, eller blødt underhåndskast med en granat (hold/slip). Pause-knap i stedet for Esc/pointer lock.
   ========================================================================== */
const Touch = {
  mx: 0, my: 0, on: false, el: null, joy: null, look: new Map(),
  build() {
    if (this.el || !TOUCH) return;
    const el = document.createElement('div'); el.id = 'touchUI'; el.className = 'hidden';
    el.innerHTML = `<div class="t-joy hidden"><i></i></div>
      <button class="t-btn t-fire" data-a="fire">SKYD</button><button class="t-btn t-aim" data-a="aim">SIGT</button>
      <button class="t-btn t-jump" data-a="jump">HOP</button><button class="t-btn t-crouch" data-a="crouch">DUK</button>
      <button class="t-btn t-reload" data-a="reload">R</button><button class="t-btn t-use" data-a="use">E</button><button class="t-btn t-switch" data-a="switch">⇄</button>
      <button class="t-btn t-top t-pause" data-a="pause">❚❚</button><button class="t-btn t-top t-sb" data-a="sb">TAB</button><button class="t-btn t-top t-buy hidden" data-a="buy">KØB</button>`;
    document.body.appendChild(el); this.el = el; this.joyEl = el.querySelector('.t-joy');
    const hint = document.createElement('div'); hint.id = 'rotateHint'; hint.innerHTML = '<div>↻<br>VEND SKÆRMEN<br><small>spillet spilles bedst på langs</small></div>'; document.body.appendChild(hint);
    el.addEventListener('touchstart', e => this._start(e), { passive: false });
    el.addEventListener('touchmove', e => this._move(e), { passive: false });
    el.addEventListener('touchend', e => this._end(e), { passive: false });
    el.addEventListener('touchcancel', e => this._end(e), { passive: false });
    el.addEventListener('contextmenu', e => e.preventDefault());
  },
  show() { this.build(); if (!this.el) return; this.on = true; this.el.classList.remove('hidden'); document.body.classList.add('ingame'); $('clickToPlay').classList.add('hidden'); },
  hide() { if (!this.el) return; this.on = false; this.el.classList.add('hidden'); document.body.classList.remove('ingame'); this._reset(); },
  pause() { this._reset(); $('clickToPlay').classList.remove('hidden'); },
  resume() { $('clickToPlay').classList.add('hidden'); },
  _reset() { this.mx = this.my = 0; this.joy = null; this.look.clear(); if (this.joyEl) this.joyEl.classList.add('hidden'); fireEnd(); KEY.Space = KEY.KeyE = KEY.Tab = false; if (this.el) this.el.querySelectorAll('.t-btn.down').forEach(b => b.classList.remove('down')); },
  tick() {                                                       // knap-tilstande (kaldes fra HUD.tick)
    if (!this.on) return;
    const w = WEAPONS[Game.self.cur], nade = !!(w && w.kind === 'nade');
    this.el.querySelector('.t-fire').textContent = nade ? 'KAST' : 'SKYD';
    this.el.querySelector('.t-aim').textContent = nade ? 'UNDER' : 'SIGT';
    this.el.querySelector('.t-aim').classList.toggle('dim', !nade && !(w && w.scope));
    this.el.querySelector('.t-crouch').classList.toggle('on', !!KEY.KeyC);
    this.el.querySelector('.t-buy').classList.toggle('hidden', !BuyMenu.canBuy() && !BuyMenu.open);
  },
  _lookDelta(dx, dy) {
    if (bombCam()) { const sn = Settings.sensRad() * 1.6; Game.specYaw -= dx * sn; Game.specPitch = clamp(Game.specPitch - dy * sn, -1.35, 1.2); return; }
    if (!Game.self.alive && Game.phase !== 'buy') return;
    const sens = Settings.sensRad() * 1.6 * (Game.fov / 90);
    Game.yaw -= dx * sens; Game.pitch = clamp(Game.pitch - dy * sens, -1.55, 1.55);
    Renderer.mouseDelta(dx * sens, dy * sens);
  },
  _action(a, down) {
    const alive = Game.self.alive || Game.phase === 'buy', w = WEAPONS[Game.self.cur];
    if (a === 'pause') { if (down) this.pause(); return; }
    if (a === 'sb') { KEY.Tab = down; return; }
    if (a === 'buy') { if (down) BuyMenu.toggle(); return; }
    if (!alive) { if (down) cycleSpec(1); return; }
    if (a === 'fire') { if (down) { if (w && w.kind === 'nade') nadeStart(false); else fireStart(); } else { fireEnd(); if (Game.nade && !Game.nade.under) nadeRelease(false); } }
    else if (a === 'aim') { if (w && w.kind === 'nade') { if (down) nadeStart(true); else if (Game.nade && Game.nade.under) nadeRelease(true); } else if (down) toggleScope(); }
    else if (a === 'jump') KEY.Space = down;
    else if (a === 'crouch') { if (down) KEY.KeyC = !KEY.KeyC; }
    else if (a === 'use') { KEY.KeyE = down; if (down) tryPickup(); }
    else if (a === 'reload') { if (down) startReloadLocal(); }
    else if (a === 'switch' && down && Game.phase !== 'buy') { const o = invOrder(); if (o.length > 1) switchWeapon(o[(Math.max(0, o.indexOf(Game.self.cur)) + 1) % o.length]); }
  },
  _start(e) {
    e.preventDefault(); Audio.init();
    for (const t of e.changedTouches) {
      const btn = t.target.closest && t.target.closest('.t-btn');
      if (btn) {
        btn.classList.add('down');
        const a = btn.dataset.a; this._action(a, true);
        this.look.set(t.identifier, { x: t.clientX, y: t.clientY, btn, a });   // man kan sigte ved at trække på SKYD-knappen
      } else if (!this.joy && t.clientX < innerWidth * 0.4 && t.clientY > innerHeight * 0.3) {
        this.joy = { id: t.identifier, x0: t.clientX, y0: t.clientY };
        this.joyEl.style.left = t.clientX + 'px'; this.joyEl.style.top = t.clientY + 'px'; this.joyEl.classList.remove('hidden'); this.joyEl.firstChild.style.transform = '';
      } else {
        this.look.set(t.identifier, { x: t.clientX, y: t.clientY, x0: t.clientX, y0: t.clientY, t0: performance.now() });
      }
    }
  },
  _move(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (this.joy && t.identifier === this.joy.id) {
        const R = 56; let dx = t.clientX - this.joy.x0, dy = t.clientY - this.joy.y0; const d = Math.hypot(dx, dy);
        if (d > R) { dx *= R / d; dy *= R / d; }
        this.mx = dx / R; this.my = dy / R; this.joyEl.firstChild.style.transform = `translate(${dx}px,${dy}px)`;
        continue;
      }
      const L = this.look.get(t.identifier); if (!L) continue;
      if (L.btn && L.a !== 'fire' && L.a !== 'aim') continue;
      this._lookDelta(t.clientX - L.x, t.clientY - L.y); L.x = t.clientX; L.y = t.clientY;
    }
  },
  _end(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (this.joy && t.identifier === this.joy.id) { this.joy = null; this.mx = this.my = 0; this.joyEl.classList.add('hidden'); continue; }
      const L = this.look.get(t.identifier); if (!L) continue;
      this.look.delete(t.identifier);
      if (L.btn) { L.btn.classList.remove('down'); this._action(L.a, false); }
      else if (!Game.self.alive && Game.phase !== 'buy' && Math.hypot(t.clientX - L.x0, t.clientY - L.y0) < 12) cycleSpec(1);   // tryk = næste spectator
    }
  }
};

/* ==========================================================================
   KØBSHJUL (CS:GO-stil): B åbner hjulet → vælg kategori → vælg våben (mus, touch eller tal 1-9; 0/Backspace = tilbage).
   Pengebeløbet står i midten. Køb er muligt i købsfasen og de første 10 s af runden mens man står i spawn.
   Sidepanel: sælg det du har købt i denne runde (fuld refusion), ønsk et våben fra holdet, giv holdkammerater deres ønsker.
   ========================================================================== */
const BuyMenu = {
  open: false, cat: null, mode: 'buy', reqs: [], _sig: '',
  cats() {
    const B = WD.BUY[Game.side === 'hij' ? 'hij' : 'swat'];
    return [
      { id: 'pistols', name: 'PISTOLER', items: B.pistols },
      { id: 'smgs', name: 'MASKINPISTOLER', items: B.smgs },
      { id: 'rifles', name: 'RIFLER', items: B.rifles },
      { id: 'nades', name: 'GRANATER', items: B.nades }
    ];
  },
  inZone() { const b = Game.body; return (W.spawns[Game.side] || []).some(sp => Math.hypot(b.x - sp.x, b.z - sp.z) < 14 && Math.abs(b.y - sp.y) < 3); },
  left() { return Math.max(0, (Game.buyEnd || 0) - performance.now()); },
  canBuy() { return Game.state === 'game' && Game.self.alive && !!Game.side && this.left() > 0 && (Game.phase === 'buy' || (Game.phase === 'live' && this.inZone())); },
  build() { this._sig = ''; if (this.open) this.render(); },
  toggle() { if (this.open) this.hide(); else this.show(); },
  show() {
    if (!this.canBuy()) { UI.toast(Game.phase === 'live' && this.left() > 0 ? 'Du skal stå i spawn for at købe' : 'Købstiden er slut'); return; }
    this.open = true; this.cat = null; this._sig = '';
    $('buyWheel').classList.remove('hidden'); $('clickToPlay').classList.add('hidden');
    Game.firing = false;
    if (!TOUCH) exitPointerLock();                          // musemarkøren skal bruges i hjulet
    this.render();
  },
  hide() {
    if (!this.open) return;
    this.open = false; $('buyWheel').classList.add('hidden');
    if (!TOUCH && Game.state === 'game' && !uiOpen()) {   // tilbage til spillet: lås musen igen (eller vis 'klik for at sigte')
      const gl = $('gl'); lockPointer();
      setTimeout(() => { if (document.pointerLockElement !== gl && !this.open && Game.state === 'game') $('clickToPlay').classList.remove('hidden'); }, 350);
    }
  },
  hotkey(code) {
    if (!this.open) return false;
    if (code === 'Escape') { this.hide(); return true; }
    if (code === 'Backspace' || code === 'Digit0') { this.cat = null; this._sig = ''; this.render(); return true; }
    const m = /^Digit([1-9])$/.exec(code); if (!m) return false;
    const n = +m[1] - 1, list = this.cat ? this.cats().find(c => c.id === this.cat).items : this.cats();
    if (n < list.length) this.pick(this.cat ? list[n] : list[n].id);
    return true;
  },
  nadeDesc(id) { return { he: 'Splint-granat · op til 98 skade', flash: 'Blænder alle der ser den · max 2', smoke: 'Røgsky i 18 s', molotov: 'Brand i 7 s · spærrer et område', incgren: 'Brand i 7 s · spærrer et område' }[id] || ''; },
  owned(id) { const inv = Game.self.inv || {}, w = WEAPONS[id]; return w.kind === 'gun' ? (inv.primary === id || inv.pistol === id) : (inv[id] || 0) > 0; },
  sellable(id) { return (Game.self.bought || []).includes(id) && this.owned(id); },
  pick(id) {
    if (!this.cat) { this.cat = id; this._sig = ''; this.render(); Audio.click('switch'); return; }
    if (this.mode === 'req') { Net.send({ t: 'req', i: id }); UI.toast('Ønske sendt til holdet: ' + WEAPONS[id].name); this.mode = 'buy'; this._sig = ''; this.render(); return; }
    const w = WEAPONS[id];
    if (this.sellable(id) && w.kind === 'gun') { Net.send({ t: 'sell', i: id }); Audio.click('buy'); return; }   // klik på eget købt våben = sælg
    if ((Game.self.money || 0) < w.price) { Audio.click('empty'); return; }
    Net.send({ t: 'buy', i: id }); Audio.click('buy'); this.cat = null; this._sig = '';
  },
  // tilstand pr. vare: owned | sell | poor | full | ok
  state(id) {
    const w = WEAPONS[id], inv = Game.self.inv || {}, money = Game.self.money || 0;
    if (this.mode === 'req') return 'req';
    if (w.kind === 'gun' && this.owned(id)) return this.sellable(id) ? 'sell' : 'owned';
    if (w.kind === 'nade' && !WD.canTakeNade(inv, id)) return (inv[id] || 0) > 0 ? (this.sellable(id) ? 'sell' : 'owned') : 'full';
    return money < w.price ? 'poor' : 'ok';
  },
  // v14: info-kort i sidepanelet (det våben/den kategori musen peger på)
  renderInfo() {
    const el = $('bwInfo'); if (!el) return;
    const team = Game.side === 'hij' ? 'hij' : 'swat', cats = this.cats(), c = cats.find(q => q.id === this.hover);
    let id = this.hover && WEAPONS[this.hover] ? this.hover : null;
    if (!id && !c) { el.innerHTML = `<div class="bwi-empty">Peg på ${this.cat ? 'et våben' : 'en kategori'} for at se detaljer</div>`; return; }
    if (c) { el.innerHTML = `<div class="bwi-head"><b>${c.name}</b><span>${c.items.length} valg</span></div><div class="bwi-list">${c.items.map(i => `<span>${WEAPONS[i].name}<em>$${WEAPONS[i].price}</em></span>`).join('')}</div>`; return; }
    const w = WEAPONS[id], st = this.stats(id), ic = Renderer.gunIcon(id, team), kb = WD.killReward(id), sp = Math.round(WD.speedOf(id) * 250);
    el.innerHTML = `<div class="bwi-head"><b>${w.name}</b><span class="${(Game.self.money || 0) >= w.price ? 'ok' : 'no'}">$${w.price}</span></div>
      ${ic ? `<img class="bwi-img" src="${ic}" alt="">` : ''}
      ${st ? `<div class="bwi-stats">${st.map(([n, v]) => `<div><em>${n}</em><i style="--v:${(v * 100).toFixed(0)}%"></i></div>`).join('')}</div>` : `<div class="bwi-desc">${this.nadeDesc(id)}</div>`}
      <div class="bwi-meta">${w.kind === 'gun' ? `<span>SKADE <b>${w.dmg}</b></span><span>MAGASIN <b>${w.mag}</b></span><span>FART <b>${sp}</b></span><span>KILL <b>+$${kb}</b></span>` : `<span>${w.team ? (w.team === 'hij' ? 'KUN HIJACKERS' : 'KUN SWAT') : 'BEGGE HOLD'}</span>`}</div>`;
  },
  // v13: statistik-bjælker (0..1) pr. våben til kortene
  stats(id) {
    const w = WEAPONS[id]; if (w.kind !== 'gun') return null;
    const cl = v => Math.max(0.04, Math.min(1, v));
    return [['SKADE', cl(w.dmg / 60)], ['KADENCE', cl((0.3 - Math.min(0.3, w.rate)) / 0.24)], ['PRÆCISION', cl(1 - (w.spread - 0.003) / 0.012)], ['MOBILITET', cl((WD.speedOf(id) - 0.8) / 0.32)]];
  },
  render() {
    if (!this.open) return;
    const cats = this.cats(), team = Game.side === 'hij' ? 'hij' : 'swat', items = this.cat ? cats.find(c => c.id === this.cat).items : null;
    const sig = [this.cat, this.mode, Game.side, Game.self.money, JSON.stringify(Game.self.inv), (Game.self.bought || []).join(), JSON.stringify(this.reqs), this._iconTick || 0].join('|');
    if (sig !== this._sig) {
      this._sig = sig;
      // v14: hjulet – sektorer med glas-gradient, lysende kant, 3D-renderet våben, navn og pris; hover skubber sektoren ud
      const list = items || cats, N = list.length, R0 = 80, R1 = 226, gap = 0.028, money = Game.self.money || 0;
      const P = (r, a) => (r * Math.cos(a)).toFixed(2) + ' ' + (r * Math.sin(a)).toFixed(2);
      let html = `<defs>
        <radialGradient id="bwG" cx="0" cy="0" r="226" gradientUnits="userSpaceOnUse"><stop offset="0.3" stop-color="rgba(26,32,44,.92)"/><stop offset="1" stop-color="rgba(12,15,22,.9)"/></radialGradient>
        <radialGradient id="bwGh" cx="0" cy="0" r="226" gradientUnits="userSpaceOnUse"><stop offset="0.3" stop-color="${team === 'hij' ? 'rgba(170,52,30,.95)' : 'rgba(40,86,170,.95)'}"/><stop offset="1" stop-color="${team === 'hij' ? 'rgba(90,24,14,.95)' : 'rgba(18,40,90,.95)'}"/></radialGradient>
        <filter id="bwGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
      let pending = 0;
      list.forEach((it, i) => {
        const a0 = -Math.PI / 2 + i / N * Math.PI * 2 + gap, a1 = -Math.PI / 2 + (i + 1) / N * Math.PI * 2 - gap, am = (a0 + a1) / 2, big = a1 - a0 > Math.PI ? 1 : 0;
        const d = `M ${P(R0, a0)} L ${P(R1, a0)} A ${R1} ${R1} 0 ${big} 1 ${P(R1, a1)} L ${P(R0, a1)} A ${R0} ${R0} 0 ${big} 0 ${P(R0, a0)} Z`;
        const cx = Math.cos(am) * 152, cy = Math.sin(am) * 152, dx = (Math.cos(am) * 7).toFixed(1), dy = (Math.sin(am) * 7).toFixed(1);
        const id = items ? it : it.items[Math.min(it.items.length - 1, it.id === 'nades' ? 2 : it.id === 'rifles' ? 1 : 0)], ic = Renderer.gunIcon(id, team); if (ic === null) pending++;
        const img = ic ? `<image href="${ic}" x="${(cx - 62).toFixed(1)}" y="${(cy - 44).toFixed(1)}" width="124" height="52" preserveAspectRatio="xMidYMid meet"/>` : '';
        if (!items) {
          html += `<g class="bw-sec cat" data-id="${it.id}" style="--dx:${dx}px;--dy:${dy}px"><path class="bw-p" d="${d}"/>${img}
            <text x="${cx}" y="${cy - 52}" class="bw-key">${i + 1}</text><text x="${cx}" y="${cy + 24}" class="bw-name">${it.name}</text>
            <text x="${cx}" y="${cy + 41}" class="bw-sub">${it.items.length} ${it.items.length === 1 ? 'våben' : it.id === 'nades' ? 'granater' : 'våben'}</text></g>`;
        } else {
          const w = WEAPONS[it], st = this.state(it), tag = w.team ? '' : ' · FÆLLES';
          const price = st === 'sell' ? 'SÆLG +$' + w.price : st === 'owned' ? 'EJET' : st === 'full' ? 'INGEN PLADS' : st === 'req' ? 'ØNSK · $' + w.price : '$' + w.price;
          html += `<g class="bw-sec item st-${st}${st === 'ok' && money >= w.price ? ' afford' : ''}" data-id="${it}" style="--dx:${dx}px;--dy:${dy}px"><path class="bw-p" d="${d}"/>${img}
            <text x="${cx}" y="${cy - 52}" class="bw-key">${i + 1}${tag}</text><text x="${cx}" y="${cy + 24}" class="bw-name">${w.name}</text>
            <text x="${cx}" y="${cy + 41}" class="bw-price">${price}</text></g>`;
        }
      });
      const cc = items ? cats.find(c => c.id === this.cat).name : (team === 'hij' ? 'HIJACKERS' : 'SWAT');
      html += `<g class="bw-center${items ? ' back' : ''}" id="bwCenter"><circle r="70" class="bw-cc"/><circle r="70" class="bw-cr" filter="url(#bwGlow)"/>
        <text y="-14" class="bw-cm">$${Math.max(0, Math.round(money))}</text><text y="10" class="bw-cs">${items ? '← TILBAGE' : this.mode === 'req' ? 'VÆLG ØNSKE' : 'KØB'}</text><text y="28" class="bw-cs2">${cc}</text></g>`;
      $('bwSvg').innerHTML = html; $('bwSvg').classList.toggle('hij', team === 'hij');
      if (pending) setTimeout(() => { this._iconTick = (this._iconTick || 0) + 1; if (this.open) this.render(); }, 400);
      this.renderInfo();
      // sidepanel
      $('bwModeBuy').classList.toggle('sel', this.mode === 'buy'); $('bwModeReq').classList.toggle('sel', this.mode === 'req');
      const inv = Game.self.inv || {}, rows = [];
      for (const id of [inv.primary, inv.pistol, ...WD.NADES.flatMap(n => Array(inv[n] || 0).fill(n))]) {
        if (!id) continue; const w = WEAPONS[id], canSell = (Game.self.bought || []).includes(id);
        rows.push(`<li><span>${w.name}</span>${canSell ? `<button class="bw-sell" data-id="${id}">SÆLG +$${w.price}</button>` : '<i>—</i>'}</li>`);
      }
      $('bwInv').innerHTML = rows.join('') || '<li><i>intet</i></li>';
      $('bwDrop').disabled = !inv.primary;
      const rq = this.reqs.map(r => {
        const w = WEAPONS[r.item], pl = Game.players.get(r.from), mine = r.from === Game.meId;
        return `<li><span>${mine ? 'Dit ønske' : escapeHtml(pl ? pl.name : '?')}: <b>${w.name}</b> $${w.price}</span>${mine ? `<button class="bw-cancel">ANNULLER</button>` : `<button class="bw-gift" data-r="${r.id}" ${(Game.self.money || 0) < w.price ? 'disabled' : ''}>GIV</button>`}</li>`;
      });
      $('bwReqs').innerHTML = rq.join('') || '<li><i>ingen ønsker – vælg «ØNSK FRA HOLDET» og et våben</i></li>';
    }
    $('bwMoney').textContent = Math.max(0, Math.round(Game.self.money || 0));
    $('bwTimer').textContent = 'Køb lukker om ' + fmtTime(this.left()) + (Game.phase === 'live' ? ' · kun i spawn' : '');
    if (this._ecoSig !== JSON.stringify(Game.eco) + Game.self.money) this.renderEco();
  },
  /* v12: holdets økonomi + 'Loss/Win Predictor': samlet/gennemsnitlige penge, hvad næste runde giver ved sejr og tab, og en købsanbefaling */
  renderEco() {
    const e = Game.eco, box = $('bwEco'); if (!box) return;
    this._ecoSig = JSON.stringify(e) + Game.self.money;
    if (!e || !e.l || !e.l.length) { box.innerHTML = '<i>venter på data…</i>'; return; }
    const E = WD.ECON, rows = e.l.map(([id, money, alive, pc]) => ({ id, money: id === Game.meId ? Math.round(Game.self.money || money) : money, alive, prim: pc ? WEAPONS[WD.WEAPON_BY_CODE[pc]] : null, name: id === Game.meId ? 'Dig' : ((Game.players.get(id) || {}).name || '#' + id) }));
    rows.sort((a, b) => b.money - a.money);
    const tot = rows.reduce((a, r) => a + r.money, 0), avg = Math.round(tot / rows.length);
    const lossNext = WD.lossBonus(Math.min(E.loss.length, (e.streak || 0) + 1));
    const full = 3700, force = 2000;     // rifle (~2700-3100) + granater ≈ 3700 pr. spiller
    const rec = avg >= full ? ['FULL BUY', 'full', 'Alle kan købe rifle + granater'] : avg >= force ? ['FORCE BUY', 'force', 'Pistoler/SMG/billige rifler – eller spar sammen'] : ['ECO', 'eco', 'Spar pengene – køb højst en pistol'];
    const bar = r => `<i class="eco-bar" style="width:${Math.min(100, r.money / 60)}%"></i>`;
    box.innerHTML = `<div class="eco-rec eco-${rec[1]}"><b>${rec[0]}</b><span>${rec[2]}</span></div>
      <ul class="eco-list">${rows.map(r => `<li class="${r.alive ? '' : 'dead'}${r.id === Game.meId ? ' me' : ''}"><span>${escapeHtml(r.name)}</span><em>${r.prim ? r.prim.name : '—'}</em><b>$${r.money}</b>${bar(r)}</li>`).join('')}</ul>
      <div class="eco-sum"><span>HOLD I ALT <b>$${tot}</b></span><span>GENNEMSNIT <b>$${avg}</b></span></div>
      <div class="eco-pred"><div class="win">VINDER I: <b>+$${E.win.elim}</b><small>($${E.win.bomb} ved ${Game.side === 'hij' ? 'detonation' : 'desarmering'})</small></div>
      <div class="lose">TABER I: <b>+$${lossNext}</b><small>tabsserie ${e.streak || 0} → ${Math.min(E.loss.length, (e.streak || 0) + 1)}${Game.side === 'hij' ? ' · +$' + E.plantTeam + ' hvis bomben plantes' : ''}</small></div></div>`;
  },
  update() {                                                  // kaldes hver frame fra HUD.tick
    if (this.open && !this.canBuy()) this.hide();
    if (this.open) this.render();
  },
  init() {
    $('bwSvg').addEventListener('click', e => {
      const g = e.target.closest('g'); if (!g) return;
      if (g.id === 'bwCenter') { if (this.cat) { this.cat = null; this._sig = ''; this.render(); } return; }
      if (g.dataset.id) this.pick(g.dataset.id);
    });
    $('bwSvg').addEventListener('contextmenu', e => { const g = e.target.closest('g.item'); if (g && this.sellable(g.dataset.id)) { e.preventDefault(); Net.send({ t: 'sell', i: g.dataset.id }); Audio.click('buy'); } });
    $('bwSvg').addEventListener('mouseover', e => { const g = e.target.closest('g.bw-sec'); const id = g ? g.dataset.id : null; if (id !== this.hover) { this.hover = id; this.renderInfo(); } });
    $('bwModeBuy').addEventListener('click', () => { this.mode = 'buy'; this._sig = ''; this.render(); });
    $('bwModeReq').addEventListener('click', () => { this.mode = 'req'; this._sig = ''; this.render(); });
    $('bwClose').addEventListener('click', () => this.hide());
    $('bwDrop').addEventListener('click', () => Net.send({ t: 'drop' }));
    $('bwInv').addEventListener('click', e => { const b = e.target.closest('.bw-sell'); if (b) { Net.send({ t: 'sell', i: b.dataset.id }); Audio.click('buy'); } });
    $('bwReqs').addEventListener('click', e => {
      const g = e.target.closest('.bw-gift'); if (g) { Net.send({ t: 'gift', r: +g.dataset.r }); Audio.click('buy'); return; }
      if (e.target.closest('.bw-cancel')) Net.send({ t: 'req', i: null });
    });
    $('buyWheel').addEventListener('mousedown', e => { if (e.target === $('buyWheel')) this.hide(); });   // klik udenfor = luk
    $('buyWheel').addEventListener('contextmenu', e => e.preventDefault());
  }
};
BuyMenu.init();
Net.on('reqs', m => { BuyMenu.reqs = m.l || []; const n = BuyMenu.reqs.filter(r => r.from !== Game.meId).length; Game.reqHint = n ? 'HOLDET ØNSKER ' + n + ' VÅBEN' : ''; });

/* ==========================================================================
   HUD
   ========================================================================== */
const HUD = {
  updateSelf() {
    const s = Game.self;
    if (!s.alive || !(WEAPONS[s.cur] && WEAPONS[s.cur].scope)) Game.scoped = false;
    if (s.alive && s.cur === 'awp' && !Game._awpHint) { Game._awpHint = true; UI.toast('AWP: tryk F eller højreklik for scope', 3500); }
    if (!s.alive) Game.reloading = null;
    else if (Game.reloading) { const rw = WEAPONS[s.cur], ra = s.ammo && s.ammo[s.cur]; if (rw && ra && ra.mag >= rw.mag) Game.reloading = null; }
    $('hpFill').style.width = clamp(s.hp, 0, 100) + '%';
    $('hpNum').textContent = Math.max(0, Math.round(s.hp));
    $('moneyNum').textContent = Math.max(0, Math.round(s.money));
    $('sideTag').textContent = s.side === 'hij' ? 'HIJACKERS' : 'SWAT';
    $('sideTag').className = 'side-indicator' + (s.side === 'hij' ? ' hij' : '');
    $('bombCarry').classList.toggle('hidden', !(s.inv && s.inv.bomb));
    const w = WEAPONS[s.cur];
    $('weaponName').textContent = w ? w.name : '';
    $('skinName').textContent = Renderer.skinName(s.cur, s.side) || '';
    const am = s.ammo && s.ammo[s.cur];
    if (w && w.kind === 'gun' && am) { $('ammoMag').textContent = am.mag; $('ammoRes').textContent = am.res; }
    else if (w && w.kind === 'nade') { $('ammoMag').textContent = (s.inv && s.inv[s.cur]) || 0; $('ammoRes').textContent = '—'; }
    else { $('ammoMag').textContent = '—'; $('ammoRes').textContent = ''; }
    const slots = $('slotRow'); slots.innerHTML = '';
    const inv = s.inv || {};
    const list = [[inv.primary, '1'], [inv.pistol, '2'], ['knife', '3'], [inv.he > 0 ? 'he' : null, '5'], [inv.smoke > 0 ? 'smoke' : null, '6'], [inv.molotov > 0 ? 'molotov' : inv.incgren > 0 ? 'incgren' : null, '7'], [inv.flash > 0 ? 'flash' : null, '8', inv.flash]];
    for (const [id, key, cnt] of list) { if (!id) continue; const sp = document.createElement('span'); sp.textContent = key + ' ' + WEAPONS[id].name + (cnt > 1 ? ' ×' + cnt : ''); sp.className = id === s.cur ? 'active' : ''; slots.appendChild(sp); }
    BuyMenu.update();
    $('deadOverlay').classList.toggle('hidden', s.alive !== false || Game.phase === 'buy' || !!Game.endInfo);   // rundeslut-skærmen har forrang
  },
  // v12: træf-markør + kort rødt glimt i selve crosshairet (headshot: kraftigere og lidt større)
  hitmarker(kill, hs) {
    const el = $('hitmarker');
    el.classList.toggle('kill', !!kill); el.classList.toggle('hs', !!hs);
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(this._ht); this._ht = setTimeout(() => el.classList.remove('show'), kill ? 300 : 170);
    const xr = $('crosshairHit'); if (xr) { xr.classList.remove('flash', 'hs'); void xr.offsetWidth; xr.classList.add('flash'); if (hs || kill) xr.classList.add('hs'); }
  },
  // v12: skade-bue. Kildens VERDENS-position gemmes, og buen roteres hver frame efter spillerens aktuelle blikretning
  damageIndicator(dx, dz, dmg) {
    const wrap = $('dmgIndicators'), b = Game.body;
    const el = document.createElement('div'); el.className = 'dmg-arc'; wrap.appendChild(el);
    const h = { el, wx: b.x + dx, wz: b.z + dz, t0: performance.now(), dur: 1400, k: clamp((dmg || 20) / 40, 0.45, 1), ang: null };
    Game.hurts.push(h); if (Game.hurts.length > 6) { const o = Game.hurts.shift(); o.el.remove(); }
    this.updateHurts(0);
  },
  updateHurts(dt) {
    const now = performance.now(), b = Game.body, cy = Math.cos(Game.yaw), sy = Math.sin(Game.yaw);
    for (let i = Game.hurts.length - 1; i >= 0; i--) {
      const h = Game.hurts[i], e = (now - h.t0) / h.dur;
      if (e >= 1) { h.el.remove(); Game.hurts.splice(i, 1); continue; }
      const dx = h.wx - b.x, dz = h.wz - b.z, fwd = -sy * dx - cy * dz, right = cy * dx - sy * dz;
      const tgt = Math.atan2(right, fwd);                       // 0 = foran (top), +π/2 = højre
      h.ang = h.ang === null ? tgt : lerpAngle(h.ang, tgt, 1 - Math.exp(-18 * (dt || 0.016)));   // blød rotation, følger musen uden hak
      h.el.style.transform = `translate(-50%,-50%) rotate(${h.ang}rad)`;
      h.el.style.opacity = (e < 0.08 ? e / 0.08 : 1 - smooth((e - 0.35) / 0.65)) * h.k;
    }
  },
  // v12: penge-feed ved pengeblokken (+$300 kill · AK-47 osv.)
  pay(m) {
    if (!m.amt) return;
    const why = { kill: 'KILL' + (m.w && WEAPONS[m.w] ? ' · ' + WEAPONS[m.w].name : ''), plant: 'BOMBE PLANTET', defuse: 'BOMBE DESARMERET', win: 'RUNDE VUNDET', loss: 'TABSBONUS (serie ' + (m.streak || 1) + ')', lossplant: 'TABSBONUS + PLANT-BONUS', saved: 'OVERLEVET – INGEN BONUS' }[m.why] || '';
    const el = document.createElement('div'); el.className = 'pay-row' + (m.amt < 0 ? ' neg' : ''); el.innerHTML = `<b>${m.amt > 0 ? '+' : ''}$${m.amt}</b><span>${why}</span>`;
    $('payFeed').prepend(el); while ($('payFeed').children.length > 4) $('payFeed').lastChild.remove();
    setTimeout(() => el.classList.add('out'), 2600); setTimeout(() => el.remove(), 3200);
    if (m.amt > 0) Audio.click('money');
    if (m.why === 'win' || m.why === 'loss' || m.why === 'lossplant' || m.why === 'saved') { Game.endPay = m; this.fillEndPay(); }
  },
  killfeed(m) {
    const a = Game.players.get(m.a), v = Game.players.get(m.v);
    const row = document.createElement('div'); row.className = 'kf-row';
    const icon = m.w === 'he' ? '💥' : m.w === 'c4' ? '☠' : m.w === 'molotov' || m.w === 'incgren' ? '🔥' : m.hs ? '⊙' : '×';
    const wn = WEAPONS[m.w] && m.w !== 'c4' ? `<i class="kf-w">${WEAPONS[m.w].name}</i>` : '';
    row.innerHTML = `<span>${a ? escapeHtml(a.name) : m.w === 'c4' ? 'Bomben' : 'Ild'}</span><span class="${m.hs ? 'kf-hs' : ''}">${wn}${icon}</span><span>${escapeHtml(v ? v.name : '?')}</span>`;
    $('killfeed').prepend(row);
    setTimeout(() => row.remove(), 6000);
    while ($('killfeed').children.length > 6) $('killfeed').lastChild.remove();
  },
  showDead() { if (!Game.endInfo) $('deadOverlay').classList.remove('hidden'); },
  burn() {                                         // står i ilden: orange kant-glød + lille ryst
    const el = $('burnOv'); el.classList.remove('hidden'); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(this._bt); this._bt = setTimeout(() => el.classList.add('hidden'), 450); Renderer.shake(0.05);
  },
  /* v12: dramatisk rundeafslutning – "ROUND WON BY SWAT/HIJACKERS" med holdfarvet glød, sejrsbetingelse, MVP, rundens indtjening
     og nedtælling til næste runde (alle respawner automatisk). Kontrollen fryses et øjeblik, derefter kan man bevæge sig og skyde. */
  roundEnd(m) {
    const el = $('roundEnd'), swat = m.win === 'swat', team = swat ? 'SWAT' : 'HIJACKERS';
    const by = m.by && Game.players.get(m.by) ? Game.players.get(m.by).name : null;
    const cond = { elim: swat ? 'All Hijackers Eliminated' : 'All SWAT Operators Eliminated', bomb: 'Bomb Detonated', defuse: 'Bomb Defused by ' + (by ? escapeHtml(by) + ' (SWAT)' : 'SWAT'), time: 'Time Expired – Target Saved' }[m.reason] || '';
    let mvp = '';
    if (m.mvp) {
      const who = escapeHtml(m.mvp.name) + (m.mvp.id === Game.meId ? ' (DIG)' : '');
      const why = m.mvp.why === 'defuse' ? 'for defusing the bomb' : m.mvp.why === 'plant' ? 'for planting the bomb' : m.mvp.k ? 'for ' + m.mvp.k + ' kill' + (m.mvp.k === 1 ? '' : 's') + (m.mvp.dmg ? ' · ' + m.mvp.dmg + ' dmg' : '') : 'for surviving';
      mvp = `<div class="re-mvp"><span class="re-star">★</span><span class="re-mvp-l">MVP</span><b>${who}</b><em>${why}</em></div>`;
    }
    el.className = 're ' + (swat ? 're-swat' : 're-hij') + (Game.side === m.win ? ' re-won' : ' re-lost');
    el.innerHTML = `<div class="re-band"></div><div class="re-in">
      <div class="re-kicker">ROUND ${Game.round} · ${m.score[0]} — ${m.score[1]}</div>
      <div class="re-title"><span>ROUND WON BY</span><b>${team}</b></div>
      <div class="re-cond">${cond}</div>${mvp}
      <div class="re-pay" id="rePay"></div>
      <div class="re-next"><span>NÆSTE RUNDE OM</span><b id="reCount">5</b><i><em id="reBar"></em></i></div></div>`;
    el.classList.remove('hidden');
    Game.endInfo = { t0: performance.now(), ms: m.ms || 5000 };
    Game.endT = performance.now(); Game.firing = false;
    hideActBar(); this.fillEndPay(); $('deadOverlay').classList.add('hidden');
    Audio.music(Game.side === m.win ? 'win' : 'lose');
    Audio.announce(swat ? 'SWAT win' : 'Hijackers win');
    if (m.mvp && m.mvp.id === Game.meId) Audio.music('mvp');
  },
  fillEndPay() {
    const el = $('rePay'), p = Game.endPay; if (!el || !p || !Game.endInfo || performance.now() - Game.endInfo.t0 > 6000) return;
    el.innerHTML = p.amt ? `<b>+$${p.amt}</b> ${p.why === 'win' ? 'sejrsbonus' : p.why === 'lossplant' ? 'tabsbonus + plant-bonus' : p.why === 'saved' ? '' : 'tabsbonus (serie ' + (p.streak || 1) + ')'}` : 'ingen tabsbonus (overlevede ved udløbet tid)';
  },
  hideRoundEnd() { $('roundEnd').classList.add('hidden'); Game.endInfo = null; Game.endPay = null; },
  tickRoundEnd() {
    const E = Game.endInfo; if (!E) return;
    const left = Math.max(0, E.ms - (performance.now() - E.t0));
    setText('reCount', Math.ceil(left / 1000));
    const bar = $('reBar'); if (bar) bar.style.width = (100 * left / E.ms) + '%';
  },
  gameOver(m) {
    const el = $('gameOverBanner');
    el.innerHTML = `${m.win === 'swat' ? 'SWAT' : 'HIJACKERS'} VINDER KAMPEN<div class="sub">${m.score[0]} — ${m.score[1]}</div>`;
    el.classList.remove('hidden');
    clearTimeout(this._goT); this._goT = setTimeout(() => el.classList.add('hidden'), 4000);
  },
  renderScoreboard(rows) {
    const swat = $('sbSwat'), hij = $('sbHij'); swat.innerHTML = ''; hij.innerHTML = '';
    for (const [id, name, side, k, d, alive, conn] of rows) {
      const tr = document.createElement('tr'); if (!alive) tr.className = 'dead'; if (id === Game.meId) tr.className += ' me';
      tr.innerHTML = `<td class="sb-name">${escapeHtml(name)}${!conn ? ' ⚠' : ''}</td><td>${k}</td><td>${d}</td>`;
      (side === 'swat' ? swat : hij).appendChild(tr);
    }
  },

  tick() {
    if (Game.state !== 'game') return;
    Touch.tick();
    this.tickRoundEnd(); this.updateHurts(this._dt || 0.016);
    if (Settings.get().stats) {                             // v12.1: FPS/ping-visning (indstillinger → Vis FPS & ping)
      const now = performance.now(); this._fc = (this._fc || 0) + 1;
      if (!this._ft || now - this._ft > 500) { const fps = this._fc * 1000 / (now - (this._ft || now - 500)); this._ft = now; this._fc = 0; const P = Renderer.perf || {};
        setText('netStats', `${Math.round(fps)} FPS · ${Math.round(Game.ping || 0)} ms ping · grafik ${Renderer.gfx}${Renderer.pr ? ' · ' + Renderer.pr.toFixed(2) + '×' : ''}`); }
      $('netStats').classList.remove('hidden');
    } else $('netStats').classList.add('hidden');
    setText('scoreSwat', Game.score[0]); setText('scoreHij', Game.score[1]);
    setText('roundTimer', fmtTime(Game.phaseEnd - performance.now()));
    setText('roundLabel', Game.phase === 'buy' ? 'KØBSFASE' : 'RUNDE ' + Game.round);
    BuyMenu.update();
    const cb = BuyMenu.canBuy() && !BuyMenu.open;
    $('buyHint').classList.toggle('hidden', !cb);
    if (cb) setText('buyHint', (TOUCH ? 'TRYK KØB' : 'TRYK B FOR AT KØBE') + ' · ' + fmtTime(BuyMenu.left()) + (Game.reqHint ? ' · ' + Game.reqHint : ''));
    $('scoreboard').classList.toggle('hidden', !KEY.Tab);
    if (KEY.Tab && performance.now() - (this._sbT || 0) > 250) { this._sbT = performance.now(); Net.send({ t: 'sb' }); }   // 4 Hz i stedet for hver frame
    if (Game.reloading) {
      const p = clamp((performance.now() - Game.reloading.start) / (Game.reloading.dur * 1000), 0, 1);
      $('reloadBar').classList.remove('hidden'); $('reloadFill').style.width = (p * 100) + '%';
      // v14: lydene følger genladningens tidslinje pr. klasse (reloadAnim): magasin ud, magasin ind, spænd (ladegreb/slæde – AWP: boltlyden)
      const Wq = Renderer.weap(), st = Wq && Wq.reloadStyle(Game.self.cur), gS = !!st && st[0] === 'grip', cue = gS ? [0.09, 0.53, 0.66] : [0.2, 0.68, st && st[1] === 'bolt' ? 0.66 : 0.8];
      if (p > cue[0] && !Game.reloading.s1) { Game.reloading.s1 = true; Audio.click('magout'); }
      if (p > cue[1] && !Game.reloading.s2) { Game.reloading.s2 = true; Audio.click('magin'); }
      if (p > cue[2] && !Game.reloading.s3) { Game.reloading.s3 = true; Audio.click(st && st[1] === 'bolt' ? 'bolt' : st && st[1] === 'slide' ? 'slide' : 'rack'); }
      if (p >= 1) Game.reloading = null;
    } else $('reloadBar').classList.add('hidden');

    const b = Game.bomb;
    const bt = $('bombTimerWrap');
    if (b.state === 2) {
      bt.classList.remove('hidden');
      setText('bombTimerTxt', 'C4 ⟡ ' + (b.msLeft / 1000).toFixed(1) + 's');
      $('bombTimerBar').style.width = clamp(100 - b.msLeft / 400, 0, 100) + '%';
    } else bt.classList.add('hidden');

    if (Game.act) {
      const p = clamp((performance.now() - Game.actStart) / (Game.actDur * 1000), 0, 1);
      $('actBar').classList.remove('hidden'); $('promptE').classList.add('hidden');
      $('actLabel').textContent = Game.act === 'plant' ? 'PLANTER BOMBEN…' : 'DESARMERER…';
      $('actFill').style.width = (p * 100) + '%';
    } else {
      $('actBar').classList.add('hidden');
      const carrier = Game.self.alive && Game.side === 'hij' && Game.self.inv && Game.self.inv.bomb && Game.phase === 'live';
      const canPlant = carrier && WD.plantSpot(W, Game.body.x, Game.body.y, Game.body.z);
      const badSpot = carrier && !canPlant && WD.inSiteBox(W, Game.body.x, Game.body.y, Game.body.z);   // i zonen, men oppe på en kasse/prop eller ved en væg
      const canDefuse = Game.self.alive && Game.side === 'swat' && b.state === 2 && Math.hypot(Game.body.x - b.x, Game.body.z - b.z) < 2.4 && Math.abs(Game.body.y - b.y) < 1.6;
      $('promptE').classList.toggle('hidden', !(canPlant || canDefuse || badSpot));
      $('promptE').classList.toggle('bad', !!badSpot);
      const pt = canPlant ? 'HOLD <b>E</b> FOR AT PLANTE' : canDefuse ? 'HOLD <b>E</b> FOR AT DESARMERE' : badSpot ? '✕ KAN IKKE PLANTE HER — STÅ DIREKTE PÅ SITE-GULVET' : '';
      if (this._pt !== pt) { this._pt = pt; $('promptE').innerHTML = pt; }
    }
    // placering (callout) under minimappet
    if (performance.now() - (this._locT || 0) > 250) {
      this._locT = performance.now();
      const p = Game.self.alive || Game.phase === 'buy' ? Game.body : null; let best = null, bd = 16;
      if (p) for (const l of W.labels) { if (l.kind === 'site') continue; const ly = l.y === undefined ? 0 : l.y; if (Math.abs(p.y - ly) > 2.6) continue; const d = Math.hypot(l.x - p.x, l.z - p.z); if (d < bd) { bd = d; best = l; } }
      setText('locName', best ? best.text : '');
      // v14: stort, diskret områdenavn i toppen når man kommer ind i et nyt område (ikke i købsfasen)
      const nm = best ? best.text : '';
      if (nm && nm !== this._area && Game.phase !== 'buy') { const el = $('areaName'); el.textContent = nm; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
      if (nm) this._area = nm;
    }
  }
};
$('nameInput').focus();

/* ==========================================================================
   3D-RENDERING
   ========================================================================== */
const Renderer = (() => {
  let renderer, scene, camera, clock, pmrem = null, post = null, fxs = null;
  let V = null, Chars = null, Weap = null;
  let sky = null, hemi, amb, sun, sunFar, worldGroup, decorGroup, doors = null, fxObj = null, mapObjs = [], envTex = null;
  const remoteModels = new Map();  // id -> render-state
  const tracers = [], flashes = [], tracerPool = [];
  const IMP_MAX = 160, impT = new Float32Array(IMP_MAX).fill(-1); let impMesh = null, impI = 0;   // skudhuller: ét InstancedMesh
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1), _sc = new THREE.Vector3(1, 1, 1), _bk = [0, 0, 0, 1];
  let _holeTex = null;
  function holeTex() {     // skudhul: mørk kerne + sodet, uregelmæssig kant + lyst afskallet ring (læses tydeligt på både lyse og mørke flader)
    if (_holeTex) return _holeTex;
    _holeTex = canvasTexture((c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(8,8,8,1)'); g.addColorStop(0.28, 'rgba(14,13,12,.95)'); g.addColorStop(0.45, 'rgba(40,36,32,.6)'); g.addColorStop(0.62, 'rgba(200,190,175,.35)'); g.addColorStop(0.8, 'rgba(60,55,50,.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(20,18,16,.6)'; c.lineWidth = 2; for (let i = 0; i < 7; i++) { const a = Math.random() * 6.28, r0 = w * 0.16, r1 = w * (0.3 + Math.random() * 0.15); c.beginPath(); c.moveTo(w / 2 + Math.cos(a) * r0, h / 2 + Math.sin(a) * r0); c.lineTo(w / 2 + Math.cos(a) * r1, h / 2 + Math.sin(a) * r1); c.stroke(); }
    }, 64, 64);
    return _holeTex;
  }
  let shakeT = 0, shakeMag = 0;
  let minimapCtx;
  const mm = { scale: 1, ox: 0, oz: 0, layers: [] };
  let loading = false, mapId = null;
  // førstepersonsvåben: egen scene + kamera (klipper aldrig ind i vægge)
  let vmScene, vmCam, vmHemi, vmSun, vmLight;
  const vm = {
    models: {}, team: null, cur: null, drawT: 1, boltT: 1, shells: [], shellI: 0, throwT: 1, throwU: false, pinT: 1, c4: null,
    meleeT: 1, meleeStab: false, meleeSide: 1, inspT: 1, knifeKey: null, kpose: [0, 0, 0, 0, 0, 0], KOFF: { karambit: [-0.03, 0.125, 0.0, 0.0, 0.0, 0.0] },
    // fjedre (masse-fjeder-dæmper): sway følger musens inerti, kick = fysisk rekyl bagud mod kameraet + opad
    sway: { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 }, kick: { z: 0, vz: 0, r: 0, vr: 0, s: 0, vs: 0 }
  };
  let flashLight = null, flashLightT = 0, fireLights = [];
  const bombObj = { dropped: null, planted: null, carry: null, beepT: 0 };
  const fireSys = new Map(), smokeSys = new Map(), nadeModels = {};

  function getTracer() {
    let t = tracerPool.pop();
    if (!t) {
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(0xffe2a0).multiplyScalar(3.2), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })); line.frustumCulled = false;
      t = { mesh: line, t: 0, s: [0, 0, 0], e: [0, 0, 0], len: 0 };
    }
    return t;
  }
  // v12: sporstreg = et kort, lysende kuglespor der flyver fra mundingen til nedslaget (HDR → bloom), ikke en statisk linje
  const TR_V = 420, TR_L = 5.5;
  function addTracer(sp, ep, own) {
    const tr = getTracer();
    tr.s = sp; tr.e = ep; tr.len = Math.hypot(ep[0] - sp[0], ep[1] - sp[1], ep[2] - sp[2]); tr.t = 0; tr.own = !!own;
    if (tr.len < 0.3) { tracerPool.push(tr); return; }
    tr.mesh.material.opacity = own ? 0.75 : 0.9; scene.add(tr.mesh); tracers.push(tr); posTracer(tr);
  }
  function posTracer(tr) {
    const head = Math.min(tr.len, tr.t * TR_V + 0.6), tail = Math.max(0, head - TR_L), pa = tr.mesh.geometry.attributes.position, d = tr.len;
    const a = tail / d, b = head / d, S = tr.s, E = tr.e;
    pa.setXYZ(0, S[0] + (E[0] - S[0]) * a, S[1] + (E[1] - S[1]) * a, S[2] + (E[2] - S[2]) * a);
    pa.setXYZ(1, S[0] + (E[0] - S[0]) * b, S[1] + (E[1] - S[1]) * b, S[2] + (E[2] - S[2]) * b);
    pa.needsUpdate = true;
    return tail >= d - 0.01;
  }
  const disposeTree = o => o.traverse(n => { if (n.geometry) n.geometry.dispose(); const ms = n.material ? (Array.isArray(n.material) ? n.material : [n.material]) : []; for (const m of ms) { if (m.map) m.map.dispose(); m.dispose(); } });

  /* ---------------- bane: bygges bag en indlæsningsskærm (bagt lys + PBR-maps tager et øjeblik) ---------------- */
  function loadMap() {
    if (loading) return;                                   // doLoad tjekker til sidst om banen er skiftet imens
    loading = true; $('loadingMap').classList.remove('hidden'); $('loadingMapName').textContent = 'de_' + W.id + ' — beregner lys, skygger og materialer…';
    // v11: fotoscannede teksturer + HDRI hentes først (caches efter første gang); fejler de, bygges banen med procedurale materialer
    setTimeout(() => {
      const want = W.id;
      loadThemeAssets(THREE, want, renderer.capabilities.getMaxAnisotropy(), renderer).then(a => { if (W.id === want) doLoad(a); else { loading = false; loadMap(); } });
    }, 60);
  }
  function doLoad(assets) {
    const t0 = performance.now();
    for (const g of mapObjs) { scene.remove(g); disposeTree(g); } mapObjs = [];
    if (sky) { scene.remove(sky); disposeTree(sky); sky = null; }
    if (fxs) fxs.clear(); fireSys.clear(); smokeSys.clear();
    V = createVisuals(THREE, WD, W, canvasTexture, renderer.capabilities.getMaxAnisotropy(), createThemes, assets);
    const L = V.theme.light, PI = Math.PI, b = W.bounds, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    scene.fog.color.set(L.fog.color); scene.fog.near = L.fog.near; scene.fog.far = L.fog.far;
    renderer.toneMappingExposure = L.exposure || 1; if (post) post.cfg.exposure = L.exposure || 1;
    havnUniforms.indTint.value = L.indirect || [1, 1, 1];                 // v20: bagt himmellys' tone (sommer: varmt tilbagekast)
    hemi.color.set(L.hemiSky); hemi.groundColor.set(L.hemiGround); hemi.intensity = L.hemiInt * PI; amb.intensity = L.ambInt * PI;
    // sol: nær-kaskade (følger kameraet, skarpe skygger) + hele banen (statisk skyggekort, intensitet 0 – kun til fjerne skygger)
    sun.color.set(L.sunColor); sun.intensity = L.sunInt * PI;
    sunFar.target.position.set(cx, 0, cz); sunFar.position.set(cx + L.sunPos[0], L.sunPos[1], cz + L.sunPos[2]);
    const r = Math.hypot(b.x1 - b.x0, b.z1 - b.z0) / 2 + 6, sc = sunFar.shadow.camera; sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 1; sc.far = 300; sc.updateProjectionMatrix();
    sunDir.set(...L.sunPos).normalize();
    if (post) { post.setLook(V.theme.post); post.setSun(sunDir); }      // banens filmiske 'look' (grading, sol-stråler, dis mod solen)
    sky = V.buildSky(new THREE.Vector3(...L.sunPos)); scene.add(sky);
    // miljø-refleksioner (fra himlen) til metal i verden og førstepersonsvåben
    try {
      if (!pmrem) pmrem = new THREE.PMREMGenerator(renderer); if (envTex) envTex.dispose();
      if (L.skyTex) envTex = pmrem.fromEquirectangular(L.skyTex).texture;                           // v11: HDRI → præfiltreret miljølys (IBL)
      else { const sk = new THREE.Scene(), s2 = V.buildSky(new THREE.Vector3(...L.sunPos)); s2.material.uniforms.cloud.value = 0; sk.add(s2); envTex = pmrem.fromScene(sk, 0.04).texture; disposeTree(s2); }
    } catch (e) { envTex = null; }
    worldGroup = V.buildWorldMesh(); decorGroup = V.buildDecor(); doors = V.buildDoors(); fxObj = V.buildFx();
    for (const g of [worldGroup, decorGroup]) { scene.add(g); g.updateMatrixWorld(true); g.traverse(o => { o.matrixAutoUpdate = false; }); mapObjs.push(g); }   // statisk: ingen matrix-opdatering pr. frame
    scene.add(doors.group); mapObjs.push(doors.group);
    scene.add(fxObj.group); mapObjs.push(fxObj.group);
    // PBR: metal (gelændere, stiger, gitre, containere, rør) reflekterer himlen; beton/mursten/træ er ru og får ingen spejling
    const seen = new Set();
    // v11: med HDRI (L.ibl) får ALLE PBR-flader miljølys (diffust + glans; bagt himmel-synlighed dæmper det indendørs) – ellers kun metal
    for (const g of [worldGroup, decorGroup, doors.group]) g.traverse(o => { const m = o.material; if (!m || seen.has(m) || !m.isMeshStandardMaterial) return; seen.add(m); const p = m.userData.pbr; const metal = (p && p.metal >= 0.3) || (!p && m.roughness < 0.3); if (metal || L.ibl) { m.envMap = envTex; m.envMapIntensity = metal ? 0.85 : L.ibl; m.needsUpdate = true; } });
    if (minimapCtx) drawMinimapBase();
    try { buildSiteMarks(); } catch (e) { console.warn('[sites] markering', e); }
    if (Game.state === 'game') Audio.ambience(W.id);
    for (const [, rm] of remoteModels) dropRemote(rm); remoteModels.clear();
    for (const k in vm.models) { vmScene.remove(vm.models[k]); } vm.models = {}; vm.cur = null;
    for (const k in nadeModels) delete nadeModels[k];
    sunFar.shadow.needsUpdate = true;                       // statisk skyggekort gentegnes kun når banen skiftes
    mapId = W.id;
    if (DEV) console.log('[dev] bane', W.id, 'bygget på', Math.round(performance.now() - t0), 'ms', 'verden', worldGroup.userData.tris, 'tri, dekor', decorGroup.userData.tris, 'tri, bagte punkter', worldGroup.userData.bakeN);
    loading = false; $('loadingMap').classList.add('hidden');
    if (W.id !== mapId) loadMap(); else tryLoadAck();
  }

  /* ---------------- spillere ---------------- */
  function makeRemote(side, cos) {
    const h = Chars.buildHuman(side, cos && cos.agent ? cos.agent[side] : null);
    h.skins = (cos && cos.skins) || {};
    // navneskilt: altid oven på geometrien (depthTest:false) – klipper aldrig ind i vægge; kun holdkammerater vises (som i CS)
    // v14: navnet tegnes som skarp HTML oven på billedet (native opløsning, ingen post-effekter) – 3D-objektet er kun et ankerpunkt
    const label = new THREE.Object3D(); label.position.y = 2.12;
    h.group.add(label); h.label = label; h.lastName = '';
    h.tagEl = document.createElement('div'); h.tagEl.className = 'ntag ' + (side === 'hij' ? 'hij' : 'swat'); h.tagEl.style.display = 'none'; $('nameTags').appendChild(h.tagEl);
    h.stepCb = (hh, sp) => { const p = hh.group.position; Audio.step({ x: p.x, y: p.y, z: p.z }, false, onMetal(p.x, p.y, p.z)); };
    scene.add(h.group);
    return h;
  }
  const onMetal = (x, y, z) => { for (const b of W.boxes) if ((b.kind === 'grate' || b.kind === 'steelstairs') && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && Math.abs(y - b.y1) < 0.3) return true; return false; };
  function updateLabel(rm, name) {
    if (rm.lastName === name) return;
    rm.lastName = name; rm.tagEl.textContent = name;
  }
  const dropRemote = r => { scene.remove(r.group); if (r.tagEl) r.tagEl.remove(); };
  // navneskilte: projicér ankeret til skærmen hver frame (kun holdkammerater, som i CS); svinder ud på lang afstand
  const _tp = new THREE.Vector3();
  function placeNameTags() {
    const W2 = innerWidth, H2 = innerHeight;
    for (const [, r] of remoteModels) {
      const el = r.tagEl; if (!el) continue;
      let show = Game.state === 'game' && r.group.visible && r.label.visible && r.labelOn !== false;
      if (show) {
        r.label.getWorldPosition(_tp); const d = _tp.distanceTo(camera.position); _tp.project(camera);
        if (_tp.z > 1 || Math.abs(_tp.x) > 1.2 || Math.abs(_tp.y) > 1.2) show = false;
        else {
          const x = Math.round((_tp.x * 0.5 + 0.5) * W2), y = Math.round((-_tp.y * 0.5 + 0.5) * H2), o = d < 30 ? 1 : Math.max(0.35, 1 - (d - 30) / 40);
          el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`; el.style.opacity = o.toFixed(2);
        }
      }
      el.style.display = show ? '' : 'none';
    }
  }


  /* ---------------- init ---------------- */
  const sunDir = new THREE.Vector3(0.6, 0.6, 0.4);
  function init() {
    renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: false, powerPreference: 'high-performance' });
    post = NOPOST ? null : createPost(THREE, renderer);
    if (post && !post.supported) post = null;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;           // skarpe, rene kanter (høj opløsning + 3×3 PCF) – ingen pixelering
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.setSize(innerWidth, innerHeight);
    renderer.autoClear = false; renderer.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    scene.background = null;                               // himmelkuplen dækker alt (skriver alpha 0 => springes over i AO/tonemapping)
    scene.fog = new THREE.Fog(0xbcd0a0, 70, 170);
    camera = new THREE.PerspectiveCamera(90, innerWidth / innerHeight, 0.05, 320);
    camera.rotation.order = 'YXZ';
    scene.add(camera);
    clock = new THREE.Clock();

    hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1); scene.add(hemi);
    amb = new THREE.AmbientLight(0xffffff, 0.2); scene.add(amb);
    const big = renderer.capabilities.maxTextureSize >= 8192;
    // nær-kaskade: 4096² over ±30 m => ~1,5 cm pr. texel (skarpe skygger tæt på), følger kameraet med texel-snapping (ingen flimren)
    sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true;
    sun.shadow.mapSize.set(big ? 4096 : 2048, big ? 4096 : 2048); sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.02; sun.shadow.radius = 1;
    const sc = sun.shadow.camera; sc.left = -NEAR_R; sc.right = NEAR_R; sc.top = NEAR_R; sc.bottom = -NEAR_R; sc.near = 1; sc.far = 260; sc.updateProjectionMatrix();
    scene.add(sun); scene.add(sun.target);
    // fjern-kaskade: hele banen, statisk (gentegnes kun ved banebyt); lyset selv har intensitet 0 – kun skyggekortet bruges (visuals.js: wdCascade)
    sunFar = new THREE.DirectionalLight(0xffffff, 0); sunFar.castShadow = true; sunFar.shadow.autoUpdate = false;
    sunFar.shadow.mapSize.set(big ? 4096 : 2048, big ? 4096 : 2048); sunFar.shadow.bias = -0.0005; sunFar.shadow.normalBias = 0.04;
    scene.add(sunFar); scene.add(sunFar.target);
    flashLight = new THREE.PointLight(0xffc880, 0, 9, 2); scene.add(flashLight);    // altid til stede (intensitet 0) => ingen shader-genkompilering
    for (let i = 0; i < 2; i++) { const l = new THREE.PointLight(0xff8030, 0, 10, 2); scene.add(l); fireLights.push(l); }   // ild-lys-pulje

    // førstepersons-scene (eget lys + mundingsild-lys der oplyser hænder og våben)
    vmScene = new THREE.Scene(); vmCam = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.01, 10);
    vmHemi = new THREE.HemisphereLight(0xffffff, 0x666666, 1); vmScene.add(vmHemi);
    vmSun = new THREE.DirectionalLight(0xffffff, 1); vmScene.add(vmSun); vmScene.add(vmSun.target);
    vmLight = new THREE.PointLight(0xffc070, 0, 1.6, 2); vmScene.add(vmLight);

    ensureChars();
    fxs = createFx(THREE, { scene, WD, canvasTexture, getW: () => W, probe: (x, y, z, out) => V ? V.probe(x, y, z, out) : (out[0] = out[1] = out[2] = 0, out[3] = 1, out), audio: Audio, lights: fireLights });
    loadMap();
    // patronhylstre (messing) i førstepersons-scenen
    const shellGeo = new THREE.CylinderGeometry(0.0055, 0.0055, 0.024, 8), shellMat = new THREE.MeshStandardMaterial({ color: 0xc89a3a, metalness: 0.9, roughness: 0.3 });
    for (let i = 0; i < 14; i++) { const s = new THREE.Mesh(shellGeo, shellMat); s.visible = false; vmScene.add(s); vm.shells.push({ mesh: s, t: 1, vx: 0, vy: 0, vz: 0 }); }

    // v13: tilpas til skærmen – canvas, kameraer og post-processing følger vinduet (også fuldskærm, rotation og zoom i browseren)
    let rzPend = false;
    const onResize = () => {
      if (rzPend) return; rzPend = true;
      requestAnimationFrame(() => {
        rzPend = false;
        const w = Math.max(1, innerWidth), h = Math.max(1, innerHeight);
        camera.aspect = w / h; camera.updateProjectionMatrix();
        vmCam.aspect = camera.aspect; vmCam.updateProjectionMatrix();
        renderer.setSize(w, h);
        if (post && post.setSize) { const v = renderer.getDrawingBufferSize(new THREE.Vector2()); post.setSize(v.x, v.y); }
        fitUI(); if (minimapCtx && W) drawMinimapBase();
      });
    };
    for (const ev of ['resize', 'orientationchange', 'fullscreenchange', 'webkitfullscreenchange']) (ev.includes('fullscreen') ? document : window).addEventListener(ev, onResize);
    if (window.visualViewport) visualViewport.addEventListener('resize', onResize);

    setQuality(Settings.get().gfx || 'auto');
    minimapCtx = $('minimap').getContext('2d');
    drawMinimapBase();
    Input.init();
    requestAnimationFrame(loop);
  }
  const NEAR_R = 30;
  // figur- og våbenbyggere: oprettes ved første brug (også fra inventaret i hovedmenuen, før et spil er startet)
  function ensureChars() {
    if (Chars) return;
    // dynMat før banen er bygget (fx forhåndsvisning i inventaret i hovedmenuen): almindeligt PBR-materiale
    const mkDyn = p => V ? V.dynMat(p) : new THREE.MeshStandardMaterial(Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)));
    Chars = createCharacters(THREE, WD, { canvasTexture, derivePBR, dynMat: mkDyn, weaponModel: (id, m, team, skin) => Weap.worldModel(id, m, team, skin),
      agentTemplate: (side, key) => { const a = SK.agentOf(key || SK.defaultAgent(side), side), tpl = COS.chars[a.agent.model]; return tpl ? { tpl, variant: a.variant, key: a.key } : COS.ready ? null : { pending: true }; },
      cloneSkinned: r => cloneSkinned(THREE, r), recolor: (root, v) => SK.recolorAgent(THREE, root, v, mkDyn) });
    Weap = createWeapons(THREE, WD, { canvasTexture, derivePBR, dynMat: mkDyn, withBake: (m, d) => V ? V.withBake(m, d) : m,
      gunTemplate: (id, team) => { const f = SK.GUN_FILE[id], n = f && typeof f === 'object' ? f[team === 'hij' ? 'hij' : 'swat'] : f; return n ? COS.guns[n] || null : null; },
      skinGun: (g, skinId, team, mk) => SK.skinGun(THREE, g, skinId, team, mk), knifeTemplate: m => COS.knives[m] || null });
    loadCosmetics();
  }
  /* ---------------- v11.3: agenter (GLB-figurer) og våbenmodeller – hentes i baggrunden; indtil da bruges de procedurale ---------------- */
  const COS = { chars: {}, guns: {}, knives: {}, ready: false };
  async function loadCosmetics() {
    const charFiles = [...new Set(Object.values(SK.AGENTS).flat().map(a => a.model))];
    const PROC = { ak47: buildAK47 };                                     // v14: procedurale skabeloner (samme pipeline som GLB)
    for (const k in PROC) COS.guns[k] = SK.prepGun(THREE, bakeStatic(THREE, PROC[k](THREE)), {});
    const gunFiles = [...new Set(Object.values(SK.GUN_FILE).flatMap(f => typeof f === 'object' ? Object.values(f) : [f]))].filter(f => !PROC[f]);
    const nades = new Set(['he_east', 'he_west', 'smoke_east', 'smoke_west', 'flash', 'incgren', 'molotov']);
    await Promise.all([
      ...charFiles.map(async f => { try {
        const { scene } = await retryLoad(() => loadGLB(THREE, '/assets/chars/' + f + '.glb?v20')); scene.updateMatrixWorld(true);
        let head = null; scene.traverse(o => { if (o.isBone && (o.name === 'Head' || o.name === 'head')) head = o; });
        const hy = head ? head.getWorldPosition(new THREE.Vector3()).y : 1.6;
        COS.chars[f] = { scene, scale: 1.61 / Math.max(0.2, hy) };               // samme hovedhøjde som den procedurale figur (øjne/hitbox)
      } catch (e) { console.warn('[cos] figur ' + f, e); } }),
      ...SK.KNIVES.map(async k => { try {                                         // v19: Blender-modellerede knive
        const { scene } = await retryLoad(() => loadGLB(THREE, '/assets/weapons/knives/knife_' + k.id + '.glb?v20')); COS.knives[k.id] = scene;
      } catch (e) { console.warn('[cos] kniv ' + k.id, e); } }),
      ...gunFiles.map(async f => { try {
        const { scene } = await loadGLB(THREE, '/assets/weapons/' + f + '.glb');
        COS.guns[f] = SK.fixGun(THREE, SK.prepGun(THREE, bakeStatic(THREE, scene), { nade: nades.has(f) }), f);
      } catch (e) { console.warn('[cos] våben ' + f, e); } })
    ]);
    COS.ready = true; onCosmetics();
  }
  // nye valg/skabeloner: byg førstepersonsvåben og fjernspilleres figurer om ved næste frame
  async function retryLoad(fn) { let err; for (let i = 0; i < 3; i++) { try { return await fn(); } catch (e) { err = e; await new Promise(r => setTimeout(r, 600 * (i + 1))); } } throw err; }
  function onCosmetics() { tryLoadAck(); if (vmScene) for (const k in vm.models) vmScene.remove(vm.models[k]); vm.models = {}; vm.cur = null; for (const [, r] of remoteModels) r.wantKey = null; if (Inv.isOpen()) Inv.refresh(); }

  function onRoundStart() {
    for (const [, o] of Game.grenadesFly) scene.remove(o.mesh);
    Game.grenadesFly.clear();
    for (const [, f] of fireSys) f.remove(); fireSys.clear();
    for (const [, s] of smokeSys) s.remove(); smokeSys.clear();
    vm.drawT = 0;
  }
  function shake(mag) { shakeMag = Math.max(shakeMag, mag); shakeT = 0.28; }
  function pulseLight(x, y, z, i, color, dur) { flashLight.position.set(x, y, z); flashLight.color.set(color || 0xffc880); flashLight.intensity = i; flashLight.distance = i > 20 ? 22 : 9; flashLightT = dur || 0.06; }

  function onShotFx(m) {
    const rm = remoteModels.get(m.i);
    let sp = m.o;
    if (rm && rm.flash) { rm.flash.updateMatrixWorld(true); const mp = rm.flash.getWorldPosition(_v); if (Math.hypot(mp.x - m.o[0], mp.y - m.o[1], mp.z - m.o[2]) < 1.5) sp = [mp.x, mp.y, mp.z]; }   // fra fjendens munding
    addTracer(sp, m.e, false);
    if (rm) Chars.fire(rm);
    if (m.h) for (const [id, o] of remoteModels) {   // skud-reaktion hos ramt spiller
      if (id === m.i) continue;
      const dx = o.group.position.x - m.e[0], dy = o.group.position.y + 1 - m.e[1], dz = o.group.position.z - m.e[2];
      if (dx * dx + dy * dy + dz * dz < 1.5) Chars.flinch(o);
    }
    if (m.n) impactAt(m.e, m.n);
    Audio.shot(m.w, { x: m.o[0], y: m.o[1], z: m.o[2] }, false);
    if (WEAPONS[m.w] && m.w !== 'usp' && m.w !== 'mp5') pulseLight(m.o[0], m.o[1], m.o[2], 6, 0xffc880, 0.05);
  }
  function impactAt(p, n, col, small) {
    if (fxs) { const metal = !!(col && (col.k === 'grate' || col.k === 'rail' || col.k === 'steelstairs' || col.k === 'glass')); fxs.impact(p[0], p[1], p[2], n[0], n[1], n[2], metal); if (!small) Audio.impact({ x: p[0], y: p[1], z: p[2] }, metal); }
    if (small) return;
    if (!impMesh) {
      impMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(0.03, 10), new THREE.MeshBasicMaterial({ map: holeTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), IMP_MAX);
      impMesh.frustumCulled = false; _m4.makeScale(0, 0, 0); for (let i = 0; i < IMP_MAX; i++) impMesh.setMatrixAt(i, _m4); scene.add(impMesh);
    }
    _v.set(p[0] + n[0] * 0.006, p[1] + n[1] * 0.006, p[2] + n[2] * 0.006); _q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(n[0], n[1], n[2]).normalize()); _m4.compose(_v, _q, _sc.setScalar(0.8 + Math.random() * 0.5));
    impMesh.setMatrixAt(impI, _m4); impT[impI] = 0; impI = (impI + 1) % IMP_MAX; impMesh.instanceMatrix.needsUpdate = true;
  }
  function onPlant(m) { pulseLight(m.x, m.y + 0.4, m.z, 3, 0xff3020, 0.15); }
  function onExplode(m) { fireball(m.x, m.y, m.z, 6); shake(0.9); pulseLight(m.x, m.y + 2, m.z, 60, 0xffa050, 0.6); Audio.boom({ x: m.x, y: m.y, z: m.z }, true); }
  function onBoom(m) { fireball(m.x, m.y, m.z, 2.2); shake(0.5); pulseLight(m.x, m.y + 0.5, m.z, 30, 0xffa050, 0.3); Audio.boom({ x: m.x, y: m.y, z: m.z }, false); }
  let fbTex = null;
  function fireball(x, y, z, size) {
    if (!fbTex) fbTex = canvasTexture((c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.3, 'rgba(255,170,60,.9)'); g.addColorStop(0.7, 'rgba(160,50,10,.4)'); g.addColorStop(1, 'rgba(40,20,10,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }, 128, 128);
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: fbTex, color: new THREE.Color(2.6, 2.3, 2.0), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));   // HDR => bloom
      s.position.set(x + (Math.random() - 0.5) * size * 0.4, y + 0.4 + Math.random() * size * 0.3, z + (Math.random() - 0.5) * size * 0.4); s.scale.setScalar(size * (0.5 + Math.random() * 0.5));
      scene.add(s); flashes.push({ mesh: s, t: 0, big: true, size });
    }
  }
  function onSmokePop(m) { Audio.hiss({ x: m.x, y: m.y, z: m.z }); }
  function onFlashPop(m) { fxs.flashPop(m.x, m.y, m.z); pulseLight(m.x, m.y + 0.2, m.z, 90, 0xffffff, 0.12); Audio.flashbang({ x: m.x, y: m.y, z: m.z }); }
  function onFirePop(m) { const p = { x: m.x, y: m.y + 0.2, z: m.z }; if (m.w === 'molotov') Audio.glass(p); Audio.ignite(p); pulseLight(m.x, m.y + 0.8, m.z, 25, 0xff8a30, 0.25); }
  function onFireOut(m) { const f = fireSys.get(m.id); if (f) { f.remove(); fireSys.delete(m.id); } Audio.fizzle(null); }
  function onRemoteThrow(m) { const rm = remoteModels.get(m.i); if (rm) { Chars.throwNade(rm, !!m.u); const p = rm.group.position; Audio.throwSnd({ x: p.x, y: p.y + 1.4, z: p.z }, false); } }
  function onThrowLocal(under) { vm.throwT = 0; vm.throwU = !!under; vm.pinT = 1; }
  function onPinPull(under) { vm.pinT = 0; vm.throwU = !!under; }
  function onWeaponChange() { vm.drawT = 0; vm.pinT = 1; vm.meleeT = 1; vm.inspT = 1; }
  function mouseDelta(dx, dy) { vm.sway.tx += dx; vm.sway.ty += dy; }

  /* ---------------- minimap: det lag spilleren står i (B under A på Nuke) ---------------- */
  // v14: minimap i skærmens rigtige opløsning (devicePixelRatio × UI-skala) – tegnes i et logisk 200×200-koordinatsystem
  function drawMinimapBase() {
    const c = minimapCtx.canvas, b = W.bounds, LOG = 200;
    const ui = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui')) || 1;
    const css = TOUCH ? (c.clientWidth || 120) : Math.round(LOG * ui);
    if (!TOUCH) { c.style.width = css + 'px'; c.style.height = css + 'px'; }
    const k = Math.min(4, css / LOG * (window.devicePixelRatio || 1)); mm.k = k;
    if (c.width !== Math.round(LOG * k)) { c.width = c.height = Math.round(LOG * k); }
    const scale = Math.min((LOG - 8) / (b.x1 - b.x0), (LOG - 8) / (b.z1 - b.z0));
    mm.scale = scale; mm.ox = LOG / 2 - (b.x0 + b.x1) / 2 * scale; mm.oz = LOG / 2 - (b.z0 + b.z1) / 2 * scale;
    mm.layers = [];
    const Tt = W.tile;
    W.layers.forEach((L, li) => {
      const off = document.createElement('canvas'); off.width = c.width; off.height = c.height; const x = off.getContext('2d'); x.setTransform(k, 0, 0, k, 0, 0);
      x.fillStyle = 'rgba(10,10,10,.82)'; x.fillRect(0, 0, LOG, LOG);
      const RI = radarImages(W.id, () => drawMinimapBase());
      if (RI) {                                                                    // v16: rent radarbillede for laget (samme højdebånd)
        const ri = RI.meta.layers.findIndex(r => Math.abs(r.yb - L.yb) < 0.01 && Math.abs(r.yt - L.yt) < 0.01);
        drawRadarImage(x, RI, scale, mm.ox, mm.oz, ri >= 0 ? ri : Math.min(li, RI.meta.layers.length - 1));
        if (!RI.meta.labels) { x.strokeStyle = '#ff2b1f'; x.lineWidth = 1.5; x.fillStyle = '#ff2b1f'; x.font = '900 12px Arial';
          for (const k in W.sites) { const st = W.sites[k]; if (st.y < L.yb - 0.1 || st.y > L.yt) continue; x.strokeRect(st.x0 * scale + mm.ox, st.z0 * scale + mm.oz, (st.x1 - st.x0) * scale, (st.z1 - st.z0) * scale); x.fillText(k, st.x0 * scale + mm.ox + 2, st.z0 * scale + mm.oz + 11); } }
        mm.layers.push({ yb: L.yb, yt: L.yt, canvas: off }); return;
      }
      if (W.data) drawBoxLayer(x, L, scale, mm.ox, mm.oz, li === W.layers.length - 1);   // v12.1: bane bygget af bokse (Nuke fra STL)
      else for (let r = 0; r < Tt.GH; r++) for (let q = 0; q < Tt.GW; q++) {
        const t = L.tiles[L.grid[r][q]]; if (!t || t.solid) continue;
        x.fillStyle = t.void ? 'rgba(120,120,120,.6)' : t.lintel !== undefined && t.lintel < 2 ? 'rgba(170,190,200,.8)' : 'rgba(236,236,232,.95)';
        x.fillRect(Math.floor((Tt.GX0 + q * Tt.TILE) * scale + mm.ox), Math.floor((Tt.GZ0 + r * Tt.TILE) * scale + mm.oz), Math.ceil(Tt.TILE * scale), Math.ceil(Tt.TILE * scale));
      }
      x.fillStyle = 'rgba(10,10,10,.55)';
      for (const b2 of W.boxes) if (b2.kind === 'prop' && b2.y0 >= L.yb - 0.1 && b2.y0 < L.yt) x.fillRect(b2.x0 * scale + mm.ox, b2.z0 * scale + mm.oz, (b2.x1 - b2.x0) * scale, (b2.z1 - b2.z0) * scale);
      x.strokeStyle = '#ff2b1f'; x.lineWidth = 1.5; x.fillStyle = '#ff2b1f'; x.font = '900 12px Arial';
      for (const k in W.sites) { const st = W.sites[k]; if (st.y < L.yb - 0.1 || st.y > L.yt) continue; x.strokeRect(st.x0 * scale + mm.ox, st.z0 * scale + mm.oz, (st.x1 - st.x0) * scale, (st.z1 - st.z0) * scale); x.fillText(k, st.x0 * scale + mm.ox + 2, st.z0 * scale + mm.oz + 11); }
      mm.layers.push({ yb: L.yb, yt: L.yt, canvas: off });
    });
  }
  function drawMinimapDyn() {
    const { scale, ox, oz } = mm, ctx = minimapCtx, c = ctx.canvas;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height);
    const py = Game.body.y + 0.5; let lay = mm.layers[mm.layers.length - 1];
    for (const L of mm.layers) if (py >= L.yb && py < L.yt) lay = L;
    if (lay) ctx.drawImage(lay.canvas, 0, 0);
    ctx.setTransform(mm.k || 1, 0, 0, mm.k || 1, 0, 0);
    const b = Game.bomb;
    if (b.state === 2 || (b.state === 1 && Game.side === 'hij')) { ctx.fillStyle = b.state === 2 ? '#ff2b1f' : '#f2c200'; ctx.beginPath(); ctx.arc(b.x * scale + ox, b.z * scale + oz, 3.6, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,120,30,.55)';                  // aktive ildzoner
    for (const [, f] of fireSys) { const z = f.zone; ctx.beginPath(); z.rad.forEach((r, i) => { const a = i / z.rad.length * Math.PI * 2, X = (z.x + Math.cos(a) * r) * scale + ox, Z = (z.z + Math.sin(a) * r) * scale + oz; i ? ctx.lineTo(X, Z) : ctx.moveTo(X, Z); }); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = 'rgba(200,200,200,.55)';
    for (const [, s] of smokeSys) { ctx.beginPath(); ctx.arc(s.x * scale + ox, s.z * scale + oz, 3.3 * scale, 0, 7); ctx.fill(); }
    for (const [id, r] of Game.remotes) {
      const pl = Game.players.get(id); if (!pl || !r.alive || pl.side !== Game.side) continue;   // fog of war: ingen fjender på minimappet
      ctx.fillStyle = pl.side === 'hij' ? '#ff5a40' : '#4a8cff';
      ctx.globalAlpha = lay && (r.ry + 0.5 < lay.yb || r.ry + 0.5 >= lay.yt) ? 0.45 : 1;
      ctx.beginPath(); ctx.arc(r.rx * scale + ox, r.rz * scale + oz, 3.2, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#f2c200';
    ctx.save(); ctx.translate(Game.body.x * scale + ox, Game.body.z * scale + oz); ctx.rotate(-Game.yaw);   // canvas roterer med uret, verdens-yaw mod uret
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill(); ctx.restore();
  }

  /* ---------------- droppede våben på jorden (rigtige 3D-modeller) ---------------- */
  const dropMeshes = new Map();
  function makeDropMesh(code) {
    const id = WD.WEAPON_BY_CODE[code], g = new THREE.Group();
    const wm = Weap.worldModel(id) || new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), V.dynMat({ color: 0x3d5a32 }));
    wm.rotation.set(0, 0, Math.PI / 2); wm.position.y = 0.035; g.add(wm);
    g.userData.wm = wm;
    scene.add(g); return g;
  }
  function syncDrops(dt) {
    const seen = new Set(), near = Game.self.alive && Game.phase === 'live' ? nearestDrop() : null;
    for (const d of Game.drops) {
      seen.add(d[0]);
      let m = dropMeshes.get(d[0]); if (!m) { m = makeDropMesh(d[1]); m.rotation.y = (d[0] * 2.39) % 6.28; dropMeshes.set(d[0], m); const pr = V.probe(d[2], d[3] + 0.3, d[4]); m.traverse(n => { if (n.material && n.material.userData.uBake) n.material.userData.uBake.value.set(pr[0], pr[1], pr[2], Math.max(0.12, pr[3])); }); }
      m.position.set(d[2], d[3], d[4]);
    }
    for (const [id, m] of dropMeshes) if (!seen.has(id)) { scene.remove(m); dropMeshes.delete(id); }
    const el = $('promptPick');
    let lad = null;
    if (!near && Game.self.alive && W.ladders.length && !Game.body.onLadder) { const b = Game.body; for (const l of W.ladders) if (b.x > l.x0 - 0.9 && b.x < l.x1 + 0.9 && b.z > l.z0 - 0.9 && b.z < l.z1 + 0.9 && b.y >= l.y0 - 0.3 && b.y < l.y1 - 0.2) { lad = l; break; } }
    if (lad) { const t = 'HOLD <b>W</b> MOD STIGEN FOR AT KLATRE'; if (el._t !== t) { el._t = t; el.innerHTML = t; } el.classList.remove('hidden'); }
    else if (near) { const t = 'TRYK <b>E</b> FOR AT TAGE ' + WEAPONS[WD.WEAPON_BY_CODE[near[1]]].name; if (el._t !== t) { el._t = t; el.innerHTML = t; } el.classList.remove('hidden'); } else el.classList.add('hidden');
  }

  function flinchAim() {   // lokal skytte ser ofret vakle (ingen 'shot'-event til skytten)
    const o = camEyePos(), d = camForward(); let best = null, bd = 1.2;
    for (const [, r] of remoteModels) {
      const px = r.group.position.x - o.x, py = r.group.position.y + 1 - o.y, pz = r.group.position.z - o.z, t = px * d.x + py * d.y + pz * d.z;
      if (t < 0) continue;
      const dist = Math.hypot(px - d.x * t, py - d.y * t, pz - d.z * t);
      if (dist < bd) { bd = dist; best = r; }
    }
    if (best) Chars.flinch(best);
  }

  /* ---------------- flyvende granater: rigtige modeller pr. type (molotov brænder i luften) ---------------- */
  function nadeMesh(type) {
    const id = WD.NADE_BY_TYPE[type] || 'he';
    const wm = Weap.worldModel(id) || new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), V.dynMat({ color: 0x4a5a32 }));
    wm.traverse(n => { if (n.isMesh) n.castShadow = true; });
    return wm;
  }

  /* ---------------- fjern-spillere (interpolation 100 ms bagud) ---------------- */
  function sampleRemotes(dt) {
    // v12: interpolation på SERVERTID (snapshot.st) med et udjævnet ur-offset i stedet for modtagetid – netværks-jitter giver
    // ikke længere hakkende modstandere, og den viste servertid (renderST) sendes med hvert skud, så serverens lag-kompensation
    // spoler modstanderne tilbage til præcis det billede man sigtede efter
    const RENDER_DELAY = 100;
    const now = performance.now();
    const buf = Game.snapBuf;
    if (buf.length < 1) return;
    const target = now + (Game.clk === null ? buf[buf.length - 1].st - buf[buf.length - 1].recv : Game.clk) - RENDER_DELAY;
    let i = buf.length - 1;
    while (i > 0 && buf[i - 1].st > target) i--;
    const s1 = buf[i], s0 = buf[Math.max(0, i - 1)];
    const span = Math.max(1, s1.st - s0.st);
    const f = clamp((target - s0.st) / span, 0, 1);
    Game.renderST = s0.st + (s1.st - s0.st) * f;
    const seen = new Set(), tsec = now / 1000;
    for (const row of s1.p) {
      const [id, x, y, z, yaw] = row;
      const flags = row[6];
      seen.add(id);
      if (id === Game.meId) continue;
      const prevRow = s0.p.find(r => r[0] === id) || row;
      let r = remoteModels.get(id);
      const side = (Game.players.get(id) || {}).side || 'swat';
      const pcos = (Game.players.get(id) || {}).cos, want = (COS.ready ? 'm' : 'p') + SK.agentOf(pcos && pcos.agent ? pcos.agent[side] : null, side).key + JSON.stringify((pcos && pcos.skins) || {});
      if (r && (r.side !== side || (r.wantKey !== null && r.wantKey !== want) || r.wantKey === null)) { dropRemote(r); remoteModels.delete(id); r = null; }   // sideskift / nyt agent-valg / modeller indlæst
      if (!r) { r = makeRemote(side, pcos); r.wantKey = want; remoteModels.set(id, r); }
      const rx = lerp(prevRow[1], x, f), ry = lerp(prevRow[2], y, f), rz = lerp(prevRow[3], z, f);
      const ryaw = lerpAngle(prevRow[4], yaw, f), rpitch = lerp(prevRow[5] || 0, row[5] || 0, f);
      const alive = !!(flags & 1);
      // animationstilstande synkroniseret over netværket: nedhuk, plant/desarmér, i luften, genladning, split trukket
      Chars.animateHuman(r, dt, tsec, { x: rx, y: ry, z: rz, yaw: ryaw, pitch: rpitch, alive, crouch: !!(flags & 2), act: !!(flags & 4), grounded: !!(flags & 8), reload: !!(flags & 16), pin: !!(flags & 32), wcode: row[7] || 0 });
      if (!r.bakeT || now - r.bakeT > 120) { r.bakeT = now; V.probe(rx, ry + 1.1, rz, _bk); Chars.setBake(r, _bk); }
      Chars.setLod(r, Math.hypot(rx - camera.position.x, rz - camera.position.z));
      const pl = Game.players.get(id);
      updateLabel(r, pl ? pl.name : ('#' + id));
      r.labelOn = side === Game.side;                                  // kun holdkammeraters navne (som i CS)
      r.group.visible = !(!Game.self.alive && Game.phase !== 'buy' && id === Game.specId);   // spectator ser gennem den observeredes øjne
      Game.remotes.set(id, { rx, ry, rz, alive, yaw: ryaw, pitch: rpitch, crouch: !!(flags & 2) });
    }
    for (const [id, r] of remoteModels) if (!seen.has(id)) { dropRemote(r); remoteModels.delete(id); Game.remotes.delete(id); }

    // granater i luften (interpoleret mellem snapshots)
    const flyIds = new Set();
    for (const row of s1.g) {
      const [gid, type, gx, gy, gz] = row, pr = s0.g.find(q => q[0] === gid) || row;
      flyIds.add(gid);
      let o = Game.grenadesFly.get(gid);
      if (!o) { const mesh = nadeMesh(type); scene.add(mesh); o = { mesh, type }; Game.grenadesFly.set(gid, o); }
      o.mesh.position.set(lerp(pr[2], gx, f), lerp(pr[3], gy, f), lerp(pr[4], gz, f)); o.mesh.rotation.x += dt * 9; o.mesh.rotation.z += dt * 6;
      if (type === 3) fxs.trailFlame(o.mesh.position.x, o.mesh.position.y + 0.18, o.mesh.position.z);   // brændende klud
    }
    for (const [gid, o] of Game.grenadesFly) if (!flyIds.has(gid)) { scene.remove(o.mesh); Game.grenadesFly.delete(gid); }

    // røg (billboards + dybdeskrivende kerne)
    const smIds = new Set();
    for (const [sid, sx, sy, sz, msLeft, msAge] of s1.sm) {
      smIds.add(sid);
      let o = smokeSys.get(sid);
      if (!o) { o = fxs.smoke(sx, sy, sz); smokeSys.set(sid, o); }
      o.set(clamp(msAge / 1400, 0, 1), clamp(msLeft / 2000, 0, 1));
    }
    for (const [sid, o] of smokeSys) if (!smIds.has(sid)) { o.remove(); smokeSys.delete(sid); }

    // ild (polygon-zone, partikler, lys)
    const fIds = new Set();
    for (const [fid, type, fx, fy, fz, msLeft] of (s1.f || [])) {
      fIds.add(fid);
      let o = fireSys.get(fid);
      if (!o) { o = fxs.fire(fx, fy, fz, WD.NADE_BY_TYPE[type]); fireSys.set(fid, o); }
      o.set(msLeft);
    }
    for (const [fid, o] of fireSys) if (!fIds.has(fid)) { o.remove(); fireSys.delete(fid); }

    // C4: båret på ryggen af bæreren, tabt på jorden eller plantet (blinkende LED + bip der accelererer)
    const b = Game.bomb;
    if (!bombObj.dropped) { bombObj.dropped = Weap.c4Model(); bombObj.planted = Weap.c4Model(); bombObj.carry = Weap.c4Model(); for (const o of [bombObj.dropped, bombObj.planted, bombObj.carry]) { o.visible = false; scene.add(o); } }
    bombObj.dropped.visible = b.state === 1; if (b.state === 1) bombObj.dropped.position.set(b.x, b.y + 0.01, b.z);
    bombObj.planted.visible = b.state === 2;
    if (b.state === 2) {
      bombObj.planted.position.set(b.x, b.y + 0.01, b.z);
      const period = clamp(b.msLeft / 40000, 0.09, 1) * 1.0, on = (now / 1000) % period < 0.08;
      bombObj.planted.userData.led.visible = on;
      bombObj.beepT -= dt; if (bombObj.beepT <= 0) { bombObj.beepT = period; Audio.beep({ x: b.x, y: b.y, z: b.z }, b.msLeft < 10000); }
    }
    const carrier = b.state === 0 && b.carrier && b.carrier !== Game.meId ? remoteModels.get(b.carrier) : null;
    const specEyes = !Game.self.alive && Game.phase !== 'buy' && b.carrier === Game.specId;      // v13: observerer man bærer gennem dennes øjne, skjules rygsækken (den dækkede kameraet)
    if (carrier && !specEyes && Game.players.get(b.carrier) && Game.players.get(b.carrier).side === Game.side) {
      bombObj.carry.visible = true; carrier.B.chest.updateMatrixWorld(true);
      bombObj.carry.position.set(0, 0.12, 0.2).applyMatrix4(carrier.B.chest.matrixWorld); bombObj.carry.quaternion.setFromRotationMatrix(carrier.B.chest.matrixWorld); bombObj.carry.rotateX(-Math.PI / 2);
    } else bombObj.carry.visible = false;
  }

  /* ---------------- lokal spiller ---------------- */
  let stepPh = 0, wasGround = true;
  function applyCam(x, y, z, yaw, pitch) { camera.position.set(x, y, z); camera.rotation.y = yaw; camera.rotation.x = pitch; }
  const _bc = { nx: 0, ny: 0, nz: 0 };
  function updateLocal(dt) {
    applyMouse(dt);
    if (!Game.self.alive && Game.phase !== 'buy') {   // SPECTATOR: kun holdkammerater (aldrig fjender, aldrig fri kamera)
      if (!specList().includes(Game.specId)) cycleSpec(1);
      const r = Game.specId && Game.remotes.get(Game.specId);
      let t;
      if (r) { applyCam(r.rx, r.ry + (r.crouch ? PL.EYEC : PL.EYE), r.rz, r.yaw, r.pitch); t = 'OBSERVERER ' + ((Game.players.get(Game.specId) || {}).name || '') + (TOUCH ? ' — tryk på skærmen: næste' : ' — klik / mellemrum: næste'); }
      else if (bombCam()) {
        // v12: hele holdet er dødt og bomben er plantet → kameraet hænger fast ved bomben; musen drejer blikket rundt om den
        const b = Game.bomb, cx = b.x, cy = b.y + 0.35, cz = b.z, cp = Math.cos(Game.specPitch);
        const dx = Math.sin(Game.specYaw) * cp, dy = -Math.sin(Game.specPitch), dz = Math.cos(Game.specYaw) * cp;
        const d = Math.min(2.4, WD.raycastWorld(W, cx, cy, cz, dx, dy, dz, 2.4, _bc) - 0.18);
        applyCam(cx + dx * Math.max(0.3, d), cy + dy * Math.max(0.3, d), cz + dz * Math.max(0.3, d), Game.specYaw, Game.specPitch);
        t = 'OBSERVERER BOMBEN' + (TOUCH ? ' — træk for at kigge rundt' : ' — bevæg musen for at kigge rundt');
      } else { applyCam(Game.body.x, Game.body.y + PL.EYE, Game.body.z, Game.yaw, Game.pitch); t = 'ingen levende holdkammerater'; }
      if ($('deadSub').textContent !== t) $('deadSub').textContent = t;
      return;
    }
    if (Game.phase === 'buy') { applyCam(Game.body.x, Game.body.y + PL.EYE, Game.body.z, Game.yaw, Game.pitch); return; }
    const frozen = endFrozen();
    let fw = frozen ? 0 : (KEY.KeyW ? 1 : 0) - (KEY.KeyS ? 1 : 0);
    let sd = frozen ? 0 : (KEY.KeyD ? 1 : 0) - (KEY.KeyA ? 1 : 0);
    const tm = Math.hypot(Touch.mx, Touch.my);
    if (tm > 0.12 && !frozen) { fw = -Touch.my; sd = Touch.mx; }          // joystick (analog)
    const crouch = !!(KEY.ControlLeft || KEY.ControlRight || KEY.KeyC);
    const jump = !!KEY.Space;
    const walk = !!(KEY.ShiftLeft || KEY.ShiftRight) || (tm > 0.12 && tm < 0.6);   // let tryk på joysticket = lydløs gang
    Game.input.crouch = crouch;
    const y0 = Game.body.y, g0 = Game.body.ground;
    WD.stepBody(W, Game.body, { fx: fw, sx: sd, yaw: Game.yaw, jump: jump && !frozen, crouch, walk, spd: WD.speedOf(Game.self.cur) * (Game.scoped ? 0.88 : 1) }, dt);
    // v12: trin/kanter (op til 0,5 m) løftes kroppen øjeblikkeligt – kameraet glider blødt efter (Source-stil), ingen ryk i billedet
    const dy = Game.body.y - y0;
    if (g0 && Game.body.ground && dy > 0.04 && dy < 0.6) Game.stepOff -= dy;
    Game.stepOff *= Math.exp(-dt / 0.055); if (Math.abs(Game.stepOff) < 0.002) Game.stepOff = 0;
    if (Game.body.ground && !wasGround) Audio.click('land');
    wasGround = Game.body.ground;

    // procedural pattern recoil: punch følger våbnets spray-mønster ved det aktuelle skudnummer; efter en pause
    // falder skudnummeret og sigtet glider roligt tilbage (spilleren kan modvirke mønsteret ved at trække musen nedad)
    const w = WEAPONS[Game.self.cur], nowt = performance.now();
    if (w && w.kind === 'gun') {
      const idle = (nowt - Game.lastShotT) / 1000 > Math.max(0.12, w.rate * 1.25);
      if (idle && Game.sprayN > 0) Game.sprayN = Math.max(0, Game.sprayN - dt * (w.auto ? 14 : 6));
      const tgt = WD.sprayAt(w.id, Game.sprayN), k = 1 - Math.exp(-(idle ? 9 : 28) * dt);
      Game.punch.yaw += (tgt[0] - Game.punch.yaw) * k; Game.punch.pitch += (tgt[1] - Game.punch.pitch) * k;
    } else { const k = 1 - Math.exp(-9 * dt); Game.punch.yaw -= Game.punch.yaw * k; Game.punch.pitch -= Game.punch.pitch * k; Game.sprayN = 0; }

    const eye = Game.body.crouch ? PL.EYEC : PL.EYE;
    Game.camEye = Game.camEye === undefined ? eye : lerp(Game.camEye, eye, 1 - Math.exp(-14 * dt));
    const spd = Math.hypot(Game.body.vx, Game.body.vz), moving = spd > 0.5 && Game.body.ground;
    stepPh += dt * spd * 1.7;
    if (moving && spd > 4 && Math.floor(stepPh / Math.PI) !== Math.floor((stepPh - dt * spd * 1.7) / Math.PI)) Audio.step(null, true, onMetal(Game.body.x, Game.body.y, Game.body.z));
    const bob = moving ? Math.sin(stepPh) * 0.018 * clamp(spd / 6, 0, 1) : 0;
    applyCam(Game.body.x, Game.body.y + Game.camEye + bob + Game.stepOff, Game.body.z, aimYaw(), aimPitch());

    if (frozen) { Game.firing = false; return; }
    if (w && w.kind === 'knife' && (Game.firing || Game.stabbing)) {          // kniv: hold venstre = hug igen og igen, højre = stik
      const stab = Game.stabbing && !Game.firing, cd = (stab ? w.stabRate : w.slashRate) * 1000;
      if (nowt - Game.knifeT >= cd) { Game.knifeT = nowt; knifeAttack(stab); }
    }
    if (Game.firing && w && w.kind === 'gun') {
      const rate = w.rate * 1000;
      if (nowt - Game.lastFire >= rate) {
        const am = Game.self.ammo && Game.self.ammo[w.id];
        if (Game.reloading || vm.drawT < 0.6) { /* låst under reload / mens våbnet trækkes */ }
        else if (am && am.mag > 0) { Game.lastFire = nowt; doFireLocal(w); if (!w.auto) Game.firing = false; }
        else { Game.firing = false; Audio.click('empty'); startReloadLocal(); }   // tomt magasin => auto-reload
      }
    }
  }

  function doFireLocal(w) {
    const o = camEyePos();
    const spread = (w.scope && !Game.scoped ? w.unscoped : w.spread) * (Game.body.ground ? 1 : 2.2) * (Game.body.crouch ? 0.6 : 1) * (1 + Math.min(1, Game.sprayN / 12) * 0.6);
    const fwd = camForward();                                  // inkl. rekyl-punch: kuglen går hvor sigtekornet peger
    const ang1 = (Math.random() - 0.5) * spread, ang2 = (Math.random() - 0.5) * spread;
    const yw = aimYaw(), right = { x: Math.cos(yw), y: 0, z: -Math.sin(yw) };
    const dir = { x: fwd.x + right.x * ang1, y: fwd.y + ang2, z: fwd.z + right.z * ang1 };
    const l = Math.hypot(dir.x, dir.y, dir.z) || 1;
    dir.x /= l; dir.y /= l; dir.z /= l;
    Net.send({ t: 'shoot', o: [o.x, o.y, o.z], d: [dir.x, dir.y, dir.z], st: Math.round(Game.renderST) });   // v12: servertiden for det viste billede (lag-kompensation)
    localShotFx(w, o, dir);
    Game.sprayN += 1; Game.lastShotT = performance.now();
    // fysisk kick på viewmodellen: impuls bagud (mod kameraet) + opad-rotation, fjederen fører våbnet tilbage
    const kk = 0.6 + w.recoil * 30;
    vm.kick.vz += 1.6 * kk; vm.kick.vr += 9 * kk; vm.kick.vs += (Math.random() - 0.5) * 3 * kk;
    Game.muzzleT = 0.05;                                       // mundingsild: 0,05 s
    if (w.id === 'awp') { vm.boltT = 0; setTimeout(() => Audio.click('bolt'), 350); Game.scoped = false; }
    ejectShell(w);
    Audio.shot(w.id, null, true);
    if (w.id !== 'usp' && w.id !== 'mp5') pulseLight(o.x + fwd.x * 0.8, o.y + fwd.y * 0.8, o.z + fwd.z * 0.8, 6, 0xffc880, 0.05);
    // realtids-ammo: forudsig lokalt, serverens 'self' retter ved næste sync
    const am = Game.self.ammo && Game.self.ammo[w.id];
    if (am && am.mag > 0) { am.mag--; HUD.updateSelf(); }
  }

  /* ---------------- v12: egne skud – sporstreg fra mundingen, skudhul + gnister/støv hvor kuglen rammer (straks, uden at vente på serveren) ---------------- */
  const _lc = { nx: 0, ny: 1, nz: 0, c: null };
  function muzzleWorld(out) {
    // mundingen ligger i førstepersons-scenen (kamera-rum, fov 64°) → omregn til verdens-kameraets fov og transformér til verden
    const g = vm.models[Game.self.cur], meta = g && g.userData.meta;
    if (g && meta && meta.muzzle && g.visible) { out.copy(meta.muzzle); g.userData.body.localToWorld(out); const k = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.tan(THREE.MathUtils.degToRad(vmCam.fov / 2)); out.x *= k; out.y *= k; }
    else out.set(0.12, -0.12, -0.5);
    return camera.localToWorld(out);
  }
  const _mz = new THREE.Vector3();
  function localShotFx(w, o, dir) {
    const tw = WD.raycastWorld(W, o.x, o.y, o.z, dir.x, dir.y, dir.z, 220, _lc);
    let tEnd = tw, hitP = false;
    for (const [, r] of Game.remotes) {                              // rammer kuglen (visuelt) en spiller før væggen, laves intet skudhul
      if (!r.alive) continue;
      const h = WD.rayPlayer(o.x, o.y, o.z, dir.x, dir.y, dir.z, r.rx, r.ry, r.rz, r.crouch, tEnd);
      if (h) { tEnd = h.t; hitP = true; }
    }
    camera.updateMatrixWorld(); muzzleWorld(_mz);
    const e = [o.x + dir.x * tEnd, o.y + dir.y * tEnd, o.z + dir.z * tEnd];
    addTracer([_mz.x, _mz.y, _mz.z], e, true);
    if (!hitP && tw < 219.9) impactAt(e, [_lc.nx, _lc.ny, _lc.nz], _lc.c);
  }
  /* ---------------- v12: kniv ---------------- */
  function knifeAttack(stab) {
    const o = camEyePos(), d = camForward();
    vm.meleeT = 0; vm.meleeStab = !!stab; vm.meleeSide = -vm.meleeSide || 1; vm.inspT = 1;
    Audio.click(stab ? 'stab' : 'swish');
    Net.send({ t: 'shoot', a: stab ? 'k' : 's', o: [o.x, o.y, o.z], d: [d.x, d.y, d.z], st: Math.round(Game.renderST) });
  }
  function onRemoteMelee(m) {
    const rm = remoteModels.get(m.i); if (!rm) return;
    Chars.fire(rm); const p = rm.group.position;
    Audio.step({ x: p.x, y: p.y + 1.2, z: p.z }, true, false);
    if (m.h === 2 && m.e) impactAt(m.e, m.n || [0, 1, 0], null, true);
  }
  function onMeleeWall(m) { Audio.click('clank'); if (m.e) impactAt(m.e, m.n || [0, 1, 0], null, true); }
  function inspect() { if (vm.inspT >= 1 && vm.meleeT >= 1) vm.inspT = 0; }
  /* ---------------- v12: plant-zoner malet på gulvet (præcis de felter hvor WD.plantSpot tillader C4) ---------------- */
  let siteMarks = null;
  function buildSiteMarks() {
    if (siteMarks) { scene.remove(siteMarks); disposeTree(siteMarks); siteMarks = null; }
    // v14: stil efter banen – 'paint' (industriel gulvmaling: Nuke, Dust) eller 'assist' (Inferno/Ancient: ingen maling som i CS2 –
    //   kun en diskret kridtkant, og kun for den der bærer bomben)
    const grp = new THREE.Group(), C = 0.5, assist = (V && V.theme && V.theme.siteMark) === 'assist';
    grp.userData.assist = assist;
    for (const k in W.sites) {
      const st = W.sites[k], nx = Math.ceil((st.x1 - st.x0) / C), nz = Math.ceil((st.z1 - st.z0) / C), ok = new Uint8Array(nx * nz);
      let n = 0;
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { if (WD.plantSpot(W, st.x0 + (i + 0.5) * C, st.y, st.z0 + (j + 0.5) * C)) { ok[j * nx + i] = 1; n++; } }
      if (!n) continue;
      const PX = 32, cv = document.createElement('canvas'); cv.width = nx * PX; cv.height = nz * PX; const c = cv.getContext('2d');
      const on = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz && ok[j * nx + i];
      // fyld: svag gul maling + diagonale advarselsstriber langs kanten, kraftig kantlinje hvor zonen slutter
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        if (!on(i, j)) continue;
        if (assist) {                                                    // kun kanten: tynd, stiplet kridtlinje
          c.fillStyle = 'rgba(255,246,220,0.55)'; const x = i * PX, y = j * PX, dash = (i + j) % 2 === 0;
          if (dash) { if (!on(i - 1, j)) c.fillRect(x, y, 3, PX); if (!on(i + 1, j)) c.fillRect(x + PX - 3, y, 3, PX); if (!on(i, j - 1)) c.fillRect(x, y, PX, 3); if (!on(i, j + 1)) c.fillRect(x, y + PX - 3, PX, 3); }
          continue;
        }
        const x = i * PX, y = j * PX, edge = !on(i - 1, j) || !on(i + 1, j) || !on(i, j - 1) || !on(i, j + 1);
        c.fillStyle = 'rgba(255,196,40,0.05)'; c.fillRect(x, y, PX, PX);                 // v14: næsten ingen fyld – kun den malede kant og stencil-bogstavet
        if (edge) { c.save(); c.beginPath(); c.rect(x, y, PX, PX); c.clip(); c.fillStyle = 'rgba(255,190,30,0.55)'; for (let q = -PX; q < PX * 2; q += 16) { c.beginPath(); c.moveTo(x + q, y); c.lineTo(x + q + 8, y); c.lineTo(x + q + 8 - PX, y + PX); c.lineTo(x + q - PX, y + PX); c.fill(); } c.restore(); }
        c.fillStyle = 'rgba(255,214,60,0.95)';
        if (!on(i - 1, j)) c.fillRect(x, y, 4, PX); if (!on(i + 1, j)) c.fillRect(x + PX - 4, y, 4, PX);
        if (!on(i, j - 1)) c.fillRect(x, y, PX, 4); if (!on(i, j + 1)) c.fillRect(x, y + PX - 4, PX, 4);
      }
      // stort stencil-bogstav midt i zonen
      let sx = 0, sz = 0; for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (ok[j * nx + i]) { sx += i; sz += j; }
      const fs = Math.min(cv.width, cv.height) * 0.42; c.font = `900 ${fs}px "Archivo Black", Arial`; c.textAlign = 'center'; c.textBaseline = 'middle';
      if (!assist) { c.fillStyle = 'rgba(255,200,40,0.5)'; c.fillText(k, (sx / n + 0.5) * PX, (sz / n + 0.5) * PX); }
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const pos = [], uv = [], y = st.y + 0.012;
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        if (!ok[j * nx + i]) continue;
        const x0 = st.x0 + i * C, z0 = st.z0 + j * C, u0 = i / nx, u1 = (i + 1) / nx, v0 = 1 - j / nz, v1 = 1 - (j + 1) / nz;
        pos.push(x0, y, z0, x0, y, z0 + C, x0 + C, y, z0 + C, x0, y, z0, x0 + C, y, z0 + C, x0 + C, y, z0);
        uv.push(u0, v0, u0, v1, u1, v1, u0, v0, u1, v1, u1, v0);
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, color: new THREE.Color(0.8, 0.78, 0.72) }));   // v14: dæmpet (lyste før op i mørke rum)
      mesh.renderOrder = 2; grp.add(mesh);
    }
    scene.add(grp); siteMarks = grp; grp.updateMatrixWorld(true);
  }

  /* ---------------- førstepersonsvåben (egen scene, animationer) ---------------- */
  const VM_POS = { rifle: [0.19, -0.165, -0.47], awp: [0.19, -0.17, -0.47], pistol: [0.13, -0.15, -0.42], nade: [0.2, -0.2, -0.36], molotov: [0.2, -0.27, -0.46], famas: [0.18, -0.17, -0.47], knife: [0.12, -0.15, -0.31] };   // v13: hænder/arme synlige
  vm.POS = VM_POS;
  vm.ROT = { rifle: [0.05, 0.11, -0.05], awp: [0.04, 0.1, -0.04], famas: [0.05, 0.11, -0.05], pistol: [-0.1, 0.07, -0.03], nade: [0, 0.06, -0.03], knife: [0, 0.06, -0.03] };   // hvile-rotation pr. type                                           // (dev: kan justeres live)
  function vmFor(id) {
    const team = Game.side || 'swat';
    if (vm.team !== team) { for (const k in vm.models) vmScene.remove(vm.models[k]); vm.models = {}; vm.team = team; }
    const kSkin = id === 'knife' ? (vm.knifeOverride || Inv.skin('knife', team)) : null;          // knifeOverride: kun dev-kontaktark
    if (id === 'knife' && vm.models.knife && vm.knifeKey !== kSkin) { vmScene.remove(vm.models.knife); delete vm.models.knife; }   // ny kniv valgt i inventaret
    if (id === 'knife') vm.knifeKey = kSkin;
    if (!vm.models[id]) {
      const g = Weap.viewmodel(id, team, id === 'knife' ? kSkin : Inv.skin(id, team)); if (!g) return null;   // dit valgte skin (inventar)
      g.traverse(n => { if (n.material && n.material.isMeshStandardMaterial) { n.material.envMap = envTex; n.material.needsUpdate = true; } });
      g.visible = false; vmScene.add(g); vm.models[id] = g;
    }
    return vm.models[id];
  }
  function ejectShell(w) {
    const g = vm.models[w.id]; if (!g || !g.userData.meta.eject) return;
    const s = vm.shells[vm.shellI = (vm.shellI + 1) % vm.shells.length];
    s.mesh.position.copy(g.userData.meta.eject); g.userData.body.localToWorld(s.mesh.position);
    s.vx = 0.9 + Math.random() * 0.4; s.vy = 0.9 + Math.random() * 0.4; s.vz = 0.15; s.t = 0; s.mesh.visible = true; s.mesh.rotation.set(Math.random() * 3, 0, Math.PI / 2);
  }
  const _sd = new THREE.Vector3(), _lt = new THREE.Vector3(), _lq = new THREE.Quaternion(), _le = new THREE.Euler();
  // kritisk dæmpet fjeder (x mod mål t)
  const spring = (s, k, xk, vk, t, K, D, dt) => { const a = -K * (s[xk] - t) - D * s[vk]; s[vk] += a * dt; s[xk] += s[vk] * dt; };
  /* v14: GENLADNING pr. våbenklasse. weapons.js meta.reload = { style, rack, mag, hidden, rest, restQ, axis, len, charge, chargeZ, rack0, rackLen }.
     p = 0..1 over våbnets reload-tid. To tidslinjer:
       magasin i pistolgrebet ('grip': pistoler, MAC-10, MP9, MP7): våbnet vippes, magasinet glider ud og falder, venstre hånd henter et nyt
         fra bæltet og trykker det op i grebet, og slæden/ladegrebet spændes;
       magasin under/bag/oven på våbnet: venstre hånd griber magasinet, trækker det ud og slipper det, henter et nyt, sætter det i og
         spænder (ladegreb i højre side, bagerst foroven, foroven, HK-greb forrest) – AWP: boltgrebet (vm.boltT).
     Returnerer våbnets ekstra stilling (position/rotation); flytter magasin, ladegreb, slæde og venstre hånd (position + greb). */
  const RL0 = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 }, RLG = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };
  const _rh = new THREE.Vector3(), _rg = new THREE.Vector3(), _rp = new THREE.Vector3(), _rr = new THREE.Vector3(), _rd = new THREE.Vector3(), _rq = new THREE.Quaternion(), _rx = new THREE.Vector3(1, 0, 0);
  const sg = (p, a, b) => smooth((p - a) / (b - a)), bump = (p, a, b) => p > a && p < b ? Math.sin((p - a) / (b - a) * Math.PI) : 0;
  // hånden gennem en række punkter: keys = [[p0, punkt], [p1, punkt], ...] (blødt mellem nabopunkter)
  const path = (out, p, keys) => { if (p <= keys[0][0]) return out.copy(keys[0][1]); for (let i = 1; i < keys.length; i++) if (p <= keys[i][0]) return out.copy(keys[i - 1][1]).lerp(keys[i][1], sg(p, keys[i - 1][0], keys[i][0])); return out.copy(keys[keys.length - 1][1]); };
  function reloadAnim(g, meta, p, w) {
    const o = RLG; o.x = o.y = o.z = o.rx = o.ry = o.rz = 0;
    const R = meta.reload, L = g.userData.leftArm, LB = g.userData.leftBase, LP = g.userData.leftPose, LW = g.userData.leftWrist;
    if (!R) { const t = p >= 0 ? sg(p, 0, 0.18) * (1 - sg(p, 0.82, 1)) : 0; o.x = -0.02 * t; o.y = -0.03 * t; o.rx = 0.12 * t; o.rz = 0.55 * t; return o; }   // reserve: kun tip
    const mag = R.mag, pose = (a, b, k) => { if (LP && LW) { L.quaternion.slerpQuaternions(LP[a].a, LP[b].a, k); LW.quaternion.slerpQuaternions(LP[a].w, LP[b].w, k); } };
    if (p < 0) {                                             // hvile
      mag.position.copy(R.rest); mag.quaternion.copy(R.restQ); mag.visible = !R.hidden;
      if (R.charge) R.charge.position.z = R.chargeZ;
      if (L && LB) { L.position.copy(LB); pose('base', 'base', 0); }
      return o;
    }
    const T = w.reload, grip = R.style === 'grip', bolt = R.rack === 'bolt';
    const down = _rd.set(0, -1, 0).applyQuaternion(_rq.copy(g.quaternion).invert());   // tyngdekraften i våbnets rum (våbnet er vippet)
    const fall = (t0) => { const t = Math.max(0, p - t0) * T; return 4.9 * t * t; };
    const rack0 = R.rack0, rack1 = _rr.copy(rack0).add(_rx.set(0, R.rack === 'hk' ? -0.01 : 0, R.rackLen)), rackRel = rack0.clone().lerp(rack1, 0.25);
    if (grip) {
      // ---------------- magasin i grebet (pistoler, MAC-10, MP9, MP7)
      const tilt = sg(p, 0, 0.12) * (1 - sg(p, 0.82, 1)), tMag = sg(p, 0, 0.12) * (1 - sg(p, 0.56, 0.64));   // grebets bund mod venstre hånd, så lige til slæden
      o.rz = -0.4 * tMag + 0.08 * tilt; o.rx = 0.26 * tilt; o.x = -0.05 * tilt; o.y = 0.04 * tilt;
      const grab = _rg.copy(R.rest).addScaledVector(R.axis, R.len + 0.012), fetch = grab.clone().addScaledVector(R.axis, 0.085);
      const pouch = _rp.copy(LB).add(_rh.set(-0.09, -0.32, 0.1)).clone();
      path(L.position, p, [[0, LB], [0.12, pouch], [0.26, pouch], [0.44, fetch], [0.55, grab], [0.6, rack0], [0.66, rack1], [0.7, rackRel], [0.88, LB]]);
      if (p < 0.55) pose('base', 'mag', sg(p, 0.3, 0.44)); else if (p < 0.72) pose('mag', 'rack', sg(p, 0.55, 0.6)); else pose('base', 'rack', 1 - sg(p, 0.72, 0.88));
      const magMode = p < 0.08 ? 'rest' : p < 0.14 ? 'eject' : p < 0.26 ? 'fall' : p < 0.55 ? 'hand' : 'rest', magT0 = 0.14;   // det gamle falder ud af billedet før hånden kommer med det nye
      if (meta.slide) meta.slide.position.z = R.rackLen * (sg(p, 0.6, 0.66) * (1 - sg(p, 0.66, 0.69)));
      if (R.charge) R.charge.position.z = R.chargeZ + R.rackLen * (sg(p, 0.6, 0.66) * (1 - sg(p, 0.66, 0.69)));
      const b1 = bump(p, 0.52, 0.6), b2 = bump(p, 0.66, 0.74);
      o.y += 0.008 * b1; o.rx -= 0.04 * b1; o.z += 0.01 * b2; o.rx += 0.05 * b2;
      if (magMode === 'eject') { mag.position.copy(R.rest).addScaledVector(R.axis, sg(p, 0.08, 0.14) * 0.05); mag.quaternion.copy(R.restQ); mag.visible = true; }
      else if (magMode === 'fall') { mag.position.copy(R.rest).addScaledVector(R.axis, 0.05).addScaledVector(down, fall(magT0)); mag.quaternion.copy(R.restQ).multiply(_rq.setFromAxisAngle(_rx.set(1, 0, 0), (p - magT0) * T * 4)); mag.visible = true; }
      else if (magMode === 'hand') { mag.position.copy(R.rest).add(_rh.copy(L.position).sub(grab)); mag.quaternion.copy(R.restQ); mag.visible = true; }
      else { mag.position.copy(R.rest); mag.quaternion.copy(R.restQ); mag.visible = !R.hidden; }
    } else {
      // ---------------- magasin under/bag/oven på våbnet (rifler, SMG'er, AWP)
      // våbnet løftes ind mod midten og rulles, så magasinbrønden vender mod venstre hånd; ved ladegreb i højre side rulles det den anden vej
      const tilt = sg(p, 0, 0.14) * (1 - sg(p, 0.86, 1)), tMag = sg(p, 0, 0.14) * (1 - sg(p, 0.66, 0.76)), tRack = bolt ? 0 : sg(p, 0.68, 0.76) * (1 - sg(p, 0.84, 0.96));
      const TL = { front: [-0.38, 0.22], rear: [-0.25, 0.3], top: [0.3, 0.12], hidden: [-0.3, 0.18] }[R.style];
      o.rz = TL[0] * tMag + (R.rack === 'side' ? 0.32 : 0.1) * tRack; o.rx = TL[1] * tilt; o.x = -0.045 * tilt; o.y = 0.045 * tilt; o.z = (R.style === 'rear' ? 0.03 : 0.01) * tilt;
      const grab = _rg.copy(R.rest).addScaledVector(R.axis, R.style === 'top' ? 0.01 : R.len * 0.55), out = grab.clone().addScaledVector(R.axis, 0.07), fetch = grab.clone().addScaledVector(R.axis, 0.1);
      const pouch = _rp.copy(LB).add(_rh.set(-0.1, -0.26, 0.14)).clone();
      const keys = [[0, LB], [0.16, grab], [0.3, out], [0.46, pouch], [0.62, fetch], [0.7, grab]];
      if (bolt) keys.push([0.86, LB]); else keys.push([0.75, rack0], [0.8, rack1], [0.83, rackRel], [0.96, LB]);
      path(L.position, p, keys);
      if (p < 0.7) pose('base', 'mag', sg(p, 0.04, 0.16));
      else if (bolt) pose('base', 'mag', 1 - sg(p, 0.7, 0.86));
      else if (p < 0.83) pose('mag', 'rack', sg(p, 0.7, 0.75)); else pose('base', 'rack', 1 - sg(p, 0.83, 0.96));
      if (bolt && p >= 0.64 && Game.reloading && !Game.reloading.bolt) { Game.reloading.bolt = true; vm.boltT = 0; }
      if (R.charge) R.charge.position.z = R.chargeZ + R.rackLen * (sg(p, 0.75, 0.8) * (1 - sg(p, 0.8, 0.82)));
      const b1 = bump(p, 0.67, 0.74), b2 = bump(p, 0.8, 0.86);
      o.y += 0.012 * b1; o.rx -= 0.05 * b1; if (!bolt) { o.z += 0.014 * b2; o.rx += 0.05 * b2; }
      if (p < 0.16) { mag.position.copy(R.rest); mag.quaternion.copy(R.restQ); mag.visible = !R.hidden; }
      else if (p < 0.3) { mag.position.copy(R.rest).add(_rh.copy(L.position).sub(grab)); mag.quaternion.copy(R.restQ); mag.visible = true; }
      else if (p < 0.46) { mag.position.copy(R.rest).addScaledVector(R.axis, 0.07).addScaledVector(down, fall(0.3)); mag.quaternion.copy(R.restQ).multiply(_rq.setFromAxisAngle(_rx.set(1, 0, 0), (p - 0.3) * T * 3)); mag.visible = true; }
      else if (p < 0.5) mag.visible = false;
      else if (p < 0.7) { mag.position.copy(R.rest).add(_rh.copy(L.position).sub(grab)); mag.quaternion.copy(R.restQ); mag.visible = true; }
      else { mag.position.copy(R.rest); mag.quaternion.copy(R.restQ); mag.visible = !R.hidden; }
    }
    return o;
  }
  function updateViewmodel(dt) {
    const id = Game.self.cur, w = WEAPONS[id];
    const showC4 = Game.act === 'plant';
    for (const k in vm.models) vm.models[k].visible = false;
    if (vm.c4) vm.c4.visible = false;
    const vis = Game.self.alive && Game.phase !== 'buy' && !Game.scoped && Game.state === 'game';
    if (!vis) { Game.muzzleT = 0; vmLight.intensity = 0; return false; }
    // lys til førstepersonsscenen: bagt lys fra proben ved kameraet + solen i kamera-rum
    V.probe(camera.position.x, camera.position.y, camera.position.z, _bk);
    const skyK = _bk[3], L = V.theme.light;
    vmHemi.color.set(L.hemiSky); vmHemi.groundColor.set(L.hemiGround); vmHemi.intensity = L.hemiInt * Math.PI;
    _sd.set(-L.sunPos[0], -L.sunPos[1], -L.sunPos[2]).normalize().applyQuaternion(_q.copy(camera.quaternion).invert());
    vmSun.position.copy(_sd).multiplyScalar(-5); vmSun.target.position.set(0, 0, 0); vmSun.color.set(L.sunColor); vmSun.intensity = L.sunInt * Math.PI * smooth((skyK - 0.3) / 0.45) * 0.9;
    let g;
    if (showC4) { if (!vm.c4) { vm.c4 = Weap.c4View(); vmScene.add(vm.c4); } g = vm.c4; }
    else { if (!w) return false; g = vmFor(id); if (!g) return false; }
    g.visible = true;
    const mats = g.userData.mats || [];
    for (const m of mats) { if (m.userData.uBake) m.userData.uBake.value.set(_bk[0], _bk[1], _bk[2], Math.max(0.1, _bk[3])); if (m.isMeshStandardMaterial) m.envMapIntensity = 0.15 + 0.9 * skyK; }
    const t = performance.now() / 1000, kind = !w ? 'rifle' : w.kind === 'knife' ? 'knife' : w.kind === 'nade' ? 'nade' : w.slot === 2 ? 'pistol' : w.id === 'awp' ? 'awp' : w.id === 'famas' ? 'famas' : 'rifle', base0 = VM_POS[w && w.id === 'molotov' ? 'molotov' : kind];
    // v14: karambit (omvendt greb) løftes og drejes, så den buede klinge ses under hånden (ellers gemt under skærmkanten)
    const KOFF = (kind === 'knife' && g.userData.meta && vm.KOFF[g.userData.meta.model]) || null, KR = KOFF ? KOFF.slice(3) : [0, 0, 0], base = KOFF ? [base0[0] + KOFF[0], base0[1] + KOFF[1], base0[2] + KOFF[2]] : base0;
    // sway: inerti – våbnet halter efter musen (fjeder mod -musebevægelse) og svinger blødt tilbage
    const S = vm.sway;
    S.vx += -S.tx * 2.2; S.vy += S.ty * 2.2; S.tx = 0; S.ty = 0;
    spring(S, 0, 'x', 'vx', 0, 140, 16, dt); spring(S, 0, 'y', 'vy', 0, 140, 16, dt);
    S.x = clamp(S.x, -0.07, 0.07); S.y = clamp(S.y, -0.07, 0.07);
    // kick: fjedre tilbage til hvile (let overshoot = fysisk rekyl)
    const K = vm.kick; spring(K, 0, 'z', 'vz', 0, 260, 20, dt); spring(K, 0, 'r', 'vr', 0, 300, 22, dt); spring(K, 0, 's', 'vs', 0, 220, 20, dt);
    const spd = Math.hypot(Game.body.vx, Game.body.vz), mv = Game.body.ground ? clamp(spd / 6, 0, 1) : 0;
    const bobX = Math.sin(stepPh * 0.5) * 0.012 * mv, bobY = Math.abs(Math.cos(stepPh * 0.5)) * 0.01 * mv + Math.sin(t * 1.4) * 0.0025;
    vm.drawT = Math.min(1, vm.drawT + dt / 0.38); vm.boltT = Math.min(1, vm.boltT + dt / 1.1); vm.throwT = Math.min(1, vm.throwT + dt / 0.42); vm.pinT = Math.min(1, vm.pinT + dt / PIN_TIME);
    const draw = 1 - smooth(vm.drawT);
    // v14: genladning pr. våbenklasse (magasin ud → nyt ind → spænd) – se reloadAnim
    let rp = -1;
    if (Game.reloading && !showC4) rp = clamp((performance.now() - Game.reloading.start) / (Game.reloading.dur * 1000), 0, 1);
    if (vm.rlOverride != null && !showC4) rp = vm.rlOverride;   // dev: kontaktark midt i genladningen
    const meta = g.userData.meta || {};
    if (meta.slide) meta.slide.position.z = Game.muzzleT > 0 ? 0.03 : 0;
    const RA = !showC4 && w && w.kind === 'gun' ? reloadAnim(g, meta, rp, w) : RL0;
    if (meta.bolt) { const bt = vm.boltT, lift = bt < 0.25 ? smooth(bt / 0.25) : bt < 0.75 ? 1 : 1 - smooth((bt - 0.75) / 0.25), slide = bt < 0.25 ? 0 : bt < 0.5 ? smooth((bt - 0.25) / 0.25) : bt < 0.75 ? 1 - smooth((bt - 0.5) / 0.25) : 0; meta.bolt.rotation.z = lift * 1.1; meta.bolt.position.z = 0.05 + slide * 0.08; }
    // granat: split-træk (venstre hånd til ringen og væk), opladning (armen spændes – overhånd op/bagud, underhånd ned/bagud), kast frem
    let nx = 0, ny = 0, nz = 0, nr = 0;
    if (kind === 'nade') {
      const charging = !!Game.nade, pw = charging ? nadePower() : 0, under = charging ? Game.nade.under : vm.throwU;
      const ringPull = charging ? smooth(vm.pinT) : 0;
      if (meta.ring) { meta.ring.visible = !charging || vm.pinT < 0.95; meta.ring.position.x = -0.018 - ringPull * 0.12; meta.ring.position.y = (meta.ring.userData.y0 === undefined ? (meta.ring.userData.y0 = meta.ring.position.y) : meta.ring.userData.y0) - ringPull * 0.04; }
      if (g.userData.leftArm) {                              // venstre hånd: til ringen, river den ud, sænkes
        const k = charging ? (vm.pinT < 1 ? Math.sin(vm.pinT * Math.PI) : 0) : 0;
        _lt.set(-0.03 - ringPull * 0.1, 0.06, 0.0); g.userData.leftArm.position.lerpVectors(g.userData.leftBase, _lt, k);
        if (meta.wickFlame) { meta.wickFlame.visible = charging && vm.pinT > 0.5; if (meta.wickFlame.visible) { meta.wickFlame.scale.setScalar(0.8 + Math.random() * 0.5); meta.wickFlame.rotation.z = (Math.random() - 0.5) * 0.3; } }
      }
      const cock = charging ? smooth(Math.min(1, (performance.now() - Game.nade.t0) / 1000 / 0.3)) * (0.6 + 0.4 * pw) : 0;
      if (under) { nx = -0.06 * cock; ny = -0.07 * cock; nz = 0.02 * cock; nr = -0.42 * cock; } else { nx = -0.05 * cock; ny = 0.1 * cock; nz = 0.05 * cock; nr = 0.35 * cock; }   // spændt: op/bagud (overhånd) eller ned (underhånd) – altid i billedet
      if (vm.throwT < 1) { const k = Math.sin(vm.throwT * Math.PI); nz -= k * 0.25; ny += (vm.throwU ? 0.06 : 0.04) * k; nr -= (vm.throwU ? -0.5 : 1.0) * k; }
      const gone = vm.throwT > 0.35 && vm.throwT < 1;          // granaten har forladt hånden midt i kastet
      for (const p of g.userData.parts || []) p.visible = !gone;
    } else if (meta.wickFlame) meta.wickFlame.visible = false;
    // v12: kniv – hug (sving fra højre mod venstre, skiftevis retning), stik (træk tilbage → stød frem), inspect (F) og butterfly-flip
    let kx = 0, ky = 0, kz = 0, krx = 0, kry = 0, krz = 0;
    if (kind === 'knife') {
      vm.meleeT = Math.min(1, vm.meleeT + dt / (vm.meleeStab ? 0.6 : 0.36)); vm.inspT = Math.min(1, vm.inspT + dt / 2.6);
      const KP = vm.kpose;                                    // hvile: klingen peger frem/op mod midten med den flade side mod kameraet (som i CS)
      krx = KP[0]; kry = KP[1]; krz = KP[2]; kx = KP[3]; ky = KP[4]; kz = KP[5];
      if (vm.meleeT < 1) {
        const m = vm.meleeT, sd = vm.meleeSide;
        if (vm.meleeStab) { const back = smooth(m / 0.28) * (1 - smooth((m - 0.28) / 0.12)), fw = smooth((m - 0.3) / 0.15) * (1 - smooth((m - 0.62) / 0.38)); kz += back * 0.07 - fw * 0.2; ky += back * 0.03 - fw * 0.02; krx += back * 0.4 - fw * 0.15; kry -= fw * 0.3; }
        else { const wind = smooth(m / 0.22) * (1 - smooth((m - 0.22) / 0.1)), sw = smooth((m - 0.2) / 0.28), rec = smooth((m - 0.55) / 0.45), a = sw * (1 - rec);
          kx += sd * (wind * 0.06 - a * 0.2); ky += wind * 0.05 - a * 0.06; kz -= a * 0.08; kry += sd * (wind * 0.5 - a * 1.0); krz += sd * (-wind * 0.6 + a * 1.1); krx -= a * 0.3; }
      }
      if (vm.inspT < 1) {                                    // inspect: løft kniven frem i billedet, vend den langsomt så begge sider ses
        const q = vm.inspT, up = smooth(q / 0.15) * (1 - smooth((q - 0.85) / 0.15));
        kx -= up * 0.1; ky += up * 0.07; kz += up * 0.05; kry += up * (0.9 + Math.sin(q * Math.PI * 2) * 0.5); krz += up * Math.sin(q * Math.PI * 2) * 1.6 * smooth((q - 0.2) / 0.2) * (1 - smooth((q - 0.7) / 0.2)); krx += up * 0.35;
      }
      if (meta.handles) {                                    // butterfly: håndtagene folder ud ved træk og under inspect
        const fl = vm.drawT < 1 ? 1 - smooth(vm.drawT) : vm.inspT < 1 ? Math.max(0, Math.sin(vm.inspT * Math.PI * 3)) * smooth(vm.inspT / 0.1) * (1 - smooth((vm.inspT - 0.9) / 0.1)) : 0;
        meta.handles[0].rotation.x = -fl * Math.PI * 1.02; meta.handles[1].rotation.x = fl * Math.PI * 0.98;
      }
    }
    const ax = Math.min(1, vmCam.aspect / 1.6);                // smalle skærme (4:3): træk våbnet ind mod midten
    g.position.set(base[0] * ax + bobX - S.x * 0.6 + RA.x + nx + kx, base[1] - bobY + S.y * 0.6 - draw * 0.28 + RA.y - K.r * 0.004 + ny + ky, base[2] + K.z * 0.03 + RA.z + nz + kz);
    const BR = vm.ROT[kind] || vm.ROT.rifle;
    g.rotation.set(BR[0] + K.r * 0.022 - draw * 0.7 + RA.rx + nr + (meta.bolt || (w && w.id === 'awp') ? Math.sin(vm.boltT * Math.PI) * 0.12 : 0) - S.y * 1.2 + krx + KR[0], BR[1] - S.x * 1.4 + K.s * 0.01 + RA.ry + kry + KR[1], RA.rz + BR[2] + S.x * 0.8 + krz + KR[2]);
    if (showC4) { g.position.set(0, -0.2 + Math.sin(t * 9) * 0.003, -0.3); g.rotation.set(0.25, 0, 0); }
    // mundingsild (0,05 s): additiv HDR-stjerne + PointLight der oplyser hænder og våben
    if (meta.muzzle !== undefined && g.userData.flash) { const f = g.userData.flash; f.visible = Game.muzzleT > 0; if (f.visible) { f.rotation.z = Math.random() * 6; f.scale.setScalar(0.8 + Math.random() * 0.5); } }
    if (Game.muzzleT > 0 && meta.muzzle && w && w.id !== 'usp' && w.id !== 'mp5') { vmLight.position.copy(meta.muzzle); g.userData.body.localToWorld(vmLight.position); vmLight.intensity = 9; }
    else vmLight.intensity = 0;
    if (Game.muzzleT > 0) Game.muzzleT -= dt;
    // patronhylstre
    for (const s of vm.shells) { if (s.t >= 1) continue; s.t += dt / 0.6; s.vy -= 6 * dt; s.mesh.position.x += s.vx * dt; s.mesh.position.y += s.vy * dt; s.mesh.position.z += s.vz * dt; s.mesh.rotation.x += dt * 20; if (s.t >= 1) s.mesh.visible = false; }
    return true;
  }

  function animateFx(dt) {
    for (let i = tracers.length - 1; i >= 0; i--) { const t = tracers[i]; t.t += dt; const done = posTracer(t); if (done || t.t > 0.6) { scene.remove(t.mesh); tracerPool.push(t); tracers.splice(i, 1); } }
    if (impMesh) { let dirty = false; for (let i = 0; i < IMP_MAX; i++) if (impT[i] >= 0 && (impT[i] += dt) > 25) { impT[i] = -1; _m4.makeScale(0, 0, 0); impMesh.setMatrixAt(i, _m4); dirty = true; } if (dirty) impMesh.instanceMatrix.needsUpdate = true; }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i]; f.t += dt;
      f.mesh.material.opacity = Math.max(0, 1 - f.t / 0.7); f.mesh.scale.setScalar(f.size * (0.6 + f.t * 2.2)); f.mesh.position.y += dt * 1.2;
      if (f.t > 0.7) { scene.remove(f.mesh); f.mesh.material.dispose(); flashes.splice(i, 1); }
    }
    if (flashLightT > 0) { flashLightT -= dt; if (flashLightT <= 0) flashLight.intensity = 0; else flashLight.intensity *= Math.pow(0.02, dt / 0.3); }
    if (shakeT > 0) { shakeT -= dt; shakeMag *= 0.9; } else shakeMag = 0;
  }

  /* v12.1: GRAFIK-KVALITET. Målt på en Mac (Apple-GPU + Retina): pixel-ratio 1,5 ≈ 6 ms, nær-skyggekortet 4096² hver frame ≈ 4 ms,
     bloom ≈ 2 ms, SSAO ≈ 1,3 ms, sol-stråler ≈ 1,2 ms. 'Auto' vælger Medium på Mac/Apple-GPU'er og Høj ellers.
     every = skyggekortet (og dets placering) opdateres hver n'te frame – den statiske bane ændrer sig ikke, kun spillerne. */
  const GFX = {
    ultra: { pr: 1.5, min: 0.85, sh: 4096, every: 1, ao: true, bloom: true, shafts: true },
    high: { pr: 1.25, min: 0.8, sh: 4096, every: 1, ao: true, bloom: true, shafts: true },
    medium: { pr: 1.2, min: 0.8, sh: 2048, every: 2, ao: true, bloom: true, shafts: false },   // v14: lidt over 1,0 på Retina (skarpere billede); den adaptive opløsning sænker selv ved lav FPS
    low: { pr: 0.85, min: 0.6, sh: 2048, every: 3, ao: false, bloom: true, shafts: false },
    min: { pr: 0.7, min: 0.5, sh: 1024, every: 4, ao: false, bloom: false, shafts: false }
  };
  function detectTier() {
    try {
      const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
      const r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
      if (/Apple|M1|M2|M3|M4|Intel.*(Iris|UHD|HD)/i.test(r) || /Mac/i.test(navigator.platform || '')) return 'medium';
      if (/SwiftShader|llvmpipe|Software/i.test(r)) return 'min';
    } catch (e) {}
    return 'high';
  }
  let gfx = GFX.high, gfxName = 'high', shadowTick = 0;
  let PR_TOP = 1, PR_MIN = 0.7, prCur = 1, prMaxOk = 1, prAcc = 0, prN = 0, prGood = 0, prBad = 0, prLastUp = 0;
  function setQuality(name) {
    if (!renderer) return;
    gfxName = name === 'auto' || !GFX[name] ? detectTier() : name; gfx = GFX[gfxName];
    const dpr = window.devicePixelRatio || 1;
    PR_TOP = Math.min(dpr, gfx.pr); PR_MIN = Math.min(PR_TOP, gfx.min); prCur = PR_TOP; prMaxOk = PR_TOP; prGood = prBad = 0;
    renderer.setPixelRatio(prCur);
    if (sun.shadow.mapSize.x !== gfx.sh) { sun.shadow.mapSize.set(gfx.sh, gfx.sh); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    sun.shadow.autoUpdate = false; sun.shadow.needsUpdate = true; shadowTick = 0;
    if (post) { post.cfg.ao = gfx.ao; post.cfg.bloom = gfx.bloom; post.cfg.shafts = gfx.shafts; }
    if (DEV) console.log('[dev] grafik:', gfxName, gfx);
  }
  const perf = { frames: 0, acc: 0, worst: 0, fps: 0 };
  // adaptiv opløsning: sænker pixel-ratio når FPS ligger under ~57 i ét sekund, og hæver den igen når billedet i 6 s har holdt
  // skærmens frekvens. Er vi allerede på laveste opløsning og stadig for langsomme, slås SSAO og derefter sol-stråler/bloom fra.
  function adaptRes(raw) {
    if (raw > 0.25) return;                                  // fane i baggrunden / hak
    perf.frames++; perf.acc += raw; if (raw > perf.worst) perf.worst = raw;
    prAcc += raw; prN++;
    if (prAcc < 1.0) return;
    const ms = prAcc / prN * 1000; perf.fps = 1000 / ms; prAcc = 0; prN = 0;
    const nowT = performance.now();
    prBad = ms > 17.6 ? prBad + 1 : 0;
    if (prBad >= 1 && prCur > PR_MIN + 0.01) {
      if (nowT - prLastUp < 12000) prMaxOk = Math.max(PR_MIN, prCur * 0.85);   // opskalering gav straks lag igen => prøv ikke den opløsning igen
      prCur = Math.max(PR_MIN, prCur * (ms > 25 ? 0.75 : 0.87)); renderer.setPixelRatio(prCur); prGood = 0; prBad = 0;
    } else if (prBad >= 2 && post && post.cfg.ao) { post.cfg.ao = false; prBad = 0; if (DEV) console.log('[dev] SSAO slået fra (lav FPS)'); }
    else if (prBad >= 2 && post && post.cfg.shafts) { post.cfg.shafts = false; prBad = 0; }
    else if (prBad >= 3 && gfx.every < 3) { gfx = Object.assign({}, gfx, { every: gfx.every + 1 }); prBad = 0; }
    else if (ms < 16.2) {
      if (++prGood >= 6 && prCur < prMaxOk - 0.01) { prCur = Math.min(prMaxOk, prCur * 1.1); renderer.setPixelRatio(prCur); prGood = 0; prLastUp = nowT; }
    } else prGood = 0;
  }
  const _fw = new THREE.Vector3(), _up = new THREE.Vector3(), _ls = new THREE.Vector3(), _lu = new THREE.Vector3(), _lr = new THREE.Vector3();
  let devCam = null, cineCam = null;
  function setCine(on) {
    if (!on) { cineCam = null; camera.rotation.order = 'YXZ'; camera.rotation.z = 0; return; }
    const b = W.bounds, sp = (W.spawns && (W.spawns.swat || [])[0]) || { y: 0 }, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, r = Math.hypot(b.x1 - b.x0, b.z1 - b.z0) * 0.34;
    cineCam = { t0: performance.now() / 1000, a0: Math.random() * Math.PI * 2, cx, cz, r, y: sp.y + Math.max(18, r * 0.55), ly: sp.y };
  }
  function loop() {
    requestAnimationFrame(loop);
    const raw = clock.getDelta(); adaptRes(raw);
    frame(Math.min(0.05, raw));
  }
  // nær-skyggekaskaden følger kameraet; centrum snappes til skyggekortets texel-gitter i lysets rum (ingen 'svømmende' skyggekanter)
  function followShadow() {
    const cam = camera.position, texel = (NEAR_R * 2) / sun.shadow.mapSize.x;
    _lr.set(0, 1, 0).cross(sunDir).normalize(); _lu.copy(sunDir).cross(_lr).normalize();
    const cx = cam.x + _fw.x * NEAR_R * 0.45, cy = cam.y, cz = cam.z + _fw.z * NEAR_R * 0.45;   // lidt foran kameraet: mere opløsning hvor man kigger
    _ls.set(cx, cy, cz);
    const a = Math.round(_ls.dot(_lr) / texel) * texel, b2 = Math.round(_ls.dot(_lu) / texel) * texel, c = _ls.dot(sunDir);
    _ls.copy(_lr).multiplyScalar(a).addScaledVector(_lu, b2).addScaledVector(sunDir, c);
    sun.target.position.copy(_ls); sun.position.copy(_ls).addScaledVector(sunDir, 120);
    sun.target.updateMatrixWorld();
  }
  // én komplet frame: spillogik, interpolation, animation af alle spillere, HUD og rendering
  function frame(dt) {
    renderer.setRenderTarget(null); renderer.clear();
    if (loading || !V) return;
    let vmOn = false;
    if (Game.state === 'game' || devCam) {
      const tf = Game.scoped ? 26 : 90;                         // AWP-zoom
      if (Math.abs(camera.fov - tf) > 0.05) { camera.fov += (tf - camera.fov) * (1 - Math.exp(-20 * dt)); camera.updateProjectionMatrix(); }
      Game.fov = camera.fov;
      const scopeOn = Game.scoped && camera.fov < 60;
      $('scopeOv').classList.toggle('hidden', !scopeOn); const xhOff = scopeOn || !Game.self.alive || Game.phase === 'buy'; $('crosshair').classList.toggle('hidden', xhOff); $('crosshairHit').classList.toggle('hidden', xhOff);
      syncDrops(dt);
      updateLocal(dt);
      sampleRemotes(dt);
      vmOn = updateViewmodel(dt);
      animateFx(dt);
      drawMinimapDyn();
      if (siteMarks && siteMarks.userData.assist) siteMarks.visible = !!(Game.self.alive && Game.side === 'hij' && Game.self.inv && Game.self.inv.bomb);
      HUD._dt = dt; HUD.tick();
      updateFlash();
      if (doors) { const act = [{ x: Game.body.x, y: Game.body.y, z: Game.body.z }]; for (const [, r] of Game.remotes) if (r.alive) act.push({ x: r.rx, y: r.ry, z: r.rz }); doors.update(dt, act, d => Audio.door(d.kind, { x: d.x, y: d.y + 1.2, z: d.z })); }
      if (shakeMag > 0.001) {
        camera.position.x += (Math.random() - 0.5) * shakeMag * 0.3;
        camera.position.y += (Math.random() - 0.5) * shakeMag * 0.3;
      }
      if (cineCam) {                                                   // v20: sejrs-sekvensens kamera – langsomt kredsløb højt over banen
        const c = cineCam, tt = performance.now() / 1000 - c.t0, a = c.a0 + tt * 0.055, rr = c.r * (1.08 - Math.min(1, tt / 30) * 0.12);
        camera.position.set(c.cx + Math.cos(a) * rr, c.y + 2 * Math.sin(tt * 0.3), c.cz + Math.sin(a) * rr); camera.lookAt(c.cx, c.ly, c.cz); vmOn = false;
      }
      if (devCam) { camera.position.set(devCam[0], devCam[1], devCam[2]); camera.rotation.set(devCam[4] || 0, devCam[3] || 0, 0); vmOn = false; }
      sky.position.copy(camera.position);
      V.update(dt, performance.now() / 1000, camera.position, decorGroup); fxObj.update(dt, performance.now() / 1000, camera.position);
      camera.updateMatrixWorld(); _fw.set(0, 0, -1).applyQuaternion(camera.quaternion); _up.set(0, 1, 0).applyQuaternion(camera.quaternion); Audio.setListener(camera.position, _fw, _up);
      fxs.update(dt, camera.position);
      if (++shadowTick >= gfx.every) { shadowTick = 0; followShadow(); sun.shadow.needsUpdate = true; }   // skyggekort + placering opdateres sammen
    }
    // HDR-pipeline (SSAO + bloom + FXAA + ACES) – eller direkte til skærmen hvis post-processing ikke understøttes
    if (!(post && post.render(scene, camera, vmScene, vmCam, vmOn))) {
      renderer.render(scene, camera);
      if (vmOn) { renderer.clearDepth(); renderer.render(vmScene, vmCam); }
    }
    placeNameTags();
    if (Game.flash && Game.flash.cap) { Game.flash.cap = false; captureAfterimage(); }   // flashbang: frys det sidste billede (efterbillede)
  }
  function captureAfterimage() {
    const src = renderer.domElement, dst = $('flashImg');
    try { dst.width = Math.max(2, src.width >> 2); dst.height = Math.max(2, src.height >> 2); const c = dst.getContext('2d'); c.filter = 'blur(2px) brightness(1.6)'; c.drawImage(src, 0, 0, dst.width, dst.height); } catch (e) { /* uden efterbillede */ }
  }
  const skinName = (id, team) => { const w = WD.WEAPONS[id]; return w && w.kind === 'gun' ? Inv.skinName(id, team) : null; };
  /* v13: våbenikoner til købsmenuen – hvert våben (med dit skin) renderes én gang i en lille separat renderer → dataURL (cache) */
  const iconCache = new Map(); let iconR = null, iconScene = null, iconCam = null, iconQ = [], iconBusy = false;
  function gunIcon(id, team) {
    const key = id + '|' + team + '|' + (Inv.skin(id, team) || '') + '|' + (COS.ready ? 1 : 0);
    if (iconCache.has(key)) return iconCache.get(key);
    iconCache.set(key, null); iconQ.push([key, id, team]); if (!iconBusy) { iconBusy = true; setTimeout(drainIcons, 0); }
    return null;
  }
  function drainIcons() {
    try {
      ensureChars(); if (!Weap) { iconBusy = false; return; }
      if (!iconR) {
        iconR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); iconR.setSize(360, 150, false); iconR.toneMapping = THREE.ACESFilmicToneMapping; iconR.toneMappingExposure = 1.8;
        iconScene = new THREE.Scene(); iconCam = new THREE.OrthographicCamera(-1.2, 1.2, 0.5, -0.5, 0.1, 20); iconCam.position.set(0, 0.25, 6); iconCam.lookAt(0, 0, 0);
        iconScene.add(new THREE.HemisphereLight(0xe8eef8, 0x2a2622, 2.4)); const k = new THREE.DirectionalLight(0xfff2e0, 3.4); k.position.set(2, 4, 5); iconScene.add(k); const r = new THREE.DirectionalLight(0x9fc4ff, 2.0); r.position.set(-3, 1, -4); iconScene.add(r);
      }
      const t0 = performance.now();
      while (iconQ.length && performance.now() - t0 < 30) {
        const [key, id, team] = iconQ.shift();
        const g = Weap.worldModel(id, null, team, Inv.skin(id, team)); if (!g) { iconCache.set(key, ''); continue; }
        const h = new THREE.Group(); h.add(g); g.rotation.y = WEAPONS[id] && WEAPONS[id].kind === 'gun' ? -Math.PI / 2 : 0.4;   // set fra siden, mundingen mod højre
        const b = new THREE.Box3().setFromObject(h), c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
        g.position.sub(c); const sc = Math.min(2.2 / Math.max(1e-3, sz.x), 0.86 / Math.max(1e-3, sz.y)); h.scale.setScalar(sc); h.rotation.x = 0.06;
        iconScene.add(h); iconR.render(iconScene, iconCam); iconCache.set(key, iconR.domElement.toDataURL('image/png')); iconScene.remove(h);
        h.traverse(n => { if (n.isMesh && n.geometry && !n.geometry.userData.shared) { /* geometri deles med modellerne – frigives ikke */ } });
      }
    } catch (e) { console.warn('[ikon]', e); iconQ = []; }
    if (iconQ.length) setTimeout(drainIcons, 16); else { iconBusy = false; if (BuyMenu.open) { BuyMenu._sig = ''; BuyMenu.render(); } }
  }
  const api = { setQuality, gunIcon, get gfx() { return gfxName; }, get pr() { return prCur; }, get perf() { return perf; }, chars: () => (ensureChars(), Chars), weap: () => (ensureChars(), Weap), onCosmetics, mapReady: () => !loading && mapId === W.id, cosReady: () => COS.ready, setCine, init, loadMap, flinchAim, onRoundStart, onShotFx, inspect, onRemoteMelee, onMeleeWall, onPlant, onExplode, onBoom, onSmokePop, onFlashPop, onFirePop, onFireOut, onRemoteThrow, onThrowLocal, onPinPull, onWeaponChange, mouseDelta, shake, skinName, get mapId() { return mapId; } };
  if (DEV) {   // v14: kontaktark over førstepersonsvåben (kun dev) – hvert våben renderes alene på neutral baggrund
    const sideCam = new THREE.PerspectiveCamera(30, 1.6, 0.01, 10);
    api.vmSheet = (ids, cols, tw, th, side) => {
      cols = cols || 4; tw = tw || 360; th = th || 220;
      const out = document.createElement('canvas'), rows = Math.ceil(ids.length / cols); out.width = cols * tw; out.height = rows * th; const c2 = out.getContext('2d');
      const keep = { cur: Game.self.cur, phase: Game.phase, alive: Game.self.alive, state: Game.state }, prevPR = renderer.getPixelRatio(); Game.state = 'game';
      renderer.setPixelRatio(1); renderer.setSize(tw * 2, th * 2, false); vmCam.aspect = tw / th; vmCam.updateProjectionMatrix();
      ids.forEach((id0, i) => {
        const [idk, rS] = id0.split('@'), [id, kk] = idk.split(':'); vm.knifeOverride = kk || null;   // 'knife:karambit_fade' = bestemt kniv · 'ak47@0.35' = midt i genladningen (p)
        vm.rlOverride = rS !== undefined ? +rS : null;
        Game.self.cur = id; Game.phase = 'live'; Game.self.alive = true; vm.drawT = 1;
        for (let k = 0; k < 3; k++) { updateViewmodel(0.016); vm.drawT = 1; vm.inspT = 1; vm.meleeT = 1; }
        let cam = vmCam;
        if (side) {                                                             // set fra højre side af våbnet (greb/hænder tydelige)
          const g = vm.models[Object.keys(vm.models).find(k => vm.models[k].visible)]; if (g) { g.updateMatrixWorld(true); const b = new THREE.Box3(); for (const p of (g.userData.parts || [g])) b.expandByObject(p); const c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3()).length();
            sideCam.aspect = tw / th; sideCam.position.set(c.x + sz * 2.1, c.y + sz * 0.2, c.z); sideCam.lookAt(c); sideCam.updateProjectionMatrix(); cam = sideCam; }
        }
        renderer.setRenderTarget(null); renderer.setClearColor(0x6b7480, 1); renderer.clear(); renderer.render(vmScene, cam);
        c2.drawImage(renderer.domElement, (i % cols) * tw, Math.floor(i / cols) * th, tw, th);
        c2.fillStyle = '#fff'; c2.font = '700 14px monospace'; c2.fillText(id0, (i % cols) * tw + 6, Math.floor(i / cols) * th + 16);
      });
      vm.knifeOverride = null; vm.rlOverride = null;
      Object.assign(Game.self, { cur: keep.cur, alive: keep.alive }); Game.phase = keep.phase; Game.state = keep.state;
      renderer.setPixelRatio(prevPR); renderer.setSize(innerWidth, innerHeight); vmCam.aspect = innerWidth / innerHeight; vmCam.updateProjectionMatrix(); renderer.setClearColor(0x000000, 0);
      api.lastSheet = out;
      return out.toDataURL('image/jpeg', 0.85);
    };
  }
  if (DEV) {   // v14 foto-tur: faste kameraer → kontaktark (4×3 billeder pr. ark, navn + koordinater på hvert billede)
    api.tourShots = () => tourShots();
    api.tourSheet = (shots, cols, tw, th) => {
      cols = cols || 4; tw = tw || 640; th = th || 360;
      const out = document.createElement('canvas'), rows = Math.ceil(shots.length / cols); out.width = cols * tw; out.height = rows * th; const c2 = out.getContext('2d');
      const prevPR = renderer.getPixelRatio(), RW = tw * 1.5, RH = th * 1.5;
      renderer.setPixelRatio(1); renderer.setSize(RW, RH, false); if (post && post.setSize) post.setSize(RW, RH);
      camera.aspect = RW / RH; camera.updateProjectionMatrix(); camera.fov = 90;
      shots.forEach((s, i) => {
        devCam = [s.x, s.y, s.z, s.yaw, s.pitch || 0];
        for (let k = 0; k < 3; k++) { shadowTick = 99; frame(k ? 0.016 : 0.3); }     // første frame > 0,25 s => afstands-LOD/detaljer følger det nye kamera
        const X = (i % cols) * tw, Y = Math.floor(i / cols) * th;
        c2.drawImage(renderer.domElement, 0, 0, RW, RH, X, Y, tw, th);
        c2.fillStyle = 'rgba(0,0,0,.55)'; c2.fillRect(X, Y, tw, 24); c2.fillStyle = '#fff'; c2.font = '700 15px system-ui,sans-serif';
        c2.fillText(`${i + 1}. ${s.n}`, X + 8, Y + 17); c2.font = '12px monospace'; c2.textAlign = 'right'; c2.fillText(`${s.x.toFixed(1)}, ${s.y.toFixed(1)}, ${s.z.toFixed(1)} · ${(s.yaw * 180 / Math.PI).toFixed(0)}°`, X + tw - 8, Y + 16); c2.textAlign = 'left';
        c2.strokeStyle = '#000'; c2.lineWidth = 2; c2.strokeRect(X, Y, tw, th);
      });
      devCam = null;
      renderer.setPixelRatio(prevPR); renderer.setSize(innerWidth, innerHeight); if (post && post.setSize) { const v = renderer.getDrawingBufferSize(new THREE.Vector2()); post.setSize(v.x, v.y); }
      camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
      return out;
    };
  }
  if (DEV) {   // v14: tredjeperson-kontaktark – en figur pr. våben, set fra højre side (greb og støttehånd tydelige)
    api.tpSheet = (ids, side, cols, tw, th) => {
      ensureChars(); side = side || 'swat'; cols = cols || 4; tw = tw || 320; th = th || 320;
      const out = document.createElement('canvas'), rows = Math.ceil(ids.length / cols); out.width = cols * tw; out.height = rows * th; const c2 = out.getContext('2d');
      const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, tw / th, 0.05, 30);
      sc.add(new THREE.HemisphereLight(0xe8eef8, 0x40362c, 2.2)); const k = new THREE.DirectionalLight(0xfff2e0, 2.6); k.position.set(3, 5, 2); sc.add(k);
      const prevPR = renderer.getPixelRatio(); renderer.setPixelRatio(1); renderer.setSize(tw * 2, th * 2, false);
      const codes = WD.WEAPONS;
      ids.forEach((id0, i) => {
        const [id, rS] = id0.split('@');                                         // 'ak47@0.5' = midt i genladningen
        const h = Chars.buildHuman(side, null); sc.add(h.group);
        const st = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, alive: true, crouch: false, grounded: true, wcode: codes[id] ? codes[id].code : undefined };
        for (let f = 0; f < 90; f++) Chars.animateHuman(h, 1 / 60, f / 60, st);
        if (rS !== undefined) { st.reload = true; for (let f = 0; f < 600 && !(h.rlT >= +rS); f++) Chars.animateHuman(h, 1 / 60, (90 + f) / 60, st); }
        h.group.updateMatrixWorld(true);
        const CV = api.tpView || [2.4, 1.5, -0.35, 0, 1.35, -0.35]; cam.position.set(CV[0], CV[1], CV[2]); cam.lookAt(CV[3], CV[4], CV[5]); cam.aspect = tw / th; cam.updateProjectionMatrix();
        renderer.setRenderTarget(null); renderer.setClearColor(0x6b7480, 1); renderer.clear(); renderer.render(sc, cam);
        c2.drawImage(renderer.domElement, (i % cols) * tw, Math.floor(i / cols) * th, tw, th);
        c2.fillStyle = '#fff'; c2.font = '700 14px monospace'; c2.fillText(id0, (i % cols) * tw + 6, Math.floor(i / cols) * th + 16);
        sc.remove(h.group);
      });
      renderer.setPixelRatio(prevPR); renderer.setSize(innerWidth, innerHeight); renderer.setClearColor(0x000000, 0);
      return out;
    };
  }
  // v14 foto-tur: kameraer genereres fra banens data – callouts (åbneste retning), sites (4 hjørner mod midten), spawns (2), oversigt (2)
  function tourShots() {
    const shots = [], b = W.bounds, mcx = (b.x0 + b.x1) / 2, mcz = (b.z0 + b.z1) / 2, PLH = WD.PL.H;
    const eye = (x, z, y) => { const g = WD.groundAt(W, x, z, y, 0.6); return g === -Infinity ? null : g; };
    const free = (x, y, z, a) => WD.raycastWorld(W, x, y, z, Math.sin(a) * -1, 0, Math.cos(a) * -1, 60);   // yaw a: fremad = (-sin a, 0, -cos a)
    const openYaw = (x, y, z) => { let best = 0, bd = -1; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; const d = free(x, y, z, a) * 0.6 + free(x, y, z, a + 0.26) * 0.2 + free(x, y, z, a - 0.26) * 0.2; if (d > bd) { bd = d; best = a; } } return best; };
    const yawTo = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));
    const seenTxt = new Map();
    for (const l of W.labels) {
      if (l.kind === 'site') continue;
      const ly = l.y === undefined ? 0 : l.y, g = eye(l.x, l.z, ly + 1.2); if (g === null || WD.isBlocked(W, l.x, l.z, g, PLH, 0.02)) continue;
      const n = seenTxt.get(l.text) || 0; seenTxt.set(l.text, n + 1);
      const y = g + 1.65; shots.push({ n: l.text + (n ? ' #' + (n + 1) : ''), x: l.x, y, z: l.z, yaw: openYaw(l.x, y, l.z), pitch: -0.06 });
    }
    for (const k in W.sites) {
      const s = W.sites[k], cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
      [[s.x0, s.z0], [s.x1, s.z0], [s.x1, s.z1], [s.x0, s.z1]].forEach(([px, pz], i) => {
        let x = px, z = pz, g = null;
        for (let t = 0.08; t < 0.9; t += 0.08) { x = px + (cx - px) * t; z = pz + (cz - pz) * t; g = eye(x, z, s.y + 1.5); if (g !== null && !WD.isBlocked(W, x, z, g, PLH, 0.02)) break; g = null; }
        if (g !== null) shots.push({ n: k + ' SITE ' + 'NØ SØ SV NV'.split(' ')[i], x, y: g + 1.75, z, yaw: yawTo(x, z, cx, cz), pitch: -0.12 });
      });
    }
    for (const side of ['hij', 'swat']) { const p = W.spawns[side][0]; if (!p) continue; const g = eye(p.x, p.z, (p.y || 0) + 1) || 0, y = g + 1.65, a = yawTo(p.x, p.z, mcx, mcz);
      shots.push({ n: (side === 'hij' ? 'T' : 'CT') + ' SPAWN → midt', x: p.x, y, z: p.z, yaw: a, pitch: -0.05 }, { n: (side === 'hij' ? 'T' : 'CT') + ' SPAWN ← bag', x: p.x, y, z: p.z, yaw: a + Math.PI, pitch: -0.05 }); }
    const R = Math.max(b.x1 - b.x0, b.z1 - b.z0) * 0.55;
    shots.push({ n: 'OVERSIGT fra syd', x: mcx, y: R * 0.75, z: b.z1 + R * 0.25, yaw: 0, pitch: -0.72 }, { n: 'OVERSIGT fra nord', x: mcx, y: R * 0.75, z: b.z0 - R * 0.25, yaw: Math.PI, pitch: -0.72 });
    return shots;
  }
  if (DEV) { api.setCam = (x, y, z, yaw, pitch) => { devCam = x === null ? null : [x, y, z, yaw, pitch]; }; api.frame = frame; Object.defineProperties(api, { V: { get: () => V }, renderer: { get: () => renderer }, scene: { get: () => scene }, post: { get: () => post }, fx: { get: () => fxs }, vm: { get: () => vm } }); }
  return api;
})();

/* ==========================================================================
   NETVÆRKS-INPUT-LOOP (fast takt, uafhængig af rendering)
   ========================================================================== */
setInterval(() => {
  if (Game.state !== 'game' || !Net.connected) return;
  const b = Game.body;
  Net.send({ t: 'in', x: b.x, y: b.y, z: b.z, yaw: Game.yaw, pitch: Game.pitch, c: b.crouch ? 1 : 0, g: b.ground ? 1 : 0, u: !!KEY.KeyE, n: Game.nade ? 1 : 0, cs: Game.corrId });
}, 1000 / 30);

/* v14 (dev): foto-tur – ?dev=1&tour=<bane>[&shots=1,5,7] bygger banen uden server-spil, kører kameraerne og gemmer kontaktark
   i docs/qa/tour_<bane>_<n>.jpg (kræver testserveren: WD_TEST=1). Resultatet ligger også i window.__tourDone. */
async function runTour(id, only) {
  Game.state = 'menu'; UI.showScreen('game'); $('hud').style.display = 'none';
  if (!inited3d) { Renderer.init(); inited3d = true; }
  setMap(id);
  const t0 = performance.now(); while (Renderer.mapId !== id && performance.now() - t0 < 60000) await new Promise(r => setTimeout(r, 200));
  await new Promise(r => setTimeout(r, 600));
  let shots = Renderer.tourShots();
  const custom = Array.isArray(only) && only.length && typeof only[0] === 'object';    // egne kameraer: [{n,x,y,z,yaw,pitch}]
  const sel = custom ? only : (only || (new URLSearchParams(location.search).get('shots') || '').split(',').filter(Boolean).map(Number));
  if (custom) shots = only; else if (sel.length) shots = sel.map(i => shots[i - 1]).filter(Boolean);
  const files = [];
  for (let p = 0; p * 12 < shots.length; p++) {
    const cv = Renderer.tourSheet(shots.slice(p * 12, p * 12 + 12));
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.86)), name = `tour_${id}${custom ? '_dbg' : sel.length ? '_valg' : ''}_${p + 1}.jpg`;
    try { const r = await fetch('/dev/save?f=' + encodeURIComponent(name), { method: 'POST', body: blob }); if (r.ok) files.push(name); } catch (e) { /* ingen testserver */ }
  }
  window.__tourDone = { id, n: shots.length, files, shots };
  console.log('[tour]', id, shots.length, 'billeder →', files.join(', '));
  return window.__tourDone;
}

/* ==========================================================================
   OPSTART: forsøg automatisk genoptagelse af session
   ========================================================================== */
(async function boot() {
  const params = new URLSearchParams(location.search);
  const joinCode = params.get('join');
  if (joinCode && /^\d{4}$/.test(joinCode)) { $('codeInput').value = joinCode; $('joinRow').classList.remove('hidden'); }
  if (DEV) window.__wd = { victory: m => startVictory(m), Game, Renderer, Net, BuyMenu, get W() { return W; }, WD, THREE, KEY, Settings, act: { nadeStart, nadeRelease, fireStart, fireEnd, switchWeapon, startFlash, startReloadLocal }, tour: runTour };
  if (DEV && params.get('tour')) { runTour(params.get('tour')); return; }

  const sess = loadSession();
  if (sess) {
    try {
      await Net.connect();
      Net.session = sess;
      const got = await new Promise(res => {
        Net.on('joined', () => res(true));
        Net.on('err', () => res(false));
        Net.send({ t: 'rejoin', code: sess.code, id: sess.id, key: sess.key });
        setTimeout(() => res(false), 1800);
      });
      if (!got) clearSession();
    } catch (e) { clearSession(); }
  }
})();
