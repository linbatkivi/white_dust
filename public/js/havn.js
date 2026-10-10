// ==========================================================================
// de_havn – indlæsning af den forfattede bane (bygget i Blender af tools/havn/blender_build.py).
//   world.json + world.bin: meshes pr. (chunk × materiale) med kvantiserede positioner (uint16 i meshets kasse → mesh.scale/position),
//   normaler (int8), UV0 (verdens-UV i materialets virkelige mål), UV1 (lysmap) eller vertex-lys (uint8, gamma 2,2 × skala),
//   blend-vægte (snavs, mos, vådt). lightmaps.json: lysmap pr. chunk (PNG, gamma 2,2 × skala). tex/<id>_{d,n,a}.ktx2: Poly Haven-sæt.
// Lysmodel: lysmappet (= himmellys + alt tilbagekastet lys, bagt i Cycles) erstatter hemisfære/omgivelseslys for statisk geometri;
// den direkte sol er realtid (samme retning/styrke som i bagningen) – skarpe skygger, også fra spillere.
// ==========================================================================
import { KTX2Loader } from '/vendor/three-addons/loaders/KTX2Loader.js';

let ktx2 = null;
function ktx(THREE, renderer) {
  if (!ktx2) { ktx2 = new KTX2Loader(); ktx2.setTranscoderPath('/vendor/three-addons/libs/basis/'); ktx2.detectSupport(renderer); }
  return ktx2;
}

