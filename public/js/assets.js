// ==========================================================================
// ASSETS (v11): fotoscannede CC0 PBR-teksturer + HDRI-himmel (Poly Haven, lokalt i public/assets/<bane>/)
//   • teksturer: farve (sRGB) + normal-map (OpenGL) + ARM (R = ambient occlusion, G = roughness, B = metalness – lineært)
//   • HDRI: egen Radiance-parser (RGBE, RLE) → Half-float equirect-tekstur til himmelkuppel og miljølys (IBL via PMREM)
//   • solens retning udledes af HDRI'ens lyseste område – så skygger, sol-stråler og himlen altid stemmer overens
// loadThemeAssets(THREE, id, maxAniso) -> Promise<{ tex: { navn: {map, normal, arm} }, sky: { tex, sunDir:[x,y,z] } } | null>
//   Manglende filer => null og temaet falder tilbage til de procedurale materialer (spillet kører altid).
// ==========================================================================
import { loadGLTF } from './models.js';
export const ASSET_SETS = {
  nuke: {
    dir: '/assets/nuke/',
    tex: ['concrete_wall_008', 'concrete_slab_wall', 'concrete_floor_worn_001', 'asphalt_02', 'corrugated_iron_02',
      'metal_plate', 'metal_grate_rusty', 'container_side', 'blue_metal_plate', 'rusty_metal_02', 'painted_metal_shutter'],
    sky: 'sky_2k.hdr',
    neutral: { container_side: 1, blue_metal_plate: 1 },
    models: ['barrel_03', 'propane_tank', 'utility_box_01', 'hanging_industrial_lamp',
      // v14 (Poly Haven, CC0): facader (projektører, rulleporte, el-skabe, ventilationsaggregater), kontorer og lagre.
      //   Kun modeller banen faktisk placerer står her – hver model hentes ved banestart (ubrugte modeller i public/assets/models: se CREDITS.md)
      'security_light', 'rollershutter_door', 'utility_box_02', 'exterior_aircon_unit', 'fire_alarm', 'korean_fire_extinguisher_01', 'metal_office_desk', 'modern_arm_chair_01',
      'SchoolChair_01', 'Television_01', 'steel_frame_shelves_01', 'worn_metal_rack', 'plastic_crate_02']
  },
  white_dust: {
    dir: '/assets/dust/',
    tex: ['plastered_stone_wall', 'clay_plaster', 'sandstone_blocks_08', 'large_sandstone_blocks_01', 'clay_roof_tiles', 'brown_planks_05', 'wood_shutter'],
    sky: 'sky_2k.hdr',
    neutral: { clay_plaster: 1, plastered_stone_wall: 1, brown_planks_05: 1 },
    models: ['wine_barrel_01', 'planter_pot_clay', 'ceramic_vase_02', 'antique_ceramic_vase_01', 'shrub_02']
  },
  inferno: { dir: '/assets/inferno/', havn: true, sky: 'sky.hdr?v20', tex: [], models: [] },   // v16: forfattet efter 3D-printet (tools/inferno/) – samme loader som de_havn
  havn: { dir: '/assets/havn/', havn: true, sky: 'sky.hdr', tex: [], models: [] },
  canals: { dir: '/assets/canals/', havn: true, sky: 'sky.hdr?v20', tex: [], models: [] },   // v16: CS:GO de_canals fra brugerens Blender-import (tools/canals/)
  ancient: {
    dir: '/assets/ancient/',
    tex: ['mossy_stone_wall', 'old_stone_wall', 'mossy_cobblestone', 'rock_pitted_mossy', 'leaves_forest_ground', 'bark_brown_02', 'mossy_sandstone', 'large_sandstone_blocks_01'],
    sky: 'sky_2k.hdr',
    neutral: { rock_pitted_mossy: 1 },
    models: ['antique_ceramic_vase_01', 'fern_02', 'shrub_02', 'rock_moss_set_01', 'rock_moss_set_02', 'anthurium_botany_01', 'calathea_orbifolia_01', 'shrub_03', 'shrub_sorrel_01', 'weed_plant_02']
  }
};

