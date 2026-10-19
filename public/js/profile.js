// ==========================================================================
// White Dust · v26.6 PROFIL & KARRIERE – XP, levels, ranks (Bronze → Elite), titler, profilkort og statistik.
//   Profilen gemmes lokalt ('wd_profile'). Serveren sender fakta pr. runde ('rf') og pr. kamp ('mf'); XP regnes i shared/progress.js.
//   KARRIERE-hubben har faner; senere systemer (missioner, trofæer, mastery, butik, venner, fraktion, hideout) melder sig ind med addTab().
// createProfile({ $, Audio, esc }) -> { data, onRound(rf), onMatch(mf), summary(), open(tab), isOpen(), addTab(id, label, render), emblem(level, px), strip() }
// ==========================================================================
export function createProfile(o) {
  const P = window.WDP, KEY = 'wd_profile', $ = o.$, esc = o.esc || (s => String(s));
  const blank = () => ({ v: 1, xp: 0, coins: 0, title: 'rekrut', card: 'paper', badge: '', owned: {}, stats: { matches: 0, wins: 0, rounds: 0, roundWins: 0, kills: 0, deaths: 0, hs: 0, knife: 0, mvps: 0, plants: 0, defuses: 0, aces: 0, high: 0, clutch: 0 }, hist: [] });
  let D = blank();
  try { const r = JSON.parse(localStorage.getItem(KEY) || 'null'); if (r && r.v === 1) D = Object.assign(blank(), r, { stats: Object.assign(blank().stats, r.stats || {}) }); } catch (e) { /* ny profil */ }
  const listeners = [];
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} listeners.forEach(f => { try { f(D); } catch (e) {} }); };
  const lv = () => P.levelOf(D.xp);
  const has = (kind, id) => { const L = lv().level; const tab = kind === 'title' ? P.TITLES : kind === 'card' ? P.CARDS : P.BADGES; const e = tab.find(t => t[1] === id); return !!(e && L >= e[0]) || !!(D.owned[kind + ':' + id]); };
  // ekstra titler/kort (sæson, trofæer, butik) – ejes via D.owned
  const EXTRA = { title: [], card: [], badge: [] };
  function registerExtra(kind, id, name, css) { if (!EXTRA[kind].some(e => e[1] === id)) EXTRA[kind].push([999, id, name, css]); }
  const titleName = id => (P.TITLES.concat(EXTRA.title).find(t => t[1] === id) || [0, '', 'Rekrut'])[2];
  const cardCss = id => (P.CARDS.concat(EXTRA.card).find(c => c[1] === id) || P.CARDS[0])[3];

  /* ---------------- rank-emblem (SVG i spillets stil: skjold, chevroner, stjerne for Elite) ---------------- */
  function emblem(level, px) {
    const r = P.rankOf(level), s = px || 46, n = r.id === 'elite' ? 0 : r.sub;
    const chev = Array.from({ length: n }, (_, i) => `<path d="M14 ${30 + i * 7 - n * 3.5} L24 ${24 + i * 7 - n * 3.5} L34 ${30 + i * 7 - n * 3.5}" fill="none" stroke="#0a0a0a" stroke-width="3.4" stroke-linejoin="miter"/>`).join('');
    const star = r.id === 'elite' ? `<path d="M24 13 l3.5 7.5 8 1 -6 5.5 1.6 8 -7.1 -4 -7.1 4 1.6 -8 -6 -5.5 8 -1z" fill="#0a0a0a"/><text x="24" y="47" text-anchor="middle" font-size="8" font-family="JetBrains Mono" font-weight="700" fill="#0a0a0a">${['I', 'II', 'III', 'IV', 'V'][r.sub - 1]}</text>` : '';
    return `<svg class="pf-emb" width="${s}" height="${s}" viewBox="0 0 48 52"><path d="M24 2 L44 9 V27 C44 39 35 46 24 50 C13 46 4 39 4 27 V9 Z" fill="${r.col}" stroke="#0a0a0a" stroke-width="3"/>
      <path d="M24 7 L39 12.5 V27 C39 36 32.5 41.5 24 45" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="2"/>${chev}${star}</svg>`;
  }

  /* ---------------- XP-feed (venstre side) + level-up ---------------- */
  let feedEl = null, feedT = 0, queue = Promise.resolve();
  function feed(title, lines, before, after) {
    if (!feedEl) { feedEl = document.createElement('div'); feedEl.id = 'xpFeed'; feedEl.className = 'xpf hidden'; document.body.appendChild(feedEl); }
    const total = lines.reduce((a, l) => a + l[1], 0); if (!total) return;
    const b0 = P.levelOf(before), b1 = P.levelOf(after), up = b1.level > b0.level;
    feedEl.innerHTML = `<div class="xpf-h"><b>${esc(title)}</b><span>+${total} XP</span></div>
      <ul>${lines.map((l, i) => `<li style="--i:${i}"><span>${esc(l[0])}</span><em>+${l[1]}</em></li>`).join('')}</ul>
      <div class="xpf-bar"><i style="--a:${(b0.frac * 100).toFixed(1)}%;--b:${up ? 100 : (b1.frac * 100).toFixed(1)}%"></i></div>
      <div class="xpf-lv">${emblem(b1.level, 22)}<span>LEVEL ${b1.level}</span><small>${b1.into} / ${b1.need} XP</small></div>`;
    feedEl.className = 'xpf'; void feedEl.offsetWidth; feedEl.classList.add('in');
    clearTimeout(feedT); feedT = setTimeout(() => feedEl.classList.remove('in'), 6500 + lines.length * 180);
    if (up) for (let L = b0.level + 1; L <= b1.level; L++) { const lvl = L; queue = queue.then(() => levelUp(lvl)); }
  }
  function levelUp(level) {
    return new Promise(res => {
      const el = document.createElement('div'); el.className = 'lvu'; const r = P.rankOf(level), un = P.unlocksAt(level);
      el.innerHTML = `<div class="lvu-in" style="--rc:${r.col}"><div class="lvu-k">LEVEL UP</div><div class="lvu-e">${emblem(level, 120)}</div>
        <div class="lvu-n">${level}</div><div class="lvu-r">${r.label}</div>
        ${un.length ? `<div class="lvu-u">${un.map(u => `<span><small>${{ title: 'NY TITEL', card: 'NYT PROFILKORT', badge: 'NYT BADGE', rank: 'NY RANK' }[u.kind]}</small>${esc(u.name)}</span>`).join('')}</div>` : ''}</div>`;
      document.body.appendChild(el); void el.offsetWidth; el.classList.add('go');
      try { o.Audio && o.Audio.cine && o.Audio.cine('braam', { vol: 0.7 }); } catch (e) {}
      setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); res(); }, 600); }, 3600);
    });
  }
  // små toasts øverst til højre (missioner, trofæer, mastery)
  let toastBox = null;
  function toast(title, line, sub) {
    if (!toastBox) { toastBox = document.createElement('div'); toastBox.className = 'pf-toasts'; document.body.appendChild(toastBox); }
    const el = document.createElement('div'); el.className = 'pf-toast' + (/FULDFØRT|TROFÆ|KLARET|LEVEL/.test(title) ? ' big' : '');
    el.innerHTML = `<small>${esc(title)}</small><b>${esc(line)}</b>${sub ? `<em>${esc(sub)}</em>` : ''}`;
    toastBox.appendChild(el); while (toastBox.children.length > 4) toastBox.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, el.classList.contains('big') ? 5200 : 3200);
  }
  function addXP(title, lines) {
    const total = lines.reduce((a, l) => a + l[1], 0); if (!total) return;
    const before = D.xp; D.xp += total; save(); feed(title, lines, before, D.xp);
    if (P.levelOf(D.xp).level !== P.levelOf(before).level && o.onLevel) o.onLevel();
  }

  /* ---------------- fakta fra serveren ---------------- */
  function onRound(rf) {
    const S = D.stats, ks = rf.kills || [];
    S.rounds++; if (rf.won) S.roundWins++; S.kills += ks.length; S.hs += ks.filter(k => k.hs).length; S.knife += ks.filter(k => k.w === 'knife').length;
    S.high += ks.filter(k => k.dy >= 1.4).length; if (ks.length >= 5) S.aces++; if (rf.mvp) S.mvps++; if (rf.plant) S.plants++; if (rf.defuse) S.defuses++; if (rf.clutch) S.clutch++;
    if (!rf.alive) S.deaths++;
    addXP('RUNDE ' + (rf.n || ''), P.roundXP(rf));
    fire('round', rf);
  }
  function onMatch(mf) {
    const S = D.stats; S.matches++; if (mf.won) S.wins++;
    D.hist.unshift({ t: Date.now(), won: mf.won, k: mf.kills, d: mf.deaths, mvps: mf.mvps, score: mf.score, side: mf.side, map: mf.map }); D.hist = D.hist.slice(0, 30);
    addXP(mf.won ? 'KAMP VUNDET' : 'KAMP SLUT', P.matchXP(mf));
    const coins = 30 + (mf.won ? 40 : 0) + 2 * (mf.kills || 0); D.coins = (D.coins || 0) + coins; save(); toast('MØNTER', mf.won ? 'Kamp vundet' : 'Kamp spillet', '+' + coins + ' mønter');
    fire('match', mf);
  }
  const hooks = { round: [], match: [] };
  function fire(k, f) { for (const fn of hooks[k]) try { fn(f, D); } catch (e) { console.warn('[profil]', e); } }

  /* ---------------- KARRIERE-hubben ---------------- */
  const tabs = [{ id: 'profil', label: 'PROFIL', render: renderProfile }]; let cur = 'profil', hub = null;
  function addTab(id, label, render, click) { if (!tabs.some(t => t.id === id)) tabs.push({ id, label, render, click }); }
  function open(tab) {
    if (!hub) { hub = document.createElement('div'); hub.id = 'career'; hub.className = 'settings hidden'; document.body.appendChild(hub);
      hub.addEventListener('mousedown', e => { if (e.target === hub) close(); });
      hub.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.close !== undefined) return close(); if (b.dataset.ctab) { cur = b.dataset.ctab; return render(); }
        for (const k of ['title', 'card', 'badge']) if (b.dataset[k] !== undefined && (b.dataset[k] === '' || has(k, b.dataset[k]))) { D[k] = b.dataset[k]; save(); render(); o.onLevel && o.onLevel(); }
        const t = tabs.find(t => t.id === cur); if (t && t.click) t.click(b); });
      window.addEventListener('keydown', e => { if (isOpen() && e.code === 'Escape') { e.stopPropagation(); close(); } }, true); }
    if (tab) cur = tab; hub.classList.remove('hidden'); render();
  }
  function close() { if (hub) { hub.classList.add('hidden'); hub.innerHTML = ''; } }
  const isOpen = () => !!(hub && !hub.classList.contains('hidden'));
  function render() {
    const t = tabs.find(x => x.id === cur) || tabs[0];
    hub.innerHTML = `<div class="st-panel cr-panel"><div class="st-head"><h2>KARRIERE</h2><div class="iv-tabs">${tabs.map(x => `<button data-ctab="${x.id}" class="${x.id === t.id ? 'sel' : ''}">${x.label}</button>`).join('')}</div><button class="btn btn-tiny btn-ghost" data-close>LUK (ESC)</button></div><div class="cr-body">${t.render()}</div></div>`;
  }
  function card(big) {
    const l = lv(), r = P.rankOf(l.level), nm = (o.name && o.name()) || 'Spiller';
    return `<div class="pf-card${big ? ' big' : ''}" style="--card:${cardCss(D.card)};--rc:${r.col}"><div class="pf-bg"></div>
      <div class="pf-e">${emblem(l.level, big ? 92 : 50)}</div>
      <div class="pf-t"><small>${esc(titleName(D.title))}</small><b>${esc(nm)}</b><span>${r.label} · LEVEL ${l.level}</span></div>
      ${D.badge ? `<div class="pf-badge">★ ${esc((P.BADGES.concat(EXTRA.badge).find(b => b[1] === D.badge) || [0, '', ''])[2])}</div>` : ''}
      <div class="pf-xp"><i style="width:${(l.frac * 100).toFixed(1)}%"></i><em>${l.into} / ${l.need} XP</em></div></div>`;
  }
  function renderProfile() {
    const l = lv(), S = D.stats, L = l.level;
    const ranks = P.RANKS.map(r => `<li class="${P.rankOf(L).id === r.id ? 'cur' : L >= r.from ? 'done' : ''}" style="--rc:${r.col}">${emblem(Math.max(r.from, r.id === 'elite' ? 50 : r.from + 7), 30)}<b>${r.name}</b><small>LEVEL ${r.from}${r.id === 'elite' ? '+' : '–' + (r.from + 9)}</small></li>`).join('');
    const next = []; for (let k = L + 1; k <= P.MAX_LEVEL && next.length < 7; k++) { const u = P.unlocksAt(k); if (u.length) next.push([k, u]); }
    const kd = S.deaths ? (S.kills / S.deaths).toFixed(2) : S.kills.toFixed(2), wr = S.matches ? Math.round(100 * S.wins / S.matches) + ' %' : '–', hsr = S.kills ? Math.round(100 * S.hs / S.kills) + ' %' : '–';
    const stats = [['KAMPE', S.matches], ['SEJRE', wr], ['RUNDER', S.rounds], ['K/D', kd], ['DRAB', S.kills], ['HEADSHOT', hsr], ['MVP', S.mvps], ['PLANTS', S.plants], ['DESARMERET', S.defuses], ['KNIVDRAB', S.knife], ['ACES', S.aces], ['CLUTCHES', S.clutch]];
    const chips = (kind, tab) => tab.concat(EXTRA[kind].filter(e => D.owned[kind + ':' + e[1]])).map(t => { const ok = has(kind, t[1]); return `<button class="cr-chip${D[kind] === t[1] ? ' sel' : ''}${ok ? '' : ' lock'}" data-${kind}="${t[1]}" ${ok ? '' : 'disabled'} title="${ok ? '' : 'Låses op ved level ' + t[0]}" ${kind === 'card' ? `style="--card:${t[3]}"` : ''}>${kind === 'card' ? '<i></i>' : ''}${esc(t[2])}${ok ? '' : `<small>LVL ${t[0]}</small>`}</button>`; }).join('');
    return `<div class="cr-grid"><div class="cr-left">${card(true)}
        <h3>TITEL</h3><div class="cr-chips">${chips('title', P.TITLES)}</div>
        <h3>PROFILKORT</h3><div class="cr-chips cards">${chips('card', P.CARDS)}</div>
        <h3>BADGE</h3><div class="cr-chips"><button class="cr-chip${!D.badge ? ' sel' : ''}" data-badge="">Ingen</button>${chips('badge', P.BADGES)}</div></div>
      <div class="cr-right"><h3>RANKS</h3><ul class="cr-ranks">${ranks}</ul>
        <h3>NÆSTE BELØNNINGER</h3><ul class="cr-next">${next.map(([k, u]) => `<li><b>${k}</b>${u.map(x => `<span>${esc(x.name)}<small>${{ title: 'titel', card: 'profilkort', badge: 'badge', rank: 'rank' }[x.kind]}</small></span>`).join('')}</li>`).join('') || '<li>Alt er låst op</li>'}</ul>
        <h3>STATISTIK</h3><div class="cr-stats">${stats.map(([k, v]) => `<div><em>${k}</em><b>${v}</b></div>`).join('')}</div></div></div>`;
  }
  // forsidens profilstrimmel (klik = KARRIERE)
  function strip() {
    const l = lv(), r = P.rankOf(l.level);
    return `<div class="pf-strip" style="--rc:${r.col}">${emblem(l.level, 34)}<div><b>LEVEL ${l.level}</b><small>${r.label} · ${esc(titleName(D.title))}</small><i><em style="width:${(l.frac * 100).toFixed(1)}%"></em></i></div></div>`;
  }
  // kort sammendrag til de andre spillere (lobby/scoreboard)
  const summary = () => ({ lvl: lv().level, t: D.title, c: D.card, b: D.badge, n: D.nc || '', m: o.mastery ? o.mastery() : '' });
  return { get data() { return D; }, registerExtra, toast, save, onRound, onMatch, summary, open, close, isOpen, addTab, emblem, strip, card, hooks, has, titleName, cardCss, onChange: f => listeners.push(f), addXP, render: () => hub && isOpen() && render() };
}
