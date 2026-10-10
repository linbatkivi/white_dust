// Navigations-test (v8): Dijkstra over banen med den RIGTIGE spillerfysik (gang, nedhuk i ventilation, hop/mantle, fald, stiger)
//   • alle vigtige områder kan nås fra begge spawns, og man kan altid komme tilbage (ingen fælder)
//   • fysisk gang-test: en krop styret af stepBody følger den fundne sti (nedhuk, hop og stiger inkl.) uden at sidde fast
//   • ALLE stiger: op og ned med W/S · ventilation: hele vejen igennem (A → B) og tilbage op ad skaktstigen
//   • kollision: fuzz-test med tilfældige input (aldrig inde i geometri, aldrig ud af banen) + glidning langs kasser/containere
//   • taktik: ingen sigtelinje mellem spawns · tider: SWAT når forsvarspositioner før Hijackers
//   node test/nav.js <bane>
const WD = require('../shared/wd.js');
const MAPID = process.argv[2] || 'white_dust';
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
  white_dust: {
    targets: { 'A-site (plant)': [A_PL[0], A_PL[1], W.sites.A.y], 'B-site (plant)': [B_PL[0], B_PL[1], W.sites.B.y], 'Pit': [39, -12, -1.8], 'A-closet': [40, -45, 1.2], 'B-closet': [-36, -45, -0.8], 'Ninja': [22, -46.5, 1.2],
      'Mid': [0, 0, 0], 'Catwalk': [19, -10, 0], 'Long A': [31, 20, 0], 'Upper tunnels': [-32, 0, 0], 'Lower tunnels': [-16, 8, 0], 'Mid-balkon': [-4.5, -8, 3.2], 'Catwalk-loft': [12, -9, 3.2], 'B-galleri': [-30, -28, 2.8] },
    timings: [
      ['Mid-døren (SWAT) før Hijackers når Mid', 'swat', [-4, -22, 0], 'hij', [-4, -16, 0]],
      ['Catwalk (SWAT) før Hijackers', 'swat', [19, -10, 0], 'hij', [19, -10, 0]],
      ['B-site (SWAT) før Hijackers kommer ud af tunnellerne', 'swat', [-25, -38, -0.8], 'hij', [-32, -16, 0]],
      ['A-site (SWAT) før Hijackers kommer op fra Long A', 'swat', [30, -36, 1.2], 'hij', [37, -16, 0]]
    ]
  },
  nuke: {   // v12.1: Nuke bygget præcist efter STL-modellen (koordinater fra tools/nuke_from_stl.py)
    targets: {
      'A-site (plant)': [A_PL[0], A_PL[1], 0], 'B-site (plant)': [B_PL[0], B_PL[1], W.sites.B.y],
      'Lobby': [-20.3, 0.5, 0], 'Squeaky': [-17.6, 10.3, 0], 'Radio': [-21.6, -12.2, 0], 'Control': [-14.4, -12.2, 0], 'Trophy': [-28.4, -9.9, 0], 'Hut': [-7.2, 4.5, 0],
      'A site': [-0.5, -8.2, 0], 'Main': [0.9, 20.7, 0], 'Mustang': [-7.2, -13.1, 0], 'Ramp room': [0, -24.8, 0], 'Lockers': [14.8, -5, 0], 'Turnpike': [14.8, -12.6, 0],
      'CT Box': [29.3, 7.3, 0.24], 'CT-pladsen': [40, -8, 2.09], 'CT Red': [16, 18.5, 0], 'T Red': [0.4, 36.8, 0], 'Silo': [-15.8, 26.1, 0], 'Outside': [6.8, 27.4, 0], 'Garage': [30.1, 29.3, 0],
      'T Roof (sti)': [-27, 6.6, 5.83], 'Silo-top': [-15.57, 19.4, 6.23], 'Palace': [7.4, -10, 4.0], 'Ramp-landing': [0, -40, -1.75], 'Ramp (midt)': [0, -32, -3.87], 'Bottom Ramp': [-0.4, -17.7, -6.22], 'B site': [-0.4, 2.5, -9.3],
      'Window': [12.5, -7.5, -6.22], 'Tunnels': [12.6, 16, -6.22], 'Decon': [-13, 16, -9.3], 'Secret-gangen': [13.95, 25.0, -6.22], 'Secret-trappens top': [19.0, 40.3, -1.25]
    },
    // tider (s): SWAT skal nå forsvarspositionen FØR Hijackers når frem (som i CS)
    timings: [
      ['B-site (SWAT) før Hijackers', 'swat', [-0.4, 2.5, -9.3], 'hij', [-0.4, 2.5, -9.3]],
      ['Ramp room (SWAT) før Hijackers', 'swat', [0, -24.8, 0], 'hij', [0, -24.8, 0]],
      ['Outside (SWAT) før Hijackers', 'swat', [6.8, 27.4, 0], 'hij', [6.8, 27.4, 0]],
      ['Secret-trappen (SWAT) før Hijackers', 'swat', [19.0, 40.3, -1.25], 'hij', [19.0, 40.3, -1.25]]
    ]
  },
  inferno: {   // v17: CS:GO-Inferno fra Blender-importen (tools/infsrc/) – mål = sites + wikiens callouts (dem der står på åbent gulv)
    targets: Object.assign({ 'A-site (plant)': [A_PL[0], A_PL[1], W.sites.A.y], 'B-site (plant)': [B_PL[0], B_PL[1], W.sites.B.y] },
      Object.fromEntries((W.labels || []).filter(l => l.nav !== false).map(l => [l.text, [l.x, l.z, l.y]]))),
    timings: [
      ['A-site (SWAT) før Hijackers', 'swat', [A_PL[0], A_PL[1], W.sites.A.y], 'hij', [A_PL[0], A_PL[1], W.sites.A.y]],
      ['B-site (SWAT) før Hijackers', 'swat', [B_PL[0], B_PL[1], W.sites.B.y], 'hij', [B_PL[0], B_PL[1], W.sites.B.y]]
    ]
  },
  canals: {   // v16: CS:GO de_canals fra Blender-importen (tools/canals/) – mål = sites + radarens callouts
    targets: Object.assign({ 'A-site (plant)': [A_PL[0], A_PL[1], W.sites.A.y], 'B-site (plant)': [B_PL[0], B_PL[1], W.sites.B.y] },
      Object.fromEntries((W.labels || []).map(l => [l.text, [l.x, l.z, l.y]]))),
    timings: [
      ['A-site (SWAT) før Hijackers', 'swat', [A_PL[0], A_PL[1], W.sites.A.y], 'hij', [A_PL[0], A_PL[1], W.sites.A.y]],
      ['B-site (SWAT) før Hijackers', 'swat', [B_PL[0], B_PL[1], W.sites.B.y], 'hij', [B_PL[0], B_PL[1], W.sites.B.y]]
    ]
  },
  ancient: {   // v14: jungle-tempel (tools/ancient_gen.py)
    targets: { 'A-site (plant)': [A_PL[0], A_PL[1], W.sites.A.y], 'B-site (plant)': [B_PL[0], B_PL[1], W.sites.B.y], 'T Ramp': [-34, 40.5, 0.3], 'A Main': [-41.5, 20, 0.6], 'Elbow': [-42, -6, 0.6],
      'Red Room': [-22, 18, 0.6], 'Mid': [-3.5, 24, 0], 'Vandkanalen': [-7, 26, -0.35], 'House': [11, 14, 0], 'Top Mid': [5.5, -10, 0.8], 'Donut': [-18, -13.5, 0.8], 'Temple': [-40, -42, 1.6],
      'Templets helligdom': [-44, -51, 3.2], 'CT Mid': [8.5, -28, 0], 'Ruins': [18, -40, 0], 'B Short': [17, -4, 0.8], 'Cave': [24, 14.7, 0], 'B Lane': [43.5, 24, 0], 'B Ramp': [43.5, -6, -0.4], 'Bassinet (B)': [35, -30, -1.55] },
    timings: [
      ['Top Mid (SWAT) før Hijackers', 'swat', [5.5, -10, 0.8], 'hij', [5.5, -10, 0.8]],
      ['A-site (SWAT) før Hijackers kommer op ad Elbow', 'swat', [-40, -27, 1.6], 'hij', [-34.5, -16.5, 1.6]],
      ['A-site (SWAT) før Hijackers via Donut', 'swat', [-35, -22, 1.6], 'hij', [-31.5, -19, 1.6]],
      ['B-site (SWAT) før Hijackers via B Ramp', 'swat', [36, -24, -1.2], 'hij', [43.5, -18.5, -1.2]],
      ['B-site (SWAT) før Hijackers via B Short', 'swat', [34, -22, -1.2], 'hij', [34, -18.5, -1.2]]
    ]
  },
  havn: {   // v15: nordisk havnebydel (tools/havn/layout.py) – tre niveauer ved kanalen
    targets: {
      'A-site (plant)': [A_PL[0], A_PL[1], W.sites.A.y], 'B-site (plant)': [B_PL[0], B_PL[1], W.sites.B.y],
      'Banegården': [-55, 0, 0], 'Værftsgade': [-52, -28, 0], 'Havnefronten': [-40, -42, 0], 'Kajpladsen': [-6, -40, 0], 'Klapbroen': [16, -37, 1.0],
      'Pontonen': [16, -36.7, -1.6], 'Molen': [33, -49, -1.6], 'Nedre kaj NV': [9.5, -24, -1.6], 'Nedre kaj NØ': [22.5, -24, -1.6], 'Nordgade': [2, -23, 0],
      'Pakhuset': [-14, -26, 0], 'Loftet': [-14, -27, 3.4], 'Loftsbalkonen': [-6, -18, 3.4], 'Rebslagergang': [-35, -7.5, 0], 'Baggården': [-21, 0, 1.2],
      'Torvet': [-3, -8, 0], 'Slusen': [16, -5.2, 0], 'Kirkepladsen': [29, 0, 0], 'Bagergang': [-30, 8.5, 0], 'Bryggergade': [-40, 21, 0], 'Brohovedet': [4, 30, 0],
      'Sydbroen': [16, 37, 1.0], 'Nedre kaj SV': [9.5, 30, -1.6], 'Prammen': [16, 22, -1.6], 'Krybegangen': [26, 22, -1.6], 'Iskælderen': [31, 26, -1.6],
      'B (hallen)': [38, 31, 1.0], 'Galleriet': [48, 30, 4.4], 'Perronen': [26, 36, 1.0], 'Fiskergården': [56, 33, 0], 'Toldgade': [29, -21, 0],
      'A (Toldbodpladsen)': [40, -38, 0], 'Kastellet': [60, 0, 3.4]
    },
    timings: [
      ['A-site (SWAT) før Hijackers kommer over Klapbroen', 'swat', [40, -38, 0], 'hij', [27, -37, 0.5]],
      ['A-site (SWAT) før Hijackers kommer op ad Moletrappen', 'swat', [40, -38, 0], 'hij', [41.2, -43, 0]],
      ['Kirkepladsen (SWAT) før Hijackers kommer over Slusen', 'swat', [27, -5, 0], 'hij', [22, -5.2, 0]],
      ['B-site (SWAT) før Hijackers kommer over Sydbroen', 'swat', [38, 31, 1.0], 'hij', [26, 37, 1.0]],
      ['B-site (SWAT) før Hijackers kommer op fra Iskælderen', 'swat', [38, 31, 1.0], 'hij', [34.7, 28.5, 1.0]]
    ]
  }
}[MAPID];

