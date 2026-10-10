// ==========================================================================
// TEMA: de_havn (v15) – nordisk havnebydel en klar sommereftermiddag. Banen er FORFATTET (bygget i Blender af
// tools/havn/blender_build.py med bagt globalt lys); temaet leverer kun lys/himmel/efterbehandling og døre.
// Uden de forfattede filer (fx i node-tests) tegnes banen proceduralt af motoren med enkle reserve-materialer.
// ==========================================================================
export function havnTheme(L) {
  const { THREE, W, mat, T, commonMats, doorLeaf, C } = L;
  const M = commonMats();
  const HV = C.assets && C.assets.havn;                         // { group, sky: { sunDir, sunIrr, skyIrr } }
  const light = {
    sky: { hor: [0.92, 0.95, 1.0], mid: [0.62, 0.76, 0.92], top: [0.32, 0.52, 0.82], gnd: [0.34, 0.36, 0.36], sun: [1.0, 0.97, 0.9], cloud: 0.8 },
    sunColor: 0xfff4e6, sunInt: 1.4, sunPos: [-47, 74, 47], hemiSky: 0xcfdcf0, hemiGround: 0x6a6a64, hemiInt: 0.55, ambInt: 0.08,
    bg: 0xc8d6e6, fog: { color: 0xc4d2e2, near: 70, far: 260 }, exposure: 1.0, minSky: 0.08
  };
  const SKY = C.assets && C.assets.sky;
  if (SKY) { light.skyTex = SKY.tex; light.skyExp = 1.0; light.ibl = 1.0; }
  if (HV && HV.sky) {
    const s = HV.sky, e = Math.max(...s.sunIrr);
    light.sunPos = s.sunDir.map(v => v * 100);
    light.sunColor = new THREE.Color(s.sunIrr[0] / e, s.sunIrr[1] / e, s.sunIrr[2] / e).getHex();
    light.sunInt = e / Math.PI;                                  // motoren ganger med π – samme styrke (W/m²) som Cycles-solen
  }
  // filmisk look: klar nordisk eftermiddag – kølige skygger, varme højlys, ren luft
  const post = { sat: 1.04, contrast: 1.05, highTint: [1.03, 1.0, 0.96], shadowTint: [0.96, 0.99, 1.04], lift: [0.004, 0.005, 0.008], vignette: 0.18, sharpen: 0.2, shafts: 0.2, shaftCol: [1.0, 0.95, 0.85], mie: 0.25, mieCol: [0.95, 0.97, 1.0], mieDist: 120 };
  const ambient = { color: 0xffffff, count: 0, size: 0.02, alpha: 0.0, wind: [0.1, 0.0, 0.05] };
  // reserve-belægninger (kun når den forfattede bane mangler)
  const surfKinds = { floor: 1, wall: 1, ceil: 1, slab: 1, stone: 1, clip: 0 };
  const surf = (kind, face) => face === 'top' ? { m: M.conc, t: [0.72, 0.72, 0.7], uvs: 2 } : { m: M.conc, t: [0.86, 0.8, 0.72], uvs: 2 };
  const doorStyle = d => ({ matOpts: { color: 0xffffff, map: (M.wood || M.metal).map }, build: (w, h, m) => doorLeaf(w, h, m, 'wood') });
  const none = () => {};
  return { id: 'havn', siteMark: 'assist', authored: !!HV, light, weather: {}, post, ambient, bevel: 0, bevelKinds: {}, lamps: [], mats: M, surfKinds, surf, trim: null, splitY: [],
    dressProp: none, dressCyl: none, dressLadder: none, dressRail: none, dressLamp: none, doorStyle, decor: none, detailDist: 60 };
}
