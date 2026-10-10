// ==========================================================================
// SKINS (v11.3): katalog over agenter (spillerfigurer + farvevarianter) og våben-finishes, delt af spil og inventar.
//   • AGENTS: realistiske CC0-figurer (SWAT/hijackere, tools/chars/build.py → public/assets/chars) med farvevarianter pr. materialenavn
//   • WEAPON_SKINS: finishes til alle skydevåben – farver pr. materialekategori + mønster i shaderen (model-rum => ingen UV'er nødvendige)
//       mønstre: solid · camo (skov/arktisk) · digital (pixel-camo) · tiger (striber) · carbon (vævet kulfiber) · slid (kantslid + ridser)
//   • sanitize(): validerer et inventar-valg (også på serveren) – ukendte id'er falder tilbage til standard
//   • prepGun(): roterer/normaliserer en våbenmodel (løb langs -z, op = +y, længde 1) uanset modellens egne akser/enheder
// ==========================================================================
export const RARITY = {
  base: { name: 'STANDARD', col: '#b0c3d9' }, mil: { name: 'MIL-SPEC', col: '#4b69ff' }, res: { name: 'RESTRICTED', col: '#8847ff' },
  cls: { name: 'CLASSIFIED', col: '#d32ce6' }, cov: { name: 'COVERT', col: '#eb4b4b' }, gold: { name: 'CONTRABAND', col: '#e4ae39' }
};
// farver i sRGB-hex; base = våbnets krop, dark = detaljer/greb, wood = skæfter, p = mønsterfarver
export const WEAPON_SKINS = [
  { id: 'factory', name: 'Worn Factory', rarity: 'base', pat: 'worn', base: 0x3a3833, dark: 0x1e1c19, wood: 0x6b4426, rough: 0.66, metal: 0.35, team: 'hij' },
  { id: 'graphite', name: 'Tactical Graphite', rarity: 'base', pat: 'solid', base: 0x34383d, dark: 0x1b1d20, wood: 0x2a2c2f, rough: 0.42, metal: 0.25, team: 'swat' },
  { id: 'desert', name: 'Desert Storm', rarity: 'mil', pat: 'solid', base: 0xb39b74, dark: 0x3a332a, wood: 0x8a7352, rough: 0.6, metal: 0.1 },
  { id: 'woodland', name: 'Woodland', rarity: 'mil', pat: 'camo', base: 0x4c5a35, dark: 0x22251c, wood: 0x5b4a33, p: [0x2e3a22, 0x6b5a3a, 0x1b1e17], rough: 0.7, metal: 0.05 },
  { id: 'digital', name: 'Urban Digital', rarity: 'res', pat: 'digital', base: 0x6f757b, dark: 0x202326, wood: 0x45494d, p: [0x3d4247, 0x9ca3a8, 0x24272a], rough: 0.62, metal: 0.08 },
  { id: 'arctic', name: 'Arctic Ghost', rarity: 'res', pat: 'camo', base: 0xd8dde0, dark: 0x3b4044, wood: 0xa9b0b5, p: [0x9aa3aa, 0xf2f4f5, 0x5d666d], rough: 0.55, metal: 0.05 },
  { id: 'tiger', name: 'Tiger Strike', rarity: 'cls', pat: 'tiger', base: 0xd9822b, dark: 0x16120e, wood: 0x6b3a18, p: [0x120d09], rough: 0.45, metal: 0.15 },
  { id: 'carbon', name: 'Carbon Weave', rarity: 'cls', pat: 'carbon', base: 0x222427, dark: 0x0f1011, wood: 0x1a1b1d, p: [0x34383c], rough: 0.3, metal: 0.4 },
  { id: 'redline', name: 'Redline', rarity: 'cov', pat: 'redline', base: 0x161718, dark: 0x0c0c0d, wood: 0x1d1d1f, p: [0xc0202a], rough: 0.35, metal: 0.3 },
  { id: 'gold', name: 'Golden Reserve', rarity: 'gold', pat: 'solid', base: 0xd4a640, dark: 0x6b5220, wood: 0x3a2412, rough: 0.18, metal: 1.0 }
];
export const SKIN_BY_ID = Object.fromEntries(WEAPON_SKINS.map(s => [s.id, s]));
export const defaultSkin = team => team === 'hij' ? 'factory' : 'graphite';

