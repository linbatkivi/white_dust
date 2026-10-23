// BOT-SIMULATION: kører rigtige serverrunder med kun bots (og en passiv menneskelig tilskuer) i fremspolet tid og måler adfærd.
//   node test/sim/botsim.js [bane=bureau] [runder=6] [fart=5]
// Måler: rutespredning (hvor forskellige T-bots' veje er), første kontakt, dueller, plant-tid, vinder pr. runde, og hvor mange T-bots der dør inden for 6 s af hinanden på samme sted ("rush").
const { spawn } = require('child_process'); const WebSocket = require('ws');
const MAP = process.argv[2] || 'bureau', ROUNDS = +(process.argv[3] || 6), K = +(process.argv[4] || 5), PORT = 3480 + (Math.random() * 50 | 0);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = spawn('node', ['-r', __dirname + '/speed.js', __dirname + '/../../server.js'], { env: Object.assign({}, process.env, { PORT, WD_TEST: '1', WD_BOTS: '1', SIMK: String(K) }), stdio: ['ignore', 'pipe', 'pipe'] });
  srv.stderr.on('data', d => process.stderr.write(d)); if (process.env.SIMV) srv.stdout.on('data', d => process.stdout.write(d));
  for (let i = 0; i < 100; i++) { const up = await new Promise(r => { const q = require('http').get('http://127.0.0.1:' + PORT + '/', res => { res.resume(); r(true); }); q.on('error', () => r(false)); }); if (up) break; await sleep(200); }
  const ws = new WebSocket('ws://localhost:' + PORT + '/ws'); const send = o => ws.send(JSON.stringify(o));
  let sides = {}, names = {}, st = 0, round = 0, phase = '', R = null; const rounds = [];
  const newR = n => ({ n, tracks: {}, kills: [], plant: null, win: null, firstSee: null, t0: null, shots: 0 });
  ws.on('message', d => {
    const m = JSON.parse(d);
    if (m.t === 'load') send({ t: 'loaded' });
    if (m.t === 'round') { for (const p of m.players || []) { sides[p.id] = p.side; names[p.id] = p.name; } if (m.n !== round && m.ph !== 'lobby') { round = m.n; R = newR(m.n); rounds.push(R); } phase = m.ph; }
    if (m.t === 's') { st = m.st; phase = m.ph; if (R && m.ph === 'live') { if (R.t0 === null) R.t0 = m.st; const tt = (m.st - R.t0) / 1000;
      for (const p of m.p) { if (!(p[6] & 1)) continue; const a = R.tracks[p[0]] = R.tracks[p[0]] || []; const last = a[a.length - 1]; if (!last || tt - last[0] >= 0.5) a.push([tt, p[1], p[3], p[2]]); }
      if (m.b && m.b[0] === 2 && !R.plant) R.plant = [tt, m.b[1], m.b[3]]; } }
    if (m.t === 'ev' && R) { if (m.k === 'kill' && R.t0 !== null && names[m.v] !== 'Obs') R.kills.push({ t: (st - R.t0) / 1000, a: m.a, v: m.v, w: m.w, hs: m.hs }); if (m.k === 'end') R.win = m.win + ':' + m.reason; }
    if (m.t === 'rend') { if (R) R.win = (m.win || m.w || m.side || JSON.stringify(m).slice(0, 80)); }
  });
  await new Promise(r => ws.on('open', r));
  send({ t: 'create', name: 'Obs' }); await sleep(300); send({ t: 'map', id: MAP }); await sleep(200); send({ t: 'team', side: process.env.OBS || 'swat' }); await sleep(200); send({ t: 'bots', on: true }); await sleep(300); send({ t: 'start' });
  const T0 = Date.now(); let lastKill = 0;
  while (rounds.length < ROUNDS + 1 && Date.now() - T0 < 600000) {
    await sleep(300);
    if (phase === 'live' && R && R.t0 !== null && !R.killedObs) { R.killedObs = 1; send({ t: 'dbg', kill: 1, by: 0 }); }
  }
  ws.close(); srv.kill();
  const dist = (a, b) => Math.hypot(a[1] - b[1], a[2] - b[2]);
  const at = (tr, t) => { let best = tr[0]; for (const p of tr) if (Math.abs(p[0] - t) < Math.abs(best[0] - t)) best = p; return best; };
  let rushDeaths = 0, nR = 0; const spreads = [], contact = [], plants = [], wins = { swat: 0, hij: 0 }, duelT = [];
  for (const r of rounds.slice(0, ROUNDS)) {
    if (!r.t0) continue; nR++;
    const hij = Object.keys(r.tracks).filter(id => sides[id] === 'hij');
    // rutespredning: gennemsnitlig parvis afstand mellem T-bots 4–24 s inde i runden (m)
    let s = 0, n = 0; for (let t = 4; t <= 24; t += 2) for (let i = 0; i < hij.length; i++) for (let j = i + 1; j < hij.length; j++) { const A = r.tracks[hij[i]], B = r.tracks[hij[j]]; if (!A.length || !B.length) continue; s += dist(at(A, t), at(B, t)); n++; }
    if (n) spreads.push(s / n);
    if (r.kills.length) contact.push(r.kills[0].t);
    if (r.plant) plants.push(r.plant[0]);
    const k = r.kills.filter(x => sides[x.v] === 'hij'); for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) if (Math.abs(k[i].t - k[j].t) < 5) { rushDeaths++; i = 1e9; break; }
    for (let i = 1; i < r.kills.length; i++) duelT.push(r.kills[i].t - r.kills[i - 1].t);
    const tk = r.kills.filter(x => sides[x.v] === 'hij').length, ck = r.kills.filter(x => sides[x.v] === 'swat').length;
    console.log(`runde ${r.n}: T-døde ${tk} CT-døde ${ck}, ${r.kills.length} drab, første ${r.kills[0] ? r.kills[0].t.toFixed(1) : '-'} s, plant ${r.plant ? r.plant[0].toFixed(1) + ' s' : '–'}, spredning ${n ? (s / n).toFixed(1) : '-'} m, resultat ${r.win || '?'}`);
  }
  const avg = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '-';
  console.log(`\n${MAP}: ${nR} runder · rutespredning ${avg(spreads)} m · første drab ${avg(contact)} s · plant ${avg(plants)} s (${plants.length}/${nR} plantet) · T-dræbte på rad (<5 s) i ${rushDeaths}/${nR} runder`);
  fs = require('fs'); if (process.env.SIMOUT) fs.writeFileSync(process.env.SIMOUT, JSON.stringify({ rounds, sides, names }));
  process.exit(0);
})();
