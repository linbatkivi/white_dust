// Ende-til-ende-browsertest med Playwright: to spillere spiller en rigtig runde gennem den rigtige klient (de_bureau).
// Kræver Playwright:  npm i -D playwright && npx playwright install chromium   →   node test/e2e.js
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('Playwright er ikke installeret – kør: npm i -D playwright && npx playwright install chromium'); process.exit(0); }
const { spawn } = require('child_process');
const path = require('path');
const PORT = 3461;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0, passes = 0;
const ok = (c, msg) => { if (c) { passes++; console.log('  ✓ ' + msg); } else { fails++; console.log('  ✗ FEJL: ' + msg); } };

async function main() {
  const srv = spawn('node', [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT, WD_FAST: '1' }), stdio: ['ignore', 'pipe', 'pipe'] });
  srv.stdout.on('data', () => {});
  await sleep(700);
  const browser = await chromium.launch({ args: process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const consoleErrors = { A: [], B: [] };
  const mkPage = async (label) => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 720 } });
    const page = await ctx.newPage();
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors[label].push(msg.text()); });
    page.on('pageerror', err => consoleErrors[label].push('PAGEERROR: ' + err.message));
    await page.goto(`http://localhost:${PORT}/?dev=1`);
    return page;
  };
  try {
    console.log('\n== Lobby & map pool ==');
    const A = await mkPage('A'), B = await mkPage('B');
    await A.fill('#nameInput', 'Alice'); await A.click('#btnCreate');
    await A.waitForSelector('#scr-lobby:not(.hidden)', { timeout: 5000 });
    const code = await A.$eval('#lobbyCode', el => el.textContent.trim());
    ok(/^\d{4}$/.test(code), 'LAV PARTY giver 4-cifret kode (' + code + ')');
    await B.fill('#nameInput', 'Bob'); await B.click('#btnShowJoin'); await B.fill('#codeInput', code); await B.click('#btnJoin');
    await B.waitForSelector('#scr-lobby:not(.hidden)', { timeout: 5000 });
    ok(await A.isVisible('.lb-mission'), 'Venteværelset viser missionskortet for de_bureau');
    ok(await A.$$eval('#listHij li.slot-empty, #listSwat li.slot-empty', els => els.length) >= 8, 'Holdene viser deres ledige pladser');
    await A.click('#btnTeamHij'); await B.click('#btnTeamSwat'); await sleep(200);

    console.log('\n== Spilstart, banen bygges, HUD ==');
    await A.click('#btnStart');
    await A.waitForSelector('#hud:not(.hidden)', { timeout: 5000 }); await B.waitForSelector('#hud:not(.hidden)', { timeout: 5000 });
    await A.waitForFunction(() => window.__wd && __wd.Renderer.mapId === 'bureau' && __wd.Renderer.mapReady(), null, { timeout: 120000 });
    ok(true, 'de_bureau indlæses (bagt lys) og vises');
    ok(await A.$eval('#weaponName', el => el.textContent) === 'GLOCK-18', 'Hijackers starter med Glock-18');
    ok(await B.$eval('#weaponName', el => el.textContent) === 'USP-S', 'SWAT starter med USP-S');
    ok(await A.isVisible('#buyHint') || await A.evaluate(() => __wd.Game.phase !== 'buy'), 'Købsmulighed vises i købsfasen (tryk B)');
    await A.click('#clickToPlay'); await sleep(200);
    if (process.env.E2E_HEADED) ok(await A.evaluate(() => document.pointerLockElement != null), 'Pointer lock aktiveres ved klik');   // (findes ikke i headless-browsere)

    console.log('\n== Runde ==');
    await A.waitForFunction(() => document.getElementById('roundLabel').textContent.includes('RUNDE'), null, { timeout: 30000 });
    ok(true, 'Runden går fra købsfase til live');
    ok(await A.evaluate(() => { const c = document.getElementById('minimap'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true; return false; }), 'Minimap tegner banens lag');
    await A.keyboard.down('Tab'); await sleep(300); ok(await A.isVisible('#scoreboard'), 'Scoreboard vises når Tab holdes'); await A.keyboard.up('Tab');
    ok(await A.evaluate(() => __wd.Game.remotes.size === 1), 'Modspilleren renderes som 3D-model');

    console.log('\n== Ingen JS-fejl ==');
    const relevant = arr => arr.filter(e => !/fonts\.googleapis|fonts\.gstatic|status of 403|pointer lock/i.test(e));
    ok(relevant(consoleErrors.A).length === 0, 'Ingen konsolfejl hos Alice' + (relevant(consoleErrors.A).length ? ':\n    ' + relevant(consoleErrors.A).slice(0, 5).join('\n    ') : ''));
    ok(relevant(consoleErrors.B).length === 0, 'Ingen konsolfejl hos Bob' + (relevant(consoleErrors.B).length ? ':\n    ' + relevant(consoleErrors.B).slice(0, 5).join('\n    ') : ''));
  } catch (e) { fails++; console.error('TESTFEJL:', e); }
  await browser.close(); srv.kill();
  console.log(`\n${passes} bestået, ${fails} fejlet`);
  process.exit(fails ? 1 : 0);
}
main();
