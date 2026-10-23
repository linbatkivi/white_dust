// ==========================================================================
// ADMIN-KONSOL (v26.12) · klient. Åbn/luk med § (Backquote). Kun partyets vært (admin) kan køre kommandoer – serveren tjekker det igen.
//   • glas-panel øverst på skærmen (mørkt, sløret, neon-kant, monospace), auto-fokus, historik (↑/↓), Tab = auto-udfyld/forslag
//   • parseren validerer navn og argumenter (typer: player · int · num · team · bool · str · rest) før noget sendes over WebSocket
//   • mens konsollen er åben spærres alle spil-input (taster/mus) og pointer lock slippes
// createConsole({ Net, Game, onEnv }) -> { toggle, isOpen, handle(msg) }
// ==========================================================================
const SPEC = `
round.restart | Genstart den nuværende runde
round.pause | Frys rundetimeren og alle spilleres bevægelser
round.resume | Genoptag en pauset runde
round.skipbuy | Spring købsfasen over
round.extend <sekunder:num> | Tilføj tid til rundetimeren (negativ = træk fra)
round.win <team:team> | Giv runden til hijackers eller defenders
round.forceend | Afslut runden uden vinder
score.set <team:team> <point:int> | Sæt pointstillingen for et hold
match.overtime | Tving kampen ud i overtid (6-6)
player.god <id:player> | God mode til/fra
player.noclip <id:player> | Flyv og gå gennem vægge
player.fly <id:player> | Flyvetilstand (kollision)
player.kill <id:player> | Eliminér en spiller
player.respawn <id:player> | Genopliv på holdets spawn
player.heal <id:player> <mængde:num> | Giv HP
player.damage <id:player> <mængde:num> | Giv skade
player.teleport <id1:player> <id2:player> | Teleportér spiller 1 til spiller 2
player.teleportpos <id:player> <x:num> <y:num> <z:num> | Teleportér til koordinater
player.freeze <id:player> | Lås bevægelse og kamera til/fra
player.slap <id:player> [kraft:num] | Kast en spiller op i luften
player.giveammo <id:player> | Fyld ammunition helt op
player.invisible <id:player> | Usynlig model for andre til/fra
player.setskin <id:player> <skin:str> | Skift skin (fx hij5:rust, swat:black)
server.kick <id:player> [årsag...:rest] | Smid en spiller ud
server.ban <id:player> [minutter:int] | Ban en spiller i et tidsrum
server.unban <navn_eller_ip:str> | Fjern et ban
server.mute <id:player> | Deaktiver chat for en spiller
server.unmute <id:player> | Genaktiver chat
server.say <besked...:rest> | Server-besked midt på skærmen
server.changemap <bane:str> | Skift bane med det samme (skriv server.maps for listen)
server.maps | Vis alle baner
server.maxplayers <antal:int> | Ændr maks. antal spillere
server.passthrough <til:bool> | Tillad/blokér nye spillere
bot.add <team:team> [sværhed:str] | Tilføj en bot (easy | normal | hard | 0.3–1)
bot.remove <id:int> | Fjern en bot
bot.removeall | Fjern alle bots
bot.killall | Eliminér alle bots
bot.difficulty <sværhed:str> | Sæt sværhed på ALLE bots (easy | normal | hard | 0.3–1)
bot.freeze | Frys/optø bot-AI
bot.fill | Fyld op med bots til max
give.weapon <id:player> <våben:str> | Giv et våben (ak47, m4a1, awp …)
give.item <id:player> <udstyr:str> | c4, kit, thermal, flash, smoke, he, molotov, incgren, sensor
money.set <id:player> <beløb:int> | Sæt en spillers penge
money.addall <beløb:int> | Giv alle penge
economy.freebuy <til:bool> | Gratis udstyr i købsfasen
env.time <time:num> | Tid på dagen 0–24
env.fog <tæthed:num> | Tågetæthed (1 = normal, 0 = ingen)
env.blackout | Sluk alt lys
physics.gravity <værdi:num> | Tyngdekraft (standard 24)
physics.bullettracers <til:bool> | Vis projektilbaner
debug.wireframe <til:bool> | Wireframe-verden
debug.hitboxes <til:bool> | Vis hitboxes
debug.showfps <til:bool> | FPS- og netværksmåler
debug.clearentities | Fjern løse genstande, våben og granater
help [kommando:str] | Vis kommandoer
players | Vis spiller-id'er
clear | Ryd konsollen`;

