// Navigations-test (v8): Dijkstra over banen med den RIGTIGE spillerfysik (gang, nedhuk i ventilation, hop/mantle, fald, stiger)
//   • alle vigtige områder kan nås fra begge spawns, og man kan altid komme tilbage (ingen fælder)
//   • fysisk gang-test: en krop styret af stepBody følger den fundne sti (nedhuk, hop og stiger inkl.) uden at sidde fast
//   • ALLE stiger: op og ned med W/S · ventilation: hele vejen igennem (A → B) og tilbage op ad skaktstigen
//   • kollision: fuzz-test med tilfældige input (aldrig inde i geometri, aldrig ud af banen) + glidning langs kasser/containere
//   • taktik: ingen sigtelinje mellem spawns · tider: SWAT når forsvarspositioner før Hijackers
//   node test/nav.js <bane>
const WD = require('../shared/wd.js');
const MAPID = process.argv[2] || 'bureau';
const W = WD.buildWorld(MAPID);
console.log('=== NAV-TEST:', MAPID, '===');
const { PL } = WD;
const G = 0.5;                           // gitter-opløsning (m)
let bad = 0;
const fail = m => { console.log('  FEJL ' + m); bad++; };
const okm = m => console.log('  ok   ' + m);

/* ---------------- navigationsgraf ---------------- */
const key = (ix, iz, y) => ix + ',' + iz + ',' + Math.round(y * 10);
const nodes = new Map();          // key -> {ix, iz, y}
function neighbors(n) {
  const out = [], { ix, iz, y } = n;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const nx = (ix + dx) * G, nz = (iz + dz) * G, dist = Math.hypot(dx, dz) * G;
    for (const H of [PL.H, PL.HC]) {
      const crouch = H === PL.HC;
      if (dx && dz && (WD.isBlocked(W, (ix + dx) * G, iz * G, y, H) || WD.isBlocked(W, ix * G, (iz + dz) * G, y, H))) continue;
      if (!WD.isBlocked(W, nx, nz, y, H)) {
        const g = WD.groundAt(W, nx, nz, y, PL.STEP);
        if (g >= y - PL.SNAP && g > -Infinity) { out.push({ ix: ix + dx, iz: iz + dz, y: g, cost: dist / (crouch ? PL.CROUCH : PL.RUN), crouch }); break; }
        const f = WD.groundAt(W, nx, nz, y, 0.02);
        if (f > -Infinity && f > -12) { out.push({ ix: ix + dx, iz: iz + dz, y: f, cost: dist / PL.RUN + Math.sqrt(2 * (y - f) / PL.GRAV), crouch, fall: true }); break; }
        break;
      } else if (!crouch) {                                                  // hop + mantle op på kant (top ≤ hoppets top + MANTLE)
        const g = WD.groundAt(W, nx, nz, y + 1.14, PL.MANTLE);
        if (g > y + 0.4 && !WD.isBlocked(W, nx, nz, g, PL.H, 0.02) && !WD.isBlocked(W, ix * G, iz * G, y, PL.H + 1.14, 0.02)) out.push({ ix: ix + dx, iz: iz + dz, y: g, cost: dist / PL.RUN + 0.35, jump: true });
      }
    }
  }
  // stiger: fra bunden (foran stigen) til toppen og omvendt
  for (const l of W.ladders) {
    const bx = (l.x0 + l.x1) / 2 + l.nx * 0.7, bz = (l.z0 + l.z1) / 2 + l.nz * 0.7;
    if (Math.abs(n.y - l.y0) < 0.1 && Math.hypot(ix * G - bx, iz * G - bz) < 0.6) { const t = ladderTop(l); if (t) out.push({ ix: Math.round(t.x / G), iz: Math.round(t.z / G), y: t.y, cost: (l.y1 - l.y0) / PL.CLIMB + 0.6, ladder: l, up: true }); }
    const t = ladderTop(l);
    if (t && Math.abs(n.y - l.y1) < 0.1 && Math.hypot(ix * G - t.x, iz * G - t.z) < 0.6) out.push({ ix: Math.round(bx / G), iz: Math.round(bz / G), y: l.y0, cost: (l.y1 - l.y0) / PL.CLIMB + 0.6, ladder: l, up: false });
  }
  return out;
}
const _lt = new Map();
function ladderTop(l) {        // hvor stigens top-udgang placerer spilleren (samme kode som fysikken)
  if (_lt.has(l)) return _lt.get(l);
  const b = WD.newBody((l.x0 + l.x1) / 2 + l.nx * 0.5, l.y0, (l.z0 + l.z1) / 2 + l.nz * 0.5), yaw = Math.atan2(l.nx, l.nz);   // vend mod væggen: fremad = -n
  let t = 0; while (t < 8) { WD.stepBody(W, b, { fx: 1, sx: 0, yaw, jump: false }, 1 / 60); t += 1 / 60; if (!b.onLadder && b.y >= l.y1 - 0.05 && b.ground) break; }
  const r = (b.y >= l.y1 - 0.05 && b.ground) ? { x: b.x, z: b.z, y: b.y, crouch: b.crouch } : null;
  _lt.set(l, r); return r;
}
function dijkstra(sx, sz, sy, goalFn) {
  const s = { ix: Math.round(sx / G), iz: Math.round(sz / G), y: sy === undefined ? WD.groundAt(W, sx, sz, 0.5, 0.5) : sy };
  const dist = new Map(), prev = new Map(), heap = [[0, key(s.ix, s.iz, s.y), s]];
  dist.set(heap[0][1], 0);
  const push = e => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  while (heap.length) {
    const [d, k, n] = pop();
    if (d > dist.get(k)) continue;
    if (goalFn && goalFn(n)) { const path = []; for (let c = k; c; c = prev.get(c) && prev.get(c).k) path.push(prev.get(c) ? prev.get(c).step : { ...n, start: true }); return { d, path: path.reverse(), dist }; }
    for (const e of neighbors(n)) {
      const k2 = key(e.ix, e.iz, e.y), nd = d + e.cost;
      if (nd < (dist.has(k2) ? dist.get(k2) : Infinity)) { dist.set(k2, nd); prev.set(k2, { k, step: e }); push([nd, k2, { ix: e.ix, iz: e.iz, y: e.y }]); }
    }
  }
  return { d: Infinity, path: null, dist };
}
const near = (x, z, y, r) => n => Math.hypot(n.ix * G - x, n.iz * G - z) < (r || 1.0) && (y === undefined || Math.abs(n.y - y) < 0.35);

