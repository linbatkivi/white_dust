// ==========================================================================
// INDSTILLINGER (v9): crosshair-editor med interaktiv forhåndsvisning, mus-sensitivitet og master-volumen.
//   v12: separate volumen-sliders (Master, SFX, Musik/Ambience, Speaker & stemme-UI), mus-udjævning (0–20 ms) og rå mus-input.
//   Alt gemmes i localStorage ('wd_settings') og anvendes i realtid (HUD-crosshair, pointer-lock-bevægelse, lyd).
//   Åbnes fra hovedmenuen og fra pause-menuen (Esc). createSettings({ onChange }) -> { get, open, close, isOpen, drawCrosshair, sensRad }
// ==========================================================================
export function createSettings(opts) {
  const o = opts || {};
  const KEY = 'wd_settings';
  const PRESETS = [['Grøn', '#00FF00'], ['Cyan', '#00FFFF'], ['Gul', '#FFFF00'], ['Rød', '#FF0000'], ['Hvid', '#FFFFFF']];
  // v12: separate lydbusser (Master · SFX · Musik/Ambience · Speaker/Stemme), mus-udjævning (ms) og rå mus-input (ingen OS-acceleration)
  const DEF = { xh: { len: 7, thick: 2, gap: 3, color: '#00FF00', dot: false, dotSize: 2, outline: true, outlineThick: 1, alpha: 1 }, sens: 2.5, vol: 80, sfx: 100, music: 55, voice: 85, smooth: 6, raw: true, gfx: 'auto', stats: false, fullscreen: true };
  // præcise grænser fra specifikationen
  const LIM = { len: [2, 30, 1], thick: [1, 10, 1], gap: [-5, 20, 1], dotSize: [1, 5, 1], outlineThick: [1, 3, 1], alpha: [0.1, 1, 0.05], sens: [0.1, 10, 0.05], vol: [0, 100, 1], sfx: [0, 100, 1], music: [0, 100, 1], voice: [0, 100, 1], smooth: [0, 20, 1] };
  const clampTo = (k, v) => { const L = LIM[k]; v = +v; if (!Number.isFinite(v)) return null; v = Math.min(L[1], Math.max(L[0], v)); return Math.round(v / L[2]) * L[2]; };
  const hexOk = c => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);

  function load() {
    const s = JSON.parse(JSON.stringify(DEF));
    let raw = null; try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { raw = null; }
    if (raw && typeof raw === 'object') {
      const x = raw.xh || {};
      for (const k of ['len', 'thick', 'gap', 'dotSize', 'outlineThick', 'alpha']) { const v = clampTo(k, x[k]); if (v !== null && x[k] !== undefined) s.xh[k] = v; }
      if (hexOk(x.color)) s.xh.color = x.color.toUpperCase();
      if (typeof x.dot === 'boolean') s.xh.dot = x.dot;
      if (typeof x.outline === 'boolean') s.xh.outline = x.outline;
      for (const k of ['sens', 'vol', 'sfx', 'music', 'voice', 'smooth']) { const v = clampTo(k, raw[k]); if (v !== null && raw[k] !== undefined) s[k] = v; }
      if (typeof raw.raw === 'boolean') s.raw = raw.raw;
      if (typeof raw.stats === 'boolean') s.stats = raw.stats;
      if (typeof raw.fullscreen === 'boolean') s.fullscreen = raw.fullscreen;
      if (['auto', 'ultra', 'high', 'medium', 'low', 'min'].includes(raw.gfx)) s.gfx = raw.gfx;
    }
    return s;
  }
  let S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  /* ---------------- crosshair-tegning (deles af HUD og forhåndsvisning) ---------------- */
  // tegner på et canvas centreret; skarpe kanter: alle mål afrundes til hele (enheds-)pixels
  function drawCrosshair(canvas, xh, scale) {
    const X = xh || S.xh, k = scale || 1, dpr = Math.min(3, window.devicePixelRatio || 1);
    const ext = Math.ceil((Math.max(0, X.gap) + X.len + X.thick + 8) * k) * 2 + 4;
    const W = Math.max(ext, 16);
    if (canvas.width !== W * dpr || canvas.height !== W * dpr) { canvas.width = W * dpr; canvas.height = W * dpr; canvas.style.width = W + 'px'; canvas.style.height = W + 'px'; }
    const c = canvas.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, W);
    const cx = W / 2, t = Math.max(1, Math.round(X.thick * k)), L = Math.round(X.len * k), g = Math.round(X.gap * k), ol = X.outline ? Math.round(X.outlineThick * k) : 0;
    // lodrette/vandrette arme: [x, y, w, h] med center i (cx, cx); ulige tykkelse centreres på halve pixels
    const off = t % 2 ? 0.5 : 0, c0 = Math.floor(cx) + off - t / 2;
    const arms = [
      [c0, cx - g - L, t, L], [c0, cx + g, t, L],            // op, ned
      [cx - g - L, c0, L, t], [cx + g, c0, L, t]             // venstre, højre
    ];
    const dotS = X.dot ? Math.max(1, Math.round(X.dotSize * k)) : 0, d0 = Math.floor(cx) + (dotS % 2 ? 0.5 : 0) - dotS / 2;
    c.globalAlpha = X.alpha;
    if (ol) {
      c.fillStyle = '#000';
      for (const a of arms) c.fillRect(a[0] - ol, a[1] - ol, a[2] + ol * 2, a[3] + ol * 2);
      if (dotS) c.fillRect(d0 - ol, d0 - ol, dotS + ol * 2, dotS + ol * 2);
    }
    c.fillStyle = X.color;
    for (const a of arms) c.fillRect(a[0], a[1], a[2], a[3]);
    if (dotS) c.fillRect(d0, d0, dotS, dotS);
    c.globalAlpha = 1;
  }

  /* ---------------- UI ---------------- */
  const $ = id => document.getElementById(id);
  const root = $('settings');
  let built = false, openFlag = false, onClose = null;
  function slider(id, label, key, path, fmt) {
    const L = LIM[key];
    return `<div class="st-row"><label for="${id}">${label}</label><input type="range" id="${id}" min="${L[0]}" max="${L[1]}" step="${L[2]}" data-key="${key}" data-path="${path}"><output id="${id}V"></output></div>`;
  }
  function build() {
    if (built || !root) return; built = true;
    root.innerHTML = `
      <div class="st-panel" role="dialog" aria-label="Indstillinger">
        <div class="st-head"><h2>INDSTILLINGER</h2><button class="btn btn-tiny" id="stClose">LUK  [ESC]</button></div>
        <div class="st-body">
          <section class="st-col">
            <h3>CROSSHAIR</h3>
            ${slider('stLen', 'Længde', 'len', 'xh')}
            ${slider('stThick', 'Tykkelse', 'thick', 'xh')}
            ${slider('stGap', 'Mellemrum (gap)', 'gap', 'xh')}
            <div class="st-row"><label>Farve</label><div class="st-colors">${PRESETS.map(([n, c]) => `<button class="st-sw" data-c="${c}" title="${n} ${c}" style="background:${c}"></button>`).join('')}<input type="color" id="stColor" title="Vælg egen farve"></div></div>
            <div class="st-row"><label for="stDot">Prik i midten</label><label class="st-tog"><input type="checkbox" id="stDot"><span></span></label></div>
            ${slider('stDotSize', '· Prik-størrelse', 'dotSize', 'xh')}
            <div class="st-row"><label for="stOutline">Kontur (outline)</label><label class="st-tog"><input type="checkbox" id="stOutline"><span></span></label></div>
            ${slider('stOutlineThick', '· Kontur-tykkelse', 'outlineThick', 'xh')}
            ${slider('stAlpha', 'Gennemsigtighed (alpha)', 'alpha', 'xh')}
            <h3>MUS</h3>
            ${slider('stSens', 'Mus-sensitivitet', 'sens', '')}
            ${slider('stSmooth', 'Mus-udjævning', 'smooth', '')}
            <div class="st-row"><label for="stRaw">Rå input (ingen acceleration)</label><label class="st-tog"><input type="checkbox" id="stRaw"><span></span></label></div>
            <h3>GRAFIK</h3>
            <div class="st-row"><label for="stGfx">Kvalitet (lavere = flere FPS)</label><select id="stGfx" class="st-sel"><option value="auto">Auto (anbefalet)</option><option value="ultra">Ultra</option><option value="high">Høj</option><option value="medium">Medium</option><option value="low">Lav</option><option value="min">Minimum</option></select></div>
            <div class="st-row"><label for="stStats">Vis FPS & ping</label><label class="st-tog"><input type="checkbox" id="stStats"><span></span></label></div>
            <div class="st-row"><label for="stFull">Fuldskærm i spillet (Esc forlader den ikke · hold Esc for at gå ud)</label><label class="st-tog"><input type="checkbox" id="stFull"><span></span></label></div>
            <h3>LYD</h3>
            ${slider('stVol', 'Master Volume', 'vol', '')}
            ${slider('stSfx', 'SFX (skud, eksplosioner, fodtrin)', 'sfx', '')}
            ${slider('stMusic', 'Musik / Ambience', 'music', '')}
            ${slider('stVoice', 'Speaker & stemme-UI', 'voice', '')}
          </section>
          <section class="st-col st-prev-col">
            <h3>FORHÅNDSVISNING</h3>
            <div class="st-prev" id="stPrev"><div class="st-prev-scene"></div><canvas id="stPrevXh"></canvas><div class="st-prev-lbl">1:1</div></div>
            <div class="st-prev st-prev-zoom"><div class="st-prev-scene dark"></div><canvas id="stPrevXh2"></canvas><div class="st-prev-lbl">3× zoom</div></div>
            <p class="st-note">Alt gemmes automatisk i browseren og anvendes med det samme.</p>
            <button class="btn btn-ghost btn-tiny" id="stReset">NULSTIL TIL STANDARD</button>
          </section>
        </div>
      </div>`;
    root.addEventListener('mousedown', e => { if (e.target === root) close(); });
    root.querySelectorAll('input[type=range]').forEach(inp => inp.addEventListener('input', () => {
      const k = inp.dataset.key, v = clampTo(k, inp.value); if (v === null) return;
      if (inp.dataset.path === 'xh') S.xh[k] = v; else S[k] = v;
      changed();
    }));
    root.querySelectorAll('.st-sw').forEach(b => b.addEventListener('click', () => { S.xh.color = b.dataset.c; changed(); }));
    $('stColor').addEventListener('input', e => { if (hexOk(e.target.value)) { S.xh.color = e.target.value.toUpperCase(); changed(); } });
    $('stDot').addEventListener('change', e => { S.xh.dot = !!e.target.checked; changed(); });
    $('stOutline').addEventListener('change', e => { S.xh.outline = !!e.target.checked; changed(); });
    $('stRaw').addEventListener('change', e => { S.raw = !!e.target.checked; changed(); });
    $('stGfx').addEventListener('change', e => { S.gfx = e.target.value; changed(); });
    $('stStats').addEventListener('change', e => { S.stats = !!e.target.checked; changed(); });
    $('stFull').addEventListener('change', e => { S.fullscreen = !!e.target.checked; changed(); });
    $('stReset').addEventListener('click', () => { S = JSON.parse(JSON.stringify(DEF)); changed(); });
    $('stClose').addEventListener('click', () => close());
    window.addEventListener('keydown', e => { if (openFlag && e.code === 'Escape') { e.preventDefault(); close(); } }, true);
  }
  function fmt(k, v) { return k === 'alpha' ? v.toFixed(2) : k === 'sens' ? v.toFixed(2) : (k === 'vol' || k === 'sfx' || k === 'music' || k === 'voice') ? Math.round(v) + ' %' : k === 'smooth' ? (v ? v + ' ms' : 'fra') : (v > 0 && k === 'gap' ? '+' : '') + v + ' px'; }
  function syncUI() {
    if (!built) return;
    root.querySelectorAll('input[type=range]').forEach(inp => {
      const k = inp.dataset.key, v = inp.dataset.path === 'xh' ? S.xh[k] : S[k];
      if (+inp.value !== v) inp.value = v;
      const out = $(inp.id + 'V'); if (out) out.textContent = fmt(k, v);
    });
    root.querySelectorAll('.st-sw').forEach(b => b.classList.toggle('sel', b.dataset.c.toUpperCase() === S.xh.color.toUpperCase()));
    $('stColor').value = S.xh.color.toLowerCase();
    $('stDot').checked = S.xh.dot; $('stOutline').checked = S.xh.outline; $('stRaw').checked = !!S.raw; $('stGfx').value = S.gfx || 'auto'; $('stStats').checked = !!S.stats; $('stFull').checked = S.fullscreen !== false;
    $('stDotSize').disabled = !S.xh.dot; $('stOutlineThick').disabled = !S.xh.outline;
    $('stDotSize').closest('.st-row').classList.toggle('off', !S.xh.dot); $('stOutlineThick').closest('.st-row').classList.toggle('off', !S.xh.outline);
    drawCrosshair($('stPrevXh'), S.xh, 1); drawCrosshair($('stPrevXh2'), S.xh, 3);
  }
  function changed() { save(); syncUI(); if (o.onChange) o.onChange(S); }
  function open(cb) { build(); openFlag = true; onClose = cb || null; root.classList.remove('hidden'); syncUI(); }
  function close() { if (!openFlag) return; openFlag = false; root.classList.add('hidden'); const cb = onClose; onClose = null; if (cb) cb(); }
  // 2,5 svarer til spillets tidligere standard (0,0022 rad pr. pixel)
  const sensRad = () => S.sens * 0.00088;
  return { get: () => S, open, close, isOpen: () => openFlag, drawCrosshair, sensRad, LIM, DEF };
}
