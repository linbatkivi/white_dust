// ==========================================================================
// LYD (v9): alt syntetiseres med WebAudio (ingen lydfiler). 3D-placeret (HRTF-panner) med lytter = kameraet.
//   skud (pr. våben), fodtrin (fjender kan høres!), døre (Squeaky knirker tydeligt), bombe-bip, eksplosioner,
//   genladning, våbenskift, træf-markør, tomt magasin, landing, split-træk, kast, granat-prel, flashbang + tinnitus,
//   molotov (glas + ild-løkke), brandgranat.
//   Signalvej: kilder → sfx (dæmpes under flashbang-blænding) → master (Master Volume fra indstillinger) → kompressor → højttalere.
// v12 (lyd-miks): fire uafhængige busser – Master · SFX (skud, eksplosioner, fodtrin) · Musik/Ambience · Speaker & stemme-UI.
//   Pistoler har fået skarpe, metalliske skud (krudt-'crack' + slædens metalklang + mekanisk klik) i stedet for den tidligere 'tromme'-tone.
//   Flashbang er dæmpet (lavere knald, blødere og dybere tinnitus), fodtrin er markant højere og bærer længere (taktisk lyd),
//   træf-lyde: sprødt metallisk 'dink' ved headshot, dæmpet 'thud' ved kropsskud. Speakeren bruger browserens talesyntese (engelsk, som CS).
// ==========================================================================
export function createAudio() {
  let ctx = null, master = null, sfx = null, sfxVol = null, musicBus = null, voiceBus = null, comp = null, noiseBuf = null, verbBuf = null, enabled = true;
  const VOL = { master: 0.8, sfx: 1, music: 0.6, voice: 0.9 };
  let vol = VOL.master;
  const MASTER = 0.55;
  const listener = { x: 0, y: 0, z: 0 };
  function init() {
    if (ctx) { if (ctx.state !== 'running') ctx.resume().catch(() => {}); retryMusic(); return; }
    build();
    if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
  }
  function build() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) { enabled = false; return; }
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { enabled = false; return; }
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = MASTER * vol; master.connect(comp); comp.connect(ctx.destination);
    sfxVol = ctx.createGain(); sfxVol.gain.value = VOL.sfx; sfxVol.connect(master);
    sfx = ctx.createGain(); sfx.gain.value = 1; sfx.connect(sfxVol);                  // 'sfx' dæmpes af flashbang (tinnitus); sfxVol = brugerens SFX-slider
    musicBus = ctx.createGain(); musicBus.gain.value = VOL.music * 0.55; musicBus.connect(master);
    voiceBus = ctx.createGain(); voiceBus.gain.value = VOL.voice; voiceBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // kort rum-efterklang (impulsrespons = eksponentielt henfaldende støj) til skudenes 'hale'
    verbBuf = ctx.createBuffer(1, ctx.sampleRate * 0.55 | 0, ctx.sampleRate);    // v12.1: mono + 0,55 s (konvolution er dyr på Mac)
    for (let ch = 0; ch < 1; ch++) { const v = verbBuf.getChannelData(ch); for (let i = 0; i < v.length; i++) v[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / v.length, 3.2) * (i < 80 ? i / 80 : 1); }
    verb = ctx.createConvolver(); verb.buffer = verbBuf; const vg = ctx.createGain(); vg.gain.value = 0.32; verb.connect(vg); vg.connect(sfx);
    if (pendingAmb) { const a = pendingAmb; pendingAmb = null; ambience(a); }
    decodeAll();
  }
  /* ---------------- v20: LYDFILER (public/assets/sounds, tools/sounds/prep.py) ----------------
     Hentes straks ved sideindlæsning (fetch med genforsøg), afkodes i en suspenderet AudioContext før første klik,
     så de altid er klar. Mangler en fil, bruges den syntetiske lyd som reserve. Musik streames via <audio>-elementer. */
  const SND = ['gun_shot', 'reload_magout', 'reload_magin', 'reload_rack', 'knife_swing', 'knife_hit1', 'knife_hit2', 'amb_birds', 'amb_traffic'];
  const SND_V = 'v20';
  const raw = {}, buf = {};
  let loadedRes = null; const loaded = new Promise(r => { loadedRes = r; });
  async function fetchRetry(url, tries) {
    for (let i = 0; i < tries; i++) {
      try { const r = await fetch(url, { cache: 'force-cache' }); if (r.ok) return await r.arrayBuffer(); } catch (e) {}
      await new Promise(r => setTimeout(r, 400 * (i + 1) * (i + 1)));
    }
    return null;
  }
  const fetching = typeof fetch === 'function' ? Promise.all(SND.map(async n => { raw[n] = await fetchRetry('/assets/sounds/' + n + '.mp3?' + SND_V, 5); })) : Promise.resolve();
  let decoding = null;
  function decodeAll() {
    if (decoding || !ctx) return decoding;
    decoding = fetching.then(() => Promise.all(SND.map(async n => {
      for (let i = 0; i < 2 && !buf[n]; i++) {
        if (!raw[n]) raw[n] = await fetchRetry('/assets/sounds/' + n + '.mp3?' + SND_V, 3);
        if (!raw[n]) break;
        try { buf[n] = await ctx.decodeAudioData(raw[n].slice(0)); } catch (e) { raw[n] = null; }
      }
    }))).then(() => { const miss = SND.filter(n => !buf[n]); if (miss.length) console.warn('[lyd] mangler', miss); loadedRes(miss); if (amb && !amb.files) { const id = amb.id; amb = null; ambience(id); } return miss; });
    return decoding;
  }
  // afspil en lydfil; null hvis den (endnu) ikke er der => kalderen bruger den syntetiske lyd
  function sample(name, dst, o) {
    const b = buf[name]; if (!b || !ctx) return null;
    o = o || {}; const src = ctx.createBufferSource(); src.buffer = b;
    src.playbackRate.value = (o.rate || 1) * (o.jit ? 1 + (Math.random() - 0.5) * o.jit : 1);
    const g = ctx.createGain(); g.gain.value = o.vol === undefined ? 1 : o.vol; src.connect(g); g.connect(dst);
    src.start(o.t || ctx.currentTime); return src;
  }
  /* musik (menu / sejr): <audio> → musik-bussen, så lydstyrke-skyderne virker */
  const MUSIC = {}; let curMusic = null, wantMusic = null;
  function musicEl(name) {
    if (MUSIC[name]) return MUSIC[name];
    const el = new window.Audio('/assets/sounds/' + name + '.mp3?' + SND_V); el.preload = 'auto'; el.crossOrigin = 'anonymous';
    const m = { el, node: null, g: null }; MUSIC[name] = m; return m;
  }
  if (typeof window !== 'undefined' && window.Audio) { musicEl('music_menu'); musicEl('music_win'); }    // forhåndsindlæsning
  function playMusic(name, o) {
    o = o || {}; wantMusic = { name, o };
    if (!ctx) build();
    const m = musicEl(name);
    if (!m.node) { try { m.node = ctx.createMediaElementSource(m.el); m.g = ctx.createGain(); m.node.connect(m.g); m.g.connect(musicBus); } catch (e) {} }
    if (curMusic && curMusic !== m) stopMusic(0.6);
    curMusic = m; m.el.loop = !!o.loop;
    if (o.from !== undefined) try { m.el.currentTime = o.from; } catch (e) {}
    const t = ctx.currentTime, gv = o.vol || 1;
    if (m.g) { m.g.gain.cancelScheduledValues(t); m.g.gain.setValueAtTime(o.fade ? 0.0001 : gv, t); if (o.fade) m.g.gain.exponentialRampToValueAtTime(gv, t + o.fade); }
    const p = m.el.play(); if (p && p.catch) p.catch(() => { /* autoplay blokeret: prøves igen ved næste klik/tast (init) */ });
  }
  function retryMusic() { if (wantMusic && curMusic && curMusic.el.paused && !curMusic.stopped) playMusic(wantMusic.name, Object.assign({}, wantMusic.o, { from: undefined })); }
  function stopMusic(fade) {
    const m = curMusic; wantMusic = null; if (!m) return; curMusic = null; m.stopped = true;
    const done = () => { m.el.pause(); m.stopped = false; };
    if (m.g && fade && ctx) { const t = ctx.currentTime; m.g.gain.cancelScheduledValues(t); m.g.gain.setValueAtTime(Math.max(0.0001, m.g.gain.value), t); m.g.gain.exponentialRampToValueAtTime(0.0001, t + fade); setTimeout(done, fade * 1000 + 50); }
    else done();
  }
  const musicTime = () => curMusic ? curMusic.el.currentTime : 0;
  const musicPlaying = name => !!(curMusic && MUSIC[name] === curMusic && !curMusic.el.paused);
  let verb = null, pendingAmb = null;
  const ok = () => enabled && ctx && ctx.state === 'running';
  function setListener(pos, fwd, up) {
    if (!ctx) return; listener.x = pos.x; listener.y = pos.y; listener.z = pos.z;
    const L = ctx.listener, t = ctx.currentTime;
    if (L.positionX) { L.positionX.setValueAtTime(pos.x, t); L.positionY.setValueAtTime(pos.y, t); L.positionZ.setValueAtTime(pos.z, t); L.forwardX.setValueAtTime(fwd.x, t); L.forwardY.setValueAtTime(fwd.y, t); L.forwardZ.setValueAtTime(fwd.z, t); L.upX.setValueAtTime(up.x, t); L.upY.setValueAtTime(up.y, t); L.upZ.setValueAtTime(up.z, t); }
    else { L.setPosition(pos.x, pos.y, pos.z); L.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z); }
  }
  // udgang: 3D-panner (pos) eller direkte (lokal lyd)
  // v12.1: HRTF (dyr konvolution pr. lyd) kun til skud og fodtrin – alt andet bruger billig 'equalpower'-panorering
  function out(pos, ref, maxD, hq) {
    const g = ctx.createGain();
    if (!pos) { g.connect(sfx); return g; }
    const p = ctx.createPanner(); p.panningModel = hq ? 'HRTF' : 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = ref || 3; p.maxDistance = maxD || 120; p.rolloffFactor = 1.1;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
    g.connect(p); p.connect(sfx); return g;
  }
  const far = (pos, d) => pos && Math.hypot(pos.x - listener.x, pos.y - listener.y, pos.z - listener.z) > d;
  // v12.1: stemme-loft – højst ~10 rumlige lyde startet pr. 100 ms (fuld automatild + nedslag + fodtrin kan ellers kvæle lydtråden)
  let bT = 0, bN = 0;
  const busy = pos => { if (!pos || !ctx) return false; const t = ctx.currentTime; if (t - bT > 0.1) { bT = t; bN = 0; } return ++bN > 10; };
  function impact(pos, metal) {                          // kugle-nedslag: kort klik/smæld uden HRTF
    if (!ok() || far(pos, 30) || busy(pos)) return; const t = ctx.currentTime, d = out(pos, 2, 30);
    noise(d, t, 0.05, metal ? 3800 : 1600, metal ? 3 : 1.2, 'bandpass', metal ? 0.35 : 0.28, 0.04);
  }
  function noise(dst, t0, dur, f, q, type, vol, decay) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = ctx.createBiquadFilter(); fl.type = type || 'bandpass'; fl.frequency.value = f; fl.Q.value = q || 1;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + (decay || dur));
    s.connect(fl); fl.connect(g); g.connect(dst); s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.05); return fl;
  }
  function tone(dst, t0, dur, f0, f1, type, vol) {
    const os = ctx.createOscillator(); os.type = type || 'sine'; os.frequency.setValueAtTime(f0, t0); if (f1) os.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    os.connect(g); g.connect(dst); os.start(t0); os.stop(t0 + dur + 0.02); return os;
  }
  /* ---- skud: lav 'thump' + krudt-knald (filtreret støj) + hale; lyddæmper = kort pust ---- */
  const GUN = {
    usp: { f: 2600, thump: 120, vol: 0.35, tail: 0.12, sup: true }, glock: { f: 2200, thump: 150, vol: 0.7, tail: 0.25 }, mp5: { f: 2400, thump: 110, vol: 0.32, tail: 0.1, sup: true },
    ak47: { f: 1300, thump: 75, vol: 1.0, tail: 0.45 }, m4a1: { f: 1700, thump: 90, vol: 0.85, tail: 0.35 }, awp: { f: 900, thump: 55, vol: 1.25, tail: 0.9 },
    galil: { f: 1450, thump: 80, vol: 0.95, tail: 0.42 }, famas: { f: 1800, thump: 95, vol: 0.85, tail: 0.32 }, tec9: { f: 2100, thump: 140, vol: 0.7, tail: 0.22 },
    fiveseven: { f: 2400, thump: 135, vol: 0.65, tail: 0.22 }, deagle: { f: 1000, thump: 70, vol: 1.15, tail: 0.6 },
    mac10: { f: 2000, thump: 125, vol: 0.72, tail: 0.24 }, mp9: { f: 2150, thump: 120, vol: 0.66, tail: 0.22 }, mp7: { f: 2050, thump: 115, vol: 0.68, tail: 0.24 },
    ump45: { f: 1600, thump: 95, vol: 0.8, tail: 0.3 }, p90: { f: 2250, thump: 115, vol: 0.64, tail: 0.24 }
  };
  // v20: tonehøjde for lydfilen pr. våben (lavere = tungere kaliber)
  const SHOT_RATE = { ak47: 0.94, galil: 0.97, m4a1: 1.04, famas: 1.06, awp: 0.78, mac10: 1.12, mp9: 1.15, mp7: 1.12, ump45: 1.02, p90: 1.14,
    glock: 1.2, fiveseven: 1.24, tec9: 1.18, deagle: 0.86 };
  /* v12: pistoler – skarp, metallisk og med klart 'punch' (ingen sinus-'tromme'):
       1) krudt-crack: ultrakort bredbåndet transient (0,5–1,5 ms) + højpas-knald 18–35 ms
       2) krop/punch: båndpas omkring kaliberens grundtone med meget hurtigt henfald (ikke en tonal sweep)
       3) metal: 3 uharmoniske klang-partialer fra slæde/løb (ringer 40–110 ms)
       4) mekanik: slæden går frem (lille klik ~35 ms efter skuddet)
       5) rum: kort efterklang (konvolution) + fjern-ekko */
  const PISTOL = {
    glock: { body: 1500, q: 1.1, ring: [2350, 3870, 5630], ringV: 0.09, crack: 0.95, punch: 0.75, mech: 0.12, tail: 0.16, low: 210 },
    usp: { body: 1150, q: 1.4, ring: [2900, 4400], ringV: 0.05, crack: 0.25, punch: 0.42, mech: 0.16, tail: 0.07, low: 0, sup: true },
    fiveseven: { body: 1750, q: 1.2, ring: [2650, 4120, 6150], ringV: 0.1, crack: 1.0, punch: 0.7, mech: 0.11, tail: 0.15, low: 190 },
    tec9: { body: 1350, q: 1.0, ring: [2180, 3460, 5080], ringV: 0.08, crack: 0.9, punch: 0.8, mech: 0.14, tail: 0.17, low: 180 },
    deagle: { body: 820, q: 0.8, ring: [1650, 2790, 4310], ringV: 0.13, crack: 1.35, punch: 1.25, mech: 0.13, tail: 0.42, low: 120 }
  };
  function pistolShot(id, pos, local) {
    const P = PISTOL[id], t = ctx.currentTime + 0.002, d = out(local ? null : pos, 7, 170, true);
    d.gain.value = local ? 0.72 : 1.05;
    if (P.sup) {                                         // lyddæmpet USP: skarpt 'thwip' + slædens metalklik
      noise(d, t, 0.05, 3200, 1.2, 'bandpass', 0.55, 0.045); noise(d, t, 0.02, 7000, 0.7, 'highpass', 0.35, 0.018);
      noise(d, t, 0.09, P.body, P.q, 'bandpass', P.punch, 0.08);
      for (const f of P.ring) tone(d, t + 0.004, 0.06, f, f * 0.985, 'triangle', P.ringV);
      noise(d, t + 0.03, 0.02, 4200, 4, 'bandpass', P.mech * 1.6, 0.015);
      return;
    }
    if (sample('gun_shot', d, { t, rate: SHOT_RATE[id] || 1.15, jit: 0.04, vol: 0.55 + P.punch * 0.35 })) {   // v20: optaget skud (højere tonehøjde) + slædens metalklik
      P.ring.forEach((f, i) => tone(d, t + 0.001, 0.04 + i * 0.02, f, f * 0.992, i ? 'sine' : 'triangle', P.ringV * 0.6 * (1 - i * 0.22)));
      noise(d, t + 0.034, 0.02, 3600, 5, 'bandpass', P.mech, 0.016);
      if (verb) { const vs = ctx.createGain(); vs.gain.value = local ? 0.3 : 0.45; d.connect(vs); vs.connect(verb); }
      return;
    }
    // 1) crack
    const clk = ctx.createBufferSource(); clk.buffer = noiseBuf; const cg = ctx.createGain(); cg.gain.setValueAtTime(P.crack * 1.2, t); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.0016); clk.connect(cg); cg.connect(d); clk.start(t, Math.random()); clk.stop(t + 0.01);
    noise(d, t, 0.04, 5200, 0.55, 'highpass', P.crack, 0.032);
    // 2) punch: kort båndpas-burst (krop) + en lille lavfrekvent 'kick' (højst 25 ms – ingen tromme-hale)
    noise(d, t, 0.09, P.body, P.q, 'bandpass', P.punch, 0.07);
    if (P.low) tone(d, t, 0.028, P.low * 1.6, P.low, 'sine', P.punch * 0.45);
    // 3) metal-klang (uharmonisk)
    P.ring.forEach((f, i) => tone(d, t + 0.001, 0.05 + i * 0.025, f, f * 0.992, i ? 'sine' : 'triangle', P.ringV * (1 - i * 0.22)));
    // 4) slæden fremad
    noise(d, t + 0.034, 0.02, 3600, 5, 'bandpass', P.mech, 0.016); tone(d, t + 0.036, 0.018, 2600, 2400, 'square', P.mech * 0.18);
    // 5) rum + ekko
    if (verb) { const vs = ctx.createGain(); vs.gain.value = local ? 0.35 : 0.5; d.connect(vs); vs.connect(verb); }
    noise(d, t + 0.01, P.tail, 1700, 0.7, 'bandpass', P.punch * 0.22, P.tail);
    if (!local && pos) { const dist = Math.hypot(pos.x - listener.x, pos.z - listener.z); if (dist > 22) noise(d, t + 0.06, P.tail * 2.2, 520, 0.6, 'lowpass', 0.22, P.tail * 2.2); }
  }
  function shot(id, pos, local) {
    if (!ok()) return;
    if (PISTOL[id]) return pistolShot(id, pos, local);
    const P = GUN[id] || GUN.ak47, t = ctx.currentTime + 0.002, d = out(local ? null : pos, 6, 160, true);
    d.gain.value = local ? 0.7 : 1;
    if (P.sup) {                                         // v13: lyddæmpet MP5-SD – dæmpet 'thup' + bolt-klik, næsten ingen hale
      noise(d, t, 0.06, 2600, 1.1, 'bandpass', 0.5, 0.05); noise(d, t, 0.03, 6500, 0.7, 'highpass', 0.22, 0.02);
      tone(d, t, 0.05, 220, 120, 'sine', 0.35); noise(d, t + 0.028, 0.02, 4000, 4, 'bandpass', 0.18, 0.015);
      return;
    }
    if (verb) { const vs = ctx.createGain(); vs.gain.value = local ? 0.25 : 0.4; d.connect(vs); vs.connect(verb); }
    if (sample('gun_shot', d, { t, rate: SHOT_RATE[id] || 1, jit: 0.04, vol: 0.9 * P.vol })) {     // v20: optaget skud + lidt syntetisk tyngde
      tone(d, t, 0.12, P.thump * 2, P.thump, 'sine', P.vol * 0.35);
      if (!local && pos) { const dist = Math.hypot(pos.x - listener.x, pos.z - listener.z); if (dist > 25) noise(d, t + 0.05, P.tail * 1.5, 400, 0.5, 'lowpass', P.vol * 0.3, P.tail * 1.5); }
      return;
    }
    tone(d, t, 0.14, P.thump * 2, P.thump, 'sine', P.vol * 0.9);
    noise(d, t, 0.06, 4200, 0.6, 'highpass', P.vol * 0.8, 0.05);
    noise(d, t, P.tail, P.f, 0.7, 'bandpass', P.vol * 0.75, P.tail);
    if (!local && pos) { const dist = Math.hypot(pos.x - listener.x, pos.z - listener.z); if (dist > 25) noise(d, t + 0.05, P.tail * 1.5, 400, 0.5, 'lowpass', P.vol * 0.3, P.tail * 1.5); }   // ekko på afstand
  }
  // v12: fodtrin markant højere og med længere rækkevidde (taktisk lyd): hæl-thud + sål-skrab (+ metalklang på gitre/trapper)
  function step(pos, soft, metal) {
    if (!ok() || far(pos, 42) || busy(pos)) return; const t = ctx.currentTime, d = out(pos, 4.5, 42, !!pos), v = soft ? 0.32 : 1.0;
    noise(d, t, 0.06, metal ? 1700 : 260, metal ? 2.5 : 1.1, 'bandpass', 0.95 * v, 0.055);                 // hæl
    noise(d, t + 0.025, 0.07, metal ? 3600 : 1250, 1.6, 'bandpass', 0.42 * v, 0.06);                      // sål/grus
    tone(d, t, 0.045, metal ? 340 : 120, metal ? 260 : 75, 'sine', 0.45 * v);                             // tyngde
    if (metal) { tone(d, t, 0.09, 940, 880, 'triangle', 0.16 * v); tone(d, t, 0.07, 1530, 1490, 'sine', 0.08 * v); }
  }
  function door(kind, pos) {
    if (!ok() || far(pos, 45)) return; const t = ctx.currentTime, d = out(pos, 3, 45);
    if (kind === 'squeaky') {                         // tydeligt, langt knirk: savtand med vaklende tonehøjde gennem båndpas
      const os = ctx.createOscillator(); os.type = 'sawtooth'; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 6;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.05); g.gain.setValueAtTime(0.5, t + 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      os.frequency.setValueAtTime(420, t); for (let i = 0; i < 9; i++) os.frequency.linearRampToValueAtTime(380 + Math.random() * 260 + (i % 2) * 140, t + 0.08 + i * 0.09);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 23; const lg = ctx.createGain(); lg.gain.value = 60; lfo.connect(lg); lg.connect(os.frequency);
      os.connect(bp); bp.connect(g); g.connect(d); os.start(t); lfo.start(t); os.stop(t + 0.95); lfo.stop(t + 0.95);
    } else if (kind === 'metal') { tone(d, t, 0.25, 140, 90, 'triangle', 0.3); noise(d, t, 0.12, 900, 2, 'bandpass', 0.25, 0.1); }
    else { tone(d, t, 0.12, 180, 120, 'sine', 0.25); noise(d, t, 0.08, 600, 1.5, 'bandpass', 0.2, 0.07); }
  }
  function beep(pos, hi) { if (!ok()) return; const t = ctx.currentTime, d = out(pos, 4, 70); tone(d, t, 0.09, hi ? 3100 : 2400, null, 'sine', 0.35); }
  function boom(pos, big) {
    if (!ok()) return; const t = ctx.currentTime, d = out(pos, big ? 12 : 6, 250);
    tone(d, t, big ? 1.6 : 0.9, 90, 30, 'sine', big ? 1.4 : 1.0); noise(d, t, big ? 2.2 : 1.2, 700, 0.6, 'lowpass', big ? 1.3 : 0.9, big ? 2.0 : 1.0); noise(d, t, 0.15, 3000, 0.5, 'highpass', 0.6, 0.12);
  }
  function hiss(pos) { if (!ok()) return; const t = ctx.currentTime, d = out(pos, 4, 50); noise(d, t, 2.5, 3500, 0.4, 'highpass', 0.25, 2.5); }
  function click(kind) {
    if (!ok()) return; const t = ctx.currentTime, d = out(null);
    const F = { magout: ['reload_magout', 1, 0.9], magin: ['reload_magin', 1, 1], rack: ['reload_rack', 1, 1], bolt: ['reload_rack', 0.88, 1], slide: ['reload_rack', 1.18, 0.85],
      swish: ['knife_swing', 1, 0.8], clank: ['knife_swing', 0.8, 0.9], stab: ['knife_swing', 0.82, 0.95], flesh: [Math.random() < 0.5 ? 'knife_hit1' : 'knife_hit2', 1, 1] }[kind];
    if (F && sample(F[0], d, { t, rate: F[1], jit: 0.05, vol: F[2] })) { if (kind === 'clank') tone(d, t, 0.14, 3300, 3200, 'triangle', 0.1); return; }   // v20: lydfiler
    if (kind === 'magout') { noise(d, t, 0.05, 2500, 3, 'bandpass', 0.25, 0.04); tone(d, t, 0.06, 900, 500, 'square', 0.04); }
    else if (kind === 'magin') { noise(d, t, 0.06, 1800, 3, 'bandpass', 0.35, 0.05); tone(d, t + 0.02, 0.05, 700, 400, 'square', 0.05); }
    else if (kind === 'bolt') { noise(d, t, 0.08, 1500, 2, 'bandpass', 0.3, 0.06); noise(d, t + 0.18, 0.08, 1900, 2, 'bandpass', 0.3, 0.06); }
    else if (kind === 'rack') { noise(d, t, 0.05, 1700, 2.5, 'bandpass', 0.3, 0.04); tone(d, t, 0.04, 520, 380, 'square', 0.03); noise(d, t + 0.1, 0.07, 2300, 2.5, 'bandpass', 0.42, 0.05); tone(d, t + 0.1, 0.05, 820, 600, 'square', 0.04); }   // v14: ladegreb tilbage → frem (smæk)
    else if (kind === 'slide') { noise(d, t, 0.04, 2600, 3, 'bandpass', 0.28, 0.03); noise(d, t + 0.07, 0.05, 3200, 3, 'bandpass', 0.4, 0.04); tone(d, t + 0.07, 0.035, 1100, 800, 'square', 0.035); }   // pistolslæde
    else if (kind === 'switch') noise(d, t, 0.05, 2200, 2, 'bandpass', 0.2, 0.04);
    else if (kind === 'empty') tone(d, t, 0.04, 1600, 1200, 'square', 0.06);
    else if (kind === 'hit') {                       // kropsskud: lavt, dæmpet 'thud' (mærkes mere end det høres)
      tone(d, t, 0.07, 190, 120, 'sine', 0.42); noise(d, t, 0.06, 700, 1.0, 'lowpass', 0.32, 0.05); noise(d, t, 0.03, 1600, 2.5, 'bandpass', 0.12, 0.025);
    } else if (kind === 'hs') {                      // headshot: sprødt metallisk 'dink' (uharmoniske klokke-partialer + skarpt anslag)
      noise(d, t, 0.012, 7000, 0.8, 'highpass', 0.35, 0.01);
      tone(d, t, 0.32, 2960, 2940, 'sine', 0.24); tone(d, t, 0.22, 4710, 4690, 'sine', 0.13); tone(d, t, 0.16, 6830, 6800, 'sine', 0.07); tone(d, t, 0.09, 1480, 1470, 'triangle', 0.1);
    } else if (kind === 'kill') {                    // drab: lille dobbelt-tik oven på træf-lyden
      tone(d, t + 0.05, 0.05, 2200, 2100, 'triangle', 0.09); tone(d, t + 0.1, 0.06, 2900, 2800, 'triangle', 0.08);
    } else if (kind === 'swish') noise(d, t, 0.2, 2400, 0.9, 'bandpass', 0.3, 0.18);
    else if (kind === 'stab') { noise(d, t, 0.3, 1600, 0.8, 'bandpass', 0.32, 0.26); }
    else if (kind === 'flesh') { noise(d, t, 0.12, 500, 1, 'lowpass', 0.6, 0.1); tone(d, t, 0.08, 160, 90, 'sine', 0.35); }
    else if (kind === 'clank') { tone(d, t, 0.18, 3300, 3200, 'triangle', 0.18); tone(d, t, 0.14, 5100, 5000, 'sine', 0.08); noise(d, t, 0.05, 4000, 2, 'bandpass', 0.3, 0.04); }
    else if (kind === 'pickup') { noise(d, t, 0.06, 1800, 2, 'bandpass', 0.3, 0.05); tone(d, t + 0.04, 0.05, 900, 700, 'square', 0.05); }
    else if (kind === 'money') { tone(d, t, 0.06, 1760, null, 'triangle', 0.07); tone(d, t + 0.06, 0.09, 2350, null, 'triangle', 0.07); }
    else if (kind === 'buy') tone(d, t, 0.05, 800, 1200, 'triangle', 0.1);
    else if (kind === 'land') noise(d, t, 0.08, 300, 1, 'lowpass', 0.3, 0.07);
  }
  /* ---- v9: granater ---- */
  function pin() { if (!ok()) return; const t = ctx.currentTime, d = out(null); tone(d, t, 0.03, 3400, 2600, 'triangle', 0.08); noise(d, t + 0.02, 0.06, 6000, 2, 'bandpass', 0.18, 0.05); noise(d, t + 0.09, 0.04, 4200, 3, 'bandpass', 0.12, 0.03); }
  function throwSnd(pos, local) { if (!ok() || far(pos, 30)) return; const t = ctx.currentTime, d = out(local ? null : pos, 3, 30); noise(d, t, 0.22, 900, 0.7, 'bandpass', local ? 0.22 : 0.3, 0.2); }
  function bounce(pos, kind) { if (!ok() || far(pos, 35)) return; const t = ctx.currentTime, d = out(pos, 3, 35); if (kind === 'molotov') { noise(d, t, 0.1, 4500, 4, 'bandpass', 0.25, 0.08); } else { tone(d, t, 0.06, 1900 + Math.random() * 600, 900, 'triangle', 0.18); noise(d, t, 0.04, 3000, 3, 'bandpass', 0.15, 0.03); } }
  function flashbang(pos) {                           // v12: dæmpet knald (før alt for højt): kortere højpas-del, blødere krop
    if (!ok()) return; const t = ctx.currentTime, d = out(pos, 8, 140);
    noise(d, t, 0.22, 2800, 0.5, 'highpass', 0.55, 0.18); tone(d, t, 0.2, 150, 55, 'sine', 0.55); noise(d, t, 0.7, 600, 0.6, 'lowpass', 0.35, 0.6);
  }
  // tinnitus: høj ringetone der klinger af over 'dur' sekunder, mens alle andre spillyde (sfx-bussen) dæmpes kraftigt og gradvist vender tilbage
  let tinn = null;
  function tinnitus(dur, strength) {
    if (!ok()) return; const t = ctx.currentTime, st = Math.max(0.2, Math.min(1, strength === undefined ? 1 : strength)), D = Math.max(0.5, dur) + 1.2;
    if (tinn) { try { tinn.os.stop(t + 0.05); tinn.os2.stop(t + 0.05); } catch (e) {} }
    const g = ctx.createGain(); g.connect(master);
    // v12: blødere tinnitus – lavere niveau, dybere tone (2,3 kHz i stedet for 3,6 kHz), næsten ingen skarp overtone, blød fade-in
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.085 * st, t + 0.18); g.gain.setValueAtTime(0.085 * st, t + Math.min(D * 0.3, 1.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + D);
    const os = ctx.createOscillator(); os.type = 'sine'; os.frequency.setValueAtTime(2350, t); os.frequency.linearRampToValueAtTime(2250, t + D);
    const os2 = ctx.createOscillator(); os2.type = 'sine'; os2.frequency.value = 4720; const g2 = ctx.createGain(); g2.gain.value = 0.04; os2.connect(g2); g2.connect(g);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 4.2; const lg = ctx.createGain(); lg.gain.value = 5; lfo.connect(lg); lg.connect(os.frequency);
    os.connect(g); os.start(t); os2.start(t); lfo.start(t); os.stop(t + D + 0.05); os2.stop(t + D + 0.05); lfo.stop(t + D + 0.05);
    tinn = { os, os2 };
    const duck = Math.min(0.6, Math.max(0.12, 0.22 / st));
    const sg = sfx.gain; sg.cancelScheduledValues(t); sg.setValueAtTime(Math.max(0.0001, sg.value), t); sg.exponentialRampToValueAtTime(duck, t + 0.06);
    sg.setValueAtTime(duck, t + Math.min(D * 0.35, 1.4)); sg.exponentialRampToValueAtTime(1, t + D);
  }
  function glass(pos) { if (!ok()) return; const t = ctx.currentTime, d = out(pos, 4, 60); for (let i = 0; i < 5; i++) tone(d, t + i * 0.025, 0.12, 2800 + Math.random() * 3000, 1800, 'triangle', 0.12); noise(d, t, 0.25, 5000, 1.5, 'highpass', 0.5, 0.2); }
  function ignite(pos) { if (!ok()) return; const t = ctx.currentTime, d = out(pos, 6, 80); noise(d, t, 0.9, 400, 0.6, 'lowpass', 0.9, 0.8); noise(d, t, 0.4, 1800, 0.8, 'bandpass', 0.5, 0.35); }
  function fizzle(pos) { if (!ok()) return; const t = ctx.currentTime, d = out(pos, 4, 40); noise(d, t, 0.6, 3000, 0.8, 'highpass', 0.25, 0.55); }
  // ild-løkke (knitren) i 3D: returnerer stop()
  function fireLoop(pos) {
    if (!ok()) return { stop() {} };
    const t = ctx.currentTime, d = out(pos, 3, 40), g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.3); g.connect(d);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; const bp = ctx.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 700; src.connect(bp); bp.connect(g); src.start(t);
    let alive = true; const crack = () => { if (!alive || !ok()) return; const tt = ctx.currentTime; noise(g, tt, 0.03, 2000 + Math.random() * 2500, 3, 'bandpass', 0.4 + Math.random() * 0.4, 0.025); setTimeout(crack, 40 + Math.random() * 140); }; crack();
    return { stop() { if (!alive) return; alive = false; const tt = ctx.currentTime; g.gain.cancelScheduledValues(tt); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), tt); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.5); src.stop(tt + 0.55); } };
  }
  function setVolume(v) { setVolumes({ master: v }); }
  // v12: uafhængige busser (0..1)
  function setVolumes(o) {
    for (const k of ['master', 'sfx', 'music', 'voice']) if (o && Number.isFinite(o[k])) VOL[k] = Math.max(0, Math.min(1, o[k]));
    vol = VOL.master;
    if (!ctx) return; const t = ctx.currentTime;
    master.gain.setTargetAtTime(MASTER * VOL.master, t, 0.02); sfxVol.gain.setTargetAtTime(VOL.sfx, t, 0.02);
    musicBus.gain.setTargetAtTime(VOL.music * 0.55, t, 0.05); voiceBus.gain.setTargetAtTime(VOL.voice, t, 0.02);
  }

  /* ---------------- v12: MUSIK & AMBIENCE (musik-bussen) ---------------- */
  function chord(t, notes, dur, type, v, attack) {
    for (const f of notes) {
      const os = ctx.createOscillator(); os.type = type || 'sawtooth'; os.frequency.value = f; os.detune.value = (Math.random() - 0.5) * 12;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(600, t); lp.frequency.linearRampToValueAtTime(2400, t + dur * 0.4); lp.frequency.linearRampToValueAtTime(500, t + dur);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (attack || 0.08)); g.gain.setValueAtTime(v, t + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      os.connect(lp); lp.connect(g); g.connect(musicBus); os.start(t); os.stop(t + dur + 0.05);
    }
  }
  const N = m => 440 * Math.pow(2, (m - 69) / 12);
  function music(kind) {
    if (!ok()) return; const t = ctx.currentTime + 0.02;
    if (kind === 'start') { chord(t, [N(45), N(52), N(57)], 1.6, 'sawtooth', 0.05, 0.25); tone(musicBus, t + 0.05, 0.6, N(69), N(69), 'triangle', 0.04); }
    else if (kind === 'win') { chord(t, [N(48), N(55), N(60), N(64)], 2.6, 'sawtooth', 0.055, 0.04); chord(t + 0.45, [N(53), N(60), N(65), N(69)], 2.4, 'triangle', 0.05, 0.05); }
    else if (kind === 'lose') { chord(t, [N(45), N(52), N(57), N(60)], 2.8, 'sawtooth', 0.05, 0.1); chord(t + 0.6, [N(41), N(48), N(53), N(56)], 2.6, 'triangle', 0.045, 0.2); }
    else if (kind === 'planted') { for (let i = 0; i < 6; i++) tone(musicBus, t + i * 0.42, 0.36, N(38), N(37), 'sawtooth', 0.05); chord(t, [N(50), N(53), N(56)], 2.8, 'sawtooth', 0.025, 0.6); }
    else if (kind === 'mvp') { [72, 76, 79, 84].forEach((m, i) => tone(musicBus, t + 0.6 + i * 0.09, 0.5, N(m), N(m), 'triangle', 0.05)); }
  }
  // ambience pr. bane: vind + (Nuke) industri-brum / (Ancient) insekter / (Dust) varm ørkenvind. Kører i en løkke på musik-bussen.
  let amb = null;
  function ambience(id) {
    if (!ctx) { pendingAmb = id; return; }
    if (amb && amb.id === id) return; stopAmbience();
    if (!id) return;
    const t = ctx.currentTime, g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 2.5); g.connect(musicBus);
    const nodes = [];
    const wind = ctx.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true; wind.playbackRate.value = 0.5;
    const wl = ctx.createBiquadFilter(); wl.type = 'lowpass'; wl.frequency.value = id === 'white_dust' ? 520 : 380; wl.Q.value = 0.7;
    // v20: vinden skruet ned (brugerønske) – fugle og fjern trafik giver liv i stedet
    const wg = ctx.createGain(); wg.gain.value = id === 'white_dust' ? 0.06 : 0.035; wind.connect(wl); wl.connect(wg); wg.connect(g); wind.start(t); nodes.push(wind);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 0.025; lfo.connect(lg); lg.connect(wg.gain); lfo.start(t); nodes.push(lfo);
    const AMB = { white_dust: [0.22, 0.32], nuke: [0.12, 0.42], ancient: [0.3, 0.12], inferno: [0.34, 0.3], havn: [0.26, 0.4], canals: [0.3, 0.38] }[id] || [0.25, 0.3];
    let files = false;
    for (const [name, v, lp] of [['amb_birds', AMB[0], 0], ['amb_traffic', AMB[1], 1300]]) {
      const b = buf[name]; if (!b || v <= 0) continue; files = true;
      const src = ctx.createBufferSource(); src.buffer = b; src.loop = true; src.loopStart = 0.05; src.loopEnd = b.duration - 0.05;
      const gg = ctx.createGain(); gg.gain.value = v; let head = src;
      if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; src.connect(f); head = f; }   // trafikken er langt væk: dæmpet top
      head.connect(gg); gg.connect(g); src.start(t, Math.random() * (b.duration - 1)); nodes.push(src);
    }
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.11; const lg2 = ctx.createGain(); lg2.gain.value = 180; lfo2.connect(lg2); lg2.connect(wl.frequency); lfo2.start(t); nodes.push(lfo2);
    if (id === 'nuke') {                              // kraftværkets brum (50 Hz + harmoniske) og fjern ventilation
      for (const [f, v] of [[50, 0.05], [100, 0.035], [150, 0.015]]) { const o = ctx.createOscillator(); o.frequency.value = f; const og = ctx.createGain(); og.gain.value = v; o.connect(og); og.connect(g); o.start(t); nodes.push(o); }
      const vent = ctx.createBufferSource(); vent.buffer = noiseBuf; vent.loop = true; const vb = ctx.createBiquadFilter(); vb.type = 'bandpass'; vb.frequency.value = 900; vb.Q.value = 0.8; const vg = ctx.createGain(); vg.gain.value = 0.03; vent.connect(vb); vb.connect(vg); vg.connect(g); vent.start(t); nodes.push(vent);
    }
    let alive = true;
    if (id === 'ancient') { const chirp = () => { if (!alive || !ok()) return; const tt = ctx.currentTime; for (let i = 0; i < 3 + Math.random() * 4; i++) tone(g, tt + i * 0.06, 0.04, 4200 + Math.random() * 1500, 4000, 'sine', 0.012); setTimeout(chirp, 700 + Math.random() * 2600); }; setTimeout(chirp, 900); }
    if (id === 'white_dust') { const gust = () => { if (!alive || !ok()) return; noise(g, ctx.currentTime, 2.6, 900, 0.5, 'bandpass', 0.05, 2.4); setTimeout(gust, 5000 + Math.random() * 9000); }; setTimeout(gust, 3000); }
    amb = { id, g, nodes, files, stop() { alive = false; } };
  }
  function stopAmbience() {
    if (!amb || !ctx) { amb = null; return; }
    const a = amb, t = ctx.currentTime; amb = null; a.stop();
    a.g.gain.cancelScheduledValues(t); a.g.gain.setValueAtTime(Math.max(0.0001, a.g.gain.value), t); a.g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    for (const n of a.nodes) try { n.stop(t + 1.3); } catch (e) {}
  }

  /* ---------------- v12: SPEAKER & STEMME-UI (voice-bussen + talesyntese) ---------------- */
  let voiceSel = null;
  function pickVoice() {
    if (voiceSel || !window.speechSynthesis) return voiceSel;
    const vs = speechSynthesis.getVoices() || [];
    voiceSel = vs.find(v => /en[-_]US/i.test(v.lang) && /(Alex|Daniel|Fred|Google US English|Male|David|Mark)/i.test(v.name)) || vs.find(v => /^en/i.test(v.lang)) || null;
    return voiceSel;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) try { speechSynthesis.onvoiceschanged = () => { voiceSel = null; pickVoice(); }; } catch (e) {}
  function announce(text, opts) {
    const o = opts || {};
    if (ok()) {                                         // radio-'chirp' før speakeren (på voice-bussen)
      const t = ctx.currentTime; noise(voiceBus, t, 0.06, 2600, 3, 'bandpass', 0.18, 0.05); tone(voiceBus, t + 0.03, 0.08, o.hi ? 1320 : 990, null, 'square', 0.035); tone(voiceBus, t + 0.12, 0.1, o.hi ? 1760 : 1320, null, 'square', 0.03);
    }
    const v = VOL.master * VOL.voice;
    if (!window.speechSynthesis || v <= 0.01 || !text) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = o.rate || 1.02; u.pitch = o.pitch || 0.82; u.volume = Math.min(1, v * 1.15);
      const vc = pickVoice(); if (vc) u.voice = vc;
      setTimeout(() => { try { speechSynthesis.speak(u); } catch (e) {} }, 160);
    } catch (e) {}
  }
  if (typeof window !== 'undefined') try { build(); } catch (e) {}                 // v20: kontekst + afkodning straks (genoptages ved første klik)
  return { loaded, playMusic, stopMusic, musicTime, musicPlaying, init, setListener, shot, step, impact, door, beep, boom, hiss, click, pin, throwSnd, bounce, flashbang, tinnitus, glass, ignite, fizzle, fireLoop, setVolume, setVolumes, music, ambience, stopAmbience, announce, get ready() { return ok(); }, set enabled(v) { enabled = v; } };
}