/* ---------------- fysisk gang: følg en sti med stepBody (nedhuk/hop/stiger som i spillet) ---------------- */
function walkPath(path, label, sx, sz, sy) {
  const b = WD.newBody(sx, sy === undefined ? WD.groundAt(W, sx, sz, 0.5, 0.5) : WD.groundAt(W, sx, sz, sy + 0.3, 0.5), sz);
  let t = 0, wi = 0, stuck = 0, lastProg = 0, best = 1e9;
  while (wi < path.length && t < 240) {
    const wp = path[wi];
    if (wp.start) { wi++; continue; }
    if (wp.ladder) {                                     // klatr: vend mod væggen, W op / S ned
      const l = wp.ladder, yaw = Math.atan2(l.nx, l.nz);
      if (wp.up) { b.x += ((l.x0 + l.x1) / 2 + l.nx * 0.45 - b.x); b.z += ((l.z0 + l.z1) / 2 + l.nz * 0.45 - b.z); let k = 0; while (k++ < 600 && !(b.ground && Math.abs(b.y - l.y1) < 0.08 && !b.onLadder)) { WD.stepBody(W, b, { fx: 1, sx: 0, yaw, jump: false }, 1 / 60); t += 1 / 60; } }
      else { const tp = ladderTop(l); b.x = tp.x; b.z = tp.z; b.y = tp.y; let k = 0; const lx = (l.x0 + l.x1) / 2 + l.nx * 0.4, lz = (l.z0 + l.z1) / 2 + l.nz * 0.4, toL = Math.atan2(-(lx - tp.x), -(lz - tp.z)); while (k++ < 600 && !(b.ground && Math.abs(b.y - l.y0) < 0.08)) { const onL = b.onLadder; WD.stepBody(W, b, { fx: onL ? -1 : 1, sx: 0, yaw: onL ? yaw : toL, jump: false, crouch: !!tp.crouch }, 1 / 60); t += 1 / 60; } }
      wi++; continue;
    }
    const tx = wp.ix * G, tz = wp.iz * G, dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
    if (d < 0.3 && Math.abs(b.y - wp.y) < 0.6) { wi++; continue; }
    // v12: styrer som en spiller med CS-momentum: sigter efter målet minus egen fart (modstyring), går langsomt de sidste cm
    const lead = 0.14, ex = dx - b.vx * lead, ez = dz - b.vz * lead;
    let yaw = Math.atan2(-ex, -ez);
    if (b.onLadder) { const l = WD.ladderAt(W, b); if (l && wp.y < b.y - 0.3) { yaw = Math.atan2(l.nx, l.nz); WD.stepBody(W, b, { fx: -1, sx: 0, yaw }, 1 / 60); t += 1 / 60; continue; } }   // grebet en stige i faldet: kravl ned
    WD.stepBody(W, b, { fx: 1, sx: 0, yaw, jump: !!wp.jump && b.ground && d < 1.2, crouch: !!wp.crouch || (path[wi + 1] && path[wi + 1].crouch), walk: b.ground && d < 0.55 && !wp.jump }, 1 / 60);
    t += 1 / 60;
    if (b.y < -15) { fail('FALDT UD af banen: ' + label); return null; }
    const prog = wi * 100 - d; if (prog > lastProg + 0.05) { lastProg = prog; stuck = 0; } else if (++stuck > 180) { fail(`FASTKLEMT ved ${b.x.toFixed(1)},${b.y.toFixed(1)},${b.z.toFixed(1)}: ${label}`); return null; }
  }
  if (wi < path.length) { fail('IKKE fremme: ' + label); return null; }
  return { t, b };
}

