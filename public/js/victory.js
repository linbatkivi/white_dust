// ==========================================================================
// v20: SEJRS-SEKVENS – når et hold har vundet hele kampen. Alt er tidsat efter brugerens sang (public/assets/sounds/music_win.mp3):
//   0–13,5 s  stille intro: filmiske sorte barer, banen bliver mat og kameraet svæver over den, holdnavnet bygges op bogstav for
//             bogstav, scoren tæller op, gnister stiger og spændingen (rystelse, lysstråler) bygges op mod droppet
//   13,53 s   DROPPET: hvidt blitz, chokbølge, konfetti-eksplosion i holdets farve, titlen smækker ned
//   derefter  alt pulserer på beatet (161,5 BPM), leaderboardet glider ind række for række (tal tæller op), MVP-kort med krone
// Tiden tages fra musikkens egen afspilningsposition (Audio.musicTime) => animationen følger lyden, også hvis den hakker.
// SUPERHOT-stil: hvidt papir, sort blæk, rød accent (Hijackers rød, SWAT blå).
// ==========================================================================
export function createVictory(o) {
  const { Audio, $, esc } = o;
  const DROP = 13.53, BEAT = 60 / 161.5, END = 41.5;
  let st = null, raf = 0;
  const root = $('victory'), fx = $('vcFx'), g = fx.getContext('2d');
  const parts = [], rings = [];
  const TEAM = { swat: { name: 'SWAT', col: '#1f6fff', col2: '#7fb0ff' }, hij: { name: 'HIJACKERS', col: '#ff2b1f', col2: '#ffb0a8' } };

  function show(m, meId) {
    hide(true);
    const T = TEAM[m.win] || TEAM.swat;
    st = { m, T, meId, t0: performance.now(), dropDone: false, lastBeat: -1, letters: 0, boardAt: 0, rowsShown: 0, mvpShown: false, myWin: null };
    const me = (m.board || []).find(p => p.id === meId); st.myWin = me ? me.side === m.win : null;
    root.className = 'victory on ' + m.win;
    root.style.setProperty('--tc', T.col); root.style.setProperty('--tc2', T.col2);
    $('vcKicker').textContent = st.myWin === true ? 'SEJR' : st.myWin === false ? 'NEDERLAG' : 'KAMPEN ER AFGJORT';
    const title = $('vcTitle'); title.innerHTML = '';
    for (const ch of T.name) { const s = document.createElement('span'); s.textContent = ch; title.appendChild(s); }
    $('vcSub').textContent = 'VINDER KAMPEN';
    $('vcScoreA').textContent = '0'; $('vcScoreB').textContent = '0';
    $('vcScoreA').className = 'vs-n swat'; $('vcScoreB').className = 'vs-n hij';
    buildBoard(m);
    resize(); addEventListener('resize', resize);
    Audio.playMusic('music_win', { from: 0, vol: 1 });
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  function hide(quick) {
    if (!st && quick) return;
    st = null; cancelAnimationFrame(raf); parts.length = 0; rings.length = 0;
    root.className = 'victory'; removeEventListener('resize', resize);
    if (o.onHide) o.onHide();
  }
  function resize() { fx.width = innerWidth * Math.min(2, devicePixelRatio || 1); fx.height = innerHeight * Math.min(2, devicePixelRatio || 1); }
  const now = () => { const a = Audio.musicPlaying('music_win') ? Audio.musicTime() : 0; return a > 0.05 ? a : (performance.now() - st.t0) / 1000; };

  function buildBoard(m) {
    const box = $('vcBoard'); box.innerHTML = '';
    const rows = (m.board || []).slice().sort((a, b) => (a.side === m.win ? 0 : 1) - (b.side === m.win ? 0 : 1) || b.k - a.k || b.adr - a.adr);
    const best = rows.slice().sort((a, b) => (b.mvp - a.mvp) || (b.k - a.k) || (b.adr - a.adr))[0];
    st.mvp = best || null;
    box.insertAdjacentHTML('beforeend', '<div class="vb-head"><span></span><span>SPILLER</span><span>K</span><span>D</span><span>ADR</span><span>HS%</span><span>★</span></div>');
    rows.forEach((p, i) => {
      const r = document.createElement('div');
      r.className = 'vb-row ' + p.side + (p.id === st.meId ? ' me' : '') + (best && p.id === best.id ? ' mvp' : '') + (p.side === m.win ? ' win' : '');
      r.innerHTML = `<span class="vb-pos">${i + 1}</span><span class="vb-name">${esc(p.name)}</span><span data-n="${p.k}">0</span><span data-n="${p.d}">0</span><span data-n="${p.adr}">0</span><span data-n="${p.hs}">0</span><span data-n="${p.mvp}">0</span>`;
      box.appendChild(r);
    });
    $('vcMvpName').textContent = best ? best.name : '';
    $('vcMvpStats').textContent = best ? `${best.k} DRAB · ${best.adr} ADR · ${best.mvp} × MVP` : '';
  }

  // ---------------- partikler
  function burst(n, x, y, spd, kind) {
    const W = fx.width, H = fx.height, cols = [st.T.col, st.T.col2, '#ffffff', '#0a0a0a', '#ffd23a'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = spd * (0.35 + Math.random() * 0.9);
      parts.push({ k: kind || 'conf', x: x * W, y: y * H, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * 0.35, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14,
        s: (kind === 'spark' ? 2 : 7 + Math.random() * 9) * (W / 1600), c: cols[Math.floor(Math.random() * (kind === 'spark' ? 3 : cols.length))], life: 0, max: kind === 'spark' ? 0.9 + Math.random() * 0.6 : 3 + Math.random() * 3, flip: Math.random() * 6 });
    }
  }
  function rise(n) {                                             // gnister/aske der stiger i intro'en
    const W = fx.width, H = fx.height;
    for (let i = 0; i < n; i++) parts.push({ k: 'ember', x: Math.random() * W, y: H + 10, vx: (Math.random() - 0.5) * 20, vy: -(60 + Math.random() * 140) * (H / 900), s: (1 + Math.random() * 2.5) * (W / 1600), c: Math.random() < 0.7 ? st.T.col2 : '#ffffff', life: 0, max: 3 + Math.random() * 3, rot: 0, vr: 0, flip: 0 });
  }
  function drawFx(dt, t) {
    const W = fx.width, H = fx.height; g.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life += dt; if (p.life > p.max) { parts.splice(i, 1); continue; }
      const a = 1 - p.life / p.max;
      if (p.k === 'conf') { p.vy += 900 * dt * (H / 900); p.vx *= 1 - 1.2 * dt; p.vy *= 1 - 0.9 * dt; }
      else if (p.k === 'spark') { p.vy += 500 * dt; p.vx *= 1 - 2 * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.flip += dt * 9;
      g.save(); g.globalAlpha = Math.min(1, a * 1.6); g.translate(p.x, p.y);
      if (p.k === 'conf') { g.rotate(p.rot); g.scale(1, Math.cos(p.flip)); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s * 0.3, p.s, p.s * 0.6); }
      else { g.fillStyle = p.c; g.shadowColor = p.c; g.shadowBlur = 8; g.beginPath(); g.arc(0, 0, p.s, 0, Math.PI * 2); g.fill(); }
      g.restore();
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.t += dt; const k = r.t / r.dur; if (k >= 1) { rings.splice(i, 1); continue; }
      g.save(); g.globalAlpha = (1 - k) * r.a; g.strokeStyle = r.c; g.lineWidth = (1 - k) * r.w * (W / 1600);
      g.beginPath(); g.arc(W / 2, H * 0.42, (0.05 + k * r.r) * W, 0, Math.PI * 2); g.stroke(); g.restore();
    }
  }

  // ---------------- tidslinje
  let lastT = 0;
  function loop() {
    if (!st) return;
    raf = requestAnimationFrame(loop);
    const t = now(), dt = Math.min(0.05, Math.max(0, t - lastT) || 0.016); lastT = t;
    const pre = Math.min(1, t / DROP), post = t >= DROP;
    root.style.setProperty('--pre', pre.toFixed(3));
    // intro: bogstaverne kommer på skift (sidste bogstav lige før droppet), scoren tæller op
    const L = st.T.name.length, letters = Math.min(L, Math.floor(Math.max(0, t - 2.0) / ((DROP - 2.6) / L)) + (t > 2 ? 1 : 0));
    if (letters !== st.letters) { const sp = $('vcTitle').children; for (let i = 0; i < sp.length; i++) sp[i].classList.toggle('in', i < letters); if (letters > st.letters && t < DROP) Audio.click('switch'); st.letters = letters; }
    const sc = st.m.score, cf = Math.min(1, Math.max(0, (t - 3.5) / 7));
    $('vcScoreA').textContent = Math.round(sc[0] * cf); $('vcScoreB').textContent = Math.round(sc[1] * cf);
    if (!post) {
      if (Math.random() < dt * (6 + 40 * pre * pre)) rise(1 + (pre > 0.7 ? 2 : 0));
      root.style.setProperty('--shake', (pre > 0.8 ? (pre - 0.8) * 5 * 6 : 0).toFixed(2) + 'px');
      if (t > 1.5 && !st.slash) { st.slash = true; root.classList.add('slash'); }
    } else {
      if (!st.dropDone) {                                             // DROPPET
        st.dropDone = true; root.classList.add('drop'); root.style.setProperty('--shake', '0px');
        burst(260, 0.5, 0.42, 1500 * (fx.width / 1600)); burst(80, 0.5, 0.42, 1900 * (fx.width / 1600), 'spark');
        rings.push({ t: 0, dur: 1.1, r: 0.9, w: 40, a: 0.9, c: '#ffffff' }, { t: 0, dur: 1.6, r: 1.2, w: 22, a: 0.8, c: st.T.col });
        setTimeout(() => { if (st) { burst(90, 0.08, 1.0, 1400 * (fx.width / 1600)); burst(90, 0.92, 1.0, 1400 * (fx.width / 1600)); } }, 120);
      }
      const b = Math.floor((t - DROP) / BEAT);
      if (b !== st.lastBeat) {                                        // beat: puls, og hver takt (4 slag) et lille konfetti-pust + ring
        st.lastBeat = b; root.classList.remove('beat'); void root.offsetWidth; root.classList.add('beat');
        if (b % 4 === 0) { rings.push({ t: 0, dur: 0.9, r: 0.6, w: 10, a: 0.45, c: st.T.col }); if (t < END - 6) burst(24, Math.random() < 0.5 ? 0.15 : 0.85, -0.02, 500 * (fx.width / 1600)); }
      }
      // leaderboard: glider ind 2,5 s efter droppet; en række pr. slag
      if (t > DROP + 2.6) {
        root.classList.add('board');
        const rows = $('vcBoard').querySelectorAll('.vb-row'), n = Math.min(rows.length, Math.floor((t - DROP - 2.6) / BEAT) + 1);
        for (let i = st.rowsShown; i < n; i++) { rows[i].classList.add('in'); st.rowsShown = i + 1; }
        rows.forEach((r, i) => { if (!r.classList.contains('in')) return; const k = Math.min(1, (t - DROP - 2.6 - i * BEAT) / 1.2); r.querySelectorAll('[data-n]').forEach(c => { c.textContent = Math.round(+c.dataset.n * Math.max(0, k)); }); });
      }
      if (t > DROP + 6.5 && !st.mvpShown && st.mvp) { st.mvpShown = true; root.classList.add('mvp'); rings.push({ t: 0, dur: 1.2, r: 0.5, w: 16, a: 0.7, c: '#ffd23a' }); }
      if (Math.random() < dt * 3) rise(1);
      if (t > END) root.classList.add('out');
    }
    drawFx(dt, t);
  }
  return { show, hide, get active() { return !!st; }, get t() { return st ? now() : 0; } };
}
