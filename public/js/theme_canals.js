// ==========================================================================
// TEMA: de_canals (v16) – CS:GO-banen i Venedig bygget direkte af brugerens Blender-import (tools/canals/). Banen er FORFATTET:
// grafikken er printet selv (world.bin, lys pr. hjørne = himmel-synlighed), temaet leverer kun sol/himmel/efterbehandling.
// Uden de forfattede filer (fx i node-tests) tegner motoren kollisionskasserne med enkle reserve-materialer.
// ==========================================================================
export function canalsTheme(L) {
  const { THREE, mat, commonMats, doorLeaf, C } = L;
  const M = commonMats();
  const HV = C.assets && C.assets.havn;                         // { group, sky: { sunDir, sunIrr, skyIrr } } (samme loader som de_havn)
  const light = {
    sky: { hor: [0.98, 0.94, 0.86], mid: [0.66, 0.78, 0.92], top: [0.36, 0.56, 0.84], gnd: [0.42, 0.38, 0.33], sun: [1.0, 0.95, 0.84], cloud: 0.6 },
    sunColor: 0xffefd8, sunInt: 1.5, sunPos: [-47, 74, 47], hemiSky: 0xd8e2f0, hemiGround: 0x8a7a66, hemiInt: 0.55, ambInt: 0.08,
    bg: 0xd6dde6, fog: { color: 0xdcd8cf, near: 80, far: 280 }, exposure: 1.0, minSky: 0.08
  };
  const SKY = C.assets && C.assets.sky;
  if (SKY) { light.skyTex = SKY.tex; light.skyExp = 1.0; light.ibl = 1.0; }
  if (HV && HV.sky) {
    const s = HV.sky, e = Math.max(...s.sunIrr);
    light.sunPos = s.sunDir.map(v => v * 100);
    light.sunColor = new THREE.Color(s.sunIrr[0] / e, s.sunIrr[1] / e * 0.97, s.sunIrr[2] / e * 0.9).getHex();   // lidt varmere end havn – venetiansk eftermiddag
    light.sunInt = e / Math.PI;
  }
  // v20: solrig sommerdag (brugerønske – materialernes farver er uændrede): klar blå himmel (sky.hdr/sky.json fra tools/sky_src/summer_sky.py),
  //   kraftigere varm sol, varmt tilbagekast i skyggerne i stedet for koldt blåt, lidt mere eksponering/mætning og næsten ingen dis
  light.indirect = [1.04, 1.0, 0.9]; light.exposure = 1.0; if (light.skyTex) light.skyExp = 0.95;
  const post = { sat: 1.22, contrast: 1.12, highTint: [1.08, 1.01, 0.9], shadowTint: [0.95, 0.98, 1.05], lift: [0.006, 0.005, 0.006], vignette: 0.18, sharpen: 0.2, shafts: 0.18, shaftCol: [1.0, 0.93, 0.8], mie: 0.2, mieCol: [1.0, 0.96, 0.9], mieDist: 130 };
  const ambient = { color: 0xffffff, count: 0, size: 0.02, alpha: 0.0, wind: [0.1, 0.0, 0.05] };
  const surfKinds = { floor: 1, wall: 1, ceil: 1, slab: 1, stone: 1, clip: 0 };
  const surf = (kind, face) => face === 'top' ? { m: M.conc, t: [0.8, 0.74, 0.66], uvs: 2 } : { m: M.conc, t: [0.95, 0.84, 0.68], uvs: 2 };
  const doorStyle = d => ({ matOpts: { color: 0xffffff, map: (M.wood || M.metal).map }, build: (w, h, m) => doorLeaf(w, h, m, 'wood') });
  const none = () => {};
  return { id: 'canals', siteMark: 'assist', authored: !!HV, light, weather: {}, post, ambient, bevel: 0, bevelKinds: {}, lamps: [], mats: M, surfKinds, surf, trim: null, splitY: [],
    dressProp: none, dressCyl: none, dressLadder: none, dressRail: none, dressLamp: none, doorStyle, decor: none, detailDist: 60 };
}