/* ---------------- bane-konfiguration ---------------- */
function findPlant(k) {
  const st = W.sites[k]; let best = null, bd = 1e9;
  for (let x = st.x0; x <= st.x1; x += 0.5) for (let z = st.z0; z <= st.z1; z += 0.5) { if (!WD.plantSpot(W, x, st.y, z)) continue; const d = Math.hypot(x - (st.x0 + st.x1) / 2, z - (st.z0 + st.z1) / 2); if (d < bd) { bd = d; best = [x, z]; } }
  return best;
}
const A_PL = findPlant('A'), B_PL = findPlant('B');
const SPT = W.spawns.hij[0], SPC = W.spawns.swat[0];
const CFG = {
  bureau: {   // v26: luksus-bureauet (tools/bureau/) – seks niveauer fra teknikkælderen (−1,5) til CT/parkeringskælderen (6,0); målene er zonernes midter
    snap: 3.5,
    targets: Object.assign({ 'A-site (plant)': [A_PL[0], A_PL[1], W.sites.A.y], 'B-site (plant)': [B_PL[0], B_PL[1], W.sites.B.y] },
      Object.fromEntries(W.data.labels.filter(l => l[0].length > 1).map(l => [l[0], [l[1], l[2], l[3]]]))),
    timings: [
      ['A-site (SWAT) før Hijackers kommer op ad Long A', 'swat', [A_PL[0], A_PL[1], W.sites.A.y], 'hij', [47.8, -11.9, 4.5]],
      ['A-site (SWAT) før Hijackers kommer gennem Søjlegangen', 'swat', [A_PL[0], A_PL[1], W.sites.A.y], 'hij', [33.2, -14.1, 3]],
      ['B-site (SWAT) før Hijackers kommer op ad Main B', 'swat', [B_PL[0], B_PL[1], W.sites.B.y], 'hij', [-27.4, -1.6, 3]]
    ]
  }
  ,
  valkyrie: {   // v26.8: middelhavsbyen – ét niveau; målene er zonernes midter
    snap: 3.5,
    targets: Object.assign({ 'A-site (plant)': [A_PL[0], A_PL[1], W.sites.A.y], 'B-site (plant)': [B_PL[0], B_PL[1], W.sites.B.y] },
      Object.fromEntries(W.data.labels.filter(l => l[0].length > 1).map(l => [l[0], [l[1], l[2], l[3]]]))),
    timings: []
  }
}[MAPID];

