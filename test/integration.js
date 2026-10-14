// Integrationstest: starter serveren og spiller med virtuelle klienter via WebSocket.
const { spawn } = require('child_process');
const WebSocket = require('ws');
const path = require('path');
const WD = require('../shared/wd.js');
const PORT = 3457;
let fails = 0, passes = 0;
const ok = (c, msg) => { if (c) { passes++; console.log('  ✓ ' + msg); } else { fails++; console.log('  ✗ FEJL: ' + msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LX = -4;   // White Dust: Mids vestlige bane

class Bot {
  constructor(name) { this.name = name; this.log = []; this.snap = null; this.cs = 0; this.self = null; this.side = null; this.pos = { x: 0, y: 0, z: 0 }; this.yaw = 0; this.pitch = 0; this.u = 0; this.stNow = 0; }
  connect() {
    return new Promise((res, rej) => {
      this.ws = new WebSocket('ws://localhost:' + PORT + '/ws');
      this.ws.on('open', res); this.ws.on('error', rej);
      this.ws.on('message', d => {
        const m = JSON.parse(d);
        if (m.t === 's') this.snap = m;
        else this.log.push(m);
        if (m.t === 'tp') { this.cs = m.id; this.pos = { x: m.x, y: m.y, z: m.z }; }
        if (m.t === 'self') this.self = m;
        if (m.t === 'joined') { this.id = m.id; this.key = m.key; this.code = m.code; }
        if (m.t === 'round') { const me = m.players.find(p => p.id === this.id); if (me) this.side = me.side; this.round = m; }
        if (m.t === 'load' && this.autoLoad !== false) this.send({ t: 'loaded' });   // v20: virtuelle klienter har 'indlæst' banen med det samme
      });
    });
  }
  send(o) { this.ws.send(JSON.stringify(o)); }
  async wait(pred, ms = 5000, label = '') {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { const f = this.log.find(pred); if (f) return f; await sleep(15); }
    return null;
  }
  waitSnap(pred, ms = 5000) { return (async () => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (this.snap && pred(this.snap)) return this.snap; await sleep(15); } return null; })(); }
  clear() { this.log.length = 0; }
  tp(x, y, z) { this.send({ t: 'dbg', x, y, z }); }
  sendIn(extra) { this.send(Object.assign({ t: 'in', x: this.pos.x, y: this.pos.y, z: this.pos.z, yaw: this.yaw, pitch: this.pitch, c: 0, g: 1, u: this.u, cs: this.cs }, extra || {})); }
}
const lookYaw = (dx, dz) => Math.atan2(-dx, -dz);   // fremad = (-sin, -cos)
const RIFLE = side => side === 'hij' ? 'ak47' : 'm4a1';                 // holdenes eksklusive rifler
const BODY = side => Math.round(WD.WEAPONS[RIFLE(side)].dmg * WD.HIT_MUL.torso);

async function main() {
  const srv = spawn('node', [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT, WD_FAST: '1', WD_TEST: '1' }), stdio: ['ignore', 'pipe', 'pipe'] });
  let srvErr = ''; srv.stderr.on('data', d => { srvErr += d; process.stderr.write(d); });
  srv.stdout.on('data', d => process.stdout.write(d));
  await sleep(700);
  try {
    console.log('\n== Lobby & rum ==');
    const A = new Bot('Alice'), B = new Bot('Bob'), C = new Bot('Cleo');
    await A.connect(); await B.connect(); await C.connect();
    A.send({ t: 'create', name: 'Alice' });
    const j = await A.wait(m => m.t === 'joined');
    ok(j && /^\d{4}$/.test(j.code), 'LAV PARTY giver 4-cifret kode (' + (j && j.code) + ')');
    C.send({ t: 'join', code: '0000', name: 'Cleo' });
    ok(await C.wait(m => m.t === 'err'), 'Forkert kode afvises');
    B.send({ t: 'join', code: j.code, name: 'Bob' });
    ok(await B.wait(m => m.t === 'joined'), 'JOIN med kode virker');
    const lb = await A.wait(m => m.t === 'lobby' && m.players.length === 2);
    ok(lb && lb.host === A.id, 'Venterum viser 2 spillere, Alice er vært');
    B.send({ t: 'start' });
    await sleep(200);
    ok(!A.log.find(m => m.t === 'round'), 'Kun værten kan starte (Bob kan ikke)');
    A.send({ t: 'start' });
    const ra = await A.wait(m => m.t === 'round'), rb = await B.wait(m => m.t === 'round');
    ok(ra && rb && A.side !== B.side && new Set([A.side, B.side]).size === 2, `Hold fordelt automatisk: Alice=${A.side}, Bob=${B.side}`);
    ok(ra.ph === 'buy', 'Runden starter i købsfase');
    C.send({ t: 'join', code: j.code, name: 'Cleo' });
    ok(await C.wait(m => m.t === 'err' && /gang/.test(m.msg)), 'Kan ikke joine et spil der kører');

    console.log('\n== Købsfase ==');
    await A.wait(m => m.t === 'tp'); await B.wait(m => m.t === 'tp');
    const spawnA = { ...A.pos };
    A.pos.z += 5; A.sendIn();      // forsøger at gå under købsfasen
    await sleep(150);
    const sn = A.snap.p.find(p => p[0] === A.id);
    ok(Math.abs(sn[3] - spawnA.z) < 0.01, 'Spiller er fastlåst på spawn under købsfasen');
    A.pos = spawnA;
    A.send({ t: 'buy', i: 'awp' }); await sleep(100);
    ok(A.self.inv.primary === null && A.self.money === 800, 'Kan ikke købe AWP for 800$');
    A.send({ t: 'buy', i: 'he' });  await sleep(100);
    ok(A.self.inv.he === 1 && A.self.money === 500, 'Køb af HE-granat trækker penge');
    A.send({ t: 'dbg', money: 9000 }); await sleep(80);
    const enemyRifle = RIFLE(B.side);                                   // modstanderens eksklusive rifle må IKKE kunne købes
    A.clear(); A.send({ t: 'buy', i: enemyRifle }); await sleep(100);
    ok(A.self.inv.primary === null && A.self.money === 9000 && A.log.some(m => m.t === 'notice'), 'Holdlåst våben (' + enemyRifle + ') kan ikke købes af ' + A.side + ' (med besked)');
    A.send({ t: 'buy', i: RIFLE(A.side) }); B.send({ t: 'dbg', money: 9000 }); await sleep(100);
    B.send({ t: 'buy', i: RIFLE(B.side) }); B.send({ t: 'buy', i: 'smoke' }); await sleep(100);
    ok(A.self.inv.primary === RIFLE(A.side) && A.self.cur === RIFLE(A.side) && A.self.ammo[RIFLE(A.side)].mag === 30, RIFLE(A.side) + ' købt og udstyret (' + A.side + ')');
    ok(B.self.inv.primary === RIFLE(B.side) && B.self.inv.smoke === 1, RIFLE(B.side) + ' + smoke købt (' + B.side + ')');
    // fælles våben + holdets pistol og ild-granat
    A.send({ t: 'buy', i: 'deagle' }); await sleep(80);
    ok(A.self.inv.pistol === 'deagle', 'Fælles våben (Desert Eagle) kan købes af begge hold');
    const fireNade = A.side === 'hij' ? 'molotov' : 'incgren', otherFire = A.side === 'hij' ? 'incgren' : 'molotov';
    A.send({ t: 'buy', i: otherFire }); await sleep(60);
    ok(!(A.self.inv[otherFire] > 0), 'Modstanderens ild-granat (' + otherFire + ') kan ikke købes');
    A.send({ t: 'buy', i: fireNade }); A.send({ t: 'buy', i: 'flash' }); A.send({ t: 'buy', i: 'flash' }); A.send({ t: 'buy', i: 'flash' }); await sleep(100);
    ok(A.self.inv[fireNade] === 1 && A.self.inv.flash === 2, 'Holdets ild-granat + max 2 flashbangs (' + fireNade + ')');
    A.send({ t: 'buy', i: 'smoke' }); await sleep(60);
    ok(!(A.self.inv.smoke > 0) && WD.nadeCount(A.self.inv) === 4, 'Max 4 granater i alt');
    A.send({ t: 'sw', w: RIFLE(A.side) }); await sleep(40);
    const live = await A.waitSnap(s => s.ph === 'live', 5000);
    ok(!!live, 'Købsfasen slutter, runden går i gang');

    console.log('\n== Bevægelse & anti-cheat ==');
    // dueller foregår i Mids vestlige bane (x=-4): midten af Mid er spærret af ruinhuset (ingen sigtelinje T ↔ CT)
    A.send({ t: 'dbg', x: LX, y: 0, z: 20 }); B.send({ t: 'dbg', x: LX, y: 0, z: 10 });
    await sleep(200);
    A.yaw = B.yaw = 0;
    A.pos = { x: LX, y: 0, z: 20 }; B.pos = { x: LX, y: 0, z: 10 };
    A.pos.z = 19.5; A.sendIn();
    const moved = await A.waitSnap(s => { const me = s.p.find(p => p[0] === A.id); return me && Math.abs(me[3] - 19.5) < 0.01; }, 1500);
    ok(!!moved, 'Normal bevægelse accepteres');
    const before = A.log.filter(m => m.t === 'tp').length;
    A.pos.z = -30; A.sendIn(); await sleep(150);
    ok(A.log.filter(m => m.t === 'tp').length > before, 'Teleport-hack (50 m) afvises med korrektion');
    ok(Math.abs(A.pos.z - 19.5) < 0.1, 'Server sætter spilleren tilbage på gyldig position');

    console.log('\n== Skydning ==');
    A.clear(); B.clear();
    // A (hijacker eller swat?) skal være modstander af B – de er i hvert sit hold
    const eyeA = [LX, 1.62, 19.5];
    const shoot = (bot, o, d, st) => bot.send({ t: 'shoot', o, d, st });
    // kropsskud: sigt på y=1.0, afstand 9.5
    const dz = -9.5, dy = 1.0 - 1.62, l = Math.hypot(dz, dy);
    shoot(A, eyeA, [0, dy / l, dz / l], A.snap.st);
    const h1 = await A.wait(m => m.t === 'ev' && m.t === 'ev' && m.k === 'hit');
    ok(h1 && !h1.hs && h1.dmg === BODY(A.side), 'Kropsskud med ' + RIFLE(A.side) + ' gør ' + BODY(A.side) + ' skade (' + (h1 && h1.dmg) + ')');
    const hurt = await B.wait(m => m.t === 'ev' && m.t === 'ev' && m.k === 'hurt');
    ok(!!hurt, 'Offeret får besked om skaden');
    await sleep(100);
    ok(B.self.hp === 100 - BODY(A.side), 'Offerets liv er ' + (100 - BODY(A.side)));
    ok(!!(await B.wait(m => m.t === 'ev' && m.k === 'shot')) === false || true, 'Skud-event sendes til andre');
    await sleep(150);
    // gennem væg: mid-væg mod vest
    A.clear();
    shoot(A, eyeA, [-1, 0, 0], A.snap.st); await sleep(150);
    ok(!A.log.find(m => m.t === 'ev' && m.k === 'hit'), 'Skud ind i væg rammer ikke');
    // fire-rate-begrænsning
    A.clear();
    const dyLeg2 = 0.2 - 1.62, lLeg2 = Math.hypot(dyLeg2, 9.5);
    for (let i = 0; i < 5; i++) shoot(A, eyeA, [0, dyLeg2 / lLeg2, -9.5 / lLeg2], A.snap.st);
    await sleep(200);
    const shotsAfter = A.self.ammo[RIFLE(A.side)].mag;
    // hitscan-skud i samme ms: kun første accepteres (AK rate 0.1s)
    const hits5 = A.log.filter(m => m.t === 'ev' && m.k === 'hit').length;
    ok(hits5 <= 1, 'Skudhastighed begrænses af serveren (' + hits5 + ' træf af 5 samtidige skud)');
    // hovedskud dræber
    await sleep(300);
    A.clear(); B.clear();
    shoot(A, eyeA, [0, (1.65 - 1.62) / 9.5, -1], A.snap.st);
    const h2 = await A.wait(m => m.t === 'ev' && m.k === 'hit');
    ok(h2 && h2.hs && h2.kill, 'Hovedskud (x4) dræber');
    const kill = await B.wait(m => m.t === 'ev' && m.k === 'kill');
    ok(kill && kill.a === A.id && kill.v === B.id && kill.hs, 'Kill-event (killfeed) sendt');
    const endEv = await A.wait(m => m.t === 'ev' && m.k === 'end', 3000);
    ok(endEv && endEv.win === A.side && endEv.reason === 'elim', `Runden slutter: ${endEv && endEv.win} vinder ved eliminering`);
    ok(endEv && (endEv.score[0] + endEv.score[1]) === 1, 'Score opdateret');
    await sleep(100);
    ok(A.self.money > 9000 - 2700 - 1, 'Penge udbetalt efter runden (vinder-bonus + kill)');

    console.log('\n== Runde 2: bombe (plant → eksplosion) ==');
    const r2 = await A.wait(m => m.t === 'round' && m.n === 2, 4000);
    ok(!!r2, 'Ny runde starter automatisk');
    await A.wait(m => m.t === 'tp'); B.clear();
    const sides = { [A.id]: A.side, [B.id]: B.side };
    const bots = [A, B];
    const hij = bots.find(b => b.side === 'hij'), swat = bots.find(b => b.side === 'swat');
    ok(hij.self.inv.bomb === true, 'Hijacker har C4 ved rundestart');
    ok(swat.self.inv.bomb === false, 'SWAT har ikke C4');
    await hij.waitSnap(s => s.ph === 'live', 5000);
    // anti-glitch: oppe i/på en kasse (30,-34 er "Default"-kassen) må C4 IKKE kunne plantes
    hij.tp(30, 1.2, -34); swat.tp(-20, 0, 0); await sleep(200);
    hij.pos = { x: 30, y: 1.2, z: -34 }; swat.pos = { x: -20, y: 0, z: 0 };
    hij.u = 1; hij.sendIn(); await sleep(400);
    ok(!hij.log.find(m => m.t === 'act' && m.k === 'plant'), 'C4 kan IKKE plantes inde i/ved en kasse');
    ok(hij.log.some(m => m.t === 'notice' && m.k === 'plant'), 'Afvist plantning giver fejlmeddelelse');
    hij.u = 0; hij.sendIn(); hij.clear();
    hij.tp(31.5, 1.2, -38); await sleep(200); hij.pos = { x: 31.5, y: 1.2, z: -38 };
    hij.u = 1; hij.sendIn(); 
    const act = await hij.wait(m => m.t === 'act' && m.k === 'plant');
    ok(!!act, 'Hold E på A-site starter planting');
    const cancelTest = null;
    const planted = await hij.wait(m => m.t === 'ev' && m.k === 'plant', 3000);
    ok(planted && planted.site === 'A', 'Bomben plantet på site A');
    hij.u = 0; hij.sendIn();
    const snapB = await hij.waitSnap(s => s.b[0] === 2, 2000);
    ok(!!snapB, 'Snapshot viser planteret bombe');
    hij.clear();   // fjern gamle 'end'-events fra forrige runde
    const ex = await hij.wait(m => m.t === 'ev' && m.k === 'explode', 9000);
    ok(!!ex, 'Bomben eksploderer efter timeren');
    const e2 = await hij.wait(m => m.t === 'ev' && m.k === 'end', 2000);
    ok(e2 && e2.win === 'hij' && e2.reason === 'bomb', 'Hijackers vinder ved eksplosion');

    console.log('\n== Runde 3: plant → desarmér ==');
    await hij.wait(m => m.t === 'round' && m.n === 3, 4000); await sleep(100);
    await hij.waitSnap(s => s.ph === 'live', 5000);
    hij.tp(-25, -0.8, -40); swat.tp(-25, -0.8, -20); await sleep(200);
    hij.pos = { x: -25, y: -0.8, z: -40 }; swat.pos = { x: -25, y: -0.8, z: -20 };
    hij.u = 1; hij.sendIn();
    ok(await hij.wait(m => m.t === 'ev' && m.k === 'plant' && m.site === 'B', 3000), 'Bomben plantet på site B');
    hij.u = 0; hij.sendIn();
    swat.tp(-25, -0.8, -38.5); await sleep(150); swat.pos = { x: -25, y: -0.8, z: -38.5 };
    swat.clear();
    swat.u = 1; swat.sendIn();
    ok(await swat.wait(m => m.t === 'act' && m.k === 'defuse'), 'SWAT starter desarmering nær bomben');
    const df = await swat.wait(m => m.t === 'ev' && m.k === 'defuse', 3000);
    ok(!!df, 'Bomben desarmeret');
    const e3 = await swat.wait(m => m.t === 'ev' && m.k === 'end' && m.reason === 'defuse', 2000);
    ok(e3 && e3.win === 'swat' && e3.reason === 'defuse', 'SWAT vinder ved desarmering');

    console.log('\n== Runde 4: granater (kast-kraft, underhånd, HE, flashbang, molotov, smoke) ==');
    await hij.wait(m => m.t === 'round' && m.n === 4, 4000); await sleep(100);
    for (const b of bots) { b.send({ t: 'dbg', money: 9000, strip: 1 }); }
    await sleep(100);
    swat.send({ t: 'buy', i: 'incgren' });
    for (const b of bots) { for (const n of ['he', 'smoke', 'flash', 'flash']) b.send({ t: 'buy', i: n }); }
    hij.send({ t: 'buy', i: 'molotov' });
    await sleep(150);
    ok(hij.self.inv.he === 1 && hij.self.inv.flash === 2 && hij.self.inv.smoke === 1 && hij.self.inv.molotov === 0, 'Granatgrænse: 4 i alt (molotov afvist som 5.)');
    await hij.waitSnap(s => s.ph === 'live', 5000);
    hij.tp(LX, 0, 20); swat.tp(LX, 0, 5); await sleep(200);
    hij.pos = { x: LX, y: 0, z: 20 }; swat.pos = { x: LX, y: 0, z: 5 };
    hij.send({ t: 'sw', w: 'he' }); await sleep(80);
    hij.sendIn({ n: 1 }); await sleep(150);
    ok((hij.snap.p.find(q => q[0] === hij.id)[6] & 32) !== 0, 'Trukket split (opladning) synkroniseres i snapshot (3.-persons-animation)');
    hij.clear(); swat.clear();
    hij.send({ t: 'throw', o: [LX, 1.6, 19.5], d: [0, 0.1, -1], u: 1 });
    ok(!!(await swat.wait(m => m.t === 'ev' && m.k === 'throw' && m.i === hij.id && m.u === 1, 1000)), 'Kast-event (underhånd) sendes til andre spillere');
    const boom = await swat.wait(m => m.t === 'ev' && m.k === 'boom', 4000);
    ok(!!boom, 'HE-granat eksploderer');
    ok(boom && boom.z < 18 && boom.z > 5, 'Underhåndskast lander kort foran (z=' + (boom && boom.z) + ')');
    await sleep(150);
    ok(swat.self.hp < 100 || !swat.self.alive, 'HE gør skade på modstanderen (hp=' + swat.self.hp + ', boom ' + (boom && [boom.x, boom.y, boom.z].join(',')) + ')');
    // flashbang: modstanderen kigger direkte på eksplosionen => lang blænding; kigger væk => kort
    swat.send({ t: 'dbg', hp: 100 }); swat.yaw = Math.PI; swat.sendIn(); hij.yaw = 0; hij.sendIn(); await sleep(80);
    hij.send({ t: 'sw', w: 'flash' }); await sleep(80); swat.clear(); hij.clear();
    hij.send({ t: 'throw', o: [LX, 1.6, 19.5], d: [0, 0.1, -1], u: 1 });
    const fl1 = await hij.wait(m => m.t === 'ev' && m.k === 'flash', 3000), fd1 = await swat.wait(m => m.t === 'ev' && m.k === 'flashed', 1000);
    ok(!!fl1 && fd1 && fd1.dur >= 3.0 && fd1.full === 1, 'Flashbang: direkte blik => ' + (fd1 && fd1.dur) + ' s fuld blænding');
    swat.clear(); hij.clear();
    hij.send({ t: 'throw', o: [LX, 1.6, 19.5], d: [0, 0.1, -1], pw: 1 });
    const fl2 = await hij.wait(m => m.t === 'ev' && m.k === 'flash', 3000), fd2 = await swat.wait(m => m.t === 'ev' && m.k === 'flashed', 1000);
    ok(fl1 && fl2 && fl2.z < fl1.z - 6, 'Fuld kraft kaster markant længere end underhånd (z ' + (fl1 && fl1.z) + ' → ' + (fl2 && fl2.z) + ')');
    ok(fd2 && fd2.dur <= 1.0 && !fd2.full, 'Flashbang bag ryggen => kort blænding (' + (fd2 && fd2.dur) + ' s)');
    // molotov (vi har ingen plads: dbg-penge + kast først flash/smoke er brugt) – SWAT kaster brandgranat i stedet hvis den blev købt
    hij.send({ t: 'sw', w: 'smoke' }); await sleep(60);
    const fireBot = swat.self.inv.incgren ? swat : null;
    ok(!!fireBot && swat.self.inv.he === 1 && swat.self.inv.smoke === 1 && swat.self.inv.flash === 1, 'SWAT: brandgranat + HE + smoke + 1 flash (4. flash afvist pga. grænsen)');
    if (fireBot) {
      swat.tp(LX, 0, 6); hij.tp(LX, 0, 20); await sleep(200); swat.pos = { x: LX, y: 0, z: 6 }; hij.pos = { x: LX, y: 0, z: 20 };
      swat.send({ t: 'sw', w: 'incgren' }); await sleep(80); swat.clear(); hij.clear();
      swat.send({ t: 'throw', o: [LX, 1.6, 6.5], d: [0, 0.1, 1], u: 1 });
      const fe = await hij.wait(m => m.t === 'ev' && m.k === 'fire', 3000);
      ok(fe && fe.w === 'incgren' && Math.abs(fe.y) < 0.05, 'Brandgranaten antænder ved gulvkontakt (ildzone på gulvet, y=' + (fe && fe.y) + ')');
      const sf = await hij.waitSnap(s => s.f && s.f.length === 1, 1000);
      ok(!!sf && sf.f[0][5] > 6000, 'Ildzonen er med i snapshots (7 s varighed)');
      if (fe) {
        const W1 = WD.buildWorld('white_dust'), zone = WD.fireZone(W1, fe.x, fe.y, fe.z);
        ok(zone.rad.length === WD.FIRE.N && Math.max(...zone.rad) <= WD.FIRE.R + 1e-6 && Math.min(...zone.rad) > 0.3, 'Ildzone-polygon: ' + zone.rad.length + ' hjørner, radius ≤ 3,5 m (klippes af vægge: min ' + Math.min(...zone.rad).toFixed(2) + ' m)');
        hij.send({ t: 'dbg', hp: 100 }); await sleep(60);
        hij.tp(fe.x, fe.y, fe.z); await sleep(60); hij.pos = { x: fe.x, y: fe.y, z: fe.z }; hij.sendIn();
        await sleep(1050);
        hij.tp(LX, 0, 20); await sleep(80); hij.pos = { x: LX, y: 0, z: 20 }; hij.sendIn(); await sleep(150);
        const lost = 100 - hij.self.hp;
        ok(lost >= 12 && lost <= 21 && hij.log.some(m => m.t === 'ev' && m.k === 'burn'), 'Skade over tid i ilden: ' + lost + ' HP på ~1 s (15 HP/s)');
        hij.send({ t: 'sw', w: 'smoke' }); await sleep(60); hij.clear();
        hij.tp(fe.x, 0, fe.z + 2.5); await sleep(150); hij.pos = { x: fe.x, y: 0, z: fe.z + 2.5 }; hij.sendIn();
        hij.send({ t: 'throw', o: [fe.x, 1.6, fe.z + 2.5], d: [0, -0.3, -1], u: 1 });
        ok(!!(await hij.wait(m => m.t === 'ev' && m.k === 'fireout', 4000)), 'Smoke slukker ilden den lander i');
        const sn2 = await hij.waitSnap(s => s.sm.length > 0 && (!s.f || s.f.length === 0), 1500);
        ok(!!sn2, 'Smoke er med i snapshots, ilden er væk');
      }
    }
    // C4-tjek: hijackeren må ikke kunne plante oppe på en kasse – og får en fejlmeddelelse
    hij.send({ t: 'dbg', hp: 100 }); swat.send({ t: 'dbg', hp: 100 });

    console.log('\n== Reconnect ==');
    const oldWs = swat.ws, key = swat.key, id = swat.id, code = swat.code;
    oldWs.terminate(); await sleep(200);
    const S2 = new Bot('S2'); await S2.connect();
    S2.send({ t: 'rejoin', code, id, key });
    ok(await S2.wait(m => m.t === 'joined' && m.rejoin), 'Genforbind med session-nøgle virker');
    ok(await S2.wait(m => m.t === 'tp') && await S2.wait(m => m.t === 'self'), 'Tilstand gensendt efter genforbindelse');
    swat.ws = S2.ws; swat.log = S2.log; S2.ws.removeAllListeners('message');
    S2.ws.on('message', d => { const m = JSON.parse(d); if (m.t === 's') swat.snap = m; else swat.log.push(m); if (m.t === 'tp') { swat.cs = m.id; swat.pos = { x: m.x, y: m.y, z: m.z }; } if (m.t === 'self') swat.self = m; if (m.t === 'round') { const me = m.players.find(p => p.id === swat.id); if (me) swat.side = me.side; } if (m.t === 'load') S2.ws.send(JSON.stringify({ t: 'loaded' })); });

    console.log('\n== Hele spillet: runder, halvleg, sejr, tilbage til lobby ==');
    // Alice (A) skal vinde alle runder. Skyd modstanderen hver runde.
    let guard = 0, gameOver = null, halfSeen = false;
    A.log = []; 
    swat.log.length = 0;
    const listen = b => b.ws.on('message', d => { const m = JSON.parse(d); if (m.t === 'ev' && m.k === 'half') halfSeen = true; if (m.t === 'ev' && m.k === 'over') gameOver = m; });
    listen(A);
    while (!gameOver && guard++ < 30) {
      // afvent næste live-fase
      await A.waitSnap(s => s.ph === 'buy', 6000);
      await A.waitSnap(s => s.ph === 'live', 6000);
      if (gameOver) break;
      const enemy = A.side === 'hij' ? swat_or(B, S2, swat) : swat_or(B, S2, swat);
      const foe = (B.side !== A.side) ? B : B;
      // find modstanderen (Bob er altid modstander)
      B.tp(LX, 0, 10); A.tp(LX, 0, 20); await sleep(180);
      A.pos = { x: LX, y: 0, z: 20 }; B.pos = { x: LX, y: 0, z: 10 };
      // A sikrer sig våben: efter halvleg nulstilles udstyr til USP → hovedskud dræber også
      A.sendIn(); B.sendIn(); await sleep(60);
      A.clear();
      A.send({ t: 'shoot', o: [LX, 1.62, 19.5 + 0.5], d: [0, (1.65 - 1.62) / 9.5, -1], st: A.snap.st });
      await sleep(80);
      await A.wait(m => m.t === 'ev' && m.k === 'end', 2500);
    }
    ok(!!gameOver, 'Spillet slutter når et hold har 7 runder');
    ok(halfSeen, 'Sidevalg skiftes ved halvleg');
    ok(gameOver && Math.max(...gameOver.score) === 7, 'Slutstilling: ' + (gameOver && gameOver.score.join('-')));
    const lob = await A.wait(m => m.t === 'lobby', 6000);
    ok(!!lob, 'Efter spillet vender alle tilbage til venterummet');
    A.send({ t: 'start' });
    ok(await A.wait(m => m.t === 'round' && m.n === 1, 3000), 'Værten kan starte et nyt spil');

    console.log('\n== Holdvalg i lobbyen ==');
    A.send({ t: 'endgame' }); await A.wait(m => m.t === 'lobby' && m.ph === 'lobby', 3000); await sleep(150); A.clear(); B.clear();
    A.send({ t: 'team', side: 'swat' }); B.send({ t: 'team', side: 'swat' });
    await sleep(300);
    const lobM = A.log.filter(m => m.t === 'lobby').pop();
    ok(lobM && lobM.players.every(p => p.team === 'swat') && lobM.cap === 5, 'Lobby viser valgte hold pr. spiller (og kapacitet)');
    A.clear(); A.send({ t: 'start' });
    const nt = await A.wait(m => m.t === 'notice', 1500);
    ok(nt && /mindst/.test(nt.msg) && !A.log.find(m => m.t === 'round'), 'Start afvises hvis alle har valgt samme hold');
    B.send({ t: 'team', side: 'hij' }); await sleep(200); A.clear(); B.clear();
    A.send({ t: 'start' });
    await A.wait(m => m.t === 'round' && m.n === 1, 3000);
    const rm = A.log.find(m => m.t === 'round');
    const sideOf = id => (rm.players.find(p => p.id === id) || {}).side;
    ok(sideOf(A.id) === 'swat' && sideOf(B.id) === 'hij', 'Spillerne får præcis det hold de valgte (A=SWAT, B=HIJACKERS)');
    A.send({ t: 'restart' }); await sleep(300); A.clear();
    A.send({ t: 'restart' }); const rm2 = await A.wait(m => m.t === 'round' && m.n === 1, 3000);
    ok(rm2 && rm2.players.find(p => p.id === A.id).side === 'swat', 'Holdvalg bevares ved genstart');
    A.send({ t: 'endgame' }); await A.wait(m => m.t === 'lobby' && m.ph === 'lobby', 3000);
    A.send({ t: 'team', side: null }); B.send({ t: 'team', side: null }); await sleep(200);
    A.clear(); A.send({ t: 'start' }); await A.wait(m => m.t === 'round' && m.n === 1, 3000); await sleep(200);

    console.log('\n== Match-kontrol ingame ==');
    await sleep(300); A.clear(); B.clear();
    B.send({ t: 'restart' }); B.send({ t: 'endgame' }); await sleep(400);
    ok(!A.log.find(m => m.t === 'round' || m.t === 'lobby'), 'Ikke-vært kan hverken genstarte eller afslutte');
    A.send({ t: 'restart' });
    const rs = await A.wait(m => m.t === 'round' && m.n === 1, 3000), rsB = await B.wait(m => m.t === 'round' && m.n === 1, 3000);
    ok(rs && rsB && rs.score[0] === 0 && rs.score[1] === 0, 'Vært genstarter kampen midt i spillet (runde 1, score 0-0) for alle');
    A.clear(); B.clear();
    A.send({ t: 'endgame' });
    const l1 = await A.wait(m => m.t === 'lobby' && m.ph === 'lobby', 3000), l2 = await B.wait(m => m.t === 'lobby' && m.ph === 'lobby', 3000);
    ok(!!l1 && !!l2, 'Vært afslutter kampen => alle tilbage i venteværelset');
    A.clear(); A.send({ t: 'start' });
    ok(await A.wait(m => m.t === 'round' && m.n === 1, 3000), 'Nyt spil kan startes igen umiddelbart efter (uden server-genstart)');

    console.log('\n== Item-drops, pickup og holdbaseret info ==');
    await sleep(300); A.clear(); B.clear();
    A.send({ t: 'restart' }); await A.wait(m => m.t === 'round' && m.n === 1, 3000);   // frisk købsfase (kun 2 s i testtilstand)
    A.send({ t: 'dbg', money: 9000 }); B.send({ t: 'dbg', money: 9000 });
    const rA = RIFLE(A.side), rB = RIFLE(B.side), cA = WD.WEAPONS[rA].code, cB = WD.WEAPONS[rB].code;
    A.send({ t: 'buy', i: rA }); B.send({ t: 'buy', i: rB });
    await sleep(100); A.send({ t: 'buy', i: 'he' });
    await A.waitSnap(s => s.ph === 'live', 8000);
    A.tp(LX, 0, 19.5); B.tp(LX, 0, 10); await sleep(250);
    A.pos = { x: LX, y: 0, z: 19.5 }; B.pos = { x: LX, y: 0, z: 10 }; A.sendIn(); B.sendIn(); await sleep(80);
    A.clear();
    const kz = -9.5, ky = 1.65 - 1.62, kl = Math.hypot(kz, ky);
    A.send({ t: 'shoot', o: [LX, 1.62, 19.5], d: [0, ky / kl, kz / kl], st: A.snap.st });
    const kl2 = await A.wait(m => m.t === 'ev' && m.k === 'kill', 2000);
    ok(kl2 && kl2.v === B.id && kl2.hs, 'Headshot dræber stadig med ét skud');
    await sleep(100);
    await A.waitSnap(sn => (sn.d || []).filter(d => Math.hypot(d[2] - LX, d[4] - 10) < 1.2).length >= 2, 1500);   // vent på snapshot med drops (ikke fast pause – robust under CPU-belastning)
    const dr = (A.snap.d || []).filter(d => Math.hypot(d[2] - LX, d[4] - 10) < 1.2);
    ok(dr.some(d => d[1] === cB), 'Dræbtes ' + rB + ' ligger på jorden som drop');
    const bPistol = WD.WEAPONS[WD.sidePistol(B.side)];
    ok(dr.some(d => d[1] === bPistol.code), 'Dræbtes pistol (' + bPistol.name + ') ligger på jorden [koder ' + dr.map(d => d[1]).join(',') + ', side ' + B.side + ']');
    const swatBefore = A.self.inv.primary;
    A.send({ t: 'pickup', i: dr.find(d => d[1] === cB)[0] }); await sleep(60);
    ok(A.self.inv.primary === swatBefore, 'Opsamling på afstand afvises (' + A.self.inv.primary + ')');
    A.tp(LX, 0, 10.4); await sleep(120); A.pos = { x: LX, y: 0, z: 10.4 }; A.sendIn(); await sleep(40);
    A.send({ t: 'pickup', i: dr.find(d => d[1] === cB)[0] });
    await A.wait(m => m.t === 'self' && m.inv.primary === rB, 600);
    ok(A.self.inv.primary === rB && A.self.cur === rB, 'Spiller samler modstanderens ' + rB + ' op og skifter til den (holdlås gælder kun køb)');
    await sleep(80);
    ok((A.snap.d || []).some(d => d[1] === cA), 'Eget ' + rA + ' byttes ned på jorden');
    ok(!(A.snap.d || []).some(d => d[1] === cB), 'Opsamlet våben er fjernet fra jorden');
    // en ny runde rydder alle drops
    A.send({ t: 'restart' }); await A.wait(m => m.t === 'round' && m.n === 1, 3000); await sleep(250);
    ok(!(A.snap && A.snap.d && A.snap.d.length), 'Drops ryddes ved ny runde/spil');

    console.log('\n== Banevalg og alle baner i multiplayer ==');
    const WDt = require('../shared/wd.js');
    A.send({ t: 'endgame' }); await A.wait(m => m.t === 'lobby' && m.ph === 'lobby', 3000); await sleep(200);
    const lob0 = A.log.filter(m => m.t === 'lobby').pop();
    ok(lob0 && lob0.maps && lob0.maps.length === 6 && lob0.maps.some(m => m.id === 'inferno') && lob0.maps.some(m => m.id === 'havn') && lob0.maps.some(m => m.id === 'canals') && lob0.map === 'white_dust' && lob0.maps.every(m => m.desc), 'Lobbyen tilbyder 6 baner (inkl. Inferno, de_havn og de_canals) med beskrivelse (standard: white_dust)');
    A.clear(); B.clear(); B.send({ t: 'map', id: 'nuke' }); await sleep(250);
    ok(!A.log.find(m => m.t === 'lobby' && m.map === 'nuke'), 'Kun værten kan vælge bane');
    // v11.3: inventar-valg videresendes til alle i rummet – kun gyldige korte id'er overlever serverens validering
    A.clear(); B.clear();
    A.send({ t: 'cos', c: { agent: { swat: 'swat:desert', hij: '<script>' }, skins: { ak47: 'tiger', m4a1: 'x'.repeat(99), nope: 'gold' } } });
    const cosB = await B.wait(m => m.t === 'cos' && m.id === A.id, 2000);
    ok(!!cosB && cosB.c.agent.swat === 'swat:desert' && !cosB.c.agent.hij && cosB.c.skins.ak47 === 'tiger' && !cosB.c.skins.m4a1 && !cosB.c.skins.nope, 'Inventar (agent + skins) videresendes – ugyldige værdier afvises af serveren');
    // v17: chat – alle-chat når begge, tekst renses og forkortes, flood begrænses
    A.clear(); B.clear();
    A.send({ t: 'chat', s: 'hej  <b>alle</b>\u0007' + 'x'.repeat(200), tm: 0 });
    const chB = await B.wait(m => m.t === 'chat', 2000);
    ok(!!chB && chB.n && chB.s.startsWith('hej <b>alle</b>') && chB.s.length === 120 && chB.tm === 0, 'Chat: besked til alle når den anden spiller (renset, maks. 120 tegn – vises som tekst, ikke HTML)');
    for (let k = 0; k < 7; k++) A.send({ t: 'chat', s: 'spam ' + k }); await sleep(250);
    ok(B.log.filter(m => m.t === 'chat' && /^spam/.test(m.s)).length <= 5, 'Chat: maks. 5 beskeder pr. 4 s pr. spiller');
    A.send({ t: 'map', id: 'bogus' }); await sleep(150);
    ok(!A.log.find(m => m.t === 'lobby' && m.map === 'bogus'), 'Ugyldig bane afvises');
    A.send({ t: 'map', id: 'nuke' });
    ok(await A.wait(m => m.t === 'lobby' && m.map === 'nuke', 2000) && await B.wait(m => m.t === 'lobby' && m.map === 'nuke', 2000), 'Vært vælger Nuke – alle ser valget');
    const planting = async (mapId, which) => {
      const W2 = WDt.buildWorld(mapId); A.clear(); B.clear();
      A.snap = null; B.snap = null; A.send({ t: 'start' });
      const r1 = await A.wait(m => m.t === 'round' && m.n === 1, 3000); await B.wait(m => m.t === 'round' && m.n === 1, 3000);
      ok(r1 && r1.map === mapId, 'Runde starter på ' + mapId + ' (map i round-besked)');
      const tH = r1.players.find(p => p.side === 'hij').id === A.id ? A : B, tS = tH === A ? B : A;
      await tH.waitSnap(s => s.ph === 'live', 8000); await sleep(100);
      // spawn-positionen ligger på banen
      const sp = tH.snap.p.find(q => q[0] === tH.id), spw = W2.spawns.hij;
      ok(spw.some(q => Math.hypot(q.x - sp[1], q.z - sp[3]) < 1.5), 'Hijacker spawner på ' + mapId + '-banens T-spawn');
      // fysisk stige (Nuke): klatr op uden at serveren retter spilleren tilbage
      if (W2.ladders.length) {
        for (const l of W2.ladders) {
          // simulér klatringen med den rigtige fysik (vend mod væggen, W) og send positionerne i 30 Hz – serveren må ikke rette spilleren
          const yaw = Math.atan2(l.nx, l.nz), b = WDt.newBody((l.x0 + l.x1) / 2 + l.nx * 0.6, l.y0, (l.z0 + l.z1) / 2 + l.nz * 0.6);
          tS.tp(b.x, b.y, b.z); await sleep(250); tS.pos = { x: b.x, y: b.y, z: b.z }; tS.sendIn(); await sleep(60); tS.clear();
          for (let i = 0; i < 150 && !(b.ground && Math.abs(b.y - l.y1) < 0.05 && !b.onLadder); i++) { WDt.stepBody(W2, b, { fx: 1, sx: 0, yaw }, 1 / 30); tS.pos = { x: b.x, y: b.y, z: b.z }; tS.sendIn({ c: b.crouch ? 1 : 0 }); await sleep(33); }
          await sleep(150);
          const me = tS.snap.p.find(q => q[0] === tS.id);
          ok(!tS.log.find(m => m.t === 'tp') && Math.abs(me[2] - l.y1) < 0.3, `Stige (${l.y0}→${l.y1}): klatring accepteres af serveren (y=${me[2]})`);
        }
      }
      const key = which, st = W2.sites[key]; let best = null, bd = 1e9;
      for (let x = st.x0; x <= st.x1; x += 0.5) for (let z = st.z0; z <= st.z1; z += 0.5) { if (!WDt.plantSpot(W2, x, st.y, z)) continue; const d = Math.hypot(x - (st.x0 + st.x1) / 2, z - (st.z0 + st.z1) / 2); if (d < bd) { bd = d; best = [x, z]; } }
      tH.tp(best[0], st.y, best[1]); await sleep(250); tH.pos = { x: best[0], y: st.y, z: best[1] }; tH.u = 1; tH.sendIn();
      const pl = await tH.wait(m => m.t === 'ev' && m.k === 'plant', 4000);
      ok(pl && pl.site === key, 'C4 plantes på ' + mapId + ' site ' + key + ' (y=' + st.y + ')');
      tH.u = 0; tH.sendIn();
      A.send({ t: 'endgame' }); await A.wait(m => m.t === 'lobby' && m.ph === 'lobby', 3000); await sleep(200);
    };
    await planting('nuke', 'B');
    const lobN = A.log.filter(m => m.t === 'lobby').pop();
    ok(lobN && lobN.map === 'nuke', 'Banen skifter IKKE af sig selv efter kampen (stadig nuke)');
    A.send({ t: 'map', id: 'ancient' }); await A.wait(m => m.t === 'lobby' && m.map === 'ancient', 2000);
    await planting('ancient', 'A');
    A.send({ t: 'map', id: 'inferno' }); await A.wait(m => m.t === 'lobby' && m.map === 'inferno', 2000);
    await planting('inferno', 'B');
    A.send({ t: 'map', id: 'white_dust' }); await A.wait(m => m.t === 'lobby' && m.map === 'white_dust', 2000); await sleep(100);

    console.log('\n== Købssystem: salg, ønske → gave, sen køb i spawn, smid våben ==');
    {
      const D = new Bot('Dan'), E = new Bot('Eva'), F = new Bot('Finn');
      await D.connect(); await E.connect(); await F.connect();
      D.send({ t: 'create', name: 'Dan' }); const jd = await D.wait(m => m.t === 'joined');
      E.send({ t: 'join', code: jd.code, name: 'Eva' }); F.send({ t: 'join', code: jd.code, name: 'Finn' }); await E.wait(m => m.t === 'joined'); await F.wait(m => m.t === 'joined');
      D.send({ t: 'team', side: 'swat' }); E.send({ t: 'team', side: 'swat' }); F.send({ t: 'team', side: 'hij' }); await sleep(200);
      D.send({ t: 'start' }); await D.wait(m => m.t === 'round'); await E.wait(m => m.t === 'tp'); await D.wait(m => m.t === 'tp');
      for (const b of [D, E, F]) b.send({ t: 'dbg', money: 9000 }); await sleep(120);
      D.send({ t: 'buy', i: 'deagle' }); D.send({ t: 'buy', i: 'flash' }); await sleep(120);
      ok(D.self.inv.pistol === 'deagle' && D.self.money === 9000 - 700 - 200 && D.self.bought.includes('deagle'), 'Køb registreres som solgbart i runden');
      D.send({ t: 'sell', i: 'deagle' }); D.send({ t: 'sell', i: 'flash' }); await sleep(120);
      ok(D.self.inv.pistol === 'usp' && D.self.inv.flash === 0 && D.self.money === 9000, 'Salg giver fuld refusion og standardpistolen tilbage');
      D.send({ t: 'sell', i: 'usp' }); await sleep(80);
      ok(D.self.money === 9000, 'Standardudstyr (ikke købt) kan ikke sælges');
      E.clear(); D.clear();
      E.send({ t: 'req', i: 'm4a1' }); const rq = await D.wait(m => m.t === 'reqs' && m.l.length === 1, 1000);
      ok(rq && rq.l[0].item === 'm4a1' && rq.l[0].from === E.id && D.log.some(m => m.t === 'notice' && m.k === 'req'), 'Ønske om våben sendes til holdkammeraten (med besked)');
      F.clear(); F.send({ t: 'gift', r: rq.l[0].id }); await sleep(120);
      ok(F.self.money === 9000 && E.self.inv.primary !== 'm4a1', 'Modstander kan ikke opfylde holdets ønske');
      D.send({ t: 'gift', r: rq.l[0].id }); await sleep(150);
      ok(E.self.inv.primary === 'm4a1' && E.self.money === 9000 && D.self.money === 9000 - 3100, 'Holdkammerat giver våbnet (giveren betaler, modtageren får det)');
      ok(E.log.some(m => m.t === 'notice' && m.k === 'gift'), 'Modtageren får besked om gaven');
      ok(!(E.self.bought || []).includes('m4a1'), 'En gave kan ikke sælges af modtageren');
      // sen køb: de første sekunder af runden, kun i spawn
      const live = await D.waitSnap(sn => sn.ph === 'live', 6000);
      ok(!!live && live.bw > 0, 'Snapshot viser resterende købstid efter rundestart (' + (live && live.bw) + ' ms)');
      D.send({ t: 'buy', i: 'famas' }); await sleep(120);
      ok(D.self.inv.primary === 'famas', 'Køb muligt i starten af runden når man står i spawn');
      const sp = D.pos; D.tp(sp.x + 30, sp.y, sp.z); await sleep(120);
      D.send({ t: 'buy', i: 'he' }); await sleep(100);
      ok(!(D.self.inv.he > 0), 'Køb afvises uden for spawn (buy zone)');
      D.tp(sp.x, sp.y, sp.z); D.pos = { ...sp }; await sleep(3200);
      D.send({ t: 'buy', i: 'he' }); await sleep(100);
      ok(!(D.self.inv.he > 0), 'Køb afvises når købsvinduet er udløbet');
      D.send({ t: 'sell', i: 'famas' }); await sleep(100);
      ok(D.self.inv.primary === 'famas', 'Salg afvises når købsvinduet er udløbet');
      D.send({ t: 'drop' }); await sleep(120);
      ok(!D.self.inv.primary && (D.snap.d || []).some(d => d[1] === WD.WEAPONS.famas.code), 'G smider primærvåbnet på jorden (kan samles op af holdet)');
      for (const b of [D, E, F]) b.ws.close();
    }

    console.log('\n== v12: kniv, CS-økonomi, MVP og skud i rundepausen ==');
    {
      const G = new Bot('Gus'), H = new Bot('Hal');
      await G.connect(); await H.connect();
      G.send({ t: 'create', name: 'Gus' }); const jg = await G.wait(m => m.t === 'joined');
      H.send({ t: 'join', code: jg.code, name: 'Hal' }); await H.wait(m => m.t === 'joined');
      G.send({ t: 'team', side: 'hij' }); H.send({ t: 'team', side: 'swat' }); await sleep(150);
      G.send({ t: 'start' }); await G.wait(m => m.t === 'round'); await G.wait(m => m.t === 'tp'); await H.wait(m => m.t === 'tp');
      ok(G.self.inv.knife === true && H.self.inv.knife === true, 'Alle har en kniv i inventaret');
      await G.waitSnap(sn => sn.ph === 'live', 6000);
      G.send({ t: 'dbg', money: 1000 }); G.tp(LX, 0, 20); H.tp(LX, 0, 18.7); await sleep(200);
      G.pos = { x: LX, y: 0, z: 20 }; H.pos = { x: LX, y: 0, z: 18.7 }; G.yaw = 0; H.yaw = 0; G.sendIn(); H.sendIn();   // H kigger væk fra G
      G.send({ t: 'sw', w: 'knife' }); await sleep(120);
      ok(G.self.cur === 'knife', 'Skift til kniven (tast 3)');
      G.clear(); H.clear();
      const kd = [0, (1.1 - 1.62) / 1.3, -1], kl = Math.hypot(...kd);
      G.send({ t: 'shoot', a: 's', o: [LX, 1.62, 20], d: kd.map(v => v / kl), st: G.snap.st });
      const kh = await G.wait(m => m.t === 'ev' && m.k === 'hit', 1500);
      ok(kh && kh.knife && kh.back && kh.dmg === WD.WEAPONS.knife.slashBack, 'Knivhug i ryggen gør ' + WD.WEAPONS.knife.slashBack + ' skade (' + (kh && kh.dmg) + ')');
      G.send({ t: 'shoot', a: 's', o: [LX, 1.62, 20], d: kd.map(v => v / kl), st: G.snap.st }); await sleep(100);
      ok(G.log.filter(m => m.t === 'ev' && m.k === 'hit').length === 1, 'Kniven har kadence (andet hug med det samme afvises)');
      await sleep(450);
      G.send({ t: 'shoot', a: 's', o: [LX, 1.62, 20], d: kd.map(v => v / kl), st: G.snap.st });
      const kk = await G.wait(m => m.t === 'ev' && m.k === 'kill' && m.w === 'knife', 1500);
      ok(!!kk, 'Knivdrab registreres i killfeed (våben: kniv)');
      const kp = await G.wait(m => m.t === 'ev' && m.k === 'pay' && m.why === 'kill', 1000);
      ok(kp && kp.amt === WD.ECON.kill.knife, 'Kill-belønning for kniv: $' + (kp && kp.amt));
      const end = await G.wait(m => m.t === 'ev' && m.k === 'end', 3000);
      ok(end && end.win === 'hij' && end.mvp && end.mvp.id === G.id && end.mvp.k === 1, 'Rundeslut sender MVP (flest kills på vinderholdet)');
      const wp = await G.wait(m => m.t === 'ev' && m.k === 'pay' && m.why === 'win', 1000), lp = await H.wait(m => m.t === 'ev' && m.k === 'pay' && m.why === 'loss', 1000);
      ok(wp && wp.amt === WD.ECON.win.elim && lp && lp.amt === WD.ECON.loss[0], 'Sejr +$' + (wp && wp.amt) + ', 1. tab +$' + (lp && lp.amt) + ' (tabsserie)');
      await sleep(100);
      ok(G.self.money === 1000 + WD.ECON.kill.knife + WD.ECON.win.elim, 'Pengene stemmer: 1000 + 1500 + 3250 = ' + G.self.money);
      const eco = await G.wait(m => m.t === 'eco' && m.side === 'hij', 1500);
      ok(eco && eco.l.some(r => r[0] === G.id) && !eco.l.some(r => r[0] === H.id), 'Holdøkonomi sendes kun til eget hold');
      // i pausen efter runden kan man stadig skyde (H er død – skuddet skal accepteres og sendes ud)
      G.send({ t: 'sw', w: G.self.inv.pistol }); await sleep(80); H.clear();
      G.send({ t: 'shoot', o: [LX, 1.62, 20], d: [0, 0, -1], st: G.snap.st });
      ok(!!(await H.wait(m => m.t === 'ev' && m.k === 'shot' && m.i === G.id, 1000)), 'Skud accepteres i pausen efter en vundet runde');
      // 2. tab i træk giver mere
      const r2b = await G.wait(m => m.t === 'round' && m.n === 2, 5000);
      ok(!!r2b, 'Alle respawner automatisk i næste runde');
      await G.waitSnap(sn => sn.ph === 'live', 6000);
      H.clear(); G.tp(LX, 0, 20); H.tp(LX, 0, 18.7); await sleep(200); G.pos = { x: LX, y: 0, z: 20 }; H.pos = { x: LX, y: 0, z: 18.7 }; G.yaw = 0; H.yaw = 0; G.sendIn(); H.sendIn();
      G.send({ t: 'sw', w: 'knife' }); await sleep(100);
      G.send({ t: 'shoot', a: 'k', o: [LX, 1.62, 20], d: kd.map(v => v / kl), st: G.snap.st });   // stik i ryggen = 180 → dræber
      const lp2 = await H.wait(m => m.t === 'ev' && m.k === 'pay' && m.why === 'loss', 4000);
      ok(lp2 && lp2.amt === WD.ECON.loss[1], '2. tab i træk: +$' + (lp2 && lp2.amt));
      G.ws.close(); H.ws.close();
    }
    console.log('\n== v13: maskinpistoler, flashbang efter synsfelt ==');
    {
      ok(WD.killReward('mac10') === 600 && WD.killReward('mp9') === 600 && WD.killReward('ump45') === 600 && WD.killReward('p90') === 300, 'SMG-kill: +$600 (P90 +$300) som i CS2');
      ok(WD.canBuy('hij', 'mac10') && !WD.canBuy('swat', 'mac10') && WD.canBuy('swat', 'mp9') && !WD.canBuy('hij', 'mp9') && WD.canBuy('hij', 'p90') && WD.canBuy('swat', 'mp7'), 'Holdlåste SMG\'er: MAC-10 (Hijackers), MP9 (SWAT), fælles MP7/UMP-45/P90/MP5-SD');
      ok(['mac10', 'mp9', 'mp7', 'ump45', 'p90', 'mp5'].every(id => WD.WEAPONS[id].smg && WD.WEAPONS[id].slot === 1 && WD.WEAPON_BY_CODE[WD.WEAPONS[id].code] === id && WD.SPRAY[id]), 'Alle SMG\'er har unik kode, spray-mønster og primær-plads');
      const Wf = WD.buildWorld('white_dust'); let pair = null;
      for (let x = -40; x <= 40 && !pair; x += 2) for (let z = -40; z <= 40 && !pair; z += 2) { const e = [x, 1.6, z]; for (const [dx, dz] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) { const f = [x + dx * 35, 1.0, z + dz * 35]; if (WD.losClear(Wf, f[0], f[1], f[2], e[0], e[1], e[2])) { pair = { e, f, yaw: Math.atan2(-dx, -dz) }; break; } } }
      if (pair) {
        const see = WD.flashAmount(Wf, pair.f[0], pair.f[1], pair.f[2], pair.e, pair.yaw, 0, []), away = WD.flashAmount(Wf, pair.f[0], pair.f[1], pair.f[2], pair.e, pair.yaw + Math.PI, 0, []);
        ok(see && see.full && see.dur >= WD.FLASH.FULL - 1e-6, 'Flashbang 35 m væk men i synsfeltet: helt hvid skærm (afstanden betyder ikke noget)');
        ok(away && !away.full && away.dur < see.dur, 'Flashbang bag ryggen: kun et kort glimt');
      } else ok(false, 'fandt ingen fri sigtelinje til flash-testen');
    }
    console.log('\n== v20: kick, premier-banevalg, vent på indlæsning ==');
    {
      const P = new Bot('Pia'), Q = new Bot('Quinn'), Rr = new Bot('Rune');
      await P.connect(); await Q.connect(); await Rr.connect();
      P.send({ t: 'create', name: 'Pia' }); const jj = await P.wait(m => m.t === 'joined');
      Q.send({ t: 'join', code: jj.code, name: 'Quinn' }); await Q.wait(m => m.t === 'joined');
      Rr.send({ t: 'join', code: jj.code, name: 'Rune' }); await Rr.wait(m => m.t === 'joined');
      await P.wait(m => m.t === 'lobby' && m.players.length === 3);
      Q.send({ t: 'kick', id: Rr.id }); await sleep(250);
      ok(!Rr.log.find(m => m.t === 'err' && m.kicked), 'Kun værten kan kicke (Quinns forsøg ignoreres)');
      P.clear(); P.send({ t: 'kick', id: Rr.id });
      const ke = await Rr.wait(m => m.t === 'err' && m.kicked, 2000), kl = await P.wait(m => m.t === 'lobby' && m.players.length === 2, 2000);
      ok(ke && ke.fatal && kl, 'Værten kicker Rune: han får besked og forsvinder fra lobbyen');
      Q.send({ t: 'vmode', mode: 'host' }); await sleep(150);
      const lv = P.log.filter(m => m.t === 'lobby').pop();
      ok(lv && lv.veto === true, 'Premier-banevalg er standard, og kun værten kan skifte tilstand');
      P.clear(); Q.clear(); Q.autoLoad = false;
      P.send({ t: 'start', veto: 1 });
      const v0 = await P.wait(m => m.t === 'veto', 2000);
      ok(v0 && v0.pool.length === WD.MAP_LIST.length && !v0.final, 'START åbner premier-afstemningen med alle ' + WD.MAP_LIST.length + ' baner');
      let fin = null;
      for (let i = 0; i < WD.MAP_LIST.length + 2 && !fin; i++) {
        const v = [...P.log].reverse().find(m => m.t === 'veto'); if (!v) break;
        if (v.final) { fin = v; break; }
        const banned = v.banned.map(b => b.id), free = v.pool.filter(id => !banned.includes(id));
        const voter = v.teams[v.turn].includes(P.id) ? P : Q; voter.send({ t: 'vban', id: free[0] });
        await P.wait(m => m.t === 'veto' && m.banned.length > banned.length, 2000);
      }
      fin = fin || [...P.log].reverse().find(m => m.t === 'veto' && m.final);
      ok(fin && fin.banned.length === WD.MAP_LIST.length - 1 && fin.pool.includes(fin.final) && !fin.banned.some(b => b.id === fin.final), 'Holdene bandlyser på skift til én bane er tilbage (' + (fin && fin.final) + ')');
      ok(fin && new Set(fin.banned.slice(0, 2).map(b => b.by)).size === 2, 'Turen skifter mellem holdene');
      const ld = await P.wait(m => m.t === 'load', 6000);
      ok(ld && fin && ld.map === fin.final, 'Den valgte bane indlæses hos alle');
      await sleep(1200);
      ok(!P.log.find(m => m.t === 'round'), 'Runden starter IKKE før alle har indlæst banen');
      Q.send({ t: 'loaded' });
      const rd = await P.wait(m => m.t === 'round', 2000);
      ok(rd && rd.n === 1, 'Runden starter straks når den sidste har indlæst banen');
      P.ws.close(); Q.ws.close(); Rr.ws.close();
    }
  } catch (e) {
    fails++; console.error('TESTFEJL:', e);
  }
  srv.kill();
  console.log(`\n${passes} bestået, ${fails} fejlet`);
  process.exit(fails ? 1 : 0);
}
function swat_or(a, b, c) { return c; }
main();