// Radiance .hdr (RGBE) → { w, h, data: Float32Array RGBA (lineær) }. Understøtter "nyt" RLE-format og flade scanlines.
export function parseRGBE(buf) {
  const u8 = new Uint8Array(buf);
  let p = 0;
  const line = () => { let s = ''; while (p < u8.length && u8[p] !== 10) s += String.fromCharCode(u8[p++]); p++; return s; };
  const magic = line();
  if (!/^#\?(RADIANCE|RGBE)/.test(magic)) throw new Error('ikke en Radiance HDR-fil');
  let fmtOk = false;
  for (;;) { const l = line(); if (l === '') break; if (/FORMAT=32-bit_rle_rgbe/.test(l)) fmtOk = true; if (p >= u8.length) throw new Error('HDR-header mangler'); }
  if (!fmtOk) throw new Error('ukendt HDR-format');
  const dim = line().match(/^-Y (\d+) \+X (\d+)$/);
  if (!dim) throw new Error('ukendt HDR-orientering');
  const h = +dim[1], w = +dim[2], rgbe = new Uint8Array(w * h * 4), scan = new Uint8Array(w * 4);
  for (let y = 0; y < h; y++) {
    if (w >= 8 && w < 32768 && u8[p] === 2 && u8[p + 1] === 2 && ((u8[p + 2] << 8) | u8[p + 3]) === w) {
      p += 4;
      for (let c = 0; c < 4; c++) {                                    // hver kanal for sig, run-length-kodet
        let x = 0;
        while (x < w) {
          let n = u8[p++];
          if (n > 128) { n -= 128; const v = u8[p++]; while (n-- > 0) scan[(x++) * 4 + c] = v; }
          else { while (n-- > 0) scan[(x++) * 4 + c] = u8[p++]; }
        }
      }
      rgbe.set(scan, y * w * 4);
    } else { rgbe.set(u8.subarray(p, p + w * 4), y * w * 4); p += w * 4; }   // flad scanline
  }
  const data = new Float32Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const e = rgbe[i * 4 + 3], f = e ? Math.pow(2, e - 136) : 0;           // 2^(e-128) / 256
    data[i * 4] = rgbe[i * 4] * f; data[i * 4 + 1] = rgbe[i * 4 + 1] * f; data[i * 4 + 2] = rgbe[i * 4 + 2] * f; data[i * 4 + 3] = 1;
  }
  return { w, h, data };
}
// solens retning: tyngdepunktet af de lyseste pixels (øverste 0,05 %) i equirect-billedet. Samme konvention som three's equirectUv:
//   u = atan(d.z, d.x) / 2π + 0,5 · v = asin(d.y) / π + 0,5   (billedrække 0 = top = v 1)
export function sunFromHDR(img) {
  const { w, h, data } = img, lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = data[i * 4] * 0.2126 + data[i * 4 + 1] * 0.7152 + data[i * 4 + 2] * 0.0722;
  const sorted = Float32Array.from(lum).sort(), thr = sorted[Math.floor(sorted.length * 0.9995)];
  let sx = 0, sy = 0, sz = 0, sw = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const L = lum[y * w + x]; if (L < thr) continue;
    const u = (x + 0.5) / w, v = 1 - (y + 0.5) / h, phi = (u - 0.5) * 2 * Math.PI, th = (v - 0.5) * Math.PI;
    sx += Math.cos(th) * Math.cos(phi) * L; sy += Math.sin(th) * L; sz += Math.cos(th) * Math.sin(phi) * L; sw += L;
  }
  const l = Math.hypot(sx, sy, sz) || 1;
  return [sx / l, sy / l, sz / l];
}

