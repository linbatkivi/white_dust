// ==========================================================================
// v14: proceduralt modellerede våben-skabeloner (samme pipeline som GLB-modellerne: prepGun → skins → ankre).
// AK-47 efter rigtige mål (≈ 0,88 m): presset stål-receiver med nitter, støvdæksel med ribber, ladegreb og sikringsarm,
// lamineret valnøddeskæfte, øvre/nedre håndbeskytter med fingerriller, gasrør og gasblok, forsigte med ører, bagsigte,
// skrå mundingsbremse, rensestang, buet stål-magasin med ribber og pistolgreb i bakelit.
// Materialenavnene følger poly.pizza-konventionen, så skins.js' kategorier virker (træ = 'Wood_*', sort stål = 'Black', osv.).
// Koordinater: løbet mod −z, op = +y, meter. Origo ved pistolgrebets top.
// ==========================================================================
export function buildAK47(THREE) {
  const g = new THREE.Group();
  const mat = (name, hex, rough, metal) => { const m = new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal }); m.name = name; return m; };
  const M = {
    steel: mat('M_PCL_Flat_Black', 0x1c1c1e, 0.5, 0.6),         // presset stål (receiver, dæksel, magasin)
    dark: mat('M_PCL_Flat_Grey_Darker', 0x2a2a2c, 0.45, 0.65),   // løb, gasrør, sigter
    wood: mat('Wood_AK', 0x7a3f1d, 0.55, 0.05),                  // skæfte og håndbeskyttere
    bake: mat('Wood_AK_Grip', 0x4a2a16, 0.5, 0.05),              // bakelit-greb (mørkere)
    light: mat('M_PCL_Flat_Grey_Light', 0x5a5a5e, 0.35, 0.8)     // nitter, ladegreb (slidt stål)
  };
  const add = (geo, m, x, y, z, rx, ry, rz) => { const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); if (rx || ry || rz) me.rotation.set(rx || 0, ry || 0, rz || 0); g.add(me); return me; };
  // sideprofil (z, y) ekstruderet på tværs (x) med afrundet fas
  const prof = (pts, w, bv) => {
    const s = new THREE.Shape(); pts.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]));
    const b = bv === undefined ? Math.min(0.004, w * 0.18) : bv;
    const geo = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.0008, w - b * 2), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b * 0.9, bevelSegments: 2, curveSegments: 8 });
    geo.rotateY(-Math.PI / 2); geo.translate(w / 2 - b, 0, 0); return geo;
  };
  const cylZ = (r0, r1, len, seg) => { const geo = new THREE.CylinderGeometry(r1, r0, len, seg || 14); geo.rotateX(-Math.PI / 2); return geo; };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  // ---- receiver (presset stål) med magasinbrønd og aftrækkerhus
  add(prof([[-0.172, 0.0], [0.07, 0.0], [0.07, 0.022], [0.082, 0.048], [-0.172, 0.052]], 0.034), M.steel);
  add(prof([[-0.12, 0.0], [-0.05, 0.0], [-0.052, -0.016], [-0.118, -0.016]], 0.036), M.steel);                     // magasinbrønd
  for (const [z, y] of [[-0.155, 0.012], [-0.155, 0.038], [0.055, 0.012], [0.055, 0.036], [-0.03, 0.01], [-0.005, 0.01]]) for (const sx of [-1, 1]) {
    const r = add(new THREE.CylinderGeometry(0.0028, 0.0028, 0.003, 8), M.light, sx * 0.0175, y, z); r.rotation.z = Math.PI / 2; }      // nitter
  // ---- støvdæksel (rundet top, ribber bagerst) + bagsigte
  const dc = add(new THREE.CylinderGeometry(0.0165, 0.0165, 0.215, 18, 1, false, -Math.PI / 2, Math.PI), M.steel, 0, 0.05, -0.04); dc.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 4; i++) add(box(0.03, 0.003, 0.005), M.dark, 0, 0.0675, 0.03 + i * 0.009);
  add(box(0.03, 0.02, 0.03), M.dark, 0, 0.062, -0.17);                                                              // bagsigtets blok
  add(prof([[-0.19, 0.072], [-0.15, 0.072], [-0.15, 0.08], [-0.19, 0.084]], 0.022, 0.001), M.dark);                 // sigteblad
  // ---- ladegreb (højre side) + sikringsarm (lang, højre side)
  add(box(0.02, 0.012, 0.012), M.light, 0.027, 0.04, -0.06).userData.part = 'charge';                            // (genladning: trækkes bagud)
  add(box(0.004, 0.009, 0.1), M.dark, 0.0185, 0.03, 0.005);
  add(box(0.004, 0.014, 0.018), M.dark, 0.0185, 0.022, -0.05);
  // ---- aftrækkerbøjle + aftrækker
  const tg = add(new THREE.TorusGeometry(0.023, 0.0032, 6, 16, Math.PI), M.steel, 0, -0.004, -0.025); tg.rotation.set(0, Math.PI / 2, Math.PI);
  add(box(0.005, 0.02, 0.006), M.dark, 0, -0.012, -0.02);
  // ---- pistolgreb (bakelit, skrå, riflet)
  add(prof([[-0.012, 0.002], [0.026, 0.002], [0.06, -0.098], [0.032, -0.108], [0.0, -0.022]], 0.031, 0.004), M.bake);
  for (let i = 0; i < 6; i++) add(box(0.033, 0.002, 0.004), M.steel, 0, -0.03 - i * 0.012, 0.006 + i * 0.0055);
  // ---- skæfte (lamineret valnød) med 'drop', tommelfingerindsnit og stålkolbeplade
  add(prof([[0.068, 0.05], [0.13, 0.044], [0.3, 0.03], [0.304, -0.072], [0.285, -0.075], [0.15, -0.02], [0.095, 0.006], [0.068, 0.012]], 0.036), M.wood);
  add(prof([[0.302, 0.032], [0.312, 0.032], [0.314, -0.074], [0.304, -0.076]], 0.038, 0.002), M.steel);
  add(box(0.006, 0.012, 0.03), M.dark, 0, -0.04, 0.24);                                                             // remøje
  // ---- nedre håndbeskytter (træ, fingerriller) + øvre håndbeskytter over gasrøret
  add(prof([[-0.172, 0.004], [-0.358, 0.008], [-0.36, 0.04], [-0.172, 0.044]], 0.04, 0.006), M.wood);
  for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) add(box(0.002, 0.005, 0.11), M.bake, sx * 0.0205, 0.016 + i * 0.008, -0.265);
  add(prof([[-0.2, 0.06], [-0.34, 0.062], [-0.342, 0.083], [-0.2, 0.084]], 0.03, 0.006), M.wood);
  add(box(0.042, 0.008, 0.012), M.steel, 0, 0.02, -0.364); add(box(0.036, 0.006, 0.01), M.steel, 0, 0.072, -0.346);   // holdebånd
  // ---- gasrør, gasblok, løb, rensestang, forsigte, mundingsbremse
  add(cylZ(0.0105, 0.0105, 0.2, 12), M.dark, 0, 0.072, -0.27);
  add(prof([[-0.37, 0.02], [-0.4, 0.02], [-0.402, 0.084], [-0.372, 0.084]], 0.026, 0.003), M.dark);
  add(cylZ(0.0085, 0.0085, 0.4, 12), M.dark, 0, 0.032, -0.37);
  add(cylZ(0.0028, 0.0028, 0.36, 6), M.dark, 0, 0.012, -0.36);
  add(prof([[-0.5, 0.025], [-0.53, 0.025], [-0.528, 0.09], [-0.512, 0.09]], 0.012, 0.0015), M.dark);              // forsigtets fod
  for (const sx of [-1, 1]) add(box(0.003, 0.03, 0.012), M.dark, sx * 0.009, 0.077, -0.52);                       // beskyttelsesører
  add(box(0.0025, 0.016, 0.003), M.light, 0, 0.088, -0.52);                                                         // sigtekorn
  const mb = add(cylZ(0.0115, 0.0115, 0.04, 12), M.dark, 0, 0.032, -0.575); mb.rotation.z = 0.0;
  add(box(0.012, 0.012, 0.04), M.dark, 0.004, 0.044, -0.575).rotation.z = 0.5;                                      // skråt mundingsbremse-snit
  // ---- buet stål-magasin med ribber
  const magS = new THREE.Shape(), n = 14, top = 0.235, curve = 0.1, d0 = 0.065, d1 = 0.048, front = [], back = [];
  for (let i = 0; i <= n; i++) { const t = i / n, y = -t * top, zc = -0.085 - curve * t * t, d = d0 + (d1 - d0) * t; front.push([zc - d / 2, y]); back.push([zc + d / 2, y]); }
  front.concat(back.reverse()).forEach((p, i) => i ? magS.lineTo(p[0], p[1]) : magS.moveTo(p[0], p[1]));
  const mg = new THREE.ExtrudeGeometry(magS, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 6 });
  mg.rotateY(-Math.PI / 2); mg.translate(0.013, -0.016, 0); add(mg, M.steel).userData.part = 'mag';                 // part = 'mag': egen del til genladningen
  for (let i = 1; i < 5; i++) { const t = i / 5.2, zc = -0.085 - curve * t * t, y = -t * top - 0.016; for (const sx of [-1, 1]) { const r = add(box(0.002, 0.07, 0.004), M.dark, sx * 0.0135, y, zc); r.rotation.x = -t * 0.8; r.userData.part = 'mag'; } }
  add(box(0.03, 0.01, 0.06), M.dark, 0, -0.016 - top - 0.004, -0.085 - curve + 0.0).userData.part = 'mag';         // magasinbund
  return g;
}
