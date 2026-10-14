// ==========================================================================
// v21: AGENT-SCENE – en lille selvstændig 3D-scene med en spillerfigur (samme figurer/animationer som i spillet).
//   Bruges af forsidens spiller-hjørne og af MVP-animationen når en runde er vundet. Egen renderer pr. scene; tegner kun mens den kører.
// createAgentStage(THREE, canvas, { chars, weaponCode, cam, look, fov, exposure }) -> { setAgent, start, stop, scene, cam, h, onFrame }
// ==========================================================================
export function createAgentStage(THREE, canvas, o) {
  let R = null;
  try { R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' }); } catch (e) { return null; }
  R.setPixelRatio(Math.min(2, devicePixelRatio || 1)); R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = o.exposure || 1.12;
  R.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(o.fov || 28, 1, 0.05, 60);
  scene.add(new THREE.HemisphereLight(0xf4f2ee, 0x5a5048, 2.0));
  const key = new THREE.DirectionalLight(0xfff3e2, 3.0); key.position.set(3, 4.5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff5a40, 2.6); rim.position.set(-4, 2.5, -3); scene.add(rim);
  const back = new THREE.DirectionalLight(0x8fb4ff, 1.2); back.position.set(3, 2, -4); scene.add(back);
  const st = { h: null, side: null, key: null, gun: null, run: false, raf: 0, last: 0, t: 0, yaw: Math.PI, onFrame: null };
  function setAgent(side, key, gun) {
    const C = o.chars(); if (!C) return null;
    if (st.h) { scene.remove(st.h.group); st.h = null; }
    const h = C.buildHuman(side, key); C.setBake(h, [0.06, 0.06, 0.06, 1]); h.label = null;
    scene.add(h.group); st.h = h; st.side = side; st.key = key; st.gun = gun || (side === 'hij' ? 'ak47' : 'm4a1');
    return h;
  }
  function size() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    if (canvas.width !== Math.floor(w * R.getPixelRatio()) || canvas.height !== Math.floor(h * R.getPixelRatio())) { R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  }
  function frame(tms) {
    if (!st.run) return; st.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (tms - (st.last || tms)) / 1000); st.last = tms; st.t += dt;
    size();
    const C = o.chars();
    const pose = { x: 0, y: 0, z: 0, yaw: st.yaw, pitch: 0, alive: true, grounded: true, wcode: o.weaponCode(st.gun) };
    if (st.onFrame) st.onFrame(dt, st.t, pose, st);
    if (st.h && C) C.animateHuman(st.h, dt, st.t, pose);
    if (o.cam) cam.position.set(...o.cam); if (o.look) cam.lookAt(...o.look);
    if (st.afterPose) st.afterPose(dt, st.t, st);
    R.render(scene, cam);
  }
  return Object.assign(st, {
    scene, cam, R, setAgent,
    start() { if (st.run) return; st.run = true; st.last = 0; st.raf = requestAnimationFrame(frame); },
    stop() { st.run = false; cancelAnimationFrame(st.raf); }
  });
}