/* ---------------- 1. rækkevidde fra begge spawns ---------------- */
const fromT = dijkstra(SPT.x, SPT.z, SPT.y), fromC = dijkstra(SPC.x, SPC.z, SPC.y);
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
/* ---------------- 5. ventilation + hatch (Nuke): Outside → kanal → skakt → Back Vents → B, og tilbage op ---------------- */
if (MAPID === 'nuke' && false) {
  console.log('\nVentilation og Hatch:');
  // ventilationen måles i to stræk (ellers vælger grafen den kortere vej gennem Hatchen): Outside → skaktens bund, og skaktens bund → B-site
  const r = dijkstra(1, 19.5, 0, near(9, 15, -6, 0.8));
  if (!r.path || !r.path.some(s => s.crouch) || !r.path.some(s => s.fall)) fail('ingen ventilations-sti fra Outside ned i skakten');
  else { const w = walkPath(r.path, 'vent Outside → skakt', 1, 19.5, 0); if (w) okm(`Outside → kanal → fald i skakten: ${w.t.toFixed(1)} s (nedhuk i kanalen)`); }
  const rB = dijkstra(9, 15, -6, near(B_PL[0], B_PL[1], -6, 1.2));
  if (!rB.path || !rB.path.some(s => s.crouch)) fail('Back Vents → B-site mangler'); else { const w = walkPath(rB.path, 'Back Vents → B', 9, 15, -6); if (w) okm(`Back Vents → B-site: ${w.t.toFixed(1)} s`); }
  const r2 = dijkstra(9, 4, -6, n => Math.abs(n.y) < 0.2 && n.iz * G > 14 && n.iz * G < 16);
  if (r2.path && r2.path.some(s => s.ladder)) { const w = walkPath(r2.path, 'B → op ad skaktstigen', 9, 4, -6); if (w) okm(`B → op ad skaktstigen til kanalen: ${w.t.toFixed(1)} s`); } else fail('kan ikke klatre op i ventilationen fra B');
  const rD = dijkstra(9, 15, -6, near(-7, 12, -6, 1.5)); rD.path && rD.path.some(s => s.crouch) ? okm('Back Vents forbinder også til Decon') : fail('ventilation → Decon mangler');
  const stand = WD.isBlocked(W, 5, 15, 0, PL.H) && !WD.isBlocked(W, 5, 15, 0, PL.HC);
  stand ? okm('kanalen er snæver: kun plads nedhukket') : fail('kanalen er ikke kun-nedhukket');
  const rH = dijkstra(1, -1, 0, near(1, 3, -6, 0.9)); rH.path && rH.path.some(s => s.fall) ? okm(`Hatch: drop fra A ned i B på ${rH.d.toFixed(1)} s`) : fail('Hatch (A → B) virker ikke');
}
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
if (MAPID === 'nuke' && false) {
  console.log('\nVentilation – kravl hele kanalen med zig-zag (samlinger mellem kanal-segmenter):');
  // fra Outside ind gennem åbningen (mod nord), langs kanalen mod øst (svingende kurs + sidelæns) til skakten ved x 8..10, og ned til B
  const b = WD.newBody(1, 0, 19.5); let t = 0, lastX = b.x, lastT = 0, stuckAt = null;
  while (t < 40 && b.y > -5.9) {
    const inDuct = b.z < 15.3;
    let yaw = 0, sx = 0;                                                                  // yaw 0: fremad = -z (ind i åbningen)
    if (inDuct && b.x < 2.6) yaw = -Math.PI / 2;                                          // drej ind i kanalen ved åbningen
    else if (inDuct) { yaw = -Math.PI / 2 + Math.sin(t * 2.3) * 0.35; sx = Math.sin(t * 1.7) > 0.6 ? 1 : Math.sin(t * 1.7) < -0.6 ? -1 : 0; }
    if (b.onLadder) { yaw = -Math.PI / 2; sx = 0; }                                         // greb skakt-stigen i faldet: S = ned
    WD.stepBody(W, b, { fx: b.onLadder ? -1 : 1, sx, yaw, crouch: true }, 1 / 60); t += 1 / 60;
    if (t - lastT > 1.5) { if (inDuct && Math.abs(b.x - lastX) < 0.4 && b.y > -0.5) { stuckAt = [b.x, b.y, b.z]; break; } lastX = b.x; lastT = t; }
  }
  (b.y <= -5.9 && !stuckAt) ? okm(`vent Outside → skakt: igennem på ${t.toFixed(1)} s og ned i Back Vents (ingen fastlåsning trods zig-zag)`) : fail(`vent: ${stuckAt ? 'FAST ved ' + stuckAt.map(v => v.toFixed(2)).join(',') : 'kom ikke igennem (y=' + b.y.toFixed(2) + ')'}`);
}
if (MAPID === 'nuke') {
  console.log('\nVentilation (STL-Nuke): ned ad skakten ved Main og kravl Back Vents-kanalen igennem til Tunnels:');
  const l = W.ladders.find(q => q.y1 > -0.1 && q.y0 < -4);
  const b = WD.newBody((l.x0 + l.x1) / 2 + l.nx * 0.5, 0, (l.z0 + l.z1) / 2); b.y = WD.groundAt(W, b.x, b.z, 0.3, 0.5) > -Infinity ? 0 : 0;
  // stå ved hullet, vend mod stigen og kravl ned (S)
  b.x = (l.x0 + l.x1) / 2; b.z = (l.z0 + l.z1) / 2; b.y = -0.2; b.ground = false; b.vy = -1;
  let t = 0; const face = Math.atan2(l.nx, l.nz);
  while (t < 8 && !(b.ground && b.y < l.y0 + 0.1)) { WD.stepBody(W, b, { fx: b.onLadder ? -1 : 0, sx: 0, yaw: face }, 1 / 60); t += 1 / 60; }
  const down = b.y < l.y0 + 0.1;
  // kanalens forløb (som i printet): mod øst, et knæk mod nord ved x≈3, videre mod øst og ud i Tunnels – med vaklende kurs undervejs
  const WPS = [[2.9, 14.6], [2.9, 13.05], [11.5, 13.05], [13, 13.05]];
  let t2 = 0, xMax = b.x, wi = 0;
  while (t2 < 25 && b.y > -6.0) {
    const [tx, tz] = WPS[Math.min(wi, WPS.length - 1)]; if (Math.hypot(tx - b.x, tz - b.z) < 0.35 && wi < WPS.length - 1) wi++;
    const yaw = Math.atan2(-(tx - b.x), -(tz - b.z)) + Math.sin(t2 * 2.1) * 0.2;
    WD.stepBody(W, b, { fx: 1, sx: 0, yaw, crouch: true }, 1 / 60); t2 += 1 / 60; xMax = Math.max(xMax, b.x);
  }
  (down && b.y <= -6.0) ? okm(`vent: ned ad skakten (${t.toFixed(1)} s) og gennem kanalen ud i Tunnels på ${t2.toFixed(1)} s`) : fail(`vent: ned=${down}, endte ved x=${b.x.toFixed(2)} y=${b.y.toFixed(2)} (længst x=${xMax.toFixed(2)})`);
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
      if (along < 1.0 && !(b.y > p.y1 - 0.05) && room) stuckP++;
    }
  }
  stuckP === 0 ? okm(`glidning langs ${props} props/containere: ingen fastklemning`) : fail(`${stuckP} prop-sider stopper spilleren i stedet for at lade ham glide`);
}
/* ---------------- v13 (Nuke): tagene er lukkede – kun T Roof-stien, gangbroen og siloens top; Palace kun ad stigen ---------------- */
if (MAPID === 'nuke' && W.data) {
  console.log('\nTage og Palace (v13):');
  const flood = (sx, sz, ladders) => {
    const keep = W.ladders; W.ladders = ladders;
    const s = { ix: Math.round(sx / G), iz: Math.round(sz / G), y: WD.groundAt(W, sx, sz, 0.5, 0.5) }, seen = new Map([[key(s.ix, s.iz, s.y), s]]), q = [s];
    while (q.length) { const n = q.pop(); for (const m of neighbors(n)) { const k = key(m.ix, m.iz, m.y); if (!seen.has(k)) { m.from = n; seen.set(k, m); q.push(m); } } }
    W.ladders = keep; return [...seen.values()];
  };
  const D = W.data, LV = D.levels, roofs = D.roofs;
  const onRoof = n => roofs.some(r => n.ix * G > r[0] + 0.3 && n.ix * G < r[2] - 0.3 && n.iz * G > r[1] + 0.3 && n.iz * G < r[3] - 0.3 && Math.abs(n.y - r[5]) < 0.15);
  const allowed = n => (n.iz * G > 5.3 && n.ix * G < -13.9 && Math.abs(n.y - LV.roofT) < 0.15);                 // T Roof-stien
  const all = [...flood(W.spawns.hij[0].x, W.spawns.hij[0].z, W.ladders), ...flood(W.spawns.swat[0].x, W.spawns.swat[0].z, W.ladders)];
  const badRoof = all.filter(n => onRoof(n) && !allowed(n));
  if (badRoof.length && process.env.WD_DBG) { let n = badRoof[0], path = []; while (n && path.length < 400) { path.push(`(${n.ix * G},${n.iz * G},${n.y.toFixed(2)}${n.jump ? ' hop' : ''}${n.ladder ? ' stige' : ''})`); n = n.from; } console.log(path.slice(0, 40).join(' <- ')); }
  badRoof.length ? fail(`${badRoof.length} punkter oppe på tagene kan nås, fx (${badRoof[0].ix * G}, ${badRoof[0].iz * G}, y ${badRoof[0].y})`) : okm('tagene kan ikke nås (kun T Roof-stien og gangbroen til siloen)');
  const pal = W.ladders.findIndex(l => Math.abs(l.y1 - LV.palace) < 0.05);
  const noLadder = W.ladders.filter((l, i) => i !== pal);
  const fromA = flood(0, -7, noLadder).filter(n => Math.abs(n.y - LV.palace) < 0.1 && n.ix * G > 6 && n.ix * G < 8.6 && n.iz * G > -15.5 && n.iz * G < -5);
  fromA.length ? fail('Palace kan nås fra A uden stigen') : okm('Palace kan ikke nås inde fra A (kun ad stigen i Turnpike)');
}
/* ---------------- 7. ramper i fuld fart ---------------- */
console.log('\nRamper:');
for (const r of W.ramps) {
  const len = r.a1 - r.a0, mid = (r.w0 + r.w1) / 2;
  for (const dir of [1, -1]) {
    const off = (() => { for (const o of [1.5, 1.1, 0.8]) for (const m of [(r.w0 + r.w1) / 2, r.w0 + 0.8, r.w1 - 0.8]) { const a = dir > 0 ? r.a0 - o : r.a1 + o, x = r.axis === 'x' ? a : m, z = r.axis === 'x' ? m : a;
      const g = WD.groundAt(W, x, z, (dir > 0 ? r.ya : r.yb) + 0.3, 0.5); if (g > -Infinity && !WD.isBlocked(W, x, z, g, PL.H)) return o; } return 1.5; })();   // v17: mur tæt ved rampens fod (Nuke B)
    const startA = dir > 0 ? r.a0 - off : r.a1 + off, endA = dir > 0 ? r.a1 + 0.6 : r.a0 - 0.6;
    const yaw = r.axis === 'x' ? (dir > 0 ? -Math.PI / 2 : Math.PI / 2) : (dir > 0 ? Math.PI : 0), y0 = dir > 0 ? r.ya : r.yb;
    let x, z, gy = -Infinity;
    for (const w of [mid, r.w0 + 0.8, r.w1 - 0.8, (r.w0 + mid) / 2, (r.w1 + mid) / 2]) {        // start i en fri bane (ikke klods op ad en kasse)
      x = r.axis === 'x' ? startA : w; z = r.axis === 'x' ? w : startA; gy = WD.groundAt(W, x, z, y0 + 0.3, 0.5);
      if (gy > -Infinity && !WD.isBlocked(W, x, z, gy, PL.H) && !WD.isBlocked(W, r.axis === 'x' ? startA + (dir > 0 ? 2 : -2) : x, r.axis === 'x' ? z : startA + (dir > 0 ? 2 : -2), WD.groundAt(W, r.axis === 'x' ? startA + (dir > 0 ? 2 : -2) : x, r.axis === 'x' ? z : startA + (dir > 0 ? 2 : -2), y0 + 0.6, 0.8), PL.H)) break;
    }
    if (gy === -Infinity) continue;
    const b = WD.newBody(x, gy, z); let t = 0, minV = 99;
    while (t < 10) { WD.stepBody(W, b, { fx: 1, sx: 0, yaw }, 1 / 60); t += 1 / 60; const a = r.axis === 'x' ? b.x : b.z, al = dir > 0 ? a - startA : startA - a; if (al > 1.5 && al < len) minV = Math.min(minV, Math.hypot(b.vx, b.vz)); if (dir > 0 ? a >= endA : a <= endA) break; }
    (t < 10 && minV > 5.0) ? okm(`rampe ${r.axis} ${r.a0}..${r.a1} ${dir > 0 ? '→' : '←'}: ${t.toFixed(2)} s, min fart ${minV.toFixed(2)}`) : fail(`rampe ${r.axis} ${r.a0}..${r.a1}: ${t.toFixed(2)} s, min fart ${minV.toFixed(2)}`);
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
