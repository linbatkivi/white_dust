// ==========================================================================
// TEMA: de_bureau (v26) – luksus-bureauet øverst i et højhus en regnfuld nat. Banen er FORFATTET (tools/bureau/build.py: Blender +
// bagt lys – varme spots, lamelloft, exit-skilte og nødlys er bagt ind). Udenfor: egen skyline med oplyste vinduer 110 m nede i byen.
// Temaet giver en meget svag, kold måne (realtid), nattehimlen, mørk dis over byen og en filmisk efterbehandling; regnen på
// tagterrassen og lygternes glorier kommer fra night.js.
// ==========================================================================
export function bureauTheme(L) {
  const { mat, commonMats, doorLeaf, C } = L;
  const M = commonMats();
  const HV = C.assets && C.assets.havn;
  const light = {
    sky: { hor: [0.03, 0.025, 0.02], mid: [0.01, 0.012, 0.018], top: [0.004, 0.005, 0.009], gnd: [0.01, 0.01, 0.012], sun: [0, 0, 0], cloud: 0.6 },
    sunColor: 0x8da6d8, sunInt: 0.0,           // ingen måne: indendørs om natten kommer alt lys fra de bagte lamper
    sunPos: [35, 55, -76], hemiSky: 0x0d1220, hemiGround: 0x080808, hemiInt: 0.03, ambInt: 0.006,
    bg: 0x050608, fog: { color: 0x07080b, near: 40, far: 520 }, exposure: 1.0, minSky: 0.01
  };
  const SKY = C.assets && C.assets.sky;
  if (SKY) { light.skyTex = SKY.tex; light.skyExp = 1.0; light.ibl = 0.08; }
  if (HV && HV.sky) light.sunPos = HV.sky.sunDir.map(v => v * 100);
  light.indirect = [1.0, 0.98, 0.96];                         // det bagte lys er varmt (spots) – ingen ekstra toning
  light.exposure = 1.15;
  // filmisk: dybe sorte, varme højlys, kolde skygger, tung vignet – som at rykke ind om natten
  const post = { sat: 0.92, contrast: 1.14, highTint: [1.05, 0.99, 0.92], shadowTint: [0.9, 0.96, 1.1], lift: [0.002, 0.003, 0.006], vignette: 0.38, sharpen: 0.22,
    shafts: 0.0, shaftCol: [0.8, 0.85, 1.0], mie: 0.04, mieCol: [0.35, 0.4, 0.5], mieDist: 140, night: true };
  const ambient = { color: 0xffffff, count: 0, size: 0.02, alpha: 0.0, wind: [0.4, 0.0, 0.15] };
  const surfKinds = { floor: 1, wall: 1, ceil: 1, slab: 1, stone: 1, clip: 0 };
  const surf = (kind, face) => face === 'top' ? { m: M.conc, t: [0.42, 0.42, 0.44], uvs: 2 } : { m: M.conc, t: [0.5, 0.48, 0.46], uvs: 2 };
  const doorStyle = d => ({ matOpts: { color: 0xffffff, map: (M.metal || M.wood).map }, build: (w, h, m) => doorLeaf(w, h, m, 'metal') });
  const none = () => {};
  return { id: 'bureau', siteMark: 'assist', authored: !!HV, night: true, lightsUrl: '/assets/bureau/lights.json', rain: { rate: 1.2, wind: [1.2, 0.0, 0.5], lightning: true }, light, weather: {}, post, ambient,
    bevel: 0, bevelKinds: {}, lamps: [], mats: M, surfKinds, surf, trim: null, splitY: [],
    dressProp: none, dressCyl: none, dressLadder: none, dressRail: none, dressLamp: none, doorStyle, decor: none, detailDist: 60 };
}
