// Radar-generator trin 1: NÅBARE flader pr. 0,2 m-celle (node tools/radar/sample.js <bane>) → tools/radar/out/<bane>.json
// Alle gangbare gulve pr. celle (plads til en nedhukket spiller) → flood fill fra spawns (op ≤ 0,55 m, ned vilkårligt) → pr. lag den
// højeste nåede flade i lagets højdebånd. Tage og kulisse, man ikke kan nå, kommer ikke med.
const WD = require('../../shared/wd.js'), fs = require('fs'), path = require('path');
const id = process.argv[2], W = WD.buildWorld(id), B = W.bounds, R = 0.2;
const nx = Math.ceil((B.x1 - B.x0) / R), nz = Math.ceil((B.z1 - B.z0) / R);
const F = new Array(nx * nz);
function pointGround(x, z, maxY) {                                      // højeste flade under punktet med top ≤ maxY
  const e = 0.06; let best = -Infinity;
  for (const c of WD.query(W, x - e, z - e, x + e, z + e)) {
    if (c.x1 <= x - e || c.x0 >= x + e || c.z1 <= z - e || c.z0 >= z + e || c.k === 'clip') continue;
    const t = WD.topAt(c, x - e, x + e, z - e, z + e); if (t <= maxY && t > best) best = t;
  }
  return best;
}
function pointBlocked(x, z, g) {                                        // punkt (ikke spillerens radius): smalle døre/gange forsvinder ikke på radaren
  const e = 0.06;
  for (const c of WD.query(W, x - e, z - e, x + e, z + e)) {
    if (c.x1 <= x - e || c.x0 >= x + e || c.z1 <= z - e || c.z0 >= z + e || c.y0 >= g + 1.3 || c.k === 'clip') continue;
    if (WD.topAt(c, x - e, x + e, z - e, z + e) > g + 0.02) return true;
  }
  return false;
}
for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
  const x = B.x0 + (i + 0.5) * R, z = B.z0 + (j + 0.5) * R, out = [];
  let probe = 40;
  for (let k = 0; k < 10; k++) {
    const g = pointGround(x, z, probe);
    if (g === -Infinity || g < -14) break;
    if (!pointBlocked(x, z, g)) out.push(g);
    probe = g - 0.05;
  }
  F[j * nx + i] = out;
}
const seen = new Set(), q = [];
const cellOf = (x, z) => [Math.floor((x - B.x0) / R), Math.floor((z - B.z0) / R)];
for (const side of ['hij', 'swat']) for (const sp of W.spawns[side]) {
  const [i, j] = cellOf(sp.x, sp.z), fl = F[j * nx + i] || []; let best = -1;
  fl.forEach((g, k) => { if (best < 0 || Math.abs(g - sp.y) < Math.abs(fl[best] - sp.y)) best = k; });
  if (best >= 0) { const key = (j * nx + i) * 16 + best; if (!seen.has(key)) { seen.add(key); q.push(key); } }
}
while (q.length) {
  const key = q.pop(), c = key >> 4, k = key & 15, j = Math.floor(c / nx), i = c % nx, y = F[c][k];
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
    const c2 = jj * nx + ii, fl = F[c2]; let best = -1;
    fl.forEach((g, k2) => { if (g <= y + 0.55 && (best < 0 || g > fl[best])) best = k2; });       // gå/trin op ≤ 0,55 m, ellers fald ned
    if (best < 0) continue;
    const key2 = c2 * 16 + best; if (!seen.has(key2)) { seen.add(key2); q.push(key2); }
  }
}
const layers = W.layers.map(L => {
  const h = new Array(nx * nz).fill(null);
  for (const key of seen) { const c = key >> 4, g = F[c][key & 15]; if (g >= L.yb - 0.05 && g < L.yt && (h[c] === null || g > h[c])) h[c] = Math.round(g * 100) / 100; }
  return { yb: L.yb, yt: L.yt, h };
});
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'out', id + '.json'), JSON.stringify({ id, x0: B.x0, z0: B.z0, R, nx, nz, sites: W.sites, layers }));
console.log(id, nx + '×' + nz, layers.length, 'lag ·', seen.size, 'nåede flader');
if (process.env.RDBG) {
  for (const l of W.labels.slice(0, 40)) { const [i, j] = cellOf(l.x, l.z); const c = j * nx + i; const fl = F[c] || []; const r = fl.map((g, k) => seen.has(c * 16 + k) ? 'R' : '-');
    console.log(l.text.padEnd(14), l.y, JSON.stringify(fl.map(v => +v.toFixed(2))), r.join('')); }
}