/* ---------------- 1. rækkevidde fra begge spawns ---------------- */
const fromT = dijkstra(SPT.x, SPT.z, SPT.y), fromC = dijkstra(SPC.x, SPC.z, SPC.y);
if (CFG.snap) for (const [name, p] of Object.entries(CFG.targets)) {          // v25: zonemidter (kan ligge på en trappe/kasse) → nærmeste nåede gulv
  let best = null, bd = Infinity;
  for (const k of fromT.dist.keys()) { if (!fromC.dist.has(k)) continue; const [ix, iz, yq] = k.split(',').map(Number), d = Math.hypot(ix * G - p[0], iz * G - p[1]) + Math.abs(yq / 10 - p[2]) * 0.5; if (d < bd && Math.abs(yq / 10 - p[2]) < CFG.snap) { bd = d; best = [ix * G, iz * G, yq / 10]; } }
  if (best && bd < CFG.snap) CFG.targets[name] = best;
}
const reached = (res, p) => { for (const [k, d] of res.dist) { const [ix, iz, yq] = k.split(',').map(Number); if (Math.hypot(ix * G - p[0], iz * G - p[1]) < 1.1 && Math.abs(yq / 10 - p[2]) < 0.35) return d; } return Infinity; };
console.log(`\nRækkevidde (graf: ${fromT.dist.size} / ${fromC.dist.size} tilstande):`);
for (const [name, p] of Object.entries(CFG.targets)) {
  const dT = reached(fromT, p), dC = reached(fromC, p);
  if (dT < Infinity && dC < Infinity) okm(`${name}: T ${dT.toFixed(1)} s · CT ${dC.toFixed(1)} s`); else fail(`${name} kan ikke nås (T ${dT}, CT ${dC})`);
}
/* ---------------- 2. ingen fælder: fra hvert område kan man komme tilbage til begge spawns ---------------- */
console.log('\nIngen fælder (tilbage til begge spawns):');
for (const [name, p] of Object.entries(CFG.targets)) {
  const r1 = dijkstra(p[0], p[1], p[2], near(SPT.x, SPT.z, SPT.y)), r2 = dijkstra(p[0], p[1], p[2], near(SPC.x, SPC.z, SPC.y));
  if (r1.path && r2.path) okm(name); else fail(`fra ${name}: T-spawn ${!!r1.path}, CT-spawn ${!!r2.path}`);
}
/* ---------------- 3. fysisk gang-test langs de korteste stier ---------------- */
console.log('\nFysisk gang (stepBody følger stien):');
for (const [name, p] of Object.entries(CFG.targets)) {
  for (const [sp, lab] of [[SPT, 'T'], [SPC, 'CT']]) {
    const r = dijkstra(sp.x, sp.z, sp.y, near(p[0], p[1], p[2], 0.8)); if (!r.path) continue;
    const w = walkPath(r.path, `${lab} → ${name}`, sp.x, sp.z, sp.y);
    if (w) { if (Math.abs(w.b.y - p[2]) < 0.6) okm(`${lab} → ${name}: ${w.t.toFixed(1)} s (graf ${r.d.toFixed(1)} s)`); else fail(`${lab} → ${name}: endte i y=${w.b.y.toFixed(2)}`); }
  }
}
/* ---------------- 4. alle stiger op og ned ---------------- */
if (W.ladders.length) console.log('\nStiger (alle):');
W.ladders.forEach((l, i) => {
  const yaw = Math.atan2(l.nx, l.nz), b = WD.newBody((l.x0 + l.x1) / 2 + l.nx * 0.6, l.y0, (l.z0 + l.z1) / 2 + l.nz * 0.6);
  let t = 0; while (t < 8) { WD.stepBody(W, b, { fx: 1, sx: 0, yaw, jump: false }, 1 / 60); t += 1 / 60; if (!b.onLadder && b.ground && b.y >= l.y1 - 0.05) break; }
  const up = b.ground && Math.abs(b.y - l.y1) < 0.06 && !WD.isBlocked(W, b.x, b.z, b.y, b.crouch ? PL.HC : PL.H, 0.02);
  up ? okm(`stige ${i + 1} (${l.y0}→${l.y1}): op på ${t.toFixed(1)} s${b.crouch ? ' (ud i kanal, nedhukket)' : ''}`) : fail(`stige ${i + 1}: kom ikke op (y=${b.y.toFixed(2)})`);
  // ned igen: gå fra top-udgangen hen mod stigen (over kanten / ned i lugen), grib den, S ned
  const tp = ladderTop(l); if (!tp) return;
  const b2 = WD.newBody(tp.x, tp.y, tp.z); b2.crouch = tp.crouch; let t2 = 0;
  const lx = (l.x0 + l.x1) / 2 + l.nx * 0.4, lz = (l.z0 + l.z1) / 2 + l.nz * 0.4, toL = Math.atan2(-(lx - tp.x), -(lz - tp.z));
  while (t2 < 8) { const on = b2.onLadder; WD.stepBody(W, b2, { fx: on ? -1 : 1, sx: 0, yaw: on ? yaw : toL, jump: false, crouch: tp.crouch }, 1 / 60); t2 += 1 / 60; if (b2.ground && Math.abs(b2.y - l.y0) < 0.06) break; }
  (b2.ground && Math.abs(b2.y - l.y0) < 0.06) ? okm(`stige ${i + 1}: ned på ${t2.toFixed(1)} s`) : fail(`stige ${i + 1}: kom ikke ned (y=${b2.y.toFixed(2)})`);
  // hop af stigen midtvejs
  const b3 = WD.newBody((l.x0 + l.x1) / 2 + l.nx * 0.6, l.y0, (l.z0 + l.z1) / 2 + l.nz * 0.6); let t3 = 0;
  while (t3 < 0.6) { WD.stepBody(W, b3, { fx: 1, sx: 0, yaw, jump: false }, 1 / 60); t3 += 1 / 60; }
  WD.stepBody(W, b3, { fx: 0, sx: 0, yaw, jump: true }, 1 / 60); const off = !b3.onLadder; let t4 = 0; while (t4 < 3 && !b3.ground) { WD.stepBody(W, b3, { fx: 0, sx: 0, yaw, jump: false }, 1 / 60); t4 += 1 / 60; }
  off && b3.ground ? okm(`stige ${i + 1}: hop af virker (lander y=${b3.y.toFixed(2)})`) : fail(`stige ${i + 1}: hop af virker ikke`);
});
/* ---------------- 5b. v9 QA: bounding box glider gennem samlinger (stiger fra skrå vinkler, hele vent-systemet med zig-zag) ---------------- */
if (W.ladders.length) {
  console.log('\nStiger fra skrå vinkler (glidende tilgang):');
  W.ladders.forEach((l, i) => {
    const face = Math.atan2(l.nx, l.nz); let okN = 0, tries = 0;
    for (const ang of [-0.6, -0.3, 0, 0.3, 0.6]) for (const side of [-0.25, 0, 0.25]) {
      tries++;
      const tx = -l.nz, tz = l.nx, cx = (l.x0 + l.x1) / 2, cz = (l.z0 + l.z1) / 2;
      const b = WD.newBody(cx + l.nx * 1.3 + tx * side, l.y0, cz + l.nz * 1.3 + tz * side);
      if (WD.isBlocked(W, b.x, b.z, b.y, PL.H)) { okN++; continue; }                    // startpunkt i væg: tæller ikke imod
      let t = 0; while (t < 9) { WD.stepBody(W, b, { fx: 1, sx: 0, yaw: face + ang * (t < 0.6 ? 1 : 0.3) }, 1 / 60); t += 1 / 60; if (!b.onLadder && b.ground && b.y >= l.y1 - 0.05) break; }
      if (b.ground && Math.abs(b.y - l.y1) < 0.06) okN++;
    }
    okN === tries ? okm(`stige ${i + 1} (${l.y0}→${l.y1}): op fra alle ${tries} vinkler/sideforskydninger`) : fail(`stige ${i + 1}: kun ${okN}/${tries} tilgange kom op`);
  });
}
/* ---------------- 6. kollision: fuzz + glidning langs props ---------------- */
console.log('\nKollision:');
{
  const R = (() => { let s = 12345; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  let inside = 0, oob = 0, frames = 0;
  const pts = [...fromT.dist.keys()].filter((k, i) => i % 97 === 0).map(k => k.split(',').map(Number));
  for (const [ix, iz, yq] of pts.slice(0, 60)) {
    const b = WD.newBody(ix * G, yq / 10, iz * G); let inp = { fx: 1, sx: 0, yaw: 0 };
    for (let f = 0; f < 600; f++) {
      if (f % 25 === 0) inp = { fx: R() < 0.8 ? 1 : -1, sx: R() < 0.3 ? (R() < 0.5 ? 1 : -1) : 0, yaw: R() * 6.28, jump: R() < 0.25, crouch: R() < 0.15, walk: R() < 0.1 };
      WD.stepBody(W, b, inp, 1 / 60); frames++;
      if (!b.onLadder && WD.isBlocked(W, b.x, b.z, b.y, b.crouch ? PL.HC : PL.H, 0.02)) { inside++; if (process.env.WD_DBG) console.log("    inde:", b.x.toFixed(2), b.y.toFixed(2), b.z.toFixed(2), b.crouch); }
      if (b.y < -12 || b.x < W.bounds.x0 - 1 || b.x > W.bounds.x1 + 1 || b.z < W.bounds.z0 - 1 || b.z > W.bounds.z1 + 1) { oob++; if (process.env.WD_DBG) console.log("    ud:", ix * G, yq / 10, iz * G, "→", b.x.toFixed(1), b.y.toFixed(1), b.z.toFixed(1)); break; }
    }
  }
  inside === 0 ? okm(`fuzz: ${frames} frames med tilfældige input – aldrig inde i geometri`) : fail(`fuzz: ${inside} frames inde i geometri`);
  oob === 0 ? okm('fuzz: ingen faldt ud af banen') : fail(`fuzz: ${oob} faldt ud af banen`);
  // glid langs alle props/containere: løb skråt (30°) ind i hver side – farten langs siden må ikke gå i stå
  let props = 0, stuckP = 0;
  for (const p of W.boxes) {
    if (p.kind !== 'prop' || p.y1 - p.y0 < 0.9) continue; props++;
    const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const sx = nx ? (nx > 0 ? p.x1 + 0.9 : p.x0 - 0.9) : cx - 0.6, sz = nz ? (nz > 0 ? p.z1 + 0.9 : p.z0 - 0.9) : cz - 0.6, gy = WD.groundAt(W, sx, sz, p.y0 + 0.5, 0.6);
      if (gy === -Infinity || Math.abs(gy - p.y0) > 0.3 || WD.isBlocked(W, sx, sz, gy, PL.H)) continue;
      const b = WD.newBody(sx, gy, sz), mvx = -nx * 0.87 + (nz ? 0.5 : 0), mvz = -nz * 0.87 + (nx ? 0.5 : 0), yaw = Math.atan2(-mvx, -mvz);
      let along = 0; const x0 = b.x, z0 = b.z;
      for (let f = 0; f < 90; f++) WD.stepBody(W, b, { fx: 1, sx: 0, yaw }, 1 / 60);
      along = nx ? Math.abs(b.z - z0) : Math.abs(b.x - x0);
      // 'klistret' = der VAR plads til at glide videre langs siden, men spilleren stod stille (et indvendigt hjørne mod en anden kasse/mur er ok)
      const tx = nx ? 0 : Math.sign(mvx), tz = nx ? Math.sign(mvz) : 0, room = !WD.isBlocked(W, b.x + tx * 0.35, b.z + tz * 0.35, b.y, PL.H, 0.5);
      if (along < 1.0 && !(b.y > p.y1 - 0.05) && room) { stuckP++; if (process.env.WD_DBG) console.log("    klistret:", p.x0.toFixed(2), p.y0.toFixed(2), p.z0.toFixed(2), p.x1.toFixed(2), p.y1.toFixed(2), p.z1.toFixed(2), "side", nx, nz); }
    }
  }
  stuckP === 0 ? okm(`glidning langs ${props} props/containere: ingen fastklemning`) : fail(`${stuckP} prop-sider stopper spilleren i stedet for at lade ham glide`);
}
/* ---------------- 7. ramper i fuld fart ---------------- */
console.log('\nRamper:');
for (const r of W.ramps) {
  // v25: brede ramper med dækning på (Ascension) – rampen skal kunne løbes hele vejen i mindst én fri bane; en ende uden indgang (muret til,
  // adgang fra siden) springes over i den retning
  const len = r.a1 - r.a0, mid = (r.w0 + r.w1) / 2, lanes = [mid, r.w0 + 0.8, r.w1 - 0.8, (r.w0 + mid) / 2, (r.w1 + mid) / 2]; for (let w = r.w0 + 0.5; w < r.w1 - 0.4; w += 0.6) lanes.push(w);
  for (const dir of [1, -1]) {
    const y0 = dir > 0 ? r.ya : r.yb, yaw = r.axis === 'x' ? (dir > 0 ? -Math.PI / 2 : Math.PI / 2) : (dir > 0 ? Math.PI : 0);
    let best = null, entered = false;
    for (const off of [1.5, 1.1, 0.8]) for (const w of lanes) {
      const startA = dir > 0 ? r.a0 - off : r.a1 + off, x = r.axis === 'x' ? startA : w, z = r.axis === 'x' ? w : startA, gy = WD.groundAt(W, x, z, y0 + 0.3, 0.5);
      if (gy === -Infinity || WD.isBlocked(W, x, z, gy, PL.H)) continue;
      const b = WD.newBody(x, gy, z); let t = 0, minV = 99, al = 0;
      while (t < 10) { WD.stepBody(W, b, { fx: 1, sx: 0, yaw }, 1 / 60); t += 1 / 60; const a = r.axis === 'x' ? b.x : b.z; al = dir > 0 ? a - startA : startA - a; if (al > off + 0.3) entered = true; if (al > off + 0.6 && al < off + len - 1.2) minV = Math.min(minV, Math.hypot(b.vx, b.vz)); if (al >= off + len - 1.0) break; }
      if (al >= off + len - 1.0 && minV > 5.0 && (!best || t < best.t)) best = { t, minV };
    }
    const lab = `rampe ${r.axis} ${r.a0}..${r.a1} ${dir > 0 ? '→' : '←'}`;
    if (best) okm(`${lab}: ${best.t.toFixed(2)} s, min fart ${best.minV.toFixed(2)}`);
    else if (!entered) okm(`${lab}: ingen indgang fra denne ende (adgang fra siden)`);
    else fail(`${lab}: ingen fri bane hele vejen`);
  }
}
/* ---------------- 8. C4-regler + spawns ---------------- */
console.log('\nC4 + spawns:');
for (const k of Object.keys(W.sites)) { const pl = findPlant(k); pl ? okm(`site ${k} har gyldigt plantested (${pl.join(', ')})`) : fail('site ' + k + ' uden plantested'); }
WD.plantSpot(W, SPT.x, SPT.y, SPT.z) ? fail('C4 kan plantes i T-spawn') : okm('C4 kan ikke plantes uden for sites');
for (const side of ['hij', 'swat']) for (const sp of W.spawns[side]) { const g = WD.groundAt(W, sp.x, sp.z, sp.y, 0.1); if (Math.abs(g - sp.y) > 0.05 || WD.isBlocked(W, sp.x, sp.z, sp.y, PL.H)) fail(`spawn ugyldig ${side} ${sp.x},${sp.z}`); }
okm('alle spawns står på frit gulv');
/* ---------------- 9. sigtelinjer: ingen spawn-til-spawn ---------------- */
console.log('\nSigtelinjer:');
{
  let los = 0, n = 0;
  const area = (list) => { const out = []; for (const p of list) for (let dx = -4; dx <= 4; dx += 2) for (let dz = -4; dz <= 4; dz += 2) { const x = p.x + dx, z = p.z + dz, g = WD.groundAt(W, x, z, p.y + 0.5, 0.6); if (g > -Infinity && !WD.isBlocked(W, x, z, g, PL.H)) out.push([x, g + PL.EYE, z]); } return out; };
  const A = area(W.spawns.hij), Bp = area(W.spawns.swat);
  for (const a of A) for (const b of Bp) { n++; if (WD.losClear(W, a[0], a[1], a[2], b[0], b[1], b[2])) los++; }
  los === 0 ? okm(`ingen sigtelinje mellem T- og CT-spawn (${n} par testet)`) : fail(`${los}/${n} sigtelinjer mellem spawns`);
}
/* ---------------- 10. tider: SWAT når forsvarspositioner før Hijackers ---------------- */
if (CFG.timings && CFG.timings.length) {
  console.log('\nTider (løb, korteste vej):');
  for (const [label, s1, p1, s2, p2] of CFG.timings) {
    const a = reached(s1 === 'swat' ? fromC : fromT, p1), b = reached(s2 === 'swat' ? fromC : fromT, p2);
    const lead = b - a;
    (lead > 0.2 && lead < 15) ? okm(`${label}: SWAT ${a.toFixed(1)} s · Hijackers ${b.toFixed(1)} s (forspring ${lead.toFixed(1)} s)`) : fail(`${label}: SWAT ${a.toFixed(1)} s · Hijackers ${b.toFixed(1)} s`);
  }
}
console.log(bad ? `\nFEJL: ${bad}` : '\nALT OK');
process.exit(bad ? 1 : 0);
