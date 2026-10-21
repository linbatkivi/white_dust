// ==========================================================================
// White Dust · v26.7 HÆNDER – glatte, skinnede fingre i stedet for kapsler og kugler.
//   Hver finger er ét sammenhængende net (elliptisk tværsnit, afrundet spids, knoer, bøjefolder og fingerpude) bundet til tre knogler,
//   tommelfingeren til tre; håndryg og -flade er loftet over håndens længde med tommelfingerballe, knoer og senerygge.
//   Fingrene kan derfor bøjes glat (skydefinger, slip og greb, svingende kniv) uden mellemrum ved leddene.
// createHands(THREE) -> { buildFingers(opts), buildPalm(opts), setGrip(parts, k) }
//   Ramme (samme som armsFor): origo = grebets akse, +Y mod håndleddet, +Z = pegefingeren, fingrene krummer mod +X.
// ==========================================================================
export function createHands(THREE) {
  const V3 = THREE.Vector3;
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // lofter ringe (hver ring = n punkter) til et indekseret net; valgfri skinning (bone/weight pr. ring) og materiale-grupper
  function loft(rings, o) {
    o = o || {}; const n = rings[0].length, R = rings.length, capA = o.capStart, capB = o.capEnd;
    const pos = [], idx = [], uv = [], si = [], sw = [];
    const addV = (p, ri) => { pos.push(p.x, p.y, p.z); uv.push(p.z * 22 + p.x * 9, p.y * 22); if (o.skin) { const s = o.skin(ri); si.push(...s.i); sw.push(...s.w); } };
    for (let r = 0; r < R; r++) for (let k = 0; k < n; k++) addV(rings[r][k], r);
    for (let r = 0; r < R - 1; r++) for (let k = 0; k < n; k++) {
      const a = r * n + k, b = r * n + (k + 1) % n, c = (r + 1) * n + k, d = (r + 1) * n + (k + 1) % n; idx.push(a, c, b, b, c, d);
    }
    const cap = (ring, ri, flip) => { const c = new V3(); for (const p of ring) c.add(p); c.multiplyScalar(1 / n); const ci = pos.length / 3; addV(c, ri);
      for (let k = 0; k < n; k++) { const a = ri * n + k, b = ri * n + (k + 1) % n; if (flip) idx.push(ci, b, a); else idx.push(ci, a, b); } };
    if (capA === true) cap(rings[0], 0, true); if (capB === true) cap(rings[R - 1], R - 1, false);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    if (o.skin) { g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); }
    if (o.groups) for (const [ra, rb, mi] of o.groups) g.addGroup(ra * n * 6, (rb - ra) * n * 6 + (rb >= R - 1 && capB === true ? n * 3 : 0), mi);   // ringindeks → indeks-interval (slut-kuplen hører til sidste gruppe)
    g.computeVertexNormals(); return g;
  }
  // ét ringsæt langs en kurve: samples = [{c, Nrm, B, rt, rw}] (tykkelse langs Nrm, bredde langs B)
  const ringOf = (s, n, bulge) => { const out = []; for (let k = 0; k < n; k++) { const th = k / n * Math.PI * 2, ct = Math.cos(th), st = Math.sin(th);
      const inner = ct < 0 ? 1 + (bulge || 0) * -ct : 1;                                              // fingerpuden (siden mod grebet) er lidt buttere
      out.push(new V3().copy(s.c).addScaledVector(s.Nrm, ct * s.rt * inner).addScaledVector(s.B, st * s.rw)); } return out; };

  /* ---------------- fingre + tommelfinger ---------------- */
  function buildFingers(opt) {
    const { rg, curl, T, hij, FR, Z, LEN } = opt, fingers = [], meshes = [];
    for (let f = 0; f < 4; f++) {
      const R = rg + FR[f], z = Z[f], a0 = 200 * Math.PI / 180;
      const dA = LEN[f].map(l => (l / R) * (0.55 + 0.45 * curl)), a1 = a0 + dA[0], a2 = a1 + dA[1], a3 = a2 + dA[2];
      const P = a => new V3(Math.cos(a) * R, Math.sin(a) * R, z);
      const rings = [], lens = LEN[f], Ltot = lens[0] + lens[1] + lens[2], tipSkin = hij ? a2 + dA[2] * 0.12 : 9;   // fingerløs handske: bar spids fra ca. midten af yderste led
      const NS = 22, lead = 0.014 / R;
      for (let i = 0; i <= NS; i++) {
        const t = i / NS, a = a0 + (a3 - a0) * t - (t < 0.12 ? lead * (1 - t / 0.12) : 0), len = t * Ltot;
        const l1 = lens[0], l2 = lens[0] + lens[1];
        let r = FR[f] * (1.08 - 0.34 * t * t - 0.06 * t);                                          // tykkest ved roden, aftager mod spidsen
        for (const lj of [l1, l2]) { const d = (len - lj) / 0.0042; r *= 1 - 0.07 * Math.exp(-d * d) + 0.05 * Math.exp(-(((len - (lj - 0.007)) / 0.005) ** 2)); }   // bøjefold + knogle foran leddet
        if (t > 0.9) r *= Math.sqrt(Math.max(0.02, 1 - ((t - 0.9) / 0.1) ** 2.2));                  // afrundet kuppel
        const cc = P(a), rad = new V3(cc.x, cc.y, 0).normalize();
        rings.push(ringOf({ c: cc, Nrm: rad, B: new V3(0, 0, 1), rt: r * 0.94, rw: r * 1.06 }, 14, 0.14 * sm(0.5, 1, t)));
      }
      const b0 = new THREE.Bone(), b1 = new THREE.Bone(), b2 = new THREE.Bone(); b0.position.copy(P(a0)); b1.position.copy(P(a1)).sub(P(a0)); b2.position.copy(P(a2)).sub(P(a1)); b0.add(b1); b1.add(b2);
      const j1 = lens[0] / Ltot, j2 = (lens[0] + lens[1]) / Ltot, bw = 0.07;
      const skin = ri => { const t = ri / NS, w1 = sm(j1 - bw, j1 + bw, t), w2 = sm(j2 - bw, j2 + bw, t); return { i: [0, 1, 2, 0], w: [1 - w1, w1 * (1 - w2), w2, 0] }; };
      const ringsSkin = Math.floor(NS * (hij ? (a3 - tipSkin < 0 ? 1 : 0.62) : 1.01));
      const g = loft(rings, { skin, capEnd: true, groups: hij ? [[0, Math.max(1, ringsSkin), 0], [Math.max(1, ringsSkin), NS, 1]] : null });
      const mat = hij ? [T.glove, T.skin] : T.glove;
      const sk = new THREE.SkinnedMesh(g, mat); sk.frustumCulled = false; sk.castShadow = false;
      sk.add(b0); sk.bind(new THREE.Skeleton([b0, b1, b2])); meshes.push(sk);
      fingers.push({ bones: [b0, b1, b2], base: [0, 0, 0] });
      if (hij) {                                                                                      // negl på den bare fingerspids
        const nl = new THREE.Mesh(new THREE.SphereGeometry(FR[f] * 0.6, 14, 8), T.nail), an = a3 - dA[2] * 0.2, rr = R + FR[f] * 0.45; nl.scale.set(0.9, 0.3, 1.25);
        nl.position.set(Math.cos(an) * rr - P(a2).x, Math.sin(an) * rr - P(a2).y, 0); nl.rotation.z = an - Math.PI / 2; b2.add(nl);
      }
    }
    // tommelfinger: fra håndroden på pegefingersiden over grebet (modsat fingrene)
    const tz = 0.046, tR = rg + 0.01, ta = new V3(-0.032, 0.05, 0.036), tp = a => new V3(Math.cos(a) * tR, Math.sin(a) * tR, tz);
    const tb = tp(2.4), tc = tp(1.45), td = tp(0.75);
    const curve = new THREE.CatmullRomCurve3([ta, tb, tc, td], false, 'centripetal'), NT = 20, rings = [];
    const lb = ta.distanceTo(tb), lc = tb.distanceTo(tc), ld = tc.distanceTo(td), LT = lb + lc + ld;
    for (let i = 0; i <= NT; i++) {
      const t = i / NT, c = curve.getPoint(t), tg = curve.getTangent(t), up = new V3(0, 0, 1), Bv = new V3().crossVectors(tg, new V3(0, 0, 1)); if (Bv.lengthSq() < 1e-6) Bv.set(1, 0, 0);
      Bv.normalize(); const Nv = new V3().crossVectors(tg, Bv).normalize();                         // Nrm = T × B (udad)
      let r = 0.0158 - 0.0066 * t - 0.0016 * t * t + 0.004 * Math.exp(-(((t - 0.1) / 0.14) ** 2));   // tommelfingerballe ved roden
      const len = t * LT; for (const lj of [lb, lb + lc]) { const d = (len - lj) / 0.0045; r *= 1 - 0.06 * Math.exp(-d * d); }
      if (t > 0.92) r *= Math.sqrt(Math.max(0.02, 1 - ((t - 0.92) / 0.08) ** 2.2));
      rings.push(ringOf({ c, Nrm: Nv, B: Bv, rt: r * 0.9, rw: r * 1.08 }, 14, 0.1 * sm(0.6, 1, t)));
    }
    const tb0 = new THREE.Bone(), tb1 = new THREE.Bone(), tb2 = new THREE.Bone(); tb0.position.copy(ta); tb1.position.copy(tb).sub(ta); tb2.position.copy(tc).sub(tb); tb0.add(tb1); tb1.add(tb2);
    const j1 = lb / LT, j2 = (lb + lc) / LT, bw = 0.08;
    const tskin = ri => { const t = ri / NT, w1 = sm(j1 - bw, j1 + bw, t), w2 = sm(j2 - bw, j2 + bw, t); return { i: [0, 1, 2, 0], w: [1 - w1, w1 * (1 - w2), w2, 0] }; };
    const tg = loft(rings, { skin: tskin, capEnd: true, groups: hij ? [[0, Math.floor(NT * 0.82), 0], [Math.floor(NT * 0.82), NT, 1]] : null });
    const tm = new THREE.SkinnedMesh(tg, hij ? [T.glove, T.skin] : T.glove); tm.frustumCulled = false; tm.add(tb0); tm.bind(new THREE.Skeleton([tb0, tb1, tb2])); meshes.push(tm);
    return { fingers, thumb: { bones: [tb0, tb1, tb2] }, meshes };
  }

  /* ---------------- håndryg + håndflade (loftet) ---------------- */
  function buildPalm(opt) {
    const { rg, T } = opt, rings = [], NY = 14, n = 26, xb = -(rg + 0.028), xp = -(rg - 0.012), y0 = -0.016, y1 = 0.094;
    for (let i = 0; i <= NY; i++) {
      const t = i / NY, y = y0 + (y1 - y0) * t;
      const hw = 0.046 - 0.012 * sm(0.1, 1, t) + 0.0022 * Math.sin(t * 6);                         // bredde: bredest over knoerne, smallere ved håndleddet
      const thB = 0.021 - 0.005 * t, thP = 0.020 - 0.004 * t, cx = (xb + xp) / 2 + 0.002 * t;       // halv tykkelse (ryg · flade)
      const thenar = 0.007 * Math.exp(-(((t - 0.45) / 0.22) ** 2));                                   // tommelfingerballe (pegefingersiden, +Z)
      const hypo = 0.004 * Math.exp(-(((t - 0.4) / 0.2) ** 2));                                       // lillefingerballe (–Z)
      const ring = [];
      for (let k = 0; k < n; k++) {
        const th = k / n * Math.PI * 2, c = Math.cos(th), s = Math.sin(th), e = 2 / 2.6;
        const zz = hw * Math.sign(s) * Math.abs(s) ** e + (s > 0 ? thenar * s : hypo * s), side = c > 0 ? 1 : -1;
        const xx = cx + side * (side > 0 ? thP + thenar * 0.7 * Math.max(0, s) : thB) * Math.abs(c) ** e;
        const ridge = side < 0 ? 0.0025 * Math.cos(zz * 140) * (1 - t) * Math.abs(c) : 0;          // senerygge på håndryggen
        ring.push(new V3(xx - ridge, y, zz));
      }
      rings.push(ring);
    }
    const g = loft(rings, { capStart: true, capEnd: false }), palm = new THREE.Mesh(g, T.glove); palm.castShadow = false;
    // knoer: fire bump på håndryggen ved fingerroden
    const group = new THREE.Group(); group.add(palm);
    for (const [zk, rk] of [[0.031, 0.0112], [0.0105, 0.0118], [-0.0105, 0.0112], [-0.03, 0.0098]]) { const kn = new THREE.Mesh(new THREE.SphereGeometry(rk, 18, 12), T.glove); kn.scale.set(0.62, 0.8, 1.0); kn.position.set(xb + 0.008, -0.01, zk); group.add(kn); }
    return group;
  }

  // sætter fingrenes bøjning: k = [pegefinger, langfinger, ringfinger, lillefinger] (0 = hvile, + = mere lukket), th = tommelfinger
  function setGrip(h, k, th) {
    if (!h || !h.fingers) return;
    for (let f = 0; f < 4; f++) { const v = (k[f] === undefined ? k[0] : k[f]) || 0, b = h.fingers[f].bones; b[0].rotation.z = v * 0.55; b[1].rotation.z = v * 0.8; b[2].rotation.z = v * 0.5; }
    const tb = h.thumb.bones; tb[1].rotation.z = -(th || 0) * 0.35; tb[2].rotation.z = -(th || 0) * 0.55;
  }
  return { buildFingers, buildPalm, setGrip };
}
