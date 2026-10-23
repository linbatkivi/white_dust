// ==========================================================================
// v26.13 · vandets spejling (Niseko): planar refleksion i halv opløsning. Kanalen og alle damme ligger i samme højde, så ét ekstra pas
// (kameraet spejlet i vandplanet) giver rigtige spejlbilleder af lanterner, lyste vinduer, træer og huse. Passet køres kun når vand er i
// billedet og tættere end FAR m; ellers falder vandet tilbage til himmel-IBL. Skyggekortet genbruges (ingen ekstra skyggepas).
//   createWaterFx({ THREE, renderer, scene, root, uniforms, level }) -> { update(camera), dispose(), active }
// ==========================================================================
export function createWaterFx(o) {
  const { THREE, renderer, scene, root, uniforms } = o;
  const water = [];
  root.traverse(m => { if (m.isMesh && m.userData && m.userData.havn && m.userData.havn.mat === 'water') water.push(m); });
  if (!water.length) return null;
  if (!uniforms.reflMat.value) uniforms.reflMat.value = new THREE.Matrix4();
  const level = o.level !== undefined ? o.level : -0.08, FAR = o.far || 70, SCALE = o.scale || 0.5;
  const box = new THREE.Box3(); for (const m of water) { m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox.clone(); b.min.multiply(m.scale).add(m.position); b.max.multiply(m.scale).add(m.position); box.union(b); }
  const rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: false, samples: 0 });
  rt.texture.minFilter = THREE.LinearFilter; rt.texture.magFilter = THREE.LinearFilter; rt.texture.generateMipmaps = false;
  const vcam = new THREE.PerspectiveCamera(); const normal = new THREE.Vector3(0, 1, 0), planePos = new THREE.Vector3(0, level, 0);
  const view = new THREE.Vector3(), camPos = new THREE.Vector3(), lookAt = new THREE.Vector3(), target = new THREE.Vector3(), rot = new THREE.Matrix4(), plane = new THREE.Plane(), clip = new THREE.Vector4(), q = new THREE.Vector4();
  const fr = new THREE.Frustum(), pm = new THREE.Matrix4(); const sz = new THREE.Vector2();
  let active = false, size = [0, 0];
  const ext = []; const savedVis = [];
  function update(camera) {
    if (!uniforms) return;
    camPos.setFromMatrixPosition(camera.matrixWorld);
    // vand i billedet og i nærheden?
    pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); fr.setFromProjectionMatrix(pm);
    const near = box.distanceToPoint(camPos) < FAR && fr.intersectsBox(box) && camPos.y > level + 0.05;
    uniforms.reflOn.value = 0; active = false;
    if (!near) return;
    renderer.getDrawingBufferSize(sz); const w = Math.max(64, Math.floor(sz.x * SCALE)), h = Math.max(64, Math.floor(sz.y * SCALE));
    if (w !== size[0] || h !== size[1]) { rt.setSize(w, h); size = [w, h]; }
    // spejlkamera (som three's Reflector)
    view.subVectors(planePos, camPos); if (view.dot(normal) > 0) return;
    view.reflect(normal).negate(); view.add(planePos);
    rot.extractRotation(camera.matrixWorld); lookAt.set(0, 0, -1).applyMatrix4(rot).add(camPos);
    target.subVectors(planePos, lookAt); target.reflect(normal).negate(); target.add(planePos);
    vcam.position.copy(view); vcam.up.set(0, 1, 0).applyMatrix4(rot).reflect(normal); vcam.lookAt(target);
    vcam.far = Math.min(camera.far, FAR * 1.6); vcam.near = camera.near; vcam.fov = camera.fov; vcam.aspect = camera.aspect;
    vcam.updateMatrixWorld(); vcam.projectionMatrix.copy(camera.projectionMatrix); vcam.projectionMatrix.elements[10] = camera.projectionMatrix.elements[10]; vcam.matrixWorldInverse.copy(vcam.matrixWorld).invert();
    uniforms.reflMat.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(vcam.projectionMatrix).multiply(vcam.matrixWorldInverse);
    // skrå nærplan (kun ting over vandet tegnes)
    plane.setFromNormalAndCoplanarPoint(normal, planePos); plane.applyMatrix4(vcam.matrixWorldInverse); clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const P = vcam.projectionMatrix;
    q.x = (Math.sign(clip.x) + P.elements[8]) / P.elements[0]; q.y = (Math.sign(clip.y) + P.elements[9]) / P.elements[5]; q.z = -1.0; q.w = (1.0 + P.elements[10]) / P.elements[14];
    clip.multiplyScalar(2.0 / clip.dot(q));
    P.elements[2] = clip.x; P.elements[6] = clip.y; P.elements[10] = clip.z + 1.0 - 0.003; P.elements[14] = clip.w;
    // tegn scenen uden vandet
    for (const m of water) { savedVis.push(m.visible); m.visible = false; }
    const prevRT = renderer.getRenderTarget(), prevXr = renderer.xr.enabled, prevShadowAuto = renderer.shadowMap.autoUpdate, prevAutoClear = renderer.autoClear;
    renderer.xr.enabled = false; renderer.setRenderTarget(rt); renderer.autoClear = true;
    renderer.clear(true, true, true); renderer.render(scene, vcam);
    renderer.setRenderTarget(prevRT); renderer.xr.enabled = prevXr; renderer.autoClear = prevAutoClear; renderer.shadowMap.autoUpdate = prevShadowAuto;
    for (let i = 0; i < water.length; i++) water[i].visible = savedVis[i]; savedVis.length = 0;
    uniforms.reflTex.value = rt.texture; uniforms.reflOn.value = 1.0; active = true;
  }
  function dispose() { rt.dispose(); uniforms.reflOn.value = 0; uniforms.reflTex.value = null; }
  return { update, dispose, get active() { return active; } };
}