// agenter (v19): realistiske SWAT-operatører og hijackere (tools/chars/build.py – MakeHuman CC0-kroppe + modelleret udstyr).
// model = fil i /assets/chars; farvevarianter pr. materialenavn (Top, Pants, Vest, Helmet, Gloves, Pads, Mask, Beanie) -> sRGB-hex.
// Første variant = modellens egne farver.
export const AGENTS = {
  swat: [
    { id: 'swat', name: 'SWAT-operatør', model: 'swat', variants: [
      { id: 'navy', name: 'Marineblå', rarity: 'base', col: {} },
      { id: 'black', name: 'Sort taktisk', rarity: 'mil', col: { Top: 0x3d4046, Pants: 0x3a3d43, Vest: 0x323437, Helmet: 0x353739 } },
      { id: 'ranger', name: 'Ranger-grøn', rarity: 'res', col: { Top: 0x687254, Pants: 0x5f684d, Vest: 0x737a5c, Helmet: 0x6a7058, Pads: 0x50553f } },
      { id: 'urban', name: 'Urban grå', rarity: 'cls', col: { Top: 0x82868e, Pants: 0x6c7078, Vest: 0x4a4d52, Helmet: 0x5a5e64 } }
    ] },
    { id: 'swat2', name: 'SWAT-stormer', model: 'swat2', variants: [
      { id: 'black', name: 'Sort', rarity: 'mil', col: {} },
      { id: 'navy', name: 'Marineblå', rarity: 'res', col: { Top: 0x55617c, Pants: 0x4f5a72, Vest: 0x424a5a } },
      { id: 'coyote', name: 'Coyote', rarity: 'cls', col: { Top: 0x6a7058, Pants: 0x646a52, Vest: 0xb19b7f, Helmet: 0xa38f74, Pads: 0x9a876c } },
      { id: 'arctic', name: 'Arktisk', rarity: 'cov', col: { Top: 0xc9cdd1, Pants: 0xb7bcc1, Vest: 0xdadde0, Helmet: 0xe3e5e7, Mask: 0xe0e0dc, Gloves: 0xcfd2d4, Pads: 0xd5d8da } }
    ] }
  ],
  hij: [
    { id: 'hij', name: 'Hijacker', model: 'hij', variants: [
      { id: 'olive', name: 'Oliven jakke', rarity: 'base', col: {} },
      { id: 'black', name: 'Sort jakke', rarity: 'mil', col: { Top: 0x3e4044, Pants: 0x55596a, Vest: 0x55564c } },
      { id: 'brown', name: 'Brun læderjakke', rarity: 'res', col: { Top: 0x765945, Vest: 0x8f8667 } },
      { id: 'red', name: 'Rød maske', rarity: 'cls', col: { Top: 0x4c4f53, Mask: 0x953135 } }
    ] },
    { id: 'hij2', name: 'Hijacker (shemagh)', model: 'hij2', variants: [
      { id: 'sand', name: 'Sand', rarity: 'mil', col: {} },
      { id: 'olive', name: 'Oliven', rarity: 'res', col: { Top: 0x6d7158, Pants: 0x63664f, Vest: 0x7c7c5d } },
      { id: 'grey', name: 'Grå', rarity: 'cls', col: { Top: 0x8a8c8e, Pants: 0x5d6064, Vest: 0x707168 } }
    ] },
    { id: 'hij3', name: 'Hijacker-leder', model: 'hij3', variants: [
      { id: 'coyote', name: 'Coyote', rarity: 'cls', col: {} },
      { id: 'black', name: 'Sort', rarity: 'cov', col: { Vest: 0x37393c, Top: 0x45484c, Pants: 0x404349 } },
      { id: 'woodland', name: 'Skov', rarity: 'gold', col: { Vest: 0x646c54, Top: 0x5c6249, Pants: 0x575d47, Beanie: 0x575d47 } }
    ] }
  ]
};
export const GUNS = ['ak47', 'm4a1', 'famas', 'galil', 'mac10', 'mp9', 'mp7', 'ump45', 'p90', 'tec9', 'mp5', 'awp', 'usp', 'glock', 'fiveseven', 'deagle'];
// model-fil pr. våben (fiveseven deler Glock-modellen; granater har hold-varianter)
export const GUN_FILE = { ak47: 'ak47', m4a1: 'm4a1', famas: 'famas', galil: 'galil', tec9: 'tec9', mp5: 'mp5', mac10: 'mac10', mp9: 'mp9', mp7: 'mp7', ump45: 'ump45', p90: 'p90', awp: 'awp', usp: 'usp', glock: 'glock', fiveseven: 'glock', deagle: 'deagle',
  he: { hij: 'he_east', swat: 'he_west' }, smoke: { hij: 'smoke_east', swat: 'smoke_west' }, flash: 'flash', incgren: 'incgren', molotov: 'molotov' };
