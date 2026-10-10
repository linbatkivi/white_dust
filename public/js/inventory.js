// ==========================================================================
// INVENTAR (v11.3): vælg agent (spillerfigur + farvevariant) pr. hold og skin pr. våben – med drejende 3D-forhåndsvisning.
//   Stil som resten af spillets taktiske UI (mørke paneler, skrå hjørner, rød accent, sjældenhedsfarver som i CS).
//   Valget gemmes i localStorage ('wd_inventory'), sendes til serveren (alle ser din figur og dine skins) og anvendes straks.
// createInventory({ THREE, skins, chars(), weap(), weaponCode(id), onChange(inv) }) -> { get, open, close, isOpen, agentKey(side), skin(id, team), skinName(id, team) }
// ==========================================================================
export function createInventory(opt) {
  const S = opt.skins, KEY = 'wd_inventory';
  let inv = S.sanitize(null);
  try { inv = S.sanitize(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { /* standard */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(inv)); } catch (e) {} };
  const el = document.getElementById('inventory');
  const WNAME = { ak47: 'AK-47', m4a1: 'M4A1', famas: 'FAMAS', galil: 'GALIL AR', tec9: 'TEC-9', mp5: 'MP5-SD', mac10: 'MAC-10', mp9: 'MP9', mp7: 'MP7', ump45: 'UMP-45', p90: 'P90', awp: 'AWP', usp: 'USP-S', glock: 'GLOCK-18', fiveseven: 'FIVE-SEVEN', deagle: 'DESERT EAGLE' };
  const WTEAM = { ak47: 'hij', galil: 'hij', mac10: 'hij', mp9: 'swat', tec9: 'hij', glock: 'hij', m4a1: 'swat', famas: 'swat', usp: 'swat', fiveseven: 'swat' };
  let tab = 'agents', side = 'swat', gun = 'ak47', open = false;
  const knifeKey = () => S.knifeOf(inv.skins.knife || S.defaultKnife);
  const skinOf = (id, team) => id === 'knife' ? (inv.skins.knife || S.defaultKnife) : inv.skins[id] || S.defaultSkin(WTEAM[id] || team);

  /* ---------------- 3D-forhåndsvisning (egen lille renderer, kun mens inventaret er åbent) ---------------- */
  let R = null, scene, cam, obj = null, objKind = null, raf = 0, t0 = 0;
  function initPreview(canvas) {
    const T = opt.THREE;
    R = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.15;
    scene = new T.Scene(); cam = new T.PerspectiveCamera(30, 1, 0.05, 50);
    scene.add(new T.HemisphereLight(0xdfe8f5, 0x3a3328, 2.2));
    const key = new T.DirectionalLight(0xfff1dc, 3.2); key.position.set(3, 4, 4); scene.add(key);
    const rim = new T.DirectionalLight(0x9fc2ff, 2.2); rim.position.set(-4, 2, -3); scene.add(rim);
    const floor = new T.Mesh(new T.CircleGeometry(1.1, 48), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 })); floor.rotation.x = -Math.PI / 2; floor.name = 'floor'; scene.add(floor);
  }
  function resize() { if (!R) return; const c = R.domElement, w = c.clientWidth || 1, h = c.clientHeight || 1; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  function setPreview() {
    if (!R) return;
    if (obj) { scene.remove(obj.group || obj); obj = null; }
    const floor = scene.getObjectByName('floor');
    if (tab === 'agents') {
      const C = opt.chars(); if (!C) return;
      const h = C.buildHuman(side, inv.agent[side]); C.setBake(h, [0.05, 0.05, 0.05, 1]);
      h.label = null; obj = h; objKind = 'agent'; scene.add(h.group);
      cam.position.set(0, 1.15, 3.6); cam.lookAt(0, 0.95, 0); floor.visible = true;
    } else {
      const W = opt.weap(); if (!W) return;
      const kn = tab === 'knives';
      const g = kn ? W.worldModel('knife', null, side, knifeKey().key) : W.worldModel(gun, null, WTEAM[gun] || side, skinOf(gun, side)); if (!g) return;
      const holder = new opt.THREE.Group(); holder.add(g);
      const b = new opt.THREE.Box3().setFromObject(g), c = b.getCenter(new opt.THREE.Vector3()), sz = b.getSize(new opt.THREE.Vector3()).length();
      g.position.sub(c); holder.scale.setScalar(1.6 / Math.max(0.2, sz));
      obj = holder; objKind = 'gun'; scene.add(holder);
      if (kn) holder.rotation.z = 0.0;
      cam.position.set(0, 0.25, 2.4); cam.lookAt(0, 0, 0); floor.visible = false;
    }
  }
  function loop(t) {
    if (!open) return;
    raf = requestAnimationFrame(loop);
    resize();
    const dt = Math.min(0.05, (t - (t0 || t)) / 1000); t0 = t;
    if (obj && objKind === 'agent') { const C = opt.chars(); C.animateHuman(obj, dt, t / 1000, { x: 0, y: 0, z: 0, yaw: Math.PI + Math.sin(t / 2600) * 0.9, pitch: 0, alive: true, grounded: true, wcode: opt.weaponCode(side === 'hij' ? 'ak47' : 'm4a1') }); }
    else if (obj) { obj.rotation.y = t / 1800; obj.rotation.x = Math.sin(t / 2100) * 0.12; }
    R.render(scene, cam);
  }

  /* ---------------- UI ---------------- */
  const rar = id => S.RARITY[id] || S.RARITY.base;
  const card = (sel, rarity, title, sub, data) => `<button class="iv-card${sel ? ' sel' : ''}" ${data}><i style="background:${rar(rarity).col}"></i><b>${title}</b><span>${sub}</span><em style="color:${rar(rarity).col}">${rar(rarity).name}</em></button>`;
  function render() {
    const cur = tab === 'agents' ? S.agentOf(inv.agent[side], side) : null, sk = S.SKIN_BY_ID[skinOf(gun, side)], kn = knifeKey();
    const list = tab === 'agents'
      ? S.AGENTS[side].map(a => a.variants.map(v => card(inv.agent[side] === a.id + ':' + v.id, v.rarity, a.name, v.name, `data-agent="${a.id}:${v.id}"`)).join('')).join('')
      : tab === 'knives'
        ? S.KNIFE_FINISHES.map(f => card(kn.finish.id === f.id, f.rarity, '★ ' + f.name, kn.model.name, `data-kfin="${f.id}"`)).join('')
        : S.WEAPON_SKINS.map(s => card(skinOf(gun, side) === s.id, s.rarity, s.name, WNAME[gun], `data-skin="${s.id}"`)).join('');
    const guns = tab === 'knives'
      ? S.KNIVES.map(k => `<button class="iv-gun${k.id === kn.model.id ? ' sel' : ''}" data-kmodel="${k.id}">★ ${k.name}<small>${k.id === kn.model.id ? kn.finish.name : ''}</small></button>`).join('')
      : S.GUNS.map(g => `<button class="iv-gun${g === gun ? ' sel' : ''}" data-gun="${g}">${WNAME[g]}<small>${S.SKIN_BY_ID[skinOf(g, side)].name}</small></button>`).join('');
    const title = tab === 'agents' ? `${cur.agent.name}<small>${cur.variant.name}</small>` : tab === 'knives' ? `★ ${kn.model.name}<small>${kn.finish.name}</small>` : `${WNAME[gun]}<small>${sk.name}</small>`;
    const rr = tab === 'agents' ? rar(cur.variant.rarity) : tab === 'knives' ? rar(kn.finish.rarity) : rar(sk.rarity);
    el.innerHTML = `<div class="st-panel iv-panel">
      <div class="st-head"><h2>INVENTAR</h2><div class="iv-tabs"><button data-tab="agents" class="${tab === 'agents' ? 'sel' : ''}">AGENTER</button><button data-tab="skins" class="${tab === 'skins' ? 'sel' : ''}">VÅBEN-SKINS</button><button data-tab="knives" class="${tab === 'knives' ? 'sel' : ''}">★ KNIVE</button></div><button class="btn btn-tiny" data-close>LUK (ESC)</button></div>
      <div class="iv-body">
        <div class="iv-left">
          <div class="iv-side"><button data-side="swat" class="${side === 'swat' ? 'sel swat' : 'swat'}">SWAT</button><button data-side="hij" class="${side === 'hij' ? 'sel hij' : 'hij'}">HIJACKERS</button></div>
          ${tab !== 'agents' ? `<div class="iv-guns">${guns}</div>` : ''}
          <div class="iv-list">${list}</div>
        </div>
        <div class="iv-right">
          <div class="iv-prev"><canvas id="ivCanvas"></canvas><div class="iv-rar" style="border-color:${rr.col};color:${rr.col}">${rr.name}</div></div>
          <div class="iv-title" style="--rc:${rr.col}">${title}</div>
          <div class="iv-note">${tab === 'agents' ? 'Din figur når du spiller som ' + (side === 'hij' ? 'Hijacker' : 'SWAT') + '. Alle spillere ser dit valg.' : tab === 'knives' ? 'Din kniv (tast 3). Du løber 10 % hurtigere med kniven i hånden – og et knivdrab giver $1500. Tryk F i spillet for at inspicere den.' : 'Skin på ' + WNAME[gun] + '. Vises i første person og hos de andre spillere.'}</div>
        </div>
      </div></div>`;
    const cv = el.querySelector('#ivCanvas');
    if (!R || R.domElement !== cv) { if (R) { R.dispose(); R = null; } initPreview(cv); }
    setPreview();
  }
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.close !== undefined) return close();
    if (b.dataset.tab) { tab = b.dataset.tab; render(); return; }
    if (b.dataset.side) { side = b.dataset.side; if (tab === 'skins' && WTEAM[gun] && WTEAM[gun] !== side) gun = side === 'hij' ? 'ak47' : 'm4a1'; render(); return; }
    if (b.dataset.gun) { gun = b.dataset.gun; render(); return; }
    if (b.dataset.agent) { inv.agent[side] = b.dataset.agent; changed(); return; }
    if (b.dataset.skin) { inv.skins[gun] = b.dataset.skin; changed(); return; }
    if (b.dataset.kmodel) { inv.skins.knife = b.dataset.kmodel + '_' + knifeKey().finish.id; changed(); return; }
    if (b.dataset.kfin) { inv.skins.knife = knifeKey().model.id + '_' + b.dataset.kfin; changed(); }
  });
  el.addEventListener('mousedown', e => { if (e.target === el) close(); });
  function changed() { inv = S.sanitize(inv); save(); render(); if (opt.onChange) opt.onChange(inv); }
  function doOpen(t) { if (t) tab = t; open = true; el.classList.remove('hidden'); render(); t0 = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
  function close() { open = false; el.classList.add('hidden'); cancelAnimationFrame(raf); if (R) { R.dispose(); R.forceContextLoss && R.forceContextLoss(); R = null; } el.innerHTML = ''; }
  window.addEventListener('keydown', e => { if (open && e.code === 'Escape') { e.stopPropagation(); close(); } }, true);
  return {
    get: () => inv, open: doOpen, close, isOpen: () => open, refresh: () => { if (open) setPreview(); },
    agentKey: s => inv.agent[s], skin: (id, team) => skinOf(id, team),
    skinName: (id, team) => id === 'knife' ? knifeKey().name : (S.SKIN_BY_ID[skinOf(id, team)] || {}).name || null,
    knife: () => knifeKey().key
  };
}
