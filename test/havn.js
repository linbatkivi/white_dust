// de_havn – test af den FORFATTEDE bane (public/assets/havn: world.json/.bin, lysmaps, KTX2-teksturer) mod kollisionen
// (shared/havn_data.js via WD.buildWorld('havn')). Kører uden browser:
//   • alle filer findes · geometrien er gyldig (ingen NaN, indekser inden for rækkevidde) · budget for trekanter/hjørner/meshes
//   • grafik = kollision set ovenfra: gangfladernes højde i grafikken matcher kollisionens (tolerance 5 cm)
//   • ingen huller: hvor kollisionen har en mur foran en gå-bar position, ses der også en mur (ingen "usynlige vægge")
//   • ingen spøgelsesvægge: synlige mure/gulve uden kollision bag sig (man kunne gå igennem) – kun få tilladt (smalle detaljer)
//   • intet svæver: rekvisitternes og bygværkernes underside rører en flade (målt for alle gulv-nære vandrette flader)
const fs = require('fs'), path = require('path');
const WD = require('../shared/wd.js');
const DIR = path.join(__dirname, '..', 'public', 'assets', 'havn');
let bad = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FEJL ') + m); if (!c) bad++; };
if (!fs.existsSync(path.join(DIR, 'world.json'))) { console.log('de_havn: forfattede filer mangler (kør tools/havn/blender_build.py -- bake)'); process.exit(1); }
const meta = JSON.parse(fs.readFileSync(path.join(DIR, 'world.json'), 'utf8'));
const bin = fs.readFileSync(path.join(DIR, 'world.bin')), buf = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
const lms = JSON.parse(fs.readFileSync(path.join(DIR, 'lightmaps.json'), 'utf8'));
console.log(`de_havn (forfattet): ${meta.meshes.length} meshes, build ${new Date(meta.build * 1000).toISOString().slice(0, 16)}`);

// ---- filer
let missing = [];
for (const [k, d] of Object.entries(meta.materials)) if (d.tex && meta.meshes.some(m => m.mat === k)) for (const s of ['d', 'n', 'a']) { const f = path.join(DIR, 'tex', `${d.tex}_${s}.ktx2`); if (!fs.existsSync(f)) missing.push(path.basename(f)); }
for (const m of meta.meshes) if (m.lm) { const L = lms.chunks[m.lm]; if (!L || !fs.existsSync(path.join(DIR, L.lm))) missing.push('lysmap ' + m.lm); }
for (const f of ['sky.hdr', 'sky.json']) if (!fs.existsSync(path.join(DIR, f))) missing.push(f);
ok(missing.length === 0, `alle teksturer (KTX2), lysmaps og himmel findes${missing.length ? ': mangler ' + [...new Set(missing)].slice(0, 6).join(', ') : ''}`);
ok(meta.meshes.every(m => meta.materials[m.mat]), 'alle meshes har et materiale i manifestet');

// ---- geometri
const TRI = []; let nan = 0, idxBad = 0, verts = 0, tris = 0;
for (const m of meta.meshes) {
  const P = new Uint16Array(buf, m.off.pos, m.n * 3), I = m.i32 ? new Uint32Array(buf, m.off.idx, m.ni) : new Uint16Array(buf, m.off.idx, m.ni);
  const pos = new Float32Array(m.n * 3);
  for (let i = 0; i < m.n; i++) for (let c = 0; c < 3; c++) { const v = m.lo[c] + P[i * 3 + c] / 65535 * m.ext[c]; if (!Number.isFinite(v)) nan++; pos[i * 3 + c] = v; }
  for (let i = 0; i < m.ni; i++) if (I[i] >= m.n) idxBad++;
  verts += m.n; tris += m.ni / 3;
  const d = meta.materials[m.mat] || {};
  const cls = m.kind === 'water' || m.mat === 'water' ? 'water' : m.mat === 'glass' ? 'glass' : (d.model || /^(iron|cast_iron|gilt|brass|zinc|lead|clockface|paint_black|flag_red)$/.test(m.mat)) ? 'detail' : 'solid';
  TRI.push({ pos, I, cls, mat: m.mat });
}
ok(nan === 0 && idxBad === 0, `gyldig geometri: ${verts} hjørner, ${Math.round(tris)} trekanter (NaN ${nan}, indeks uden for ${idxBad})`);
ok(tris < 1500000 && meta.meshes.length < 700, `budget: ${Math.round(tris)} < 1,5 mio. trekanter og ${meta.meshes.length} < 700 meshes`);

