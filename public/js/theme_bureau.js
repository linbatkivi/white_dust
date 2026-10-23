// ==========================================================================
// TEMA: bureau (v26) – luksus-bureauet øverst i et højhus en regnfuld nat. Banen er FORFATTET (tools/bureau/build.py: Blender +
// bagt lys – varme spots, lamelloft, exit-skilte og nødlys er bagt ind). Udenfor: egen skyline med oplyste vinduer 110 m nede i byen.
// Temaet giver en meget svag, kold måne (realtid), nattehimlen, mørk dis over byen og en filmisk efterbehandling; regnen på
// tagterrassen og lygternes glorier kommer fra night.js.
// ==========================================================================
export function bureauTheme(L) {
  const { THREE, mat, commonMats, doorLeaf, C } = L;
  const M = commonMats();
  const HV = C.assets && C.assets.havn;
  const light = {
    sky: { hor: [0.03, 0.025, 0.02], mid: [0.01, 0.012, 0.018], top: [0.004, 0.005, 0.009], gnd: [0.01, 0.01, 0.012], sun: [0, 0, 0], cloud: 0.6 },
    sunColor: 0x9fbcff, sunInt: 0.3,           // v26.15: kold måne bag regnskyerne – skygger på tagterrassen og måneskin ind ad vinduerne (indirekte del er bagt)
    sunPos: [35, 55, -76], hemiSky: 0x141d33, hemiGround: 0x0c0a09, hemiInt: 0.06, ambInt: 0.012,
    bg: 0x050608, fog: { color: 0x07080b, near: 40, far: 520 }, exposure: 1.0, minSky: 0.01
  };
  const SKY = C.assets && C.assets.sky;
  if (SKY) { light.skyTex = SKY.tex; light.skyExp = 1.0; light.ibl = 0.22; }
  if (HV && HV.sky) {
    const s = HV.sky, e = Math.max(...s.sunIrr); light.sunPos = s.sunDir.map(v => v * 100);
    if (e > 0) { light.sunColor = new THREE.Color(0.62 + 0.38 * s.sunIrr[0] / e, 0.74 + 0.26 * s.sunIrr[1] / e, 1.0).getHex(); light.sunInt = (e / Math.PI) * 0.9; }      // samme styrke som månen i bagningen (BU_MOON)
  }
  light.indirect = [1.0, 0.98, 0.96];                         // det bagte lys er varmt (spots) – ingen ekstra toning
  light.exposure = 1.25;
  // filmisk: dybe sorte, varme højlys, kolde skygger, tung vignet – som at rykke ind om natten
  const post = { sat: 1.04, contrast: 1.1, highTint: [1.08, 0.98, 0.88], shadowTint: [0.86, 0.94, 1.12], lift: [0.003, 0.004, 0.009], vignette: 0.32, sharpen: 0.22, bloom: 2.2,
    shafts: 0.0, shaftCol: [0.8, 0.85, 1.0], mie: 0.1, mieCol: [0.4, 0.46, 0.6], mieDist: 120, night: true };
  const ambient = { color: 0xffe0b8, count: 70, size: 0.028, alpha: 0.5, wind: [0.1, 0.02, 0.05] };       // v26.15: støv i lyset
  const surfKinds = { floor: 1, wall: 1, ceil: 1, slab: 1, stone: 1, clip: 0 };
  const surf = (kind, face) => face === 'top' ? { m: M.conc, t: [0.42, 0.42, 0.44], uvs: 2 } : { m: M.conc, t: [0.5, 0.48, 0.46], uvs: 2 };
  const doorStyle = d => ({ matOpts: { color: 0xffffff, map: (M.metal || M.wood).map }, build: (w, h, m) => doorLeaf(w, h, m, 'metal') });
  const none = () => {};
  return { id: 'bureau', siteMark: 'assist', authored: !!HV, night: true, lightsUrl: '/assets/bureau/lights.json', rain: { rate: 1.2, wind: [1.2, 0.0, 0.5], lightning: true }, light, weather: {}, post, ambient,
    bevel: 0, bevelKinds: {}, lamps: (HV && HV.probeLamps) || [], mats: M,   // v26: banens lamper → lys-proberne (våben i hånden, spillere, C4)
    surfKinds, surf, trim: null, splitY: [],
    dressProp: none, dressCyl: none, dressLadder: none, dressRail: none, dressLamp: none, doorStyle, decor: none, detailDist: 60 };
}
