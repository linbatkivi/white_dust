const { spawn } = require('child_process'); const WebSocket = require('ws'); const path = require('path');
const PORT = 3499; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = spawn('node', ['/Users/linuskivikoski/Projekter/wd/server.js'], { env: Object.assign({}, process.env, { PORT, WD_FAST: '1', WD_TEST: '1', WD_BOTS: '1' }), stdio: ['ignore', 'pipe', 'pipe'] });
  srv.stderr.on('data', d => process.stderr.write(d));
  for (let i = 0; i < 100; i++) { const up = await new Promise(r => { const q = require('http').get('http://127.0.0.1:' + PORT + '/', res => { res.resume(); r(true); }); q.on('error', () => r(false)); }); if (up) break; await sleep(200); }
  const ws = new WebSocket('ws://localhost:' + PORT + '/ws'); const log = []; let snap = null, me = null;
  ws.on('message', d => { const m = JSON.parse(d); if (m.t === 's') snap = m; else log.push(m); if (m.t === 'load') ws.send(JSON.stringify({ t: 'loaded' })); if (m.t === 'joined') me = m; });
  await new Promise(r => ws.on('open', r));
  const send = o => ws.send(JSON.stringify(o));
  send({ t: 'create', name: 'Tester' }); await sleep(300);
  send({ t: 'map', id: 'niseko' }); await sleep(200); send({ t: 'team', side: 'swat' }); await sleep(200); send({ t: 'bots', on: true }); await sleep(300);
  send({ t: 'start' }); await sleep(1500);
  console.log('lobby maps:', log.filter(m => m.t === 'lobby').pop().map);
  const track = {}; const t0 = Date.now(); let plant = null, first = null;
  while (Date.now() - t0 < 150000) {
    await sleep(500);
    if (!snap) continue; if (!first) { first = Object.keys(snap); console.log('snap keys', first.join(',')); }
    const pl = snap.p || snap.pl || []; for (const p of pl) { const id = p[0]; const x = p[1], z = p[3] !== undefined ? p[3] : p[2]; const a = track[id] || (track[id] = { d: 0, lx: x, lz: z, n: 0 }); a.d += Math.hypot(x - a.lx, z - a.lz); a.lx = x; a.lz = z; a.n++; }
    for (const m of log.splice(0)) { if (m.t === 'ev' && ['plant', 'defuse', 'boom', 'kill', 'bomb'].includes(m.k)) console.log('event', m.k, m.site || '', ((Date.now() - t0) / 1000).toFixed(0) + 's'); else if (m.t === 'round' || m.t === 'rend' || m.t === 'notice') console.log(m.t, (m.k || m.reason || ''), ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  }
  console.log('bevægelse pr. spiller (m):', Object.entries(track).map(([k, v]) => k + ':' + v.d.toFixed(0)).join(' '));
  ws.close(); srv.kill(); process.exit(0);
})();