const cache = new Map();
// v15: HDRI-himmel (.hdr, RGBE) → HalfFloat-DataTexture (equirect) + solens retning
function loadSky(THREE, url) {
  return fetch(url).then(r => { if (!r.ok) throw new Error('HDRI ' + r.status); return r.arrayBuffer(); }).then(buf => {
    const img = parseRGBE(buf), half = new Uint16Array(img.data.length);
    const row = img.w * 4;                                               // filens række 0 = top; DataTexture-række 0 = v 0 (bund) => vend rækkerne
    for (let y = 0; y < img.h; y++) { const src = y * row, dst = (img.h - 1 - y) * row; for (let i = 0; i < row; i++) half[dst + i] = THREE.DataUtils.toHalfFloat(Math.min(img.data[src + i], 65000)); }
    const tex = new THREE.DataTexture(half, img.w, img.h, THREE.RGBAFormat, THREE.HalfFloatType);
    tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.LinearSRGBColorSpace;
    tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.wrapS = THREE.RepeatWrapping; tex.flipY = false; tex.needsUpdate = true;
    return { tex, sunDir: sunFromHDR(img) };
  });
}
export function loadThemeAssets(THREE, id, maxAniso, renderer) {
  const set = ASSET_SETS[id];
  if (!set) return Promise.resolve(null);
  if (cache.has(id)) return cache.get(id);
  if (set.havn) {                                                       // v15: forfattet bane (Blender + bagt lys) – se havn.js
    const p = Promise.all([import('./havn.js').then(m => m.loadHavn(THREE, renderer, set.dir, maxAniso)), loadSky(THREE, set.dir + set.sky)])
      .then(([havn, sky]) => ({ tex: {}, sky, models: {}, havn }))
      .catch(e => { console.warn('[assets] ' + id + ' kunne ikke indlæses – procedural reserve bruges', e); return null; });
    cache.set(id, p); return p;
  }
  const loader = new THREE.TextureLoader();
  const one = (file, srgb) => loader.loadAsync(set.dir + file).then(t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(16, maxAniso || 1);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.needsUpdate = true; return t;
  });
  // farvede plader (grøn container, blå stålplade) gøres neutrale (luminans, middel ≈ 0,72) så de kan tintes pr. objekt
  const neutral = t => {
    const img = t.image, w = img.width, h = img.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0); const id = cx.getImageData(0, 0, w, h), d = id.data;
    let mean = 0; for (let i = 0; i < d.length; i += 4) mean += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114; mean /= d.length / 4;
    const k = 214 / Math.max(1, mean);
    for (let i = 0; i < d.length; i += 4) { const v = Math.min(255, (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) * k); d[i] = d[i + 1] = d[i + 2] = v; }
    cx.putImageData(id, 0, 0);
    const nt = new THREE.CanvasTexture(cv); nt.wrapS = nt.wrapT = THREE.RepeatWrapping; nt.anisotropy = t.anisotropy; nt.colorSpace = THREE.SRGBColorSpace; t.dispose(); return nt;
  };
  const NEUTRAL = set.neutral || {};
  const texP = Promise.all(set.tex.map(n => Promise.all([one(n + '_diff.jpg', true), one(n + '_nor.jpg', false), one(n + '_arm.jpg', false)]).then(([map, normal, arm]) => [n, { map: NEUTRAL[n] ? neutral(map) : map, normal, arm }])));
  const skyP = set.sky ? loadSky(THREE, set.dir + set.sky) : Promise.resolve(null);
  // 3D-modeller (glTF): en model der fejler udelades blot (temaet bruger så sin procedurale variant)
  const modP = Promise.all((set.models || []).map(n => loadGLTF(THREE, '/assets/models/' + n + '/' + n + '.gltf', maxAniso).then(m => [n, m]).catch(e => { console.warn('[assets] model ' + n + ' fejlede', e); return null; })))
    .then(list => Object.fromEntries(list.filter(Boolean)));
  const p = Promise.all([texP, skyP, modP]).then(([tex, sky, models]) => ({ tex: Object.fromEntries(tex), sky, models })).catch(e => { console.warn('[assets] ' + id + ' kunne ikke indlæses – procedurale materialer bruges', e); cache.delete(id); return null; });
  cache.set(id, p);
  return p;
}