export const defaultAgent = side => side === 'hij' ? 'hij:olive' : 'swat:navy';

/* ---- v12: KNIVE (procedurale modeller i weapons.js) × finishes. Valget gemmes som '<model>_<finish>' i inv.skins.knife ---- */
export const KNIVES = [
  { id: 'karambit', name: 'Karambit' },
  { id: 'butterfly', name: 'Butterfly-kniv' },
  { id: 'bayonet', name: 'M9 Bayonet' },
  { id: 'talon', name: 'Talon-kniv' }
];
export const KNIFE_FINISHES = [
  { id: 'vanilla', name: 'Vanilla', rarity: 'cov' },
  { id: 'damascus', name: 'Damascus Steel', rarity: 'cov' },
  { id: 'crimson', name: 'Crimson Web', rarity: 'gold' },
  { id: 'fade', name: 'Fade', rarity: 'gold' },
  { id: 'doppler', name: 'Doppler', rarity: 'gold' },
  { id: 'tiger', name: 'Tiger Tooth', rarity: 'gold' }
];
export const defaultKnife = 'karambit_fade';
export function knifeOf(key) {
  const [m, f] = String(key || '').split('_');
  const model = KNIVES.find(k => k.id === m) || KNIVES.find(k => k.id === defaultKnife.split('_')[0]);
  const fin = KNIFE_FINISHES.find(k => k.id === f) || KNIFE_FINISHES.find(k => k.id === defaultKnife.split('_')[1]);
  return { model, finish: fin, key: model.id + '_' + fin.id, name: model.name + ' | ' + fin.name };
}
export function agentOf(key, side) {
  const list = AGENTS[side] || AGENTS.swat, [aid, vid] = String(key || '').split(':');
  const a = list.find(x => x.id === aid) || list[0], v = a.variants.find(x => x.id === vid) || a.variants[0];
  return { agent: a, variant: v, key: a.id + ':' + v.id };
}
// inventar-valg -> gyldigt objekt (bruges af både klient og server)
export function sanitize(inv) {
  const out = { agent: { swat: defaultAgent('swat'), hij: defaultAgent('hij') }, skins: {} };
  if (!inv || typeof inv !== 'object') return out;
  for (const side of ['swat', 'hij']) if (inv.agent && typeof inv.agent[side] === 'string') out.agent[side] = agentOf(inv.agent[side].slice(0, 40), side).key;
  if (inv.skins && typeof inv.skins === 'object') for (const g of GUNS) { const s = inv.skins[g]; if (typeof s === 'string' && SKIN_BY_ID[s]) out.skins[g] = s; }
  if (inv.skins && typeof inv.skins.knife === 'string') out.skins.knife = knifeOf(inv.skins.knife.slice(0, 40)).key;
  return out;
}

