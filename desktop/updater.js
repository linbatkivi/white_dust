// ==========================================================================
// v25: spil-opdateringer uden ny app (se scripts/game-update.js).
//   Appen har sine egne spilfiler (resources/game) + et fingeraftryk af dem (game/manifest.json).
//   Ved start hentes hjemmesidens game/manifest.json; filer med et andet fingeraftryk hentes til
//   <userData>/game-update/files, tjekkes (sha256) og tages først i brug når ALLE er hentet (installed.json skrives til sidst).
//   resolve('public/js/app.js') → den opdaterede fil hvis den findes, ellers appens egen.
// ==========================================================================
const fs = require('fs'), path = require('path'), crypto = require('crypto'), https = require('https'), http = require('http');

function createUpdater({ base, userData, site, appVersion, log }) {
  const UPD = path.join(userData, 'game-update'), FILES = path.join(UPD, 'files'), STAGE = path.join(UPD, 'stage');
  const INST = path.join(UPD, 'installed.json');
  const readJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
  const baseMan = readJSON(path.join(base, 'manifest.json')) || { files: {} };
  let inst = readJSON(INST);
  // en opdatering lavet til en anden app-udgave smides væk (appens egne filer er måske nyere)
  if (inst && inst.baseApp !== appVersion) { log('[opdatering] ny app-udgave – gamle opdateringsfiler fjernes'); fs.rmSync(UPD, { recursive: true, force: true }); inst = null; }
  let over = new Set(inst ? inst.over : []);

  const resolve = rel => over.has(rel) ? path.join(FILES, rel) : path.join(base, rel);
  const current = rel => (over.has(rel) ? inst.files[rel] : baseMan.files[rel]) || null;
  const version = () => (inst && inst.game) || 'app ' + appVersion;

  function get(url, asJSON, redirects = 5) {
    return new Promise((res, rej) => {
      const r = (url.startsWith('http:') ? http : https).get(url, { headers: { 'User-Agent': 'WhiteDust/' + appVersion, 'Cache-Control': 'no-cache' }, timeout: 15000 }, resp => {
        if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location && redirects > 0) { resp.resume(); return get(new URL(resp.headers.location, url).href, asJSON, redirects - 1).then(res, rej); }
        if (resp.statusCode !== 200) { resp.resume(); return rej(new Error('HTTP ' + resp.statusCode + ' ' + url)); }
        const ch = []; resp.on('data', d => ch.push(d)); resp.on('end', () => { const b = Buffer.concat(ch); try { res(asJSON ? JSON.parse(b.toString('utf8')) : b); } catch (e) { rej(e); } });
        resp.on('error', rej);
      });
      r.on('timeout', () => r.destroy(new Error('timeout ' + url))); r.on('error', rej);
    });
  }
  const verCmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };

  // tjek: { need: [...], bytes, man } eller null (ingen opdatering / offline / appen for gammel)
  async function check() {
    const man = await get(site + 'game/manifest.json?t=' + Date.now(), true);
    if (!man || !man.files) return null;
    if (man.minApp && verCmp(appVersion, man.minApp) < 0) return { tooOld: true, man };
    if (inst && inst.game === man.game) return null;
    const need = []; let bytes = 0;
    for (const [rel, e] of Object.entries(man.files)) {
      const cur = current(rel);
      if (cur && cur[0] === e[0]) continue;
      need.push(rel); bytes += e[1];
    }
    return { need, bytes, man };
  }

  // hent forskellene (parallelt), tjek sha256, og tag dem i brug samlet
  async function apply(plan, progress) {
    const { man, need } = plan; let done = 0;
    fs.mkdirSync(STAGE, { recursive: true });
    const urlOf = rel => { const e = man.files[rel]; return e[2] ? man.lfs + e[0] + '.bin' : man.raw + rel.split('/').map(encodeURIComponent).join('/'); };
    const queue = need.slice(); let fail = null;
    async function worker() {
      while (queue.length && !fail) {
        const rel = queue.shift(), e = man.files[rel], dst = path.join(STAGE, rel);
        if (fs.existsSync(dst) && crypto.createHash('sha256').update(fs.readFileSync(dst)).digest('hex') === e[0]) { done += e[1]; progress(done, plan.bytes, rel); continue; }   // hentet ved et afbrudt forsøg
        let buf = null;
        for (let k = 0; k < 3 && !buf; k++) {
          try { const b = await get(urlOf(rel)); if (crypto.createHash('sha256').update(b).digest('hex') === e[0]) buf = b; else log('[opdatering] forkert fingeraftryk', rel); }
          catch (err) { log('[opdatering]', err.message); }
        }
        if (!buf) { fail = new Error('kunne ikke hente ' + rel); break; }
        fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.writeFileSync(dst, buf);
        done += e[1]; progress(done, plan.bytes, rel);
      }
    }
    await Promise.all(Array.from({ length: 6 }, worker));
    if (fail) throw fail;
    // samlet skift: tidligere opdaterede filer der stadig er aktuelle beholdes, nye flyttes ind
    const nOver = [];
    for (const [rel, e] of Object.entries(man.files)) {
      const b = baseMan.files[rel];
      if (b && b[0] === e[0]) continue;                                           // appens egen fil er den rigtige
      const st = path.join(STAGE, rel), fl = path.join(FILES, rel);
      if (fs.existsSync(st)) { fs.mkdirSync(path.dirname(fl), { recursive: true }); fs.renameSync(st, fl); }
      if (fs.existsSync(fl)) nOver.push(rel);
    }
    const ni = { game: man.game, commit: man.commit, baseApp: appVersion, over: nOver, files: man.files, at: new Date().toISOString() };
    fs.writeFileSync(INST + '.tmp', JSON.stringify(ni)); fs.renameSync(INST + '.tmp', INST);
    fs.rmSync(STAGE, { recursive: true, force: true });
    // ryd op: filer der ikke længere bruges
    const keep = new Set(nOver);
    (function clean(d) { for (const e of fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []) { const p = path.join(d, e.name); if (e.isDirectory()) clean(p); else if (!keep.has(path.relative(FILES, p).split(path.sep).join('/'))) fs.rmSync(p, { force: true }); } })(FILES);
    inst = ni; over = new Set(nOver);
    log('[opdatering] spillet er nu', man.game, '·', need.length, 'filer hentet');
  }

  // serveren (server.js + shared/) samles i én mappe, så require('./shared/wd.js') finder de opdaterede filer
  function serverDir() {
    if (!over.size) return base;
    const run = path.join(UPD, 'run');
    fs.rmSync(run, { recursive: true, force: true }); fs.mkdirSync(path.join(run, 'shared'), { recursive: true });
    fs.copyFileSync(resolve('server.js'), path.join(run, 'server.js'));
    const list = inst ? Object.keys(inst.files).filter(f => /^shared\/[^/]+\.js$/.test(f)) : fs.readdirSync(path.join(base, 'shared')).filter(f => f.endsWith('.js')).map(f => 'shared/' + f);
    for (const rel of list) fs.copyFileSync(resolve(rel), path.join(run, rel));
    try { fs.symlinkSync(path.join(base, 'node_modules'), path.join(run, 'node_modules'), 'junction'); } catch (e) { log('[opdatering] node_modules-link', e.message); }
    return run;
  }
  return { resolve, check, apply, serverDir, version };
}
module.exports = { createUpdater };
