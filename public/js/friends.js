// ==========================================================================
// White Dust · v26.6 VENNER – tilføj venner med deres vennekode (WD-XXXXXXXX) eller direkte fra de seneste medspillere,
//   og sammenlign level, statistik, trofæer og mastery side om side – og besøg deres hideout.
//   Ingen server i skyen: vennekortet udveksles når man spiller sammen (pub-relæet) og direkte mellem appene via PeerJS,
//   når begge er online (hver app melder sig på "whitedust-lk-f-<kode>"). Det seneste kort gemmes, så man kan sammenligne offline.
// createFriends({ Profile, Trophies, Mastery, Hideout, Factions, esc, name() }) -> { card(), seen(card), refresh() }
// ==========================================================================
export function createFriends(o) {
  const Pf = o.Profile, esc = o.esc, P = window.WDP;
  const PREFIX = 'whitedust-lk-f-', OPTS = { debug: 0, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }] } };
  const st = () => { const D = Pf.data; D.fr = D.fr || {}; D.met = D.met || []; return D; };
  const code = u => 'WD-' + String(u || '').toUpperCase();
  const online = {};   // uid -> tidspunkt vi sidst hørte fra dem direkte
  let sel = null, showHo = false;
  // mit offentlige vennekort
  function card() {
    const D = Pf.data, S = D.stats, h = o.Hideout ? o.Hideout.snap() : { tr: {}, mx: {}, deco: [] };
    return { u: D.uid, n: (o.name && o.name()) || 'Spiller', xp: D.xp | 0, t: D.title, cc: D.card, b: D.badge || '', f: (o.Factions && o.Factions.cur()) || '',
      st: { m: S.matches, w: S.wins, k: S.kills, d: S.deaths, hs: S.hs, mvp: S.mvps, ace: S.aces, cl: S.clutch, pl: S.plants, df: S.defuses, kn: S.knife, r: S.rounds },
      tr: h.tr, mx: h.mx, deco: h.deco, ts: Date.now() };
  }
  const clean = c => {
    if (!c || typeof c !== 'object' || !/^[a-z0-9]{4,16}$/.test(c.u || '')) return null;
    const num = v => Math.max(0, Math.min(1e7, +v || 0)), id = v => typeof v === 'string' && /^[a-z0-9_]{0,24}$/.test(v) ? v : '';
    const obj = (x, lim) => { const r = {}; if (x && typeof x === 'object') for (const [k, v] of Object.entries(x).slice(0, 60)) if (/^[a-z0-9_]{1,24}$/.test(k)) r[k] = Math.max(0, Math.min(lim, v | 0)); return r; };
    const s = c.st || {};
    return { u: c.u, n: String(c.n || 'Spiller').slice(0, 20), xp: num(c.xp), t: id(c.t), cc: id(c.cc), b: id(c.b), f: id(c.f), st: Object.fromEntries(['m', 'w', 'k', 'd', 'hs', 'mvp', 'ace', 'cl', 'pl', 'df', 'kn', 'r'].map(k => [k, num(s[k])])),
      tr: obj(c.tr, 3), mx: obj(c.mx, 3), deco: Array.isArray(c.deco) ? c.deco.filter(x => /^[a-z0-9_]{1,16}$/.test(x)).slice(0, 20) : [], ts: num(c.ts) };
  };
  // et kort fra en medspiller (pub-relæ) eller direkte fra en ven
  function seen(raw, direct) {
    const c = clean(raw), D = st(); if (!c || c.u === D.uid) return;
    D.met = [{ u: c.u, n: c.n, lvl: P.levelOf(c.xp).level, at: Date.now(), c }].concat(D.met.filter(m => m.u !== c.u)).slice(0, 15);
    if (D.fr[c.u]) { D.fr[c.u].c = c; D.fr[c.u].at = Date.now(); }
    if (direct) online[c.u] = Date.now();
    Pf.save(); if (Pf.isOpen() && cur() && !(document.activeElement && document.activeElement.id === 'frCode')) Pf.render();
  }
  let curTab = false; const cur = () => curTab && document.querySelector('.fr-wrap');
  // ---- PeerJS: tilstedeværelse + direkte hentning af vennekort ----
  let peer = null;
  function presence() {
    if (peer || typeof window.Peer !== 'function' || !window.WD_P2P) return;
    try {
      peer = new window.Peer(PREFIX + Pf.data.uid, OPTS);
      peer.on('connection', conn => { conn.on('open', () => conn.send(JSON.stringify({ t: 'card', c: card() }))); conn.on('data', d => { try { const m = JSON.parse(d); if (m.t === 'card') seen(m.c, true); } catch (e) {} setTimeout(() => conn.close(), 1500); }); });
      peer.on('disconnected', () => setTimeout(() => { try { peer && !peer.destroyed && peer.reconnect(); } catch (e) {} }, 3000));
      peer.on('error', e => { if (e.type === 'unavailable-id') { try { peer.destroy(); } catch (x) {} peer = null; setTimeout(presence, 8000); } });
    } catch (e) { peer = null; }
  }
  function fetchCard(u) {
    if (!peer || peer.destroyed || !peer.open) return;
    try { const conn = peer.connect(PREFIX + u, { reliable: true }); const t = setTimeout(() => { try { conn.close(); } catch (e) {} }, 7000);
      conn.on('open', () => conn.send(JSON.stringify({ t: 'card', c: card() })));
      conn.on('data', d => { try { const m = JSON.parse(d); if (m.t === 'card') seen(m.c, true); } catch (e) {} clearTimeout(t); setTimeout(() => conn.close(), 500); });
    } catch (e) {}
  }
  let lastRefresh = 0;
  function refresh(force) { presence(); if (!force && Date.now() - lastRefresh < 20000) return; lastRefresh = Date.now(); for (const u of Object.keys(st().fr)) fetchCard(u); }
  setTimeout(presence, 4000);
  // ---- visning ----
  const lvlOf = c => P.levelOf(c.xp || 0).level;
  function fcard(c, me) {
    const L = lvlOf(c), r = P.rankOf(L), fc = c.f && o.Factions && o.Factions.fac(c.f);
    return `<div class="pf-card fr-card" style="--card:${Pf.cardCss(c.cc)};--rc:${r.col}"><div class="pf-bg"></div><div class="pf-e">${Pf.emblem(L, 50)}</div>
      <div class="pf-t"><small>${esc(Pf.titleName(c.t))}</small><b>${esc(c.n)}${me ? ' <i class="fr-you">DIG</i>' : ''}</b><span>${r.label} · LEVEL ${L}${fc ? ` · <em style="color:${fc.col}">${fc.name}</em>` : ''}</span></div></div>`;
  }
  const trCount = c => { let g = 0, n = 0; for (const t of o.Trophies.list) { const v = (c.tr || {})[t.id] || 0; n += v; if (v && v === t.tiers.length) g++; } return [n, g]; };
  function compare(a, b) {
    const pct = (x, y) => y ? Math.round(100 * x / y) : 0, kd = s => s.d ? +(s.k / s.d).toFixed(2) : s.k;
    const [an, ag] = trCount(a), [bn, bg] = trCount(b);
    const rows = [['LEVEL', lvlOf(a), lvlOf(b)], ['K/D', kd(a.st), kd(b.st)], ['HEADSHOT %', pct(a.st.hs, a.st.k), pct(b.st.hs, b.st.k)], ['SEJR %', pct(a.st.w, a.st.m), pct(b.st.w, b.st.m)],
      ['KAMPE', a.st.m, b.st.m], ['DRAB', a.st.k, b.st.k], ['MVP', a.st.mvp, b.st.mvp], ['ACES', a.st.ace, b.st.ace], ['CLUTCHES', a.st.cl, b.st.cl], ['PLANTS', a.st.pl, b.st.pl], ['DESARMERET', a.st.df, b.st.df], ['KNIVDRAB', a.st.kn, b.st.kn],
      ['TROFÆTRIN', an, bn], ['GULD-TROFÆER', ag, bg], ['MASTERY-CHARMS', Object.keys(a.mx || {}).length, Object.keys(b.mx || {}).length]];
    let wa = 0, wb = 0; for (const [, x, y] of rows) { if (x > y) wa++; else if (y > x) wb++; }
    const tro = o.Trophies.list.map(t => { const x = (a.tr || {})[t.id] || 0, y = (b.tr || {})[t.id] || 0, single = t.tiers.length === 1; if (t.secret && !x && !y) return '';
      return `<li title="${esc(t.name)}"><span>${o.Trophies.cup(x, single)}</span><b>${esc(t.name)}</b><span>${o.Trophies.cup(y, single)}</span></li>`; }).join('');
    return `<div class="fr-cmp"><div class="fr-vs">${fcard(a, true)}<div class="fr-score"><b>${wa}</b><i>VS</i><b>${wb}</b></div>${fcard(b)}</div>
      <table class="fr-tab">${rows.map(([k, x, y]) => { const m = Math.max(x, y) || 1; return `<tr><td class="${x > y ? 'win' : ''}"><i style="width:${(100 * x / m).toFixed(0)}%"></i><b>${x}</b></td><th>${k}</th><td class="r ${y > x ? 'win' : ''}"><i style="width:${(100 * y / m).toFixed(0)}%"></i><b>${y}</b></td></tr>`; }).join('')}</table>
      <h3>TROFÆER</h3><ul class="fr-tro">${tro}</ul>
      <div class="fr-acts"><button class="sh-btn" data-frho>${showHo ? 'SKJUL' : 'BESØG'} ${esc(b.n.toUpperCase())}S HIDEOUT</button></div>
      ${showHo ? `<div class="ho-view fr-ho"><canvas id="frHo"></canvas><div class="ho-tip"></div><div class="ho-hint">${esc(b.n.toUpperCase())}S HIDEOUT · TRÆK FOR AT KIGGE RUNDT</div></div>` : ''}</div>`;
  }
  function render() {
    curTab = true; refresh(); const D = st(), me = card(), ids = Object.keys(D.fr);
    if (sel && !D.fr[sel]) sel = null; if (!sel && ids.length) sel = ids.find(u => D.fr[u].c) || null;
    const ago = t => { if (!t) return 'aldrig set'; const m = Math.round((Date.now() - t) / 60000); return m < 2 ? 'lige nu' : m < 60 ? m + ' min siden' : m < 1440 ? Math.round(m / 60) + ' t siden' : Math.round(m / 1440) + ' d siden'; };
    const list = ids.map(u => { const f = D.fr[u], c = f.c, on = online[u] && Date.now() - online[u] < 90000;
      return `<li class="${sel === u ? 'sel' : ''}${c ? '' : ' pend'}"><button class="fr-row" data-frsel="${u}">${c ? Pf.emblem(lvlOf(c), 30) : '<span class="fr-q">?</span>'}<span><b>${esc(c ? c.n : code(u))}</b><small><i class="fr-on ${on ? 'on' : ''}"></i>${c ? (on ? 'ONLINE' : 'set ' + ago(f.at)) : 'venter – spil en kamp sammen eller vær online samtidig'}</small></span></button><button class="fr-x" data-frdel="${u}" title="Fjern">✕</button></li>`; }).join('');
    const met = D.met.filter(m => !D.fr[m.u]).slice(0, 8).map(m => `<li><span>${Pf.emblem(m.lvl, 22)}<b>${esc(m.n)}</b><small>${ago(m.at)}</small></span><button class="sh-btn" data-fradd="${m.u}">+ VEN</button></li>`).join('');
    const f = sel && D.fr[sel] && D.fr[sel].c;
    return `<div class="fr-wrap"><div class="fr-left">
        <div class="fr-code"><small>DIN VENNEKODE</small><b>${code(D.uid)}</b><button class="sh-btn" data-frcopy>KOPIÉR</button></div>
        <div class="fr-add"><input id="frCode" placeholder="WD-XXXXXXXX" maxlength="19" spellcheck="false" autocomplete="off"><button class="sh-btn buy" data-fradd>TILFØJ</button></div>
        <h3>VENNER <small>${ids.length}</small></h3><ul class="fr-list">${list || '<li class="fr-empty">Ingen venner endnu – del din kode eller tilføj en medspiller nedenfor</li>'}</ul>
        <h3>SENESTE MEDSPILLERE</h3><ul class="fr-met">${met || '<li class="fr-empty">Spil en kamp – så dukker dine medspillere op her</li>'}</ul></div>
      <div class="fr-right">${f ? compare(me, f) : `<div class="fr-none"><b>SAMMENLIGN MED DINE VENNER</b><span>Level, statistik, trofæer og mastery side om side – og besøg deres hideout.</span></div>`}</div></div>`;
  }
  function after(hub) { const cv = hub.querySelector('#frHo'), f = sel && st().fr[sel] && st().fr[sel].c; if (cv && f && o.Hideout) o.Hideout.mount(cv, { n: f.n, lvl: lvlOf(f), f: f.f, tr: f.tr, mx: f.mx, deco: f.deco }, hub.querySelector('.fr-ho .ho-tip')); }
  function click(b) {
    const D = st();
    if (b.dataset.frsel) { sel = b.dataset.frsel; showHo = false; if (!D.fr[sel].c) fetchCard(sel); Pf.render(); }
    else if (b.dataset.frdel) { delete D.fr[b.dataset.frdel]; Pf.save(); Pf.render(); }
    else if (b.dataset.frho !== undefined) { showHo = !showHo; Pf.render(); }
    else if (b.dataset.frcopy !== undefined) { try { navigator.clipboard.writeText(code(D.uid)); b.textContent = 'KOPIERET ✓'; } catch (e) {} }
    else if (b.dataset.fradd !== undefined) {
      let u = b.dataset.fradd; if (!u) { const inp = document.getElementById('frCode'); u = String(inp ? inp.value : '').trim().toLowerCase().replace(/^wd-?/, '').replace(/[^a-z0-9]/g, ''); }
      if (!/^[a-z0-9]{4,16}$/.test(u)) return Pf.toast('VENNER', 'Ugyldig vennekode', 'Den ser sådan ud: ' + code('abcd2345'));
      if (u === D.uid) return Pf.toast('VENNER', 'Det er din egen kode', '');
      if (!D.fr[u]) { const m = D.met.find(x => x.u === u); D.fr[u] = { c: m && m.c ? m.c : null, added: Date.now(), at: m ? m.at : 0 }; Pf.toast('VENNER', 'Ven tilføjet', m ? m.n : code(u)); }
      sel = u; Pf.save(); fetchCard(u); Pf.render();
    }
  }
  const origRender = render;
  Pf.addTab('venner', 'VENNER', () => origRender(), click, after);
  // fanen er ikke længere åben → stop live-opdatering
  setInterval(() => { if (!document.querySelector('.fr-wrap')) curTab = false; }, 2000);
  return { card, seen, refresh, code: () => code(Pf.data.uid) };
}
