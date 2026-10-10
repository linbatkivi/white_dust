// ==========================================================================
// MODELS (v11.2): minimal glTF 2.0-loader til de fotoscannede CC0-modeller (Poly Haven, public/assets/models/<navn>/<navn>.gltf)
//   Understøtter præcis det modellerne bruger: trekanter (mode 4), POSITION/NORMAL/TEXCOORD_0, ushort/uint-indekser,
//   node-transformationer (translation/rotation/scale/matrix), PBR-materialer (farve, normal, metal/ruhed, AO, emissive + styrke),
//   alphaMode MASK (blade) og BLEND (glas). Ingen eksterne afhængigheder.
//   Resultat pr. model: { parts: { <nodenavn>: [{ geo, mat }] }, all: [{ geo, mat }], box: {min,max} } – geometri i model-rum (meter).
// ==========================================================================
const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

export async function loadGLTF(THREE, url, maxAniso) {
  const base = url.slice(0, url.lastIndexOf('/') + 1);
  const g = await (await fetch(url)).json();
  const bufs = await Promise.all((g.buffers || []).map(b => fetch(base + b.uri).then(r => { if (!r.ok) throw new Error(b.uri + ' ' + r.status); return r.arrayBuffer(); })));
  const acc = i => {
    const a = g.accessors[i], v = g.bufferViews[a.bufferView], T = COMP[a.componentType], n = NCOMP[a.type];
    const off = (v.byteOffset || 0) + (a.byteOffset || 0), stride = v.byteStride || 0, el = n * T.BYTES_PER_ELEMENT;
    if (!stride || stride === el) return new T(bufs[v.buffer], off, a.count * n);
    const out = new T(a.count * n), src = new DataView(bufs[v.buffer]);                // interleaved (sjældent) – pak ud
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out[k * n + c] = T === Float32Array ? src.getFloat32(off + k * stride + c * 4, true) : T === Uint16Array ? src.getUint16(off + k * stride + c * 2, true) : src.getUint32(off + k * stride + c * 4, true);
    return out;
  };
  // teksturer (caches pr. billede, så samme jpg kun hentes én gang)
  const loader = new THREE.TextureLoader(), texCache = new Map();
  const tex = (info, srgb) => {
    if (!info) return null;
    const t0 = g.textures[info.index], img = g.images[t0.source];
    const key = img.uri + (srgb ? '|s' : '|l');
    if (!texCache.has(key)) texCache.set(key, loader.loadAsync(base + img.uri).then(t => { t.flipY = false; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = Math.min(8, maxAniso || 1); return t; }));
    return texCache.get(key);
  };
  const mats = await Promise.all((g.materials || [{}]).map(async m => {
    const p = m.pbrMetallicRoughness || {};
    const [map, normal, orm, ao, em] = await Promise.all([tex(p.baseColorTexture, true), tex(m.normalTexture, false), tex(p.metallicRoughnessTexture, false), tex(m.occlusionTexture, false), tex(m.emissiveTexture, true)]);
    const ormUri = p.metallicRoughnessTexture ? g.images[g.textures[p.metallicRoughnessTexture.index].source].uri : '';
    const ext = m.extensions || {};
    return {
      name: m.name || '', map, normal, orm, ao: ao || (/_arm_/.test(ormUri) ? orm : null),                // Poly Havens ARM-kort: R = AO
      color: p.baseColorFactor || [1, 1, 1, 1], metal: p.metallicFactor === undefined ? 1 : p.metallicFactor, rough: p.roughnessFactor === undefined ? 1 : p.roughnessFactor,
      emissive: m.emissiveFactor || (em ? [1, 1, 1] : [0, 0, 0]), emissiveMap: em, emissiveStrength: (ext.KHR_materials_emissive_strength || {}).emissiveStrength || 1,
      alpha: m.alphaMode || 'OPAQUE', cutoff: m.alphaCutoff === undefined ? 0.5 : m.alphaCutoff, double: !!m.doubleSided, glass: !!ext.KHR_materials_transmission
    };
  }));
  // noder → verdensmatrix (rekursivt fra scenens rødder)
  const M4 = THREE.Matrix4, parts = {}, box = new THREE.Box3(), _v = new THREE.Vector3(), _n = new THREE.Vector3(), nm = new THREE.Matrix3();
  const local = n => n.matrix ? new M4().fromArray(n.matrix) : new M4().compose(new THREE.Vector3(...(n.translation || [0, 0, 0])), new THREE.Quaternion(...(n.rotation || [0, 0, 0, 1])), new THREE.Vector3(...(n.scale || [1, 1, 1])));
  const visit = (ni, parent, rootName) => {
    const n = g.nodes[ni], wm = parent.clone().multiply(local(n)), name = rootName || n.name || ('node' + ni);
    if (n.mesh !== undefined) {
      nm.getNormalMatrix(wm);
      for (const pr of g.meshes[n.mesh].primitives) {
        if ((pr.mode === undefined ? 4 : pr.mode) !== 4) continue;
        const P = acc(pr.attributes.POSITION), N = pr.attributes.NORMAL !== undefined ? acc(pr.attributes.NORMAL) : null, U = pr.attributes.TEXCOORD_0 !== undefined ? acc(pr.attributes.TEXCOORD_0) : null;
        const pos = new Float32Array(P.length), nor = new Float32Array(P.length);
        for (let k = 0; k < P.length; k += 3) {
          _v.set(P[k], P[k + 1], P[k + 2]).applyMatrix4(wm); pos[k] = _v.x; pos[k + 1] = _v.y; pos[k + 2] = _v.z; box.expandByPoint(_v);
          if (N) { _n.set(N[k], N[k + 1], N[k + 2]).applyMatrix3(nm).normalize(); nor[k] = _n.x; nor[k + 1] = _n.y; nor[k + 2] = _n.z; }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        if (N) geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        if (U) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(U), 2));
        if (pr.indices !== undefined) { const I = acc(pr.indices); geo.setIndex(new THREE.BufferAttribute(I instanceof Uint32Array ? I : new Uint16Array(I), 1)); }
        if (!N) geo.computeVertexNormals();
        (parts[name] || (parts[name] = [])).push({ geo, mat: mats[pr.material === undefined ? 0 : pr.material] });
      }
    }
    for (const c of n.children || []) visit(c, wm, name);
  };
  for (const r of g.scenes[g.scene || 0].nodes) visit(r, new M4(), null);
  // hele modellen: dele med samme materiale lægges sammen (færre draw calls)
  const all = mergeByMaterial(THREE, Object.values(parts).flat());
  for (const k in parts) parts[k] = mergeByMaterial(THREE, parts[k]);
  return { parts, all, box };
}
function mergeByMaterial(THREE, list) {
  const byMat = new Map();
  for (const p of list) { if (!byMat.has(p.mat)) byMat.set(p.mat, []); byMat.get(p.mat).push(p.geo); }
  const out = [];
  for (const [mat, geos] of byMat) {
    if (geos.length === 1) { out.push({ geo: geos[0], mat }); continue; }
    let nv = 0, ni = 0; for (const g of geos) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let vo = 0, io = 0;
    for (const g of geos) {
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
      if (g.index) { const I = g.index.array; for (let k = 0; k < I.length; k++) idx[io + k] = I[k] + vo; io += I.length; } else { for (let k = 0; k < n; k++) idx[io + k] = vo + k; io += n; }
      vo += n;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
    out.push({ geo, mat });
  }
  return out;
}
/* ==========================================================================
   v11.3: GLB (binær glTF) → three.js-scenegraf med skeletter (SkinnedMesh), til spillerfigurer og våben.
   Understøtter: GLB-container (JSON + BIN-chunk), indlejrede billeder (bufferView + mimeType), node-hierarki (TRS/matrix),
   skins (joints + inverseBindMatrices), PBR-materialer (farve/tekstur, metal/ruhed, emissive). Animationer ignoreres –
   figurerne drives af spillets eget (netværkssynkroniserede) animationssystem via retargeting.
   loadGLB(THREE, url) -> { scene, materials }   ·   cloneSkinned(root) laver en uafhængig kopi (egne knogler pr. spiller)
   ========================================================================== */
export async function loadGLB(THREE, url) {
  const buf = await (await fetch(url)).arrayBuffer();
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('ikke en GLB-fil: ' + url);
  let off = 12, json = null, bin = null;
  while (off < buf.byteLength) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
    if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, off + 8, len)));
    else if (type === 0x004E4942) bin = buf.slice(off + 8, off + 8 + len);
    off += 8 + len;
  }
  const g = json;
  const acc = i => {
    const a = g.accessors[i], v = g.bufferViews[a.bufferView], T = COMP[a.componentType], n = NCOMP[a.type];
    const o0 = (v.byteOffset || 0) + (a.byteOffset || 0), stride = v.byteStride || 0, el = n * T.BYTES_PER_ELEMENT;
    if (!stride || stride === el) return new T(bin.slice(o0, o0 + a.count * el));
    const out = new T(a.count * n), src = new DataView(bin);
    const rd = T === Float32Array ? (p) => src.getFloat32(p, true) : T === Uint16Array ? (p) => src.getUint16(p, true) : T === Uint8Array ? (p) => src.getUint8(p) : (p) => src.getUint32(p, true);
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out[k * n + c] = rd(o0 + k * stride + c * T.BYTES_PER_ELEMENT);
    return out;
  };
  // indlejrede billeder → teksturer
  const texCache = new Map();
  const tex = async (info, srgb) => {
    if (!info) return null;
    const t0 = g.textures[info.index], im = g.images[t0.source], key = t0.source + (srgb ? 's' : 'l');
    if (!texCache.has(key)) texCache.set(key, (async () => {
      const v = g.bufferViews[im.bufferView], blob = new Blob([new Uint8Array(bin, v.byteOffset || 0, v.byteLength)], { type: im.mimeType || 'image/png' });
      const bmp = await createImageBitmap(blob, { imageOrientation: 'none' });
      const t = new THREE.Texture(bmp); t.flipY = false; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.needsUpdate = true; return t;
    })());
    return texCache.get(key);
  };
  const materials = await Promise.all((g.materials || [{}]).map(async m => {
    const p = m.pbrMetallicRoughness || {}, c = p.baseColorFactor || [1, 1, 1, 1];
    const mat = new THREE.MeshStandardMaterial({ name: m.name || '', color: new THREE.Color(c[0], c[1], c[2]), metalness: p.metallicFactor === undefined ? 1 : p.metallicFactor, roughness: p.roughnessFactor === undefined ? 1 : p.roughnessFactor, side: m.doubleSided ? THREE.DoubleSide : THREE.FrontSide });
    mat.map = await tex(p.baseColorTexture, true);
    if (m.alphaMode === 'MASK') mat.alphaTest = m.alphaCutoff === undefined ? 0.5 : m.alphaCutoff;
    if (m.alphaMode === 'BLEND') { mat.transparent = true; mat.opacity = c[3]; }
    if (m.emissiveFactor) mat.emissive.setRGB(...m.emissiveFactor);
    return mat;
  }));
  // noder
  const nodes = g.nodes.map((n, i) => {
    const isJoint = (g.skins || []).some(s => s.joints.includes(i));
    const o = isJoint ? new THREE.Bone() : new THREE.Object3D();
    o.name = n.name || ('node' + i);
    if (n.matrix) new THREE.Matrix4().fromArray(n.matrix).decompose(o.position, o.quaternion, o.scale);
    else { if (n.translation) o.position.fromArray(n.translation); if (n.rotation) o.quaternion.fromArray(n.rotation); if (n.scale) o.scale.fromArray(n.scale); }
    return o;
  });
  g.nodes.forEach((n, i) => { for (const c of n.children || []) nodes[i].add(nodes[c]); });
  const skins = (g.skins || []).map(s => {
    const ibm = s.inverseBindMatrices !== undefined ? acc(s.inverseBindMatrices) : null;
    const bones = s.joints.map(j => nodes[j]), inv = bones.map((b, k) => ibm ? new THREE.Matrix4().fromArray(ibm, k * 16) : new THREE.Matrix4());
    return { bones, inv };
  });
  g.nodes.forEach((n, i) => {
    if (n.mesh === undefined) return;
    const mesh = g.meshes[n.mesh];
    for (const pr of mesh.primitives) {
      if ((pr.mode === undefined ? 4 : pr.mode) !== 4) continue;
      const geo = new THREE.BufferGeometry(), A = pr.attributes;
      geo.setAttribute('position', new THREE.BufferAttribute(acc(A.POSITION), 3));
      if (A.NORMAL !== undefined) geo.setAttribute('normal', new THREE.BufferAttribute(acc(A.NORMAL), 3));
      if (A.TEXCOORD_0 !== undefined) geo.setAttribute('uv', new THREE.BufferAttribute(acc(A.TEXCOORD_0), 2));
      if (pr.indices !== undefined) { const I = acc(pr.indices); geo.setIndex(new THREE.BufferAttribute(I instanceof Uint8Array ? new Uint16Array(I) : I, 1)); }
      if (A.NORMAL === undefined) geo.computeVertexNormals();
      const mat = materials[pr.material === undefined ? 0 : pr.material];
      let obj;
      if (n.skin !== undefined && A.JOINTS_0 !== undefined) {
        const J = acc(A.JOINTS_0), Wt = acc(A.WEIGHTS_0);
        geo.setAttribute('skinIndex', new THREE.BufferAttribute(J instanceof Uint16Array ? J : new Uint16Array(J), 4));
        geo.setAttribute('skinWeight', new THREE.BufferAttribute(Wt instanceof Float32Array ? Wt : Float32Array.from(Wt, v => v / (Wt instanceof Uint8Array ? 255 : 65535)), 4));
        obj = new THREE.SkinnedMesh(geo, mat); obj.userData.skin = n.skin;
      } else obj = new THREE.Mesh(geo, mat);
      obj.name = mesh.name || n.name || '';
      nodes[i].add(obj);
    }
  });
  const scene = new THREE.Group();
  for (const r of g.scenes[g.scene || 0].nodes) scene.add(nodes[r]);
  scene.updateMatrixWorld(true);
  // glTF-spec: en skinnet meshs egen node-transformation ignoreres (vertices er i skelettets rum) => flyt til roden og bind med identitet
  const skinned = []; scene.traverse(o => { if (o.isSkinnedMesh) skinned.push(o); });
  for (const o of skinned) { scene.add(o); o.position.set(0, 0, 0); o.quaternion.identity(); o.scale.set(1, 1, 1); }
  scene.updateMatrixWorld(true);
  for (const o of skinned) { const s = skins[o.userData.skin]; o.bind(new THREE.Skeleton(s.bones, s.inv), new THREE.Matrix4()); o.normalizeSkinWeights && o.normalizeSkinWeights(); }
  return { scene, materials };
}
// uafhængig kopi af en (evt. skinnet) scenegraf: knogler klones med, skinnede meshes bindes til de nye knogler
export function cloneSkinned(THREE, root) {
  const map = new Map(), clone = root.clone(true);
  const a = [], b = []; root.traverse(o => a.push(o)); clone.traverse(o => b.push(o));
  a.forEach((o, i) => map.set(o, b[i]));
  clone.updateMatrixWorld(true);
  a.forEach((o, i) => { if (!o.isSkinnedMesh) return; const c = b[i]; const sk = o.skeleton; c.bind(new THREE.Skeleton(sk.bones.map(x => map.get(x)), sk.boneInverses.map(m => m.clone())), o.bindMatrix.clone()); });
  return clone;
}
// 'bager' en (evt. skinnet) model til statisk geometri i modelrum (hvilestilling) – til våben (ingen knogleanimation nødvendig)
export function bakeStatic(THREE, root) {
  root.updateMatrixWorld(true);
  const out = new THREE.Group(), v = new THREE.Vector3(), nm = new THREE.Matrix3();
  root.traverse(o => {
    if (!o.isMesh) return;
    const src = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(), P = src.attributes.position, N = src.attributes.normal;
    const pos = new Float32Array(P.count * 3), nor = new Float32Array(P.count * 3);
    nm.getNormalMatrix(o.matrixWorld);
    const orig = o.geometry; o.geometry = src;                                   // applyBoneTransform læser skinIndex/-Weight fra o.geometry
    for (let k = 0; k < P.count; k++) {
      v.fromBufferAttribute(P, k);
      if (o.isSkinnedMesh) { o.applyBoneTransform(k, v); v.applyMatrix4(o.matrixWorld); } else v.applyMatrix4(o.matrixWorld);   // applyBoneTransform giver mesh-lokalt rum
      pos[k * 3] = v.x; pos[k * 3 + 1] = v.y; pos[k * 3 + 2] = v.z;
      if (N) { v.fromBufferAttribute(N, k).applyMatrix3(nm).normalize(); nor[k * 3] = v.x; nor[k * 3 + 1] = v.y; nor[k * 3 + 2] = v.z; }
    }
    o.geometry = orig;
    const uvA = src.attributes.uv ? Float32Array.from(src.attributes.uv.array) : null;
    if (o.matrixWorld.determinant() < 0) for (let t3 = 0; t3 < P.count; t3 += 3) {          // spejlet node (negativ skala): vend trekanternes vinding
      for (const arr of [pos, nor]) for (let c = 0; c < 3; c++) { const k = t3 * 3, tmp = arr[k + 3 + c]; arr[k + 3 + c] = arr[k + 6 + c]; arr[k + 6 + c] = tmp; }
      if (uvA) for (let c = 0; c < 2; c++) { const k = t3 * 2, tmp = uvA[k + 2 + c]; uvA[k + 2 + c] = uvA[k + 4 + c]; uvA[k + 4 + c] = tmp; }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    if (uvA) geo.setAttribute('uv', new THREE.BufferAttribute(uvA, 2));
    if (!N) geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, o.material); m.name = o.name; if (o.userData.part) m.userData.part = o.userData.part; out.add(m);   // part: fx 'mag' (genladning)
  });
  return out;
}
// geometriens trekant-antal (til budget/telemetri)
export const triCount = parts => parts.reduce((s, p) => s + (p.geo.index ? p.geo.index.count : p.geo.attributes.position.count) / 3, 0);

