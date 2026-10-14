// v22: intro-cutscenen – køretøjets vej ind til hvert holds spawn findes på alle baner (fri og flad strækning, ikke inde i vægge)
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
      const P = I.plan(W, side), car = !!P && P.score > 0 && P.drive >= 6, F = !car && P ? I.planFoot(W, side, P) : null, ok = car || (F && F.clear >= 6);
      if (!ok) fail++;
      console.log(`  ${ok ? 'ok  ' : 'FEJL'} ${mp.id.padEnd(11)} ${side.padEnd(4)} ` + (car ? `køretøj: kører ${P.drive} m · stopper ${P.d} m fra spawn` : `til fods: ${F ? F.clear : 0} m fri gyde (ingen plads til køretøj)`));
    }
  }
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(fail ? `\n${fail} fejlet` : '\nALT OK');
  process.exit(fail ? 1 : 0);
})();
