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
  function job(sx, sz, sy, gx, gz, gy, r, maxNodes, pen) {
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
          const k2 = key(e.ix, e.iz, e.y), nd = d + e.cost + (pen ? pen(e.ix, e.iz) : 0);
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
  const path = (sx, sz, sy, gx, gz, gy, r, maxNodes, pen) => { const j = job(sx, sz, sy, gx, gz, gy, r, maxNodes, pen); j.run(1e9); return j.result; };

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

  /* ---------------- taktik: alternative ruter, dækning, sikre vinkler ---------------- */
  // Ruter: den korteste vej, derefter veje der undgår de foregående (straf i A*). Hver rute får 2 via-punkter, så hold kan fordeles over banen.
  function routes(from, to, count, opt) {
    opt = opt || {}; const out = [], used = new Set(), R = opt.radius || 4.5, pen = opt.pen || 7, keepStart = opt.keepStart || 11, keepEnd = opt.keepEnd || 15;
    const sk = (ix, iz) => ix + ',' + iz;
    let total0 = 0;
    for (let n = 0; n < count + 2 && out.length < count; n++) {
      const penal = n === 0 ? null : (ix, iz) => (used.has(sk(ix, iz)) ? pen : 0);
      const res = path(from.x, from.z, from.y, to.x, to.z, to.y, 0.9, 90000, penal); if (!res || res.length < 6) break;
      let len = 0; for (let i = 1; i < res.length; i++) len += Math.hypot(res[i].x - res[i - 1].x, res[i].z - res[i - 1].z);
      if (n === 0) total0 = len;
      if (len > total0 * 1.9) break;                                      // for lang omvej: ingen flere gode alternativer
      // adskilt nok fra tidligere ruter? (andel af stien der ligger > R/1.5 m fra de brugte felter)
      let far = 0, cnt = 0; for (let i = 0; i < res.length; i++) { const sx = Math.round(res[i].x / G), sz = Math.round(res[i].z / G); const dS = Math.hypot(res[i].x - from.x, res[i].z - from.z), dE = Math.hypot(res[i].x - to.x, res[i].z - to.z); if (dS < keepStart || dE < keepEnd) continue; cnt++; if (!used.has(sk(sx, sz))) far++; }
      const novel = n === 0 ? 1 : (cnt ? far / cnt : 0);
      // marker felter inden for R af stien som brugt (kun midterstykket)
      const rr = Math.ceil(R / G);
      for (const w of res) { const dS = Math.hypot(w.x - from.x, w.z - from.z), dE = Math.hypot(w.x - to.x, w.z - to.z); if (dS < keepStart || dE < keepEnd) continue; const cx = Math.round(w.x / G), cz = Math.round(w.z / G); for (let dx = -rr; dx <= rr; dx++) for (let dz = -rr; dz <= rr; dz++) if (dx * dx + dz * dz <= rr * rr) used.add(sk(cx + dx, cz + dz)); }
      if (novel < 0.45) continue;
      const pick = f => { const w = res[Math.min(res.length - 1, Math.floor(res.length * f))]; return { x: w.x, z: w.z, y: w.y }; };
      out.push({ len, novel, via: [pick(0.34), pick(0.68)], steps: res.length });
    }
    return out;
  }
  const losAt = (x, y, z, tx, ty, tz) => WD.losClear(W, x, y + eyeH, z, tx, ty + 1.2, tz);
  const standable = (x, z, y0) => { const g = WD.groundAt(W, x, z, y0 + 0.5, 1.2); if (g === -Infinity || WD.isBlocked(W, x, z, g, PL.H)) return null; return g; };
  const walkable = (a, b) => { const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.4)); let y = a.y; for (let i = 1; i <= n; i++) { const x = a.x + (b.x - a.x) * i / n, z = a.z + (b.z - a.z) * i / n; const g = WD.groundAt(W, x, z, y + 0.4, 0.5); if (g === -Infinity || Math.abs(g - y) > 0.5 || WD.isBlocked(W, x, z, g, PL.H)) return false; y = g; } return true; };
  // dækning: nærmeste gangbare felt 2–9 m væk uden sigtelinje til truslen
  function cover(from, threat, maxD) {
    maxD = maxD || 9; let best = null, bd = 1e9;
    for (let ring = 0; ring < 3; ring++) for (let k = 0; k < 14; k++) {
      const d = 2.2 + ring * 2.6 + (k % 3) * 0.4, a = k / 14 * 6.283 + ring * 0.3; if (d > maxD) continue;
      const x = from.x + Math.cos(a) * d, z = from.z + Math.sin(a) * d, g = standable(x, z, from.y); if (g === null || Math.abs(g - from.y) > 1.2) continue;
      if (losAt(x, g, z, threat.x, threat.y, threat.z)) continue;
      const c = { x, z, y: g }; if (!walkable({ x: from.x, z: from.z, y: from.y }, c)) continue;
      const score = d + Math.hypot(x - threat.x, z - threat.z) < Math.hypot(from.x - threat.x, from.z - threat.z) ? d + 6 : d;      // gerne væk fra truslen
      if (score < bd) { bd = score; best = c; }
    }
    return best;
  }
  // sikker vinkel: et punkt 1,2–2,6 m fra en holdeposition der IKKE kan ses fra 'target', men hvor holdepositionen selv kan (til skulder-peek)
  function safeSpot(h, target, seed) {
    let best = null, bd = 1e9; let s = seed || 7; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let k = 0; k < 16; k++) {
      const d = 1.1 + rnd() * 1.5, a = rnd() * 6.283, x = h.x + Math.cos(a) * d, z = h.z + Math.sin(a) * d, g = standable(x, z, h.y); if (g === null || Math.abs(g - h.y) > 0.5) continue;
      if (losAt(x, g, z, target.x, target.y, target.z)) continue;
      const c = { x, z, y: g }; if (!walkable(c, h)) continue;
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  return { path, job, nodeAt, plantSpot, holds, los, ladderTop, G, routes, cover, safeSpot, standable, walkable, losAt };
};