export async function loadHavn(THREE, renderer, base = '/assets/havn/', maxAniso = 8) {
  const meta = await fetch(base + 'world.json', { cache: 'no-cache' }).then(r => r.json()), V = '?v=' + (meta.build || 1);   // cache-busting pr. bagning
  const [bin, lms, sky] = await Promise.all([fetch(base + 'world.bin' + V).then(r => r.arrayBuffer()),
    fetch(base + 'lightmaps.json' + V).then(r => r.json()), fetch(base + 'sky.json' + V, { cache: 'no-cache' }).then(r => r.json())]);
  const K = ktx(THREE, renderer), texCache = new Map(), pngLoader = new THREE.TextureLoader();
  const tex = (id, kind) => {
    const key = id + '_' + kind; if (texCache.has(key)) return texCache.get(key);
    const p = K.loadAsync(base + 'tex/' + key + '.ktx2').then(t => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(8, maxAniso);
      t.colorSpace = kind === 'd' ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.needsUpdate = true; return t;
    }).catch(e => { console.warn('[havn] tekstur', key, e); return null; });
    texCache.set(key, p); return p;
  };
  const lmTex = new Map();
  const lightmap = name => {
    if (lmTex.has(name)) return lmTex.get(name);
    const L = lms.chunks[name]; if (!L || !L.lm) return Promise.resolve(null);
    const p = pngLoader.loadAsync(base + L.lm + V).then(t => { t.channel = 1; t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; });
    lmTex.set(name, p); return p;
  };
  // ---- geometri
  const meshes = [];
  for (const m of meta.meshes) {
    const g = new THREE.BufferGeometry(), o = m.off;
    g.setAttribute('position', new THREE.BufferAttribute(new Uint16Array(bin, o.pos, m.n * 3), 3, true));
    const nb = new THREE.InterleavedBuffer(new Int8Array(bin, o.nrm, m.n * 4), 4);
    g.setAttribute('normal', new THREE.InterleavedBufferAttribute(nb, 3, 0, true));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(bin, o.uv0, m.n * 2), 2));
    if (o.uv1 !== undefined) g.setAttribute('uv1', new THREE.BufferAttribute(new Uint16Array(bin, o.uv1, m.n * 2), 2, true));
    g.setAttribute('blend', new THREE.BufferAttribute(new Uint8Array(bin, o.blend, m.n * 4), 4, true));
    if (o.vlm !== undefined) g.setAttribute('vlm', new THREE.BufferAttribute(new Uint8Array(bin, o.vlm, m.n * 4), 4, true));
    g.setIndex(new THREE.BufferAttribute(m.i32 ? new Uint32Array(bin, o.idx, m.ni) : new Uint16Array(bin, o.idx, m.ni), 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    meshes.push({ m, g });
  }
  // ---- materialer (én pr. materiale × lysvariant × chunk-lysmap)
  const matCache = new Map(), MAT = meta.materials;
  async function material(m) {
    const lmName = m.lm, key = m.mat + '|' + (lmName || (m.vtx ? 'vtx' : m.kind)) + '|' + (m.vtx ? m.vscale.toFixed(4) : '');
    if (matCache.has(key)) return matCache.get(key);
    const d = MAT[m.mat] || {}, P = { roughness: d.rough !== null && d.rough !== undefined ? d.rough : 1, metalness: d.tex && d.arm !== false ? 1 : (d.metal || 0) };
    let mat;
    if (m.mat === 'glass') mat = new THREE.MeshStandardMaterial({ color: 0x0e1215, roughness: 0.04, metalness: 0.0, envMapIntensity: 1.1 });
    else if (m.mat === 'water') mat = new THREE.MeshStandardMaterial({ color: 0x0b2026, roughness: 0.06, metalness: 0.0, envMapIntensity: 1.0 });
    else {
      mat = new THREE.MeshStandardMaterial(P);
      const tint = d.tint || [1, 1, 1], col = d.color;
      if (d.tex) {
        // v16: Source-sæt (de_canals) har ikke altid normal-/ARM-kort (d.nrm / d.arm === false) og kan være alfa-testede (d.alpha: blade, rækværk)
        const [map, nrm, arm] = await Promise.all([tex(d.tex, 'd'), d.nrm === false ? null : tex(d.tex, 'n'), d.arm === false ? null : tex(d.tex, 'a')]);
        mat.map = map; mat.normalMap = nrm; if (arm) { mat.roughnessMap = arm; mat.metalnessMap = arm; mat.aoMap = arm; mat.aoMapIntensity = 1.0; }
        if (d.alpha) { mat.alphaTest = 0.5; mat.side = THREE.DoubleSide; }
        mat.color.setRGB(tint[0], tint[1], tint[2]);
      } else if (col) mat.color.setRGB(col[0], col[1], col[2]);
      if (d.emit) { mat.emissive.setRGB(d.emit[0], d.emit[1], d.emit[2]); mat.emissiveIntensity = Math.min(8, d.emit[3] * 0.25); }
    }
    const L = lmName ? lms.chunks[lmName] : null;
    if (L) { mat.lightMap = await lightmap(lmName); mat.userData.lmScale = L.scale; }
    mat.userData.vtx = !!m.vtx; mat.userData.vscale = m.vscale || 1; mat.userData.blend = !!d.tex && !d.model;
    if (m.mat === 'water') patchWater(THREE, mat);
    patch(THREE, mat, m.kind);
    matCache.set(key, mat); return mat;
  }
  const group = new THREE.Group(); group.name = 'havn';
  for (const { m, g } of meshes) {
    const mat = await material(m), mesh = new THREE.Mesh(g, mat);
    mesh.position.set(m.lo[0], m.lo[1], m.lo[2]); mesh.scale.set(m.ext[0], m.ext[1], m.ext[2]);
    mesh.castShadow = m.kind !== 'water' && m.mat !== 'glass'; mesh.receiveShadow = true; mesh.name = m.name + ':' + m.mat;
    mesh.userData.havn = m;
    if (m.mat === 'water') mesh.onBeforeRender = () => { WATER_T.value = performance.now() / 1000; };
    group.add(mesh);
  }
  group.updateMatrixWorld(true);
  return { group, sky, meta, lms, count: meshes.length, tris: meshes.reduce((s, x) => s + x.m.ni / 3, 0) };
}

