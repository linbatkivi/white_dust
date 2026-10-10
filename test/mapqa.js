// v14 bane-QA (uden browser): svævende dekor, huller ud af banen, tomme områder og lysniveau – med varmekort.
//   node test/mapqa.js [bane ...]          → docs/qa/<bane>_qa.png + konsolrapport
//   WD_QA_STRICT=1 node test/mapqa.js      → exit 1 ved svævere eller huller (bruges af npm test)
// Metode:
//   • Dekor: hver primitiv (boks/cylinder/kort/model) i buildDecor registreres som AABB (visuals.js Batch._qa).
//     Primitiver der rører hinanden (3 cm) samles til objekter; et objekt SVÆVER, hvis ingen af dets dele rører
//     kollisionsgeometrien (mure, gulve, props, ramper, stiger) inden for 3 cm.
//   • Gangbare celler (1 m): flood fill fra begge spawns (trin, fald, stiger) – kun steder man faktisk kan stå.
//   • Huller: fra hver 2. celle skydes 16 vandrette stråler i øjenhøjde; en stråle der forlader banen uden at ramme noget = hul.
//   • Tomhed: dekor-vægt inden for 6 m (vandret) og 0–4 m over gulvet. Lys: bagt himmel + lamper i 1,2 m højde.
const fs = require('fs'), os = require('os'), path = require('path'), url = require('url'), zlib = require('zlib');
const STRICT = !!process.env.WD_QA_STRICT;
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdqa-'));
  const pub = path.join(__dirname, '..', 'public');
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  fs.copyFileSync(path.join(pub, 'vendor', 'three.module.min.js'), path.join(dir, 'three.module.min.js'));
  for (const f of fs.readdirSync(path.join(pub, 'js'))) if (f.endsWith('.js') && f !== 'app.js') fs.copyFileSync(path.join(pub, 'js', f), path.join(dir, f));
  const imp = f => import(url.pathToFileURL(path.join(dir, f)).href);
  const THREE = await imp('three.module.min.js');
  const { createVisuals } = await imp('visuals.js');
  const { createThemes } = await imp('themes.js');
  const WD = require('../shared/wd.js');
  const mkProxy = () => { const p = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : (k in t ? t[k] : (typeof k === 'symbol' ? undefined : () => p)), set: (t, k, v) => { t[k] = v; return true; }, apply: () => p }); return p; };
  const ctx = mkProxy(), ct = (d, w, h) => { d(ctx, w, h); return new THREE.Texture(); };
  const outDir = path.join(__dirname, '..', 'docs', 'qa'); fs.mkdirSync(outDir, { recursive: true });
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : WD.MAP_LIST.map(m => m.id);
  let bad = 0;
  const summary = [];
  for (const id of ids) {
    if (id === 'havn' || id === 'inferno' || id === 'canals') { console.log('\n' + id + ': forfattet bane – grafikken er Blender-bygget (test/havn.js / nav), ikke motorens'); continue; }
    const W = WD.buildWorld(id);
    globalThis.__WDQA = [];
    const V = createVisuals(THREE, WD, W, ct, 4, createThemes);
    V.buildWorldMesh(); V.buildDecor();
    const matName = new Map(); for (const k in (V.theme.mats || {})) { const m = V.theme.mats[k]; if (m && m.uuid) matName.set(m, k); }
    const b = W.bounds, E = 0.03, EW = 0.08;   // E: dele af samme objekt · EW: kontakt med mur/gulv (skilte og decals sidder 2–6 cm fra muren)
    const prims = globalThis.__WDQA.filter(p => p.tag !== 'skyline' && (p.x0 + p.x1) / 2 > b.x0 - 1 && (p.x0 + p.x1) / 2 < b.x1 + 1 && (p.z0 + p.z1) / 2 > b.z0 - 1 && (p.z0 + p.z1) / 2 < b.z1 + 1);
    globalThis.__WDQA = null;
    for (const p of prims) if (typeof p.mat !== 'string') p.mat = matName.get(p.mat) || (p.mat && (p.mat.name || (p.mat.map && p.mat.map.name) || p.mat.type)) || '?';
    // ---------- 1. svævende dekor ----------
    const par = prims.map((_, i) => i), find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
    const HC = 2, hash = new Map(), hk = (a, c) => a * 100003 + c;
    prims.forEach((p, i) => { const a0 = Math.floor((p.x0 - E) / HC), a1 = Math.floor((p.x1 + E) / HC), c0 = Math.floor((p.z0 - E) / HC), c1 = Math.floor((p.z1 + E) / HC);
      if ((a1 - a0 + 1) * (c1 - c0 + 1) > 2500) return;
      for (let a = a0; a <= a1; a++) for (let c = c0; c <= c1; c++) { const k = hk(a, c); let l = hash.get(k); if (!l) hash.set(k, l = []); l.push(i); } });
    const ov = (p, q) => p.x0 - E < q.x1 && p.x1 + E > q.x0 && p.y0 - E < q.y1 && p.y1 + E > q.y0 && p.z0 - E < q.z1 && p.z1 + E > q.z0;
    for (const l of hash.values()) for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) { const A = l[i], B = l[j]; if (find(A) !== find(B) && ov(prims[A], prims[B])) par[find(A)] = find(B); }
    const anchors = [];
    for (const lad of W.ladders) anchors.push({ x0: lad.x0 - 0.1, x1: lad.x1 + 0.1, z0: lad.z0 - 0.1, z1: lad.z1 + 0.1, y0: lad.y0, y1: lad.y1 });
    for (const d of W.doors) anchors.push({ x0: d.x - d.w / 2 - 0.3, x1: d.x + d.w / 2 + 0.3, z0: d.z - d.w / 2 - 0.3, z1: d.z + d.w / 2 + 0.3, y0: d.y, y1: d.y + 3 });
    const touches = p => {
      const cs = WD.query(W, p.x0 - EW, p.z0 - EW, p.x1 + EW, p.z1 + EW);
      for (const c of cs) {
        if (c.k === 'clip') continue;
        if (p.x0 - EW >= c.x1 || p.x1 + EW <= c.x0 || p.z0 - EW >= c.z1 || p.z1 + EW <= c.z0) continue;
        let top = c.y1; if (c.r) { const lo = Math.min(c.r.ya, c.r.yb), hi = Math.max(c.r.ya, c.r.yb); top = hi; if (p.y0 - EW > hi || p.y1 + EW < lo - 0.05) continue; }
        if (p.y0 - EW < top && p.y1 + EW > c.y0) return true;
      }
      for (const a of anchors) if (p.x0 - EW < a.x1 && p.x1 + EW > a.x0 && p.z0 - EW < a.z1 && p.z1 + EW > a.z0 && p.y0 - EW < a.y1 && p.y1 + EW > a.y0) return true;
      return p.y0 < -30;                                          // terræn/horisont under banen
    };
    const grounded = new Set(); prims.forEach((p, i) => { if (touches(p)) grounded.add(find(i)); });
    const comps = new Map(); prims.forEach((p, i) => { const r = find(i); if (!comps.has(r)) comps.set(r, []); comps.get(r).push(i); });
    const floaters = [];
    for (const [r, l] of comps) if (!grounded.has(r)) {
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity; const mats = new Set();
      for (const i of l) { const p = prims[i]; x0 = Math.min(x0, p.x0); y0 = Math.min(y0, p.y0); z0 = Math.min(z0, p.z0); x1 = Math.max(x1, p.x1); y1 = Math.max(y1, p.y1); z1 = Math.max(z1, p.z1); mats.add(p.mat.startsWith && p.mat.startsWith('model:') ? p.mat : (p.tag ? p.tag + ':' : '') + (p.mat || '?')); }
      // gap ned til nærmeste flade under objektet
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, gap = y0 - WD.groundAt(W, cx, cz, y0, 0);
      floaters.push({ x: cx, y: y0, z: cz, w: x1 - x0, h: y1 - y0, d: z1 - z0, n: l.length, gap, mats: [...mats].slice(0, 3).join(',') });
    }
    // ---------- 2. gangbare celler (flood fill) ----------
    const G = 1, gx0 = Math.floor(b.x0), gz0 = Math.floor(b.z0), NX = Math.ceil(b.x1 - gx0) + 1, NZ = Math.ceil(b.z1 - gz0) + 1;
    const floorsAt = new Map();
    const floors = (ix, iz) => {
      const k = ix * 4096 + iz; if (floorsAt.has(k)) return floorsAt.get(k);
      const x = gx0 + ix * G + 0.5, z = gz0 + iz * G + 0.5, out = []; let y = 16;
      for (let guard = 0; guard < 8; guard++) {
        const g = WD.groundAt(W, x, z, y, 0); if (g === -Infinity || g < -40) break;
        if (!WD.isBlocked(W, x, z, g, WD.PL.HC, 0.02)) out.push(g);
        y = g - 0.6;
      }
      floorsAt.set(k, out); return out;
    };
    const seen = new Map(), Q = [], nodes = [];
    const visit = (ix, iz, y) => { if (ix < 0 || iz < 0 || ix >= NX || iz >= NZ) return; const k = ix + ',' + iz + ',' + Math.round(y * 4); if (seen.has(k)) return; seen.set(k, nodes.length); nodes.push({ ix, iz, y }); Q.push(nodes.length - 1); };
    const snap = (x, z, y) => { const ix = Math.floor((x - gx0) / G), iz = Math.floor((z - gz0) / G); const fl = floors(ix, iz); let best = null; for (const f of fl) if (f <= y + 0.6 && (best === null || f > best)) best = f; if (best !== null) visit(ix, iz, best); };
    for (const side of ['hij', 'swat']) for (const s of W.spawns[side]) snap(s.x, s.z, s.y === undefined ? 0.5 : s.y + 0.3);
    const ladTop = []; for (const l of W.ladders) { const cx = (l.x0 + l.x1) / 2, cz = (l.z0 + l.z1) / 2; ladTop.push({ l, bx: cx + l.nx * 0.7, bz: cz + l.nz * 0.7, tx: cx - l.nx * 0.7, tz: cz - l.nz * 0.7 }); }
    while (Q.length) {
      const n = nodes[Q.pop()], x = gx0 + n.ix * G + 0.5, z = gz0 + n.iz * G + 0.5;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ix = n.ix + dx, iz = n.iz + dz; if (ix < 0 || iz < 0 || ix >= NX || iz >= NZ) continue;
        const nx = x + dx * G, nz = z + dz * G;
        for (const f of floors(ix, iz)) {
          if (f > n.y + 0.56) continue;                              // for højt (trin/rampe ≤ 0,55 pr. meter)
          if (f < n.y - 0.56 && WD.isBlocked(W, nx, nz, n.y, WD.PL.HC, 0.02)) continue;   // fald kun hvis man kan træde ud over kanten
          if (f < n.y - 6) continue;
          if (WD.isBlocked(W, (x + nx) / 2, (z + nz) / 2, Math.max(f, n.y), WD.PL.HC, 0.56)) continue;
          visit(ix, iz, f);
        }
      }
      for (const L of ladTop) {
        if (Math.abs(n.y - L.l.y0) < 0.3 && Math.hypot(x - L.bx, z - L.bz) < 1.1) snap(L.tx, L.tz, L.l.y1 + 0.3);
        if (Math.abs(n.y - L.l.y1) < 0.4 && Math.hypot(x - L.tx, z - L.tz) < 1.3) snap(L.bx, L.bz, L.l.y0 + 0.3);
      }
    }
    // ---------- 3. huller ud af banen ----------
    const leaks = [];
    for (const n of nodes) {
      if ((n.ix + n.iz) % 2) continue;
      const x = gx0 + n.ix * G + 0.5, z = gz0 + n.iz * G + 0.5, y = n.y + 1.6;
      for (let a = 0; a < 16; a++) {
        const dx = Math.cos(a / 16 * Math.PI * 2), dz = Math.sin(a / 16 * Math.PI * 2);
        const t = WD.raycastWorld(W, x, y, z, dx, 0, dz, 400, null, true);
        if (t >= 399) { leaks.push({ x, y, z, dx, dz }); break; }
      }
    }
    // ---------- 4. tomhed og lys ----------
    const PH = 2, phash = new Map();
    for (const p of prims) { const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2, k = hk(Math.floor(cx / PH), Math.floor(cz / PH)); let l = phash.get(k); if (!l) phash.set(k, l = []); l.push(p); }
    const R = 6, wt = p => Math.min(1, Math.max(0.15, Math.max(p.x1 - p.x0, p.y1 - p.y0, p.z1 - p.z0)));
    const pr = [0, 0, 0, 0];
    for (const n of nodes) {
      const x = gx0 + n.ix * G + 0.5, z = gz0 + n.iz * G + 0.5; let s = 0;
      for (let a = Math.floor((x - R) / PH); a <= Math.floor((x + R) / PH); a++) for (let c = Math.floor((z - R) / PH); c <= Math.floor((z + R) / PH); c++) {
        const l = phash.get(hk(a, c)); if (!l) continue;
        for (const p of l) { const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2, cy = (p.y0 + p.y1) / 2; if (cy < n.y - 0.5 || cy > n.y + 4.5) continue; if ((cx - x) ** 2 + (cz - z) ** 2 < R * R) s += wt(p); }
      }
      n.dens = s;
      V.probe(x, n.y + 1.2, z, pr); n.sky = pr[3]; n.lamp = (pr[0] + pr[1] + pr[2]) / 3; n.light = Math.min(1.5, pr[3] + n.lamp * 0.6);
    }
    // ---------- rapport ----------
    const dens = nodes.map(n => n.dens).sort((a, c) => a - c), q = f => dens[Math.floor(f * (dens.length - 1))] || 0;
    const EMPTY = 12, empty = nodes.filter(n => n.dens < EMPTY).length;
    const dark = nodes.filter(n => n.light < 0.18).length;
    console.log(`\n=== BANE-QA: ${id} ===`);
    console.log(`  dekor: ${prims.length} primitiver → ${comps.size} objekter · gangbare celler: ${nodes.length}`);
    console.log(`  tæthed (dekor-vægt inden for 6 m): p10 ${q(0.1).toFixed(1)} · median ${q(0.5).toFixed(1)} · p90 ${q(0.9).toFixed(1)} · tomme (<${EMPTY}): ${(empty / nodes.length * 100).toFixed(1)} %`);
    console.log(`  lys: mørke celler (<0,18): ${(dark / nodes.length * 100).toFixed(1)} %`);
    const okf = floaters.length === 0, okl = leaks.length === 0;
    console.log(`  ${okf ? 'ok  ' : 'FEJL'} svævende objekter: ${floaters.length}`);
    floaters.sort((a, c) => c.gap - a.gap).slice(0, process.env.WD_QA_ALL ? 999 : 25).forEach(f => console.log(`         (${f.x.toFixed(2)}, ${f.y.toFixed(2)}, ${f.z.toFixed(2)}) ${f.w.toFixed(2)}×${f.h.toFixed(2)}×${f.d.toFixed(2)} m · ${f.n} dele · ${Number.isFinite(f.gap) ? 'luft ' + f.gap.toFixed(2) + ' m' : 'intet under'} · ${f.mats}`));
    console.log(`  ${okl ? 'ok  ' : 'FEJL'} huller ud af banen (vandret sigt i øjenhøjde): ${leaks.length}`);
    leaks.slice(0, 12).forEach(l => console.log(`         fra (${l.x.toFixed(1)}, ${l.y.toFixed(1)}, ${l.z.toFixed(1)}) retning (${l.dx.toFixed(2)}, ${l.dz.toFixed(2)})`));
    if (STRICT && (!okf || !okl)) bad++;
    summary.push({ id, floaters: floaters.length, leaks: leaks.length, empty: +(empty / nodes.length * 100).toFixed(1), median: +q(0.5).toFixed(1), dark: +(dark / nodes.length * 100).toFixed(1) });
    // ---------- varmekort (PNG): pr. etage-bånd: tæthed | lys ----------
    const bands = [['kælder', -99, -2.6], ['gade', -2.6, 2.4], ['øvre', 2.4, 99]].filter(([, lo, hi]) => nodes.some(n => n.y >= lo && n.y < hi));
    const S = 4, pw = NX * S, ph = NZ * S, gap = 12, Wd = pw * 2 + gap * 3, Ht = (ph + gap) * bands.length + gap;
    const img = new Uint8Array(Wd * Ht * 3).fill(24);
    const px = (X, Y, r, g, bb) => { if (X < 0 || Y < 0 || X >= Wd || Y >= Ht) return; const o = (Y * Wd + X) * 3; img[o] = r; img[o + 1] = g; img[o + 2] = bb; };
    const rect = (X, Y, w, h, c) => { for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) px(X + xx, Y + yy, c[0], c[1], c[2]); };
    const ramp = t => { t = Math.max(0, Math.min(1, t)); return t < 0.5 ? [220, Math.round(40 + 400 * t), 40] : [Math.round(220 - 380 * (t - 0.5)), 220, Math.round(40 + 60 * (t - 0.5))]; };
    bands.forEach(([, lo, hi], bi) => {
      const oy = gap + bi * (ph + gap);
      for (const [pi] of [[0], [1]]) {
        const ox = gap + pi * (pw + gap); rect(ox, oy, pw, ph, [8, 8, 10]);
        // kollision set ovenfra (grå) som baggrund
        for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) { const fl = floors(ix, iz).filter(f => f >= lo - 3 && f < hi + 3); if (!fl.length) rect(ox + ix * S, oy + iz * S, S, S, [46, 46, 52]); }
        const best = new Map();
        for (const n of nodes) if (n.y >= lo && n.y < hi) { const k = n.ix * 4096 + n.iz, c = best.get(k); if (!c || n.y > c.y) best.set(k, n); }
        for (const n of best.values()) rect(ox + n.ix * S, oy + n.iz * S, S, S, pi === 0 ? ramp(n.dens / 40) : ramp(n.light / 1.0));
        for (const l of W.labels) { if ((l.y || 0) < lo - 1 || (l.y || 0) >= hi + 1) continue; rect(ox + Math.floor((l.x - gx0) / G) * S - 1, oy + Math.floor((l.z - gz0) / G) * S - 1, 3, 3, [255, 255, 255]); }
        if (pi === 0) {
          for (const f of floaters) if (f.y >= lo - 1 && f.y < hi + 4) rect(ox + Math.floor((f.x - gx0) / G) * S - 2, oy + Math.floor((f.z - gz0) / G) * S - 2, 5, 5, [255, 0, 255]);
          for (const l of leaks) if (l.y - 1.6 >= lo && l.y - 1.6 < hi) rect(ox + Math.floor((l.x - gx0) / G) * S - 2, oy + Math.floor((l.z - gz0) / G) * S - 2, 5, 5, [0, 230, 255]);
        }
      }
    });
    fs.writeFileSync(path.join(outDir, id + '_qa.png'), png(Wd, Ht, img));
    fs.writeFileSync(path.join(outDir, id + '_qa.json'), JSON.stringify({ id, floaters, leaks: leaks.slice(0, 200), summary: summary[summary.length - 1] }, null, 1));
  }
  console.log('\nOVERSIGT');
  for (const s of summary) console.log(`  ${s.id.padEnd(11)} svævere ${String(s.floaters).padStart(4)} · huller ${String(s.leaks).padStart(4)} · tomme ${String(s.empty).padStart(5)} % · median-tæthed ${String(s.median).padStart(5)} · mørke ${s.dark} %`);
  console.log('  varmekort: docs/qa/<bane>_qa.png (venstre: dekor-tæthed rød→grøn, magenta = svæver, cyan = hul · højre: lys)');
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

// minimal PNG-encoder (RGB, 8 bit)
function png(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1); }
  const T = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
  const crc = buf => { let c = 0xffffffff; for (const v of buf) c = T[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
