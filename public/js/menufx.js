// ==========================================================================
// v21: FORSIDENS EFFEKTER (SUPERHOT-stil) – alt sammen DOM/CSS + én 2D-canvas (ingen ekstra WebGL):
//   • boot-intro: WHITE / DUST blinker ind fuldskærm, før menuen bygges (kun ved første besøg pr. side-indlæsning)
//   • sigtekorns-markør med forsinket ring; ved klik: ring-bølge + skår
//   • knapper: glitch-split og blæk-fyld ved hover, splintres i skår ved klik
//   • titlen: bogstaverne skubbes væk fra musen og hopper tilbage (fjeder)
//   • agent-kortet: 3D-tilt efter musen med holografisk folie; træk for at dreje figuren
//   • bane-rotation: kort med radar + navn der skifter med scanner-glitch
// createMenuFx({ $, root, maps, drawRadar, onSpin, onMapClick }) -> { start(), stop() }
// ==========================================================================
export function createMenuFx(o) {
  const { $, root } = o;
  let on = false, raf = 0, mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
  // ---- markør + skår-canvas
  const fxc = document.createElement('canvas'); fxc.className = 'mfx-canvas'; root.appendChild(fxc);
  const g = fxc.getContext('2d');
  const cur = document.createElement('div'); cur.className = 'mfx-cursor'; cur.innerHTML = '<i class="h"></i><i class="v"></i><b></b>'; root.appendChild(cur);
  const ring = document.createElement('div'); ring.className = 'mfx-ring'; root.appendChild(ring);
  const parts = [];
  function size() { const d = Math.min(2, devicePixelRatio || 1); if (fxc.width !== innerWidth * d) { fxc.width = innerWidth * d; fxc.height = innerHeight * d; } return d; }
  function burst(x, y, n, col, spd) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (spd || 420) * (0.3 + Math.random());
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, r: Math.random() * 6, vr: (Math.random() - 0.5) * 18, s: 5 + Math.random() * 11, c: Math.random() < 0.75 ? (col || '#ff2b1f') : '#0a0a0a', t: 0, max: 0.7 + Math.random() * 0.6 });
    }
  }
  const waves = [];
  addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });
  root.addEventListener('pointerdown', e => {
    if (!on) return;
    waves.push({ x: e.clientX, y: e.clientY, t: 0 });
    const btn = e.target.closest('.btn');
    if (btn) { const b = btn.getBoundingClientRect(); burst(b.left + b.width / 2, b.top + b.height / 2, 26, '#ff2b1f', 560); btn.classList.remove('mfx-hit'); void btn.offsetWidth; btn.classList.add('mfx-hit'); }
    else burst(e.clientX, e.clientY, 8, '#ff2b1f', 260);
  });
  // knapper: data-text til glitch-lagene
  for (const b of root.querySelectorAll('.menu-actions .btn')) b.dataset.text = b.textContent.trim();
  // titlen: bogstaver i spans med fjeder
  const title = root.querySelector('.logo'), letters = [];
  if (title) {
    const txt = title.textContent.replace('▮', '').trim(); title.innerHTML = '';
    [...txt].forEach(ch => { const s = document.createElement('span'); s.className = 'mfx-l' + (ch === '_' ? ' us' : ''); s.textContent = ch; title.appendChild(s); letters.push({ el: s, x: 0, y: 0, vx: 0, vy: 0, r: 0, vr: 0 }); });
    const c = document.createElement('span'); c.className = 'cursor'; c.textContent = '▮'; title.appendChild(c);
    title.dataset.g = txt;
  }
  // agent-kortet: tilt + holo + træk-for-at-dreje
  const card = $('menuAgent'), frame = $('maFrame');
  let drag = null, spinV = 0;
  if (card) {
    const holo = document.createElement('div'); holo.className = 'ma-holo'; frame.appendChild(holo);
    frame.addEventListener('pointerdown', e => { drag = { x: e.clientX, moved: 0 }; frame.setPointerCapture(e.pointerId); e.stopPropagation(); });
    frame.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x; drag.x = e.clientX; drag.moved += Math.abs(dx); spinV = dx * 0.012; if (o.onSpin) o.onSpin(dx * 0.012); });
    frame.addEventListener('pointerup', e => { const was = drag; drag = null; if (was && was.moved < 6 && o.onCardClick) o.onCardClick(); });
  }
  // bane-rotation
  const mapCard = $('menuMaps'); let mi = 0, mapT = 0;
  function showMap(i) {
    if (!mapCard || !o.maps || !o.maps.length) return;
    const mp = o.maps[(i + o.maps.length) % o.maps.length];
    mapCard.classList.remove('swap'); void mapCard.offsetWidth; mapCard.classList.add('swap');
    setTimeout(() => {
      $('mmName').textContent = (mp.name || mp.id).toUpperCase(); $('mmDesc').textContent = mp.desc || ''; $('mmIdx').textContent = String((i % o.maps.length) + 1).padStart(2, '0') + ' / ' + String(o.maps.length).padStart(2, '0');
      try { o.drawRadar($('mmCanvas'), mp.id); } catch (e) {}
    }, 140);
  }
  if (mapCard) {
    mapCard.addEventListener('click', () => { mi++; mapT = 0; showMap(mi); });
  }
  // ---- løkke
  let last = 0;
  function frameLoop(t) {
    if (!on) return; raf = requestAnimationFrame(frameLoop);
    const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
    rx += (mx - rx) * Math.min(1, dt * 14); ry += (my - ry) * Math.min(1, dt * 14);
    cur.style.transform = `translate(${mx}px, ${my}px)`; ring.style.transform = `translate(${rx}px, ${ry}px)`;
    const over = document.elementFromPoint(mx, my), hot = over && over.closest('button, a, .ma-frame, .mm-card, input, .logo-slot');
    root.classList.toggle('mfx-hot', !!hot); root.classList.toggle('mfx-text', !!(over && over.closest('input')));
    // titel-fjedre
    for (const L of letters) {
      const b = L.el.getBoundingClientRect(), cx = b.left + b.width / 2 - L.x, cy = b.top + b.height / 2 - L.y, dx = cx - mx, dy = cy - my, d = Math.hypot(dx, dy);
      const f = d < 140 ? (140 - d) / 140 : 0;
      L.vx += (dx / (d || 1) * f * 900 - L.x * 160) * dt; L.vy += (dy / (d || 1) * f * 900 - L.y * 160) * dt; L.vr += (f * (dx > 0 ? 40 : -40) - L.r * 150) * dt;
      L.vx *= Math.exp(-dt * 9); L.vy *= Math.exp(-dt * 9); L.vr *= Math.exp(-dt * 9);
      L.x += L.vx * dt; L.y += L.vy * dt; L.r += L.vr * dt;
      L.el.style.transform = `translate(${L.x.toFixed(1)}px, ${L.y.toFixed(1)}px) rotate(${L.r.toFixed(1)}deg)`;
    }
    // agent-kort: tilt mod musen
    if (card && card.offsetParent) {
      const b = frame.getBoundingClientRect(), nx = (mx - (b.left + b.width / 2)) / innerWidth, ny = (my - (b.top + b.height / 2)) / innerHeight;
      frame.style.setProperty('--tx', (ny * -18).toFixed(2) + 'deg'); frame.style.setProperty('--ty', (nx * 22).toFixed(2) + 'deg');
      frame.style.setProperty('--hx', (50 + nx * 120).toFixed(1) + '%'); frame.style.setProperty('--hy', (50 + ny * 120).toFixed(1) + '%');
      if (!drag && Math.abs(spinV) > 0.0005 && o.onSpin) { o.onSpin(spinV); spinV *= Math.exp(-dt * 3); }
    }
    // bane-rotation
    mapT += dt; if (mapT > 5) { mapT = 0; mi++; showMap(mi); }
    // skår + bølger
    const d = size(); g.clearRect(0, 0, fxc.width, fxc.height); g.save(); g.scale(d, d);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.t += dt; if (p.t > p.max) { parts.splice(i, 1); continue; }
      p.vy += 900 * dt; p.vx *= 1 - dt * 1.5; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      g.save(); g.globalAlpha = 1 - p.t / p.max; g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c;
      g.beginPath(); g.moveTo(0, -p.s * 0.6); g.lineTo(p.s * 0.5, p.s * 0.4); g.lineTo(-p.s * 0.45, p.s * 0.25); g.closePath(); g.fill(); g.restore();
    }
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i]; w.t += dt; if (w.t > 0.5) { waves.splice(i, 1); continue; }
      g.strokeStyle = `rgba(255,43,31,${(1 - w.t / 0.5).toFixed(3)})`; g.lineWidth = 3; g.beginPath(); g.arc(w.x, w.y, 8 + w.t * 140, 0, Math.PI * 2); g.stroke();
    }
    g.restore();
  }
  // ---- boot-intro (én gang pr. side-indlæsning)
  let booted = false;
  function boot() {
    if (booted) return; booted = true;
    const el = document.createElement('div'); el.className = 'mfx-boot';
    el.innerHTML = '<b class="w1">WHITE</b><b class="w2">DUST</b><i></i>';
    root.appendChild(el); root.classList.add('booting');
    const done = () => { el.remove(); root.classList.remove('booting'); };
    el.addEventListener('pointerdown', done);
    setTimeout(done, 1900);
  }
  return {
    start() { if (on) return 0; on = true; root.classList.add('mfx-on'); const first = !booted; boot(); last = 0; showMap(mi); raf = requestAnimationFrame(frameLoop); return first ? 1.6 : 0; },   // returnerer boot-forsinkelsen (s)
    stop() { on = false; root.classList.remove('mfx-on'); cancelAnimationFrame(raf); },
    burst
  };
}
