// ==========================================================================
// TEMA: fattoria (v26.14) – toscansk vingård på en bakketop i Chianti, sen eftermiddag (den gyldne time). Banen er FORFATTET (tools/fattoria/build.py: Blender + bagt lys –
// sandsten, terrakotta, cypresser, vinmarker og en kælder med lysskakter). Temaet giver solen som rigtig skyggekaster (retning/styrke fra sky.json), himlen (HDRI),
// et varmt støvslør i det fjerne, solstråler og en filmisk efterbehandling med varme højlys og kølige skygger.
// ==========================================================================
export function fattoriaTheme(L) {
  const { THREE, mat, commonMats, doorLeaf, C } = L;
  const M = commonMats();
  const HV = C.assets && C.assets.havn;
  const light = {
    sky: { hor: [1.0, 0.8, 0.55], mid: [0.62, 0.72, 0.9], top: [0.24, 0.42, 0.8], gnd: [0.5, 0.42, 0.3], sun: [1.0, 0.9, 0.7], cloud: 0.35 },
    sunColor: 0xffc890, sunInt: 3.0, sunPos: [-70, 14, 50], hemiSky: 0xbcd0ee, hemiGround: 0x8a6a48, hemiInt: 0.55, ambInt: 0.1,
    bg: 0xc9d6ea, fog: { color: 0xd9c3a2, near: 40, far: 230 }, exposure: 1.0, minSky: 0.1
  };
  const SKY = C.assets && C.assets.sky;
  if (SKY) { light.skyTex = SKY.tex; light.skyExp = 1.0; light.ibl = 1.0; }
  if (HV && HV.sky) {
    const s = HV.sky, e = Math.max(...s.sunIrr);
    light.sunPos = s.sunDir.map(v => v * 100);
    light.sunColor = new THREE.Color(s.sunIrr[0] / e, s.sunIrr[1] / e, s.sunIrr[2] / e).getHex();
    light.sunInt = (e * 1.15) / Math.PI;                                  // samme styrke (W/m²) som Cycles-solen i bagningen (FT_SKY = 1,6)
  }
  light.indirect = [1.0, 0.95, 0.88];                                    // det bagte lys er varmt tilbagekastet fra sandsten og terrakotta
  // filmisk: varme højlys, kølige skygger fra himlen, støvslør + solstråler (lange skygger og lavt sollys)
  const post = { sat: 1.04, contrast: 1.08, highTint: [1.06, 1.0, 0.9], shadowTint: [0.92, 0.97, 1.08], lift: [0.006, 0.007, 0.012], vignette: 0.22, sharpen: 0.22,
    shafts: 0.4, shaftCol: [1.0, 0.86, 0.6], mie: 0.24, mieCol: [0.95, 0.8, 0.6], mieDist: 110 };
  const ambient = { color: 0xffe0b0, count: 90, size: 0.03, alpha: 0.55, wind: [0.3, 0.0, 0.12] };          // støv og pollen i det skrå sollys
  const surfKinds = { floor: 1, wall: 1, ceil: 1, slab: 1, stone: 1, clip: 0 };
  const surf = (kind, face) => face === 'top' ? { m: M.conc, t: [0.85, 0.78, 0.65], uvs: 2 } : { m: M.conc, t: [0.9, 0.8, 0.64], uvs: 2 };
  const doorStyle = d => ({ matOpts: { color: 0xffffff, map: (M.wood || M.metal).map }, build: (w, h, m) => doorLeaf(w, h, m, 'wood') });
  const none = () => {};
  return { id: 'fattoria', siteMark: 'assist', authored: !!HV, lightsUrl: '/assets/fattoria/lights.json', light, weather: {}, post, ambient, bevel: 0, bevelKinds: {}, lamps: (HV && HV.probeLamps) || [], mats: M,
    surfKinds, surf, trim: null, splitY: [], dressProp: none, dressCyl: none, dressLadder: none, dressRail: none, dressLamp: none, doorStyle, decor: none, detailDist: 70 };
}