/* ======================================================== våben-geometri ======================================================== */
// statisk model (Group af Meshes) -> ny Group med normaliseret geometri: længste akse langs -z (mundingen = slankeste ende),
// højde langs +y (tyngdepunktet ligger mod oversiden: løb/receiver), længde 1, centreret. Materialer bevares (pr. navn).
export function prepGun(THREE, src, o) {
  o = o || {};
  const pts = [], meshes = [];
  src.updateMatrixWorld(true);
  src.traverse(m => { if (m.isMesh) { meshes.push(m); const P = m.geometry.attributes.position; for (let i = 0; i < P.count; i += 1) pts.push([P.getX(i), P.getY(i), P.getZ(i)]); } });
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity], sum = [0, 0, 0];
  for (const p of pts) for (let k = 0; k < 3; k++) { if (p[k] < mn[k]) mn[k] = p[k]; if (p[k] > mx[k]) mx[k] = p[k]; sum[k] += p[k]; }
  const ext = [0, 1, 2].map(k => mx[k] - mn[k]), ax = o.nade ? ext.indexOf(Math.max(...ext)) : ext.indexOf(Math.max(...ext));
  const rest = [0, 1, 2].filter(k => k !== ax), upAx = o.nade ? ax : (ext[rest[0]] >= ext[rest[1]] ? rest[0] : rest[1]), sideAx = [0, 1, 2].find(k => k !== ax && k !== upAx);
  const ctr = [0, 1, 2].map(k => (mn[k] + mx[k]) / 2), cen = sum.map(v => v / pts.length);
  let len, fwd = 1, up = 1, M = new THREE.Matrix4();
  if (o.nade) {                                                                     // granat: lodret akse = højeste udstrækning, sikringsbøjle opad (mest masse forneden)
    len = ext[ax]; up = cen[ax] > ctr[ax] ? -1 : 1;
    const e = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]; e[0].setComponent(rest[0], 1); e[1].setComponent(ax, up); e[2].setComponent(rest[1], 1);
    M.makeBasis(e[0], e[1], e[2]).transpose();
  } else {
    len = ext[ax];
    // munding = enden med mindst tværsnit (målt over de yderste 10 %)
    const cross = sgn => { const lim = sgn > 0 ? mx[ax] - ext[ax] * 0.1 : mn[ax] + ext[ax] * 0.1; let a0 = Infinity, a1 = -Infinity; for (const p of pts) if (sgn > 0 ? p[ax] >= lim : p[ax] <= lim) { a0 = Math.min(a0, p[upAx]); a1 = Math.max(a1, p[upAx]); } return a1 - a0; };
    fwd = cross(1) < cross(-1) ? 1 : -1;                                             // +akse-enden er mundingen?
    up = cen[upAx] > ctr[upAx] ? 1 : -1;                                             // receiver/løb (flest vertices) ligger øverst
    if (o.flipUp) up = -up; if (o.flipFwd) fwd = -fwd;
    // rækker: ny x = side, ny y = up, ny z = -fwd langs aksen  (løbet mod -z)
    const rx = new THREE.Vector3(), ry = new THREE.Vector3(), rz = new THREE.Vector3();
    ry.setComponent(upAx, up); rz.setComponent(ax, -fwd); rx.crossVectors(ry, rz);
    M.set(rx.x, rx.y, rx.z, 0, ry.x, ry.y, ry.z, 0, rz.x, rz.y, rz.z, 0, 0, 0, 0, 1);
  }
  const s = 1 / len, T = new THREE.Matrix4().makeScale(s, s, s).multiply(M).multiply(new THREE.Matrix4().makeTranslation(-ctr[0], -ctr[1], -ctr[2]));
  const out = new THREE.Group();
  for (const m of meshes) { const g = m.geometry.clone(); g.applyMatrix4(T); g.computeBoundingBox(); const mm = new THREE.Mesh(g, m.material); mm.name = m.name; if (m.userData.part) mm.userData.part = m.userData.part; out.add(mm); }
  return out;
}
// materialekategori ud fra navnet (Pichuliru: M_PCL_Flat_*, Quaternius: Grey/Wood/Metal …)
export function matCat(name) {
  const n = String(name || '').toLowerCase();
  if (/brass|yellow|gold/.test(n)) return 'brass';
  if (/blue|red\b|red\.|cerulean|brick/.test(n)) return 'band';
  if (/white|grey_light|lightmetal/.test(n)) return 'light';
  if (/wood|brown|chestnut|bole/.test(n)) return 'wood';
  if (/darker|black|darkgrey|maindark/.test(n)) return 'dark';
  return 'body';
}
// mønster-shader (model-rum; geometrien er normaliseret til længde 1)
const PAT_ID = { solid: 0, camo: 1, digital: 2, tiger: 3, carbon: 4, worn: 5, redline: 6 };
const PAT_GLSL = `
uniform vec3 uP0, uP1, uP2; uniform float uPat;
varying vec3 vGP;
float gh(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float gn(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gh(i), gh(i + vec3(1,0,0)), f.x), mix(gh(i + vec3(0,1,0)), gh(i + vec3(1,1,0)), f.x), f.y), mix(mix(gh(i + vec3(0,0,1)), gh(i + vec3(1,0,1)), f.x), mix(gh(i + vec3(0,1,1)), gh(i + vec3(1,1,1)), f.x), f.y), f.z); }
vec3 gunPattern(vec3 base) {
  vec3 p = vGP;
  if (uPat < 0.5) return base;
  if (uPat < 1.5) { float a = gn(p * 9.0) * 0.6 + gn(p * 21.0) * 0.4, b = gn(p * 12.0 + 7.3) * 0.6 + gn(p * 30.0 + 2.0) * 0.4;   // camo
    vec3 c = base; if (a > 0.55) c = uP0; if (b > 0.6) c = uP1; if (a < 0.3 && b < 0.4) c = uP2; return c; }
  if (uPat < 2.5) { vec3 q = floor(p * 60.0); float a = gn(floor(p * 9.0) + q * 0.08), b = gh(q);                              // digital
    vec3 c = base; if (a > 0.5) c = uP0; if (a > 0.66 && b > 0.4) c = uP1; if (a < 0.32) c = uP2; return c; }
  if (uPat < 3.5) { float s = sin(p.z * 70.0 + gn(p * 8.0) * 9.0 + p.y * 18.0); return s > 0.55 ? uP0 : base; }                   // tiger
  if (uPat < 4.5) { vec2 q = fract(vec2(p.z, p.y) * 90.0); float w = step(0.5, fract(floor(p.z * 90.0) * 0.5 + floor(p.y * 90.0) * 0.5));   // carbon
    float sh = w > 0.5 ? q.x : q.y; return mix(base, uP0, 0.35 + 0.65 * sin(sh * 3.14159)); }
  if (uPat < 5.5) { float sc = gn(p * 40.0) * gn(p * 7.0); return mix(base, base * 1.6 + 0.04, smoothstep(0.45, 0.6, sc)); }        // slid/ridset
  float r = abs(fract(p.z * 6.0 + p.y * 3.0) - 0.5); return mix(base, uP0, smoothstep(0.06, 0.03, r));                            // redline-striber
}`;
// skin på en normaliseret våbenmodel. mk(opts) laver materialet (spillets dynMat/withBake, så lyset passer); key = shader-variant
/* v13: pr.-model materiale-justeringer (efter prepGun, i normaliseret model-rum: længde 1, løbet mod -z, op = +y).
   AK-47 (Pichuliru 'Rifle Assault East'): træ på kolbe, greb og håndbeskytter – magasinet forbliver sort stål */
