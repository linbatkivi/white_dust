// ==========================================================================
// TEMA: niseko (v26.13) – gammel japansk landsby en stille nat. Banen er FORFATTET (tools/niseko/build.py: Blender + bagt lys – papirlanterner,
// lyste skærmvinduer og måneskin). Temaet giver månen som rigtig skyggekaster (retning fra sky.json), nattehimlen, en let kold dis over
// kanalerne, kirsebærblade i luften og en filmisk efterbehandling. Lanternernes glorier kommer fra night.js (lights.json).
// ==========================================================================
export function nisekoTheme(L) {
  const { THREE, mat, commonMats, doorLeaf, C } = L;
  const M = commonMats();
  const HV = C.assets && C.assets.havn;
  const light = {
    sky: { hor: [0.05, 0.06, 0.09], mid: [0.02, 0.03, 0.06], top: [0.008, 0.012, 0.03], gnd: [0.02, 0.02, 0.025], sun: [0, 0, 0], cloud: 0.4 },
    sunColor: 0x9fb4e8, sunInt: 0.22, sunPos: [-60, 70, 50], hemiSky: 0x1a2640, hemiGround: 0x120e0a, hemiInt: 0.16, ambInt: 0.03,
    bg: 0x070a12, fog: { color: 0x0a1020, near: 18, far: 210 }, exposure: 1.25, minSky: 0.02
  };
  const SKY = C.assets && C.assets.sky;
  if (SKY) { light.skyTex = SKY.tex; light.skyExp = 0.5; light.ibl = 0.35; }
  if (HV && HV.sky) {
    const s = HV.sky, e = Math.max(...s.sunIrr);
    light.sunPos = s.sunDir.map(v => v * 100);
    light.sunColor = new THREE.Color(0.72 + 0.28 * s.sunIrr[0] / e, 0.78 + 0.22 * s.sunIrr[1] / e, 1.0).getHex();
    light.sunInt = (e / Math.PI) * 0.12 * 2.0;                  // måneskin: samme forhold som i bagningen (NK_MOON), lidt løftet i realtid
  }
  light.indirect = [1.0, 0.97, 0.94];                            // det bagte lys er varmt (lanterner) – kun en antydning af toning
  // filmisk: dybe sorte, varme højlys fra lanternerne, kolde skygger fra månen
  const post = { sat: 1.02, contrast: 1.12, highTint: [1.08, 0.98, 0.88], shadowTint: [0.88, 0.95, 1.12], lift: [0.002, 0.003, 0.008], vignette: 0.34, sharpen: 0.2,
    shafts: 0.0, shaftCol: [0.8, 0.85, 1.0], mie: 0.1, mieCol: [0.4, 0.5, 0.7], mieDist: 120, night: true };
  const ambient = { color: 0xffc9d9, count: 140, size: 0.045, alpha: 0.75, wind: [0.55, -0.12, 0.25] };          // kirsebærblomster i luften
  const surfKinds = { floor: 1, wall: 1, ceil: 1, slab: 1, stone: 1, clip: 0 };
  const surf = (kind, face) => face === 'top' ? { m: M.conc, t: [0.42, 0.42, 0.44], uvs: 2 } : { m: M.conc, t: [0.5, 0.48, 0.46], uvs: 2 };
  const doorStyle = d => ({ matOpts: { color: 0xffffff, map: (M.wood || M.metal).map }, build: (w, h, m) => doorLeaf(w, h, m, 'wood') });
  const none = () => {};
  return { id: 'niseko', siteMark: 'assist', authored: !!HV, night: true, lightsUrl: '/assets/niseko/lights.json', rain: { dry: true, lightning: false }, koi: '/assets/niseko/water.json', water: { level: -0.08, far: 70, scale: 0.5, gain: 1.0 }, light, weather: {}, post, ambient,
    bevel: 0, bevelKinds: {}, lamps: (HV && HV.probeLamps) || [], mats: M,
    surfKinds, surf, trim: null, splitY: [],
    dressProp: none, dressCyl: none, dressLadder: none, dressRail: none, dressLamp: none, doorStyle, decor: none, detailDist: 60 };
}
