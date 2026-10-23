// ==========================================================================
// ADMIN-KONSOL (v26.12) · server-side. Kun partyets vært (admin-flag) må køre kommandoer; alt valideres igen her.
//   createAdmin(S) -> { exec(room, p, cmd, args) → { ok, msg } }
//   S: { WD, now, r2, rooms, sendP, send, newRound, endRound, startGame, giveItem, damage, tpMsg, sendSelf, removePlayer, resetLoadout, Bots, lobbyMsg, bans, MAX_MONEY, WIN_ROUNDS, START_MONEY }
//   Hold: hijackers | defenders (swat).  Spiller-id: tal eller 'me'.  Booleans: true/false/on/off/1/0.
// ==========================================================================
module.exports = function createAdmin(S) {
  const { WD } = S, W = WD.WEAPONS;
  const bool = v => /^(1|true|on|yes|ja)$/i.test(String(v)), isBool = v => /^(0|1|true|false|on|off|yes|no|ja|nej)$/i.test(String(v));
  const side = v => { v = String(v).toLowerCase(); return /^(hij|hijackers?|t)$/.test(v) ? 'hij' : /^(swat|defenders?|ct)$/.test(v) ? 'swat' : null; };
  const num = (v, a, b) => { const n = +v; return Number.isFinite(n) ? Math.max(a === undefined ? -1e9 : a, Math.min(b === undefined ? 1e9 : b, n)) : null; };
  const ok = msg => ({ ok: true, msg }), no = msg => ({ ok: false, msg });
  const player = (room, p, v) => { if (String(v).toLowerCase() === 'me') return p; const q = room.players.get(+v | 0); return q || null; };
  const inGame = room => room.phase === 'buy' || room.phase === 'live' || room.phase === 'end';
  const st = q => { if (q.ws) S.sendP(q, { t: 'admst', noclip: !!q.noclip, fly: !!q.fly, freeze: !!q.frozen, god: !!q.god }); };
  const ev = (room, o) => room.bcast(Object.assign({ t: 'ev' }, o));
  const NADES = ['flash', 'smoke', 'he', 'molotov', 'incgren', 'sensor'];

  const C = {
    /* ---------- kamp og runder ---------- */
    'round.restart'(room) { if (!inGame(room)) return no('ingen kamp i gang'); room.round = Math.max(0, room.round - 1); room.paused = false; S.newRound(room); return ok('runden genstartet'); },
    'round.pause'(room) { if (!inGame(room)) return no('ingen kamp i gang'); room.paused = true; ev(room, { k: 'adm', c: 'pause', v: 1 }); return ok('runden er pauset'); },
    'round.resume'(room) { room.paused = false; ev(room, { k: 'adm', c: 'pause', v: 0 }); return ok('runden genoptaget'); },
    'round.extend'(room, p, [s]) { const n = num(s, -600, 3600); if (n === null) return no('sekunder skal være et tal'); room.phaseEnd += n * 1000; return ok((n >= 0 ? '+' : '') + n + ' s på rundeuret'); },
    'round.win'(room, p, [t]) { const sd = side(t); if (!sd) return no('hold: hijackers | defenders'); if (room.phase !== 'live' && room.phase !== 'buy') return no('kun i buy/live'); room.phase = 'live'; S.endRound(room, sd, 'admin'); return ok('runden gik til ' + sd); },
    'round.forceend'(room) { if (!inGame(room)) return no('ingen kamp i gang'); S.newRound(room); return ok('runden afsluttet uden vinder'); },
    'score.set'(room, p, [t, n]) { const sd = side(t), v = num(n, 0, 99); if (!sd || v === null) return no('brug: score.set <hold> <point>'); room.score[sd] = v | 0; return ok('stilling: SWAT ' + room.score.swat + ' – HIJ ' + room.score.hij); },
    'match.overtime'(room) { room.score.swat = room.score.hij = S.WIN_ROUNDS - 1; return ok('stilling sat til ' + (S.WIN_ROUNDS - 1) + '–' + (S.WIN_ROUNDS - 1) + ' – næste runde afgør'); },
    /* ---------- spillere ---------- */
    'player.god'(room, p, [id]) { const q = player(room, p, id); if (!q) return no('ukendt spiller'); q.god = !q.god; st(q); return ok(q.name + ' god mode: ' + (q.god ? 'TIL' : 'FRA')); },
    'player.noclip'(room, p, [id]) { const q = player(room, p, id); if (!q) return no('ukendt spiller'); q.noclip = !q.noclip; if (q.noclip) q.fly = false; st(q); return ok(q.name + ' noclip: ' + (q.noclip ? 'TIL' : 'FRA')); },
    'player.fly'(room, p, [id]) { const q = player(room, p, id); if (!q) return no('ukendt spiller'); q.fly = !q.fly; if (q.fly) q.noclip = false; st(q); return ok(q.name + ' fly: ' + (q.fly ? 'TIL' : 'FRA')); },
    'player.kill'(room, p, [id]) { const q = player(room, p, id); if (!q || !q.alive) return no('spilleren er ikke i live'); const g = q.god; q.god = false; S.damage(room, q, 99999, null, 'admin', false); q.god = g; return ok(q.name + ' elimineret'); },
    'player.respawn'(room, p, [id]) {
      const q = player(room, p, id); if (!q || !q.side || !inGame(room)) return no('ingen aktiv spiller');
      const list = room.W.spawns[q.side], sp = list[(Math.random() * list.length) | 0];
      if (!q.alive) { q.alive = true; S.resetLoadout(q); }
      q.hp = 100; q.x = sp.x; q.y = sp.y; q.z = sp.z; q.yaw = sp.yaw; q.hist = []; q.corrId++; S.sendP(q, S.tpMsg(q)); S.sendSelf(q); return ok(q.name + ' genoplivet');
    },
    'player.heal'(room, p, [id, a]) { const q = player(room, p, id), n = num(a, 1, 1000); if (!q || n === null) return no('brug: player.heal <id> <mængde>'); q.hp = Math.min(100, q.hp + n); S.sendSelf(q); return ok(q.name + ' HP: ' + q.hp); },
    'player.damage'(room, p, [id, a]) { const q = player(room, p, id), n = num(a, 1, 1000); if (!q || !q.alive || n === null) return no('brug: player.damage <id> <mængde>'); const g = q.god; q.god = false; S.damage(room, q, n, null, 'admin', false); q.god = g; return ok(q.name + ' tog ' + n + ' skade'); },
    'player.teleport'(room, p, [a, b]) { const q = player(room, p, a), r = player(room, p, b); if (!q || !r) return no('ukendt spiller'); q.x = r.x + 0.8; q.y = r.y; q.z = r.z; q.hist = []; q.corrId++; S.sendP(q, S.tpMsg(q)); return ok(q.name + ' → ' + r.name); },
    'player.teleportpos'(room, p, [id, x, y, z]) { const q = player(room, p, id), X = num(x), Y = num(y), Z = num(z); if (!q || X === null || Y === null || Z === null) return no('brug: player.teleportpos <id> <x> <y> <z>'); q.x = X; q.y = Y; q.z = Z; q.hist = []; q.corrId++; S.sendP(q, S.tpMsg(q)); return ok(q.name + ' → ' + X + ',' + Y + ',' + Z); },
    'player.freeze'(room, p, [id]) { const q = player(room, p, id); if (!q) return no('ukendt spiller'); q.frozen = !q.frozen; st(q); return ok(q.name + ' frosset: ' + (q.frozen ? 'JA' : 'NEJ')); },
    'player.slap'(room, p, [id, f]) { const q = player(room, p, id), n = num(f === undefined ? 8 : f, 1, 40); if (!q || !q.alive) return no('ukendt/død spiller'); S.sendP(q, { t: 'ev', k: 'slap', vy: n, vx: (Math.random() - 0.5) * n * 0.6, vz: (Math.random() - 0.5) * n * 0.6 }); const g = q.god; q.god = false; S.damage(room, q, 5, null, 'admin', false); q.god = g; return ok(q.name + ' fik en lussing'); },
    'player.giveammo'(room, p, [id]) { const q = player(room, p, id); if (!q || !q.inv) return no('ukendt spiller'); for (const k of ['primary', 'pistol']) { const w = q.inv[k]; if (w) q.ammo[w] = { mag: W[w].mag, res: W[w].res }; } S.sendSelf(q); return ok(q.name + ' fik fuld ammunition'); },
    'player.invisible'(room, p, [id]) { const q = player(room, p, id); if (!q) return no('ukendt spiller'); q.invis = !q.invis; return ok(q.name + ' usynlig: ' + (q.invis ? 'JA' : 'NEJ')); },
    'player.setskin'(room, p, [id, skin]) {
      const q = player(room, p, id); if (!q || !q.side) return no('ukendt spiller'); if (!/^[a-z0-9_]{1,16}:[a-z0-9_]{1,16}$/.test(String(skin))) return no('skin-id som model:variant (fx hij5:rust, swat:black)');
      q.cos = q.cos || { agent: {}, skins: {} }; q.cos.agent = q.cos.agent || {}; q.cos.agent[q.side] = skin; room.bcast({ t: 'cos', id: q.id, c: q.cos }); return ok(q.name + ' skin: ' + skin);
    },
    /* ---------- server og moderation ---------- */
    'server.kick'(room, p, [id, ...r]) {
      const q = player(room, p, id); if (!q || q === p) return no('kan ikke kicke den spiller'); const why = r.join(' ') || 'ingen grund';
      if (q.ws) { q.ws.ctx.p = null; q.ws.ctx.room = null; S.send(q.ws, { t: 'err', msg: 'Du blev smidt ud: ' + why, fatal: true, kicked: true }); const w = q.ws; setTimeout(() => { try { w.close(); } catch (e) {} }, 300); }
      q.ws = null; q.connected = false; S.removePlayer(room, q); return ok(q.name + ' kicket (' + why + ')');
    },
    'server.ban'(room, p, [id, d]) {
      const q = player(room, p, id), mins = num(d === undefined ? 60 : d, 1, 525600); if (!q || q === p || mins === null) return no('brug: server.ban <id> <minutter>');
      const ip = q.ws && q.ws.ctx && q.ws.ctx.ip; S.bans.set(String(q.name).toLowerCase(), { until: Date.now() + mins * 60000, ip: ip || null });
      if (ip && !/^(::1|127\.|::ffff:127\.)/.test(ip)) S.bans.set('ip:' + ip, { until: Date.now() + mins * 60000 });
      C['server.kick'](room, p, [id, 'banlyst i ' + mins + ' min']); return ok(q.name + ' bannet i ' + mins + ' min');
    },
    'server.unban'(room, p, [k]) { const key = String(k || '').toLowerCase(); let n = 0; for (const [kk, v] of [...S.bans]) if (kk === key || kk === 'ip:' + key || kk.endsWith(key)) { S.bans.delete(kk); n++; } return n ? ok(n + ' ban fjernet') : no('ingen ban fundet for ' + k); },
    'server.mute'(room, p, [id]) { const q = player(room, p, id); if (!q) return no('ukendt spiller'); q.muted = true; return ok(q.name + ' er muted'); },
    'server.unmute'(room, p, [id]) { const q = player(room, p, id); if (!q) return no('ukendt spiller'); q.muted = false; return ok(q.name + ' kan skrive igen'); },
    'server.say'(room, p, a) { const m = a.join(' ').trim().slice(0, 160); if (!m) return no('skriv en besked'); ev(room, { k: 'adm', c: 'say', v: m }); return ok('sendt'); },
    'server.changemap'(room, p, [id]) {
      if (!WD.MAP_LIST.some(m => m.id === id)) return no('ukendt bane. Valg: ' + WD.MAP_LIST.map(m => m.id).join(', '));
      room.map = id;
      if (room.phase === 'lobby') { room.bcast(S.lobbyMsg(room)); return ok('bane: ' + id); }
      const T = { hij: [], swat: [] }; for (const q of room.players.values()) if (q.side) T[q.side].push(q);
      room.paused = false; S.startGame(room, T); return ok('skifter til ' + id + ' – kampen genstartes');
    },
    'server.maxplayers'(room, p, [n]) { const v = num(n, 2, 16); if (v === null) return no('antal 2–16'); room.maxPlayers = v | 0; room.bcast(S.lobbyMsg(room)); return ok('maks. spillere: ' + room.maxPlayers); },
    'server.passthrough'(room, p, [b]) { if (!isBool(b)) return no('true/false'); room.locked = !bool(b); return ok('nye spillere ' + (room.locked ? 'BLOKERES' : 'TILLADES')); },
    /* ---------- bots ---------- */
    'bot.add'(room, p, [t, dif]) {
      const sd = side(t); if (!sd) return no('hold: hijackers | defenders'); const sk = /^(easy|let)$/i.test(dif) ? 0.45 : /^(hard|svær|expert)$/i.test(dif) ? 0.97 : /^[0-9.]+$/.test(String(dif || '')) ? Math.max(0.3, Math.min(1, +dif)) : 0.75;
      const b = S.Bots.spawn(room, sd); b.bot.skill = sk; b.bot.aim.skill = sk; b.side = sd; S.resetLoadout(b); b.money = S.START_MONEY; b.alive = false; room.bcast(S.lobbyMsg(room)); return ok('bot #' + b.id + ' (' + sd + ', dygtighed ' + sk + ') kommer med næste runde');
    },
    'bot.remove'(room, p, [id]) { const q = room.players.get(+id | 0); if (!q || !q.isBot) return no('ingen bot med det id'); S.removePlayer(room, q); return ok('bot fjernet'); },
    'bot.removeall'(room) { let n = 0; for (const q of [...room.players.values()]) if (q.isBot) { S.removePlayer(room, q); n++; } return ok(n + ' bots fjernet'); },
    'bot.killall'(room) { let n = 0; for (const q of [...room.players.values()]) if (q.isBot && q.alive) { S.damage(room, q, 99999, null, 'admin', false); n++; } return ok(n + ' bots elimineret'); },
    'bot.freeze'(room) { room.botFreeze = !room.botFreeze; return ok('bot-AI ' + (room.botFreeze ? 'FROSSET' : 'kører')); },
    'bot.fill'(room) {
      const cap = Math.floor((room.maxPlayers || 10) / 2); let n = 0;
      for (const sd of ['hij', 'swat']) { let c = [...room.players.values()].filter(q => (q.side || q.pref) === sd).length; while (c < cap) { C['bot.add'](room, null, [sd]); c++; n++; } }
      return ok(n + ' bots tilføjet');
    },
    /* ---------- udstyr og økonomi ---------- */
    'give.weapon'(room, p, [id, name]) { const q = player(room, p, id), w = W[name]; if (!q || !q.inv) return no('ukendt spiller'); if (!w || w.kind !== 'gun') return no('ukendt våben. Fx ak47, m4a1, awp, deagle'); S.giveItem(room, q, name); S.sendSelf(q); return ok(q.name + ' fik ' + w.name); },
    'give.item'(room, p, [id, name]) {
      const q = player(room, p, id); if (!q || !q.inv) return no('ukendt spiller'); name = String(name || '').toLowerCase();
      if (name === 'c4' || name === 'bomb') { for (const o of room.players.values()) if (o.inv) o.inv.bomb = false; q.inv.bomb = true; room.bomb.carrier = q.id; room.bomb.state = 0; }
      else if (name === 'kit' || name === 'defusekit' || name === 'thermal') q.inv[name === 'defusekit' ? 'kit' : name] = true;
      else if (NADES.includes(name)) q.inv[name] = (q.inv[name] || 0) + 1;
      else return no('udstyr: c4, kit, thermal, ' + NADES.join(', '));
      S.sendSelf(q); return ok(q.name + ' fik ' + name);
    },
    'money.set'(room, p, [id, n]) { const q = player(room, p, id), v = num(n, 0, S.MAX_MONEY); if (!q || v === null) return no('brug: money.set <id> <beløb>'); q.money = v | 0; S.sendSelf(q); return ok(q.name + ': $' + q.money); },
    'money.addall'(room, p, [n]) { const v = num(n, -S.MAX_MONEY, S.MAX_MONEY); if (v === null) return no('beløb mangler'); for (const q of room.players.values()) if (q.side) { q.money = Math.max(0, Math.min(S.MAX_MONEY, q.money + (v | 0))); S.sendSelf(q); } return ok('alle fik $' + v); },
    'economy.freebuy'(room, p, [b]) { if (!isBool(b)) return no('true/false'); room.freebuy = bool(b); return ok('gratis køb: ' + (room.freebuy ? 'TIL' : 'FRA')); },
    /* ---------- miljø og debug (udføres hos alle klienter) ---------- */
    'env.time'(room, p, [h]) { const v = num(h, 0, 24); if (v === null) return no('0–24'); ev(room, { k: 'adm', c: 'time', v }); return ok('tid på dagen: ' + v + ':00'); },
    'env.fog'(room, p, [d]) { const v = num(d, 0, 10); if (v === null) return no('tæthed 0–10 (1 = normal)'); ev(room, { k: 'adm', c: 'fog', v }); return ok('tåge: ' + v); },
    'env.blackout'(room) { ev(room, { k: 'adm', c: 'blackout', v: 1 }); return ok('strømmen er slukket'); },
    'physics.gravity'(room, p, [g]) { const v = num(g, 2, 80); if (v === null) return no('tyngdekraft 2–80 (standard ' + (S.GRAV0) + ')'); WD.PL.GRAV = v; ev(room, { k: 'adm', c: 'gravity', v }); return ok('tyngdekraft: ' + v); },
    'physics.bullettracers'(room, p, [b]) { if (!isBool(b)) return no('true/false'); ev(room, { k: 'adm', c: 'tracers', v: bool(b) ? 1 : 0 }); return ok('projektilbaner: ' + (bool(b) ? 'TIL' : 'FRA')); },
    'debug.wireframe'(room, p, [b]) { if (!isBool(b)) return no('true/false'); ev(room, { k: 'adm', c: 'wireframe', v: bool(b) ? 1 : 0 }); return ok('wireframe: ' + (bool(b) ? 'TIL' : 'FRA')); },
    'debug.hitboxes'(room, p, [b]) { if (!isBool(b)) return no('true/false'); ev(room, { k: 'adm', c: 'hitboxes', v: bool(b) ? 1 : 0 }); return ok('hitboxes: ' + (bool(b) ? 'TIL' : 'FRA')); },
    'debug.showfps'(room, p, [b]) { if (!isBool(b)) return no('true/false'); ev(room, { k: 'adm', c: 'fps', v: bool(b) ? 1 : 0 }); return ok('FPS-måler: ' + (bool(b) ? 'TIL' : 'FRA')); },
    'debug.clearentities'(room) { const n = room.grenades.length + room.drops.length + room.smokes.length + room.fires.length + room.sensors.length; room.grenades = []; room.drops = []; room.smokes = []; room.fires = []; room.sensors = []; ev(room, { k: 'adm', c: 'clear', v: 1 }); return ok(n + ' genstande fjernet'); }
  };

  function exec(room, p, cmd, args) {
    if (!p || p.id !== room.hostId) return no('ingen adgang: kun partyets vært (admin) kan bruge konsollen');
    const f = C[String(cmd)]; if (!f) return no('ukendt kommando: ' + cmd);
    args = Array.isArray(args) ? args.slice(0, 12).map(a => String(a).slice(0, 160)) : [];
    try { return f(room, p, args) || ok('ok'); } catch (e) { console.error('admin-fejl:', cmd, e); return no('fejl i kommandoen'); }
  }
  return { exec, commands: Object.keys(C) };
};
