// ==========================================================================
// PBR-hjælper (v9): afleder Normal- og ORM-maps (Occlusion/Roughness/Metalness) fra de proceduralt malede albedo-teksturer.
//   • højde = luminans (fuger, revner og nitter er mørke => fordybninger) → Sobel → tangent-rum normal-map (OpenGL-konvention, +Y op)
//   • roughness: grundværdi ± variation (mørke/slidte områder ruere, lyse/blanke glattere)  → G-kanal
//   • metalness: grundværdi, svækket i rust-/smudsområder (rødbrune/mørke pixels)            → B-kanal
//   Resultatet caches pr. kildetekstur. Uden canvas (test-stub) returneres null => konstante PBR-værdier bruges.
// ==========================================================================
const cache = new WeakMap();
export function derivePBR(THREE, tex, o) {
  const img = tex && tex.image;
  if (!img || typeof img.getContext !== 'function' || !img.width) return null;
  const key = (o.normal || 0).toFixed(2) + '|' + o.rough.toFixed(2) + '|' + o.metal.toFixed(2) + '|' + (o.rv === undefined ? 0.18 : o.rv).toFixed(2);
  let per = cache.get(tex); if (!per) { per = new Map(); cache.set(tex, per); }
  if (per.has(key)) return per.get(key);
  let data;
  try { data = img.getContext('2d').getImageData(0, 0, img.width, img.height).data; } catch (e) { per.set(key, null); return null; }
  const w = img.width, h = img.height, N = w * h, H = new Float32Array(N);
  let mean = 0;
  for (let i = 0; i < N; i++) { const v = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) / 255; H[i] = v; mean += v; }
  mean /= N;
  const at = (x, y) => H[((y + h) % h) * w + ((x + w) % w)];             // wrap => sømløse kanter ved flisning
  const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const out = {};
  if (o.normal > 0) {
    const cv = mk(), cx = cv.getContext('2d'), id = cx.createImageData(w, h), d = id.data, s = o.normal * 2.2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const gx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const gy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      let nx = -gx * s, ny = gy * s, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;   // billed-y peger ned, tekstur-v op (flipY)
      const k = (y * w + x) * 4; d[k] = (nx * 0.5 + 0.5) * 255; d[k + 1] = (ny * 0.5 + 0.5) * 255; d[k + 2] = (nz * 0.5 + 0.5) * 255; d[k + 3] = 255;
    }
    cx.putImageData(id, 0, 0);
    out.normalMap = wrapTex(THREE, cv, tex);
  }
  {
    const cv = mk(), cx = cv.getContext('2d'), id = cx.createImageData(w, h), d = id.data, rv = o.rv === undefined ? 0.18 : o.rv;
    for (let i = 0; i < N; i++) {
      const v = H[i], r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      const rough = Math.min(1, Math.max(0.04, o.rough + (mean - v) * rv * 2));
      const rust = Math.max(0, (r - b) / 255 - 0.12) * 2.2 + Math.max(0, 0.18 - v) * 2;     // rødbrunt eller meget mørkt = rust/snavs
      const metal = Math.min(1, Math.max(0, o.metal * (1 - Math.min(0.85, rust))));
      d[i * 4] = 255; d[i * 4 + 1] = rough * 255; d[i * 4 + 2] = metal * 255; d[i * 4 + 3] = 255;
    }
    cx.putImageData(id, 0, 0);
    out.orm = wrapTex(THREE, cv, tex);
  }
  per.set(key, out);
  return out;
}
function wrapTex(THREE, canvas, src) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.NoColorSpace;                 // data-tekstur (lineær)
  t.wrapS = src.wrapS; t.wrapT = src.wrapT; t.repeat.copy(src.repeat); t.offset.copy(src.offset);
  t.anisotropy = src.anisotropy; t.needsUpdate = true;
  return t;
}
