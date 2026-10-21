// Optager traileren som video (docs/trailer/white_dust_trailer.webm):  node scripts/record-trailer.js [bredde] [højde]
// Kræver playwright (npm i -D playwright && npx playwright install chromium). Starter en testserver, afspiller traileren i motoren i realtid og gemmer
// canvas + lyd via MediaRecorder (VP8 + Opus). Trailer-koden ligger i public/js/trailer.js (tidslinje, kameraer, figurer, titler).
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const path = require('path');
const S = ms => new Promise(r => setTimeout(r, ms)), PORT = 3499;
(async () => {
  const srv = spawn('node', [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), WD_TEST: '1' }), stdio: 'ignore' }); await S(900);
  const W = +(process.argv[2] || 1920), H = +(process.argv[3] || 1080);
  const b = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.goto(`http://localhost:${PORT}/?dev=1&trailer=1&rec=1`, { waitUntil: 'commit' }); await p.waitForFunction(() => window.__wdStartTrailer, null, { timeout: 120000 }); await S(1500);
  await p.evaluate(() => window.__wdStartTrailer());
  for (let n = 0; n < 400 && !(await p.evaluate(() => window.__trailerDone)); n++) await S(1000);
  await S(3000); console.log('gemt:', await p.evaluate(() => [window.__trailerSaved, Math.round((window.__trailerBytes || 0) / 1e6) + ' MB']));
  await b.close(); srv.kill();
})();
