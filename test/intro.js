// v22: intro-cutscenen – køretøjets vej ind til hvert holds spawn findes på alle baner (fri og flad strækning, ikke inde i vægge)
// v26: helikopter-ankomst (de_bureau): skrog og rotor fri af bygningen, mændene lander på terrassegulvet
const fs = require('fs'), os = require('os'), path = require('path'), url = require('url');
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdintro-')), pub = path.join(__dirname, '..', 'public');
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  fs.copyFileSync(path.join(pub, 'vendor', 'three.module.min.js'), path.join(dir, 'three.module.min.js'));
  fs.copyFileSync(path.join(pub, 'js', 'intro.js'), path.join(dir, 'intro.js'));
  const imp = f => import(url.pathToFileURL(path.join(dir, f)).href);
  const THREE = await imp('three.module.min.js'), { createIntro } = await imp('intro.js');
  const WD = require('../shared/wd.js');
  const I = createIntro({ THREE, WD });
  let fail = 0;
  console.log('\n=== INTRO: køretøjets vej ind til spawn ===');
  for (const mp of WD.MAP_LIST) {
    const W = WD.buildWorld(mp.id);
    for (const side of ['swat', 'hij']) {
      const H = W.data && W.data.intro && W.data.intro[side];
      if (H && H.mode === 'heli') {                                          // v26: helikopter – svæver frit ud for brystningen, mændene lander på terrassen
        const meta = JSON.parse(fs.readFileSync(path.join(pub, 'assets', 'vehicles', 'heli.json'), 'utf8'));
        const [hx, hy, hz] = H.hover, fx = Math.sin(H.yaw), fz = Math.cos(H.yaw), rx = Math.cos(H.yaw), rz = -Math.sin(H.yaw);
        let body = 0, rotor = 0;
        for (let a = -meta.len * 0.7; a <= 3.1; a += 0.5) for (const b of [-1.2, 0, 1.2]) {   // skrog + skids (bredde 2,4 m), 0–3 m over svævehøjden
          const x = hx + fx * a + rx * b, z = hz + fz * a + rz * b; if (WD.isBlocked(W, x, z, hy, 3.0, 0)) body++;
        }
        const ry = hy + meta.rotorY;
        for (let k = 0; k < 64; k++) for (const rr of [1.5, 3, 4.5, meta.rotorR]) {   // rotorskiven må ikke ramme noget
          const a = k / 64 * Math.PI * 2, x = hx + fx * meta.rotorZ + Math.cos(a) * rr, z = hz + fz * meta.rotorZ + Math.sin(a) * rr; if (WD.isBlocked(W, x, z, ry - 0.3, 0.6, 0)) rotor++;
        }
        const land = [-2, -1, 0, 1, 2].map(i => [hx + fx * i * 0.95, H.edge - 1.2]).filter(([x, z]) => Math.abs(WD.groundAt(W, x, z, 0.5, 0.6)) < 0.05 && !WD.isBlocked(W, x, z, 0, 1.8));
        const ok = body === 0 && rotor === 0 && land.length === 5 && hy > H.parapet;
        if (!ok) fail++;
        console.log(`  ${ok ? 'ok  ' : 'FEJL'} ${mp.id.padEnd(11)} ${side.padEnd(4)} helikopter: skrog fri (${body}), rotor fri (${rotor}), ${land.length}/5 landingspunkter på terrassen, skids ${hy} m > brystning ${H.parapet} m`);
        continue;
      }
      const P = I.plan(W, side), car = !!P && P.score > 0 && P.drive >= 6, F = !car && P ? I.planFoot(W, side, P) : null, ok = car || (F && F.clear >= 6);
      if (!ok) fail++;
      console.log(`  ${ok ? 'ok  ' : 'FEJL'} ${mp.id.padEnd(11)} ${side.padEnd(4)} ` + (car ? `køretøj: kører ${P.drive} m · stopper ${P.d} m fra spawn` : `til fods: ${F ? F.clear : 0} m fri gyde (ingen plads til køretøj)`));
    }
  }
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(fail ? `\n${fail} fejlet` : '\nALT OK');
  process.exit(fail ? 1 : 0);
})();
