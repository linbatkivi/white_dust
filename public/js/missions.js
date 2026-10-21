// ==========================================================================
// White Dust · v26.6 MISSIONER – daglige (3, nulstilles ved midnat), ugentlige (3, nulstilles mandag) og sæson-missioner.
//   Udvalget afhænger kun af datoen (samme missioner for alle venner – man kan sammenligne). Fremskridt tælles ud fra rundens
//   fakta fra serveren (drab med våben/rum/site/etagen over, plant, desarmering, MVP, clutch …) og fra de rum man selv besøger
//   (udforskning og ruter gennem banens kringlede veje og etager). Belønning: XP + mønter.
// createMissions({ Profile, esc, toast }) -> { onVisit(area), onRoundStart(), render() }
// ==========================================================================
export function createMissions(o) {
  const Pf = o.Profile, esc = o.esc, WD = window.WD;
  const cls = w => { const d = WD.WEAPONS[w]; if (!d) return ''; if (w === 'knife') return 'knife'; if (d.kind === 'nade') return 'nade'; if (w === 'awp') return 'awp'; if (d.slot === 2) return 'pistol'; if (d.smg) return 'smg'; return 'rifle'; };
  const inZ = (k, set) => set.includes(k.at) || set.includes(k.vt);
  const ALL_AREAS = 40;
  // ---- puljer (on: hændelse → antal) ----
  const DAILY = [
    { id: 'd_win', t: 'Vind {n} runder', n: 6, on: { round: r => r.won } },
    { id: 'd_kills', t: 'Lav {n} drab', n: 12, on: { kill: () => 1 } },
    { id: 'd_hs', t: 'Lav {n} headshots', n: 5, on: { kill: k => k.hs } },
    { id: 'd_pistol', t: 'Lav {n} drab med pistol', n: 4, on: { kill: k => cls(k.w) === 'pistol' } },
    { id: 'd_smg', t: 'Lav {n} drab med maskinpistol', n: 5, on: { kill: k => cls(k.w) === 'smg' } },
    { id: 'd_rifle', t: 'Lav {n} drab med riffel', n: 8, on: { kill: k => cls(k.w) === 'rifle' } },
    { id: 'd_awp', t: 'Lav {n} drab med snigskytteriffel', n: 3, on: { kill: k => cls(k.w) === 'awp' } },
    { id: 'd_high', t: 'Lav {n} drab fra etagen over', n: 3, on: { kill: k => k.dy >= 1.4 } },
    { id: 'd_trap', t: 'Lav {n} drab i Trappehallen eller Kryptgangen', n: 3, on: { kill: k => inZ(k, ['Trappehallen', 'Kryptgangen', 'Kryptnedgangen']) } },
    { id: 'd_atrium', t: 'Lav {n} drab i Atriet eller Elevatorlobbyen', n: 4, on: { kill: k => inZ(k, ['Atriet', 'Elevatorlobbyen']) } },
    { id: 'd_siteA', t: 'Lav {n} drab på A-sitet', n: 4, on: { kill: k => k.site === 'A' } },
    { id: 'd_siteB', t: 'Lav {n} drab på B-sitet', n: 4, on: { kill: k => k.site === 'B' } },
    { id: 'd_plant', t: 'Plant bomben {n} gange', n: 2, on: { round: r => r.plant } },
    { id: 'd_defuse', t: 'Desarmér bomben', n: 1, on: { round: r => r.defuse } },
    { id: 'd_swat', t: 'Vind {n} runder som SWAT', n: 4, on: { round: r => r.won && r.side === 'swat' } },
    { id: 'd_hij', t: 'Vind {n} runder som Hijackers', n: 4, on: { round: r => r.won && r.side === 'hij' } },
    { id: 'd_explore', t: 'Besøg {n} forskellige områder i én kamp', n: 18, max: 'matchAreas' },
    { id: 'd_route1', t: 'Løb gennem Kryptgangen og Trappehallen i samme runde', n: 1, route: ['Kryptgangen', 'Trappehallen'] },
    { id: 'd_route2', t: 'Tag trappen: Buegangen og Kaffebaren i samme runde', n: 1, route: ['Buegangen', 'Kaffebaren'] },
    { id: 'd_route3', t: 'Fra Mørkerummet til Kedelrummet i samme runde', n: 1, route: ['Mørkerummet', 'Kedelrummet'] },
    { id: 'd_mvp', t: 'Bliv rundens MVP {n} gange', n: 2, on: { round: r => r.mvp } },
    { id: 'd_long', t: 'Lav {n} drab på over 25 meters afstand', n: 3, on: { kill: k => k.d >= 25 } }
  ];
  const WEEKLY = [
    { id: 'w_matches', t: 'Vind {n} kampe', n: 3, on: { match: m => m.won } },
    { id: 'w_kills', t: 'Lav {n} drab', n: 70, on: { kill: () => 1 } },
    { id: 'w_hs', t: 'Lav {n} headshots', n: 25, on: { kill: k => k.hs } },
    { id: 'w_high', t: 'Lav {n} drab fra etagen over', n: 12, on: { kill: k => k.dy >= 1.4 } },
    { id: 'w_knife', t: 'Lav {n} knivdrab', n: 2, on: { kill: k => k.w === 'knife' } },
    { id: 'w_multi', t: 'Lav 3+ drab i én runde – {n} gange', n: 3, on: { round: r => (r.kills || []).length >= 3 } },
    { id: 'w_clutch', t: 'Vind {n} runder som sidste mand i live', n: 2, on: { round: r => r.clutch } },
    { id: 'w_bomb', t: 'Plant eller desarmér bomben {n} gange', n: 6, on: { round: r => (r.plant ? 1 : 0) + (r.defuse ? 1 : 0) } },
    { id: 'w_areas', t: 'Besøg {n} forskellige områder i løbet af ugen', n: 34, max: 'weekAreas' },
    { id: 'w_routes', t: 'Gå gennem alle tre kælderveje (Kryptgangen, Kedelrummet, Mørkekammeret) i én kamp', n: 1, mroute: ['Kryptgangen', 'Kedelrummet', 'Mørkekammeret'] },
    { id: 'w_mvp', t: 'Bliv rundens MVP {n} gange', n: 8, on: { round: r => r.mvp } }
  ];
  const SEASON = { id: 's1', name: 'SÆSON 1 · PENTHOUSE', end: '2026-12-31', reward: { title: ['s1_penthouse', 'Sæson 1: Penthouse'], card: ['s1_card', 'Sæson 1', 'linear-gradient(135deg,rgba(228,174,57,.0) 0 60%,rgba(228,174,57,.55) 60% 62%,transparent 62%),repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 1px,transparent 1px 40px),linear-gradient(160deg,#141a24,#060709)'] },
    list: [
      { id: 's_matches', t: 'Spil {n} kampe', n: 25, on: { match: () => 1 } },
      { id: 's_wins', t: 'Vind {n} kampe', n: 12, on: { match: m => m.won } },
      { id: 's_kills', t: 'Lav {n} drab', n: 300, on: { kill: () => 1 } },
      { id: 's_hs', t: 'Lav {n} headshots', n: 120, on: { kill: k => k.hs } },
      { id: 's_high', t: 'Lav {n} drab fra etagen over', n: 40, on: { kill: k => k.dy >= 1.4 } },
      { id: 's_knife', t: 'Lav {n} knivdrab', n: 10, on: { kill: k => k.w === 'knife' } },
      { id: 's_ace', t: 'Lav en ACE (5 drab i én runde)', n: 1, on: { round: r => (r.kills || []).length >= 5 } },
      { id: 's_clutch', t: 'Vind {n} clutches', n: 10, on: { round: r => r.clutch } },
      { id: 's_areas', t: 'Besøg alle {n} områder på bureau', n: ALL_AREAS, max: 'everAreas' },
      { id: 's_mvp', t: 'Bliv rundens MVP {n} gange', n: 30, on: { round: r => r.mvp } }
    ] };
  const REW = { d: [350, 50], w: [1200, 180], s: [3000, 400] };
  Pf.registerExtra && (Pf.registerExtra('title', SEASON.reward.title[0], SEASON.reward.title[1]), Pf.registerExtra('card', SEASON.reward.card[0], SEASON.reward.card[1], SEASON.reward.card[2]));

  // ---- dato → udvalg (samme for alle) ----
  const pad = n => String(n).padStart(2, '0');
  const dayKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  function weekKey(d) { const t = new Date(d); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return dayKey(t); }   // mandag
  const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  function pick(pool, n, seed) { const a = pool.slice(), out = []; let h = hash(seed); while (out.length < n && a.length) { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; out.push(a.splice(h % a.length, 1)[0]); } return out; }
  function state() {
    const D = Pf.data, now = new Date(), dk = dayKey(now), wk = weekKey(now);
    D.ms = D.ms || { day: '', week: '', season: SEASON.id, prog: {}, done: {}, weekAreas: [], everAreas: [] };
    const M = D.ms;
    if (M.day !== dk) { M.day = dk; for (const k of Object.keys(M.prog)) if (k.startsWith('d_')) { delete M.prog[k]; delete M.done[k]; } }
    if (M.week !== wk) { M.week = wk; M.weekAreas = []; for (const k of Object.keys(M.prog)) if (k.startsWith('w_')) { delete M.prog[k]; delete M.done[k]; } }
    return M;
  }
  const active = () => { const M = state(); return { d: pick(DAILY, 3, 'd' + M.day), w: pick(WEEKLY, 3, 'w' + M.week), s: SEASON.list }; };

  // ---- fremskridt ----
  let roundAreas = new Set(), matchAreas = new Set();
  function bump(m, tier, amt, setTo) {
    const M = state(); if (M.done[m.id]) return;
    const before = M.prog[m.id] || 0, v = setTo !== undefined ? Math.max(before, setTo) : before + amt; if (v === before) return;
    M.prog[m.id] = Math.min(m.n, v);
    if (M.prog[m.id] >= m.n) {
      M.done[m.id] = Date.now(); const [xp, c] = REW[tier]; Pf.data.coins = (Pf.data.coins || 0) + c;
      o.toast && o.toast('MISSION FULDFØRT', txt(m), `+${xp} XP · +${c} mønter`);
      Pf.addXP('MISSION', [[txt(m), xp]]);
      if (tier === 's' && SEASON.list.every(x => M.done[x.id])) { Pf.data.owned['title:' + SEASON.reward.title[0]] = 1; Pf.data.owned['card:' + SEASON.reward.card[0]] = 1; o.toast && o.toast('SÆSONEN KLARET', 'Titel og profilkort låst op', SEASON.reward.title[1]); }
    } else if (setTo === undefined && Math.floor(before / Math.max(1, m.n / 4)) !== Math.floor(v / Math.max(1, m.n / 4))) o.toast && o.toast('MISSION', txt(m), M.prog[m.id] + ' / ' + m.n);
    Pf.save();
  }
  const txt = m => m.t.replace('{n}', m.n);
  function each(fn) { const A = active(); for (const tier of ['d', 'w', 's']) for (const m of A[tier]) fn(m, tier); }
  Pf.hooks.round.push(rf => {
    each((m, tier) => {
      if (!m.on && !m.route) return;
      let a = 0;
      if (m.on && m.on.round) a += +m.on.round(rf) || 0;
      if (m.on && m.on.kill) for (const k of (rf.kills || [])) a += m.on.kill(k) ? 1 : 0;
      if (m.route && m.route.every(z => roundAreas.has(z))) a += 1;
      if (a) bump(m, tier, a);
    });
    roundAreas = new Set();
  });
  Pf.hooks.match.push(mf => { each((m, tier) => { if (m.on && m.on.match) { const a = +m.on.match(mf) || 0; if (a) bump(m, tier, a); } }); matchAreas = new Set(); });
  function onVisit(area) {
    if (!area) return; const M = state(); roundAreas.add(area);
    const isNew = !matchAreas.has(area); matchAreas.add(area);
    if (!M.weekAreas.includes(area)) M.weekAreas.push(area);
    if (!M.everAreas.includes(area)) M.everAreas.push(area);
    if (!isNew) return;
    each((m, tier) => {
      if (m.max === 'matchAreas') bump(m, tier, 0, matchAreas.size);
      if (m.max === 'weekAreas') bump(m, tier, 0, M.weekAreas.length);
      if (m.max === 'everAreas') bump(m, tier, 0, M.everAreas.length);
      if (m.mroute && m.mroute.every(z => matchAreas.has(z))) bump(m, tier, 1);
    });
    Pf.save();
  }
  // ---- KARRIERE-fanen ----
  function left(to) { const ms = to - Date.now(), h = Math.floor(ms / 3.6e6), mm = Math.floor(ms % 3.6e6 / 6e4); return h >= 24 ? Math.floor(h / 24) + ' d ' + (h % 24) + ' t' : h + ' t ' + mm + ' m'; }
  function render() {
    const A = active(), M = state(), now = new Date();
    const nd = new Date(now); nd.setHours(24, 0, 0, 0); const nw = new Date(weekKey(now) + 'T00:00:00'); nw.setDate(nw.getDate() + 7);
    const card = (m, tier) => { const p = M.prog[m.id] || 0, done = !!M.done[m.id], [xp, c] = REW[tier];
      return `<div class="ms-card${done ? ' done' : ''}"><div class="ms-t">${esc(txt(m))}</div><div class="ms-bar"><i style="width:${(100 * p / m.n).toFixed(1)}%"></i></div>
        <div class="ms-f"><span>${done ? '✓ FULDFØRT' : p + ' / ' + m.n}</span><em>+${xp} XP · +${c} mønter</em></div></div>`; };
    const sDone = SEASON.list.filter(m => M.done[m.id]).length;
    return `<div class="ms-wrap">
      <section><h3 class="ms-h">DAGLIGE <small>nye om ${left(nd)}</small><span class="ms-coins"><b>${Pf.data.coins || 0}</b> MØNTER</span></h3><div class="ms-row">${A.d.map(m => card(m, 'd')).join('')}</div></section>
      <section><h3>UGENTLIGE <small>nye om ${left(nw)}</small></h3><div class="ms-row">${A.w.map(m => card(m, 'w')).join('')}</div></section>
      <section><h3>${SEASON.name} <small>${sDone} / ${SEASON.list.length} · slutter ${SEASON.end.split('-').reverse().join('/')} · belønning: titlen “${esc(SEASON.reward.title[1])}” + profilkort</small></h3>
        <div class="ms-grid">${SEASON.list.map(m => card(m, 's')).join('')}</div></section></div>`;
  }
  Pf.addTab('missioner', 'MISSIONER', render);
  return { onVisit, render, active };
}
