// ==========================================================================
// VISUALS (v8) – rendering-motor for banerne (ingen netværk/fysik):
//   • proceduralt malede teksturer (512–1024 px) + bump-maps
//   • verdensmesh bygget af kollisionsboksene: skjulte flader fjernes, synlige flader deles i 2×1 m celler
//   • BAGT LYS pr. vertex: himmel-synlighed (ambient occlusion – indendørs bliver mørkt) + lamper (synlighed via raycast)
//     + lys-prober (3D-gitter) til dekor og bevægelige objekter (spillere, døre, våben) – så alt matcher rummets lys
//   • sammensmeltet geometri pr. materiale og 32 m-celle (frustum-culling) + afstands-LOD for småt detaljelag
//   • døre (svinger op når nogen nærmer sig), himmel, effekter
// Afhængigheder injiceres (testbar uden browser):  createVisuals(THREE, WD, W, canvasTexture, maxAniso, createThemes)
// ==========================================================================
import { derivePBR } from './pbr.js';
import { clusterLOD } from './models.js';

export function createVisuals(THREE, WD, W, canvasTexture, maxAniso, createThemes, assets) {   // assets: fotoscannede PBR-teksturer + HDRI (assets.js) eller null
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const col = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
  const rnd = seed => { let s = (seed >>> 0) % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  const hash2 = (a, b) => Math.abs(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453) % 1;
  const one = () => 1;
  const timeU = { value: 0 };                       // delt tid-uniform (blade-sving, himmel)
  const WALL_TOP = 9;

  /* ------------------------------------------------------------ teksturer */
  function mkTex(draw, size, opts) {
    const o = opts || {}, w = o.w || size || 512, h = o.h || size || 512;
    const t = canvasTexture(draw, w, h);
    t.wrapS = t.wrapT = o.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    t.anisotropy = Math.min(o.aniso || 8, maxAniso || 1);
    return t;
  }
  // malerværktøj (tegner med wrap, så teksturerne kan flises uden synlige sømme)
  const P = {
    wrap(w, h, x, y, r, fn) { for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { if (x + ox + r < 0 || x + ox - r > w || y + oy + r < 0 || y + oy - r > h) continue; fn(x + ox, y + oy); } },
    speckle(c, w, h, n, lo, hi, a, sz, R) {
      for (let i = 0; i < n; i++) { const v = lo + R() * (hi - lo) | 0; c.fillStyle = `rgba(${v},${v},${v},${a * (0.4 + R() * 0.6)})`; c.fillRect(R() * w, R() * h, 1 + R() * sz, 1 + R() * sz); }
    },
    tint(c, w, h, n, rgb, a, sz, R) { for (let i = 0; i < n; i++) { c.fillStyle = `rgba(${rgb},${a * (0.3 + R() * 0.7)})`; c.fillRect(R() * w, R() * h, 1 + R() * sz, 1 + R() * sz); } },
    blobs(c, w, h, n, rmin, rmax, rgb, a, R) {
      for (let i = 0; i < n; i++) {
        const x = R() * w, y = R() * h, r = rmin + R() * (rmax - rmin), al = a * (0.4 + R() * 0.6);
        P.wrap(w, h, x, y, r, (px, py) => { const g = c.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(${rgb},${al})`); g.addColorStop(1, `rgba(${rgb},0)`); c.fillStyle = g; c.fillRect(px - r, py - r, r * 2, r * 2); });
      }
    },
    streaks(c, w, h, n, rgb, a, l0, l1, wd, R) {
      for (let i = 0; i < n; i++) {
        const x = R() * w, y = R() * h, l = l0 + R() * (l1 - l0), g = c.createLinearGradient(0, y, 0, y + l);
        g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); c.fillStyle = g; c.fillRect(x, y, wd * (0.5 + R()), l);
        if (y + l > h) c.fillRect(x, y - h, wd, l);
      }
    },
    cracks(c, w, h, n, rgba, len, R) {
      c.strokeStyle = rgba; c.lineWidth = 1.2;
      for (let i = 0; i < n; i++) { let x = R() * w, y = R() * h; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < len; k++) { x += (R() - 0.5) * 26; y += (R() - 0.2) * 22; c.lineTo(x, y); } c.stroke(); }
    },
    rect(c, x, y, w, h, color) { c.fillStyle = color; c.fillRect(x, y, w, h); },
    bevel(c, x, y, w, h, lt, dk) { c.fillStyle = lt; c.fillRect(x, y, w, 2); c.fillRect(x, y, 2, h); c.fillStyle = dk; c.fillRect(x, y + h - 2, w, 2); c.fillRect(x + w - 2, y, 2, h); },
    rgb(r, g, b) { return `rgb(${r | 0},${g | 0},${b | 0})`; }
  };

  /* ============================================================ BAGT LYS ============================================================ */
  // kolliderere der tegnes som hele bokse (bruges til at fjerne skjulte flader); props/cylindre er runde => tæller ikke
  const STRUCT = { floor: 1, wall: 1, ceil: 1, slab: 1, roofslab: 1, grate: 1, stone: 1, ruin: 1, vent: 1, steel: 1, steelstairs: 1, ramp: 1, trim: 1, platform: 1, fill: 1 };   // fill = usynlig fyldmasse (Nuke fra STL)
  function insideSolid(x, y, z, structOnly) {
    const cs = WD.query(W, x - 1e-3, z - 1e-3, x + 1e-3, z + 1e-3);
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (c.nb || (structOnly && !STRUCT[c.k])) continue;
      if (x <= c.x0 || x >= c.x1 || z <= c.z0 || z >= c.z1 || y <= c.y0) continue;
      if (c.r) { if (y < WD.rampHeight(c.r, c.r.axis === 'x' ? x : z)) return true; continue; }
      if (y < c.y1) return true;
    }
    return false;
  }
  // cosinus-vægtede retninger (golden spiral) omkring +Y
  const dirSet = n => { const out = []; for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, r = Math.sqrt(u), a = i * 2.39996323; out.push([r * Math.cos(a), Math.sqrt(1 - u), r * Math.sin(a)]); } return out; };
  const DIRS = dirSet(14), DIRS_P = dirSet(10);
  const SKY_RANGE = 46;

  let theme = null, lamps = [], lampBins = new Map(), probes = null;
  const LAMP_GAIN = 2.2;                           // lampernes styrke relativt til sol/himmel efter ACES-tonemapping
  const LB = 8, binKey = (x, z) => Math.floor(x / LB) + ',' + Math.floor(z / LB);
  function addLamps(list) {
    lamps = list.map(L => Object.assign({ range: 12, i: 1 }, L, { c: col(L.color === undefined ? 0xffe0b0 : L.color) }));
    lampBins = new Map();
    for (const L of lamps) {
      const r = L.range;
      for (let x = Math.floor((L.x - r) / LB); x <= Math.floor((L.x + r) / LB); x++) for (let z = Math.floor((L.z - r) / LB); z <= Math.floor((L.z + r) / LB); z++) {
        const k = x + ',' + z; if (!lampBins.has(k)) lampBins.set(k, []); lampBins.get(k).push(L);
      }
    }
  }
  // lys fra lamper i et punkt (n=null => rundtgående, til prober)
  function lampLight(ox, oy, oz, nx, ny, nz, out) {
    out[0] = out[1] = out[2] = 0;
    const list = lampBins.get(binKey(ox, oz)); if (!list) return out;
    for (const L of list) {
      const dx = L.x - ox, dy = L.y - oy, dz = L.z - oz, d2 = dx * dx + dy * dy + dz * dz, rr = L.range * L.range;
      if (d2 >= rr) continue;
      const d = Math.sqrt(d2) || 1e-3;
      let ndl = 0.65;
      if (nx !== null) { ndl = (dx * nx + dy * ny + dz * nz) / d; if (ndl <= 0.02) continue; }
      if (L.dir) { const sp = -(dx * L.dir[0] + dy * L.dir[1] + dz * L.dir[2]) / d; if (sp <= 0) continue; ndl *= Math.pow(sp, L.cone || 1.5); }
      const win = 1 - d2 / rr, att = win * win / (1 + d2 * 0.09);
      if (WD.raycastWorld(W, ox, oy, oz, dx / d, dy / d, dz / d, d - 0.15) < d - 0.16) continue;
      const k = L.i * att * ndl * LAMP_GAIN;
      out[0] += L.c[0] * k; out[1] += L.c[1] * k; out[2] += L.c[2] * k;
    }
    return out;
  }
  // andel af hemisfæren omkring n der ser himlen
  const _b = [0, 0, 0], _t = [0, 0, 0];
  function skyFrac(ox, oy, oz, nx, ny, nz, dirs, seed) {
    // ortonormal basis (t, n, b)
    if (Math.abs(ny) < 0.9) { _t[0] = nz; _t[1] = 0; _t[2] = -nx; } else { _t[0] = 0; _t[1] = -nz; _t[2] = ny; }
    let l = Math.hypot(_t[0], _t[1], _t[2]); _t[0] /= l; _t[1] /= l; _t[2] /= l;
    _b[0] = ny * _t[2] - nz * _t[1]; _b[1] = nz * _t[0] - nx * _t[2]; _b[2] = nx * _t[1] - ny * _t[0];
    const ca = Math.cos(seed), sa = Math.sin(seed);
    let esc = 0;
    for (const d of dirs) {
      const u = d[0] * ca - d[2] * sa, v = d[0] * sa + d[2] * ca;
      const rx = _t[0] * u + nx * d[1] + _b[0] * v, ry = _t[1] * u + ny * d[1] + _b[1] * v, rz = _t[2] * u + nz * d[1] + _b[2] * v;
      if (WD.raycastWorld(W, ox, oy, oz, rx, ry, rz, SKY_RANGE) >= SKY_RANGE - 1e-6) esc += ry > -0.05 ? 1 : 0.35;
    }
    return esc / dirs.length;
  }

  /* ---- lys-prober: 3D-gitter (2 m vandret, 1 m lodret) med himmel-synlighed + lampelys (rundtgående) ---- */
  function buildProbes() {
    const b = W.bounds, dx = 2, dy = 1;
    let ylo = Infinity, yhi = -Infinity;
    for (const L of W.layers) for (const k in L.tiles) { const t = L.tiles[k]; if (t.floor !== undefined) { ylo = Math.min(ylo, t.floor); yhi = Math.max(yhi, t.floor + (t.sill || 0)); } }
    for (const bx of W.boxes) if (bx.kind === 'slab' || bx.kind === 'grate' || bx.kind === 'roofslab' || bx.kind === 'stone') yhi = Math.max(yhi, bx.y1);
    if (W.data) for (const bx of W.boxes) if (bx.kind === 'floor') { ylo = Math.min(ylo, bx.y1); yhi = Math.max(yhi, bx.y1); }   // v12.1: gulvbokse (Nuke fra STL)
    if (!Number.isFinite(ylo)) ylo = 0; if (!Number.isFinite(yhi)) yhi = 0;
    ylo -= 0.5; yhi = Math.min(WALL_TOP - 0.5, yhi + 4.5);
    // prober i tile-centre (ulige koordinater) – aldrig præcis på en vægflade
    const px0 = b.x0 - 1, pz0 = b.z0 - 1, py0 = ylo + 0.25;
    const nx = Math.ceil((b.x1 - px0) / dx) + 2, ny = Math.ceil((yhi - py0) / dy) + 1, nz = Math.ceil((b.z1 - pz0) / dx) + 2;
    const N = nx * ny * nz, data = new Float32Array(N * 4), ok = new Uint8Array(N), tmp = [0, 0, 0];
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = px0 + i * dx, y = py0 + j * dy, z = pz0 + k * dx, idx = (k * ny + j) * nx + i;
      if (insideSolid(x, y, z, false)) continue;
      ok[idx] = 1;
      data[idx * 4 + 3] = skyFrac(x, y, z, 0, 1, 0, DIRS_P, idx * 0.37);
      lampLight(x, y, z, null, 0, 0, tmp); data[idx * 4] = tmp[0]; data[idx * 4 + 1] = tmp[1]; data[idx * 4 + 2] = tmp[2];
    }
    probes = { x0: px0, y0: py0, z0: pz0, dx, dy, nx, ny, nz, data, ok };
  }
  // trilineær prøve (kun gyldige prober vægtes)
  function probe(x, y, z, out) {
    const p = probes; out = out || [0, 0, 0, 0];
    if (!p) { out[0] = out[1] = out[2] = 0; out[3] = 1; return out; }
    const fx = clamp((x - p.x0) / p.dx, 0, p.nx - 1.001), fy = clamp((y - p.y0) / p.dy, 0, p.ny - 1.001), fz = clamp((z - p.z0) / p.dx, 0, p.nz - 1.001);
    const i0 = Math.floor(fx), j0 = Math.floor(fy), k0 = Math.floor(fz), tx = fx - i0, ty = fy - j0, tz = fz - k0;
    let w = 0, r = 0, g = 0, b2 = 0, s = 0;
    for (let c = 0; c < 8; c++) {
      const i = i0 + (c & 1), j = j0 + ((c >> 1) & 1), k = k0 + ((c >> 2) & 1), idx = (k * p.ny + j) * p.nx + i;
      if (!p.ok[idx]) continue;
      const wt = ((c & 1) ? tx : 1 - tx) * (((c >> 1) & 1) ? ty : 1 - ty) * (((c >> 2) & 1) ? tz : 1 - tz) + 1e-4;
      w += wt; r += p.data[idx * 4] * wt; g += p.data[idx * 4 + 1] * wt; b2 += p.data[idx * 4 + 2] * wt; s += p.data[idx * 4 + 3] * wt;
    }
    if (w < 1e-3) { out[0] = out[1] = out[2] = 0; out[3] = 0.35; return out; }
    out[0] = r / w; out[1] = g / w; out[2] = b2 / w; out[3] = s / w; return out;
  }
  // flade-vertex: himmel (inkl. let 'bounce' fra omgivelserne) + lamper
  const _pr = [0, 0, 0, 0], _ll = [0, 0, 0];
  function bakeSurface(x, y, z, nx, ny, nz, cx, cy, cz) {
    let ox = x + nx * 0.04, oy = y + ny * 0.04 + 0.012, oz = z + nz * 0.04;
    if (insideSolid(ox, oy, oz, false) && cx !== undefined) {             // vertex inde i anden geometri: ryk lidt ind mod cellens midte
      for (const f of [0.15, 0.35, 0.6]) { const px = ox + (cx - x) * f, py = oy + (cy - y) * f, pz = oz + (cz - z) * f; if (!insideSolid(px, py, pz, false)) { ox = px; oy = py; oz = pz; break; } }
    }
    const sky = skyFrac(ox, oy, oz, nx, ny, nz, DIRS, (x * 7.13 + z * 3.71 + y * 1.3) % 6.283);
    probe(ox, oy, oz, _pr);
    const minSky = theme.light.minSky === undefined ? 0.07 : theme.light.minSky;
    const a = Math.max(minSky, sky + (1 - sky) * 0.42 * _pr[3]);
    lampLight(ox, oy, oz, nx, ny, nz, _ll);
    const fill = 0.32;                                                   // lampernes 'bounce' i rummet
    return [_ll[0] + _pr[0] * fill, _ll[1] + _pr[1] * fill, _ll[2] + _pr[2] * fill, a];
  }
  // dekor-vertex: fra prober (normal nedad => lidt mørkere)
  function bakeProbe(x, y, z, ny) {
    probe(x, y, z, _pr);
    const minSky = theme.light.minSky === undefined ? 0.07 : theme.light.minSky;
    const k = 0.72 + 0.28 * clamp(ny, -1, 1);
    return [_pr[0] * (0.75 + 0.25 * k), _pr[1] * (0.75 + 0.25 * k), _pr[2] * (0.75 + 0.25 * k), Math.max(minSky, _pr[3] * k)];
  }

  /* ============================================================ materialer (bagt lys sprøjtes ind i shaderen) ============================================================ */
  // bagt lys: himmel-synlighed dæmper indirekte lys (diffust OG miljø-refleksioner – indendørs spejler intet himlen), lampelys lægges til
  const BAKE_FRAG = '#include <aomap_fragment>\n  reflectedLight.indirectDiffuse *= BK.a;\n  reflectedLight.indirectSpecular *= BK.a * BK.a;\n  reflectedLight.indirectDiffuse += BK.rgb * diffuseColor.rgb;';
  // skygge-kaskader: retningslys 0 = nær-kaskade (skarp, følger kameraet), retningslys 1 = hele banen (statisk, intensitet 0 – kun dens skyggekort bruges)
  const CSM_FN = `
#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 1
float wdCascade() {
  vec4 c0 = vDirectionalShadowCoord[ 0 ];
  vec3 p = c0.xyz / c0.w;
  vec2 e = abs( p.xy - 0.5 ) * 2.0;
  float edge = max( e.x, e.y ), far = 1.0;
  if ( edge > 0.8 || p.z > 1.0 ) far = getShadow( directionalShadowMap[ 1 ], directionalLightShadows[ 1 ].shadowMapSize, directionalLightShadows[ 1 ].shadowBias, directionalLightShadows[ 1 ].shadowRadius, vDirectionalShadowCoord[ 1 ] );
  if ( edge >= 0.97 || p.z > 1.0 ) return far;
  float near = getShadow( directionalShadowMap[ 0 ], directionalLightShadows[ 0 ].shadowMapSize, directionalLightShadows[ 0 ].shadowBias, directionalLightShadows[ 0 ].shadowRadius, c0 );
  return mix( near, far, smoothstep( 0.8, 0.97, edge ) );
}
#endif`;
  const SHADOW_LINE = 'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;';
  // v14: slukkede lys springes over pr. fragment (punktlys-puljen ligger på intensitet 0 det meste af tiden, fjern-kaskadens lys har altid 0):
  //   getPointLightInfo sætter directLight.visible = farve != 0 (også uden for rækkevidden) => en dynamisk gren i stedet for 3 spildte BRDF'er – ingen genkompilering
  const RE_LINE = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
  const guardRE = src => src.split(RE_LINE).join('if ( directLight.visible ) ' + RE_LINE);
  const LIGHTS_CSM = THREE.ShaderChunk.lights_fragment_begin.includes(SHADOW_LINE) ? guardRE(THREE.ShaderChunk.lights_fragment_begin.replace(SHADOW_LINE,
    '#if UNROLLED_LOOP_INDEX == 0 && NUM_DIR_LIGHT_SHADOWS > 1\n directLight.color *= ( directLight.visible && receiveShadow ) ? wdCascade() : 1.0;\n#elif UNROLLED_LOOP_INDEX == 1 && NUM_DIR_LIGHT_SHADOWS > 1\n directLight.color *= 0.0; directLight.visible = false;\n#else\n ' + SHADOW_LINE + '\n#endif')) : null;
  const LIGHTS_PLAIN = guardRE(THREE.ShaderChunk.lights_fragment_begin);
  function patchCSM(sh) {
    if (!LIGHTS_CSM) { sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_begin>', LIGHTS_PLAIN); return; }
    sh.fragmentShader = sh.fragmentShader.replace('#include <shadowmap_pars_fragment>', '#include <shadowmap_pars_fragment>\n' + CSM_FN).replace('#include <lights_fragment_begin>', LIGHTS_CSM);
  }
  /* ---- v10 VEJRLIG (søjle 1+2): materiale-blanding i verdensrum oven på PBR-teksturerne – ingen ekstra teksturer/draw calls ----
     Pr. vertex: wear = (gulvhøjde under fladen, fladens top/murkrone, vægt 0..1 – 0 = intet vejrlig, fx manglende attribut).
     • makrovariation: lavfrekvent støj (3 oktaver) bryder teksturgentagelsen over store flader
     • fodsmuds: lodrette flader mørknes/sandes op nedefra (ujævn kant) – sand i ørkenen, fugt/sod i Nuke, mos/jord i Ancient
     • regnløb: lodrette striber hængende ned fra murkronen (aftager med afstanden fra toppen)
     • aflejring: pletter på vandrette flader (sandfygning, støv, mos) med egen ruhed
     • vådt: under temaets 'wetY' (Nukes kælder) får gulvet blanke vandpytter og murfoden fugtkant
     Alle værdier er tema-uniforms (theme.weather) => samme shader-program for alle baner. */
  const WU = {
    uMacro: { value: 0 }, uMacroCol: { value: new THREE.Vector3(1, 1, 1) },
    uGrimeH: { value: 0.8 }, uGrimeAmt: { value: 0 }, uGrimeCol: { value: new THREE.Vector3(0.5, 0.45, 0.4) },
    uStreakAmt: { value: 0 }, uStreakLen: { value: 3 }, uStreakCol: { value: new THREE.Vector3(0.3, 0.28, 0.25) },
    uTopAmt: { value: 0 }, uTopThr: { value: 0.55 }, uTopCol: { value: new THREE.Vector3(0.8, 0.7, 0.5) }, uTopRough: { value: 0.95 },
    uWetY: { value: -1e4 }, uWetAmt: { value: 0 }
  };
  const WEATHER_PARS = `
varying vec3 vWP; varying vec3 vWN; varying vec3 vWear;
uniform float uMacro, uGrimeH, uGrimeAmt, uStreakAmt, uStreakLen, uTopAmt, uTopThr, uTopRough, uWetY, uWetAmt;
uniform vec3 uMacroCol, uGrimeCol, uStreakCol, uTopCol;
float wdH(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }   // sinus-fri hash (billig, stabil ved store koordinater)
float wdN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(wdH(i), wdH(i + vec2(1.0, 0.0)), f.x), mix(wdH(i + vec2(0.0, 1.0)), wdH(i + vec2(1.0, 1.0)), f.x), f.y); }
`;
  // v14: hver effekt ligger i sin egen gren (temaets styrke 0, vandrette/lodrette flader, højdebånd) – kun de fragmenter der rammes betaler for støjen
  const WEATHER_FRAG = `#include <metalnessmap_fragment>
  {
    vec3 wn = normalize(vWN); vec3 an = abs(wn);
    float vert = 1.0 - smoothstep(0.35, 0.75, an.y), up = smoothstep(0.7, 0.95, wn.y);
    float along = an.x > an.z ? vWP.z : vWP.x;
    float k = clamp(vWear.z, 0.0, 1.0), h = vWP.y - vWear.x, t = vWear.y - vWP.y;
    if (uMacro > 0.0) {
      vec2 puv = an.y > max(an.x, an.z) ? vWP.xz : vec2(along, vWP.y);
      float mac = wdN(puv * 0.17) * 0.55 + wdN(puv * 0.53 + 7.3) * 0.3 + wdN(puv * 1.6 + 2.1) * 0.15;
      diffuseColor.rgb *= mix(vec3(1.0), uMacroCol, smoothstep(0.35, 0.75, mac) * uMacro * 2.0) * (1.0 + (mac - 0.5) * uMacro);
    }
    // fodsmuds/sand (ujævn kant, stærkest i hjørner af lange løb)
    if (uGrimeAmt * vert * k > 0.0 && h > -0.05 && h < uGrimeH * 1.45) {
      float edge = uGrimeH * (0.55 + 0.9 * wdN(vec2(along * 0.9, 1.7)));
      float g = (1.0 - smoothstep(0.0, edge, h)) * vert * k * uGrimeAmt;
      g *= 0.7 + 0.3 * wdN(vec2(along * 4.0, vWP.y * 3.0));
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uGrimeCol * 1.6, g);
      roughnessFactor = min(1.0, roughnessFactor + g * 0.12);
    }
    // regnløb under murkronen (exp-halen er < 0,3 % efter 6 længder)
    if (uStreakAmt * vert * k > 0.0 && t > -0.02 && t < uStreakLen * 6.0) {
      float st = smoothstep(0.5, 0.82, wdN(vec2(along * 2.3, vWP.y * 0.07 + along * 0.11))) * smoothstep(0.35, 0.7, wdN(vec2(along * 0.31, 5.3)));
      float s = st * exp(-max(t, 0.0) / uStreakLen) * vert * k * uStreakAmt;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uStreakCol * 1.6, s);
    }
    // aflejring på vandrette flader (sand, støv, mos)
    if (up * uTopAmt > 0.0) {
      float dep = smoothstep(uTopThr, uTopThr + 0.22, wdN(vWP.xz * 0.21 + 3.7) * 0.65 + wdN(vWP.xz * 0.9) * 0.35) * up * uTopAmt * (0.4 + 0.6 * k);
      diffuseColor.rgb = mix(diffuseColor.rgb, uTopCol * (0.85 + 0.3 * wdN(vWP.xz * 3.1)), dep);
      roughnessFactor = mix(roughnessFactor, uTopRough, dep); metalnessFactor *= 1.0 - dep;
    }
    // vådt (kun under uWetY): vandpytter på gulve + fugtkant på murfoden
    float wet = (1.0 - smoothstep(uWetY - 0.5, uWetY, vWP.y)) * uWetAmt;
    if (wet > 0.0) {
      float pud = up > 0.0 ? smoothstep(0.58, 0.66, wdN(vWP.xz * 0.23 + 11.0) * 0.7 + wdN(vWP.xz * 1.1) * 0.3) * up * wet : 0.0;
      float damp = vert * k > 0.0 && h < 0.75 ? (1.0 - smoothstep(0.0, 0.45 + 0.3 * wdN(vec2(along * 1.4, 2.0)), h)) * vert * wet * k : 0.0;
      diffuseColor.rgb *= 1.0 - 0.35 * max(pud, damp);
      roughnessFactor = mix(roughnessFactor, 0.06, pud); roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.55, damp);
    }
  }`;
  function patchWeather(sh) {
    Object.assign(sh.uniforms, WU);
    sh.vertexShader = 'attribute vec3 wear;\nvarying vec3 vWP; varying vec3 vWN; varying vec3 vWear;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWear = wear; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = mat3(modelMatrix) * objectNormal;');
    sh.fragmentShader = WEATHER_PARS + sh.fragmentShader.replace('#include <metalnessmap_fragment>', WEATHER_FRAG);
  }
  function withBake(m, dyn) {
    const prev = m.onBeforeCompile;
    if (dyn) m.userData.uBake = { value: new THREE.Vector4(0, 0, 0, 1) };
    const weather = !dyn && !!m.userData.weather && !!m.isMeshStandardMaterial;
    m.onBeforeCompile = (sh, r) => {
      if (prev && prev !== THREE.Material.prototype.onBeforeCompile) prev(sh, r);
      patchCSM(sh);
      if (dyn) {
        sh.uniforms.uBake = m.userData.uBake;
        sh.fragmentShader = 'uniform vec4 uBake;\n#define BK uBake\n' + sh.fragmentShader.replace('#include <aomap_fragment>', BAKE_FRAG);
      } else {
        sh.vertexShader = 'attribute vec4 bake;\nvarying vec4 vBake;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vBake = bake;');
        sh.fragmentShader = 'varying vec4 vBake;\n#define BK vBake\n' + sh.fragmentShader.replace('#include <aomap_fragment>', BAKE_FRAG);
        // v20: afstands-anti-gnist – fine normal-detaljer og glans dæmpes på afstand (fjerne flader blev 'grynede')
        sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  float hvFar = smoothstep( 14.0, 55.0, length( vViewPosition ) );\n  roughnessFactor = mix( roughnessFactor, max( roughnessFactor, 0.78 ), hvFar );')
          .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace(/mapN\.xy \*= normalScale;/g, 'mapN.xy *= normalScale * ( 1.0 - 0.8 * hvFar );'));
        if (weather) patchWeather(sh);
      }
    };
    const key = (dyn ? 'bkU' : 'bkV') + (m.userData.sway ? 'S' : '') + (weather ? 'W' : '');
    m.customProgramCacheKey = () => key;
    return m;
  }
  // PBR (MeshStandardMaterial) med vertex-farver (tint pr. objekt) – ét materiale kan genbruges af mange farvevarianter.
  //   o.rough / o.metal: grundværdier (beton/mursten ~0,9 og 0 = ru, ikke-reflekterende; metal ~0,35–0,45 og 0,75–0,9 = reflekterer lyset)
  //   o.bump: styrke på det afledte normal-map. Roughness/metalness-maps afledes af albedo-teksturen (pbr.js).
  const mat = (map, o) => {
    const opt = Object.assign({ map, vertexColors: true }, o || {}); delete opt.noWeather;
    const bump = opt.bump || 0, rough = opt.rough === undefined ? 0.9 : opt.rough, metal = opt.metal || 0, rv = opt.rv;
    delete opt.bump; delete opt.rough; delete opt.metal; delete opt.rv;
    const m = new THREE.MeshStandardMaterial(opt);
    const d = map && !opt.alphaTest ? derivePBR(THREE, map, { normal: bump, rough, metal, rv }) : null;
    if (d) {
      if (d.normalMap) m.normalMap = d.normalMap;
      m.roughnessMap = d.orm; m.metalnessMap = d.orm; m.roughness = 1; m.metalness = 1;
    } else { m.roughness = rough; m.metalness = metal; }
    m.userData.pbr = { rough, metal };
    m.userData.weather = !opt.alphaTest && !opt.transparent && !o?.noWeather;   // skilte/stencils/decals får intet vejrlig
    return withBake(m, false);
  };
  // selvlysende (lamper, skærme): HDR-farve (> 1) så de giver subtil bloom i post-processing
  const unlit = (color, o) => { const { hdr, ...q } = o || {}, m = new THREE.MeshBasicMaterial(Object.assign({ color, vertexColors: true }, q)); m.color.multiplyScalar(hdr !== undefined ? hdr : 1.9); return m; };
  // v11: fotoscannet PBR-sæt {map, normal, arm} – ARM = ambient occlusion (R), roughness (G), metalness (B). UV'er er verdens-skalerede (uvs = meter pr. gentagelse).
  //   o.rough / o.metal ganger kortets værdier; o.normal = normal-styrke; o.ao = AO-styrke. Vertex-farver tinter (fx malede mure).
  const pbrMat = (set, o) => {
    o = o || {};
    const m = new THREE.MeshStandardMaterial({ map: set.map, normalMap: set.normal, roughnessMap: set.arm, metalnessMap: set.arm, aoMap: set.arm, aoMapIntensity: o.ao === undefined ? 1 : o.ao,
      roughness: o.rough === undefined ? 1 : o.rough, metalness: o.metal === undefined ? 1 : o.metal, vertexColors: true });
    const ns = o.normal === undefined ? 1 : o.normal; m.normalScale.set(ns, ns);
    m.userData.pbr = { rough: 0.8 * m.roughness, metal: o.metalHint === undefined ? 0.6 * m.metalness : o.metalHint, scanned: true };
    m.userData.weather = !o.noWeather;
    return withBake(m, false);
  };
  // bevægelige objekter (spillere, døre, våben på jorden): PBR med lys fra prober (uBake)
  const dynMat = (o) => { const q = { roughness: 0.8, metalness: 0 }; for (const k in (o || {})) if (o[k] !== undefined) q[k] = o[k]; return withBake(new THREE.MeshStandardMaterial(q), true); };
  const leafMat = (map, sway) => {      // blade: alpha-test (ingen gennemsigtighed), begge sider, (valgfrit) vind-sving i vertex-shader
    const m = new THREE.MeshLambertMaterial({ map, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide });
    if (sway) {
      m.userData.sway = true;
      m.onBeforeCompile = sh => {
        sh.uniforms.uTime = timeU;
        sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          float sw = uv.y * uv.y; transformed.x += sin(uTime * 1.6 + position.z * 0.7 + position.x * 0.4) * 0.05 * sw; transformed.z += cos(uTime * 1.2 + position.x * 0.6 + position.y * 0.3) * 0.045 * sw;`);
      };
    }
    return withBake(m, false);
  };

  /* ------------------------------------------------------------ Batch: samler statisk geometri pr. materiale + 32 m-celle (frustum-culling), ekstra 'detail'-lag (LOD) */
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s1 = new THREE.Vector3(1, 1, 1), _n3 = new THREE.Matrix3();
  const WHITE = [1, 1, 1];
  let QA = null;                                                    // v14: sættes kun af test/mapqa.js (globalThis.__WDQA) under buildDecor
  class Batch {
    constructor(cell, tag, o) { this.cell = cell || 32; this.tag = tag || null; this.shadow = !(o && o.shadow === false); this.map = new Map(); this.count = 0; }   // tag: til QA (fx 'skyline', 'cornice', 'decal')
    _bk(mat, x, z, o) {
      const lod = o && o.detail ? 1 : 0, sh = o && o.shadow === false ? 0 : 1;
      const tag = (o && o.tag) || this.tag, key = mat.uuid + '|' + Math.floor(x / this.cell) + '|' + Math.floor(z / this.cell) + '|' + lod + sh + '|' + tag;
      let b = this.map.get(key); if (!b) { b = { mat, pos: [], nor: [], uv: [], col: [], bake: [], wear: [], lod, sh, tag }; this.map.set(key, b); } return b;
    }
    // lavniveau: tilføj trekanter (lokale arrays) transformeret med m; bagt lys fra prober (eller o.bake)
    _push(b, P3, N3, U2, m, tint, bake, wear) {
      _n3.getNormalMatrix(m); const e = m.elements, n = _n3.elements, t = tint || WHITE;
      let last = null, lx = 1e9, ly = 1e9, lz = 1e9;
      const i0 = b.pos.length;
      for (let i = 0; i < P3.length; i += 3) {
        const x = P3[i], y = P3[i + 1], z = P3[i + 2], nx = N3[i], ny = N3[i + 1], nz = N3[i + 2];
        const wx = e[0] * x + e[4] * y + e[8] * z + e[12], wy = e[1] * x + e[5] * y + e[9] * z + e[13], wz = e[2] * x + e[6] * y + e[10] * z + e[14];
        b.pos.push(wx, wy, wz);
        let ax = n[0] * nx + n[3] * ny + n[6] * nz, ay = n[1] * nx + n[4] * ny + n[7] * nz, az = n[2] * nx + n[5] * ny + n[8] * nz; const l = Math.hypot(ax, ay, az) || 1;
        b.nor.push(ax / l, ay / l, az / l); b.col.push(t[0], t[1], t[2]);
        if (bake) b.bake.push(bake[0], bake[1], bake[2], bake[3]);
        else {
          if (!last || Math.abs(wx - lx) + Math.abs(wy - ly) + Math.abs(wz - lz) > 0.35) { last = bakeProbe(wx + ax / l * 0.1, wy + ay / l * 0.1, wz + az / l * 0.1, ay / l); lx = wx; ly = wy; lz = wz; }
          b.bake.push(last[0], last[1], last[2], last[3]);
        }
      }
      for (let i = 0; i < U2.length; i++) b.uv.push(U2[i]);
      this._wear(b, i0, wear);
      this.count += P3.length / 9;
      if (QA) this._qa(b, i0);
    }
    // v14 QA (test/mapqa.js): én AABB pr. primitiv – svæve-, tomheds- og gentagelses-analyse
    _qa(b, i0) {
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity; const P = b.pos;
      for (let i = i0; i < P.length; i += 3) { const x = P[i], y = P[i + 1], z = P[i + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
      if (x0 < Infinity) QA.push({ x0, y0, z0, x1, y1, z1, mat: b.mat, tag: b.tag || '' });
    }
    // vejrlig pr. primitiv: (gulv under objektet, objektets top, vægt) – eller o.wear eksplicit
    _wear(b, i0, w) {
      if (!w) {
        let y0 = Infinity, y1 = -Infinity, sx = 0, sz = 0, nv = 0;
        for (let i = i0; i < b.pos.length; i += 3) { const y = b.pos[i + 1]; if (y < y0) y0 = y; if (y > y1) y1 = y; sx += b.pos[i]; sz += b.pos[i + 2]; nv++; }
        const g = nv ? WD.groundAt(W, sx / nv, sz / nv, y0 + 0.05, 0.3) : -Infinity;
        w = [g === -Infinity || y0 - g > 0.6 ? y0 - 50 : g, y1, 0.6];
      }
      for (let i = i0; i < b.pos.length; i += 3) b.wear.push(w[0], w[1], w[2]);
    }
    _mat(cx, cy, cz, o) { if (o.quat) _q.copy(o.quat); else { _e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ'); _q.setFromEuler(_e); } _v.set(cx, cy, cz); _m.compose(_v, _q, _s1); return _m; }
    // boks med verdens-skaleret UV (uvs = meter pr. tekstur-gentagelse)
    box(mat, cx, cy, cz, sx, sy, sz, o) {
      o = o || {}; const u = o.uvs || 2, hx = sx / 2, hy = sy / 2, hz = sz / 2, P3 = [], N3 = [], U = [];
      const face = (n, a, b, c, d, su, sv) => { for (const k of [a, b, c, a, c, d]) { P3.push(k[0], k[1], k[2]); N3.push(n[0], n[1], n[2]); } const uu = su / u, vv = sv / u; U.push(0, 0, uu, 0, uu, vv, 0, 0, uu, vv, 0, vv); };
      face([0, 0, 1], [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz], sx, sy);
      face([0, 0, -1], [hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz], sx, sy);
      face([1, 0, 0], [hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz], sz, sy);
      face([-1, 0, 0], [-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz], sz, sy);
      if (!o.noTop) face([0, 1, 0], [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz], sx, sz);
      if (!o.noBottom) face([0, -1, 0], [-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz], sx, sz);
      this._push(this._bk(mat, cx, cz, o), P3, N3, U, this._mat(cx, cy, cz, o), o.tint, o.bake, o.wear); return this;
    }
    // frustum (tilspidset boks): bund (wb×db) → top (wt×dt), højde h, centreret i (cx, cy=bund, cz)
    frustum(mat, cx, y0, cz, wb, db, wt, dt, h, o) {
      o = o || {}; const u = o.uvs || 2, a = wb / 2, b = db / 2, c = wt / 2, d = dt / 2, P3 = [], N3 = [], U = [];
      const quad = (p0, p1, p2, p3, su, sv) => {
        const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2], vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        for (const k of [p0, p1, p2, p0, p2, p3]) { P3.push(k[0], k[1], k[2]); N3.push(nx, ny, nz); } const uu = su / u, vv = sv / u; U.push(0, 0, uu, 0, uu, vv, 0, 0, uu, vv, 0, vv);
      };
      const sl = Math.hypot(h, (wb - wt) / 2);
      quad([-a, 0, b], [a, 0, b], [c, h, d], [-c, h, d], wb, sl); quad([a, 0, -b], [-a, 0, -b], [-c, h, -d], [c, h, -d], wb, sl);
      quad([a, 0, b], [a, 0, -b], [c, h, -d], [c, h, d], db, sl); quad([-a, 0, -b], [-a, 0, b], [-c, h, d], [-c, h, -d], db, sl);
      if (!o.noTop) quad([-c, h, d], [c, h, d], [c, h, -d], [-c, h, -d], wt, dt);
      this._push(this._bk(mat, cx, cz, o), P3, N3, U, this._mat(cx, y0, cz, o), o.tint, o.bake, o.wear); return this;
    }
    // cylinder (akse = y) med radius rb (bund) / rt (top); seg sider
    cyl(mat, cx, y0, cz, rb, rt, h, o) {
      o = o || {}; const seg = o.seg || 12, u = o.uvs || 2, P3 = [], N3 = [], U = [], slope = (rb - rt) / (h || 1);
      const a0r = o.arc ? o.arc[0] : 0, a1r = o.arc ? o.arc[1] : Math.PI * 2;
      for (let i = 0; i < seg; i++) {
        const a0 = a0r + i / seg * (a1r - a0r), a1 = a0r + (i + 1) / seg * (a1r - a0r), c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
        const pts = [[c0 * rb, 0, s0 * rb], [c1 * rb, 0, s1 * rb], [c1 * rt, h, s1 * rt], [c0 * rt, h, s0 * rt]];
        const nrm = [[c0, slope, s0], [c1, slope, s1], [c1, slope, s1], [c0, slope, s0]], uc0 = i / seg * ((a1r - a0r) * rb) / u, uc1 = (i + 1) / seg * ((a1r - a0r) * rb) / u, vv = h / u;
        const uvs = [[uc0, 0], [uc1, 0], [uc1, vv], [uc0, vv]];
        const ord = o.inside ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
        for (const k of ord) { P3.push(...pts[k]); N3.push(o.inside ? -nrm[k][0] : nrm[k][0], nrm[k][1], o.inside ? -nrm[k][2] : nrm[k][2]); U.push(...uvs[k]); }   // vinding: front-face udad (eller indad)
        if (o.caps !== false && rt > 0.001 && !o.inside) { for (const k of [[0, 0], [c1 * rt, s1 * rt], [c0 * rt, s0 * rt]]) { if (k[0] === 0 && k[1] === 0) P3.push(0, h, 0); else P3.push(k[0], h, k[1]); N3.push(0, 1, 0); } U.push(0.5, 0.5, 0.5 + c1 * 0.5, 0.5 + s1 * 0.5, 0.5 + c0 * 0.5, 0.5 + s0 * 0.5); }
        if (o.bottomCap && rb > 0.001) { for (const k of [[0, 0], [c0 * rb, s0 * rb], [c1 * rb, s1 * rb]]) { P3.push(k[0], 0, k[1]); N3.push(0, -1, 0); } U.push(0.5, 0.5, 0.5 + c0 * 0.5, 0.5 + s0 * 0.5, 0.5 + c1 * 0.5, 0.5 + s1 * 0.5); }
      }
      this._push(this._bk(mat, cx, cz, o), P3, N3, U, this._mat(cx, y0, cz, o), o.tint, o.bake, o.wear); return this;
    }
    // torus-ring (rørbøjning/ringe på tanke) i XZ-planet: radius R, tykkelse r
    ring(mat, cx, cy, cz, R, r, o) {
      o = o || {}; const seg = o.seg || 24, rs = o.rseg || 6, P3 = [], N3 = [], U = [];
      const pt = (i, j) => { const a = i / seg * Math.PI * 2, b = j / rs * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b); return [[(R + r * cb) * ca, r * sb, (R + r * cb) * sa], [cb * ca, sb, cb * sa]]; };
      for (let i = 0; i < seg; i++) for (let j = 0; j < rs; j++) {
        const q = [pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)];
        for (const k of [0, 2, 1, 0, 3, 2]) { P3.push(...q[k][0]); N3.push(...q[k][1]); U.push(k === 1 || k === 2 ? 1 : 0, k >= 2 ? 1 : 0); }
      }
      this._push(this._bk(mat, cx, cz, o), P3, N3, U, this._mat(cx, cy, cz, o), o.tint, o.bake, o.wear); return this;
    }
    // ellipsoid (sx,sy,sz = radier)
    sphere(mat, cx, cy, cz, sx, sy, sz, o) {
      o = o || {}; const ws = o.seg || 8, hs = Math.max(4, ws - 2), P3 = [], N3 = [], U = [], top = o.half ? hs / 2 : hs;
      const pt = (i, j) => { const th = j / hs * Math.PI, ph = i / ws * Math.PI * 2; return [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]; };
      for (let j = 0; j < top; j++) for (let i = 0; i < ws; i++) {
        const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1), uv = [[i / ws, 1 - j / hs], [(i + 1) / ws, 1 - j / hs], [(i + 1) / ws, 1 - (j + 1) / hs], [i / ws, 1 - (j + 1) / hs]], pts = [a, b, c, d];
        for (const k of [0, 1, 2, 0, 2, 3]) { P3.push(pts[k][0] * sx, pts[k][1] * sy, pts[k][2] * sz); N3.push(pts[k][0] / sx, pts[k][1] / sy, pts[k][2] / sz); U.push(uv[k][0], uv[k][1]); }
      }
      this._push(this._bk(mat, cx, cz, o), P3, N3, U, this._mat(cx, cy, cz, o), o.tint, o.bake, o.wear); return this;
    }
    // rør mellem to punkter (cylinder langs vilkårlig akse)
    tube(mat, a, b, r, o) {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz); if (L < 1e-4) return this;
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / L, dy / L, dz / L));
      return this.cyl(mat, a[0], a[1], a[2], r, (o && o.r1) || r, L, Object.assign({ seg: 8, caps: false }, o || {}, { quat: q }));
    }
    // frit firkant (kort) fra 4 verdenspunkter; uv 0..1 (v=0 nederst) – bruges til blade, skilte, mærkninger
    card(mat, p0, p1, p2, p3, o) {
      o = o || {}; const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2], vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      if (o.up) { nx = 0; ny = 1; nz = 0; }                                      // blade lyses som "opad" => ensartet, blød skygge
      const cxp = (p0[0] + p2[0]) / 2, cyp = (p0[1] + p2[1]) / 2, czp = (p0[2] + p2[2]) / 2;
      const b = this._bk(mat, cxp, czp, o), t = o.tint || WHITE, v0 = o.v0 || 0, v1 = o.v1 === undefined ? 1 : o.v1, u0 = o.u0 || 0, u1 = o.u1 === undefined ? 1 : o.u1;
      const uv = o.flip ? [u1, v0, u0, v0, u0, v1, u1, v0, u0, v1, u1, v1] : [u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1];
      const bk = o.bake || bakeProbe(cxp + nx * 0.1, cyp + ny * 0.1, czp + nz * 0.1, ny);
      const i0 = b.pos.length;
      let k = 0; for (const p of [p0, p1, p2, p0, p2, p3]) { b.pos.push(p[0], p[1], p[2]); b.nor.push(nx, ny, nz); b.col.push(t[0], t[1], t[2]); b.uv.push(uv[k++], uv[k++]); b.bake.push(bk[0], bk[1], bk[2], bk[3]); }
      this._wear(b, i0, o.wear || [-1e3, -1e3, 0]);                                // kort (blade, skilte, decals): intet vejrlig
      this.count += 2; if (QA) this._qa(b, i0); return this;
    }
    // frie trekanter med eksplicitte UV'er: pts = [[x,y,z]×3n], uvs = [[u,v]×3n] (normal pr. trekant, vinding mod uret set forfra)
    tris(mat, pts, uvs, o) {
      o = o || {}; let cx = 0, cz = 0; for (const p of pts) { cx += p[0]; cz += p[2]; } cx /= pts.length; cz /= pts.length;
      const b = this._bk(mat, cx, cz, o), t = o.tint || WHITE, i0 = b.pos.length;
      for (let i = 0; i < pts.length; i += 3) {
        const a = pts[i], c = pts[i + 1], d = pts[i + 2], ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        const bk = o.bake || bakeProbe((a[0] + c[0] + d[0]) / 3 + nx * 0.2, (a[1] + c[1] + d[1]) / 3 + ny * 0.2, (a[2] + c[2] + d[2]) / 3 + nz * 0.2, ny);
        for (let k = 0; k < 3; k++) { const p = pts[i + k], q = uvs[i + k]; b.pos.push(p[0], p[1], p[2]); b.nor.push(nx, ny, nz); b.col.push(t[0], t[1], t[2]); b.uv.push(q[0], q[1]); b.bake.push(bk[0], bk[1], bk[2], bk[3]); }
      }
      this._wear(b, i0, o.wear);
      this.count += pts.length / 3; if (QA) this._qa(b, i0); return this;
    }
    build(group, lodList) {
      const g = group || new THREE.Group();
      for (const b of this.map.values()) {
        if (!b.pos.length) continue;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
        geo.setAttribute('bake', new THREE.Float32BufferAttribute(b.bake, 4)); geo.setAttribute('wear', new THREE.Float32BufferAttribute(b.wear, 3));
        geo.computeBoundingSphere();
        const mesh = new THREE.Mesh(geo, b.mat); mesh.castShadow = this.shadow && !!b.sh && !b.lod && !b.mat.userData.noShadow; mesh.receiveShadow = !b.mat.userData.noReceive;   // småt detaljelag kaster ikke skygge (færre draw calls)
        if (b.lod) { mesh.userData.detail = true; if (lodList) lodList.push(mesh); }
        if (b.tag) mesh.userData.tag = b.tag;
        g.add(mesh);
      }
      return g;
    }
  }

  /* ------------------------------------------------------------ tema (tekstursæt, lys, props, dekor) */
  const themes = createThemes({ THREE, W, WD, P, mkTex, mat, pbrMat, unlit, dynMat, leafMat, Batch, rnd, hash2, col, clamp, timeU, canvasTexture, maxAniso, one, insideSolid, assets: assets || null });
  theme = (themes[W.id] || themes.white_dust)();
  addLamps(theme.lamps || []);
  {                                                                 // temaets vejrlig -> fælles uniforms
    const w = theme.weather || {}, v3 = (u, a) => { if (a) u.value.set(a[0], a[1], a[2]); };
    WU.uMacro.value = w.macro || 0; v3(WU.uMacroCol, w.macroCol || [1, 1, 1]);
    WU.uGrimeH.value = w.grimeH || 0.8; WU.uGrimeAmt.value = w.grime || 0; v3(WU.uGrimeCol, w.grimeCol);
    WU.uStreakAmt.value = w.streak || 0; WU.uStreakLen.value = w.streakLen || 3; v3(WU.uStreakCol, w.streakCol);
    WU.uTopAmt.value = w.top || 0; WU.uTopThr.value = w.topThr === undefined ? 0.55 : w.topThr; v3(WU.uTopCol, w.topCol); WU.uTopRough.value = w.topRough === undefined ? 0.95 : w.topRough;
    WU.uWetY.value = w.wetY === undefined ? -1e4 : w.wetY; WU.uWetAmt.value = w.wet || 0;
  }
  const gy = (x, z, y) => { const g = WD.groundAt(W, x, z, y === undefined ? 1.6 : y, 0.6); return g === -Infinity ? 0 : g; };

  /* ============================================================ verdensmesh ============================================================ */
  function floorLevels() {
    const s = new Set();
    for (const L of W.layers) for (const k in L.tiles) { const t = L.tiles[k]; if (t.floor !== undefined) s.add(+(t.floor + (t.sill || 0)).toFixed(3)); }
    for (const b of W.boxes) if (b.kind === 'slab' || b.kind === 'grate' || b.kind === 'roofslab' || b.kind === 'stone' || b.kind === 'platform') s.add(+b.y1.toFixed(3));
    if (W.data) for (const b of W.boxes) if (b.kind === 'floor' && (b.x1 - b.x0) * (b.z1 - b.z0) > 6) s.add(+b.y1.toFixed(3));   // v12.1: banen er bygget af gulvbokse (Nuke fra STL)
    return [...s].sort((a, b) => a - b);
  }
  // v15: forfattet bane (de_havn): grafikken kommer færdig fra Blender (bagt lysmap/vertex-lys); motoren lægger kun skyggekaskaden på
  function buildAuthored(H) {
    const seen = new Set();
    H.group.traverse(o => {
      const m = o.material; if (!m || seen.has(m)) return; seen.add(m);
      const prev = m.onBeforeCompile; m.onBeforeCompile = (sh, r) => { patchCSM(sh); if (prev) prev(sh, r); };
      const key = m.customProgramCacheKey ? m.customProgramCacheKey() : ''; m.customProgramCacheKey = () => 'csm' + key;
      m.userData.pbr = m.userData.pbr || { rough: m.roughness, metal: m.metalness, scanned: true };
    });
    H.group.userData.tris = H.tris; H.group.userData.bakeN = 0; H.group.userData.authored = true;
    return H.group;
  }
  function buildWorldMesh() {
    if (!probes) buildProbes();
    if (theme.authored && assets && assets.havn) return buildAuthored(assets.havn);
    const B = new Batch(32), FL = floorLevels(), minFloor = FL[0], cache = new Map(), BEV = theme.bevel || 0;
    const wearCache = new Map(); let wtop = WALL_TOP;              // murkronen for den boks der bygges lige nu (regnløb hænger herfra)
    const lowest = minFloor - 0.45;
    const cellsH = (a0, a1) => { const s = [a0]; for (let a = Math.floor(a0 / 2) * 2 + 2; a < a1 - 0.05; a += 2) if (a > a0 + 0.05) s.push(a); s.push(a1); return s; };
    const cellsV = (y0, y1) => { const s = new Set([y0, y1]); for (let y = Math.ceil(y0 + 0.05); y < y1 - 0.05; y++) s.add(y); for (const f of FL) { for (const d of [0, 0.25]) if (f + d > y0 + 0.05 && f + d < y1 - 0.05) s.add(f + d); } for (const f of (theme.splitY || [])) if (f > y0 + 0.05 && f < y1 - 0.05) s.add(f); return [...s].sort((a, b) => a - b); };
    const bakeV = (x, y, z, n, cx, cy, cz) => {
      const k = Math.round(x * 50) + ',' + Math.round(y * 50) + ',' + Math.round(z * 50) + ',' + n[0] + n[1] + n[2];
      let v = cache.get(k); if (!v) { v = bakeSurface(x, y, z, n[0], n[1], n[2], cx, cy, cz); cache.set(k, v); } return v;
    };
    // én celle (4 hjørner, mod uret set udefra) – UV i verdenskoordinater
    function quad(s, p, n, cx, cy, cz) {
      const m = s.m, t = s.t || WHITE, u = s.uvs || 2, bk = B._bk(m, cx, cz, s);
      // vinding ud fra quad'ens diagonaler (robust når en kant er degenereret, fx rampesider der ender i en spids)
      const e1 = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]], e2 = [p[3][0] - p[1][0], p[3][1] - p[1][1], p[3][2] - p[1][2]];
      const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const order = (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2]) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
      const ax = Math.abs(n[0]) > 0.5, ay = Math.abs(n[1]) > 0.7;
      // vejrlig: gulvniveauet under cellens bund (lodrette flader) og murkronen (boksens top)
      //   (gulvet måles 0,3 m foran fladen – ikke 'nærmeste gulvniveau', ellers gentages fodsmudset på hver etagehøjde)
      const ymin = Math.min(p[0][1], p[1][1], p[2][1], p[3][1]), wk = ymin + '|' + cx.toFixed(1) + '|' + cz.toFixed(1) + '|' + n[0] + n[2];
      let fl = wearCache.get(wk);
      if (fl === undefined) { fl = ay ? ymin - 50 : WD.groundAt(W, cx + n[0] * 0.3, cz + n[2] * 0.3, ymin + 0.05, 0.25); if (fl === -Infinity) fl = ymin - 50; wearCache.set(wk, fl); }
      const wr = [fl, s.top !== undefined ? s.top : wtop, s.wear === undefined ? 1 : s.wear];
      for (const i of order) {
        const q = p[i], bv = bakeV(q[0], q[1], q[2], n, cx, cy, cz);
        const uu = ay ? q[0] : ax ? q[2] * (n[0] > 0 ? -1 : 1) : q[0] * (n[2] < 0 ? -1 : 1), vv = ay ? q[2] : q[1];
        bk.pos.push(q[0], q[1], q[2]); bk.nor.push(n[0], n[1], n[2]); bk.col.push(t[0], t[1], t[2]); bk.uv.push(uu / u + (s.uo || 0), vv / u + (s.vo || 0)); bk.bake.push(bv[0], bv[1], bv[2], bv[3]); bk.wear.push(wr[0], wr[1], wr[2]);
      }
      B.count += 2;
    }
    // skjult hvis 5 prøvepunkter lige uden for cellen alle er inde i massiv struktur
    const hidden = (pts, n) => pts.every(q => insideSolid(q[0] + n[0] * 0.03, q[1] + n[1] * 0.03, q[2] + n[2] * 0.03, true));
    const inset = (a, b, f) => a + (b - a) * f;
    function face(b, n, A0, A1, B0, B1, fixed) {
      // A = første fri akse, B = anden; fixed = koordinat på normal-aksen
      const isTop = n[1] > 0, isBot = n[1] < 0, vert = !isTop && !isBot;
      const as = cellsH(A0, A1), bs = vert ? cellsV(B0, B1) : cellsH(B0, B1);
      const P = (a, c) => isTop || isBot ? [a, fixed, c] : (n[0] !== 0 ? [fixed, c, a] : [a, c, fixed]);
      const Ah = n[0] !== 0 ? [0, 0, 1] : [1, 0, 0];
      const bevOk = BEV > 0 && vert && (b.y1 >= WALL_TOP - 0.01 || b.y1 - Math.max(b.y0, lowest) > 1.2) && (theme.bevelKinds || { wall: 1 })[b.kind];   // v13: også lavere mure (Nuke fra STL, Ancient)
      for (let i = 0; i < as.length - 1; i++) for (let j = 0; j < bs.length - 1; j++) {
        const a0 = as[i], a1 = as[i + 1], c0 = bs[j], c1 = bs[j + 1];
        let qa0 = a0, qa1 = a1, arcs = null;
        const ca = (a0 + a1) / 2, cc = (c0 + c1) / 2, ctr = P(ca, cc);
        const smp = [ctr, P(inset(a0, a1, 0.08), inset(c0, c1, 0.08)), P(inset(a0, a1, 0.92), inset(c0, c1, 0.08)), P(inset(a0, a1, 0.92), inset(c0, c1, 0.92)), P(inset(a0, a1, 0.08), inset(c0, c1, 0.92))];
        if (hidden(smp, n)) continue;
        const s = theme.surf(b.kind, isTop ? 'top' : isBot ? 'bottom' : 'side', b, ctr[0], ctr[1], ctr[2], n, c0, c1);
        if (!s) continue;
        // v11: afrundede konvekse murhjørner (kvart-cylinder, radius BEV) – kun hvor hjørnet står frit (begge flader synlige, ingen mur fortsætter)
        if (bevOk && a1 - a0 > BEV * 2.5) for (const isA0 of [true, false]) {
          if (isA0 ? i !== 0 : i !== as.length - 2) continue;
          const dOut = isA0 ? -1 : 1, E = P(isA0 ? A0 : A1, cc), t = [Ah[0] * dOut, 0, Ah[2] * dOut], e = 0.06;
          const free = (u, v) => !insideSolid(E[0] + t[0] * u + n[0] * v, cc, E[2] + t[2] * u + n[2] * v, false);
          if (!free(e, -e) || !free(-e, e) || !free(e, e)) continue;
          if (isA0) qa0 = a0 + BEV; else qa1 = a1 - BEV;
          if (n[0] !== 0) (arcs || (arcs = [])).push([E, t]);                // buen tegnes én gang (fra x-fladen)
        }
        quad(s, [P(qa0, c0), P(qa1, c0), P(qa1, c1), P(qa0, c1)], n, ctr[0], ctr[1], ctr[2]);
        if (arcs) for (const [E, t] of arcs) {
          const ox = E[0] - n[0] * BEV - t[0] * BEV, oz = E[2] - n[2] * BEV - t[2] * BEV, SEG = BEV > 0.1 ? 5 : 3;
          const at = (th, y) => [ox + BEV * (Math.cos(th) * n[0] + Math.sin(th) * t[0]), y, oz + BEV * (Math.cos(th) * n[2] + Math.sin(th) * t[2])];
          for (let k = 0; k < SEG; k++) {
            const ta = k / SEG * Math.PI / 2, tb = (k + 1) / SEG * Math.PI / 2, tm = (ta + tb) / 2, nm = [Math.cos(tm) * n[0] + Math.sin(tm) * t[0], 0, Math.cos(tm) * n[2] + Math.sin(tm) * t[2]];
            const pm = at(tm, cc); quad(s, [at(ta, c0), at(tb, c0), at(tb, c1), at(ta, c1)], nm, pm[0], cc, pm[2]);
          }
        }
        // fodliste langs væggens fod (hvor der står et gulv lige foran)
        if (vert && s.trim !== false && theme.trim && FL.some(f => Math.abs(f - c0) < 1e-3)) {
          const o = [ctr[0] + n[0] * 0.2, c0, ctr[2] + n[2] * 0.2];
          if (insideSolid(o[0], c0 - 0.05, o[2], true) && !insideSolid(o[0], c0 + 0.1, o[2], false)) {
            const tr = theme.trim(b.kind, b, c0); if (tr) {
              const h = tr.h || 0.2, d = tr.d || 0.03, off = [n[0] * d, 0, n[2] * d];
              const q0 = P(qa0, c0), q1 = P(qa1, c0);
              const f0 = [q0[0] + off[0], c0, q0[2] + off[2]], f1 = [q1[0] + off[0], c0, q1[2] + off[2]];
              quad(tr, [f0, f1, [f1[0], c0 + h, f1[2]], [f0[0], c0 + h, f0[2]]], n, ctr[0], c0 + h / 2, ctr[2]);
              quad(tr, [[f0[0], c0 + h, f0[2]], [f1[0], c0 + h, f1[2]], [q1[0], c0 + h, q1[2]], [q0[0], c0 + h, q0[2]]], [0, 1, 0], ctr[0], c0 + h, ctr[2]);
            }
          }
        }
      }
    }
    for (const b of W.boxes) {
      if (!theme.surfKinds[b.kind]) continue;
      const y0 = Math.max(b.y0, lowest), y1 = b.y1;
      if (y1 - y0 < 0.005) continue;
      wtop = y1;
      if (y1 < WALL_TOP - 0.01) face(b, [0, 1, 0], b.x0, b.x1, b.z0, b.z1, y1);
      if (b.y0 > lowest + 0.01) face(b, [0, -1, 0], b.x0, b.x1, b.z0, b.z1, b.y0);
      face(b, [1, 0, 0], b.z0, b.z1, y0, y1, b.x1); face(b, [-1, 0, 0], b.z0, b.z1, y0, y1, b.x0);
      face(b, [0, 0, 1], b.x0, b.x1, y0, y1, b.z1); face(b, [0, 0, -1], b.x0, b.x1, y0, y1, b.z0);
    }
    // ramper: hældende flade + sider (skjulte sider fjernes)
    for (const r of W.ramps) {
      wtop = Math.max(r.ya, r.yb);
      const axisX = r.axis === 'x', h = a => WD.rampHeight(r, a), sl = (r.yb - r.ya) / (r.a1 - r.a0);
      const n = axisX ? [-sl, 1, 0] : [0, 1, -sl], l = Math.hypot(n[0], n[1], n[2]); n[0] /= l; n[1] /= l; n[2] /= l;
      const as = cellsH(r.a0, r.a1), ws = cellsH(r.w0, r.w1);
      const P = (a, w) => axisX ? [a, h(a), w] : [w, h(a), a];
      for (let i = 0; i < as.length - 1; i++) for (let j = 0; j < ws.length - 1; j++) {
        const c = P((as[i] + as[i + 1]) / 2, (ws[j] + ws[j + 1]) / 2), s = theme.surf('ramp', 'top', r, c[0], c[1], c[2], n);
        if (s) quad(s, [P(as[i], ws[j]), P(as[i + 1], ws[j]), P(as[i + 1], ws[j + 1]), P(as[i], ws[j + 1])], n, c[0], c[1], c[2]);
      }
      for (const [w, sgn] of [[r.w0, -1], [r.w1, 1]]) {
        const sn = axisX ? [0, 0, sgn] : [sgn, 0, 0];
        for (let i = 0; i < as.length - 1; i++) {
          const a0 = as[i], a1 = as[i + 1], am = (a0 + a1) / 2, yc = (r.yBottom + h(am)) / 2;
          const q = (a, y) => axisX ? [a, y, w] : [w, y, a];
          if (insideSolid(q(am, yc)[0] + sn[0] * 0.03, yc, q(am, yc)[2] + sn[2] * 0.03, true)) continue;
          const s = theme.surf('wall', 'side', r, q(am, yc)[0], yc, q(am, yc)[2], sn); if (!s) continue;
          quad(s, [q(a0, r.yBottom), q(a1, r.yBottom), q(a1, h(a1)), q(a0, h(a0))], sn, q(am, yc)[0], yc, q(am, yc)[2]);
        }
      }
    }
    const g = new THREE.Group(); B.build(g); g.userData.tris = B.count; g.userData.bakeN = cache.size; return g;
  }

  /* ============================================================ dekor: props, cylindre, stiger, gelændere, vegetation, lamper ============================================================ */
  function buildDecor() {
    if (theme.authored) { const g = new THREE.Group(); g.userData.lod = []; g.userData.tris = 0; g.userData.decals = 0; return g; }
    if (!probes) buildProbes();
    QA = (typeof globalThis !== 'undefined' && globalThis.__WDQA) || null;
    const B = new Batch(32), rng = rnd(1234 + W.id.length);
    const solidAt = (x, y, z, m) => { const cs = WD.query(W, x - m, z - m, x + m, z + m); return cs.some(c => !c.r && x > c.x0 - m && x < c.x1 + m && z > c.z0 - m && z < c.z1 + m && y > c.y0 - m && y < c.y1 + m); };
    const ctx = { B, W, WD, rng, gy, solidAt, insideSolid, probe, bakeProbe, tris: 0, extra: [] };   // extra: temaets ekstra batches (fx skybox-ring med store celler)
    // v11.2: fotoscannede 3D-modeller (glTF). Temaet placerer instanser; de tegnes som InstancedMesh pr. (model-del, 32 m-celle)
    //   med bagt lys (lys-probe) pr. instans – så en model i et mørkt rum er mørk, og en i solen er lys.
    const MODELS = (assets && assets.models) || {}, inst = [];
    const partsOf = (name, part) => { const m = MODELS[name]; if (!m) return null; return part ? m.parts[part] : m.all; };
    const boxOf = (name, part) => { const ps = partsOf(name, part); if (!ps) return null; const b = new THREE.Box3(); for (const p of ps) { p.geo.computeBoundingBox(); b.union(p.geo.boundingBox); } return b; };
    ctx.hasModel = name => !!MODELS[name];
    ctx.modelParts = name => MODELS[name] ? Object.keys(MODELS[name].parts) : [];
    ctx.modelBox = boxOf;
    // fri placering: (x,y,z) = fodpunkt, yaw, s = skala (tal eller [sx,sy,sz]); modellens bund lægges på y, centreret i xz
    ctx.model = (name, part, x, y, z, yaw, s, o) => {
      const bx = boxOf(name, part); if (!bx) return false;
      const S = Array.isArray(s) ? s : [s, s, s], cx = (bx.min.x + bx.max.x) / 2, cz = (bx.min.z + bx.max.z) / 2;
      inst.push({ name, part, x, y, z, yaw: yaw || 0, S, off: [-cx, -bx.min.y, -cz], o: o || {} });
      return true;
    };
    // passer en model ind i en kollisionsboks (proportionerne bevares; længste side langs boksens længste side)
    ctx.modelInBox = (name, part, b, o) => {
      const bx = boxOf(name, part); if (!bx) return false;
      const w = b.x1 - b.x0, d = b.z1 - b.z0, H = b.y1 - b.y0, mw = bx.max.x - bx.min.x, md = bx.max.z - bx.min.z, mh = bx.max.y - bx.min.y;
      const rot = (w >= d) !== (mw >= md), fw = rot ? md : mw, fd = rot ? mw : md, k = (o && o.fill) || 0.98;
      const s = Math.min(w * k / fw, d * k / fd, H / mh);
      return ctx.model(name, part, (b.x0 + b.x1) / 2, b.y0, (b.z0 + b.z1) / 2, (rot ? Math.PI / 2 : 0) + ((o && o.yaw) || 0), (o && o.stretchY) ? [s, H / mh, s] : s, o);
    };
    for (const b of W.boxes) {
      if (b.kind === 'prop') theme.dressProp(B, b, hash2((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2), ctx);
      else if (b.kind === 'rail' && theme.dressRail) theme.dressRail(B, b, ctx);
      else if (b.kind === 'glass' && theme.dressGlass) theme.dressGlass(B, b, ctx);
      else if (b.kind === 'stone' && b.stair && theme.dressStair) theme.dressStair(B, b, ctx);
      else if (b.kind === 'steelstairs' && theme.dressStair) theme.dressStair(B, b, ctx);
    }
    for (const c of W.cyls) theme.dressCyl(B, c, ctx);
    for (const l of W.ladders) theme.dressLadder(B, l, ctx);
    for (const L of lamps) if (theme.dressLamp) theme.dressLamp(B, L, ctx);
    theme.decor(ctx);
    const group = new THREE.Group(), lod = [];
    B.build(group, lod);
    let tris = B.count; for (const xb of ctx.extra) { xb.build(group, lod); tris += xb.count; }
    tris += buildInstances(inst, partsOf, group, lod);
    if (QA) {                                                         // instancede modeller: drejet bounding-box i verden
      for (const it of inst) { const bx = boxOf(it.name, it.part); if (!bx) continue; const c = Math.cos(it.yaw), s = Math.sin(it.yaw); let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (const px of [bx.min.x, bx.max.x]) for (const pz of [bx.min.z, bx.max.z]) { const lx = (px + it.off[0]) * it.S[0], lz = (pz + it.off[2]) * it.S[2], wx = it.x + lx * c + lz * s, wz = it.z - lx * s + lz * c; x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); z0 = Math.min(z0, wz); z1 = Math.max(z1, wz); }
        QA.push({ x0, y0: it.y, z0, x1, y1: it.y + (bx.max.y - bx.min.y) * it.S[1], z1, mat: 'model:' + it.name, tag: 'model' }); }
      QA = null;
    }
    group.userData.lod = lod; group.userData.tris = tris; group.userData.decals = ctx.decals || 0;
    return group;
  }

  /* ---- v11.2: instancede glTF-modeller ---- */
  const modelMatCache = new Map();
  function modelMat(spec) {
    if (modelMatCache.has(spec)) return modelMatCache.get(spec);
    const m = new THREE.MeshStandardMaterial({
      map: spec.map, normalMap: spec.normal, roughnessMap: spec.orm, metalnessMap: spec.orm, aoMap: spec.ao,
      color: new THREE.Color(spec.color[0], spec.color[1], spec.color[2]), roughness: spec.rough, metalness: spec.metal,
      side: spec.double ? THREE.DoubleSide : THREE.FrontSide, alphaTest: spec.alpha === 'MASK' ? spec.cutoff : 0
    });
    if (spec.glass) { m.transparent = true; m.opacity = 0.35; m.depthWrite = false; m.roughness = 0.08; m.metalnessMap = null; m.roughnessMap = null; m.metalness = 0; }
    else if (spec.alpha === 'BLEND') { m.transparent = true; m.depthWrite = false; }
    if (spec.emissiveMap || spec.emissive.some(v => v > 0)) { m.emissive.setRGB(spec.emissive[0], spec.emissive[1], spec.emissive[2]); m.emissiveMap = spec.emissiveMap; m.emissiveIntensity = Math.min(6, Math.max(1.5, spec.emissiveStrength)); }
    m.userData.pbr = { rough: spec.rough * 0.8, metal: spec.metal * 0.6, scanned: true };
    m.userData.model = true;
    withBake(m, false);
    modelMatCache.set(spec, m);
    return m;
  }
  const _ic = new THREE.Color(), _im = new THREE.Matrix4(), _iq = new THREE.Quaternion(), _ip = new THREE.Vector3(), _is = new THREE.Vector3(), _io = new THREE.Matrix4(), _iy = new THREE.Vector3(0, 1, 0);
  // v14: tunge modeller (en del > LOD_TRIS trekanter) får en grov afstandsversion af hver del (clusterLOD). Alle instanser af en tung model ligger
  //   i ÉN nær- og ÉN fjern-InstancedMesh pr. del for hele banen (2 draw calls i stedet for én pr. 32 m-celle); updateLodSets() fordeler
  //   instanserne efter deres egen afstand og kopierer matricer/bagt lys/farve ind i de to buffere. Detalje-modeller skjules bag detailDist.
  const LOD_TRIS = 1200, LOD_NEAR = 16, triCount = g => (g.index ? g.index.count : g.attributes.position.count) / 3;
  const farOf = p => { if (p.far === undefined) { const g = clusterLOD(THREE, p.geo, 12); p.far = triCount(g) < triCount(p.geo) * 0.6 ? g : null; } return p.far; };
  function buildInstances(list, partsOf, group, lodList) {
    if (!list.length) return 0;
    const heavy = new Map(), isHeavy = it => { const k = it.name + '|' + (it.part || ''); if (!heavy.has(k)) heavy.set(k, (partsOf(it.name, it.part) || []).some(p => triCount(p.geo) > LOD_TRIS)); return heavy.get(k); };
    const groups = new Map();                                                    // (model, del, celle, detail) -> instanser; tunge modeller: hele banen
    for (const it of list) { const k = it.name + '|' + (it.part || '') + '|' + (isHeavy(it) ? 'lod' : Math.floor(it.x / 32) + '|' + Math.floor(it.z / 32)) + '|' + (it.o.detail ? 1 : 0); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); }
    let tris = 0; const sets = group.userData.lodSets || (group.userData.lodSets = []);
    for (const items of groups.values()) {
      const f = items[0], parts = partsOf(f.name, f.part); if (!parts) continue;
      const n = items.length, bake = new Float32Array(n * 4), mats = new Float32Array(n * 16), tinted = items.some(q => q.o.tint), col = tinted ? new Float32Array(n * 3) : null;
      items.forEach((it, i) => {
        const b = bakeProbe(it.x, it.y + 0.4 * it.S[1] + 0.2, it.z, 0.6); bake.set([b[0], b[1], b[2], b[3]], i * 4);
        _io.makeTranslation(it.off[0], it.off[1], it.off[2]);
        _im.compose(_ip.set(it.x, it.y, it.z), _iq.setFromAxisAngle(_iy, it.yaw), _is.set(it.S[0], it.S[1], it.S[2])).multiply(_io); _im.toArray(mats, i * 16);
        if (col) { const t = it.o.tint || [1, 1, 1]; col.set(t, i * 3); }        // farve pr. instans (fx terracotta-glasur)
      });
      const shadow = f.o.shadow !== false && !f.o.detail;
      const mk = (geo, p, bakeAttr, im, ic) => {
        const mesh = new THREE.InstancedMesh(geo, modelMat(p.mat), n);
        mesh.geometry = geo.clone();                                             // egne attributter pr. gruppe (bagt lys pr. instans)
        mesh.geometry.setAttribute('bake', bakeAttr);
        if (im) mesh.instanceMatrix = im; else { mesh.instanceMatrix.array.set(mats); mesh.instanceMatrix.needsUpdate = true; }
        if (ic) mesh.instanceColor = ic; else if (col) { mesh.instanceColor = new THREE.InstancedBufferAttribute(col.slice(), 3); }
        mesh.castShadow = shadow; mesh.receiveShadow = true;
        mesh.userData.tag = 'model'; mesh.userData.modelName = f.name;
        group.add(mesh); return mesh;
      };
      if (!isHeavy(f)) {
        const bakeAttr = new THREE.InstancedBufferAttribute(bake, 4);
        for (const p of parts) {
          const mesh = mk(p.geo, p, bakeAttr, null, null); mesh.computeBoundingSphere();
          if (f.o.detail) { mesh.userData.detail = true; if (lodList) lodList.push(mesh); }
          tris += triCount(p.geo) * n;
        }
        continue;
      }
      // tung model: fælles buffere for alle dele (nær/fjern hver for sig); start med alt i fjern-versionen (også det statiske fjern-skyggekort)
      const buf = () => ({ im: new THREE.InstancedBufferAttribute(new Float32Array(n * 16), 16), bk: new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4), ic: col ? new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3) : null });
      const bb = new THREE.Box3(); for (const p of parts) { p.geo.computeBoundingBox(); bb.union(p.geo.boundingBox); } const rad = bb.getSize(new THREE.Vector3()).length() * 0.5 * Math.max(...f.S);
      const set = { n, pos: new Float32Array(items.flatMap(it => [it.x, it.y + 0.5, it.z])), mats, bake, col, rad, detail: !!f.o.detail, near: buf(), far: buf(), nearM: [], farM: [], sig: '' };
      for (const B2 of [set.near, set.far]) { B2.im.setUsage(THREE.DynamicDrawUsage); B2.bk.setUsage(THREE.DynamicDrawUsage); if (B2.ic) B2.ic.setUsage(THREE.DynamicDrawUsage); }
      fillLod(set, set.far, Array.from({ length: n }, (_, i) => i));
      let sphere = null;
      for (const p of parts) {
        const fm = mk(farOf(p) || p.geo, p, set.far.bk, set.far.im, set.far.ic); fm.count = n;
        if (!sphere) { fm.computeBoundingSphere(); sphere = fm.boundingSphere; } else fm.boundingSphere = sphere.clone();
        const nm = mk(p.geo, p, set.near.bk, set.near.im, set.near.ic); nm.count = 0; nm.visible = false; nm.boundingSphere = sphere.clone();
        set.farM.push(fm); set.nearM.push(nm);
        tris += triCount(p.geo) * n;
      }
      sets.push(set);
    }
    group.userData.instances = list.length;
    return tris;
  }

  function fillLod(set, B2, idx) {
    const im = B2.im.array, bk = B2.bk.array, ic = B2.ic ? B2.ic.array : null;
    idx.forEach((i, j) => { im.set(set.mats.subarray(i * 16, i * 16 + 16), j * 16); bk.set(set.bake.subarray(i * 4, i * 4 + 4), j * 4); if (ic) ic.set(set.col.subarray(i * 3, i * 3 + 3), j * 3); });
    B2.im.needsUpdate = true; B2.bk.needsUpdate = true; if (ic) B2.ic.needsUpdate = true;
  }
  function updateLodSets(sets, cam, D) {
    for (const set of sets) {
      const near = [], far = [];
      for (let i = 0; i < set.n; i++) { const d = Math.hypot(set.pos[i * 3] - cam.x, set.pos[i * 3 + 1] - cam.y, set.pos[i * 3 + 2] - cam.z) - set.rad; if (set.detail && d > D) continue; (d < LOD_NEAR ? near : far).push(i); }
      const sig = near.join(',') + '|' + (set.detail ? far.join(',') : far.length);
      if (sig === set.sig) continue; set.sig = sig;
      if (near.length) fillLod(set, set.near, near);
      fillLod(set, set.far, far);
      for (const m of set.nearM) { m.count = near.length; m.visible = near.length > 0; }
      for (const m of set.farM) { m.count = far.length; m.visible = far.length > 0; }
    }
  }

  /* ============================================================ døre: svinger op når en spiller nærmer sig (ikke-blokerende), lyd via callback ============================================================ */
  // v12.1: sammensmelt et dørblads mange små dele til ét mesh pr. materiale (dørene stod for ~100 draw calls på Nuke)
  function mergeLeaf(root) {
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), byMat = new Map();
    root.traverse(n => { if (!n.isMesh) return; const g = n.geometry.index ? n.geometry.toNonIndexed() : n.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, n.matrixWorld)); if (!byMat.has(n.material)) byMat.set(n.material, []); byMat.get(n.material).push(g); });
    const out = new THREE.Group();
    for (const [mat, list] of byMat) {
      let cnt = 0; for (const g of list) cnt += g.attributes.position.count;
      const sz = {}; for (const g of list) for (const k in g.attributes) if (!(k in sz)) sz[k] = g.attributes[k].itemSize;
      const geo = new THREE.BufferGeometry();
      for (const k in sz) {                                   // dele uden fx uv/farve får nuller (samme layout for alle)
        const isz = sz[k], arr = new Float32Array(cnt * isz); let off = 0;
        for (const g of list) { const a = g.attributes[k], c = g.attributes.position.count; if (a && a.itemSize === isz) arr.set(a.array.length === c * isz ? a.array : Float32Array.from({ length: c * isz }, (_, i) => a.getComponent ? a.getComponent(i / isz | 0, i % isz) : 0), off); off += c * isz; }
        geo.setAttribute(k, new THREE.BufferAttribute(arr, isz));
      }
      for (const g of list) g.dispose();
      geo.computeBoundingSphere(); out.add(new THREE.Mesh(geo, mat));
    }
    return out;
  }
  function buildDoors() {
    const group = new THREE.Group(), list = [];
    for (const d of W.doors) {
      const st = theme.doorStyle ? theme.doorStyle(d) : null; if (!st) continue;
      const leaves = d.double ? [[-1, d.w / 2], [1, d.w / 2]] : [[-1, d.w]];
      const pr = probe(d.x, d.y + 1.2, d.z), m = dynMat(st.matOpts);
      m.userData.uBake.value.set(pr[0], pr[1], pr[2], Math.max(0.1, pr[3]));
      const objs = [];
      for (const [side, w] of leaves) {
        const pivot = new THREE.Group();
        const hx = d.axis === 'x' ? d.x + side * d.w / 2 : d.x, hz = d.axis === 'x' ? d.z : d.z + side * d.w / 2;
        pivot.position.set(hx, d.y, hz);
        const leaf = mergeLeaf(st.build(w, d.h, m));   // dørblad i lokale koordinater: x fra 0 til w (fra hængslet mod midten) · v12.1: ét mesh pr. materiale
        if (side > 0) leaf.rotation.y = Math.PI;
        if (d.axis === 'z') pivot.rotation.y = -Math.PI / 2;
        leaf.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        pivot.add(leaf); group.add(pivot); objs.push({ pivot, side, base: pivot.rotation.y });
      }
      list.push({ d, objs, ang: 0, target: 0, dir: 1, idle: 0, opened: false });
    }
    // actors: [{x,y,z}] – åbner mod siden væk fra den nærmeste spiller
    function update(dt, actors, onOpen) {
      for (const D of list) {
        const d = D.d; let near = null, nd = 1.9;
        for (const a of actors) { if (Math.abs(a.y - d.y) > 1.5) continue; const dist = Math.hypot(a.x - d.x, a.z - d.z); if (dist < nd) { nd = dist; near = a; } }
        if (near) {
          if (D.target === 0) { const s = d.axis === 'x' ? Math.sign(near.z - d.z) : Math.sign(near.x - d.x); D.dir = s >= 0 ? -1 : 1; if (D.ang < 0.05 && onOpen) onOpen(d); }
          D.target = 1; D.idle = 0;
        } else { D.idle += dt; if (D.idle > 1.6) D.target = 0; }
        const sp = d.kind === 'squeaky' ? 2.2 : 3.2;
        D.ang += clamp(D.target - D.ang, -sp * dt, sp * dt);
        const e = D.ang * D.ang * (3 - 2 * D.ang);
        for (const o of D.objs) o.pivot.rotation.y = o.base + o.side * D.dir * e * 1.45 * (d.axis === 'x' ? 1 : -1);
      }
    }
    return { group, update, count: list.length };
  }

  /* ------------------------------------------------------------ effekter (damp, støv): leveres af temaet; returneres som {group, update(dt,t,cam)} */
  // v10 mikro-liv: (1) svævende støv/pollen i en kasse der 'wrapper' rundt om kameraet i vertex-shaderen (ingen CPU pr. frame),
  //   lysstyrken følger lys-proben ved kameraet (lyse gnister i solen udendørs, næsten usynlige i mørke rum);
  //   (2) kondens-dryp: dråber falder fra loftet med fast takt (fase pr. dryp) og forsvinder præcis ved gulvet.
  const dotTex = () => canvasTexture((c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }, 32, 32);
  function ambientMotes(group, ups) {
    const A = theme.ambient; if (!A) return;
    const N = A.count || 260, BOX = A.box || 16, R = rnd(4242), pos = new Float32Array(N * 3), ph = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos[i * 3] = R() * BOX; pos[i * 3 + 1] = R() * BOX * 0.5; pos[i * 3 + 2] = R() * BOX; ph[i] = R() * 6.283; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
    const U = { uCam: { value: new THREE.Vector3() }, uTime: timeU, uBox: { value: BOX }, uLit: { value: 1 }, uCol: { value: new THREE.Color(A.color || 0xfff0d0) }, uSize: { value: A.size || 0.035 }, uAlpha: { value: A.alpha || 0.35 }, uWind: { value: new THREE.Vector3(...(A.wind || [0.25, 0.04, 0.1])) }, map: { value: dotTex() } };
    const m = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: `attribute float aPh; uniform vec3 uCam, uWind; uniform float uTime, uBox, uSize; varying float vA;
        void main() {
          vec3 half3 = vec3(uBox * 0.5, uBox * 0.25, uBox * 0.5), box = vec3(uBox, uBox * 0.5, uBox);
          vec3 p = position + uWind * uTime + vec3(sin(uTime * 0.4 + aPh), sin(uTime * 0.3 + aPh * 1.7) * 0.6, cos(uTime * 0.35 + aPh)) * 0.25;
          p = uCam + mod(p - uCam + half3, box) - half3;
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
          float d = -mv.z; gl_PointSize = clamp(uSize * projectionMatrix[1][1] * 540.0 / max(d, 0.1), 1.0, 6.0);
          vec3 e = abs(p - uCam) / half3; vA = smoothstep(0.3, 0.9, d) * (1.0 - smoothstep(0.6, 1.0, max(e.x, max(e.y, e.z)))) * (0.55 + 0.45 * sin(uTime * 1.3 + aPh * 3.0));
        }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 uCol; uniform float uLit, uAlpha; varying float vA; void main() { float a = texture2D(map, gl_PointCoord).a * vA * uAlpha * uLit; if (a < 0.003) discard; gl_FragColor = vec4(uCol * a, a); }` });
    const pts = new THREE.Points(geo, m); pts.frustumCulled = false; pts.renderOrder = 5; group.add(pts);
    const pr = [0, 0, 0, 0];
    ups.push((dt, t, cam) => { U.uCam.value.set(cam.x, cam.y, cam.z); probe(cam.x, cam.y, cam.z, pr); const lit = clamp(Math.pow(pr[3], 1.5) + (pr[0] + pr[1] + pr[2]) * 0.15, 0.05, 1); U.uLit.value += (lit - U.uLit.value) * Math.min(1, dt * 2); });
  }
  function drips(group) {
    const list = (theme.drips || []).filter(d => d[1] - d[3] > 0.4); if (!list.length) return;
    const N = list.length, pos = new Float32Array(N * 3), dd = new Float32Array(N * 3);
    list.forEach((d, i) => { pos[i * 3] = d[0]; pos[i * 3 + 1] = d[1]; pos[i * 3 + 2] = d[2]; dd[i * 3] = d[1] - d[3]; dd[i * 3 + 1] = 1.1 + hash2(d[0], d[2]) * 2.2; dd[i * 3 + 2] = hash2(d[2], d[0]) * 10; });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aD', new THREE.BufferAttribute(dd, 3));
    const m = new THREE.ShaderMaterial({ uniforms: { uTime: timeU, map: { value: dotTex() } }, transparent: true, depthWrite: false, fog: false,
      vertexShader: `attribute vec3 aD; uniform float uTime; varying float vA;
        void main() {
          float per = aD.y, t = mod(uTime + aD.z, per), hang = per - 0.55;         // dråben hænger og svulmer, falder så (g = 9,8)
          float fall = max(0.0, t - hang), y = 0.5 * 9.8 * fall * fall;
          vec3 p = position - vec3(0.0, min(y, aD.x), 0.0);
          vA = y < aD.x ? (t < hang ? smoothstep(0.0, hang, t) * 0.6 : 1.0) : 0.0;
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(0.03 * projectionMatrix[1][1] * 540.0 / max(-mv.z, 0.1), 1.0, 5.0);
        }`,
      fragmentShader: `uniform sampler2D map; varying float vA; void main() { float a = texture2D(map, gl_PointCoord).a * vA * 0.8; if (a < 0.01) discard; gl_FragColor = vec4(vec3(0.75, 0.85, 0.95) * 1.4, a); }` });
    const pts = new THREE.Points(geo, m); pts.frustumCulled = false; group.add(pts);
  }
  function buildFx() {
    const group = new THREE.Group(), ups = [];
    if (theme.fx) theme.fx({ group, ups, THREE, W, WD, rnd, gy, canvasTexture, timeU, probe });
    ambientMotes(group, ups); drips(group);
    return { group, update(dt, t, cam) { for (const u of ups) u(dt, t, cam); } };
  }
  // pr. frame: tid-uniform + afstands-LOD for småt detaljelag hvert 0,25 s
  let lodT = 0;
  function update(dt, t, cam, decorGroup) {
    timeU.value = t;
    lodT -= dt; if (lodT > 0 || !decorGroup) return; lodT = 0.25;
    const D = theme.detailDist || 60, list = decorGroup.userData.lod || [];
    for (const m of list) { const bs = m.isInstancedMesh ? m.boundingSphere : m.geometry.boundingSphere; if (!bs) continue; const d = Math.hypot(bs.center.x - cam.x, bs.center.y - cam.y, bs.center.z - cam.z) - bs.radius; const v = d < D; if (m.visible !== v) m.visible = v; }
    if (decorGroup.userData.lodSets) updateLodSets(decorGroup.userData.lodSets, cam, D);
  }

  /* ------------------------------------------------------------ himmel (kuppel der følger kameraet) */
  function buildSky(sunDir) {
    const S = theme.light.sky;
    if (theme.light.skyTex) {                                    // v11: fotograferet HDRI-himmel (lineær HDR → samme ACES som scenen → skærmfarve, alpha 0)
      const mh = new THREE.ShaderMaterial({
        uniforms: { hdr: { value: theme.light.skyTex }, uExp: { value: theme.light.skyExp || 1 }, gnd: { value: new THREE.Vector3(...S.gnd) }, yaw: { value: theme.light.skyYaw || 0 } },
        side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
        vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: [
          'varying vec3 vDir; uniform sampler2D hdr; uniform float uExp, yaw; uniform vec3 gnd;',
          'vec3 RRTAndODTFit(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }',
          'vec3 aces(vec3 color) { const mat3 IN = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));',
          '  const mat3 OUT = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));',
          '  color = IN * (color / 0.6); color = RRTAndODTFit(color); return clamp(OUT * color, 0.0, 1.0); }',
          'vec3 srgb(vec3 c) { return mix(c * 12.92, pow(c, vec3(0.41666)) * 1.055 - 0.055, step(0.0031308, c)); }',
          'void main() {',
          '  vec3 d = normalize(vDir);',
          '  vec2 uv = vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830988 + 0.5);',
          '  vec3 c = texture2D(hdr, uv).rgb;',
          '  c = mix(c, gnd * 0.6, smoothstep(0.0, -0.12, d.y));',           // under horisonten: diset jordfarve (skjules af banens mure)
          '  gl_FragColor = vec4(srgb(aces(c * uExp)), 0.0);',
          '}'
        ].join('\n')
      });
      const mm = new THREE.Mesh(new THREE.SphereGeometry(200, 48, 24), mh); mm.renderOrder = -1000; mm.frustumCulled = false; return mm;
    }
    const mat2 = new THREE.ShaderMaterial({
      uniforms: { sunDir: { value: sunDir.clone().normalize() }, hor: { value: new THREE.Vector3(...S.hor) }, mid: { value: new THREE.Vector3(...S.mid) }, top: { value: new THREE.Vector3(...S.top) }, gnd: { value: new THREE.Vector3(...S.gnd) }, sunCol: { value: new THREE.Vector3(...S.sun) }, uTime: timeU, cloud: { value: S.cloud === undefined ? 1 : S.cloud } },
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'varying vec3 vDir; uniform vec3 sunDir, hor, mid, top, gnd, sunCol; uniform float uTime, cloud;',
        'float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
        'float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }',
        'void main() {',
        '  vec3 d = normalize(vDir); float h = max(d.y, 0.0);',
        '  vec3 c = mix(hor, mid, smoothstep(0.0, 0.22, h)); c = mix(c, top, smoothstep(0.18, 0.85, h));',
        '  c = mix(c, gnd, smoothstep(0.0, -0.3, d.y));',
        '  vec2 sp = d.xz / (d.y + 0.35) * 1.3 + vec2(uTime * 0.008, 0.0);',
        '  float cl = vn(sp * 2.0) * 0.55 + vn(sp * 4.3) * 0.3 + vn(sp * 9.0) * 0.15; cl = smoothstep(0.5, 0.86, cl) * smoothstep(0.02, 0.25, d.y) * cloud;',
        '  float s = max(dot(d, normalize(sunDir)), 0.0);',
        '  c = mix(c, mix(c, sunCol * 1.05 + 0.18, 0.6), cl * (0.45 + 0.55 * pow(s, 3.0)));',
        '  c += sunCol * pow(s, 6.0) * 0.35 + sunCol * pow(s, 60.0) * 0.5 + vec3(1.0, 0.95, 0.85) * pow(s, 900.0) * 2.5;',
        '  gl_FragColor = vec4(c, 0.0);',          // alpha 0 = himmel (post-processing: ingen AO/tonemapping – farven er allerede i skærmrum)
        '}'
      ].join('\n')
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), mat2); m.renderOrder = -1000; m.frustumCulled = false; return m;
  }

  return { buildWorldMesh, buildDecor, buildDoors, buildFx, buildSky, update, theme, probe, buildProbes, dynMat, withBake, insideSolid, weather: WU };
}
