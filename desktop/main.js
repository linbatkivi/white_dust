// WHITE_DUST desktop-app
// Hele spillet (public/ + shared/) ligger inde i appen og vises via wd://game/.
// Multiplayer: appen kører selv spil-serveren (server.js) på 127.0.0.1. Den der laver et party er vært,
// og vennerne forbinder peer-to-peer (WebRTC) til værtens app – se public/js/p2p.js. Ingen server i skyen.
// Appen opdaterer sig selv fra GitHub Releases (electron-updater).
const { app, BrowserWindow, shell, protocol, dialog, utilityProcess } = require('electron');
const net = require('net');
const http = require('http');
const { autoUpdater } = require('electron-updater');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const pkg = require('./package.json');

const SITE = pkg.wd.site;
// Udvikling: WD_SERVER=localhost:3000 npm start forbinder til en server du selv kører (uden peer-to-peer).
// WD_PROFILE=b npm start giver en ekstra, separat kopi af appen – så du kan teste vært + ven på én maskine.
const EXTERNAL = process.env.WD_SERVER || '';
let SERVER = EXTERNAL;
if (process.env.WD_PROFILE) app.setPath('userData', path.join(app.getPath('appData'), 'White Dust ' + process.env.WD_PROFILE));

// Spillets filer: i den færdige app under resources/game, under udvikling direkte fra repoet
const GAME = app.isPackaged ? path.join(process.resourcesPath, 'game') : path.join(__dirname, '..');
const PUB = path.join(GAME, 'public');
const SHARED = path.join(GAME, 'shared');

// Fingeraftryk af shared/ – serveren regner det samme ud og afviser apps med en anden udgave
function buildId(dir) {
  const h = crypto.createHash('sha256');
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort()) {
    h.update(f);
    h.update(fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r\n/g, '\n'));
  }
  return h.digest('hex').slice(0, 16);
}
const BUILD = buildId(SHARED);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.hdr': 'application/octet-stream',
  '.wasm': 'application/wasm', '.ktx2': 'image/ktx2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.webm': 'video/webm'
};

// WebRTC: vis rigtige lokale IP'er i stedet for mDNS-navne, så venner på samme netværk (og test på én maskine)
// forbinder pålideligt direkte til værten
app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns');

protocol.registerSchemesAsPrivileged([
  { scheme: 'wd', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

function serveGame() {
  protocol.handle('wd', async (req) => {
    let rel;
    try { rel = decodeURIComponent(new URL(req.url).pathname); } catch (e) { return new Response('', { status: 400 }); }
    // config.js laves her: serverens adresse + appens udgave
    if (rel === '/config.js') {
      const js = `window.WD_SERVER=${JSON.stringify(SERVER)};window.WD_APP=${JSON.stringify(app.getVersion())};window.WD_BUILD=${JSON.stringify(BUILD)};window.WD_P2P=${!EXTERNAL};`;
      return new Response(js, { headers: { 'content-type': MIME['.js'] } });
    }
    if (rel === '/') rel = '/index.html';
    let root = PUB, sub = rel;
    if (rel.startsWith('/shared/')) { root = SHARED; sub = rel.slice(7); }
    const file = path.join(root, sub);
    if (!file.startsWith(root + path.sep)) return new Response('', { status: 403 });
    try {
      const buf = await fs.promises.readFile(file);
      return new Response(buf, { headers: { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' } });
    } catch (e) {
      return new Response('', { status: 404 });
    }
  });
}

// Spil-serveren kører i sin egen proces og lytter kun på 127.0.0.1 (ikke synlig udefra)
function freePort() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.once('error', rej);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
  });
}
function waitHealthy(port, ms) {
  const end = Date.now() + ms;
  return new Promise(res => {
    const poll = () => {
      http.get({ host: '127.0.0.1', port, path: '/healthz', timeout: 1000 }, r => { r.resume(); res(true); })
        .on('error', () => (Date.now() < end ? setTimeout(poll, 250) : res(false)));
    };
    poll();
  });
}
async function startServer() {
  const port = await freePort();
  const proc = utilityProcess.fork(path.join(GAME, 'server.js'), [], {
    serviceName: 'White Dust server',
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port) }
  });
  proc.stdout && proc.stdout.on('data', d => process.stdout.write('[server] ' + d));
  proc.stderr && proc.stderr.on('data', d => process.stderr.write('[server] ' + d));
  app.on('will-quit', () => { try { proc.kill(); } catch (e) {} });
  SERVER = '127.0.0.1:' + port;
  await waitHealthy(port, 20000);
}

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 1024, minHeight: 600,
    title: 'White Dust',
    backgroundColor: '#f4f4f2',
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
  });
  win.removeMenu();
  win.once('ready-to-show', () => win.show());

  // Links ud af spillet åbnes i den rigtige browser
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('wd://')) { e.preventDefault(); shell.openExternal(url); } });

  // F11 = fuldskærm · Ctrl/Cmd+R = genindlæs · Ctrl/Cmd+Shift+I = udviklerværktøjer
  win.webContents.on('before-input-event', (e, i) => {
    if (i.type !== 'keyDown') return;
    const mod = i.control || i.meta;
    if (i.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    else if (mod && !i.shift && i.key.toLowerCase() === 'r') { win.webContents.reload(); e.preventDefault(); }
    else if (mod && i.shift && i.key.toLowerCase() === 'i') { win.webContents.toggleDevTools(); e.preventDefault(); }
  });

  win.loadURL('wd://game/');
}

// Opdateringer: Windows/Linux henter og installerer selv. Mac-appen er ikke signeret,
// så der kan den ikke installere selv – i stedet åbnes download-siden.
function checkUpdates() {
  if (!app.isPackaged) return;
  const mac = process.platform === 'darwin';
  autoUpdater.autoDownload = !mac;
  autoUpdater.on('update-available', async (info) => {
    if (!mac) return;
    const r = await dialog.showMessageBox(win, {
      type: 'info', buttons: ['Download', 'Senere'], defaultId: 0,
      message: `White Dust ${info.version} er ude`,
      detail: 'Hent den nye version på hjemmesiden og erstat den gamle app.'
    });
    if (r.response === 0) shell.openExternal(SITE + 'downloads.html');
  });
  autoUpdater.on('update-downloaded', async (info) => {
    const r = await dialog.showMessageBox(win, {
      type: 'info', buttons: ['Genstart nu', 'Senere'], defaultId: 0,
      message: `White Dust ${info.version} er klar`,
      detail: 'Genstart for at installere opdateringen. Vælger du "Senere", installeres den, når du lukker spillet.'
    });
    if (r.response === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.on('error', () => {});   // ingen internet o.l. – prøv igen næste gang
  autoUpdater.checkForUpdates().catch(() => {});
}

if (!process.env.WD_PROFILE && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(async () => {
    serveGame();
    if (!EXTERNAL) await startServer();
    createWindow();
    checkUpdates();
  });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  app.on('window-all-closed', () => app.quit());
}
