// ==========================================================================
// White Dust · v26.6 FRAKTIONER – vælg side i kampen om bureau. Banen er delt i 10 bydele; drab, plants og desarmeringer
//   i en bydel giver din fraktion indflydelse dér. Den fraktion med mest indflydelse i en bydel kontrollerer den (sæsonkortet).
//   Ingen server i skyen: hver spiller fører et regnskab for ugen (én post pr. spiller) og udveksler det med alle man spiller med,
//   så kortet vokser for hver kamp. Ved ugeskifte gøres ugen op: belønning pr. bydel din fraktion holdt + bonus til ugens vinder.
// createFactions({ Profile, esc, drawMap(canvas, colorAt, labels) }) -> { pubPart(), merge(L), districtOf(area), cur(), summary }
// ==========================================================================
export function createFactions(o) {
  const Pf = o.Profile, esc = o.esc;
  const F = [
    { id: 'kartel', name: 'AURUM', col: '#d08a3a', motto: 'Rigdom er magt', sym: 'A' },
    { id: 'klan', name: 'VANTA', col: '#2fbf71', motto: 'Ingen lys, ingen spor', sym: 'V' },
    { id: 'krypt', name: 'NOCTURNE', col: '#8a5cff', motto: 'Natten tilhører os', sym: 'N' }
  ];
  const DIST = [
    ['garage', 'GARAGEN', ['Parkeringskælder', 'Varegården', 'A Rampe', 'A Forplads']],
    ['server', 'SERVERHALLEN', ['Kontrolrummet', 'A – Serverhallen', 'Long A top', 'Balkonen']],
    ['arch', 'SØJLEGANGEN', ['Søjlegangen A', 'Arch', 'Top Mid', 'Connector A']],
    ['kaffe', 'KAFFEBAREN', ['Long A', 'Rampen', 'Kaffebaren', 'Mid Door']],
    ['atrium', 'ATRIET', ['Atriet', 'Elevatorlobbyen', 'B Halls øst', 'B Halls lomme', 'B Halls vest']],
    ['tag', 'TAGET', ['Receptionen', 'Helipad-trappen', 'Tagterrassen', 'Vestpassagen']],
    ['kaelder', 'KÆLDEREN', ['Trappehallen', 'Kryptgangen', 'Kedelrummet', 'Kryptnedgangen']],
    ['vent', 'VENTILATIONEN', ['Vent', 'Catwalk øst', 'Vent-gangen', 'Catwalk']],
    ['vaaben', 'VÅBENKAMMERET', ['Main B', 'Storage', 'Back B', 'Pillars B', 'B – Våbenkammeret']],
    ['dark', 'DARK', ['Tunnels', 'Tunnels vest', 'Tunnels hjørne', 'Dark', 'Dark-kammeret']]
  ];
  const AREA = {}; for (const [id, , L] of DIST) for (const a of L) AREA[a] = id;
  const districtOf = a => AREA[a] || null;
  const MIN = 25, PTS = { kill: 10, hs: 3, plant: 15, defuse: 20, win: 6 };
  for (const f of F) Pf.registerExtra('title', 'fx_' + f.id, f.name.charAt(0) + f.name.slice(1).toLowerCase());
  Pf.registerExtra('title', 'fx_herre', 'Bydelens herre'); Pf.registerExtra('badge', 'fx_uge', '⚑ Ugens fraktion');

  // uge = mandagens dato
  const weekKey = (t) => { const d = new Date(t || Date.now()); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const st = () => { const D = Pf.data; D.fx = D.fx || { f: null, week: weekKey(), L: {}, season: {}, hist: [] }; return D.fx; };
  const facOf = id => F.find(f => f.id === id) || null;
  const sumOf = e => Object.values(e.d || {}).reduce((a, b) => a + b, 0);
  function myEntry() { const S = st(), u = Pf.data.uid; if (!S.f) return null; const e = S.L[u] = S.L[u] || { f: S.f, d: {}, w: S.week }; e.f = S.f; e.n = (o.name && o.name()) || 'Spiller'; e.w = S.week; return e; }
  function control(L) {
    const tot = {}; for (const [id] of DIST) tot[id] = {};
    for (const e of Object.values(L || {})) { if (!facOf(e.f)) continue; for (const [d, v] of Object.entries(e.d || {})) if (tot[d]) tot[d][e.f] = (tot[d][e.f] || 0) + v; }
    const ctrl = {}; for (const [id] of DIST) { const t = tot[id], best = Object.entries(t).sort((a, b) => b[1] - a[1]); ctrl[id] = best[0] && best[0][1] >= MIN && (!best[1] || best[1][1] < best[0][1]) ? best[0][0] : null; }
    return { tot, ctrl };
  }
  // ugeskifte: gør den gamle uge op
  function rollWeek() {
    const S = st(), now = weekKey(); if (S.week === now) return;
    const { ctrl } = control(S.L), cnt = {}; for (const f of Object.values(ctrl)) if (f) cnt[f] = (cnt[f] || 0) + 1;
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]), winner = top[0] && (!top[1] || top[1][1] < top[0][1]) ? top[0][0] : null;
    if (winner) S.season[winner] = (S.season[winner] || 0) + 1;
    S.hist.unshift({ week: S.week, ctrl, winner }); S.hist = S.hist.slice(0, 12);
    const mine = S.f ? (cnt[S.f] || 0) : 0, me = S.L[Pf.data.uid];
    if (S.f && me && sumOf(me) > 0) {
      const lines = []; if (mine) lines.push([mine + ' bydel' + (mine > 1 ? 'e' : '') + ' holdt', mine * 150]);
      if (winner === S.f) { lines.push(['Ugens fraktion', 1000]); Pf.data.owned['badge:fx_uge'] = 1; Pf.data.owned['title:fx_herre'] = 1; }
      lines.push(['Indflydelse bidraget', Math.min(600, sumOf(me))]);
      const coins = mine * 25 + (winner === S.f ? 200 : 0) + 30; Pf.data.coins = (Pf.data.coins || 0) + coins;
      Pf.toast('FRAKTION · UGEN ER GJORT OP', winner ? facOf(winner).name + ' vandt ugen' : 'Ingen vinder', '+' + coins + ' mønter');
      Pf.addXP('FRAKTIONENS UGE', lines);
    }
    S.week = now; S.L = {}; Pf.save();
  }
  rollWeek();
  function add(d, v) { if (!d || !v) return; const e = myEntry(); if (!e) return; e.d[d] = (e.d[d] || 0) + v; }
  Pf.hooks.round.push(rf => {
    rollWeek(); if (!st().f) return;
    const ks = rf.kills || [], hit = {};
    for (const k of ks) { const d = districtOf(k.at) || districtOf(k.vt); if (!d) continue; const v = PTS.kill + (k.hs ? PTS.hs : 0); add(d, v); hit[d] = (hit[d] || 0) + v; }
    if (rf.plant) add(rf.site === 'B' ? 'vaaben' : 'server', PTS.plant);
    if (rf.defuse) add(rf.site === 'B' ? 'vaaben' : 'server', PTS.defuse);
    if (rf.won) { const d = Object.entries(hit).sort((a, b) => b[1] - a[1])[0]; if (d) add(d[0], PTS.win); }
    Pf.save();
  });
  // ---- udveksling ----
  function pubPart() { rollWeek(); const S = st(); myEntry(); const L = {}; Object.entries(S.L).filter(([u, e]) => e.w === S.week && sumOf(e) > 0).sort((a, b) => sumOf(b[1]) - sumOf(a[1])).slice(0, 120).forEach(([u, e]) => { L[u] = { f: e.f, d: e.d, n: e.n, w: e.w }; }); return { w: S.week, L }; }   // højst 120 poster (beskedgrænse)
  function merge(part) {
    if (!part || typeof part !== 'object' || !part.L) return; rollWeek(); const S = st(); if (part.w !== S.week) return;
    let n = 0;
    for (const [u, e] of Object.entries(part.L)) {
      if (u === Pf.data.uid || !/^[a-z0-9]{4,16}$/.test(u) || !e || !facOf(e.f) || typeof e.d !== 'object') continue;
      const d = {}; for (const [k, v] of Object.entries(e.d)) if (DIST.some(x => x[0] === k)) d[k] = Math.max(0, Math.min(5000, v | 0));
      const ne = { f: e.f, d, n: String(e.n || '').slice(0, 20), w: S.week }, old = S.L[u];
      if (!old || sumOf(ne) > sumOf(old)) { S.L[u] = ne; n++; }
    }
    const keys = Object.keys(S.L); if (keys.length > 200) keys.sort((a, b) => sumOf(S.L[a]) - sumOf(S.L[b])).slice(0, keys.length - 200).forEach(k => { if (k !== Pf.data.uid) delete S.L[k]; });
    if (n) Pf.save();
  }
  // ---- emblem ----
  const emblem = (f, px) => { const c = facOf(f); if (!c) return ''; const s = px || 40;
    return `<svg class="fx-emb" width="${s}" height="${s}" viewBox="0 0 40 40"><path d="M20 2 L36 11 V29 L20 38 L4 29 V11 Z" fill="${c.col}" stroke="#0a0a0a" stroke-width="3"/><text x="20" y="27" text-anchor="middle" font-size="18" font-weight="900" font-family="Archivo Black, Arial Black" fill="#0a0a0a">${c.sym}</text></svg>`; };
  // ---- fanen ----
  function render() {
    rollWeek(); const S = st(), { tot, ctrl } = control(S.L), me = S.L[Pf.data.uid], cnt = {};
    for (const f of Object.values(ctrl)) if (f) cnt[f] = (cnt[f] || 0) + 1;
    const ends = new Date(S.week + 'T00:00:00'); ends.setDate(ends.getDate() + 7); const days = Math.max(0, Math.ceil((ends - Date.now()) / 864e5));
    const players = Object.keys(S.L).length, canSwitch = S.sw !== S.week;
    if (!S.f) return `<div class="fx-wrap"><h3 class="ms-h">VÆLG FRAKTION <small>kæmp om bydelene på bureau · regnskabet deles med alle du spiller med</small></h3>
      <div class="fx-pick">${F.map(f => `<button class="fx-card" data-fxpick="${f.id}" style="--fc:${f.col}">${emblem(f.id, 84)}<b>${f.name}</b><span>${f.motto}</span><em>VÆLG</em></button>`).join('')}</div>
      <p class="fx-note">Drab i en bydel giver din fraktion indflydelse dér (headshot ekstra, plant/desarmering på sitet, sejr i den bydel du kæmpede mest i). Mest indflydelse = kontrol. Ugen gøres op mandag: XP og mønter pr. bydel din fraktion holdt, og ekstra til ugens vinder.</p></div>`;
    const my = facOf(S.f);
    return `<div class="fx-wrap"><h3 class="ms-h">SÆSONKORT · UGE ${S.week.slice(5).split('-').reverse().join('/')} <small>gøres op om ${days} d · ${players} i regnskabet</small></h3>
      <div class="fx-grid"><div class="fx-mapbox"><canvas id="fxMap" width="900" height="720"></canvas></div>
      <div class="fx-side"><div class="fx-me" style="--fc:${my.col}">${emblem(my.id, 56)}<div><small>DIN FRAKTION</small><b>${my.name}</b><span>${me ? sumOf(me) : 0} indflydelse fra dig i denne uge</span></div></div>
        <h3>STILLING</h3><ul class="fx-stand">${F.map(f => `<li style="--fc:${f.col}" class="${f.id === S.f ? 'me' : ''}">${emblem(f.id, 26)}<b>${f.name}</b><em>${cnt[f.id] || 0} bydele</em><small>${S.season[f.id] || 0} uger vundet</small></li>`).join('')}</ul>
        <h3>BYDELE</h3><ul class="fx-dist">${DIST.map(([id, name]) => { const c = facOf(ctrl[id]), t = tot[id], all = Object.values(t).reduce((a, b) => a + b, 0) || 1;
          return `<li><b>${name}</b><span class="fx-bar">${F.map(f => `<i style="width:${(100 * (t[f.id] || 0) / all).toFixed(1)}%;background:${f.col}"></i>`).join('')}</span><em style="color:${c ? c.col : '#8a8a86'}">${c ? c.name : 'UMARKERET'}</em><small>${me && me.d[id] ? '+' + me.d[id] : ''}</small></li>`; }).join('')}</ul>
        ${canSwitch ? `<button class="sh-btn" data-fxswitch>SKIFT FRAKTION (1 GANG PR. UGE · NULSTILLER DIN UGE)</button>` : ''}</div></div></div>`;
  }
  function after(hub) {
    const cv = hub.querySelector('#fxMap'); if (!cv || !o.drawMap) return; const { ctrl } = control(st().L);
    const lab = []; for (const [id, name, L] of DIST) lab.push({ id, name, areas: L, col: (facOf(ctrl[id]) || { col: null }).col });
    o.drawMap(cv, AREA, lab);
  }
  function click(b) {
    const S = st();
    if (b.dataset.fxpick) { S.f = b.dataset.fxpick; Pf.data.owned['title:fx_' + S.f] = 1; myEntry(); Pf.save(); Pf.toast('FRAKTION', facOf(S.f).name, 'Titel låst op: ' + facOf(S.f).name.charAt(0) + facOf(S.f).name.slice(1).toLowerCase()); o.onChange && o.onChange(); Pf.render(); }
    if (b.dataset.fxswitch !== undefined) { S.sw = S.week; delete S.L[Pf.data.uid]; S.f = null; Pf.save(); Pf.render(); }
  }
  Pf.addTab('fraktion', 'FRAKTION', render, click, after);
  return { pubPart, merge, districtOf, control, cur: () => st().f, fac: facOf, emblem, F, DIST };
}
