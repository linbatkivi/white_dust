// ==========================================================================
// White Dust · Worldwide-konto
//   Starter man spillet fra Worldwide-launcheren, ligger der en session i window.WW_SESSION (laves af launcheren i /config.js).
//   Så gør det her tre ting – og ingenting, hvis sessionen mangler (browser, spillets egen app, udvikling):
//     1. navnet i menuen bliver kontoens navn
//     2. fremgangen (wd_profile og wd_inventory) hentes fra skyen, FØR spillet starter, og lægges i localStorage som spillet læser den fra
//     3. hver gang spillet gemmer, sendes fremgangen til skyen (samlet, højst hvert 4. sekund)
//   Spillets egen kode er urørt: den læser og skriver localStorage som før.
//   Kører index.html: await WWAccount.ready, før app.js hentes.
// ==========================================================================
(function () {
  'use strict';
  const A = window.WWAccount = { active: false, status: 'off', user: null, ready: Promise.resolve(), flush: async () => {} };
  const S = window.WW_SESSION;
  if (!S || !S.user || !window.WW) return;

  const GAME = 'white-dust', K = { profile: 'wd_profile', inventory: 'wd_inventory', name: 'wd_name' };
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { origSet.call(localStorage, k, v); } catch (e) {} };
  const del = k => { try { localStorage.removeItem(k); } catch (e) {} };
  const parse = s => { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } };
  const origSet = Storage.prototype.setItem;

  A.active = true; A.user = S.user; A.status = S.token ? 'connecting' : 'offline';

  // ---- 1. hvem ejer de lokale data? Skifter man konto på samme computer, må den nye ikke arve den gamles fremgang.
  const owner = get('ww_owner');
  if (owner && owner !== S.user.id) { del(K.profile); del(K.inventory); del('ww_at'); }
  set('ww_owner', S.user.id);
  set(K.name, S.user.displayName);

  // ---- små flettefunktioner (bruges kun hvis to enheder har gemt hver for sig)
  function mergeProfile(a, b) {
    if (!a) return b; if (!b) return a;
    const base = (a.xp || 0) >= (b.xp || 0) ? a : b, other = base === a ? b : a, out = JSON.parse(JSON.stringify(base));
    out.owned = Object.assign({}, other.owned || {}, base.owned || {});
    const stats = Object.assign({}, other.stats || {});
    for (const [k, v] of Object.entries(base.stats || {})) stats[k] = typeof v === 'number' ? Math.max(v, stats[k] || 0) : v;
    out.stats = stats;
    return out;
  }
  const mergePayload = (a, b) => {
    a = a || {}; b = b || {};
    return { profile: mergeProfile(a.profile, b.profile), inventory: (a.at || 0) >= (b.at || 0) ? (a.inventory || b.inventory) : (b.inventory || a.inventory), at: Math.max(a.at || 0, b.at || 0) };
  };
  const readLocal = () => ({ profile: parse(get(K.profile)), inventory: parse(get(K.inventory)), at: +get('ww_at') || 0 });
  function writeLocal(p) {
    if (p.profile) set(K.profile, JSON.stringify(p.profile));
    if (p.inventory) set(K.inventory, JSON.stringify(p.inventory));
    set('ww_at', String(p.at || 0));
  }

  // ---- lille mærke i hjørnet: hvem er logget ind, og gemmer vi?
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let badge, hideT;
  function showBadge(state, ms) {
    if (!document.body) return;
    if (!badge) {
      const st = document.createElement('style');
      st.textContent = '#wwBadge{position:fixed;left:14px;top:14px;z-index:99999;display:flex;align-items:center;gap:9px;padding:7px 12px 7px 10px;background:#0a0a0a;color:#f4f4f2;font:700 11px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.09em;text-transform:uppercase;box-shadow:3px 3px 0 rgba(0,0,0,.22);opacity:0;transform:translateY(-10px);transition:opacity .35s,transform .45s cubic-bezier(.22,.8,.2,1);pointer-events:none}#wwBadge.on{opacity:1;transform:none}#wwBadge i{width:8px;height:8px;border-radius:50%;background:#f4f4f2}#wwBadge.sync i{background:#e8c35a;animation:wwp 1s infinite}#wwBadge.off i{background:#ff2b1f}@keyframes wwp{50%{opacity:.25}}';
      document.head.appendChild(st);
      badge = document.createElement('div'); badge.id = 'wwBadge'; document.body.appendChild(badge);
    }
    badge.className = 'on ' + state; badge.innerHTML = '<i></i><span>Worldwide · ' + esc(S.user.displayName) + '</span>';
    clearTimeout(hideT); hideT = setTimeout(() => badge.classList.remove('on'), ms || 3200);
  }

  // ---- 2. hent fra skyen
  const client = WW.createClient({ api: S.api, token: S.token });
  const sync = S.token ? client.gameSync({ game: GAME, token: S.token, merge: mergePayload, delay: 4000 }) : null;
  let dirty = false;
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

  function schedule() {
    if (!sync || sync.dead) return;
    const p = readLocal(); p.at = Date.now(); set('ww_at', String(p.at));
    sync.push(p); dirty = true; A.status = 'saving'; showBadge('sync', 2500);
    clearTimeout(schedule._t); schedule._t = setTimeout(() => { A.status = sync.dead ? 'expired' : 'saved'; }, 4600);
  }

  A.ready = (async () => {
    if (!sync) { document.addEventListener('DOMContentLoaded', () => showBadge('off', 6000)); return; }
    try {
      const cloud = await withTimeout(sync.pull(), 4500);
      const local = readLocal();
      let target;
      if (cloud.data) {
        target = mergePayload(cloud.data, local);
        writeLocal(target);
        // har lokale data noget skyen ikke har, sendes det op igen
        dirty = JSON.stringify(target.profile) !== JSON.stringify(cloud.data.profile);
      } else if (local.profile || local.inventory) { target = local; target.at = Date.now(); writeLocal(target); dirty = true; }   // første login: tag den fremgang der allerede ligger her med
      if (dirty) { sync.push(target); sync.flush().catch(() => {}); }
      A.status = 'saved';
    } catch (e) { A.status = e && e.status === 401 ? 'expired' : 'offline'; console.warn('[worldwide] kunne ikke hente fremgang:', e && e.message); }
  })();

  // ---- 3. gem hver gang spillet gemmer: Storage.setItem for de to nøgler
  Storage.prototype.setItem = function (k, v) {
    origSet.call(this, k, v);
    if (this === localStorage && (k === K.profile || k === K.inventory)) schedule();
  };

  A.flush = async () => { try { if (sync) await withTimeout(sync.flush(), 3000); } catch (e) { /* offline: ligger stadig lokalt */ } };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') A.flush(); });
  window.addEventListener('pagehide', () => { A.flush(); });

  // navnet ændres i launcheren, ikke her
  window.addEventListener('DOMContentLoaded', () => {
    const n = document.getElementById('nameInput');
    if (n) { n.value = S.user.displayName; n.readOnly = true; n.title = 'Navnet kommer fra din Worldwide-konto og ændres i launcheren'; }
    A.ready.then(() => showBadge(A.status === 'offline' || A.status === 'expired' ? 'off' : 'on', 4200));
  });
})();