export const GUN_FIX = {
  ak47: [{ mat: 'M_PCL_Flat_Black_Lighter', to: 'Wood_AK', keep: c => c.y < -0.02 && c.z > -0.2 && c.z < 0.02 }],
  galil: [{ mat: 'M_PCL_Flat_Black_Lighter', to: 'Wood_Galil', keep: c => c.y < -0.02 && c.z > -0.22 && c.z < 0.0 }]
};
export function fixGun(THREE, tpl, id) {
  const fx = GUN_FIX[id]; if (!fx) return tpl;
  const meshes = []; tpl.traverse(m => { if (m.isMesh) meshes.push(m); });
  for (const f of fx) for (const m of meshes) {
    if (m.material.name !== f.mat) continue;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry, P = g.attributes.position, keep = [], move = [], c = new THREE.Vector3(), v = new THREE.Vector3();
    m.updateMatrixWorld(true);
    for (let t = 0; t < P.count; t += 3) {
      c.set(0, 0, 0); for (let k = 0; k < 3; k++) c.add(v.fromBufferAttribute(P, t + k).applyMatrix4(m.matrixWorld)); c.multiplyScalar(1 / 3);
      (f.keep(c) ? keep : move).push(t);
    }
    if (!move.length) continue;
    const sub = list => { const ng = new THREE.BufferGeometry(); for (const name in g.attributes) { const A = g.attributes[name], n = A.itemSize, arr = new A.array.constructor(list.length * 3 * n); list.forEach((t, i) => { for (let k = 0; k < 3 * n; k++) arr[i * 3 * n + k] = A.array[t * n + k]; }); ng.setAttribute(name, new THREE.BufferAttribute(arr, n, A.normalized)); } return ng; };
    m.geometry = sub(keep);
    const mm = m.material.clone(); mm.name = f.to; const w = new THREE.Mesh(sub(move), mm); w.position.copy(m.position); w.quaternion.copy(m.quaternion); w.scale.copy(m.scale); m.parent.add(w);
  }
  return tpl;
}
export function skinGun(THREE, group, skinId, team, mk) {
  const sk = SKIN_BY_ID[skinId] || SKIN_BY_ID[defaultSkin(team)], c = h => new THREE.Color(h);
  const cache = new Map();
  group.traverse(m => {
    if (!m.isMesh) return;
    const src = m.material, cat = matCat(src.name);
    if (cache.has(src)) { m.material = cache.get(src); return; }
    let mat;
    if (cat === 'brass') mat = mk({ color: 0xc89a3a, metalness: 0.9, roughness: 0.3 });
    else if (cat === 'light') mat = mk({ color: src.color.getHex(), metalness: 0.3, roughness: 0.5 });
    else if (cat === 'band') mat = mk({ color: team === 'hij' ? 0x8f2a1e : 0x1f4fa8, metalness: 0.2, roughness: 0.5 });
    else if (src.map) mat = mk({ color: sk.base, map: src.map, metalness: sk.metal, roughness: sk.rough });     // teksturerede modeller: tint
    else {
      const base = cat === 'wood' ? sk.wood : cat === 'dark' ? sk.dark : sk.base;
      mat = mk({ color: base, metalness: cat === 'dark' ? Math.min(0.5, sk.metal + 0.1) : sk.metal, roughness: cat === 'dark' ? Math.min(0.9, sk.rough + 0.15) : sk.rough });
      if (cat === 'body' && sk.pat !== 'solid') patternize(THREE, mat, sk);
    }
    mat.side = THREE.DoubleSide;                                                     // flere modeller har inkonsekvent trekant-vinding i filen
    cache.set(src, mat); m.material = mat;
  });
  group.userData.skin = sk.name; group.userData.skinId = sk.id;
  return group;
}
function patternize(THREE, mat, sk) {
  const P = (sk.p || []).concat([sk.base, sk.base, sk.base]).slice(0, 3).map(h => new THREE.Color(h));
  const U = { uP0: { value: P[0] }, uP1: { value: P[1] }, uP2: { value: P[2] }, uPat: { value: PAT_ID[sk.pat] || 0 } };
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 vGP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vGP = position;');
    sh.fragmentShader = PAT_GLSL + '\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = gunPattern(diffuseColor.rgb);');
  };
  const key = (mat.customProgramCacheKey ? mat.customProgramCacheKey() : '') + '|pat' + sk.pat;
  mat.customProgramCacheKey = () => key;
}
// agent-materialer: farvevariant pr. materialenavn
export function recolorAgent(THREE, root, variant, mk) {
  const col = (variant && variant.col) || {}, cache = new Map();
  root.traverse(o => {
    if (!o.isMesh) return;
    const src = o.material; if (cache.has(src)) { o.material = cache.get(src); return; }
    const hex = col[src.name] !== undefined ? col[src.name] : src.color.getHex();
    const m = mk({ color: hex, map: src.map || null, normalMap: src.normalMap || undefined, roughness: Math.max(0.35, src.roughness), metalness: Math.min(0.6, src.metalness) });
    if (src.normalMap) m.normalScale.copy(src.normalScale);
    if (src.alphaTest > 0) { m.alphaTest = src.alphaTest; m.side = THREE.DoubleSide; }
    m.name = src.name; if (!(src.alphaTest > 0)) m.side = src.side; cache.set(src, m); o.material = m;
  });
  return [...cache.values()];
}
