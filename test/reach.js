// v26: Rækkevidde-kontrol (de_bureau): ALLE gangbare gulvflader fra banens generator skal kunne nås fra begge spawns med spillets
//   fysik (gang, trin, hop/mantle, fald). Lommer man ikke kan nå = steder der er lukket af ved en fejl.   node test/reach.js
const WD = require('../shared/wd.js'), fs = require('fs'), path = require('path');
const W = WD.buildWorld('bureau'), PL = WD.PL, G = 0.5;
const key = (ix, iz, y) => ix + ',' + iz + ',' + Math.round(y * 10);
function flood(sx, sz, sy) {
  const s = { ix: Math.round(sx / G), iz: Math.round(sz / G), y: WD.groundAt(W, sx, sz, sy + 0.5, 0.6) }, seen = new Map([[key(s.ix, s.iz, s.y), s]]), q = [s];
  while (q.length) {
    const n = q.pop();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = (n.ix + dx) * G, nz = (n.iz + dz) * G; let to = null;
      for (const H of [PL.H, PL.HC]) {
        if (dx && dz && (WD.isBlocked(W, (n.ix + dx) * G, n.iz * G, n.y, H) || WD.isBlocked(W, n.ix * G, (n.iz + dz) * G, n.y, H))) continue;
        if (!WD.isBlocked(W, nx, nz, n.y, H)) { const g = WD.groundAt(W, nx, nz, n.y, PL.STEP); if (g > -Infinity && g >= n.y - 6) { to = g; break; } }
        else if (H === PL.H) { const g = WD.groundAt(W, nx, nz, n.y + 1.14, PL.MANTLE); if (g > n.y + 0.4 && !WD.isBlocked(W, nx, nz, g, PL.H, 0.02)) { to = g; break; } }
      }
      if (to === null) continue;
      const k = key(n.ix + dx, n.iz + dz, to); if (!seen.has(k)) { const m = { ix: n.ix + dx, iz: n.iz + dz, y: to }; seen.set(k, m); q.push(m); }
    }
  }
  return seen;
}
const all = new Map();
for (const side of ['hij', 'swat']) for (const [k, v] of flood(W.spawns[side][0].x, W.spawns[side][0].z, W.spawns[side][0].y)) all.set(k, v);
const reached = new Set([...all.values()].map(n => n.ix + ',' + n.iz));
// gulvceller fra generatoren (gangbare, ikke under et møbel): bureau_walk.json skrives af export_collision.py
const WK = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', 'bureau', 'out', 'bureau_walk.json'), 'utf8'));
let miss = [];
for (const [x, z, y, room] of WK.cells) {
  const ix = Math.round(x / G), iz = Math.round(z / G);
  if (WD.isBlocked(W, x, z, y, PL.HC)) continue;                                   // under inventar/rækværk: ok
  let ok = false;                                                                     // flood-gitteret er 0,5 m: en celle tæt på en væg kan runde
  for (let a = -1; a <= 1 && !ok; a++) for (let b = -1; b <= 1 && !ok; b++) ok = reached.has((ix + a) + ',' + (iz + b));   // til et blokeret punkt
  if (!ok) miss.push([x, z, y, room]);
}
const byRoom = {}; for (const m of miss) (byRoom[m[3]] = byRoom[m[3]] || []).push(m);
console.log(`=== RÆKKEVIDDE: ${WK.cells.length} gulvceller · ${reached.size} nået · ${miss.length} kan ikke nås ===`);
for (const [r, l] of Object.entries(byRoom).sort((a, b) => b[1].length - a[1].length)) {
  const xs = l.map(c => c[0]), zs = l.map(c => c[1]);
  console.log(`  ${r.padEnd(16)} ${String(l.length).padStart(4)} celler (${(l.length * 0.25).toFixed(1)} m²) · x ${Math.min(...xs).toFixed(1)}..${Math.max(...xs).toFixed(1)} z ${Math.min(...zs).toFixed(1)}..${Math.max(...zs).toFixed(1)} y ${l[0][2]}`);
}
const big = Object.values(byRoom).filter(l => l.length > 8).length;
console.log(big ? `\nFEJL: ${big} lukkede lommer (> 2 m²)` : '\nALT OK');
process.exit(big ? 1 : 0);