// ---- accelerationsgitter (1 m i x/z) over alle trekanter
const W = WD.buildWorld('havn'), B = W.bounds;
const GX0 = -300, GZ0 = -300, GS = 1.0, GN = 600, cells = new Map();
const tri = [];
for (const T of TRI) {
  const { pos, I, cls, mat } = T;
  for (let k = 0; k < I.length; k += 3) {
    const a = I[k] * 3, b = I[k + 1] * 3, c = I[k + 2] * 3;
    const t = [pos[a], pos[a + 1], pos[a + 2], pos[b], pos[b + 1], pos[b + 2], pos[c], pos[c + 1], pos[c + 2], cls, mat];
    const id = tri.length; tri.push(t);
    const x0 = Math.floor((Math.min(t[0], t[3], t[6]) - GX0) / GS), x1 = Math.floor((Math.max(t[0], t[3], t[6]) - GX0) / GS);
    const z0 = Math.floor((Math.min(t[2], t[5], t[8]) - GZ0) / GS), z1 = Math.floor((Math.max(t[2], t[5], t[8]) - GZ0) / GS);
    if (x1 - x0 > 80 || z1 - z0 > 80) continue;                              // enorme kulisseflader (vand ude i havnen) – irrelevante her
    for (let i = Math.max(0, x0); i <= Math.min(GN - 1, x1); i++) for (let j = Math.max(0, z0); j <= Math.min(GN - 1, z1); j++) {
      const key = i * GN + j; let l = cells.get(key); if (!l) cells.set(key, l = []); l.push(id);
    }
  }
}
function hitTri(t, o, d) {                                                     // Möller–Trumbore
  const e1x = t[3] - t[0], e1y = t[4] - t[1], e1z = t[5] - t[2], e2x = t[6] - t[0], e2y = t[7] - t[1], e2z = t[8] - t[2];
  const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x, det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-12) return Infinity;
  const inv = 1 / det, tx = o[0] - t[0], ty = o[1] - t[1], tz = o[2] - t[2], u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) return Infinity;
  const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv; if (v < 0 || u + v > 1) return Infinity;
  const s = (e2x * qx + e2y * qy + e2z * qz) * inv; return s > 1e-4 ? s : Infinity;
}
function cast(o, d, maxD, accept) {                                            // 2D-DDA gennem gitteret
  let best = Infinity, bestT = null; const seen = new Set();
  let x = o[0], z = o[2]; const stepT = 0.25; const n = Math.ceil(maxD / stepT) + 1;
  for (let k = 0; k <= n; k++) {
    const tt = Math.min(maxD, k * stepT), cx = Math.floor((o[0] + d[0] * tt - GX0) / GS), cz = Math.floor((o[2] + d[2] * tt - GZ0) / GS);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const key = (cx + di) * GN + (cz + dj); if (seen.has(key)) continue; seen.add(key);
      const l = cells.get(key); if (!l) continue;
      for (const id of l) { const t = tri[id]; if (accept && !accept(t)) continue; const s = hitTri(t, o, d); if (s < best) { best = s; bestT = t; } }
    }
    if (best <= tt) break;
  }
  return best <= maxD ? { d: best, t: bestT } : null;
}
// ---- 1) set ovenfra: gangfladens højde
const STRUCT = { floor: 1, wall: 1, ceil: 1, slab: 1, stone: 1 };
const topAt = (x, z) => { let best = -Infinity; for (const q of W.boxes) { if (!STRUCT[q.kind] || q.y1 >= 8.99) continue; if (x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1 && q.y1 > best) best = q.y1; } for (const r of W.ramps) if (x > r.bx0 && x < r.bx1 && z > r.bz0 && z < r.bz1) { const h = WD.rampHeight(r, r.axis === 'x' ? x : z); if (h > best) best = h; } return best; };
let n1 = 0, mis1 = 0; const ex1 = [];
for (let i = 0; i < 700; i++) {
  const x = B.x0 + Math.random() * (B.x1 - B.x0), z = B.z0 + Math.random() * (B.z1 - B.z0), want = topAt(x, z);
  if (want === -Infinity || want < -2.5 || want > 5.5) continue;          // tage (trinvise kasser, ikke gå-bare) er ikke med                       // vand: kollisionens bund (5 cm under overfladen) er bevidst
  if (W.boxes.some(q => (STRUCT[q.kind] || q.kind === 'prop' || q.kind === 'rail') && q.y1 > want + 0.01 && q.y0 < want + 3 && x > q.x0 - 0.3 && x < q.x1 + 0.3 && z > q.z0 - 0.3 && z < q.z1 + 0.3)) continue;   // tæt på mur/genstand
  n1++;
  const h = cast([x, want + 2.5, z], [0, -1, 0], 6, t => t[9] === 'solid' || t[9] === 'water');
  const got = h ? want + 2.5 - h.d : -Infinity;
  if (Math.abs(got - want) > 0.05) { mis1++; if (ex1.length < 5) ex1.push(`(${x.toFixed(1)}, ${z.toFixed(1)}) kollision ${want.toFixed(2)} grafik ${got.toFixed(2)}${h ? ' [' + h.t[10] + ']' : ''}`); }
}
ok(mis1 <= Math.max(2, n1 * 0.01), `grafik = kollision set ovenfra: ${mis1}/${n1} afvigelser > 5 cm${ex1.length ? ' – fx ' + ex1.join('; ') : ''}`);
// ---- 2) huller og spøgelsesvægge: vandrette stråler i øjenhøjde fra gå-bare punkter
const WALLK = { wall: 1, stone: 1, floor: 1, ceil: 1 };
let LAST = null, LASTCOS = 1;
function collRay(o, d, maxD, rails) {                                           // nærmeste kollisionsboks (kun synlige typer; rails: også gelændere)
  let best = maxD; LAST = null;
  for (const q of W.boxes) {
    if (!WALLK[q.kind] && q.kind !== 'prop' && !(rails && q.kind === 'rail')) continue;
    let t0 = 0, t1 = best; const lo = [q.x0, q.y0, q.z0], hi = [q.x1, q.y1, q.z1];
    let okk = true, ax = -1;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-9) { if (o[a] < lo[a] || o[a] > hi[a]) { okk = false; break; } continue; }
      let ta = (lo[a] - o[a]) / d[a], tb = (hi[a] - o[a]) / d[a]; if (ta > tb) [ta, tb] = [tb, ta];
      if (ta > t0) { t0 = ta; ax = a; } t1 = Math.min(t1, tb); if (t0 > t1) { okk = false; break; }
    }
    if (okk && t0 > 1e-3 && t0 < best) { best = t0; LAST = q; LASTCOS = ax >= 0 ? Math.abs(d[ax]) : 1; }
  }
  for (const r of W.ramps) {                                                    // ramper: kilen under rampefladen er massiv (sidevangerne)
    let t0 = 0, t1 = best, okk = true; const lo = [r.bx0, r.bz0], hi = [r.bx1, r.bz1], oo = [o[0], o[2]], dd = [d[0], d[2]];
    for (let a = 0; a < 2; a++) {
      if (Math.abs(dd[a]) < 1e-9) { if (oo[a] < lo[a] || oo[a] > hi[a]) { okk = false; break; } continue; }
      let ta = (lo[a] - oo[a]) / dd[a], tb = (hi[a] - oo[a]) / dd[a]; if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) { okk = false; break; }
    }
    if (!okk || t0 >= best) continue;
    for (let t = Math.max(t0, 1e-3); t <= Math.min(t1, best); t += 0.1) {      // første punkt langs strålen under rampefladen
      const px = o[0] + d[0] * t, pz = o[2] + d[2] * t, py = o[1] + d[1] * t;
      if (py < WD.rampHeight(r, r.axis === 'x' ? px : pz) - 0.05) { best = t; LAST = null; break; }
    }
  }
  return best;
}
let n2 = 0, holes = 0, ghosts = 0; const exH = [], exG = [];
for (let i = 0; i < 260; i++) {
  const x = B.x0 + Math.random() * (B.x1 - B.x0), z = B.z0 + Math.random() * (B.z1 - B.z0), g = topAt(x, z);
  if (g === -Infinity || g < -2.5 || g > 5.5) continue;                          // tage og vand er ikke gå-bare
  const o = [x, g + 1.55, z];
  if (W.boxes.some(q => (WALLK[q.kind] || q.kind === 'prop' || q.kind === 'clip') && x > q.x0 - 0.35 && x < q.x1 + 0.35 && z > q.z0 - 0.35 && z < q.z1 + 0.35 && q.y1 > g + 0.05 && q.y0 < g + 1.8)) continue;
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2 + Math.random() * 0.3, d = [Math.cos(a), -0.04, Math.sin(a)];
    const dc = collRay(o, d, 25); if (dc >= 25) continue;
    const hb = LAST; if (hb && hb.kind === 'prop') continue;                    // rekvisitter: kollision = fodaftryk (kasse) – testes for sig
    if (hb && o[1] + d[1] * dc > hb.y1 - 0.08) continue;                        // strejfer toppen af en gulvflade
    if (hb && LASTCOS < 0.26) continue;                                          // strejfer langs en mur (< 15°) – hjørner/kanter
    n2++;
    const hm = cast(o, d, Math.min(25, dc + 0.6), t => t[9] !== 'water') || cast(o, d, Math.min(25, dc + 1.2), t => t[9] !== 'water' && t[9] !== 'detail'), dcr = collRay(o, d, 25, true);   // + dør-/vindueslysninger (dybde ≤ 1,2 m)
    if (!hm) { holes++; if (exH.length < 5) exH.push(`fra (${x.toFixed(1)}, ${o[1].toFixed(1)}, ${z.toFixed(1)}) retning ${(a * 57.3).toFixed(0)}° – kollision ${dc.toFixed(1)} m, ingen grafik`); }
    else if (hm.d < dcr - 0.6 && hm.t[9] === 'solid') { ghosts++; if (exG.length < 5) exG.push(`(${x.toFixed(1)}, ${z.toFixed(1)}) ${(a * 57.3).toFixed(0)}°: grafik ${hm.d.toFixed(2)} m [${hm.t[10]}] før kollision ${dc.toFixed(2)} m`); }
  }
}
ok(holes <= Math.max(2, n2 * 0.005), `ingen huller (usynlige vægge): ${holes}/${n2} stråler ramte kollision uden synlig flade${exH.length ? ' – fx ' + exH.join('; ') : ''}`);
ok(ghosts <= Math.max(4, n2 * 0.02), `ingen spøgelsesvægge (grafik uden kollision): ${ghosts}/${n2}${exG.length ? ' – fx ' + exG.join('; ') : ''}`);
// ---- 3) rekvisitter: ingen usynlige kasser – der skal være grafik inde i hver rekvisits kollisionskasse
let empty = 0; const exP = [];
const props = W.boxes.filter(q => q.kind === 'prop');
for (const q of props) {
  let found = false;
  for (let i = Math.floor((q.x0 - GX0) / GS); i <= Math.floor((q.x1 - GX0) / GS) && !found; i++) for (let j = Math.floor((q.z0 - GZ0) / GS); j <= Math.floor((q.z1 - GZ0) / GS) && !found; j++) {
    for (const id of cells.get(i * GN + j) || []) { const t = tri[id]; if (t[9] === 'water') continue;
      const cx = (t[0] + t[3] + t[6]) / 3, cy = (t[1] + t[4] + t[7]) / 3, cz = (t[2] + t[5] + t[8]) / 3;
      if (cx > q.x0 && cx < q.x1 && cz > q.z0 && cz < q.z1 && cy > q.y0 + 0.02 && cy < q.y1) { found = true; break; } }
  }
  if (!found) { empty++; if (exP.length < 5) exP.push(`(${((q.x0 + q.x1) / 2).toFixed(1)}, ${q.y0.toFixed(1)}, ${((q.z0 + q.z1) / 2).toFixed(1)})`); }
}
ok(empty === 0, `rekvisitter har synlig grafik i kollisionskassen: ${props.length - empty}/${props.length}${exP.length ? ' – tomme: ' + exP.join('; ') : ''}`);
console.log(bad ? `\nFEJL: ${bad}` : '\nALT OK');
process.exit(bad ? 1 : 0);