// ---------------------------------------------------------------- shader: lysmap / vertex-lys som indirekte lys
const SKY_REF = { value: 1.0 };                       // himlens bestråling (vandret) – refleksioner skaleres efter lysmappet/denne
const IND_TINT = { value: [1, 1, 1] };                // v20: temaets tone på det bagte himmellys (fx varmt sommer-tilbagekast)
const WATER_T = { value: 0.0 };                       // tid til vandets bølger (opdateres når vandet tegnes)
export const havnUniforms = { skyRef: SKY_REF, waterTime: WATER_T, indTint: IND_TINT };
// snavs (R), mos/ukrudt i fugerne (G) og vådt (B) pr. hjørne – blandes med højde-proxy (AO + lyshed), så overgangene
// følger stenenes fuger i stedet for at være bløde pletter: snavs og mos samler sig i fugerne først, vådt mørkner og blankpolerer.
const BLEND_MAP = `
  #ifdef HAVN_BLEND
    float hvCav = 1.0;
    #ifdef USE_AOMAP
      hvCav = texture2D( aoMap, vAoMapUv ).r;
    #endif
    float hvLum = dot( diffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) );
    float hvH = clamp( hvCav * 0.75 + hvLum * 0.5, 0.0, 1.0 );
    float hvDirt = smoothstep( hvH - 0.18, hvH + 0.12, vHvBlend.r * 1.15 );
    float hvMoss = smoothstep( hvH - 0.12, hvH + 0.06, vHvBlend.g ) * ( 1.15 - hvCav * 0.6 );
    float hvWet = clamp( vHvBlend.b, 0.0, 1.0 );
    diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 0.52, 0.47, 0.41 ) + vec3( 0.035, 0.028, 0.02 ), hvDirt * 0.8 );
    diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.085, 0.11, 0.035 ) * ( 0.7 + hvLum ), clamp( hvMoss, 0.0, 1.0 ) * 0.85 );
    diffuseColor.rgb *= 1.0 - 0.42 * hvWet;
  #endif`;
// v20: fjerne flader gnistrede/'grynede' (fine normal-detaljer og skarp glans aliaserer når en pixel dækker mange teksler):
//   normalkortets styrke og glansen tones ned med afstanden (som en billig Toksvig/specular-AA)
const FAR_AA = `
    float hvFar = smoothstep( 14.0, 55.0, length( vViewPosition ) );`;
const FAR_ROUGH = `
    roughnessFactor = mix( roughnessFactor, max( roughnessFactor, 0.78 ), hvFar );`;
const BLEND_ROUGH = `
  #ifdef HAVN_BLEND
    roughnessFactor = mix( roughnessFactor, 0.14, hvWet * 0.85 );
    roughnessFactor = mix( roughnessFactor, 1.0, clamp( hvMoss, 0.0, 1.0 ) * 0.5 );
  #endif`;