const CMDS = SPEC.trim().split('\n').map(l => {
  const [sig, desc] = l.split(' | '), parts = sig.trim().split(/\s+/), name = parts.shift();
  const args = parts.map(a => { const opt = a[0] === '[', m = a.slice(1, -1).split(':'); return { n: m[0].replace('...', ''), t: m[1], opt, rest: m[0].endsWith('...') }; });
  return { name, args, desc };
});
const BY = Object.fromEntries(CMDS.map(c => [c.name, c]));
const LOCAL = new Set(['help', 'players', 'clear', 'server.maps']);

export function createConsole(o) {
  const { Net, Game } = o;
  let el = null, input, logEl, sugg, open = false, hist = [], hi = -1, draft = '';
  try { hist = JSON.parse(localStorage.getItem('wd_con_hist') || '[]').slice(-60); } catch (e) {}
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const log = (txt, cls) => { if (!logEl) return; const d = document.createElement('div'); d.className = 'con-l ' + (cls || ''); d.innerHTML = txt; logEl.appendChild(d); logEl.scrollTop = logEl.scrollHeight; while (logEl.children.length > 200) logEl.firstChild.remove(); };

  function build() {
    el = document.createElement('div'); el.id = 'adminCon'; el.className = 'adm-con hidden';
    el.innerHTML = `<div class="con-head"><b>ADMIN-KONSOL</b><span>§ luk · ↑↓ historik · Tab udfyld · help</span></div><div class="con-log"></div><div class="con-sug hidden"></div><div class="con-in"><i>&gt;</i><input type="text" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="skriv en kommando, fx player.heal me 50"></div>`;
    document.body.appendChild(el); input = el.querySelector('input'); logEl = el.querySelector('.con-log'); sugg = el.querySelector('.con-sug');
    log('Skriv <b>help</b> for alle kommandoer. Kun partyets vært (admin) kan køre dem.', 'sys');
    input.addEventListener('input', suggest);
    input.addEventListener('keydown', onKey);
  }
  function setOpen(v) {
    if (!el) build(); open = v; el.classList.toggle('hidden', !v); document.body.classList.toggle('con-open', v);
    if (v) { if (document.pointerLockElement) document.exitPointerLock(); window.dispatchEvent(new Event('blur')); setTimeout(() => input.focus(), 30); suggest(); }
    else { input.blur(); sugg.classList.add('hidden'); if (o.onClose) o.onClose(); }
  }

  /* ---------------- forslag / tab ---------------- */
  function words() { const v = input.value, sp = v.split(/\s+/); return { v, sp, last: sp[sp.length - 1], idx: sp.length - 1 }; }
  function candidates() {
    const { sp, last, idx } = words();
    if (idx === 0) return CMDS.filter(c => c.name.startsWith(last.toLowerCase())).map(c => ({ t: c.name, d: c.desc }));
    const c = BY[sp[0].toLowerCase()]; if (!c) return [];
    const a = c.args[Math.min(idx - 1, c.args.length - 1)]; if (!a) return [];
    if (a.t === 'player') return [{ t: 'me', d: 'dig selv' }, ...[...Game.players.entries()].map(([id, p]) => ({ t: String(id), d: p.name }))].filter(x => x.t.startsWith(last) || x.d.toLowerCase().startsWith(last.toLowerCase()));
    if (a.t === 'team') return ['hijackers', 'defenders'].filter(x => x.startsWith(last.toLowerCase())).map(t => ({ t, d: 'hold' }));
    if (a.t === 'bool') return ['true', 'false'].filter(x => x.startsWith(last.toLowerCase())).map(t => ({ t, d: '' }));
    return [];
  }
  let sel = 0, cand = [];
  function suggest() {
    cand = input.value.trim() ? candidates().slice(0, 6) : []; sel = 0;
    if (!cand.length) { sugg.classList.add('hidden'); return; }
    sugg.classList.remove('hidden'); sugg.innerHTML = cand.map((c, i) => `<div class="con-s${i === sel ? ' on' : ''}"><b>${esc(c.t)}</b><em>${esc(c.d)}</em></div>`).join('');
  }
  function applyCand(c) { const w = words(); w.sp[w.idx] = c.t; input.value = w.sp.join(' ') + (BY[w.sp[0]] && w.idx < BY[w.sp[0]].args.length ? ' ' : ''); suggest(); }

  /* ---------------- parser ---------------- */
  function tokens(s) { const out = []; const re = /"([^"]*)"|(\S+)/g; let m; while ((m = re.exec(s))) out.push(m[1] !== undefined ? m[1] : m[2]); return out; }
  function playerId(v) {
    if (String(v).toLowerCase() === 'me') return 'me';
    if (/^\d+$/.test(v)) return Game.players.has(+v) ? +v : null;
    const hits = [...Game.players.entries()].filter(([, p]) => p.name.toLowerCase().startsWith(String(v).toLowerCase())); return hits.length === 1 ? hits[0][0] : null;
  }
  function parse(line) {
    const tk = tokens(line.trim()); if (!tk.length) return null;
    const name = tk.shift().toLowerCase(), c = BY[name];
    if (!c) { const near = CMDS.filter(x => x.name.includes(name) || name.includes(x.name.split('.')[1] || '#')).slice(0, 4).map(x => x.name); return { err: 'ukendt kommando "' + name + '"' + (near.length ? ' – mente du: ' + near.join(', ') : ' – skriv help') }; }
    const out = [], warn = [];
    for (let i = 0; i < c.args.length; i++) {
      const a = c.args[i];
      if (a.rest) { const r = tk.slice(i).join(' '); if (!r && !a.opt) return { err: 'mangler <' + a.n + '>' }; if (r) out.push(r); break; }
      const v = tk[i];
      if (v === undefined) { if (a.opt) break; return { err: 'mangler <' + a.n + '> · brug: ' + usage(c) }; }
      if (a.t === 'player') { const id = playerId(v); if (id === null) return { err: 'ukendt spiller "' + v + '" (brug id, "me" eller navn – skriv players)' }; out.push(id); }
      else if (a.t === 'int') { if (!/^-?\d+$/.test(v)) return { err: '<' + a.n + '> skal være et heltal (fik "' + v + '")' }; out.push(+v); }
      else if (a.t === 'num') { if (!Number.isFinite(+v)) return { err: '<' + a.n + '> skal være et tal (fik "' + v + '")' }; out.push(+v); }
      else if (a.t === 'team') { if (!/^(hij|hijackers?|swat|defenders?)$/i.test(v)) return { err: '<' + a.n + '> skal være hijackers eller defenders' }; out.push(v.toLowerCase()); }
      else if (a.t === 'bool') { if (!/^(true|false|on|off|1|0|yes|no|ja|nej)$/i.test(v)) return { err: '<' + a.n + '> skal være true/false' }; out.push(v.toLowerCase()); }
      else out.push(v);
    }
    if (tk.length > c.args.length && !c.args.some(a => a.rest)) warn.push('ekstra argumenter ignoreret: ' + tk.slice(c.args.length).join(' '));
    return { c, out, warn };
  }
  const usage = c => c.name + ' ' + c.args.map(a => (a.opt ? '[' : '<') + a.n + (a.opt ? ']' : '>')).join(' ');

  function run(line) {
    log('<span class="con-p">&gt;</span> ' + esc(line), 'cmd');
    const p = parse(line); if (!p) return; if (p.err) return log(esc(p.err), 'err');
    for (const w of p.warn) log(esc(w), 'warn');
    const n = p.c.name;
    if (n === 'clear') { logEl.innerHTML = ''; return; }
    if (n === 'players') { for (const [id, pl] of Game.players) log(`#${id} · ${esc(pl.name)} · ${pl.side || '–'}${id === Game.meId ? ' (dig)' : ''}${id === Game.host ? ' · vært' : ''}`, 'ok'); return; }
    if (n === 'server.maps') { const ms = Game.maps || []; log(ms.length ? ms.map(m => '<b>' + esc(m.id || m) + '</b>' + (m.name ? ' <em>' + esc(m.name) + '</em>' : '')).join(' · ') : 'ingen baneliste endnu', 'ok'); return; }
    if (n === 'help') {
      const a = (p.out[0] || '').toLowerCase(), q = BY[a];
      if (q) return log(esc(usage(q)) + ' – ' + esc(q.desc), 'ok');
      const groups = {}; for (const c of CMDS) (groups[c.name.split('.')[0]] = groups[c.name.split('.')[0]] || []).push(c);
      if (a && groups[a]) { log('<b>' + a + '</b>', 'sys'); for (const c of groups[a]) log('&nbsp;&nbsp;' + esc(usage(c)) + ' <em>' + esc(c.desc) + '</em>', 'ok'); return; }
      log('<b>Kommandoer</b> – skriv <b>help &lt;gruppe&gt;</b> for detaljer, eller <b>help &lt;kommando&gt;</b>. Spiller = id, navn eller <b>me</b>.', 'sys');
      for (const k in groups) log('<b>' + k + '</b>&nbsp; ' + groups[k].map(c => c.name.slice(k.length + 1) || c.name).join(' · '), 'ok'); return;
    }
    if (!Net.connected) return log('ikke forbundet til serveren', 'err');
    Net.send({ t: 'adm', c: n, a: p.out });
  }

  function onKey(e) {
    e.stopPropagation();
    if (e.code === 'Backquote' || e.key === '§') { e.preventDefault(); setOpen(false); return; }
    if (e.key === 'Enter') { const v = input.value; input.value = ''; if (v.trim()) { hist.push(v); if (hist.length > 60) hist.shift(); try { localStorage.setItem('wd_con_hist', JSON.stringify(hist)); } catch (er) {} run(v); } hi = -1; suggest(); e.preventDefault(); return; }
    if (e.key === 'Tab') { e.preventDefault(); if (cand.length) { if (cand.length === 1 || !input.dataset.tabbed) applyCand(cand[sel]); else { sel = (sel + 1) % cand.length; applyCand(cand[sel]); } } return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (!sugg.classList.contains('hidden') && cand.length > 1 && e.shiftKey) { sel = (sel + cand.length - 1) % cand.length; return suggest(); } if (hi === -1) { draft = input.value; hi = hist.length; } if (hi > 0) { hi--; input.value = hist[hi]; } return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); if (hi !== -1) { hi++; input.value = hi >= hist.length ? (hi = -1, draft) : hist[hi]; } return; }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
  }
  // spil-input spærres mens konsollen er åben (capture-fase, før spillets egne lyttere)
  const block = e => { if (!open) return; if (e.target === input && e.type.startsWith('key')) return; e.stopImmediatePropagation(); if (e.type !== 'wheel') e.preventDefault(); };   // tastetryk i feltet går til feltets egen lytter, som selv stopper videre udbredelse
  for (const t of ['keydown', 'keyup', 'keypress']) window.addEventListener(t, e => {
    if (!open && (e.code === 'Backquote' || e.key === '§') && t === 'keydown' && !e.repeat && !(e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) && Game.state === 'game') { e.preventDefault(); e.stopImmediatePropagation(); setOpen(true); return; }
    block(e);
  }, true);
  for (const t of ['mousedown', 'mouseup', 'click', 'wheel', 'contextmenu']) window.addEventListener(t, e => { if (open && !(el && el.contains(e.target))) block(e); }, true);

  function handle(m) {                                                   // svar fra serveren
    if (m.t === 'admr') { if (!el) build(); log(esc(m.msg || ''), m.ok ? 'ok' : 'err'); }
  }
  return { toggle: () => setOpen(!open), isOpen: () => open, handle, log, CMDS };
}
