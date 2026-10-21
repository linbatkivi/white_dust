// ==========================================================================
// TEMA: valkyrie (v26.8) – middelhavs-/ørkenby i skarpt middagslys. Banen er FORFATTET (tools/valkyrie/build.py: Blender + bagt globalt lys
// – stuk, sandsten og terrakotta, snævre gyder og solbeskinnede gårde). Temaet leverer lys/himmel/efterbehandling og døre: solen er
// en rigtig skyggekaster i realtid (retning og styrke fra sky.json), resten er bagt.
// ==========================================================================
export function valkyrieTheme(L) {
  const { THREE, mat, commonMats, doorLeaf, C } = L;
  const M = commonMats();
  const HV = C.assets && C.assets.havn;
  const light = {
    sky: { hor: [0.95, 0.93, 0.86], mid: [0.62, 0.76, 0.93], top: [0.28, 0.5, 0.84], gnd: [0.5, 0.42, 0.32], sun: [1.0, 0.95, 0.85], cloud: 0.5 },
    sunColor: 0xfff1dc, sunInt: 1.5, sunPos: [-30, 80, 40], hemiSky: 0xcfe0f4, hemiGround: 0x8a6e52, hemiInt: 0.7, ambInt: 0.12,
    bg: 0xcfdcea, fog: { color: 0xa9b79a, near: 24, far: 170 }, exposure: 1.3, minSky: 0.12
  };
  const SKY = C.assets && C.assets.sky;
  if (SKY) { light.skyTex = SKY.tex; light.skyExp = 1.0; light.ibl = 1.0; }
  if (HV && HV.sky) {
    const s = HV.sky, e = Math.max(...s.sunIrr);
    light.sunPos = s.sunDir.map(v => v * 100);
    light.sunColor = new THREE.Color(s.sunIrr[0] / e, s.sunIrr[1] / e, s.sunIrr[2] / e).getHex();
    light.sunInt = e / Math.PI;                                  // motoren ganger med π – samme styrke (W/m²) som Cycles-solen
  }
  light.indirect = [1.0, 0.97, 0.92];                           // det bagte lys er varmt tilbagekastet fra sandsten
  // filmisk: varme højlys, kølige skygger fra himlen, en anelse tørt støvslør i det fjerne
  const post = { sat: 1.16, contrast: 1.08, highTint: [1.05, 1.0, 0.92], shadowTint: [0.93, 0.97, 1.06], lift: [0.004, 0.005, 0.008], vignette: 0.2, sharpen: 0.22,
    shafts: 0.55, shaftCol: [1.0, 0.92, 0.7], mie: 0.3, mieCol: [0.8, 0.9, 0.72], mieDist: 90 };
  const ambient = { color: 0xfff0d8, count: 0, size: 0.02, alpha: 0.0, wind: [0.2, 0.0, 0.1] };
  const surfKinds = { floor: 1, wall: 1, ceil: 1, slab: 1, stone: 1, clip: 0 };
  const surf = (kind, face) => face === 'top' ? { m: M.conc, t: [0.8, 0.72, 0.58], uvs: 2 } : { m: M.conc, t: [0.88, 0.78, 0.62], uvs: 2 };
  const doorStyle = d => ({ matOpts: { color: 0xffffff, map: (M.wood || M.metal).map }, build: (w, h, m) => doorLeaf(w, h, m, 'wood') });
  const none = () => {};
  return { id: 'valkyrie', siteMark: 'assist', authored: !!HV, light, weather: {}, post, ambient, bevel: 0, bevelKinds: {}, lamps: (HV && HV.probeLamps) || [], mats: M,
    surfKinds, surf, trim: null, splitY: [], dressProp: none, dressCyl: none, dressLadder: none, dressRail: none, dressLamp: none, doorStyle, decor: none, detailDist: 60 };
}
