// ==========================================================================
// TEMA: de_ascension (v25) – klosteret på bjergtoppen en regnfuld nat. Banen er FORFATTET (tools/asc/build.py: Blender + bagt lys,
// hvor lamperne, de oplyste vinduer og kirkens glasmosaik er bagt ind). Temaet leverer månen (realtid, svag og kold), nattehimlen,
// regndis og en filmisk efterbehandling; regn, lyn, lampeglans i vådt og lampernes lyskegler kommer fra night.js.
// ==========================================================================
export function ascTheme(L) {
  const { THREE, mat, commonMats, doorLeaf, C } = L;
  const M = commonMats();
  const HV = C.assets && C.assets.havn;
  const light = {
    sky: { hor: [0.07, 0.08, 0.1], mid: [0.05, 0.06, 0.08], top: [0.03, 0.035, 0.05], gnd: [0.02, 0.02, 0.025], sun: [0.6, 0.7, 0.9], cloud: 1.0 },
    sunColor: 0xa8c0e8, sunInt: 0.12, sunPos: [-47, 74, 47], hemiSky: 0x1a2232, hemiGround: 0x0c0c0e, hemiInt: 0.05, ambInt: 0.01,
    bg: 0x0b0d12, fog: { color: 0x0e1218, near: 18, far: 150 }, exposure: 1.0, minSky: 0.02
  };
  const SKY = C.assets && C.assets.sky;
  if (SKY) { light.skyTex = SKY.tex; light.skyExp = 0.3; light.ibl = 0.14; }
  if (HV && HV.sky) {
    const s = HV.sky;
    light.sunPos = s.sunDir.map(v => v * 100);
    light.sunColor = 0x9fb6e0; light.sunInt = 0.035;           // månen bag skyerne: svagt, koldt lys med bløde skygger
  }
  light.indirect = [0.96, 1.0, 1.08];                           // lysmappets tilbagekast lidt koldt (nat)
  light.exposure = 1.25;
  // filmisk nat: kolde skygger, varme lamper, let afmættet, tung vignet, våd dis omkring lamperne
  const post = { sat: 0.86, contrast: 1.16, highTint: [1.06, 0.98, 0.88], shadowTint: [0.88, 0.96, 1.12], lift: [0.004, 0.006, 0.012], vignette: 0.42, sharpen: 0.24,
    shafts: 0.0, shaftCol: [0.8, 0.85, 1.0], mie: 0.12, mieCol: [0.4, 0.46, 0.58], mieDist: 90, night: true };
  const ambient = { color: 0xffffff, count: 0, size: 0.02, alpha: 0.0, wind: [0.4, 0.0, 0.15] };
  const surfKinds = { floor: 1, wall: 1, ceil: 1, slab: 1, stone: 1, clip: 0 };
  const surf = (kind, face) => face === 'top' ? { m: M.conc, t: [0.42, 0.42, 0.44], uvs: 2 } : { m: M.conc, t: [0.5, 0.48, 0.46], uvs: 2 };
  const doorStyle = d => ({ matOpts: { color: 0xffffff, map: (M.wood || M.metal).map }, build: (w, h, m) => doorLeaf(w, h, m, 'wood') });
  const none = () => {};
  return { id: 'ascension', siteMark: 'assist', authored: !!HV, night: true, lightsUrl: '/assets/asc/lights.json', rain: { rate: 1.5, wind: [1.6, 0.0, 0.7], lightning: true }, light, weather: {}, post, ambient,
    bevel: 0, bevelKinds: {}, lamps: [], mats: M, surfKinds, surf, trim: null, splitY: [],
    dressProp: none, dressCyl: none, dressLadder: none, dressRail: none, dressLamp: none, doorStyle, decor: none, detailDist: 60 };
}
