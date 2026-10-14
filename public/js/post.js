// ==========================================================================
// POST-PROCESSING (v9): HDR-pipeline uden eksterne afhængigheder
//   1. scenen tegnes i et HalfFloat-target (lineært HDR) med dybde-tekstur
//   2. SSAO (Screen Space Ambient Occlusion) i halv opløsning: hemisfære-prøver omkring den rekonstruerede normal,
//      rækkevidde-tjek, afstands-fade, dybde-bevidst 4×4-blur → naturlig mørkning i hjørner, under kasser og ved vægsamlinger
//   3. AO ganges på farven (kun geometri – ikke himlen), derefter tegnes førstepersons-våbnet ovenpå (får ikke væggens AO)
//   4. Bloom: lysstærke pixels (> tærskel: sol, mundingsild, eksplosioner, lamper) → 5-trins mip-kæde (ned/op-sampling)
//   5. Slut: FXAA (kant-udglatning) + ACES-filmisk tonemapping + sRGB → skærm
//   v10 (filmisk finish, pr. bane via setLook): Mie-solspredning i disen mod solen, sol-stråler (radial blur af himmel-masken i 1/4 opløsning),
//      color grading (mætning, kontrast om 18 % grå, split-toning skygger/højlys, lift/gain), vignette, let skærpning og dithering (ingen banding i himlen)
//   Himlen skriver alpha = 0 (den er allerede i skærm-farverum) og springes over i AO/tonemapping.
// createPost(THREE, renderer) -> { supported, setSize(w,h), render(scene, cam, vmScene, vmCam, vmOn), enabled, settings }
// ==========================================================================
export function createPost(THREE, renderer) {
  const gl2 = renderer.capabilities.isWebGL2;
  const hdrOk = gl2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
  const supported = !!hdrOk;
  const cfg = { ao: true, aoStrength: 0.85, aoRadius: 0.55, bloom: true, bloomStrength: 0.16, bloomThreshold: 1.0, exposure: 1.0, shafts: true };
  const LOOK0 = { sat: 1, contrast: 1, gamma: 1, lift: [0, 0, 0], gain: [1, 1, 1], shadowTint: [1, 1, 1], highTint: [1, 1, 1], vignette: 0.18, sharpen: 0.18, shafts: 0, shaftCol: [1, 0.9, 0.75], mie: 0, mieCol: [1, 0.85, 0.65], mieDist: 120 };
  if (!supported) return { supported: false, enabled: false, cfg, setSize() {}, render() { return false; }, setLook() {}, setSun() {}, dispose() {} };

  const mkRT = (w, h, o) => new THREE.WebGLRenderTarget(w, h, Object.assign({ type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false }, o || {}));
  const depthTex = new THREE.DepthTexture(4, 4); depthTex.type = THREE.UnsignedIntType; depthTex.format = THREE.DepthFormat;
  const rtA = mkRT(4, 4, { depthBuffer: true, depthTexture: depthTex, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const rtB = mkRT(4, 4, { depthBuffer: true });
  const rtAO = mkRT(2, 2), rtAO2 = mkRT(2, 2);                  // HalfFloat: AO + lineær dybde (til dybde-bevidst blur)
  const rtS1 = mkRT(2, 2), rtS2 = mkRT(2, 2);                  // sol-stråler (1/4 opløsning)
  const LV = 5, bl = [];
  for (let i = 0; i < LV; i++) { bl.push(mkRT(2, 2)); }

  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const quad = new THREE.Mesh(tri, null); quad.frustumCulled = false;
  const qScene = new THREE.Scene(); qScene.add(quad);
  const VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const sm = (frag, uniforms, extra) => new THREE.ShaderMaterial(Object.assign({ vertexShader: VS, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, toneMapped: false }, extra || {}));

  /* ---------------- SSAO ---------------- */
  const KN = 12, kernel = [];
  for (let i = 0; i < KN; i++) {                         // hemisfære-kerne (z = op langs normalen), tættere ved centrum
    const a = i * 2.39996, u = (i + 0.5) / KN, r = Math.sqrt(1 - u * u * 0.85);
    const v = new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0.15 + u * 0.85).normalize();
    const s = 0.2 + 0.8 * Math.pow((i + 1) / KN, 2); kernel.push(v.multiplyScalar(s));
  }
  const DEPTH_FN = `
    uniform sampler2D tDepth; uniform mat4 uInvProj; uniform mat4 uProj;
    vec3 viewPos(vec2 uv) { float d = texture2D(tDepth, uv).x; vec4 p = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return p.xyz / p.w; }`;
  const aoMat = sm(`
    varying vec2 vUv; ${DEPTH_FN}
    uniform vec3 uKernel[${KN}]; uniform vec2 uTexel; uniform float uRadius;
    float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
    void main() {
      float d = texture2D(tDepth, vUv).x;
      if (d >= 0.99999) { gl_FragColor = vec4(1.0); return; }
      vec3 P = viewPos(vUv);
      vec3 px = viewPos(vUv + vec2(uTexel.x, 0.0)) - P, nx = P - viewPos(vUv - vec2(uTexel.x, 0.0));
      vec3 py = viewPos(vUv + vec2(0.0, uTexel.y)) - P, ny = P - viewPos(vUv - vec2(0.0, uTexel.y));
      vec3 N = normalize(cross(abs(px.z) < abs(nx.z) ? px : nx, abs(py.z) < abs(ny.z) ? py : ny));
      if (dot(N, P) > 0.0) N = -N;
      float ang = ign(gl_FragCoord.xy) * 6.2831853;
      vec3 rv = vec3(cos(ang), sin(ang), 0.0);
      vec3 T = normalize(rv - N * dot(rv, N)), B = cross(N, T);
      float rad = uRadius * clamp(-P.z / 6.0, 0.7, 2.2), occ = 0.0;
      for (int i = 0; i < ${KN}; i++) {
        vec3 k = uKernel[i];
        vec3 S = P + (T * k.x + B * k.y + N * k.z) * rad;
        vec4 o = uProj * vec4(S, 1.0); vec2 suv = o.xy / o.w * 0.5 + 0.5;
        if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) continue;
        float sz = viewPos(suv).z;
        float range = smoothstep(0.0, 1.0, rad / max(1e-3, abs(P.z - sz)));
        occ += (sz >= S.z + 0.025 * rad ? 1.0 : 0.0) * range;
      }
      float ao = 1.0 - occ / float(${KN});
      ao = mix(ao, 1.0, smoothstep(45.0, 90.0, -P.z));
      gl_FragColor = vec4(ao, -P.z / 400.0, 0.0, 1.0);
    }`, { tDepth: { value: depthTex }, uInvProj: { value: new THREE.Matrix4() }, uProj: { value: new THREE.Matrix4() }, uKernel: { value: kernel }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: cfg.aoRadius } });
  const aoBlurMat = sm(`
    varying vec2 vUv; uniform sampler2D tAO; uniform vec2 uTexel;
    void main() {
      vec2 c = texture2D(tAO, vUv).xy; float sum = 0.0, w = 0.0;
      for (int x = -2; x < 2; x++) for (int y = -2; y < 2; y++) {
        vec2 s = texture2D(tAO, vUv + (vec2(float(x), float(y)) + 0.5) * uTexel).xy;
        float k = 1.0 / (1e-4 + abs(s.y - c.y) * 400.0 / max(0.02, c.y * 400.0) * 12.0 + 0.08);
        sum += s.x * k; w += k;
      }
      gl_FragColor = vec4(sum / w, c.y, 0.0, 1.0);
    }`, { tAO: { value: null }, uTexel: { value: new THREE.Vector2() } });
  // AO + Mie-spredning: dis i solens retning lyser op med afstanden (atmosfærisk perspektiv – 'varm luft' mod solen)
  const applyMat = sm(`
    varying vec2 vUv; uniform sampler2D tColor; uniform sampler2D tAO; uniform float uStr, uOn; ${DEPTH_FN}
    uniform vec3 uSunV, uMieCol; uniform float uMie, uMieDist;
    void main() {
      vec4 c = texture2D(tColor, vUv);
      float geo = step(0.5, c.a);
      float ao = mix(1.0, texture2D(tAO, vUv).x, uStr * uOn * geo);
      vec3 col = c.rgb * ao;
      if (uMie > 0.0 && geo > 0.0) {
        vec3 P = viewPos(vUv); float d = length(P); vec3 rd = P / max(d, 1e-3);
        float mu = max(dot(rd, uSunV), 0.0), ph = pow(mu, 8.0) * 0.75 + pow(mu, 48.0) * 1.5;
        col += uMieCol * (ph * (1.0 - exp(-d / uMieDist)) * uMie);
      }
      gl_FragColor = vec4(col, c.a);
    }`, { tColor: { value: rtA.texture }, tAO: { value: rtAO.texture }, uStr: { value: cfg.aoStrength }, uOn: { value: 1 }, tDepth: { value: depthTex }, uInvProj: { value: new THREE.Matrix4() }, uProj: { value: new THREE.Matrix4() },
      uSunV: { value: new THREE.Vector3(0, 1, 0) }, uMieCol: { value: new THREE.Vector3(1, 0.85, 0.65) }, uMie: { value: 0 }, uMieDist: { value: 120 } });

  /* ---------------- sol-stråler: maske (himmel nær solskiven) → radial blur mod solens skærmposition ---------------- */
  const shaftMaskMat = sm(`
    varying vec2 vUv; uniform sampler2D tColor; uniform vec2 uSun; uniform float uAsp;
    void main() {
      vec4 c = texture2D(tColor, vUv);
      vec2 d = (vUv - uSun) * vec2(uAsp, 1.0);
      float sky = 1.0 - step(0.5, c.a);
      float l = dot(c.rgb, vec3(0.3, 0.55, 0.15));
      gl_FragColor = vec4(vec3(sky * smoothstep(0.35, 1.1, l) * exp(-dot(d, d) * 6.0)), 1.0);
    }`, { tColor: { value: null }, uSun: { value: new THREE.Vector2() }, uAsp: { value: 1 } });
  const shaftBlurMat = sm(`
    varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uSun;
    float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
    void main() {
      vec2 dl = (vUv - uSun) * (0.92 / 28.0); vec2 uv = vUv - dl * ign(gl_FragCoord.xy);
      float s = 0.0, w = 1.0, sum = 0.0;
      for (int i = 0; i < 28; i++) { s += texture2D(tSrc, uv).x * w; sum += w; w *= 0.955; uv -= dl; }
      gl_FragColor = vec4(vec3(s / sum), 1.0);
    }`, { tSrc: { value: null }, uSun: { value: new THREE.Vector2() } });

  /* ---------------- bloom ---------------- */
  const preMat = sm(`
    varying vec2 vUv; uniform sampler2D tColor; uniform vec2 uTexel; uniform float uThr;
    vec3 pre(vec3 c) { float l = max(c.r, max(c.g, c.b)); float k = clamp(l - uThr * 0.6, 0.0, uThr * 0.8); k = k * k / (uThr * 3.2 + 1e-4); return c * max(k, l - uThr) / max(l, 1e-4); }
    void main() {
      vec3 s = pre(texture2D(tColor, vUv + vec2(-1.0, -1.0) * uTexel).rgb) + pre(texture2D(tColor, vUv + vec2(1.0, -1.0) * uTexel).rgb)
             + pre(texture2D(tColor, vUv + vec2(-1.0, 1.0) * uTexel).rgb) + pre(texture2D(tColor, vUv + vec2(1.0, 1.0) * uTexel).rgb);
      gl_FragColor = vec4(min(s * 0.25, vec3(40.0)), 1.0);
    }`, { tColor: { value: null }, uTexel: { value: new THREE.Vector2() }, uThr: { value: cfg.bloomThreshold } });
  const downMat = sm(`
    varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uTexel;
    void main() {
      vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
      c += texture2D(tSrc, vUv + vec2(-1.0, -1.0) * uTexel).rgb + texture2D(tSrc, vUv + vec2(1.0, -1.0) * uTexel).rgb;
      c += texture2D(tSrc, vUv + vec2(-1.0, 1.0) * uTexel).rgb + texture2D(tSrc, vUv + vec2(1.0, 1.0) * uTexel).rgb;
      gl_FragColor = vec4(c / 8.0, 1.0);
    }`, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
  const upMat = sm(`
    varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uTexel;
    void main() {
      vec3 c = vec3(0.0);
      c += texture2D(tSrc, vUv + vec2(-1.0, 0.0) * uTexel * 2.0).rgb + texture2D(tSrc, vUv + vec2(1.0, 0.0) * uTexel * 2.0).rgb;
      c += texture2D(tSrc, vUv + vec2(0.0, -1.0) * uTexel * 2.0).rgb + texture2D(tSrc, vUv + vec2(0.0, 1.0) * uTexel * 2.0).rgb;
      c += (texture2D(tSrc, vUv + vec2(-1.0, -1.0) * uTexel).rgb + texture2D(tSrc, vUv + vec2(1.0, -1.0) * uTexel).rgb
          + texture2D(tSrc, vUv + vec2(-1.0, 1.0) * uTexel).rgb + texture2D(tSrc, vUv + vec2(1.0, 1.0) * uTexel).rgb) * 2.0;
      gl_FragColor = vec4(c / 12.0, 1.0);
    }`, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } }, { blending: THREE.AdditiveBlending, transparent: true });

  /* ---------------- slut: FXAA + bloom + ACES + sRGB ---------------- */
  const finalMat = sm(`
    varying vec2 vUv; uniform sampler2D tColor; uniform sampler2D tBloom; uniform sampler2D tShaft; uniform vec2 uTexel; uniform float uExp, uBloom;
    uniform float uSat, uCon, uGam, uVig, uSharp, uShaft; uniform vec3 uLift, uGain, uShT, uHiT, uShaftCol;
    float luma(vec3 c) { c = c / (1.0 + c); return dot(c, vec3(0.299, 0.587, 0.114)); }
    vec4 fxaa(vec2 uv) {
      vec4 M = texture2D(tColor, uv);
      float lNW = luma(texture2D(tColor, uv + vec2(-1.0, -1.0) * uTexel).rgb), lNE = luma(texture2D(tColor, uv + vec2(1.0, -1.0) * uTexel).rgb);
      float lSW = luma(texture2D(tColor, uv + vec2(-1.0, 1.0) * uTexel).rgb), lSE = luma(texture2D(tColor, uv + vec2(1.0, 1.0) * uTexel).rgb), lM = luma(M.rgb);
      float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
      if (lMax - lMin < max(0.0312, lMax * 0.125)) return M;
      vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
      float red = max((lNW + lNE + lSW + lSE) * 0.25 * (1.0 / 8.0), 1.0 / 128.0);
      float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + red);
      dir = clamp(dir * rcp, vec2(-8.0), vec2(8.0)) * uTexel;
      vec4 A = 0.5 * (texture2D(tColor, uv + dir * (1.0 / 3.0 - 0.5)) + texture2D(tColor, uv + dir * (2.0 / 3.0 - 0.5)));
      vec4 B = A * 0.5 + 0.25 * (texture2D(tColor, uv - dir * 0.5) + texture2D(tColor, uv + dir * 0.5));
      float lB = luma(B.rgb);
      return (lB < lMin || lB > lMax) ? A : B;
    }
    vec3 RRTAndODTFit(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
    vec3 aces(vec3 color) {
      const mat3 IN = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
      const mat3 OUT = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
      color *= uExp / 0.6; color = IN * color; color = RRTAndODTFit(color); color = OUT * color; return clamp(color, 0.0, 1.0);
    }
    vec3 srgb(vec3 c) { return mix(c * 12.92, pow(c, vec3(0.41666)) * 1.055 - 0.055, step(0.0031308, c)); }
    vec3 lin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
    vec3 grade(vec3 c) {
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = max(mix(vec3(l), c, uSat), 0.0);
      c *= mix(uShT, uHiT, smoothstep(0.02, 0.5, l));
      c = 0.18 * pow(max(c, 1e-5) / 0.18, vec3(uCon));
      c = pow(c, vec3(uGam));
      return clamp(c * uGain + uLift * (1.0 - c), 0.0, 1.0);
    }
    void main() {
      vec4 c = fxaa(vUv);
      if (uSharp > 0.0 && c.a > 0.5) {                     // let skærpning (kun geometri, ikke himmel): knivskarpe kanter efter FXAA
        vec3 n4 = texture2D(tColor, vUv + vec2(uTexel.x, 0.0)).rgb + texture2D(tColor, vUv - vec2(uTexel.x, 0.0)).rgb + texture2D(tColor, vUv + vec2(0.0, uTexel.y)).rgb + texture2D(tColor, vUv - vec2(0.0, uTexel.y)).rgb;
        vec3 hp = c.rgb - n4 * 0.25; c.rgb = max(c.rgb + hp * uSharp / (1.0 + dot(abs(hp), vec3(0.33)) * 4.0), 0.0);
      }
      vec3 b = texture2D(tBloom, vUv).rgb * uBloom;
      vec3 L = c.a > 0.5 ? aces(c.rgb + b) : lin(c.rgb) + aces(b);
      L += uShaftCol * texture2D(tShaft, vUv).x * uShaft;
      L = grade(L);
      vec2 dv = (vUv - 0.5) * vec2(1.0, 0.82); L *= 1.0 - uVig * smoothstep(0.08, 0.5, dot(dv, dv) * 2.0);
      vec3 o = srgb(L) + (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
      gl_FragColor = vec4(o, 1.0);
    }`, { tColor: { value: rtB.texture }, tBloom: { value: bl[0].texture }, tShaft: { value: rtS2.texture }, uTexel: { value: new THREE.Vector2() }, uExp: { value: 1 }, uBloom: { value: cfg.bloomStrength },
      uSat: { value: 1 }, uCon: { value: 1 }, uGam: { value: 1 }, uVig: { value: 0.18 }, uSharp: { value: 0.18 }, uShaft: { value: 0 }, uLift: { value: new THREE.Vector3() }, uGain: { value: new THREE.Vector3(1, 1, 1) },
      uShT: { value: new THREE.Vector3(1, 1, 1) }, uHiT: { value: new THREE.Vector3(1, 1, 1) }, uShaftCol: { value: new THREE.Vector3(1, 0.9, 0.75) } });
  // banens 'look' (temaets post-blok) -> uniforms
  const look = Object.assign({}, LOOK0);
  function setLook(o) {
    Object.assign(look, LOOK0, o || {});
    const F = finalMat.uniforms, v = (u, a) => u.value.set(a[0], a[1], a[2]);
    F.uSat.value = look.sat; F.uCon.value = look.contrast; F.uGam.value = look.gamma; F.uVig.value = look.vignette; F.uSharp.value = look.sharpen;
    v(F.uLift, look.lift); v(F.uGain, look.gain); v(F.uShT, look.shadowTint); v(F.uHiT, look.highTint); v(F.uShaftCol, look.shaftCol);
    v(applyMat.uniforms.uMieCol, look.mieCol); applyMat.uniforms.uMieDist.value = look.mieDist;
  }
  const sunW = new THREE.Vector3(0, 1, 0), _sp = new THREE.Vector3(), _cd = new THREE.Vector3();

  function pass(mat, target) { quad.material = mat; renderer.setRenderTarget(target); renderer.render(qScene, cam); }

  let W = 0, H = 0;
  function setSize(w, h) {
    w = Math.max(4, w | 0); h = Math.max(4, h | 0);
    if (w === W && h === H) return; W = w; H = h;
    rtA.setSize(w, h); rtB.setSize(w, h);
    const hw = Math.max(2, w >> 1), hh = Math.max(2, h >> 1);
    rtAO.setSize(hw, hh); rtAO2.setSize(hw, hh); rtS1.setSize(Math.max(2, w >> 2), Math.max(2, h >> 2)); rtS2.setSize(Math.max(2, w >> 2), Math.max(2, h >> 2));
    for (let i = 0; i < LV; i++) bl[i].setSize(Math.max(2, w >> (i + 1)), Math.max(2, h >> (i + 1)));
    aoMat.uniforms.uTexel.value.set(1 / w, 1 / h); aoBlurMat.uniforms.uTexel.value.set(1 / hw, 1 / hh); finalMat.uniforms.uTexel.value.set(1 / w, 1 / h);
  }
  const _size = new THREE.Vector2();
  const state = { enabled: true };
  // returnerer true hvis billedet blev tegnet via pipelinen
  function render(scene, camera, vmScene, vmCam, vmOn) {
    // v20: skærpning kun ved fuld opløsning – når den adaptive opløsning er sænket, forstærker den kun aliasering ('gryn' på afstand)
    const prK = Math.min(1, Math.max(0, (renderer.getPixelRatio() - 0.75) / 0.2)); finalMat.uniforms.uSharp.value = (look.sharpen || 0) * prK;
    if (!state.enabled) return false;
    renderer.getDrawingBufferSize(_size); setSize(_size.x, _size.y);
    const prevClearA = renderer.getClearAlpha(); renderer.setClearAlpha(0);
    // 1. scene → HDR + dybde
    renderer.setRenderTarget(rtA); renderer.clear(true, true, false); renderer.render(scene, camera);
    // 2. SSAO
    const aoOn = cfg.ao ? 1 : 0;
    if (aoOn) {
      aoMat.uniforms.uProj.value.copy(camera.projectionMatrix); aoMat.uniforms.uInvProj.value.copy(camera.projectionMatrixInverse); aoMat.uniforms.uRadius.value = cfg.aoRadius;
      pass(aoMat, rtAO);
      aoBlurMat.uniforms.tAO.value = rtAO.texture; pass(aoBlurMat, rtAO2);
    }
    applyMat.uniforms.tAO.value = rtAO2.texture; applyMat.uniforms.uOn.value = aoOn; applyMat.uniforms.uStr.value = cfg.aoStrength;
    applyMat.uniforms.uInvProj.value.copy(camera.projectionMatrixInverse);
    applyMat.uniforms.uSunV.value.copy(sunW).transformDirection(camera.matrixWorldInverse); applyMat.uniforms.uMie.value = look.mie;
    // 3. AO på farven → B, førstepersons-våben ovenpå
    renderer.setRenderTarget(rtB); renderer.clear(true, true, false);
    pass(applyMat, rtB);
    if (vmOn) { renderer.setRenderTarget(rtB); renderer.clearDepth(); renderer.render(vmScene, vmCam); }
    // 4. bloom
    if (cfg.bloom) {
      preMat.uniforms.tColor.value = rtB.texture; preMat.uniforms.uTexel.value.set(1 / W, 1 / H); preMat.uniforms.uThr.value = cfg.bloomThreshold; pass(preMat, bl[0]);
      for (let i = 1; i < LV; i++) { downMat.uniforms.tSrc.value = bl[i - 1].texture; downMat.uniforms.uTexel.value.set(1 / bl[i - 1].width, 1 / bl[i - 1].height); pass(downMat, bl[i]); }
      for (let i = LV - 1; i > 0; i--) { upMat.uniforms.tSrc.value = bl[i].texture; upMat.uniforms.uTexel.value.set(1 / bl[i].width, 1 / bl[i].height); pass(upMat, bl[i - 1]); }
    }
    // 4b. sol-stråler: kun når solen er foran kameraet (fader ud mod skærmkanten)
    let shaft = 0;
    if (cfg.shafts && look.shafts > 0) {
      _cd.set(0, 0, -1).transformDirection(camera.matrixWorld);
      const facing = _cd.dot(sunW);
      if (facing > 0.05) {
        _sp.copy(camera.position).addScaledVector(sunW, 1000).project(camera);
        const sx = _sp.x * 0.5 + 0.5, sy = _sp.y * 0.5 + 0.5, edge = Math.max(Math.abs(sx - 0.5), Math.abs(sy - 0.5));
        shaft = look.shafts * Math.min(1, (facing - 0.05) / 0.3) * Math.max(0, Math.min(1, (1.1 - edge) / 0.45));
        if (shaft > 0.002) {
          shaftMaskMat.uniforms.tColor.value = rtB.texture; shaftMaskMat.uniforms.uSun.value.set(sx, sy); shaftMaskMat.uniforms.uAsp.value = W / H; pass(shaftMaskMat, rtS1);
          shaftBlurMat.uniforms.tSrc.value = rtS1.texture; shaftBlurMat.uniforms.uSun.value.set(sx, sy); pass(shaftBlurMat, rtS2);
        } else shaft = 0;
      }
    }
    finalMat.uniforms.uShaft.value = shaft;
    finalMat.uniforms.uBloom.value = cfg.bloom ? cfg.bloomStrength : 0; finalMat.uniforms.uExp.value = cfg.exposure;
    // 5. FXAA + tonemapping → skærm
    pass(finalMat, null);
    renderer.setClearAlpha(prevClearA);
    return true;
  }
  return { supported: true, cfg, setSize, render, setLook, setSun(v) { sunW.copy(v).normalize(); }, look, get enabled() { return state.enabled; }, set enabled(v) { state.enabled = !!v; }, depthTexture: depthTex };
}