// v14: grov afstands-LOD til tunge modeldele (vertex-clustering): hjørner samles i et gitter (res celler over modellens største mål),
//   adskilt efter normalretning og UV-felt så teksturerne ikke smøres hen over sømme. Trekanter der kollapser forsvinder.
export function clusterLOD(THREE, geo, res) {
  const P = geo.attributes.position.array, N = geo.attributes.normal.array, U = geo.attributes.uv ? geo.attributes.uv.array : null;
  geo.computeBoundingBox(); const bb = geo.boundingBox, cs = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z, 1e-3) / res;
  const n = P.length / 3, map = new Uint32Array(n), keys = new Map(), acc = [];
  for (let i = 0; i < n; i++) {
    const nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2], ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    const dir = ax >= ay && ax >= az ? (nx > 0 ? 0 : 1) : ay >= az ? (ny > 0 ? 2 : 3) : (nz > 0 ? 4 : 5);
    const k = Math.floor((P[i * 3] - bb.min.x) / cs) + ',' + Math.floor((P[i * 3 + 1] - bb.min.y) / cs) + ',' + Math.floor((P[i * 3 + 2] - bb.min.z) / cs) + ',' + dir + (U ? ',' + Math.floor(U[i * 2] * 4) + ',' + Math.floor(U[i * 2 + 1] * 4) : '');
    let c = keys.get(k); if (c === undefined) { c = acc.length; keys.set(k, c); acc.push([0, 0, 0, 0, 0, 0, 0, 0, 0]); }
    const a = acc[c]; a[0] += P[i * 3]; a[1] += P[i * 3 + 1]; a[2] += P[i * 3 + 2]; a[3] += nx; a[4] += ny; a[5] += nz; if (U) { a[6] += U[i * 2]; a[7] += U[i * 2 + 1]; } a[8]++;
    map[i] = c;
  }
  const m = acc.length, pos = new Float32Array(m * 3), nor = new Float32Array(m * 3), uv = new Float32Array(m * 2);
  acc.forEach((a, c) => { const w = 1 / a[8], l = Math.hypot(a[3], a[4], a[5]) || 1; pos.set([a[0] * w, a[1] * w, a[2] * w], c * 3); nor.set([a[3] / l, a[4] / l, a[5] / l], c * 3); uv.set([a[6] * w, a[7] * w], c * 2); });
  const I = geo.index ? geo.index.array : null, nt = (I ? I.length : n) / 3, out = [];
  for (let t = 0; t < nt; t++) { const A = map[I ? I[t * 3] : t * 3], B = map[I ? I[t * 3 + 1] : t * 3 + 1], C = map[I ? I[t * 3 + 2] : t * 3 + 2]; if (A !== B && B !== C && A !== C) out.push(A, B, C); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); if (U) g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(m > 65535 ? new Uint32Array(out) : new Uint16Array(out), 1));
  return g;
}
