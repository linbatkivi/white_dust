#!/usr/bin/env node
// ==========================================================================
// v25: SPIL-OPDATERINGER UDEN NY APP – appen henter kun de filer der er ændret.
//
//   node scripts/game-update.js --base <fil>   skriv fingeraftryk af spillets filer (lægges ind i appen ved bygning)
//   node scripts/game-update.js --publish      udgiv den nuværende udgave til alle spillere:
//      1. kræver at alt er committed og pushet (filerne hentes fra GitHub ved det commit)
//      2. Git LFS-filer (*.bin) lægges på releasen "game-files" som <sha256>.bin (raw.githubusercontent kan ikke levere LFS)
//      3. manifestet skrives til hjemmesiden (../wd-web eller WD_WEB) som game/manifest.json og pushes til GitHub Pages
//
// Manifest: { game, commit, created, minApp, raw, lfs, files: { "public/js/app.js": [sha256, bytes, lfs?] } }
// Appen (desktop/main.js) sammenligner med sine egne filer, henter forskellene, tjekker sha256 og skifter først når alt er hentet.
// ==========================================================================
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const REPO = 'linbatkivi/white_dust', LFS_TAG = 'game-files';
const MIN_APP = '1.1.0';                                  // ældre apps kender ikke opdateringssystemet

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.DS_Store' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
// samme filer som appen pakker (desktop/package.json → extraResources)
function gameFiles() {
  const pub = walk(path.join(ROOT, 'public')).filter(f => !path.relative(ROOT, f).split(path.sep).includes('dev'));
  const sh = walk(path.join(ROOT, 'shared')).filter(f => f.endsWith('.js'));
  return [...pub, ...sh, path.join(ROOT, 'server.js')].map(f => path.relative(ROOT, f).split(path.sep).join('/')).sort();
}
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex');
function lfsSet() {
  try { return new Set(execSync('git lfs ls-files -n', { cwd: ROOT }).toString().split('\n').filter(Boolean)); } catch (e) { return new Set(); }
}
function manifest() {
  const lfs = lfsSet(), files = {};
  for (const f of gameFiles()) { const st = fs.statSync(path.join(ROOT, f)); files[f] = lfs.has(f) ? [sha(f), st.size, 1] : [sha(f), st.size]; }
  return { files };
}
const sh = (c, o) => execSync(c, Object.assign({ cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] }, o || {})).toString().trim();

const arg = process.argv[2];
if (arg === '--base') {
  const out = process.argv[3]; const m = manifest(); m.game = 'base';
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(m));
  console.log('fingeraftryk:', Object.keys(m.files).length, 'filer →', out);
} else if (arg === '--publish') {
  if (sh('git status --porcelain -- public shared server.js')) { console.error('✗ commit spillets ændringer først (public/, shared/, server.js)'); process.exit(1); }
  sh('git fetch -q origin');
  const commit = sh('git rev-parse HEAD');
  if (!sh('git branch -r --contains ' + commit)) { console.error('✗ push først – commit ' + commit.slice(0, 7) + ' findes ikke på GitHub'); process.exit(1); }
  const m = manifest();
  // LFS-filer → release-aktiver (indholdsadresseret: samme fil uploades kun én gang)
  try { sh(`gh release view ${LFS_TAG} -R ${REPO}`); } catch (e) {
    sh(`gh release create ${LFS_TAG} -R ${REPO} --title "Spilfiler (automatisk)" --notes "Store filer til spillets automatiske opdateringer. Rør ikke – bruges af appen." --latest=false`);
  }
  const have = new Set(JSON.parse(sh(`gh release view ${LFS_TAG} -R ${REPO} --json assets`)).assets.map(a => a.name));
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'wd-lfs-'));
  for (const [f, [h, , lfs]] of Object.entries(m.files)) {
    if (!lfs || have.has(h + '.bin')) continue;
    const p = path.join(tmp, h + '.bin'); fs.copyFileSync(path.join(ROOT, f), p);
    console.log('  upload', f, '→', h.slice(0, 12) + '.bin');
    sh(`gh release upload ${LFS_TAG} -R ${REPO} "${p}"`);
  }
  const pkg = require(path.join(ROOT, 'desktop', 'package.json'));
  const game = sh('git log -1 --format=%cd --date=format:%Y.%m.%d-%H%M') + '-' + commit.slice(0, 7);
  Object.assign(m, {
    game, commit, created: new Date().toISOString(), minApp: MIN_APP, app: pkg.version,
    raw: `https://raw.githubusercontent.com/${REPO}/${commit}/`, lfs: `https://github.com/${REPO}/releases/download/${LFS_TAG}/`
  });
  const web = process.env.WD_WEB || path.join(require('os').homedir(), 'Desktop', 'wd-web');
  const out = path.join(web, 'game', 'manifest.json');
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(m));
  const w = { cwd: web };
  sh('git add game/manifest.json', w);
  try { sh(`git commit -q -m "Spil-udgave ${game}"`, w); } catch (e) { console.log('  (manifestet var uændret)'); }
  sh('git push -q', w);
  console.log('✓ udgivet', game, '·', Object.keys(m.files).length, 'filer · appen henter ændringerne ved næste start');
} else {
  console.log('brug: node scripts/game-update.js --base <fil> | --publish');
}
