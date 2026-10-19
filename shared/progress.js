/* ==========================================================================
   WHITE DUST – PROGRESSION (delt: server + klient)  · v26.6
   Serveren sender kun FAKTA om runden/kampen (drab med våben, headshot, afstand, højdeforskel, rum, plant, desarmering,
   sejr, MVP). Herfra regnes XP, levels og ranks – og senere missioner, trofæer og mastery – ud fra de samme fakta.
   Rank følger level: Bronze → Sølv → Guld → Platin → Diamant (I–III pr. 10 levels) → Elite (50+).
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WDP = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const MAX_LEVEL = 100;
  // XP der skal til for at gå fra level L til L+1 (blødt stigende, loft 4000)
  const xpStep = L => Math.min(4000, 800 + 90 * (L - 1));
  const XP_AT = [0, 0]; for (let L = 1; L < MAX_LEVEL; L++) XP_AT[L + 1] = XP_AT[L] + xpStep(L);
  function levelOf(xp) {
    xp = Math.max(0, xp | 0); let L = 1;
    while (L < MAX_LEVEL && xp >= XP_AT[L + 1]) L++;
    const into = xp - XP_AT[L], need = L < MAX_LEVEL ? xpStep(L) : 1;
    return { level: L, into, need, frac: L < MAX_LEVEL ? into / need : 1 };
  }
  const RANKS = [
    { id: 'bronze', name: 'BRONZE', col: '#c07a45', from: 1 }, { id: 'silver', name: 'SØLV', col: '#c3c9d0', from: 10 },
    { id: 'gold', name: 'GULD', col: '#e4ae39', from: 20 }, { id: 'plat', name: 'PLATIN', col: '#6fd8cf', from: 30 },
    { id: 'diamond', name: 'DIAMANT', col: '#69a6ff', from: 40 }, { id: 'elite', name: 'ELITE', col: '#ff2b1f', from: 50 }
  ];
  function rankOf(level) {
    let r = RANKS[0]; for (const k of RANKS) if (level >= k.from) r = k;
    const elite = r.id === 'elite', sub = elite ? Math.min(5, 1 + Math.floor((level - 50) / 10)) : 1 + Math.floor(((level - r.from) % 10) / 3.34);
    const roman = ['I', 'II', 'III', 'IV', 'V'][Math.max(0, Math.min(4, sub - 1))];
    return Object.assign({}, r, { sub, label: r.name + ' ' + roman });
  }
  // ---- oplåsninger (kun kosmetik: titler, profilkort, badges) ----
  const TITLES = [
    [1, 'rekrut', 'Rekrut'], [3, 'praktikant', 'Praktikant'], [5, 'mellemleder', 'Mellemleder'], [7, 'trappeloeber', 'Trappeløber'],
    [10, 'kaffebar', 'Kaffebar-stamgæst'], [12, 'elevator', 'Elevatorsurfer'], [15, 'kontorrotte', 'Kontorrotte'], [18, 'atrium', 'Atrium-akrobat'],
    [20, 'serverhals', 'Serverhals'], [25, 'tagterrasse', 'Tagterrasse-legende'], [30, 'penthouse', 'Penthouse-ejer'], [35, 'direktoer', 'Direktør'],
    [40, 'formand', 'Bestyrelsesformand'], [45, 'usynlig', 'Den Usynlige'], [50, 'elite', 'Elite-operatør'], [60, 'myte', 'Bureau-myte'],
    [75, 'ikon', 'Ikon'], [100, 'whitedust', 'White Dust']
  ];
  const CARDS = [   // profilkort-baggrunde (CSS), i spillets stil
    [1, 'paper', 'Papir', 'linear-gradient(135deg,#f4f4f2,#dcdad4)'],
    [4, 'beton', 'Beton', 'repeating-linear-gradient(0deg,rgba(0,0,0,.04) 0 2px,transparent 2px 9px),linear-gradient(160deg,#bdbbb5,#8f8d88)'],
    [9, 'valnoed', 'Valnød', 'repeating-linear-gradient(90deg,rgba(0,0,0,.18) 0 3px,transparent 3px 14px),linear-gradient(135deg,#5a3a24,#2c1a10)'],
    [14, 'skyline', 'Nat-skyline', 'linear-gradient(0deg,#0b0f18 0 35%,transparent 35%),repeating-linear-gradient(90deg,#141c2c 0 18px,#0b0f18 18px 26px),linear-gradient(180deg,#1b2a48,#0b0f18)'],
    [22, 'server', 'Serverhallen', 'repeating-linear-gradient(90deg,rgba(80,160,255,.18) 0 2px,transparent 2px 22px),repeating-linear-gradient(0deg,rgba(80,255,160,.12) 0 1px,transparent 1px 6px),linear-gradient(135deg,#0a1220,#05080e)'],
    [28, 'regn', 'Regn på glas', 'repeating-linear-gradient(100deg,rgba(255,255,255,.08) 0 1px,transparent 1px 11px),linear-gradient(170deg,#2a3440,#10161d)'],
    [33, 'neon', 'Neon', 'linear-gradient(120deg,#12021c,#2a0636 45%,#ff2b6e 46%,#12021c 47%),#12021c'],
    [42, 'guldmarmor', 'Guldmarmor', 'repeating-linear-gradient(35deg,rgba(228,174,57,.35) 0 2px,transparent 2px 30px),linear-gradient(135deg,#f2efe8,#c9c3b6)'],
    [55, 'blueprint', 'Blueprint', 'repeating-linear-gradient(0deg,rgba(255,255,255,.12) 0 1px,transparent 1px 16px),repeating-linear-gradient(90deg,rgba(255,255,255,.12) 0 1px,transparent 1px 16px),#123a74'],
    [70, 'alarm', 'Rød alarm', 'repeating-linear-gradient(45deg,#ff2b1f 0 14px,#0a0a0a 14px 28px)'],
    [90, 'elite', 'Elite sort', 'radial-gradient(circle at 70% 30%,rgba(255,43,31,.35),transparent 55%),linear-gradient(135deg,#111,#000)']
  ];
  const BADGES = [[10, 'lvl10', 'Level 10'], [25, 'lvl25', 'Level 25'], [50, 'lvl50', 'Level 50 · Elite'], [100, 'lvl100', 'Level 100']];
  function unlocksAt(level) {
    const out = [];
    for (const [l, id, name] of TITLES) if (l === level) out.push({ kind: 'title', id, name });
    for (const [l, id, name] of CARDS) if (l === level) out.push({ kind: 'card', id, name });
    for (const [l, id, name] of BADGES) if (l === level) out.push({ kind: 'badge', id, name });
    if (RANKS.some(r => r.from === level)) out.push({ kind: 'rank', id: rankOf(level).id, name: rankOf(level).name });
    return out;
  }
  // ---- XP fra fakta ----
  // rf: { won, mvp, alive, plant, defuse, kills: [{ w, hs, d, dy, at, vt }], reason, side, n }
  const XP = { roundWin: 120, roundLoss: 45, kill: 55, hs: 20, knife: 60, multi: [0, 0, 40, 90, 160, 260], plant: 70, defuse: 110, mvp: 90, survive: 25, high: 25,
               matchWin: 600, matchPlay: 250, mvpMatch: 40 };
  function roundXP(rf) {
    const L = [];
    L.push([rf.won ? 'Runde vundet' : 'Runde spillet', rf.won ? XP.roundWin : XP.roundLoss]);
    const ks = rf.kills || [];
    if (ks.length) L.push([ks.length + ' drab', ks.length * XP.kill]);
    const hs = ks.filter(k => k.hs).length; if (hs) L.push([hs + ' headshot' + (hs > 1 ? 's' : ''), hs * XP.hs]);
    const kn = ks.filter(k => k.w === 'knife').length; if (kn) L.push(['Knivdrab', kn * XP.knife]);
    const hi = ks.filter(k => k.dy >= 1.4).length; if (hi) L.push(['Drab fra etagen over', hi * XP.high]);
    if (ks.length >= 2) L.push([['', '', 'Dobbeltdrab', 'Tredobbelt drab', '4 drab i én runde', 'ACE'][Math.min(5, ks.length)], XP.multi[Math.min(5, ks.length)]]);
    const by = ks.filter(k => k.bty).length; if (by) L.push(['Bounty indkasseret', by * 250]);
    if (rf.plant) L.push(['Bomben plantet', XP.plant]);
    if (rf.defuse) L.push(['Bomben desarmeret', XP.defuse]);
    if (rf.mvp) L.push(['Rundens MVP', XP.mvp]);
    if (rf.alive && rf.won) L.push(['Overlevede', XP.survive]);
    return L;
  }
  function matchXP(mf) {
    const L = [[mf.won ? 'Kamp vundet' : 'Kamp spillet', mf.won ? XP.matchWin : XP.matchPlay]];
    if (mf.mvps) L.push([mf.mvps + ' × MVP i kampen', mf.mvps * XP.mvpMatch]);
    return L;
  }
  return { MAX_LEVEL, XP_AT, xpStep, levelOf, RANKS, rankOf, TITLES, CARDS, BADGES, unlocksAt, XP, roundXP, matchXP };
});
