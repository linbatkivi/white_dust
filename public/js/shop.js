// ==========================================================================
// White Dust · v26.14 SHOP – mønter optjenes i kampe og missioner og bruges KUN på kosmetik (ingen indflydelse på balancen):
//   titler, profilkort, badges, navnefarver, MVP-musik og hideout-dekorationer. Egen skærm (ikke længere en fane i karrieren):
//   kategorier i en sidenavigation, dagens tilbud med nedtælling, prøvelytning af musik og en lille købs-animation.
//   Dagens tilbud: 2 varer med rabat, valgt ud fra datoen (samme for alle). Hideout-dekorationer meldes ind med addItems().
// createShop({ Profile, esc, name(), kits[], rarity(id), getKit(), setKit(id), playKit(id), onEquip() }) -> { open(cat), close(), isOpen(), addItems(list), priceOf(item), bestDeal(), NAMECOL }
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
    ...Object.entries(NAMECOL).map(([k, [n]], i) => ({ id: 'nc:' + k, kind: 'nc', ref: k, name: 'Navnefarve: ' + n, price: [1000, 1400, 1200, 1200, 900, 1600][i] })),
    ...(o.kits || []).filter(k => k.price > 0).map(k => ({ id: 'kit:' + k.id, kind: 'kit', ref: k.id, name: k.name, desc: k.desc, rar: k.rarity, price: k.price }))
  ];
  for (const it of ITEMS) if (it.kind !== 'nc' && it.kind !== 'kit') Pf.registerExtra(it.kind, it.ref, it.name, it.css);
  // grandfather: et MVP-tema man allerede har valgt (før de blev købelige) ejes
  try { const cur = o.getKit && o.getKit(); if (cur && ITEMS.some(i => i.id === 'kit:' + cur) && !Pf.data.owned['kit:' + cur]) { Pf.data.owned['kit:' + cur] = 1; Pf.save(); } } catch (e) {}
  const pad = n => String(n).padStart(2, '0'), d = new Date(), day = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  let h = 0; for (const c of 'shop' + day) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const deals = new Map(); for (let i = 0; i < 2; i++) { let k = 0; do { h = Math.imul(h ^ (h >>> 13), 2246822507) >>> 0; k++; } while (deals.has(ITEMS[h % ITEMS.length].id) && k < 20); deals.set(ITEMS[h % ITEMS.length].id, [0.6, 0.75][i]); }
  const priceOf = it => Math.round(it.price * (deals.get(it.id) || 1) / 10) * 10;
  const owned = it => !!Pf.data.owned[it.id];
  const bestDeal = () => { const m = Math.min(...deals.values()); return Math.round((1 - m) * 100); };
  function addItems(list) { for (const it of list) if (!ITEMS.some(x => x.id === it.id)) ITEMS.push(it); }

  const CATS = [['alle', 'ALT', '◈'], ['tilbud', 'TILBUD', '%'], ['kit', 'MVP-MUSIK', '♪'], ['title', 'TITLER', 'T'], ['card', 'PROFILKORT', '▭'], ['badge', 'BADGES', '★'], ['nc', 'NAVNEFARVER', 'A'], ['deco', 'HIDEOUT', '⌂']];
  let el = null, cat = 'alle', isOpenF = false, tickT = 0, shownBal = 0, balRaf = 0, bought = '';
  const equipped = it => it.kind === 'nc' ? Pf.data.nc === it.ref : it.kind === 'kit' ? (o.getKit && o.getKit()) === it.ref : Pf.data[it.kind] === it.ref;
  const rar = it => (o.rarity && o.rarity(it.rar)) || { name: '', col: '#8a8a8a' };

  function preview(it) {
    if (it.kind === 'card') return `<div class="sh-prev card" style="--card:${it.css}"></div>`;
    if (it.kind === 'nc') return `<div class="sh-prev nc" style="color:${NAMECOL[it.ref][1]}">${esc((o.name && o.name()) || 'Spiller')}</div>`;
    if (it.kind === 'badge') return `<div class="sh-prev badge"><span>${esc(it.name)}</span></div>`;
    if (it.kind === 'deco') return `<div class="sh-prev deco">${it.icon || '▣'}</div>`;
    if (it.kind === 'kit') { const r = rar(it); return `<div class="sh-prev kit" style="--rc:${r.col}"><div class="sh-eq"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><button class="sh-play" data-try="${it.ref}" title="Prøvelyt">▶</button></div>`; }
    return `<div class="sh-prev title"><small>TITEL</small>${esc(it.name)}</div>`;
  }
  function itemCard(it, i, big) {
    const coins = Pf.data.coins || 0, own = owned(it), pr = priceOf(it), deal = deals.get(it.id), eq = equipped(it);
    const act = own ? (it.kind === 'deco' ? '<span class="sh-own">EJET · I HIDEOUT</span>' : `<button class="sh-btn ${eq ? 'on' : ''}" data-equip="${it.id}">${eq ? '✓ I BRUG' : 'BRUG'}</button>`)
      : `<button class="sh-btn buy" data-buy="${it.id}" ${coins < pr ? 'disabled' : ''}>${deal ? `<s>${it.price}</s> ` : ''}${pr}<i>◎</i></button>`;
    const sub = it.kind === 'kit' ? `<small class="sh-rar" style="color:${rar(it).col}">${esc(rar(it).name)} · ${esc(it.desc || '')}</small>` : '';
    return `<div class="sh-item${own ? ' own' : ''}${deal ? ' deal' : ''}${big ? ' big' : ''}${bought === it.id ? ' bought' : ''}" style="--i:${i}">${deal ? `<i class="sh-deal">−${Math.round((1 - deal) * 100)} %</i>` : ''}${preview(it)}<b>${esc(it.name)}</b>${sub}<div class="sh-act">${act}</div></div>`;
  }
  const left = () => { const t = new Date(); t.setHours(24, 0, 0, 0); const ms = t - Date.now(), hh = Math.floor(ms / 3.6e6), mm = Math.floor(ms % 3.6e6 / 6e4), ss = Math.floor(ms % 6e4 / 1000); return pad(hh) + ':' + pad(mm) + ':' + pad(ss); };
  function render() {
    const coins = Pf.data.coins || 0;
    const list = k => k === 'alle' ? ITEMS : k === 'tilbud' ? ITEMS.filter(i => deals.has(i.id)) : ITEMS.filter(i => i.kind === k);
    const rail = CATS.filter(([k]) => k === 'alle' || k === 'tilbud' || list(k).length).map(([k, n, ic], i) => { const L = list(k), ow = L.filter(owned).length;
      return `<button data-cat="${k}" class="${k === cat ? 'sel' : ''}" style="--i:${i}"><i>${ic}</i><span>${n}</span><small>${k === 'tilbud' ? '' : ow + '/' + L.length}</small></button>`; }).join('');
    const dealIts = ITEMS.filter(i => deals.has(i.id));
    const deal = (cat === 'alle' || cat === 'tilbud') ? `<section class="sh-deals"><div class="sh-dh"><h3>DAGENS TILBUD</h3><span class="sh-cd">skifter om <b id="shCd">${left()}</b></span></div><div class="sh-dg">${dealIts.map((it, i) => itemCard(it, i, true)).join('')}</div></section>` : '';
    const grp = cat === 'alle' ? CATS.filter(([k]) => !['alle', 'tilbud'].includes(k)) : cat === 'tilbud' ? [] : CATS.filter(([k]) => k === cat);
    const body = grp.map(([k, n]) => { const L = list(k); if (!L.length) return ''; let ix = 0; return `<section><h3>${n}</h3><div class="sh-grid">${L.map(it => itemCard(it, ix++)).join('')}</div></section>`; }).join('');
    const scroll = el.querySelector('.sh-main') ? el.querySelector('.sh-main').scrollTop : 0;
    el.innerHTML = `<div class="st-panel shop-panel"><div class="st-head"><h2>SHOP</h2><div class="sh-bal" title="Mønter optjenes i kampe og missioner"><i>◎</i><b id="shBal">${shownBal}</b><span>MØNTER</span></div><button class="btn btn-tiny btn-ghost" data-close>LUK (ESC)</button></div>
      <div class="sh-wrap2"><nav class="sh-rail">${rail}<p class="sh-note">Kun kosmetik – ingen indflydelse på kampen. Tilbud skifter ved midnat.</p></nav>
        <div class="sh-main">${deal}${body}</div></div></div>`;
    const m = el.querySelector('.sh-main'); if (m) m.scrollTop = scroll; bought = '';
    countTo(coins);
  }
  function countTo(v) {
    cancelAnimationFrame(balRaf); const from = shownBal, t0 = performance.now(), dur = Math.min(900, 250 + Math.abs(v - from) * 2);
    const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); shownBal = Math.round(from + (v - from) * e); const b = el && el.querySelector('#shBal'); if (b) b.textContent = shownBal; if (k < 1 && isOpenF) balRaf = requestAnimationFrame(step); else shownBal = v; };
    balRaf = requestAnimationFrame(step);
  }
  function build() {
    el = document.createElement('div'); el.id = 'shop'; el.className = 'settings shop hidden'; document.body.appendChild(el);
    el.addEventListener('mousedown', e => { if (e.target === el) close(); });
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.close !== undefined) return close();
      if (b.dataset.cat) { cat = b.dataset.cat; render(); return; }
      if (b.dataset.try) { o.playKit && o.playKit(b.dataset.try); const card = b.closest('.sh-item'); if (card) { card.classList.add('playing'); clearTimeout(card._pt); card._pt = setTimeout(() => card.classList.remove('playing'), 9000); } return; }
      if (b.dataset.buy) { const it = ITEMS.find(i => i.id === b.dataset.buy), pr = it && priceOf(it); if (!it || owned(it) || (Pf.data.coins || 0) < pr) return;
        Pf.data.coins -= pr; Pf.data.owned[it.id] = 1; Pf.save(); Pf.toast('KØBT', it.name, '−' + pr + ' mønter'); if (it.onBuy) it.onBuy(); bought = it.id; render(); return; }
      if (b.dataset.equip) { const it = ITEMS.find(i => i.id === b.dataset.equip); if (!it || !owned(it)) return;
        if (it.kind === 'kit') { o.setKit && o.setKit(it.ref); o.playKit && o.playKit(it.ref); }
        else if (it.kind === 'nc') Pf.data.nc = Pf.data.nc === it.ref ? '' : it.ref; else Pf.data[it.kind] = Pf.data[it.kind] === it.ref ? (it.kind === 'title' ? 'rekrut' : it.kind === 'card' ? 'paper' : '') : it.ref;
        Pf.save(); render(); o.onEquip && o.onEquip(); }
    });
    window.addEventListener('keydown', e => { if (isOpenF && e.code === 'Escape') { e.stopPropagation(); close(); } }, true);
  }
  function open(c) {
    if (!el) build(); if (c && ['alle', 'tilbud', 'kit', 'title', 'card', 'badge', 'nc', 'deco'].includes(c)) cat = c; else if (c) cat = 'alle';
    isOpenF = true; shownBal = 0; el.classList.remove('hidden'); render();
    clearInterval(tickT); tickT = setInterval(() => { const c2 = el && el.querySelector('#shCd'); if (c2) c2.textContent = left(); }, 1000);
  }
  function close() { if (!el) return; isOpenF = false; clearInterval(tickT); cancelAnimationFrame(balRaf); el.classList.add('hidden'); el.innerHTML = ''; try { o.onClose && o.onClose(); } catch (e) {} }
  return { addItems, priceOf, bestDeal, NAMECOL, open, close, isOpen: () => isOpenF, refresh: () => { if (isOpenF) render(); } };
}
