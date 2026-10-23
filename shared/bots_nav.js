// ==========================================================================
// BOTS · NAVIGATION (v26.12): vej-søgning med spillets rigtige fysik (gang, nedhuk, hop/mantle, fald, stiger) – samme graf som test/nav.js.
//   createNav(WD, W) -> { path(from, to) → [trin], near(x, z, y, r) , holds(site) , plantSpot(site), eyeVisible(a, b) }
//   Trin: { x, z, y, crouch?, jump?, ladder?, up? }.  A* med lukket-liste i Map; grafen er "doven" (naboer findes ved besøg).
// ==========================================================================
module.exports = function createNav(WD, W) {
  const { PL } = WD, G = 0.5;
  const key = (ix, iz, y) => ix + ',' + iz + ',' + Math.round(y * 10);
  const ladderTopCache = new Map();

  function ladderTop(l) {                                   // hvor stigens top-udgang placerer spilleren (samme kode som fysikken)
    if (ladderTopCache.has(l)) return ladderTopCache.get(l);
    const b = WD.newBody((l.x0 + l.x1) / 2 + l.nx * 0.5, l.y0, (l.z0 + l.z1) / 2 + l.nz * 0.5), yaw = Math.atan2(l.nx, l.nz);
    let t = 0; while (t < 8) { WD.stepBody(W, b, { fx: 1, sx: 0, yaw, jump: false }, 1 / 60); t += 1 / 60; if (!b.onLadder && b.y >= l.y1 - 0.05 && b.ground) break; }
    const r = (b.y >= l.y1 - 0.05 && b.ground) ? { x: b.x, z: b.z, y: b.y, crouch: b.crouch } : null;
    ladderTopCache.set(l, r); return r;
  }

  function neighbors(n) {
    const out = [], { ix, iz, y } = n;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = (ix + dx) * G, nz = (iz + dz) * G, dist = Math.hypot(dx, dz) * G;
      for (const H of [PL.H, PL.HC]) {
        const crouch = H === PL.HC;
        if (dx && dz && (WD.isBlocked(W, (ix + dx) * G, iz * G, y, H) || WD.isBlocked(W, ix * G, (iz + dz) * G, y, H))) continue;
        if (!WD.isBlocked(W, nx, nz, y, H)) {
          if (WD.inWater && WD.inWater(W, nx, y, nz)) { /* vand er langsomt – dyrere */ }
          const g = WD.groundAt(W, nx, nz, y, PL.STEP), slow = WD.inWater && WD.inWater(W, nx, y, nz) ? 1.7 : 1;
          if (g >= y - PL.SNAP && g > -Infinity) { out.push({ ix: ix + dx, iz: iz + dz, y: g, cost: dist / (crouch ? PL.CROUCH : PL.RUN) * slow + (crouch ? 0.35 : 0), crouch }); break; }
          const f = WD.groundAt(W, nx, nz, y, 0.02);
          if (f > -Infinity && f > -12) { out.push({ ix: ix + dx, iz: iz + dz, y: f, cost: dist / PL.RUN + Math.sqrt(2 * (y - f) / PL.GRAV) + 1.0, crouch, fall: true }); break; }
          break;
        } else if (!crouch) {                               // hop + mantle op på kant
          const g = WD.groundAt(W, nx, nz, y + 1.14, PL.MANTLE);
          if (g > y + 0.4 && !WD.isBlocked(W, nx, nz, g, PL.H, 0.02) && !WD.isBlocked(W, ix * G, iz * G, y, PL.H + 1.14, 0.02)) out.push({ ix: ix + dx, iz: iz + dz, y: g, cost: dist / PL.RUN + 0.9, jump: true });
        }
      }
    }
    for (const l of W.ladders || []) {                      // stiger: bund ↔ top
      const bx = (l.x0 + l.x1) / 2 + l.nx * 0.7, bz = (l.z0 + l.z1) / 2 + l.nz * 0.7;
      if (Math.abs(n.y - l.y0) < 0.1 && Math.hypot(ix * G - bx, iz * G - bz) < 0.6) { const t = ladderTop(l); if (t) out.push({ ix: Math.round(t.x / G), iz: Math.round(t.z / G), y: t.y, cost: (l.y1 - l.y0) / PL.CLIMB + 0.6, ladder: l, up: true }); }
      const t = ladderTop(l);
      if (t && Math.abs(n.y - l.y1) < 0.1 && Math.hypot(ix * G - t.x, iz * G - t.z) < 0.6) out.push({ ix: Math.round(bx / G), iz: Math.round(bz / G), y: l.y0, cost: (l.y1 - l.y0) / PL.CLIMB + 0.6, ladder: l, up: false });
    }
    return out;
  }

  class Heap {
    constructor() { this.a = []; }
    get size() { return this.a.length; }
    push(e) { const a = this.a; a.push(e); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
    pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  }

  const nodeAt = (x, z, y) => { const g = y === undefined ? WD.groundAt(W, x, z, 0.5, 0.5) : WD.groundAt(W, x, z, y + 0.4, 0.8); return { ix: Math.round(x / G), iz: Math.round(z / G), y: g > -Infinity ? g : (y || 0) }; };

  /* A* som genoptageligt job (serveren må ikke hakke): job.run(ms) arbejder op til ms millisekunder og returnerer true når den er færdig; job.result = trin-liste (eller null) */
  function job(sx, sz, sy, gx, gz, gy, r, maxNodes) {
    r = r || 0.9; maxNodes = maxNodes || 24000;
    const s = nodeAt(sx, sz, sy), h = n => Math.hypot(n.ix * G - gx, n.iz * G - gz) / PL.RUN;
    const heap = new Heap(), dist = new Map(), prev = new Map(), k0 = key(s.ix, s.iz, s.y);
    dist.set(k0, 0); heap.push([h(s), 0, k0, s]);
    const J = { done: false, result: null, visited: 0, best: null, bestH: Infinity };
    J.run = ms => {
      const t0 = process.hrtime.bigint();
      while (heap.size) {
        if ((J.visited & 31) === 0 && Number(process.hrtime.bigint() - t0) / 1e6 > ms) return false;
        const [, d, k, n] = heap.pop();
        if (d > (dist.get(k) === undefined ? Infinity : dist.get(k))) continue;
        const dd = Math.hypot(n.ix * G - gx, n.iz * G - gz);
        if (dd < r && (gy === undefined || Math.abs(n.y - gy) < 0.9)) { J.best = k; break; }
        if (dd < J.bestH) { J.bestH = dd; J.best = k; }
        if (++J.visited > maxNodes) break;
        for (const e of neighbors(n)) {
          const k2 = key(e.ix, e.iz, e.y), nd = d + e.cost;
          if (nd < (dist.has(k2) ? dist.get(k2) : Infinity)) { dist.set(k2, nd); prev.set(k2, { k, step: e }); heap.push([nd + h(e), nd, k2, { ix: e.ix, iz: e.iz, y: e.y }]); }
        }
      }
      J.done = true;
      if (J.best === null) { J.result = null; return true; }
      if (J.best === k0) { J.result = []; return true; }
      const out = []; for (let c = J.best; prev.has(c); c = prev.get(c).k) { const st = prev.get(c).step; out.push({ x: st.ix * G, z: st.iz * G, y: st.y, crouch: !!st.crouch, jump: !!st.jump, ladder: st.ladder || null, up: st.up }); }
      out.reverse(); J.result = out; return true;
    };
    return J;
  }
  const path = (sx, sz, sy, gx, gz, gy, r, maxNodes) => { const j = job(sx, sz, sy, gx, gz, gy, r, maxNodes); j.run(1e9); return j.result; };

  /* ---------------- hold-positioner og plante-sted ---------------- */
  function plantSpot(k) {
    const st = W.sites[k]; let best = null, bd = 1e9;
    for (let x = st.x0; x <= st.x1; x += 0.5) for (let z = st.z0; z <= st.z1; z += 0.5) {
      if (!WD.plantSpot(W, x, st.y, z)) continue;
      const d = Math.hypot(x - (st.x0 + st.x1) / 2, z - (st.z0 + st.z1) / 2); if (d < bd) { bd = d; best = { x, z, y: st.y }; }
    }
    return best || { x: (st.x0 + st.x1) / 2, z: (st.z0 + st.z1) / 2, y: st.y };
  }
  const eyeH = 1.55;
  function los(a, b) { return WD.losClear(W, a.x, a.y + eyeH, a.z, b.x, b.y + 1.2, b.z); }
  // gode holdepunkter: gangbare felter i 5–13 m afstand fra målet, i samme etage, med sigtelinje til målet
  const holdMemo = new Map();
  function holds(target, minD, maxD, count, seed) {
    const mk = Math.round(target.x) + ',' + Math.round(target.z) + ',' + minD + ',' + maxD;
    if (holdMemo.has(mk)) return holdMemo.get(mk);
    const out = []; let s = seed || 1; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let tries = 0; tries < 450 && out.length < count * 6; tries++) {
      const a = rnd() * 6.283, d = minD + rnd() * (maxD - minD), x = target.x + Math.cos(a) * d, z = target.z + Math.sin(a) * d;
      const g = WD.groundAt(W, x, z, target.y + 0.5, 1.6); if (g === -Infinity || Math.abs(g - target.y) > 1.8) continue;
      if (WD.isBlocked(W, x, z, g, PL.H)) continue;
      const p = { x, z, y: g }; if (!los(p, target)) continue;
      if (out.some(o => Math.hypot(o.x - x, o.z - z) < 2.2)) continue;
      out.push(p);
    }
    const res = out.slice(0, count * 4); holdMemo.set(mk, res); return res;
  }
  return { path, job, nodeAt, plantSpot, holds, los, ladderTop, G };
};