function patch(THREE, mat, kind) {
  const lmScale = { value: (mat.userData.lmScale || 1) * Math.PI }, vScale = { value: (mat.userData.vscale || 1) * Math.PI };
  const vtx = mat.userData.vtx, blend = mat.userData.blend, prevWater = mat.onBeforeCompile;
  if (blend) mat.defines = Object.assign(mat.defines || {}, { HAVN_BLEND: '' });
  mat.onBeforeCompile = (sh, r) => {
    if (mat.userData.water && prevWater) prevWater(sh, r);
    sh.uniforms.lmScale = lmScale; sh.uniforms.vScale = vScale; sh.uniforms.skyRef = SKY_REF; sh.uniforms.indTint = IND_TINT;
    if (vtx) {
      sh.vertexShader = 'attribute vec4 vlm;\nvarying vec3 vVlm;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vVlm = vlm.rgb;');
      sh.fragmentShader = 'varying vec3 vVlm;\n' + sh.fragmentShader;
    }
    if (blend) {
      sh.vertexShader = 'attribute vec4 blend;\nvarying vec4 vHvBlend;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vHvBlend = blend;');
      sh.fragmentShader = 'varying vec4 vHvBlend;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>' + BLEND_MAP)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>' + BLEND_ROUGH);
    }
    sh.fragmentShader = 'uniform float lmScale, vScale, skyRef;\nuniform vec3 indTint;\n' + sh.fragmentShader.replace('#include <lights_fragment_maps>', `
  #if defined( RE_IndirectDiffuse )
    vec3 bakedIrr = vec3(0.0);
    #ifdef USE_LIGHTMAP
      bakedIrr = pow( texture2D( lightMap, vLightMapUv ).rgb, vec3( 2.2 ) ) * lmScale;
    #endif
    ${vtx ? 'bakedIrr = pow( vVlm, vec3( 2.2 ) ) * vScale;' : ''}
    irradiance = bakedIrr * indTint;                        // erstatter hemisfære + omgivelseslys (bagt himmel + tilbagekast)
  #endif
  #if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
    iblIrradiance += vec3( 0.0 );
  #endif
  #if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
    radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness ) * clamp( dot( irradiance, vec3( 0.2126, 0.7152, 0.0722 ) ) / skyRef, 0.0, 1.0 );
  #endif`);
    if (!mat.userData.water) {                                // v20: afstands-anti-gnist (se FAR_AA)
      const nfm = THREE.ShaderChunk.normal_fragment_maps.replace(/mapN\.xy \*= normalScale;/g, 'mapN.xy *= normalScale * ( 1.0 - 0.8 * hvFar );');
      sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>' + FAR_AA + FAR_ROUGH).replace('#include <normal_fragment_maps>', nfm);
    }
    // lysmappets UV (uv1) – three sætter vLightMapUv når lightMap findes; aoMap skal bruge uv (kanal 0) – standard
  };
  mat.customProgramCacheKey = () => 'havn' + (vtx ? 'v' : 'l') + (blend ? 'b' : '') + (mat.userData.water ? 'w' : '');
  if (!mat.lightMap && !vtx) mat.userData.unlit = true;
}
export function setSkyRef(v) { SKY_REF.value = v; }

// ---------------------------------------------------------------- vand: bølgende normal (retningsbølger + fin krusning), mørk dybde, himmelspejling via IBL
function patchWater(THREE, mat) {
  mat.userData.water = true;
  mat.onBeforeCompile = sh => {
    sh.uniforms.uWT = WATER_T;
    sh.vertexShader = 'varying vec3 vHvWP;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vHvWP = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    sh.fragmentShader = 'uniform float uWT;\nvarying vec3 vHvWP;\n' + `
      vec2 hvWave( vec2 p, vec2 d, float k, float w, float a ) { float ph = dot( p, d ) * k + uWT * w; return d * ( a * k * cos( ph ) ); }
      float hvN( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
        float a = fract( sin( dot( i, vec2( 127.1, 311.7 ) ) ) * 43758.5 ), b = fract( sin( dot( i + vec2( 1, 0 ), vec2( 127.1, 311.7 ) ) ) * 43758.5 ),
              c = fract( sin( dot( i + vec2( 0, 1 ), vec2( 127.1, 311.7 ) ) ) * 43758.5 ), d = fract( sin( dot( i + vec2( 1, 1 ), vec2( 127.1, 311.7 ) ) ) * 43758.5 );
        return mix( mix( a, b, f.x ), mix( c, d, f.x ), f.y ); }
    ` + sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        vec2 p = vHvWP.xz;
        vec2 g = hvWave( p, normalize( vec2( 0.8, 0.6 ) ), 1.7, 1.3, 0.012 ) + hvWave( p, normalize( vec2( -0.3, 1.0 ) ), 2.9, 1.9, 0.007 )
               + hvWave( p, normalize( vec2( 1.0, -0.45 ) ), 4.6, 2.6, 0.004 ) + hvWave( p, normalize( vec2( -0.9, -0.2 ) ), 7.3, 3.4, 0.0022 );
        float e = 0.06, s0 = hvN( p * 3.1 + uWT * 0.35 ), sx = hvN( ( p + vec2( e, 0.0 ) ) * 3.1 + uWT * 0.35 ), sz = hvN( ( p + vec2( 0.0, e ) ) * 3.1 + uWT * 0.35 );
        g += vec2( sx - s0, sz - s0 ) / e * 0.012;
        vec3 nw = normalize( vec3( -g.x, 1.0, -g.y ) );
        normal = normalize( ( viewMatrix * vec4( nw, 0.0 ) ).xyz );
      }`);
  };
}
