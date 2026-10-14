// v14 udviklerhjælpere til bane-QA (kun i dev: `await import('/dev/helpers.js')` i konsollen med ?dev=1 og testserveren WD_TEST=1).
//   save(canvas, navn)                       – gemmer et canvas som docs/qa/<navn>
//   mapCrop(bane, navn, lo, hi, x0, z0, x1, z1, S) – kort ovenfra af et udsnit: gulve i [lo, lo+1], mure der skærer lo+1,6 m, props, ramper, døre, callouts
//   perf({ q, pr, n, only })               – fase 8: ydelse over foto-turens kameraer (åbn først ?dev=1&tour=<bane>&shots=1)
const wd = () => window.__wd;
export async function save(cv, f) {
  const bl = await new Promise(r => cv.toBlob(r, f.endsWith('.png') ? 'image/png' : 'image/jpeg', 0.86));
  await fetch('/dev/save?f=' + encodeURIComponent(f), { method: 'POST', body: bl }); return f;
}
export async function mapCrop(id, f, lo, hi, x0, z0, x1, z1, S) {
  if (wd().Renderer.mapId !== id) await wd().tour(id, [{ n: 'x', x: 0, y: 40, z: 0, yaw: 0, pitch: -1.5 }]);
  const W = wd().W, pad = 34, cv = document.createElement('canvas'); cv.width = (x1 - x0) * S + pad * 2; cv.height = (z1 - z0) * S + pad * 2;
  const c = cv.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
  const X = x => pad + (x - x0) * S, Z = z => pad + (z - z0) * S, fl = [], wl = [];
  for (const q of W.boxes) {
    if (q.kind === 'clip' || q.kind === 'bound' || q.x1 < x0 || q.x0 > x1 || q.z1 < z0 || q.z0 > z1) continue;
    if (q.y1 >= lo - 0.3 && q.y1 <= lo + 1.0) fl.push(q); else if (q.y0 < lo + 1.6 && q.y1 > lo + 1.6) wl.push(q);
  }
  for (const q of fl) { c.fillStyle = q.kind === 'prop' ? '#b0703a' : '#2d4650'; c.fillRect(X(q.x0), Z(q.z0), (q.x1 - q.x0) * S, (q.z1 - q.z0) * S); }
  for (const q of wl) { c.fillStyle = q.kind === 'prop' ? '#d08a40' : q.kind === 'rail' ? '#dd0' : '#9a9aa4'; c.fillRect(X(q.x0), Z(q.z0), Math.max(1, (q.x1 - q.x0) * S), Math.max(1, (q.z1 - q.z0) * S)); }
  for (const r of W.ramps) { c.strokeStyle = '#0ff'; c.lineWidth = 2; c.strokeRect(X(r.bx0), Z(r.bz0), (r.bx1 - r.bx0) * S, (r.bz1 - r.bz0) * S); }
  for (const cy of W.cyls) { c.strokeStyle = '#fff'; c.beginPath(); c.arc(X(cy.x), Z(cy.z), cy.r * S, 0, 7); c.stroke(); }
  for (const l of W.ladders) { c.fillStyle = '#f0f'; c.fillRect(X(l.x0) - 2, Z(l.z0) - 2, Math.max(4, (l.x1 - l.x0) * S), Math.max(4, (l.z1 - l.z0) * S)); }
  c.strokeStyle = 'rgba(255,255,255,.15)'; c.fillStyle = '#bbb'; c.font = '11px monospace';
  const step = S >= 12 ? 2 : 5;
  for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) { c.beginPath(); c.moveTo(X(x), pad); c.lineTo(X(x), cv.height - pad); c.stroke(); if (x % (step * 2) === 0) c.fillText(x, X(x) - 6, pad - 8); }
  for (let z = Math.ceil(z0 / step) * step; z <= z1; z += step) { c.beginPath(); c.moveTo(pad, Z(z)); c.lineTo(cv.width - pad, Z(z)); c.stroke(); if (z % (step * 2) === 0) c.fillText(z, 2, Z(z) + 4); }
  c.font = 'bold 14px sans-serif'; c.textAlign = 'center';
  for (const l of W.labels) { const ly = l.y || 0; if (Math.abs(ly - lo) > Math.max(1.5, hi - lo)) continue; c.fillStyle = '#000'; c.fillText(l.text, X(l.x) + 1, Z(l.z) + 1); c.fillStyle = '#ff6'; c.fillText(l.text, X(l.x), Z(l.z)); }
  for (const k in W.sites) { const s = W.sites[k]; c.strokeStyle = '#f33'; c.setLineDash([6, 4]); c.lineWidth = 2; c.strokeRect(X(s.x0), Z(s.z0), (s.x1 - s.x0) * S, (s.z1 - s.z0) * S); c.setLineDash([]); }
  return save(cv, f);
}
export const yawTo = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));

// v14 fase 8: gennemløbstid pr. kamera i foto-turen – n frames i træk (inkl. skyggekort hver 2. frame og post-processing), én
//   GPU-synkronisering til sidst (readPixels). gl.finish og timer-queries er upålidelige på ANGLE/Metal, så dette er målemetoden.
//   Mål efter en pause: under lang fuld belastning skruer en Mac ned for GPU-takten. Sæt viewporten til fx 2560×1440 før målingen.
//   Draw calls tælles separat for hovedpasset (uden skyggekort) og som gennemsnit med skyggekort.
export function perf(o = {}) {
  const R = wd().Renderer, rr = R.renderer, gl = rr.getContext(), info = rr.info, px = new Uint8Array(4);
  if (o.q) R.setQuality(o.q); rr.setPixelRatio(o.pr || 1);
  const shots = R.tourShots().filter(s => !/OVERSIGT/.test(s.n) && (!o.only || o.only.test(s.n))), N = o.n || 8, res = [];
  const sync = () => { rr.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
  for (const s of shots) {
    R.setCam(s.x, s.y, s.z, s.yaw, s.pitch); for (let i = 0; i < 3; i++) R.frame(0.3); sync();
    const t0 = performance.now(); for (let i = 0; i < N; i++) R.frame(0.016); sync(); const ms = (performance.now() - t0) / N;
    info.autoReset = false; rr.shadowMap.autoUpdate = false; info.reset(); R.frame(0.016); const main = info.render.calls, tris = info.render.triangles;
    rr.shadowMap.autoUpdate = true; info.reset(); R.frame(0.016); R.frame(0.016); const avg = info.render.calls / 2; info.autoReset = true;
    res.push({ n: s.n, ms: +ms.toFixed(1), main, avg, ktri: Math.round(tris / 1000) });
  }
  const q = (k, f) => { const v = res.map(r => r[k]).sort((a, b) => a - b); return v[Math.min(v.length - 1, Math.floor(v.length * f))]; };
  return { map: R.mapId, px: gl.drawingBufferWidth + 'x' + gl.drawingBufferHeight, gfx: R.gfx, shots: res.length,
    ms: { median: q('ms', 0.5), p90: q('ms', 0.9), max: q('ms', 1) }, calls: { mainMedian: q('main', 0.5), mainMax: q('main', 1), withShadowMax: q('avg', 1) },
    ktriMax: q('ktri', 1), worst: res.sort((a, b) => b.ms - a.ms).slice(0, 5).map(r => r.n + ' ' + r.ms + ' ms') };
}
