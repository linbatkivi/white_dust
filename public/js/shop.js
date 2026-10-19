// ==========================================================================
// White Dust · v26.6 BUTIK – mønter optjenes i kampe og missioner og bruges KUN på kosmetik (ingen indflydelse på balancen):
//   eksklusive titler, profilkort, badges og navnefarver (ses af de andre i lobby og på scoreboard).
//   Dagens tilbud: 2 varer med rabat, valgt ud fra datoen (samme for alle). Senere: hideout-dekorationer (meldes ind med addItems()).
// createShop({ Profile, esc }) -> { addItems(list), priceOf(item), NAMECOL }
// ==========================================================================
export function createShop(o) {
  const Pf = o.Profile, esc = o.esc;
  const NAMECOL = { gold: ['Guld', '#e4ae39'], neon: ['Neon', '#ff2bd6'], ice: ['Is', '#7fe3ff'], toxic: ['Gift', '#8dff3a'], blood: ['Blod', '#ff2b1f'], ghost: ['Spøgelse', '#c9c9c9'] };
  const ITEMS = [
    { id: 'title:kaffehenter', kind: 'title', ref: 'kaffehenter', name: 'Kaffehenter', price: 300 },
    { id: 'title:elevatorkonge', kind: 'title', ref: 'elevatorkonge', name: 'Elevatorkongen', price: 500 },
    { id: 'title:spoegelse', kind: 'title', ref: 'spoegelse', name: 'Spøgelset fra Dark', price: 800 },
    { id: 'title:pilot', kind: 'title', ref: 'pilot', name: 'Helikopterpilot', price: 1200 },
    { id: 'title:wirecutter', kind: 'title', ref: 'wirecutter', name: 'Den røde ledning', price: 900 },
    { id: 'title:ceo', kind: 'title', ref: 'ceo', name: 'CEO of Clutch', price: 2000 },
    { id: 'card:guldregn', kind: 'card', ref: 'guldregn', name: 'Guldregn', price: 600, css: 'repeating-linear-gradient(105deg,rgba(255,215,90,.35) 0 2px,transparent 2px 13px),linear-gradient(160deg,#2a1d05,#0a0700)' },
    { id: 'card:kode', kind: 'card', ref: 'kode', name: 'Kode', price: 800, css: 'repeating-linear-gradient(90deg,rgba(80,255,140,.16) 0 1px,transparent 1px 9px),repeating-linear-gradient(0deg,rgba(80,255,140,.1) 0 2px,transparent 2px 7px),#031008' },
    { id: 'card:atriumnat', kind: 'card', ref: 'atriumnat', name: 'Atrium om natten', price: 900, css: 'radial-gradient(ellipse at 50% 120%,rgba(255,220,170,.55),transparent 55%),radial-gradient(circle at 50% 30%,transparent 30%,rgba(255,230,190,.35) 31%,transparent 33%),linear-gradient(180deg,#0b0d12,#1b1f27)' },
    { id: 'card:hijroed', kind: 'card', ref: 'hijroed', name: 'Hijacker-rød', price: 700, css: 'linear-gradient(115deg,#ff2b1f 0 38%,#0a0a0a 38% 41%,#3a0805 41%)' },
    { id: 'card:swatblaa', kind: 'card', ref: 'swatblaa', name: 'SWAT-blå', price: 700, css: 'linear-gradient(115deg,#1f6fff 0 38%,#0a0a0a 38% 41%,#06143a 41%)' },
    { id: 'card:tape', kind: 'card', ref: 'tape', name: 'Afspærring', price: 1100, css: 'repeating-linear-gradient(-30deg,#ffd23a 0 18px,#0a0a0a 18px 36px)' },
    { id: 'badge:kop', kind: 'badge', ref: 'kop', name: '☕ Kaffekop', price: 300 },
    { id: 'badge:kranie', kind: 'badge', ref: 'kranie', name: '☠ Kranie', price: 500 },
    { id: 'badge:krone', kind: 'badge', ref: 'krone', name: '♛ Krone', price: 1500 },
    { id: 'badge:diamant', kind: 'badge', ref: 'diamant', name: '◆ Diamant', price: 2500 },
    ...Object.entries(NAMECOL).map(([k, [n]], i) => ({ id: 'nc:' + k, kind: 'nc', ref: k, name: 'Navnefarve: ' + n, price: [1000, 1400, 1200, 1200, 900, 1600][i] }))
  ];
  for (const it of ITEMS) if (it.kind !== 'nc') Pf.registerExtra(it.kind, it.ref, it.name, it.css);
  const pad = n => String(n).padStart(2, '0'), d = new Date(), day = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  let h = 0; for (const c of 'shop' + day) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const deals = new Map(); for (let i = 0; i < 2; i++) { h = Math.imul(h ^ (h >>> 13), 2246822507) >>> 0; deals.set(ITEMS[h % ITEMS.length].id, [0.6, 0.75][i]); }
  const priceOf = it => Math.round(it.price * (deals.get(it.id) || 1) / 10) * 10;
  const owned = it => !!Pf.data.owned[it.id];
  function addItems(list) { for (const it of list) if (!ITEMS.some(x => x.id === it.id)) ITEMS.push(it); }
  function preview(it) {
    if (it.kind === 'card') return `<div class="sh-prev card" style="--card:${it.css}"></div>`;
    if (it.kind === 'nc') return `<div class="sh-prev nc" style="color:${NAMECOL[it.ref][1]}">${esc((o.name && o.name()) || 'Spiller')}</div>`;
    if (it.kind === 'badge') return `<div class="sh-prev badge"><span>${esc(it.name)}</span></div>`;
    if (it.kind === 'deco') return `<div class="sh-prev deco">${it.icon || '▣'}</div>`;
    return `<div class="sh-prev title"><small>TITEL</small>${esc(it.name)}</div>`;
  }
  function render() {
    const coins = Pf.data.coins || 0, groups = [['title', 'TITLER'], ['card', 'PROFILKORT'], ['badge', 'BADGES'], ['nc', 'NAVNEFARVER'], ['deco', 'HIDEOUT']];
    const cardHtml = it => { const own = owned(it), pr = priceOf(it), deal = deals.get(it.id), eq = it.kind === 'nc' ? Pf.data.nc === it.ref : Pf.data[it.kind] === it.ref;
      return `<div class="sh-item${own ? ' own' : ''}${deal ? ' deal' : ''}">${deal ? `<i class="sh-deal">−${Math.round((1 - deal) * 100)} %</i>` : ''}${preview(it)}<b>${esc(it.name)}</b>
        ${own ? (it.kind === 'deco' ? '<span class="sh-own">EJET · I HIDEOUT</span>' : `<button class="sh-btn ${eq ? 'on' : ''}" data-equip="${it.id}">${eq ? 'I BRUG' : 'BRUG'}</button>`)
              : `<button class="sh-btn buy" data-buy="${it.id}" ${coins < pr ? 'disabled' : ''}>${deal ? `<s>${it.price}</s> ` : ''}${pr} MØNTER</button>`}</div>`; };
    return `<div class="sh-wrap"><h3 class="ms-h">BUTIK <small>kun kosmetik · dagens tilbud skifter ved midnat</small><span class="ms-coins"><b>${coins}</b> MØNTER</span></h3>
      ${groups.map(([k, n]) => { const L = ITEMS.filter(i => i.kind === k); return L.length ? `<h3>${n}</h3><div class="sh-grid">${L.map(cardHtml).join('')}</div>` : ''; }).join('')}</div>`;
  }
  function click(b) {
    if (b.dataset.buy) { const it = ITEMS.find(i => i.id === b.dataset.buy), pr = priceOf(it); if (!it || owned(it) || (Pf.data.coins || 0) < pr) return;
      Pf.data.coins -= pr; Pf.data.owned[it.id] = 1; Pf.save(); Pf.toast('KØBT', it.name, '−' + pr + ' mønter'); if (it.onBuy) it.onBuy(); Pf.render(); return; }
    if (b.dataset.equip) { const it = ITEMS.find(i => i.id === b.dataset.equip); if (!it || !owned(it)) return;
      if (it.kind === 'nc') Pf.data.nc = Pf.data.nc === it.ref ? '' : it.ref; else Pf.data[it.kind] = Pf.data[it.kind] === it.ref ? (it.kind === 'title' ? 'rekrut' : it.kind === 'card' ? 'paper' : '') : it.ref;
      Pf.save(); Pf.render(); o.onEquip && o.onEquip(); }
  }
  Pf.addTab('butik', 'BUTIK', render, click);
  return { addItems, priceOf, NAMECOL };
}
