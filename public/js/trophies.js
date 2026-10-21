// ==========================================================================
// White Dust · v26.6 TROFÆER – sjove præstationer på banerne, mange i tre trin (bronze · sølv · guld), nogle hemmelige.
//   Tælles ud fra rundens fakta (våben, rum, site, etagen over, i luften, lav HP, afstand, clutch …), kampens fakta og
//   de områder man selv besøger. Hvert trin giver XP; guld låser et badge op. Trofævæggen vises i KARRIERE (og i hideout'en).
// createTrophies({ Profile, esc }) -> { onVisit(area), list, unlockedCount() }
// ==========================================================================
export function createTrophies(o) {
  const Pf = o.Profile, esc = o.esc;
  const BASE = ['Kryptgangen', 'Kryptnedgangen', 'Kedelrummet', 'Mørkerummet', 'Mørkekammeret', 'Tunnelerne', 'Tunnelerne vest', 'Tunnelerne hjørne', 'Trappehallen'];
  const zk = (zs) => k => zs.includes(k.at) || zs.includes(k.vt);
  // c: tæller-id · tiers: grænser · kill/round/match/visit: hvad der tæller
  const T = [
    { id: 'heights', name: 'Master of Heights', desc: 'Drab fra etagen over (mindst 1,4 m højere end offeret)', tiers: [5, 25, 100], kill: k => k.dy >= 1.4, icon: '⇣' },
    { id: 'kartograf', name: 'Kartograf', desc: 'Besøg alle områder på bureau', tiers: [15, 30, 40], visit: true, icon: '⌖' },
    { id: 'kaelder', name: 'Kældermennesket', desc: 'Drab i kælderen (Kryptgang, Kedelrum, Mørkerummet, Tunnelerne, Trappehal)', tiers: [10, 50, 200], kill: zk(BASE), icon: '▼' },
    { id: 'kaffe', name: 'Kaffepause', desc: 'Drab i Kaffebaren', tiers: [5, 20, 60], kill: zk(['Kaffebaren']), icon: '☕' },
    { id: 'elevator', name: 'Elevatormusik', desc: 'Drab i Elevatorlobbyen eller Atriet', tiers: [10, 40, 120], kill: zk(['Elevatorlobbyen', 'Atriet']), icon: '♫' },
    { id: 'tag', name: 'Tagterrassens konge', desc: 'Drab på Tagterrassen eller Helipad-trappen', tiers: [5, 20, 60], kill: zk(['Tagterrassen', 'Helipad-trappen']), icon: '⌂' },
    { id: 'server', name: 'Systemadministrator', desc: 'Drab i A – Serverhallen eller Kontrolrummet', tiers: [10, 40, 120], kill: k => k.site === 'A' || zk(['Kontrolrummet'])(k), icon: '▤' },
    { id: 'vaaben', name: 'Våbenkammerets vogter', desc: 'Drab på B-sitet', tiers: [10, 40, 120], kill: k => k.site === 'B', icon: '⛨' },
    { id: 'hs', name: 'Headhunter', desc: 'Headshots', tiers: [25, 100, 300], kill: k => k.hs, icon: '◎' },
    { id: 'knife', name: 'Kniven i ryggen', desc: 'Knivdrab', tiers: [1, 10, 30], kill: k => k.w === 'knife', icon: '†' },
    { id: 'air', name: 'Luftbåren', desc: 'Drab mens du er i luften', tiers: [1, 10, 30], kill: k => k.air, icon: '⤴' },
    { id: 'lo', name: 'På et hængende hår', desc: 'Drab med 25 HP eller mindre', tiers: [3, 15, 50], kill: k => k.lo, icon: '♥' },
    { id: 'long', name: 'Langdistance', desc: 'Drab på over 40 meters afstand', tiers: [1, 10, 30], kill: k => k.d >= 40, icon: '⟷' },
    { id: 'ace', name: 'Ingen nåde', desc: 'ACE – 5 drab i én runde', tiers: [1, 3, 10], round: r => (r.kills || []).length >= 5 ? 1 : 0, icon: '✦' },
    { id: 'clutch', name: 'Sidste mand', desc: 'Vind runder som sidste i live på holdet', tiers: [3, 15, 50], round: r => r.clutch ? 1 : 0, icon: '☗' },
    { id: 'plant', name: 'Bombemand', desc: 'Plant bomben', tiers: [5, 25, 100], round: r => r.plant ? 1 : 0, icon: '✹' },
    { id: 'defuse', name: 'Den røde ledning', desc: 'Desarmér bomben', tiers: [3, 15, 50], round: r => r.defuse ? 1 : 0, icon: '✂' },
    { id: 'mvp', name: 'MVP-samler', desc: 'Rundens MVP', tiers: [5, 30, 100], round: r => r.mvp ? 1 : 0, icon: '★' },
    { id: 'matches', name: 'Veteran', desc: 'Spillede kampe', tiers: [10, 50, 200], match: () => 1, icon: '⚑' },
    { id: 'wins', name: 'Sejrherre', desc: 'Vundne kampe', tiers: [5, 25, 100], match: m => m.won ? 1 : 0, icon: '♛' },
    { id: 'bounty', name: 'Dusørjæger', desc: 'Stop en spiller med bounty på hovedet', tiers: [1, 10, 30], kill: k => k.bty > 0, icon: '☠' },
    { id: 'wanted', name: 'Eftersøgt', desc: 'Bliv selv Bounty Target (3 drab i træk)', tiers: [1], round: r => r.bounty ? 1 : 0, secret: true, icon: '⚠' },
    { id: 'vertigo', name: 'Vertigo', desc: 'Tre drab fra etagen over i én runde', tiers: [1], round: r => (r.kills || []).filter(k => k.dy >= 1.4).length >= 3 ? 1 : 0, secret: true, icon: '⇊' },
    { id: 'route', name: 'Gennem labyrinten', desc: 'Kryptgangen, Trappehallen, Kedelrummet og Mørkerummet i samme runde', tiers: [1], roundVisit: ['Kryptgangen', 'Trappehallen', 'Kedelrummet', 'Mørkerummet'], secret: true, icon: '⌬' },
    { id: 'pistolace', name: 'Revolverhelt', desc: 'Tre pistoldrab i én runde', tiers: [1], round: r => (r.kills || []).filter(k => { const d = window.WD.WEAPONS[k.w]; return d && d.slot === 2; }).length >= 3 ? 1 : 0, secret: true, icon: '⌐' },
    { id: 'samler', name: 'Trofæjæger', desc: 'Lås trofætrin op', tiers: [10, 30, 60], meta: true, icon: '🏆' }
  ];
  const TIERN = ['BRONZE', 'SØLV', 'GULD'], TIERC = ['#c07a45', '#c3c9d0', '#e4ae39'], XPT = [400, 900, 2000];
  for (const t of T) Pf.registerExtra('badge', 'tr_' + t.id, t.icon + ' ' + t.name);
  const st = () => { const D = Pf.data; D.tr = D.tr || { c: {}, got: {}, areas: [] }; return D.tr; };
  const tierOf = t => { const v = st().c[t.id] || 0; let n = 0; for (const g of t.tiers) if (v >= g) n++; return n; };
  const unlockedCount = () => T.filter(t => !t.meta).reduce((a, t) => a + tierOf(t), 0);
  function add(t, amt, setTo) {
    const S = st(), before = tierOf(t); S.c[t.id] = setTo !== undefined ? Math.max(S.c[t.id] || 0, setTo) : (S.c[t.id] || 0) + amt;
    const after = tierOf(t);
    for (let i = before; i < after; i++) {
      const single = t.tiers.length === 1, tn = single ? 'GULD' : TIERN[i];
      S.got[t.id + ':' + i] = Date.now();
      Pf.toast('TROFÆ · ' + tn, t.name, single ? t.desc : t.tiers[i] + ' × ' + t.desc.toLowerCase());
      Pf.addXP('TROFÆ', [[t.name + (single ? '' : ' (' + tn.toLowerCase() + ')'), XPT[single ? 2 : i]]]);
      if (i === t.tiers.length - 1) Pf.data.owned['badge:tr_' + t.id] = 1;
    }
    if (after > before && !t.meta) { const m = T.find(x => x.meta); add(m, 0, unlockedCount()); }
  }
  let roundAreas = new Set();
  Pf.hooks.round.push(rf => {
    for (const t of T) {
      if (t.kill) { const n = (rf.kills || []).filter(t.kill).length; if (n) add(t, n); }
      if (t.round) { const n = t.round(rf); if (n) add(t, n); }
      if (t.roundVisit && t.roundVisit.every(z => roundAreas.has(z))) add(t, 1);
    }
    roundAreas = new Set(); Pf.save();
  });
  Pf.hooks.match.push(mf => { for (const t of T) if (t.match) { const n = t.match(mf); if (n) add(t, n); } Pf.save(); });
  function onVisit(area) {
    if (!area) return; roundAreas.add(area); const S = st();
    if (!S.areas.includes(area)) { S.areas.push(area); add(T.find(t => t.id === 'kartograf'), 0, S.areas.length); Pf.save(); }
  }
  // ---- trofævæggen ----
  function cup(n, single) {
    const col = n ? (single ? TIERC[2] : TIERC[n - 1]) : '#b9bcc2';
    return `<svg class="tr-cup" viewBox="0 0 40 44" width="40" height="44"><path d="M10 4h20v8c0 7-4.5 12-10 12S10 19 10 12z" fill="${col}" stroke="#0a0a0a" stroke-width="2.4"/>
      <path d="M10 7H4c0 6 3 9 7 9M30 7h6c0 6-3 9-7 9" fill="none" stroke="#0a0a0a" stroke-width="2.4"/><path d="M17 24h6v7h-6z M12 31h16v6H12z" fill="${col}" stroke="#0a0a0a" stroke-width="2.4"/>
      ${n ? `<path d="M15 9l3 0" stroke="rgba(255,255,255,.7)" stroke-width="2"/>` : ''}</svg>`;
  }
  function render() {
    const S = st(), total = T.reduce((a, t) => a + t.tiers.length, 0), got = Object.keys(S.got).length;
    return `<div class="tr-wrap"><h3 class="ms-h">TROFÆVÆG <small>${got} / ${total} trin låst op · guld giver et badge til dit profilkort</small></h3>
      <div class="tr-grid">${T.map(t => { const n = tierOf(t), v = S.c[t.id] || 0, single = t.tiers.length === 1, hidden = t.secret && !n, next = t.tiers[Math.min(n, t.tiers.length - 1)];
        return `<div class="tr-item${n ? ' got t' + (single ? 3 : n) : ''}${hidden ? ' secret' : ''}">${cup(n, single)}<div class="tr-i"><b>${hidden ? 'Hemmeligt trofæ' : esc(t.name)}</b>
          <span>${hidden ? 'Låses op ved en særlig præstation' : esc(t.desc)}</span>
          ${single || hidden ? '' : `<div class="tr-t">${t.tiers.map((g, i) => `<i class="${n > i ? 'on' : ''}" style="--tc:${TIERC[i]}">${g}</i>`).join('')}</div>`}
          ${n < t.tiers.length && !hidden ? `<div class="tr-bar"><em style="width:${Math.min(100, 100 * v / next).toFixed(1)}%"></em></div><small>${Math.min(v, next)} / ${next}</small>` : (n ? '<small class="ok">✓ FULDFØRT</small>' : '')}</div></div>`; }).join('')}</div></div>`;
  }
  Pf.addTab('trofaeer', 'TROFÆER', render);
  return { onVisit, list: T, tierOf, unlockedCount, cup };
}
