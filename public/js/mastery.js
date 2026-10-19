// ==========================================================================
// White Dust · v26.6 MASTERY – hvert våben og stykke udstyr har sit eget level (1–10) ud over spiller-levelet.
//   XP pr. drab med det (headshot, kniv, flere drab i runden, rundens MVP giver ekstra). Synlige belønninger som andre ser:
//   level 3 bronze-charm · level 6 sølv-charm · level 10 guld-charm + mastery-inspect (F: våbnet snurres rundt i hånden).
// createMastery({ Profile, esc, icon(id) }) -> { tierOf(id), levelOf(id), packed(), parse(str) }
// ==========================================================================
export function createMastery(o) {
  const Pf = o.Profile, esc = o.esc, WD = window.WD;
  const AT = [0, 500, 1200, 2200, 3500, 5200, 7300, 9800, 12800, 16500];   // XP for level 1..10
  const IDS = Object.keys(WD.WEAPONS).filter(id => { const w = WD.WEAPONS[id]; return w.kind === 'gun' || id === 'knife' || id === 'he' || id === 'molotov'; });
  const NAME = id => (WD.WEAPONS[id] || {}).name || id.toUpperCase();
  const st = () => { const D = Pf.data; D.mx = D.mx || {}; return D.mx; };
  const lvl = xp => { let L = 1; for (let i = 0; i < AT.length; i++) if (xp >= AT[i]) L = i + 1; return L; };
  const levelOf = id => lvl((st()[id] || {}).xp || 0);
  const tierOf = id => { const L = levelOf(id); return L >= 10 ? 3 : L >= 6 ? 2 : L >= 3 ? 1 : 0; };
  const TN = ['', 'BRONZE', 'SØLV', 'GULD'];
  function add(id, xp, kills, hs) {
    if (!WD.WEAPONS[id]) return; const S = st(), e = S[id] = S[id] || { xp: 0, k: 0, hs: 0 };
    const L0 = lvl(e.xp), t0 = tierOf(id); e.xp += xp; e.k += kills || 0; e.hs += hs || 0; const L1 = lvl(e.xp), t1 = tierOf(id);
    if (L1 > L0) Pf.toast('MASTERY · ' + NAME(id), 'Level ' + L1, t1 > t0 ? TN[t1] + '-charm låst op' + (t1 === 3 ? ' + mastery-inspect (F)' : '') : '');
    if (t1 > t0 && o.onTier) o.onTier(id, t1);
  }
  Pf.hooks.round.push(rf => {
    const ks = rf.kills || [], by = {};
    for (const k of ks) { const w = k.w === 'incgren' ? 'molotov' : k.w; (by[w] = by[w] || []).push(k); }
    for (const [w, L] of Object.entries(by)) {
      let xp = 0; for (const k of L) xp += (w === 'knife' ? 200 : 100) + (k.hs ? 40 : 0);
      if (L.length > 1) xp += 50 * (L.length - 1);
      if (rf.mvp && ks.length && ks[ks.length - 1].w === w) xp += 150;
      add(w, xp, L.length, L.filter(k => k.hs).length);
    }
    Pf.save();
  });
  // kompakt til de andre spillere: "ak47:3,usp:1" (kun våben med charm)
  const packed = () => IDS.map(id => [id, tierOf(id)]).filter(x => x[1]).map(x => x[0] + ':' + x[1]).join(',');
  const parse = s => { const m = {}; if (typeof s === 'string') for (const p of s.split(',')) { const [a, b] = p.split(':'); if (WD.WEAPONS[a]) m[a] = Math.max(0, Math.min(3, +b || 0)); } return m; };
  function render() {
    const S = st(), rows = IDS.slice().sort((a, b) => ((S[b] || {}).xp || 0) - ((S[a] || {}).xp || 0));
    return `<div class="mx-wrap"><h3 class="ms-h">MASTERY <small>level 3 bronze-charm · level 6 sølv-charm · level 10 guld-charm + mastery-inspect (F) – charms ses af alle</small></h3>
      <div class="mx-grid">${rows.map(id => { const e = S[id] || { xp: 0, k: 0, hs: 0 }, L = lvl(e.xp), t = tierOf(id), a = AT[L - 1], b = AT[Math.min(9, L)], f = L >= 10 ? 1 : (e.xp - a) / (b - a), ic = o.icon ? o.icon(id) : null;
        return `<div class="mx-item t${t}"><div class="mx-ic">${ic ? `<img src="${ic}">` : `<b>${esc(NAME(id))}</b>`}</div><div class="mx-i"><b>${esc(NAME(id))}</b><span>LEVEL ${L}${t ? ' · ' + TN[t] : ''}</span>
          <div class="mx-bar"><em style="width:${(f * 100).toFixed(1)}%"></em></div><small>${e.k} drab · ${e.hs} HS${L < 10 ? ' · ' + (b - e.xp) + ' XP til level ' + (L + 1) : ' · MESTER'}</small>
          <div class="mx-t">${[3, 6, 10].map((g, i) => `<i class="${L >= g ? 'on' : ''}" style="--tc:${['#c07a45', '#c3c9d0', '#e4ae39'][i]}">${g}</i>`).join('')}</div></div></div>`; }).join('')}</div></div>`;
  }
  Pf.addTab('mastery', 'MASTERY', render);
  return { tierOf, levelOf, packed, parse, IDS };
}
