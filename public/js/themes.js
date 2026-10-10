// ==========================================================================
// THEMES (v8): delt bibliotek (teksturer, prop-modeller, vegetation, lamper, døre) + register over banernes temaer.
//   createThemes(ctx) -> { white_dust(), nuke(), ancient() } – hvert tema bygges først når banen vælges.
// Et tema leverer: light, lamps, surf()/surfKinds (materialer pr. flade), trim(), dressProp/Cyl/Ladder/Rail/Lamp, decor(), fx(), doorStyle().
// Intet placeres tilfældigt: al dekoration placeres eksplicit eller efter faste regler (fx lamper med fast afstand).
// ==========================================================================
import { nukeTheme } from './theme_nuke.js';
import { dustTheme } from './theme_dust.js';
import { ancientTheme } from './theme_ancient.js';
import { infernoTheme } from './theme_inferno.js';
import { havnTheme } from './theme_havn.js';
import { canalsTheme } from './theme_canals.js';
import { createDetails } from './details.js';

export function createThemes(C) {
  const { THREE, W, P, mkTex, mat, unlit, leafMat, rnd, hash2, col } = C;
  const TAU = Math.PI * 2;
  const tint = (hex, k) => { const c = col(hex); return k === undefined ? c : [c[0] * k, c[1] * k, c[2] * k]; };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

  /* ======================================================== tekstur-malere ======================================================== */
  const T = {};
  T.wood = () => mkTex((c, w, h) => {
    const R = rnd(5), n = 4, ph = h / n;
    for (let i = 0; i < n; i++) {
      const v = 214 + R() * 30 | 0; c.fillStyle = `rgb(${v},${v - 28},${v - 70})`; c.fillRect(0, i * ph, w, ph);
      for (let k = 0; k < 70; k++) { c.strokeStyle = `rgba(80,45,15,${0.04 + R() * 0.12})`; c.lineWidth = 1 + R() * 1.2; const y = i * ph + 4 + R() * (ph - 8), x = R() * w; c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + 40, y + (R() - 0.5) * 4, x + 90, y + (R() - 0.5) * 4, x + 150 + R() * 200, y + (R() - 0.5) * 3); c.stroke(); }
      if (R() < 0.7) { const kx = R() * w, ky = i * ph + ph / 2 + (R() - 0.5) * 10; c.fillStyle = 'rgba(70,40,15,.55)'; c.beginPath(); c.ellipse(kx, ky, 7, 4, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(70,40,15,.3)'; c.beginPath(); c.ellipse(kx, ky, 13, 7, 0, 0, TAU); c.stroke(); }
      c.fillStyle = 'rgba(30,18,6,.7)'; c.fillRect(0, i * ph, w, 3); c.fillStyle = 'rgba(255,230,190,.18)'; c.fillRect(0, i * ph + 3, w, 2);
    }
    for (let i = 0; i < 4; i++) for (const x of [16, w - 16]) { c.fillStyle = 'rgba(40,30,25,.85)'; c.beginPath(); c.arc(x, i * ph + ph / 2, 4, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x - 1, i * ph + ph / 2 - 3, 2, 2); }
    P.blobs(c, w, h, 14, 20, 70, '60,40,20', 0.12, R); P.speckle(c, w, h, 900, 60, 200, 0.2, 2, R);
  }, 512);
  T.metal = () => mkTex((c, w, h) => {               // malede stålplader med nitter og let slid
    const R = rnd(9); c.fillStyle = '#cfd2d4'; c.fillRect(0, 0, w, h);
    for (let px = 0; px < 2; px++) for (let py = 0; py < 2; py++) { const x = px * w / 2, y = py * h / 2, v = 202 + R() * 20 | 0; c.fillStyle = `rgb(${v},${v + 2},${v + 4})`; c.fillRect(x + 3, y + 3, w / 2 - 6, h / 2 - 6); P.bevel(c, x + 3, y + 3, w / 2 - 6, h / 2 - 6, 'rgba(255,255,255,.4)', 'rgba(0,0,0,.35)'); for (let k = 0; k < 8; k++) for (const [rx, ry] of [[x + 14, y + 14 + k * 30], [x + w / 2 - 14, y + 14 + k * 30]]) { c.fillStyle = 'rgba(60,60,60,.7)'; c.beginPath(); c.arc(rx, ry, 3, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(rx - 1, ry - 2, 2, 1); } }
    P.streaks(c, w, h, 14, '110,70,35', 0.18, 40, 160, 5, R); P.blobs(c, w, h, 8, 20, 60, '90,80,70', 0.12, R); P.speckle(c, w, h, 1400, 60, 240, 0.18, 2, R);
  }, 512);
  T.steel = () => mkTex((c, w, h) => {               // børstet/malet stål (ensartet – til stænger, rør, rammer)
    const R = rnd(91); c.fillStyle = '#c8cbcd'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { const y = R() * h, v = 170 + R() * 70 | 0; c.fillStyle = `rgba(${v},${v},${v},.25)`; c.fillRect(0, y, w, 1); }
    P.speckle(c, w, h, 900, 60, 220, 0.15, 2, R); P.blobs(c, w, h, 6, 10, 40, '80,70,60', 0.12, R);
  }, 256);
  T.corr = () => mkTex((c, w, h) => {                // korrugeret plade (containere, garage)
    const R = rnd(13), n = 32, sw = w / n;
    for (let i = 0; i < n; i++) { const g = c.createLinearGradient(i * sw, 0, (i + 1) * sw, 0); g.addColorStop(0, 'rgb(130,130,130)'); g.addColorStop(0.35, 'rgb(236,236,236)'); g.addColorStop(0.5, 'rgb(250,250,250)'); g.addColorStop(1, 'rgb(120,120,120)'); c.fillStyle = g; c.fillRect(i * sw, 0, sw + 1, h); }
    P.streaks(c, w, h, 26, '100,50,20', 0.22, 60, 220, 8, R); P.blobs(c, w, h, 10, 30, 90, '110,60,25', 0.12, R); P.speckle(c, w, h, 1200, 40, 255, 0.12, 2, R);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, 0, w, 5); c.fillRect(0, h - 5, w, 5);
  }, 512);
  T.conc = () => mkTex((c, w, h) => {                // støbt beton med forskallingshuller
    const R = rnd(21); c.fillStyle = '#cbc9c3'; c.fillRect(0, 0, w, h);
    P.blobs(c, w, h, 26, 30, 110, '110,108,100', 0.12, R); P.blobs(c, w, h, 18, 20, 70, '240,238,230', 0.1, R); P.speckle(c, w, h, 3200, 90, 245, 0.25, 2, R);
    c.fillStyle = 'rgba(40,40,40,.22)'; c.fillRect(0, h / 2 - 1, w, 2); c.fillRect(w / 2 - 1, 0, 2, h); c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(0, h / 2 + 1, w, 1);
    for (const x of [w / 4, 3 * w / 4]) for (const y of [h / 4, 3 * h / 4]) { c.fillStyle = 'rgba(30,30,30,.45)'; c.beginPath(); c.arc(x, y, 5, 0, TAU); c.fill(); c.strokeStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.arc(x, y, 9, 0, TAU); c.stroke(); }
    P.cracks(c, w, h, 4, 'rgba(40,40,40,.35)', 10, R); P.streaks(c, w, h, 14, '70,60,50', 0.16, 60, 200, 8, R);
  }, 512);
  T.sand = () => mkTex((c, w, h) => {                // jute (sandsække)
    const R = rnd(33); c.fillStyle = '#d9c9a0'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(120,95,55,.28)'; c.lineWidth = 1; for (let i = 0; i < w; i += 5) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); } for (let j = 0; j < h; j += 5) { c.beginPath(); c.moveTo(0, j); c.lineTo(w, j); c.stroke(); }
    c.strokeStyle = 'rgba(255,240,200,.22)'; for (let i = 2; i < w; i += 5) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); }
    P.blobs(c, w, h, 24, 20, 80, '110,85,50', 0.22, R); P.speckle(c, w, h, 1600, 80, 220, 0.2, 2, R);
    c.strokeStyle = 'rgba(70,50,30,.5)'; c.setLineDash && c.setLineDash([6, 4]); c.lineWidth = 2; c.beginPath(); c.moveTo(0, h * 0.5); c.lineTo(w, h * 0.5); c.stroke();
  }, 512);
  T.hazard = () => mkTex((c, w, h) => {
    c.fillStyle = '#f0c010'; c.fillRect(0, 0, w, h); c.fillStyle = '#1b1b1b';
    for (let i = -h; i < w + h; i += 64) { c.beginPath(); c.moveTo(i, h); c.lineTo(i + 32, h); c.lineTo(i + 32 + h, 0); c.lineTo(i + h, 0); c.closePath(); c.fill(); }
    const R = rnd(3); P.speckle(c, w, h, 1500, 40, 200, 0.18, 2, R); P.blobs(c, w, h, 10, 20, 60, '40,30,10', 0.16, R);
  }, 256);
  T.grate = () => mkTex((c, w, h) => {               // gitterrist (uigennemsigtig: mørke huller)
    c.fillStyle = '#26292c'; c.fillRect(0, 0, w, h); const R = rnd(41);
    for (let i = 0; i < w; i += 16) { c.fillStyle = '#9ca3a8'; c.fillRect(i, 0, 4, h); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(i, 0, 1, h); }
    for (let j = 0; j < h; j += 32) { c.fillStyle = '#7d858a'; c.fillRect(0, j, w, 3); }
    for (let i = 0; i < w; i += 128) { c.fillStyle = '#5b6165'; c.fillRect(i, 0, 8, h); }
    P.streaks(c, w, h, 10, '110,70,35', 0.18, 40, 160, 6, R); P.speckle(c, w, h, 1200, 40, 200, 0.18, 2, R);
  }, 256);
  T.diamond = () => mkTex((c, w, h) => {             // riflet stålplade
    c.fillStyle = '#8f969b'; c.fillRect(0, 0, w, h); const R = rnd(43);
    for (let y = 0; y < h; y += 24) for (let x = 0; x < w; x += 24) { c.save(); c.translate(x + 12, y + 12); c.rotate(((x / 24 + y / 24) % 2 ? 1 : -1) * 0.78); c.fillStyle = 'rgba(225,230,233,.85)'; c.fillRect(-9, -2, 18, 4); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(-9, 2, 18, 1.4); c.restore(); }
    P.blobs(c, w, h, 10, 20, 60, '30,30,30', 0.18, R); P.speckle(c, w, h, 1500, 40, 200, 0.18, 2, R);
  }, 256);
  T.stone = (seed, mossy, base) => mkTex((c, w, h) => {     // skårne stenblokke (evt. med mos i fugerne)
    const R = rnd(seed || 41); c.fillStyle = base || '#6e6a5c'; c.fillRect(0, 0, w, h);
    let y = 0; const rows = [0.18, 0.22, 0.2, 0.2, 0.2];
    for (const rh of rows) { const hh = rh * h; let x = -R() * 60; while (x < w) { const bw = 90 + R() * 120, v = 170 + R() * 40 | 0; c.fillStyle = `rgb(${v},${v - 6},${v - 22})`; c.fillRect(x + 3, y + 3, bw - 6, hh - 6); P.bevel(c, x + 3, y + 3, bw - 6, hh - 6, 'rgba(255,255,255,.16)', 'rgba(0,0,0,.28)');
      for (let k = 0; k < 30; k++) { c.strokeStyle = `rgba(60,55,40,${0.08 + R() * 0.12})`; c.beginPath(); const sx = x + 6 + R() * (bw - 12), sy = y + 6 + R() * (hh - 12); c.moveTo(sx, sy); c.lineTo(sx + (R() - 0.5) * 22, sy + (R() - 0.5) * 8); c.stroke(); }
      x += bw; } y += hh; }
    P.cracks(c, w, h, 7, 'rgba(30,28,20,.45)', 12, R); P.speckle(c, w, h, 3500, 80, 230, 0.22, 2, R);
    if (mossy) { P.blobs(c, w, h, 40, 14, 60, '70,120,40', 0.5, R); P.blobs(c, w, h, 24, 10, 36, '110,150,50', 0.4, R); P.streaks(c, w, h, 26, '60,100,35', 0.5, 20, 90, 10, R); P.tint(c, w, h, 500, '200,190,80', 0.4, 2, R); }
  }, 512);
  T.soft = () => mkTex((c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }, 128, { clamp: true });
  // skilt/stencil: tekst på baggrund (eller udstanset stencil med alpha-test, når bg = null)
  T.text = (txt, bg, fg, w2, h2, border, font) => mkTex((c, w, h) => {
    if (bg) { c.fillStyle = bg; c.fillRect(0, 0, w, h); } else c.clearRect(0, 0, w, h);
    if (border) { c.strokeStyle = border; c.lineWidth = Math.max(6, h * 0.06); c.strokeRect(c.lineWidth, c.lineWidth, w - c.lineWidth * 2, h - c.lineWidth * 2); }
    c.fillStyle = fg; let fs = Math.round(h * 0.5); c.font = `900 ${fs}px ${font || 'Arial'}`; while (c.measureText(txt).width > w * 0.88 && fs > 8) { fs -= 2; c.font = `900 ${fs}px ${font || 'Arial'}`; }
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, w / 2, h / 2 + 2);
  }, 256, { w: (w2 || 512) * 2, h: (h2 || 128) * 2, clamp: true, aniso: 16 });   // v14: dobbelt opløsning + fuld anisotropi – skarpe skilte på skrå vinkler

  /* ---- blad-teksturer (alpha-test) ---- */
  const leafCanvas = (draw, size) => mkTex(draw, 256, { w: size && size[0] || 256, h: size && size[1] || 256, clamp: true });
  T.frond = () => leafCanvas((c, w, h) => {
    c.lineCap = 'round';
    for (let i = 0; i < 26; i++) { const t = i / 25, sx = w * 0.5, sy = h - 6 - t * (h - 20), len = (w * 0.46) * (Math.sin(t * Math.PI * 0.9) * 0.8 + 0.2);
      for (const sd of [-1, 1]) { const ex = sx + sd * len, ey = sy + len * 0.38 + 6; const gr = c.createLinearGradient(sx, sy, ex, ey); gr.addColorStop(0, '#3f7a2c'); gr.addColorStop(1, '#8fbf46'); c.strokeStyle = gr; c.lineWidth = 3.4 - t * 1.6; c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(sx + sd * len * 0.55, sy - len * 0.16, ex, ey); c.stroke(); } }
    c.strokeStyle = '#2d5a20'; c.lineWidth = 4; c.beginPath(); c.moveTo(w * 0.5, h); c.lineTo(w * 0.5, 4); c.stroke();
  });
  T.broad = () => leafCanvas((c, w, h) => {
    const R = rnd(11); const g = c.createLinearGradient(0, h, 0, 0); g.addColorStop(0, '#2f6a2a'); g.addColorStop(1, '#6fb23c'); c.fillStyle = g;
    c.beginPath(); c.moveTo(w / 2, h - 2); c.bezierCurveTo(w * 0.05, h * 0.75, w * 0.02, h * 0.25, w / 2, 4); c.bezierCurveTo(w * 0.98, h * 0.25, w * 0.95, h * 0.75, w / 2, h - 2); c.fill();
    c.strokeStyle = 'rgba(20,60,15,.6)'; c.lineWidth = 3; c.beginPath(); c.moveTo(w / 2, h - 2); c.lineTo(w / 2, 6); c.stroke(); c.lineWidth = 1.4;
    for (let i = 1; i < 9; i++) { const y = h - i * h / 9.5; for (const sd of [-1, 1]) { const ext = w * 0.36 * Math.sin(Math.PI * Math.min(0.98, i / 9.5)); c.beginPath(); c.moveTo(w / 2, y); c.lineTo(w / 2 + sd * ext * 0.95, y - 24); c.stroke(); } }
    P.blobs(c, w, h, 8, 10, 40, '210,230,120', 0.18, R);
  });
  T.fern = () => leafCanvas((c, w, h) => {
    c.lineCap = 'round';
    for (let i = 0; i < 30; i++) { const t = i / 29, y = h - 4 - t * (h - 14), l = (w * 0.42) * (1 - t * 0.85); for (const sd of [-1, 1]) { c.strokeStyle = i % 2 ? '#3a8a35' : '#4fa03c'; c.lineWidth = 3 - t * 1.8; c.beginPath(); c.moveTo(w / 2, y); c.lineTo(w / 2 + sd * l, y - l * 0.35); c.stroke(); } }
    c.strokeStyle = '#2a5a26'; c.lineWidth = 3; c.beginPath(); c.moveTo(w / 2, h); c.lineTo(w / 2, 8); c.stroke();
  });
  T.vine = () => leafCanvas((c, w, h) => {
    const R = rnd(19); c.strokeStyle = '#3d5a25'; c.lineWidth = 3; c.beginPath(); c.moveTo(w / 2, 0); for (let y = 0; y < h; y += 16) c.lineTo(w / 2 + Math.sin(y * 0.05) * 6, y); c.stroke();
    for (let y = 10; y < h - 6; y += 18) for (const sd of [-1, 1]) { const x = w / 2 + Math.sin(y * 0.05) * 6 + sd * (8 + R() * 6), r = 9 + R() * 8; const g = c.createRadialGradient(x, y, 1, x, y, r); g.addColorStop(0, '#79b946'); g.addColorStop(1, '#2f6a2a'); c.fillStyle = g; c.beginPath(); c.ellipse(x, y, r, r * 0.8, sd * 0.6, 0, TAU); c.fill(); }
  }, [128, 512]);
  /* ---- v13: realistiske løv-teksturer (mange enkeltblade pr. kort, lys/skygge, ribber, uregelmæssig kant) ---- */
  const leafShape = (c, x, y, len, wid, ang, fill, vein) => {   // ét blad (spids ellipse) fra stilken i (x,y)
    c.save(); c.translate(x, y); c.rotate(ang);
    c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(wid * 0.6, -len * 0.18, wid * 0.55, -len * 0.75, 0, -len); c.bezierCurveTo(-wid * 0.55, -len * 0.75, -wid * 0.6, -len * 0.18, 0, 0);
    c.fillStyle = fill; c.fill();
    if (vein) { c.strokeStyle = vein; c.lineWidth = Math.max(0.6, wid * 0.06); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -len * 0.92); c.stroke(); }
    c.restore();
  };
  const leafCol = (R, dark) => { const h = 88 + R() * 34, s = 38 + R() * 22, l = (dark ? 16 : 24) + R() * (dark ? 10 : 20); return `hsl(${h},${s}%,${l}%)`; };
  T.canopy = () => leafCanvas((c, w, h) => {                // løvklump til trækroner: mørke blade bagest, lysere og større forrest
    const R = rnd(41);
    for (const [n, dark, sc] of [[150, true, 0.9], [170, false, 1.0], [70, false, 1.15]]) for (let i = 0; i < n; i++) {
      const a = R() * TAU, rr = Math.sqrt(R()) * 0.44, x = w / 2 + Math.cos(a) * rr * w, y = h / 2 + Math.sin(a) * rr * h * 0.9;
      const len = (22 + R() * 26) * sc, g = c.createLinearGradient(x, y, x, y - len);
      const base = leafCol(R, dark); g.addColorStop(0, base); g.addColorStop(1, dark ? base : `hsl(${80 + R() * 30},${45 + R() * 20}%,${36 + R() * 16}%)`);
      leafShape(c, x, y, len, len * (0.36 + R() * 0.12), a + Math.PI / 2 + (R() - 0.5) * 1.2, g, 'rgba(20,40,10,.35)');
    }
  }, [512, 512]);
  T.ivy = () => leafCanvas((c, w, h) => {                   // efeu-tæppe: tæt foroven, laset og hængende ranker forneden
    const R = rnd(53); c.lineCap = 'round';
    const strands = 14;
    for (let s = 0; s < strands; s++) {                     // ranker
      let x = (s + 0.5) / strands * w + (R() - 0.5) * 20, y = 0; const end = h * (0.45 + R() * 0.55);
      c.strokeStyle = 'rgba(70,58,34,.85)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y);
      const pts = []; while (y < end) { x += (R() - 0.5) * 10; y += 10; c.lineTo(x, y); pts.push([x, y]); } c.stroke();
      for (const [px, py] of pts) for (let k = 0; k < 2; k++) {
        const sd = k ? 1 : -1, len = 13 + R() * 11 * (1 - py / h * 0.5), lx = px + sd * (3 + R() * 5);
        const g = c.createRadialGradient(lx, py - len * 0.4, 1, lx, py - len * 0.4, len); g.addColorStop(0, `hsl(${92 + R() * 25},${45 + R() * 15}%,${34 + R() * 14}%)`); g.addColorStop(1, `hsl(${100 + R() * 20},${40 + R() * 15}%,${14 + R() * 8}%)`);
        c.save(); c.translate(lx, py); c.rotate(sd * (0.9 + R() * 0.8) + Math.PI);          // hjerteformet efeu-blad (3 lapper)
        c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(len * 0.55, len * 0.1, len * 0.6, len * 0.6, len * 0.18, len * 0.7); c.lineTo(0, len); c.lineTo(-len * 0.18, len * 0.7); c.bezierCurveTo(-len * 0.6, len * 0.6, -len * 0.55, len * 0.1, 0, 0);
        c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(200,230,150,.25)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, len * 0.8); c.stroke(); c.restore();
      }
    }
  }, [256, 512]);
  T.liana = () => leafCanvas((c, w, h) => {                 // hængende lian med spredte blade
    const R = rnd(61); let x = w / 2; c.strokeStyle = '#4a3a22'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, 0);
    for (let y = 0; y < h; y += 8) { x = w / 2 + Math.sin(y * 0.02) * 10; c.lineTo(x, y); } c.stroke();
    for (let y = 14; y < h - 10; y += 22 + R() * 14) { const xx = w / 2 + Math.sin(y * 0.02) * 10, sd = R() < 0.5 ? -1 : 1, len = 18 + R() * 14; leafShape(c, xx, y, len, len * 0.45, sd * (1.6 + R() * 0.6), leafCol(R, R() < 0.4), 'rgba(20,40,10,.4)'); }
  }, [128, 512]);
  T.grass = () => leafCanvas((c, w, h) => {
    const R = rnd(23); for (let i = 0; i < 26; i++) { const x = 20 + R() * (w - 40), l = h * (0.45 + R() * 0.5), bend = (R() - 0.5) * 60; const g = c.createLinearGradient(x, h, x + bend, h - l); g.addColorStop(0, '#3a6a2a'); g.addColorStop(1, '#a9c75a'); c.fillStyle = g; c.beginPath(); c.moveTo(x - 5, h); c.quadraticCurveTo(x + bend * 0.3, h - l * 0.6, x + bend, h - l); c.quadraticCurveTo(x + bend * 0.3 + 6, h - l * 0.5, x + 5, h); c.fill(); }
  });
  T.dry = () => leafCanvas((c, w, h) => {
    const R = rnd(29); c.lineCap = 'round'; for (let i = 0; i < 40; i++) { let x = w / 2, y = h - 2, a = -Math.PI / 2 + (R() - 0.5) * 1.8; c.strokeStyle = i % 3 ? '#8a6a3a' : '#a8884a'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 6; k++) { x += Math.cos(a) * 26; y += Math.sin(a) * 26; a += (R() - 0.5) * 0.7; c.lineTo(x, y); } c.stroke(); }
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(${150 + R() * 40 | 0},${120 + R() * 30 | 0},60,.8)`; c.beginPath(); c.arc(30 + R() * (w - 60), 20 + R() * (h - 40), 3 + R() * 3, 0, TAU); c.fill(); }
  });

  /* ======================================================== geometri-hjælpere ======================================================== */
  const _qa = new THREE.Quaternion(), _va = new THREE.Vector3(0, 1, 0), _vb = new THREE.Vector3();
  const orient = (dx, dy, dz) => { _vb.set(dx, dy, dz).normalize(); return _qa.clone().setFromUnitVectors(_va, _vb); };
  // skilt fladt på en væg: (x,y,z) midtpunkt, (nx,nz) vægnormal ud mod rummet
  function wallCard(B, m, x, y, z, nx, nz, ww, hh, o) {
    const tx = nz * ww / 2, tz = -nx * ww / 2, off = (o && o.off) || 0.03;
    B.card(m, [x - tx + nx * off, y - hh / 2, z - tz + nz * off], [x + tx + nx * off, y - hh / 2, z + tz + nz * off], [x + tx + nx * off, y + hh / 2, z + tz + nz * off], [x - tx + nx * off, y + hh / 2, z - tz + nz * off], Object.assign({ tint: [1, 1, 1], shadow: false }, o || {}));
  }
  // v9: skilt der KUN placeres hvor det ligger helt fladt på en væg (ingen klipning ind i hjørner, overliggere, rør eller props).
  //   Alle 4 hjørner + midten tjekkes med stråler fra 0,35 m foran skiltet ind mod væggen; ved afvigelse prøves forskudte positioner.
  function fitWallCard(B, m, x, y, z, nx, nz, ww, hh, o) {
    const WD = C.WD, tx = nz, tz = -nx, off = (o && o.off) || 0.05, D = 0.35;
    const flatAt = (cx, cy, cz) => {
      for (const [a, b] of [[0, 0], [-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [-0.5, 0], [0.5, 0]]) {
        const px = cx + tx * a * ww * 1.04 + nx * D, py = cy + b * hh * 1.08, pz = cz + tz * a * ww * 1.04 + nz * D;
        if (C.insideSolid(px, py, pz, false)) return false;                                 // noget står foran skiltet
        const n = { nx: 0, ny: 0, nz: 0 }, t = WD.raycastWorld(W, px, py, pz, -nx, 0, -nz, D + 0.25, n, true);
        if (Math.abs(t - D) > 0.02 || Math.abs(n.nx - nx) > 0.01 || Math.abs(n.nz - nz) > 0.01) return false;   // ikke samme plane vægflade
      }
      return true;
    };
    for (const dy of [0, -0.4, 0.4, -0.8]) for (const da of [0, -0.6, 0.6, -1.2, 1.2, -2.0, 2.0]) {
      const cx = x + tx * da, cz = z + tz * da, cy = y + dy;
      if (flatAt(cx, cy, cz)) { wallCard(B, m, cx, cy, cz, nx, nz, ww, hh, Object.assign({}, o || {}, { off })); return true; }
    }
    return false;                                                                           // hellere intet skilt end et der klipper
  }
  // v9: slankt, halvtransparent taktisk panel (skrå hjørner, accent-linje i holdfarve) – til callouts/spawn-skilte
  const panelCache = {};
  function panelMat(txt, accent) {
    const key = txt + '|' + accent; if (panelCache[key]) return panelCache[key];
    const tex = mkTex((c, w, h) => {
      c.clearRect(0, 0, w, h);
      const cut = 36, pad = 12;
      c.beginPath(); c.moveTo(pad + cut, pad); c.lineTo(w - pad, pad); c.lineTo(w - pad, h - pad - cut); c.lineTo(w - pad - cut, h - pad); c.lineTo(pad, h - pad); c.lineTo(pad, pad + cut); c.closePath();
      c.fillStyle = 'rgba(12,16,22,0.72)'; c.fill(); c.strokeStyle = accent; c.globalAlpha = 0.85; c.lineWidth = 6; c.stroke(); c.globalAlpha = 1;
      c.fillStyle = accent; c.fillRect(pad + 20, pad + 44, 14, h - pad * 2 - 88);
      c.fillStyle = 'rgba(255,255,255,0.08)'; for (let y = pad + 8; y < h - pad; y += 12) c.fillRect(pad + 48, y, w - pad * 2 - 60, 2);   // fine scanlines
      c.fillStyle = '#eef3f8'; let fs = Math.round(h * 0.46); c.font = `700 ${fs}px "Space Grotesk", Arial`; while (c.measureText(txt).width > w * 0.78 && fs > 10) { fs -= 2; c.font = `700 ${fs}px "Space Grotesk", Arial`; }
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, w / 2 + 20, h / 2 + 4);
    }, 256, { w: 1024, h: 256, clamp: true, aniso: 16 });
    const m = mat(tex, { transparent: true, alphaTest: 0.02, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, rough: 0.6 });
    m.vertexColors = false;
    return (panelCache[key] = m);
  }
  // vandret mærkning på gulvet (yaw = rotation)
  function floorCard(B, m, x, y, z, ww, dd, yaw, o) {
    const c = Math.cos(yaw || 0), s = Math.sin(yaw || 0), hx = ww / 2, hz = dd / 2, R = (a, b) => [x + a * c + b * s, y + 0.012, z - a * s + b * c];
    B.card(m, R(-hx, hz), R(hx, hz), R(hx, -hz), R(-hx, -hz), Object.assign({ tint: [1, 1, 1], shadow: false, up: true }, o || {}));
  }

  /* ======================================================== PROP-MODELLER (alle inden for kollisionsboksen) ======================================================== */
  const PAL = { wood: [0xd9a860, 0xc49456, 0xb88a50, 0xe0b878], olive: [0x7e8c52, 0x6f7d4a, 0x8a8f60, 0xb8975a] };
  const pick = (arr, h) => tint(arr[Math.floor(h * arr.length) % arr.length]);
  function propLib(M) {
    const o = {};
    // trækasse (evt. to stablet) – ramme, planker, hjørnestolper, låg
    o.crate = (B, b, h, pal) => {
      const w = b.x1 - b.x0, d = b.z1 - b.z0, H = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, t = pick(pal || PAL.wood, h), dk = t.map(v => v * 0.62);
      const one1 = (x, y, z, sx, sy, sz, ry) => {
        B.box(M.wood, x, y + sy / 2, z, sx - 0.06, sy - 0.04, sz - 0.06, { ry, tint: t, uvs: 1.6 });
        const pw = 0.09, hx = sx / 2 - pw / 2, hz = sz / 2 - pw / 2, c = Math.cos(ry || 0), s = Math.sin(ry || 0);
        for (const [px, pz] of [[hx, hz], [-hx, hz], [hx, -hz], [-hx, -hz]]) B.box(M.wood, x + px * c + pz * s, y + sy / 2, z - px * s + pz * c, pw, sy, pw, { ry, tint: dk, uvs: 1.2 });
        for (const yy of [0.04, sy - 0.04]) B.box(M.wood, x, y + yy, z, sx, 0.07, sz, { ry, tint: dk, uvs: 1.2 });
        B.box(M.wood, x, y + sy * 0.5, z, sx + 0.01, 0.06, sz + 0.01, { ry, tint: dk.map(v => v * 0.9), uvs: 1.2, detail: true });
      };
      if (H >= 1.35 && w >= 1.4 && d >= 1.4) { const hh = H * 0.55; one1(cx, b.y0, cz, w, hh, d, 0); const k = 0.86; one1(cx + (h - 0.5) * 0.1, b.y0 + hh, cz + (0.5 - h) * 0.08, w * k, H - hh, d * k, (h - 0.5) * 0.2); }
      else one1(cx, b.y0, cz, w, H, d, 0);
    };
    // ståltønde(r): cylinder med ribber, låg og spunshul; fylder boksen med 1–4 tønder
    o.barrel = (B, b, h, pal) => {
      const w = b.x1 - b.x0, d = b.z1 - b.z0, H = b.y1 - b.y0, nx = Math.max(1, Math.round(w / 0.95)), nz = Math.max(1, Math.round(d / 0.95));
      for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
        const cx = b.x0 + w * (i + 0.5) / nx, cz = b.z0 + d * (k + 0.5) / nz, r = Math.min(w / nx, d / nz) / 2 * 0.96, hh = hash2(cx, cz), t = pick(pal || [0x3f6f9c, 0xb8322a, 0x4d6b3c, 0xd09a22, 0x4a4a52], hh), top = H * 0.97;
        B.cyl(M.metal, cx, b.y0, cz, r * 0.94, r * 0.94, top, { seg: 16, tint: t, uvs: 1.2, caps: false });
        for (const y of [0.12, 0.5, 0.86]) B.cyl(M.metal, cx, b.y0 + top * y - 0.03, cz, r, r, 0.06, { seg: 16, tint: t.map(v => v * 0.75), uvs: 1, caps: false });
        B.cyl(M.metal, cx, b.y0 + top - 0.04, cz, r * 0.98, r * 0.9, 0.05, { seg: 16, tint: t.map(v => v * 0.7), uvs: 1 });
        B.cyl(M.metal, cx, b.y0 + top + 0.01, cz, r * 0.86, r * 0.86, 0.015, { seg: 16, tint: t.map(v => v * 1.05), uvs: 1 });
        B.cyl(M.dark, cx + r * 0.45, b.y0 + top + 0.025, cz + r * 0.2, 0.05, 0.05, 0.025, { seg: 8, tint: [0.12, 0.12, 0.12], detail: true });
      }
    };
    // skibscontainer: korrugerede sider, hjørnebeslag, dørstænger, låsehåndtag; farve vælges af b.col eller hash
    const CONT = { red: 0xa8432e, blue: 0x2f5f8a, blue2: 0x3a6f9a, green: 0x4f7a4a, yellow: 0xc79a2a, gray: 0x8a8f94 };
    o.container = (B, b, h) => {
      const w = b.x1 - b.x0, d = b.z1 - b.z0, H = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      const t = b.col ? tint(CONT[b.col] || CONT.gray) : pick([CONT.red, CONT.blue, CONT.green, CONT.yellow, CONT.gray], h), dk = t.map(v => v * 0.55), long = w > d;
      B.box(M.contSide || M.corr, cx, b.y0 + H / 2, cz, w - 0.06, H - 0.14, d - 0.06, { tint: t, uvs: 2.4, noTop: true, noBottom: true, ry: long ? 0 : 0 });
      B.box(M.metal, cx, b.y0 + H - 0.06, cz, w, 0.12, d, { tint: dk, uvs: 1.5 }); B.box(M.metal, cx, b.y0 + 0.08, cz, w, 0.16, d, { tint: dk, uvs: 1.5 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        B.box(M.metal, cx + sx * (w / 2 - 0.09), b.y0 + H / 2, cz + sz * (d / 2 - 0.09), 0.18, H, 0.18, { tint: dk, uvs: 1 });
        for (const yy of [0.08, H - 0.08]) B.box(M.dark, cx + sx * (w / 2 - 0.09), b.y0 + yy, cz + sz * (d / 2 - 0.09), 0.2, 0.16, 0.2, { tint: [0.16, 0.16, 0.17], detail: true });
      }
      for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {           // dørstænger ved enden
        const off = (i - 1.5) * (long ? d : w) * 0.22;
        if (long) B.cyl(M.steel, cx + s * (w / 2 + 0.02), b.y0 + 0.2, cz + off, 0.022, 0.022, H - 0.4, { seg: 6, tint: [0.7, 0.7, 0.7], detail: true });
        else B.cyl(M.steel, cx + off, b.y0 + 0.2, cz + s * (d / 2 + 0.02), 0.022, 0.022, H - 0.4, { seg: 6, tint: [0.7, 0.7, 0.7], detail: true });
      }
      if (b.tag) for (const s of [-1, 1]) { const m2 = M.tagMat(b.tag); if (long) wallCard(B, m2, cx, b.y0 + H * 0.62, cz + s * (d / 2 + 0.01), 0, s, 2.2, 0.55, { detail: true }); else wallCard(B, m2, cx + s * (w / 2 + 0.01), b.y0 + H * 0.62, cz, s, 0, 2.2, 0.55, { detail: true }); }
    };
    // betonbarriere (jersey) eller gul/sort faresbarriere
    o.barrier = (B, b, h, hazard) => {
      const w = b.x1 - b.x0, d = b.z1 - b.z0, H = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, longX = w >= d, t = hazard ? [1, 1, 1] : tint(0xc4c0b6, 0.95 + h * 0.1), m = hazard ? M.hazard : M.conc;
      B.frustum(m, cx, b.y0, cz, w, d, longX ? w : w * 0.4, longX ? d * 0.4 : d, H * 0.36, { tint: t, uvs: hazard ? 1.2 : 1.6, noTop: true });
      B.frustum(m, cx, b.y0 + H * 0.36, cz, longX ? w : w * 0.4, longX ? d * 0.4 : d, longX ? w : w * 0.3, longX ? d * 0.3 : d, H * 0.64, { tint: t, uvs: hazard ? 1.2 : 1.6 });
      if (!hazard) for (const s of [-0.3, 0.3]) B.box(M.dark, cx + (longX ? s * w : 0), b.y0 + 0.05, cz + (longX ? 0 : s * d), longX ? 0.2 : d + 0.01, 0.1, longX ? d + 0.01 : 0.2, { tint: [0.18, 0.18, 0.18], detail: true });
    };
    // sandsække: forskudte rækker af tilplattede ellipsoider
    o.sandbags = (B, b, h) => {
      const w = b.x1 - b.x0, d = b.z1 - b.z0, H = b.y1 - b.y0, longX = w >= d, L = longX ? w : d, Tt = longX ? d : w, rows = Math.max(2, Math.round(H / 0.24)), bl = 0.6, hh = H / rows;
      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * bl / 2, n = Math.floor((L - off) / bl);
        for (let i = 0; i < n; i++) {
          const a = off + bl * (i + 0.5) - L / 2 + (L - n * bl - off) / 2, t = tint(0xd6c293, 0.85 + hash2(i, r + h * 9) * 0.22), cx = (b.x0 + b.x1) / 2 + (longX ? a : 0), cz = (b.z0 + b.z1) / 2 + (longX ? 0 : a);
          B.sphere(M.sand, cx, b.y0 + hh * (r + 0.5), cz, longX ? bl * 0.52 : Tt * 0.5, hh * 0.6, longX ? Tt * 0.5 : bl * 0.52, { seg: 9, tint: t });
        }
      }
    };
    // europalle med indpakket last
    o.pallet = (B, b, h) => {
      const w = b.x1 - b.x0, d = b.z1 - b.z0, H = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, t = tint(0xbf9a62, 0.9);
      for (const k of [-1, 0, 1]) B.box(M.wood, cx + k * (w / 2 - 0.07), b.y0 + 0.07, cz, 0.12, 0.14, d - 0.02, { tint: t.map(v => v * 0.7), uvs: 1 });
      for (let i = 0; i < 5; i++) B.box(M.wood, cx, b.y0 + 0.165, cz - d / 2 + 0.1 + i * (d - 0.2) / 4, w, 0.035, 0.14, { tint: t, uvs: 1 });
      if (H > 0.5) { const cw = (w - 0.1) / 2; for (let i = 0; i < 2; i++) for (let l = 0; l < 2; l++) B.box(i === l ? M.sand : M.wood, cx - w / 2 + 0.05 + cw * (i + 0.5), b.y0 + 0.18 + (H - 0.18) * (l + 0.5) / 2, cz, cw - 0.04, (H - 0.18) / 2 - 0.03, d - 0.14, { tint: i === l ? [0.9, 0.86, 0.72] : t, uvs: 1.2 }); }
    };
    // kontrolpult: skrånende panel med skærme og knapper (skærmene lyser)
    o.console = (B, b, h) => {
      const w = b.x1 - b.x0, d = b.z1 - b.z0, H = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, t = tint(0x6c7a86), longX = w >= d, L = longX ? w : d, Tt = longX ? d : w;
      const at = (a, c) => longX ? [cx + a, cz + c] : [cx + c, cz + a];
      B.box(M.metal, cx, b.y0 + H * 0.38, cz, w - 0.02, H * 0.76, d - 0.02, { tint: t, uvs: 1.4 });
      B.box(M.dark, cx, b.y0 + 0.05, cz, w - 0.06, 0.1, d - 0.06, { tint: [0.14, 0.14, 0.15] });
      const q = at(0, 0); B.box(M.metal, q[0], b.y0 + H * 0.82, q[1], longX ? w : Tt * 0.9, H * 0.1, longX ? Tt * 0.9 : d, { tint: t.map(v => v * 0.75), uvs: 1.4 });
      const nS = Math.max(1, Math.floor(L / 0.9));
      for (let i = 0; i < nS; i++) { const a = -L / 2 + L * (i + 0.5) / nS, p = at(a, 0); B.box(M.dark, p[0], b.y0 + H * 0.95, p[1], longX ? 0.62 : Tt * 0.42, 0.3, longX ? Tt * 0.42 : 0.62, { tint: [0.1, 0.1, 0.12] }); B.box(i % 2 ? M.glowBlue : M.glowGreen, p[0], b.y0 + H * 0.96, p[1], longX ? 0.52 : Tt * 0.44, 0.22, longX ? Tt * 0.44 : 0.52, { shadow: false, tint: [1, 1, 1] }); }
      for (let i = 0; i < 12; i++) { const a = (hash2(i, h * 9) - 0.5) * L * 0.9, p = at(a, (hash2(h, i) - 0.5) * Tt * 0.3); B.box(i % 3 ? M.glowAmber : M.glowRed, p[0], b.y0 + H * 0.88, p[1], 0.05, 0.02, 0.05, { shadow: false, detail: true }); }
    };
    // stålskab med låger
    o.cabinet = (B, b, h) => {
      const w = b.x1 - b.x0, d = b.z1 - b.z0, H = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, longX = w >= d, n = Math.max(1, Math.round((longX ? w : d) / 0.9)), t = tint(0x7d8a7a);
      B.box(M.metal, cx, b.y0 + H / 2, cz, w - 0.02, H, d - 0.02, { tint: t, uvs: 1.2 });
      for (let i = 0; i < n; i++) { const a = -((longX ? w : d) / 2) + (longX ? w : d) * (i + 0.5) / n; for (const s of [-1, 1]) { if (longX) B.box(M.dark, cx + a + 0.3, b.y0 + H * 0.55, cz + s * (d / 2), 0.03, 0.18, 0.04, { tint: [0.2, 0.2, 0.2], detail: true }); else B.box(M.dark, cx + s * (w / 2), b.y0 + H * 0.55, cz + a + 0.3, 0.04, 0.18, 0.03, { tint: [0.2, 0.2, 0.2], detail: true }); } }
    };
    // omklædningsskabe (række)
    o.lockers = (B, b, h) => {
      const w = b.x1 - b.x0, d = b.z1 - b.z0, H = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, longX = w >= d, L = longX ? w : d, n = Math.round(L / 0.5);
      for (let i = 0; i < n; i++) {
        const a = -L / 2 + L * (i + 0.5) / n, x = longX ? cx + a : cx, z = longX ? cz : cz + a, t = tint([0x5a7a96, 0x56748e, 0x60809a][i % 3]);
        B.box(M.metal, x, b.y0 + H / 2, z, longX ? L / n - 0.015 : w, H, longX ? d : L / n - 0.015, { tint: t, uvs: 1 });
        for (const s of [-1, 1]) for (const yy of [0.82, 0.88, 0.94]) { if (longX) B.box(M.dark, x, b.y0 + H * yy, z + s * d / 2, L / n * 0.6, 0.025, 0.01, { tint: [0.15, 0.15, 0.17], detail: true }); else B.box(M.dark, x + s * w / 2, b.y0 + H * yy, z, 0.01, 0.025, L / n * 0.6, { tint: [0.15, 0.15, 0.17], detail: true }); }
      }
    };
    o.bench = (B, b) => {
      const w = b.x1 - b.x0, d = b.z1 - b.z0, H = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      B.box(M.wood, cx, b.y0 + H - 0.03, cz, w, 0.06, d, { tint: tint(0xb98a52), uvs: 1 });
      for (const s of [-0.4, 0.4]) B.box(M.steel, cx + (w >= d ? s * w : 0), b.y0 + (H - 0.06) / 2, cz + (w >= d ? 0 : s * d), w >= d ? 0.05 : d - 0.1, H - 0.06, w >= d ? d - 0.1 : 0.05, { tint: [0.3, 0.3, 0.32] });
    };
    // varevogn: karrosseri, vinduer, hjul (kollision = boks)
    o.van = (B, b, h) => {
      const w = b.x1 - b.x0, d = b.z1 - b.z0, H = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, alongZ = d > w, L = alongZ ? d : w, Wd = alongZ ? w : d, t = tint(0xe8e6df), ry = alongZ ? 0 : Math.PI / 2;
      const P2 = (a, c) => alongZ ? [cx + c, cz + a] : [cx + a, cz + c];
      let p = P2(0.2, 0); B.box(M.metal, p[0], b.y0 + 0.45 + (H - 0.5) / 2, p[1], alongZ ? Wd - 0.06 : L * 0.8, H - 0.5, alongZ ? L * 0.8 : Wd - 0.06, { tint: t, uvs: 1.6 });
      p = P2(-L * 0.38, 0); B.box(M.metal, p[0], b.y0 + 0.45 + (H - 0.9) / 2, p[1], alongZ ? Wd - 0.08 : L * 0.2, H - 0.9, alongZ ? L * 0.2 : Wd - 0.08, { tint: t, uvs: 1.6 });
      p = P2(-L * 0.3, 0); B.box(M.dark, p[0], b.y0 + H - 0.75, p[1], alongZ ? Wd - 0.04 : 0.4, 0.42, alongZ ? 0.4 : Wd - 0.04, { tint: [0.15, 0.2, 0.25] });
      for (const s of [-1, 1]) { p = P2(0.2, s * (Wd / 2 - 0.02)); B.box(M.dark, p[0], b.y0 + H - 0.75, p[1], alongZ ? 0.02 : L * 0.55, 0.36, alongZ ? L * 0.55 : 0.02, { tint: [0.15, 0.18, 0.22], detail: true }); }
      for (const a of [-L * 0.3, L * 0.32]) for (const s of [-1, 1]) { p = P2(a, s * (Wd / 2 - 0.12)); B.cyl(M.dark, p[0], b.y0 + 0.38, p[1], 0.36, 0.36, 0.24, { seg: 14, tint: [0.1, 0.1, 0.1], quat: orient(alongZ ? 1 : 0, 0, alongZ ? 0 : 1) }); }
      p = P2(0.2, 0); B.box(M.dark, p[0], b.y0 + 0.4, p[1], alongZ ? Wd - 0.1 : L * 0.84, 0.25, alongZ ? L * 0.84 : Wd - 0.1, { tint: [0.15, 0.15, 0.15] });
    };
    o.truck = (B, b, h) => {
      const w = b.x1 - b.x0, d = b.z1 - b.z0, H = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, alongZ = d > w, L = alongZ ? d : w, Wd = alongZ ? w : d;
      const P2 = (a, c) => alongZ ? [cx + c, cz + a] : [cx + a, cz + c];
      let p = P2(0.55, 0); B.box(M.corr, p[0], b.y0 + 0.7 + (H - 0.7) / 2, p[1], alongZ ? Wd - 0.04 : L * 0.66, H - 0.75, alongZ ? L * 0.66 : Wd - 0.04, { tint: tint(0xdad6cc), uvs: 2 });
      p = P2(-L * 0.36, 0); B.box(M.metal, p[0], b.y0 + 0.6 + (H - 1.1) / 2, p[1], alongZ ? Wd - 0.1 : L * 0.24, H - 1.1, alongZ ? L * 0.24 : Wd - 0.1, { tint: tint(0x2f5f8a), uvs: 1.4 });
      p = P2(-L * 0.47, 0); B.box(M.dark, p[0], b.y0 + H - 0.95, p[1], alongZ ? Wd - 0.14 : 0.06, 0.5, alongZ ? 0.06 : Wd - 0.14, { tint: [0.12, 0.16, 0.2] });
      for (const a of [-L * 0.36, L * 0.15, L * 0.38]) for (const s of [-1, 1]) { p = P2(a, s * (Wd / 2 - 0.15)); B.cyl(M.dark, p[0], b.y0 + 0.45, p[1], 0.45, 0.45, 0.3, { seg: 14, tint: [0.1, 0.1, 0.1], quat: orient(alongZ ? 1 : 0, 0, alongZ ? 0 : 1) }); }
      p = P2(0, 0); B.box(M.dark, p[0], b.y0 + 0.5, p[1], alongZ ? Wd - 0.2 : L - 0.2, 0.3, alongZ ? L - 0.2 : Wd - 0.2, { tint: [0.14, 0.14, 0.14] });
    };
    o.dumpster = (B, b) => {
      const w = b.x1 - b.x0, d = b.z1 - b.z0, H = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, t = tint(0x3f6b4a);
      B.frustum(M.metal, cx, b.y0 + 0.12, cz, w - 0.15, d - 0.15, w - 0.02, d - 0.02, H - 0.2, { tint: t, uvs: 1.4 });
      B.box(M.dark, cx, b.y0 + H - 0.05, cz, w, 0.08, d, { tint: [0.16, 0.18, 0.17] });
      for (const s of [-1, 1]) for (const k of [-1, 1]) B.cyl(M.dark, cx + s * (w / 2 - 0.2), b.y0, cz + k * (d / 2 - 0.2), 0.07, 0.07, 0.12, { seg: 8, tint: [0.1, 0.1, 0.1], detail: true });
    };
    o.shelf = (B, b) => {
      const w = b.x1 - b.x0, d = b.z1 - b.z0, H = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, longX = w >= d, n = 4;
      for (const s of [-1, 1]) for (const k of [-1, 1]) B.box(M.steel, cx + s * (w / 2 - 0.04), b.y0 + H / 2, cz + k * (d / 2 - 0.04), 0.06, H, 0.06, { tint: tint(0x2f5f8a) });
      for (let i = 0; i < n; i++) { const y = b.y0 + 0.15 + i * (H - 0.2) / (n - 1); B.box(M.steel, cx, y, cz, w, 0.05, d, { tint: tint(0xd07020) });
        if (i < n - 1) for (let k = 0; k < 3; k++) { const a = -0.33 + k * 0.33; if (hash2(i, k + w) < 0.75) B.box(k % 2 ? M.wood : M.sand, cx + (longX ? a * w : 0), y + 0.25, cz + (longX ? 0 : a * d), longX ? w * 0.28 : d * 0.7, 0.42, longX ? d * 0.7 : d * 0.28, { tint: k % 2 ? tint(0xc49456) : [0.85, 0.82, 0.7], uvs: 1, detail: true }); }
      }
    };
    // generator: kasse med lameller, rør og gult tag
    o.generator = (B, b) => {
      const w = b.x1 - b.x0, d = b.z1 - b.z0, H = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      B.box(M.metal, cx, b.y0 + H * 0.4, cz, w - 0.05, H * 0.8, d - 0.05, { tint: tint(0xd8b020), uvs: 1.4 });
      B.box(M.metal, cx, b.y0 + H * 0.84, cz, w - 0.2, H * 0.08, d - 0.2, { tint: [0.35, 0.35, 0.38], uvs: 1.4 });
      for (let i = 0; i < 6; i++) B.box(M.dark, cx - w / 2 + 0.25 + i * (w - 0.5) / 5, b.y0 + H * 0.4, cz + d / 2 - 0.02, 0.07, H * 0.5, 0.05, { tint: [0.1, 0.1, 0.1], detail: true });
      B.cyl(M.steel, cx + w * 0.3, b.y0 + H * 0.8, cz - d * 0.25, 0.1, 0.09, H * 0.35, { seg: 8, tint: [0.3, 0.3, 0.32] });
    };
    return o;
  }

  /* ======================================================== vegetation ======================================================== */
  function frondCard(B, m, x, y, z, yaw, pitch, w, len, t, droop) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), wx = -sy * w / 2, wz = cy * w / 2;
    let px = x, py = y, pz = z, pt = pitch;
    for (let s = 0; s < 2; s++) {
      const l = len / 2, dx = cy * Math.cos(pt) * l, dy = Math.sin(pt) * l, dz = sy * Math.cos(pt) * l, k0 = s === 0 ? 1 : 0.75, k1 = s === 0 ? 0.75 : 0.35;
      B.card(m, [px - wx * k0, py, pz - wz * k0], [px + wx * k0, py, pz + wz * k0], [px + dx + wx * k1, py + dy, pz + dz + wz * k1], [px + dx - wx * k1, py + dy, pz + dz - wz * k1], { tint: t, v0: s * 0.5, v1: s * 0.5 + 0.5, up: true, detail: true });
      px += dx; py += dy; pz += dz; pt -= droop || 0.5;
    }
  }
  function plantRadial(B, m, x, y, z, n, w, len, pitch, R, t, droop) {
    const a0 = R() * TAU; for (let i = 0; i < n; i++) frondCard(B, m, x, y, z, a0 + i * TAU / n + (R() - 0.5) * 0.4, pitch + (R() - 0.5) * 0.3, w * (0.85 + R() * 0.3), len * (0.8 + R() * 0.4), mix(t, [t[0] * 0.8, t[1] * 0.9, t[2] * 0.7], R()), droop);
  }
  function curvedTrunk(B, m, x, y, z, segs, len, r0, r1, lx, lz, t) {
    let px = x, py = y, pz = z;
    for (let i = 0; i < segs; i++) {
      const k = (i + 1) / segs, bend = Math.pow(k, 1.5), dx = lx * bend * 0.5, dz = lz * bend * 0.5, q = orient(dx, 1, dz), ra = r0 + (r1 - r0) * (i / segs), rb = r0 + (r1 - r0) * k;
      B.cyl(m, px, py, pz, ra, rb, len * 1.04, { seg: 8, quat: q, tint: t.map(v => v * (0.9 + (i % 2) * 0.12)), uvs: 1.4, caps: false });
      const d = _vb.set(dx, 1, dz).normalize(); px += d.x * len; py += d.y * len; pz += d.z * len;
    }
    return [px, py, pz];
  }
  // deterministisk (seed = position) – samme plante ser altid ens ud
  const seedAt = (x, z) => rnd(Math.floor(Math.abs(x * 73.1 + z * 19.7) * 100) + 7);
  function palm(B, M, x, y, z, s, lean) {
    const R = seedAt(x, z), lx = lean ? lean[0] : (R() - 0.5) * 1.2, lz = lean ? lean[1] : (R() - 0.5) * 1.2, top = curvedTrunk(B, M.bark, x, y, z, 7, 0.62 * s, 0.2 * s, 0.11 * s, lx, lz, [0.8, 0.62, 0.46]);
    const n = 12; for (let i = 0; i < n; i++) frondCard(B, M.frond, top[0], top[1], top[2], i * TAU / n + R() * 0.3, 0.75 - (i % 3) * 0.28, 1.5 * s, 2.8 * s, mix([0.8, 1, 0.7], [1, 1, 0.75], R()), 0.65);
    for (let i = 0; i < 4; i++) B.sphere(M.bark, top[0] + (R() - 0.5) * 0.3, top[1] - 0.12, top[2] + (R() - 0.5) * 0.3, 0.1 * s, 0.1 * s, 0.1 * s, { seg: 6, tint: [0.55, 0.45, 0.18], detail: true });
  }
  function shrub(B, M, x, y, z, s, dry) { const R = seedAt(x, z); plantRadial(B, dry ? M.dry : M.broad, x, y, z, dry ? 6 : 7, (dry ? 1.2 : 0.9) * s, (dry ? 1.0 : 0.95) * s, 1.0, R, dry ? [1, 0.95, 0.8] : [0.9, 1, 0.8], 0.55); }
  function fern(B, M, x, y, z, s) { const R = seedAt(x, z); plantRadial(B, M.fern, x, y + 0.03, z, 7, 0.9 * s, 1.15 * s, 0.55, R, [0.9, 1, 0.85], 0.5); }
  function grassTuft(B, M, x, y, z, s) { const R = seedAt(x, z); for (let i = 0; i < 3; i++) { const a = i * 1.05 + R(), l = 0.7 * s; B.card(M.grass, [x - Math.cos(a) * 0.35 * s, y, z - Math.sin(a) * 0.35 * s], [x + Math.cos(a) * 0.35 * s, y, z + Math.sin(a) * 0.35 * s], [x + Math.cos(a) * 0.3 * s, y + l, z + Math.sin(a) * 0.3 * s], [x - Math.cos(a) * 0.3 * s, y + l, z - Math.sin(a) * 0.3 * s], { tint: mix([0.85, 1, 0.7], [1, 1, 0.8], R()), up: true, detail: true }); } }
  function vineStrip(B, M, x, ytop, z, nx, nz, w, len, t) {
    const tx = -nz * w / 2, tz = nx * w / 2, ox = nx * 0.04, oz = nz * 0.04;
    B.card(M.vine, [x - tx + ox, ytop - len, z - tz + oz], [x + tx + ox, ytop - len, z + tz + oz], [x + tx + ox, ytop, z + tz + oz], [x - tx + ox, ytop, z - tz + oz], { tint: t || [0.9, 1, 0.8], detail: true, v0: 0, v1: 1 });
  }
  // v13: jungletræ – stamme med rodudløbere, 4-5 grene og en tæt krone af krydsede løvkort (volumen fra alle vinkler) + lianer
  function jungleTree2(B, M, x, y, z, s) {
    const R = seedAt(x, z), lean = [(R() - 0.5) * 0.5, (R() - 0.5) * 0.5];
    const top = curvedTrunk(B, M.bark, x, y, z, 8, 0.95 * s, 0.42 * s, 0.17 * s, lean[0], lean[1], [0.6, 0.5, 0.42]);
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + R(); B.frustum(M.bark, x + Math.cos(a) * 0.38 * s, y, z + Math.sin(a) * 0.38 * s, 0.5 * s, 0.22 * s, 0.08 * s, 0.06 * s, 1.1 * s, { quat: orient(Math.cos(a) * 0.9, 1, Math.sin(a) * 0.9), tint: [0.55, 0.46, 0.38] }); }   // rodudløbere
    const clusters = [];
    for (let i = 0; i < 5; i++) {                                             // grene
      const a = i * TAU / 5 + R() * 0.6, up = 0.55 + R() * 0.5, L2 = (2.0 + R() * 1.6) * s, by = top[1] - (1.6 + R() * 1.8) * s;
      const bx0 = x + (top[0] - x) * 0.8, bz0 = z + (top[2] - z) * 0.8, ex = bx0 + Math.cos(a) * L2, ez = bz0 + Math.sin(a) * L2, ey = by + up * L2;
      B.tube(M.bark, [bx0, by, bz0], [ex, ey, ez], 0.12 * s, { seg: 6, tint: [0.58, 0.48, 0.4], r1: 0.05 * s });
      clusters.push([ex, ey + 0.3 * s, ez, (1.5 + R() * 0.7) * s]);
      clusters.push([bx0 + (ex - bx0) * 0.55, by + (ey - by) * 0.55 + 0.4 * s, bz0 + (ez - bz0) * 0.55, (1.1 + R() * 0.5) * s]);
    }
    clusters.push([top[0], top[1] + 0.6 * s, top[2], 1.9 * s]);
    for (const [cx, cy, cz, r] of clusters) {                                // hver klump: 3 lodrette kort (60° imellem) + et vandret – læses rundt fra alle sider
      const t = mix([0.85, 0.95, 0.75], [1.05, 1.08, 0.85], R()), a0 = R() * TAU;
      for (let k = 0; k < 3; k++) { const a = a0 + k * TAU / 6, ca = Math.cos(a) * r, sa = Math.sin(a) * r;
        B.card(M.canopy, [cx - ca, cy - r * 0.75, cz - sa], [cx + ca, cy - r * 0.75, cz + sa], [cx + ca, cy + r * 0.75, cz + sa], [cx - ca, cy + r * 0.75, cz - sa], { tint: t, detail: k > 0 }); }
      B.card(M.canopy, [cx - r, cy, cz - r], [cx + r, cy, cz - r], [cx + r, cy, cz + r], [cx - r, cy, cz + r], { tint: t.map(v => v * 0.9) });
    }
    for (let i = 0; i < 5; i++) { const c2 = clusters[Math.floor(R() * clusters.length)], len = 2.2 + R() * 2.6, a = R() * TAU;   // lianer
      const lx = c2[0] + Math.cos(a) * c2[3] * 0.5, lz = c2[2] + Math.sin(a) * c2[3] * 0.5, ty = c2[1] - c2[3] * 0.4, ca = Math.cos(a + 1.57) * 0.18, sa = Math.sin(a + 1.57) * 0.18;
      if (ty - len < y + 2.3) continue;                                       // aldrig ned i spillerhøjde
      B.card(M.liana, [lx - ca, ty - len, lz - sa], [lx + ca, ty - len, lz + sa], [lx + ca, ty, lz + sa], [lx - ca, ty, lz - sa], { tint: [0.95, 1, 0.9], detail: true }); }
  }
  // efeu på en mur: et tæppe der hænger fra murkronen (laset underkant) – flugter med muren
  function ivyPatch(B, M, x, ytop, z, nx, nz, w, len, t) {
    const tx = -nz * w / 2, tz = nx * w / 2, ox = nx * 0.035, oz = nz * 0.035;
    B.card(M.ivy, [x - tx + ox, ytop - len, z - tz + oz], [x + tx + ox, ytop - len, z + tz + oz], [x + tx + ox, ytop + 0.12, z + tz + oz], [x - tx + ox, ytop + 0.12, z - tz + oz], { tint: t || [0.95, 1, 0.9], detail: true, v0: 0, v1: 1 });
    B.card(M.ivy, [x - tx * 0.9 + ox * 0.5, ytop + 0.15, z - tz * 0.9 + oz * 0.5], [x + tx * 0.9 + ox * 0.5, ytop + 0.15, z + tz * 0.9 + oz * 0.5], [x + tx * 0.9 - nx * 0.5, ytop + 0.12, z + tz * 0.9 - nz * 0.5], [x - tx * 0.9 - nx * 0.5, ytop + 0.12, z - tz * 0.9 - nz * 0.5], { tint: (t || [0.95, 1, 0.9]).map(v => v * 1.05), detail: true, v0: 0, v1: 0.25 });   // ranker hen over murkronen
  }
  function jungleTree(B, M, x, y, z, s) {
    if (M.canopy) return jungleTree2(B, M, x, y, z, s);
    const R = seedAt(x, z), top = curvedTrunk(B, M.bark, x, y, z, 7, 0.95 * s, 0.38 * s, 0.2 * s, (R() - 0.5) * 0.8, (R() - 0.5) * 0.8, [0.62, 0.5, 0.4]);
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + R(); B.frustum(M.bark, x + Math.cos(a) * 0.3 * s, y, z + Math.sin(a) * 0.3 * s, 0.45 * s, 0.45 * s, 0.1 * s, 0.1 * s, 1.2 * s, { quat: orient(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5), tint: [0.6, 0.5, 0.4], uvs: 1.2 }); }
    const n = 18; for (let i = 0; i < n; i++) {
      const a = i * TAU / n * 1.3 + R(), r = (0.6 + R() * 2.4) * s, cx = top[0] + Math.cos(a) * r, cz = top[2] + Math.sin(a) * r, cy = top[1] - 0.4 + R() * 1.6, sz = (2.4 + R() * 1.4) * s, yaw = R() * TAU, ca = Math.cos(yaw), sa = Math.sin(yaw);
      B.card(M.broad, [cx - ca * sz / 2, cy, cz - sa * sz / 2], [cx + ca * sz / 2, cy, cz + sa * sz / 2], [cx + ca * sz / 2 - sa * sz * 0.5, cy + 0.7, cz + sa * sz / 2 + ca * sz * 0.5], [cx - ca * sz / 2 - sa * sz * 0.5, cy + 0.7, cz - sa * sz / 2 + ca * sz * 0.5], { tint: mix([0.75, 0.95, 0.65], [1, 1, 0.8], R()), up: true });
    }
    for (let i = 0; i < 6; i++) { const a = R() * TAU, r = (0.8 + R() * 1.8) * s; vineStrip(B, M, top[0] + Math.cos(a) * r, top[1] - 0.2, top[2] + Math.sin(a) * r, Math.cos(a), Math.sin(a), 0.5, 2.6 + R() * 2.4); }
  }

  /* ======================================================== stiger, gelændere, lamper, døre (fælles) ======================================================== */
  // gelænder: stolper hver ~1,4 m, håndliste (rør), mellemliste og fodliste
  function railing(B, m, b, t, o) {
    o = o || {}; const along = (b.x1 - b.x0) >= (b.z1 - b.z0), L = along ? b.x1 - b.x0 : b.z1 - b.z0, H = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    const n = Math.max(1, Math.round(L / 1.4)), q = along ? orient(1, 0, 0) : orient(0, 0, 1);
    for (let i = 0; i <= n; i++) { const a = -L / 2 + L * i / n, x = along ? cx + a : cx, z = along ? cz : cz + a; B.cyl(m, x, b.y0, z, 0.03, 0.03, H - 0.02, { seg: 6, tint: t, caps: false }); }
    const P0 = along ? [b.x0, 0, cz] : [cx, 0, b.z0];
    for (const [y, r] of [[H - 0.02, 0.035], [H * 0.5, 0.022]]) B.cyl(m, P0[0], b.y0 + y, P0[2], r, r, L, { seg: 6, quat: q, tint: t, caps: false });
    if (o.toe !== false) B.box(m, cx, b.y0 + 0.06, cz, along ? L : 0.02, 0.12, along ? 0.02 : L, { tint: t.map(v => v * 0.85) });
  }
  // stige: to vanger + trin; evt. rygbøjler (bur) over 2,4 m
  function ladderModel(B, m, l, t, cage) {
    const cx = (l.x0 + l.x1) / 2, cz = (l.z0 + l.z1) / 2, H = l.y1 - l.y0, along = l.nz !== 0;
    const px = along ? cx : (l.nx > 0 ? l.x0 + 0.1 : l.x1 - 0.1), pz = along ? (l.nz > 0 ? l.z0 + 0.1 : l.z1 - 0.1) : cz, wx = along ? 0.24 : 0, wz = along ? 0 : 0.24;
    for (const s of [-1, 1]) B.box(m, px + wx * s, l.y0 + (H + 1.0) / 2, pz + wz * s, 0.06, H + 1.0, 0.06, { tint: t });
    for (let y = l.y0 + 0.3; y < l.y1 + 0.05; y += 0.3) B.cyl(m, px - wx, y, pz - wz, 0.018, 0.018, 0.48, { seg: 6, tint: t.map(v => v * 0.9), quat: along ? orient(1, 0, 0) : orient(0, 0, 1), caps: false });
    for (const s of [-1, 1]) B.box(m, px + wx * s - l.nx * 0.05, l.y0 + 0.05, pz + wz * s - l.nz * 0.05, 0.12, 0.1, 0.12, { tint: t.map(v => v * 0.6) });
    if (cage && H > 3) for (let y = l.y0 + 2.4; y < l.y1 + 0.9; y += 0.8) {                      // rygbøjler
      const ox = px + l.nx * 0.35, oz = pz + l.nz * 0.35;
      B.box(m, ox + l.nx * 0.33, y, oz + l.nz * 0.33, along ? 0.6 : 0.04, 0.04, along ? 0.04 : 0.6, { tint: t, detail: true });
      for (const s of [-1, 1]) B.box(m, px + wx * 1.12 * s + l.nx * 0.34, y, pz + wz * 1.12 * s + l.nz * 0.34, along ? 0.04 : 0.7, 0.04, along ? 0.7 : 0.04, { tint: t, detail: true });   // v14: bøjlen går helt ind til vangen (svævede 0,3 m ude)
    }
  }
  // lampearmaturer – hvert tema angiver 'fix' på sine lamper
  function lampFixture(B, M, L) {
    const f = L.fix || 'tube', x = L.x, y = L.y, z = L.z;
    if (f === 'tube') {                                 // lysstofarmatur under loft
      const along = L.ax === 'z', l = L.len || 2.2;
      B.box(M.steel, x, y + 0.06, z, along ? 0.32 : l, 0.08, along ? l : 0.32, { tint: [0.55, 0.57, 0.6], detail: false });
      B.box(M.glowWhite, x, y, z, along ? 0.18 : l - 0.1, 0.05, along ? l - 0.1 : 0.18, { shadow: false, tint: L.glow || [1, 1, 1] });
      if (L.hang) for (const s of [-1, 1]) B.cyl(M.dark, x + (along ? 0 : s * l * 0.4), y + 0.1, z + (along ? s * l * 0.4 : 0), 0.008, 0.008, L.hang, { seg: 4, tint: [0.1, 0.1, 0.1], detail: true });
    } else if (f === 'bay') {                           // industriel højloftslampe (kuppel)
      B.cyl(M.dark, x, y + 0.42, z, 0.012, 0.012, L.hang || 0.8, { seg: 4, tint: [0.1, 0.1, 0.1], detail: true });
      B.cyl(M.steel, x, y + 0.05, z, 0.42, 0.12, 0.38, { seg: 14, tint: [0.35, 0.38, 0.4], bottomCap: false });
      B.cyl(M.glowWhite, x, y + 0.04, z, 0.34, 0.34, 0.02, { seg: 14, shadow: false, tint: L.glow || [1, 0.96, 0.88] });
    } else if (f === 'wall') {                          // væglampe med bur (n = retning ud fra væggen)
      const nx = L.n[0], nz = L.n[1];
      B.box(M.steel, x - nx * 0.12, y, z - nz * 0.12, nz ? 0.24 : 0.06, 0.3, nx ? 0.24 : 0.06, { tint: [0.3, 0.32, 0.34] });
      B.box(M.glowAmber, x, y, z, 0.16, 0.2, 0.16, { shadow: false, tint: L.glow || [1, 1, 1] });
      for (const s of [-1, 1]) B.box(M.steel, x + (nz ? s * 0.1 : 0), y, z + (nx ? s * 0.1 : 0), nz ? 0.015 : 0.2, 0.24, nx ? 0.015 : 0.2, { tint: [0.2, 0.2, 0.2], detail: true });
    } else if (f === 'emergency') {                     // rød nødlampe
      B.box(M.steel, x, y + 0.08, z, 0.28, 0.06, 0.28, { tint: [0.25, 0.25, 0.27] });
      B.sphere(M.glowRed, x, y, z, 0.11, 0.09, 0.11, { seg: 8, shadow: false, half: true });
    } else if (f === 'torch') {                         // fakkel/olielampe (Ancient)
      const nx = L.n ? L.n[0] : 0, nz = L.n ? L.n[1] : 0;
      B.box(M.dark, x - nx * 0.18, y - 0.35, z - nz * 0.18, 0.08, 0.5, 0.08, { tint: [0.3, 0.22, 0.15], rx: nz * 0.4, rz: -nx * 0.4 });
      B.cyl(M.dark, x, y - 0.12, z, 0.07, 0.11, 0.14, { seg: 8, tint: [0.25, 0.18, 0.12] });
      B.sphere(M.glowAmber, x, y + 0.02, z, 0.09, 0.16, 0.09, { seg: 6, shadow: false });
    } else if (f === 'lantern') {                       // ørken-lygte på væg
      const nx = L.n[0], nz = L.n[1];
      B.box(M.dark, x - nx * 0.2, y + 0.1, z - nz * 0.2, nz ? 0.06 : 0.4, 0.06, nx ? 0.06 : 0.4, { tint: [0.18, 0.16, 0.14] });
      B.box(M.dark, x, y + 0.2, z, 0.26, 0.05, 0.26, { tint: [0.18, 0.16, 0.14] });
      B.box(M.glowAmber, x, y, z, 0.18, 0.3, 0.18, { shadow: false });
      B.box(M.dark, x, y - 0.18, z, 0.22, 0.05, 0.22, { tint: [0.18, 0.16, 0.14] });
    }
  }
  // dørblad (lokale koordinater: x fra 0 til w, tykkelse om z=0). kind: metal | wood | squeaky
  function doorLeaf(w, h, m, kind) {
    const g = new THREE.Group(), add = (sx, sy, sz, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(x, y, z); g.add(o); return o; };
    add(w - 0.04, h - 0.03, 0.055, w / 2, h / 2, 0);
    if (kind === 'metal') { add(w - 0.2, 0.08, 0.07, w / 2, 1.05, 0); add(w - 0.12, 0.25, 0.065, w / 2, 0.18, 0); add(0.045, 0.045, 0.16, w - 0.12, 1.02, 0); add(0.035, 0.04, 0.12, 0.05, h - 0.35, 0); add(0.035, 0.04, 0.12, 0.05, 0.35, 0); }
    else { for (const y of [0.45, h / 2, h - 0.45]) add(w - 0.16, 0.12, 0.07, w / 2, y, 0); add(0.05, 0.05, 0.16, w - 0.12, 1.02, 0); }
    return g;
  }

  /* ======================================================== fælles materialer ======================================================== */
  function commonMats() {
    const M = {
      wood: mat(T.wood(), { bump: 0.6, rough: 0.72 }), metal: mat(T.metal(), { bump: 0.5, rough: 0.42, metal: 0.75 }), steel: mat(T.steel(), { bump: 0.15, rough: 0.34, metal: 0.88, rv: 0.1 }),
      corr: mat(T.corr(), { bump: 1.2, rough: 0.52, metal: 0.55 }), conc: mat(T.conc(), { bump: 0.8, rough: 0.94 }), sand: mat(T.sand(), { bump: 0.8, rough: 0.97 }), hazard: mat(T.hazard(), { bump: 0.2, rough: 0.6, metal: 0.25 }),
      glowBlue: unlit(0x8fd4ff), glowAmber: unlit(0xffc870), glowWhite: unlit(0xfffaf0), glowGreen: unlit(0x8af0a8), glowRed: unlit(0xff4a3a), dark: mat(null, { rough: 0.55, metal: 0.35 })
    };
    const tagCache = {};
    M.tagMat = txt => tagCache[txt] || (tagCache[txt] = mat(T.text(txt, null, '#f4efe2', 512, 128), { alphaTest: 0.5, transparent: false }));
    Object.assign(M, propLib(M));
    return M;
  }

  // sammenhængende vægstrimler (øverste lag) der vender ud mod åbent gulv: {a0,a1,fixed,nx,nz,alongX,L}
  function wallRuns(minLen) {
    // v14: datadrevne baner (W.data.runs) leverer murløb direkte fra generatorens facader (lodret mur ↔ gangbar flade)
    if (W.data && W.data.runs && W.data.facades) return W.data.facades.filter(f => Math.hypot(f[2] - f[0], f[3] - f[1]) >= minLen && f[7] - f[6] > 2.4)
      .map(f => ({ a0: f[5] ? f[0] : f[1], a1: f[5] ? f[2] : f[3], fixed: f[5] ? f[1] : f[0], nx: f[4], nz: f[5], alongX: !!f[5], L: f[6], top: f[7], open: !!f[8] }));
    const Lr = W.layers[W.layers.length - 1], G = Lr.grid, Tt = W.tile, cX = c => Tt.GX0 + c * Tt.TILE, cZ = r => Tt.GZ0 + r * Tt.TILE;
    const lvl = (r, c) => { const ch = G[r] && G[r][c], t = ch && Lr.tiles[ch]; return t && t.floor !== undefined && !t.sill && t.lintel === undefined ? t.floor : undefined; };
    const isW = (r, c) => { const ch = G[r] && G[r][c], t = ch && Lr.tiles[ch]; return !!t && !!t.solid && (t.top === undefined || t.top > 4); };
    const out = [];
    for (let r = 0; r < Tt.GH; r++) for (const dz of [-1, 1]) for (let c = 0; c < Tt.GW;) {
      const Lv = isW(r, c) ? lvl(r + dz, c) : undefined; if (Lv === undefined) { c++; continue; }
      let c1 = c; while (c1 + 1 < Tt.GW && isW(r, c1 + 1) && lvl(r + dz, c1 + 1) === Lv) c1++;
      if ((c1 + 1 - c) * Tt.TILE >= minLen) out.push({ a0: cX(c), a1: cX(c1 + 1), fixed: dz > 0 ? cZ(r + 1) : cZ(r), nx: 0, nz: dz, alongX: true, L: Lv }); c = c1 + 1;
    }
    for (let c = 0; c < Tt.GW; c++) for (const dx of [-1, 1]) for (let r = 0; r < Tt.GH;) {
      const Lv = isW(r, c) ? lvl(r, c + dx) : undefined; if (Lv === undefined) { r++; continue; }
      let r1 = r; while (r1 + 1 < Tt.GH && isW(r1 + 1, c) && lvl(r1 + 1, c + dx) === Lv) r1++;
      if ((r1 + 1 - r) * Tt.TILE >= minLen) out.push({ a0: cZ(r), a1: cZ(r1 + 1), fixed: dx > 0 ? cX(c + 1) : cX(c), nx: dx, nz: 0, alongX: false, L: Lv }); r = r1 + 1;
    }
    return out;
  }
  // v14: murløb fundet ved SAMPLING på alle etager (bruges hvor banen ikke har et tile-gitter, fx Nuke fra STL):
  //   1 m-gitter → alle gangbare gulve i søjlen (stråle ned, ned gennem etageadskillelser) → mur inden for 1 m i 4 retninger
  //   (mur = struktur i både 0,4 m og 2,4 m højde, ikke props/gelændere/clips) → sammenhængende løb pr. (normal, plan, gulvhøjde ±0,25 m)
  let _sruns = null;
  const FLOORK = { floor: 1, ramp: 1, grate: 1, steelstairs: 1, stone: 1, slab: 1 };
  // v14: bygningens gulv (eller rampe) under (x, z) op til y + up – props, clip og gelændere tæller ikke (til sokkel-/brystningsmaling:
  //   en reol eller kasse op ad muren må ikke gøre væggen over den til 'sokkel'). -Infinity hvis intet findes.
  function buildingFloor(x, y, z, up) {
    const R = 0.32, cs = C.WD.query(W, x - R, z - R, x + R, z + R); let best = -Infinity;
    for (const c of cs) {
      if (c.k === 'prop' || c.k === 'clip' || c.k === 'rail' || x + R <= c.x0 || x - R >= c.x1 || z + R <= c.z0 || z - R >= c.z1) continue;
      const t = C.WD.topAt(c, x - R, x + R, z - R, z + R); if (t <= y + up && t > best) best = t;
    }
    return best;
  }
  function sampleRuns() {
    if (_sruns) return _sruns;
    const WD = C.WD, b = W.bounds, S = 1.0, groups = new Map(), o = { nx: 0, ny: 0, nz: 0, c: null };
    for (let x = b.x0 + 0.5; x < b.x1; x += S) for (let z = b.z0 + 0.5; z < b.z1; z += S) {
      let y = 9.6;
      for (let k = 0; k < 4 && y > -16; k++) {
        o.c = null; const t = WD.raycastWorld(W, x, y, z, 0, -1, 0, 30, o); if (t >= 30 || !o.c) break;
        const g = y - t, kind = o.c.k;
        if (FLOORK[kind] && !C.insideSolid(x, g + 0.5, z, false) && !C.insideSolid(x, g + 1.7, z, false)) {
          const up = WD.raycastWorld(W, x, g + 1.0, z, 0, 1, 0, 14), ceil = g + 1.0 + up, indoor = up < 13.9;
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const n = { nx: 0, ny: 0, nz: 0 }, tw = WD.raycastWorld(W, x, g + 1.4, z, dx, 0, dz, S, n);
            if (tw >= S || Math.abs(n.ny) > 0.1) continue;
            const wx = x + dx * tw, wz = z + dz * tw;
            if (!C.insideSolid(wx + dx * 0.05, g + 0.4, wz + dz * 0.05, false) || !C.insideSolid(wx + dx * 0.05, g + 2.4, wz + dz * 0.05, false)) continue;
            const nx = -dx, nz = -dz, alongX = nz !== 0, fixed = +(alongX ? wz : wx).toFixed(2), key = nx + ',' + nz + ',' + fixed + ',' + Math.round(g * 2);
            if (!groups.has(key)) groups.set(key, { nx, nz, alongX, fixed, pts: [] });
            groups.get(key).pts.push({ a: alongX ? x : z, g, ceil, indoor });
          }
        }
        let y2 = g - 0.05, guard = 0; while (C.insideSolid(x, y2, z, false) && guard++ < 80) y2 -= 0.25;   // ned gennem etageadskillelsen
        y = y2;
      }
    }
    const out = [];
    for (const G of groups.values()) {
      G.pts.sort((p, q) => p.a - q.a);
      let cur = null; const start = out.length;
      for (const p of G.pts) {
        if (cur && p.a - cur.last <= S + 0.01) { cur.last = p.a; cur.g0 = Math.min(cur.g0, p.g); cur.g1 = Math.max(cur.g1, p.g); cur.ceil = Math.min(cur.ceil, p.ceil); cur.ind += p.indoor ? 1 : 0; cur.n++; }
        else { if (cur) out.push(cur); cur = { first: p.a, last: p.a, g0: p.g, g1: p.g, ceil: p.ceil, ind: p.indoor ? 1 : 0, n: 1 }; }
      }
      if (cur) out.push(cur);
      for (let i = start; i < out.length; i++) {
        const r = out[i]; Object.assign(r, { a0: r.first - S / 2, a1: r.last + S / 2, fixed: G.fixed, nx: G.nx, nz: G.nz, alongX: G.alongX, L: r.g0, indoor: r.ind > r.n / 2 }); r.len = r.a1 - r.a0;
      }
    }
    return (_sruns = out);
  }
  // nærmeste lodrette væg fra et punkt (8 retninger) – til skilte ved callouts
  function nearestWall(x, y, z, maxD) {
    let best = null;
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, dx = Math.cos(a), dz = Math.sin(a), n = { nx: 0, ny: 0, nz: 0 }, t = C.WD.raycastWorld(W, x, y, z, dx, 0, dz, maxD || 8, n);
      if (t < (maxD || 8) && Math.abs(n.ny) < 0.1 && (Math.abs(n.nx) > 0.99 || Math.abs(n.nz) > 0.99) && (!best || t < best.t)) best = { t, x: x + dx * t, z: z + dz * t, nx: n.nx, nz: n.nz }; }
    return best;
  }

  // v14: model mod en væg – forsiden (modellens +z) vender ud i rummet, skaleres ind i kollisionsboksen (stretch: også højden)
  function againstWall(ctx, name, b, stretch, sMax) {
    if (!(ctx && ctx.hasModel && ctx.hasModel(name))) return false;
    const bx = ctx.modelBox(name), yaw = faceAway(b), side = Math.abs(Math.sin(yaw)) > 0.5, mw = side ? bx.max.z - bx.min.z : bx.max.x - bx.min.x, md = side ? bx.max.x - bx.min.x : bx.max.z - bx.min.z, mh = bx.max.y - bx.min.y;
    const w = b.x1 - b.x0, d = b.z1 - b.z0, H = b.y1 - b.y0, sc = Math.min(w / mw, d / md, H / mh, sMax || 99);
    return ctx.model(name, null, (b.x0 + b.x1) / 2, b.y0, (b.z0 + b.z1) / 2, yaw, stretch ? [sc, H / mh, sc] : sc);
  }
  // v14: site-bogstav malet på de (op til) to nærmeste mure omkring sitets midte – som i CS2 (ingen gulvmaling)
  function siteWallLetters(B, color, font) {
    for (const k in W.sites) {
      const st = W.sites[k], cx = (st.x0 + st.x1) / 2, cz = (st.z0 + st.z1) / 2, y = st.y + 2.6, used = [];
      const lm = mat(T.text(k, null, color, 256, 256, null, font || 'Arial Black, Arial'), { alphaTest: 0.45 });
      const cand = [];
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, n = { nx: 0, ny: 0, nz: 0 }, t = C.WD.raycastWorld(W, cx, y, cz, Math.cos(a), 0, Math.sin(a), 16, n);
        if (t < 16 && Math.abs(n.ny) < 0.1 && (Math.abs(n.nx) > 0.99 || Math.abs(n.nz) > 0.99)) cand.push({ t, x: cx + Math.cos(a) * t, z: cz + Math.sin(a) * t, nx: n.nx, nz: n.nz }); }
      cand.sort((a, b) => a.t - b.t);
      for (const c of cand) { if (used.length >= 2 || used.some(u => u.nx === c.nx && u.nz === c.nz)) continue; used.push(c); fitWallCard(B, lm, c.x, y, c.z, c.nx, c.nz, 2.2, 2.2, { detail: false }); }
    }
  }
  // v11.2: fyld en kollisionsboks med tønde-modeller (nx×nz), samme proportioner, tilfældig (deterministisk) drejning
  function modelBarrels(ctx, b, name) {
    if (!ctx || !ctx.hasModel || !ctx.hasModel(name)) return false;
    const bx = ctx.modelBox(name), mw = Math.max(bx.max.x - bx.min.x, bx.max.z - bx.min.z), mh = bx.max.y - bx.min.y;
    const w = b.x1 - b.x0, d = b.z1 - b.z0, H = b.y1 - b.y0, nx = Math.max(1, Math.floor(w / (mw * 1.02))), nz = Math.max(1, Math.floor(d / (mw * 1.02)));
    const s = Math.min(w / nx * 0.98 / mw, d / nz * 0.98 / mw, H / mh);
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) { const x = b.x0 + w * (i + 0.5) / nx, z = b.z0 + d * (k + 0.5) / nz; ctx.model(name, null, x, b.y0, z, hash2(x * 3.1, z * 1.7) * TAU, s); }
    return true;
  }
  // model-række langs boksens lange akse (krukker, gasflasker): n stk. med let variation i skala og drejning
  function modelRow(ctx, b, name, n) {
    if (!ctx || !ctx.hasModel || !ctx.hasModel(name)) return false;
    const bx = ctx.modelBox(name), mw = Math.max(bx.max.x - bx.min.x, bx.max.z - bx.min.z), mh = bx.max.y - bx.min.y;
    const w = b.x1 - b.x0, d = b.z1 - b.z0, H = b.y1 - b.y0, along = w >= d, L2 = along ? w : d, T2 = along ? d : w;
    for (let i = 0; i < n; i++) {
      const v = 0.82 + hash2(i * 7.3, b.x0 + b.z0) * 0.18, s = Math.min(L2 / n * 0.96 / mw, T2 * 0.96 / mw, H / mh) * v, a = (along ? b.x0 : b.z0) + L2 * (i + 0.5) / n;
      ctx.model(name, null, along ? a : (b.x0 + b.x1) / 2, b.y0, along ? (b.z0 + b.z1) / 2 : a, hash2(a, i) * TAU, s);
    }
    return true;
  }
  // hvilken side af en boks står op ad en mur? -> yaw så modellens forside (+z) vender ud i rummet
  function faceAway(b) {
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, y = b.y0 + 0.5;
    const free = (x, z) => !C.insideSolid(x, y, z, true);
    if (!free(cx, b.z0 - 0.3)) return 0; if (!free(cx, b.z1 + 0.3)) return Math.PI; if (!free(b.x0 - 0.3, cz)) return Math.PI / 2; if (!free(b.x1 + 0.3, cz)) return -Math.PI / 2;
    return 0;
  }
  const LIB = { ivyPatch, siteWallLetters, againstWall, modelBarrels, modelRow, faceAway, wallRuns, sampleRuns, buildingFloor, nearestWall, THREE, W, P, mkTex, mat, unlit, leafMat, rnd, hash2, col, tint, mix, mul, T, TAU, orient, wallCard, fitWallCard, panelMat, floorCard, commonMats, propLib, PAL, pick,
    frondCard, plantRadial, curvedTrunk, palm, shrub, fern, grassTuft, vineStrip, jungleTree, seedAt, railing, ladderModel, lampFixture, doorLeaf, C };
  // v10: mikro-detaljer (decals), gesims og skybox-ring – oprettes først når et tema bygges (atlas-teksturen kræver canvas)
  const withDetails = f => () => { LIB.D = createDetails(LIB); return f(LIB); };
  return { white_dust: withDetails(dustTheme), nuke: withDetails(nukeTheme), ancient: withDetails(ancientTheme), inferno: () => infernoTheme(LIB), havn: () => havnTheme(LIB), canals: () => canalsTheme(LIB) };
}
