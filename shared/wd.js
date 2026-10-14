/* ==========================================================================
   DE_WHITE_DUST – delt kode (bruges af BÅDE server og klient)
   Kort, kollision, spillerfysik, raycasts og våbentabel.
   Serveren og klienten kører præcis samme kode, så de altid er enige.

   v8: baner bygges af ét eller flere tile-LAG (fx Nukes B-etage under A-etagen), hvert lag med sin egen
   tile-tabel (gulv, væg, dør, vindue, ventilationskanal, tomrum ...). Kolliderere ligger i et rumligt
   gitter (4 m celler), så fysik og raycasts kun tester nærliggende geometri.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WD = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // v12.1: Nukes geometri genereres fra STL-modellen (tools/nuke_from_stl.py → shared/nuke_data.js)
  const NUKE_DATA = (typeof module === 'object' && module.exports) ? require('./nuke_data.js') : (typeof self !== 'undefined' ? self.WD_NUKE : null);
  const INFERNO_DATA = (typeof module === 'object' && module.exports) ? require('./inferno_data.js') : (typeof self !== 'undefined' ? self.WD_INFERNO : null);
  const CANALS_DATA = (typeof module === 'object' && module.exports) ? require('./canals_data.js') : (typeof self !== 'undefined' ? self.WD_CANALS : null);
  const HAVN_DATA = (typeof module === 'object' && module.exports) ? require('./havn_data.js') : (typeof self !== 'undefined' ? self.WD_HAVN : null);
  const ANCIENT_DATA = (typeof module === 'object' && module.exports) ? require('./ancient_data.js') : (typeof self !== 'undefined' ? self.WD_ANCIENT : null);

  /* ---------------------------------------------------------------- konstanter */
  const PL = {
    R: 0.32,        // halv bredde (kollisionsfodaftryk)
    H: 1.8,         // højde stående
    HC: 1.3,        // højde nedhuk
    EYE: 1.62,      // øjenhøjde stående
    EYEC: 1.15,     // øjenhøjde nedhuk
    STEP: 0.5,      // max trinhøjde
    MANTLE: 0.65,   // hvor langt under en kant man må være i luften for at 'hive sig op' (hop op på kasser)
    SNAP: 0.35,     // hvor langt ned man "klistrer" til gulvet (ramper)
    GRAV: 24,
    JUMP: 7.4,      // ≈1.14 m hop
    RUN: 6.0,
    WALK: 3.0,
    CROUCH: 2.8,
    CLIMB: 3.2,     // stige-fart (m/s)
    // v12: Source/CS-bevægelse (skaleret fra Hammer-enheder: 250 u/s = 6 m/s). Friktion + acceleration i stedet for ren eksponentiel
    // udjævning => rigtig counter-strafe (modsat tast stopper på ~0,1 s), kort 'glid' når man slipper, air-strafe i luften.
    FRIC: 5.2,      // sv_friction
    STOP: 1.9,      // sv_stopspeed (80 u/s): under denne fart bremser friktionen med konstant kraft
    ACC: 5.5,       // sv_accelerate
    AIRACC: 12,     // sv_airaccelerate
    AIRCAP: 0.72,   // 30 u/s: max fart der kan 'tilføjes' i ønsket retning pr. tick i luften (air-strafe)
    AIRMAX: 1.2,    // vandret fart i luften kappes til 1,2 × løbefart (ingen bhop-misbrug forbi serverens bevægelsesbudget)
    NUDGE: 0.16     // hjørne-glid: rammer man en kant med højst så meget overlap, skubbes man blødt rundt om den (ingen 'sticky' dørkarme)
  };
  const HIT_MUL = { head: 4, torso: 0.75, legs: 0.56 };   // kropsskud -25 % => AK/M4: 4 skud, MP5/USP: 5; headshot uændret

  /* team: 'hij' | 'swat' = kun det hold kan købe våbnet (samles det op fra jorden, må alle bruge det) */
  const WEAPONS = {
    usp:   { id: 'usp',   name: 'USP-S',    slot: 2, kind: 'gun', dmg: 30,  rate: 0.17,  mag: 12, res: 36,  reload: 1.7, spread: 0.004, move: 0.030, air: 0.09, auto: false, price: 0,    recoil: 0.012, len: 0.22, code: 1, team: 'swat' },
    glock: { id: 'glock', name: 'GLOCK-18', slot: 2, kind: 'gun', dmg: 26,  rate: 0.15,  mag: 20, res: 120, reload: 2.2, spread: 0.005, move: 0.030, air: 0.09, auto: false, price: 0,    recoil: 0.010, len: 0.19, code: 9, team: 'hij' },
    tec9:  { id: 'tec9',  name: 'TEC-9',    slot: 2, kind: 'gun', dmg: 28,  rate: 0.12,  mag: 18, res: 90,  reload: 2.5, spread: 0.006, move: 0.032, air: 0.09, auto: false, price: 500,  recoil: 0.013, len: 0.26, code: 12, team: 'hij' },
    fiveseven: { id: 'fiveseven', name: 'FIVE-SEVEN', slot: 2, kind: 'gun', dmg: 30, rate: 0.15, mag: 20, res: 100, reload: 2.2, spread: 0.005, move: 0.030, air: 0.09, auto: false, price: 500, recoil: 0.012, len: 0.21, code: 13, team: 'swat' },
    deagle: { id: 'deagle', name: 'DESERT EAGLE', slot: 2, kind: 'gun', dmg: 60, rate: 0.26, mag: 7, res: 35, reload: 2.2, spread: 0.004, move: 0.060, air: 0.14, auto: false, price: 700, recoil: 0.04, len: 0.27, code: 14 },
    mp5:   { id: 'mp5',   name: 'MP5-SD',   slot: 1, kind: 'gun', smg: true, dmg: 27,  rate: 0.08, mag: 30, res: 120, reload: 2.6, spread: 0.009, move: 0.022, air: 0.08, auto: true,  price: 1500, recoil: 0.007, len: 0.36, code: 2, sup: true },
    // v13: maskinpistoler (SMG) – billige, hurtige at løbe med, præcise i bevægelse og +$600 pr. kill (P90: +$300) som i CS2
    mac10: { id: 'mac10', name: 'MAC-10',   slot: 1, kind: 'gun', smg: true, dmg: 29,  rate: 0.075, mag: 30, res: 100, reload: 2.6, spread: 0.012, move: 0.020, air: 0.08, auto: true,  price: 1050, recoil: 0.010, len: 0.30, code: 19, team: 'hij' },
    mp9:   { id: 'mp9',   name: 'MP9',      slot: 1, kind: 'gun', smg: true, dmg: 26,  rate: 0.07,  mag: 30, res: 120, reload: 2.1, spread: 0.010, move: 0.020, air: 0.08, auto: true,  price: 1250, recoil: 0.009, len: 0.33, code: 20, team: 'swat' },
    mp7:   { id: 'mp7',   name: 'MP7',      slot: 1, kind: 'gun', smg: true, dmg: 29,  rate: 0.08,  mag: 30, res: 120, reload: 2.4, spread: 0.009, move: 0.022, air: 0.08, auto: true,  price: 1500, recoil: 0.008, len: 0.38, code: 21 },
    ump45: { id: 'ump45', name: 'UMP-45',   slot: 1, kind: 'gun', smg: true, dmg: 35,  rate: 0.09,  mag: 25, res: 100, reload: 3.0, spread: 0.011, move: 0.026, air: 0.09, auto: true,  price: 1200, recoil: 0.011, len: 0.44, code: 22 },
    p90:   { id: 'p90',   name: 'P90',      slot: 1, kind: 'gun', smg: true, dmg: 26,  rate: 0.07,  mag: 50, res: 100, reload: 3.3, spread: 0.011, move: 0.026, air: 0.09, auto: true,  price: 2350, recoil: 0.008, len: 0.46, code: 23 },
    galil: { id: 'galil', name: 'GALIL AR', slot: 1, kind: 'gun', dmg: 31,  rate: 0.09,  mag: 35, res: 90,  reload: 2.6, spread: 0.009, move: 0.040, air: 0.10, auto: true,  price: 1800, recoil: 0.012, len: 0.54, code: 10, team: 'hij' },
    famas: { id: 'famas', name: 'FAMAS',    slot: 1, kind: 'gun', dmg: 30,  rate: 0.09,  mag: 25, res: 90,  reload: 3.0, spread: 0.008, move: 0.038, air: 0.10, auto: true,  price: 2050, recoil: 0.011, len: 0.48, code: 11, team: 'swat' },
    ak47:  { id: 'ak47',  name: 'AK-47',    slot: 1, kind: 'gun', dmg: 36,  rate: 0.10,  mag: 30, res: 90,  reload: 2.4, spread: 0.008, move: 0.040, air: 0.10, auto: true,  price: 2700, recoil: 0.015, len: 0.55, code: 3, team: 'hij' },
    m4a1:  { id: 'm4a1',  name: 'M4A1',     slot: 1, kind: 'gun', dmg: 33,  rate: 0.09,  mag: 30, res: 90,  reload: 2.3, spread: 0.006, move: 0.038, air: 0.10, auto: true,  price: 3100, recoil: 0.011, len: 0.52, code: 4, team: 'swat' },
    awp:   { id: 'awp',   name: 'AWP',      slot: 1, kind: 'gun', dmg: 140, rate: 1.35,  mag: 5,  res: 20,  reload: 3.2, spread: 0.0008, move: 0.10, air: 0.20, auto: false, price: 4750, recoil: 0.045, len: 0.75, code: 5, scope: true, unscoped: 0.06 },
    he:    { id: 'he',    name: 'HE-GRANAT', slot: 3, kind: 'nade', price: 300, code: 6, fuse: 1.8 },
    flash: { id: 'flash', name: 'FLASHBANG', slot: 3, kind: 'nade', price: 200, code: 15, fuse: 1.5 },
    smoke: { id: 'smoke', name: 'SMOKE',     slot: 3, kind: 'nade', price: 300, code: 7, fuse: 3.0 },
    molotov: { id: 'molotov', name: 'MOLOTOV',  slot: 3, kind: 'nade', price: 400, code: 16, fuse: 2.0, team: 'hij', fire: true },
    incgren: { id: 'incgren', name: 'BRANDGRANAT', slot: 3, kind: 'nade', price: 600, code: 17, fuse: 2.0, team: 'swat', fire: true },
    c4:    { id: 'c4',    name: 'C4',        slot: 5, kind: 'bomb', price: 0,   code: 8 },
    // v12: kniv (altid i inventaret, tast 3 / Q). Venstreklik = hurtigt hug, højreklik = tungt stik; bagfra (rygstik) gør meget mere skade.
    knife: { id: 'knife', name: 'KNIV',      slot: 3, kind: 'knife', price: 0, code: 18, slash: 40, slashBack: 90, stab: 65, stabBack: 180, slashRate: 0.42, stabRate: 1.0, range: 1.75 }
  };
  /* v12: bevægelsesfart pr. våben i hånden (CS: kniv 250, pistoler 240, SMG 230, rifler 215-225, AWP 200 u/s ift. 250) */
  const SPEED = { knife: 1.1, usp: 1.0, glock: 1.0, tec9: 1.0, fiveseven: 1.0, deagle: 0.98, mp5: 0.95, mac10: 0.96, mp9: 0.96, mp7: 0.95, ump45: 0.92, p90: 0.92, galil: 0.94, famas: 0.94, ak47: 0.93, m4a1: 0.94, awp: 0.84,
    he: 1.0, flash: 1.0, smoke: 1.0, molotov: 1.0, incgren: 1.0, c4: 1.0 };
  for (const k in SPEED) WEAPONS[k].speed = SPEED[k];
  const speedOf = id => (WEAPONS[id] && WEAPONS[id].speed) || 1;
  /* v12: CS-økonomi. Kill-belønning pr. våbentype, mål-bonusser og tabs-serie (loss streak) */
  const ECON = {
    kill: { pistol: 300, smg: 600, p90: 300, rifle: 300, awp: 100, knife: 1500, nade: 300, fire: 300 },
    win: { elim: 3250, time: 3250, bomb: 3500, defuse: 3500 },
    loss: [1400, 1900, 2400, 2900, 3400],             // 1., 2., 3., 4., 5.+ tabte runde i træk
    plant: 300, plantTeam: 800, defuse: 300,          // plantTeam: hele Hijacker-holdet får +800 når bomben er plantet, men runden tabes (CS-reglen)
    start: 800, max: 16000
  };
  function killReward(id) {
    const w = WEAPONS[id]; if (!w) return 0;
    if (w.kind === 'knife') return ECON.kill.knife;
    if (w.kind === 'nade') return w.fire ? ECON.kill.fire : ECON.kill.nade;
    if (w.kind !== 'gun') return 0;
    if (w.id === 'awp') return ECON.kill.awp;
    if (w.slot === 2) return ECON.kill.pistol;
    if (w.id === 'p90') return ECON.kill.p90;
    return w.smg ? ECON.kill.smg : ECON.kill.rifle;
  }
  const lossBonus = streak => ECON.loss[Math.max(0, Math.min(ECON.loss.length - 1, (streak | 0) - 1))];
  const WEAPON_BY_CODE = {};
  Object.keys(WEAPONS).forEach(k => { WEAPON_BY_CODE[WEAPONS[k].code] = k; });
  const sidePistol = side => side === 'hij' ? 'glock' : 'usp';

  /* ---- granater: max pr. type, ild-granaterne deler én plads, højst 4 i alt (som i CS) ---- */
  const NADES = ['flash', 'smoke', 'he', 'molotov', 'incgren'];
  const NADE_MAX = { he: 1, flash: 2, smoke: 1, molotov: 1, incgren: 1 };
  const NADE_TYPE = { he: 0, smoke: 1, flash: 2, molotov: 3, incgren: 4 };      // kode i snapshots
  const NADE_BY_TYPE = ['he', 'smoke', 'flash', 'molotov', 'incgren'];
  function nadeCount(inv) { let n = 0; for (const k of NADES) n += inv[k] || 0; return n; }
  function canTakeNade(inv, id) {
    if (!NADE_MAX[id] || (inv[id] || 0) >= NADE_MAX[id] || nadeCount(inv) >= 4) return false;
    if (WEAPONS[id].fire && ((inv.molotov || 0) + (inv.incgren || 0)) > 0) return false;
    return true;
  }
  // køb: holdets egne våben + fælles våben (uden team). v13: SMG-kategori (MAC-10/MP9 pr. hold + MP7, UMP-45, P90, MP5-SD)
  const BUY = {
    hij:  { pistols: ['tec9', 'deagle'], smgs: ['mac10', 'mp7', 'ump45', 'p90', 'mp5'], rifles: ['galil', 'ak47', 'awp'], nades: ['flash', 'smoke', 'he', 'molotov'] },
    swat: { pistols: ['fiveseven', 'deagle'], smgs: ['mp9', 'mp7', 'ump45', 'p90', 'mp5'], rifles: ['famas', 'm4a1', 'awp'], nades: ['flash', 'smoke', 'he', 'incgren'] }
  };
  const canBuy = (side, id) => { const B = BUY[side]; return !!B && (B.rifles.includes(id) || B.smgs.includes(id) || B.pistols.includes(id) || B.nades.includes(id)); };

  /* ---- kast: venstreklik = overhåndskast (kraft bygges op, 0..1), højreklik = blødt underhåndskast. Parabelbane med tyngdekraft THROW.G ---- */
  const THROW = { G: 15, overMin: 14, overMax: 25, overUp: 2.4, under: 7.0, underUp: 1.6, charge: 0.55, underDrop: 0.45 };
  function throwVel(d, power, under) {
    if (under) return [d[0] * THROW.under, d[1] * THROW.under + THROW.underUp, d[2] * THROW.under];
    const p = power < 0 ? 0 : power > 1 ? 1 : power, s = THROW.overMin + (THROW.overMax - THROW.overMin) * p;
    return [d[0] * s, d[1] * s + THROW.overUp, d[2] * s];
  }

  /* ---- procedural pattern recoil: deterministisk spray-mønster pr. våben (kumulativt [yaw, pitch] i radianer efter n skud).
       Lodret stigning der flader ud + sidelæns sving efter 'start' skud – kan modvirkes ved at trække musen nedad/til siden. ---- */
  const SPRAY = {
    ak47:  { max: 0.155, rise: 0.022, side: 0.05, start: 8, period: 8, drift: 0.012 },
    galil: { max: 0.125, rise: 0.018, side: 0.04, start: 9, period: 9, drift: -0.01 },
    m4a1:  { max: 0.115, rise: 0.017, side: 0.034, start: 9, period: 10, drift: -0.01 },
    famas: { max: 0.110, rise: 0.017, side: 0.036, start: 8, period: 8, drift: 0.01 },
    mp5:   { max: 0.080, rise: 0.013, side: 0.026, start: 9, period: 9, drift: 0.008 },
    mac10: { max: 0.095, rise: 0.015, side: 0.034, start: 7, period: 7, drift: 0.012 },
    mp9:   { max: 0.085, rise: 0.014, side: 0.03, start: 8, period: 8, drift: -0.01 },
    mp7:   { max: 0.080, rise: 0.013, side: 0.026, start: 9, period: 9, drift: 0.006 },
    ump45: { max: 0.100, rise: 0.017, side: 0.03, start: 7, period: 8, drift: -0.008 },
    p90:   { max: 0.085, rise: 0.011, side: 0.03, start: 12, period: 12, drift: 0.01 },
    awp:   { max: 0.06, rise: 0.06, side: 0, start: 99, period: 1, drift: 0 },
    deagle: { max: 0.12, rise: 0.06, side: 0.01, start: 2, period: 3, drift: 0.01 },
    usp:   { max: 0.05, rise: 0.016, side: 0.008, start: 3, period: 4, drift: 0.004 },
    glock: { max: 0.05, rise: 0.014, side: 0.01, start: 3, period: 4, drift: -0.004 },
    tec9:  { max: 0.07, rise: 0.018, side: 0.014, start: 3, period: 4, drift: 0.006 },
    fiveseven: { max: 0.05, rise: 0.015, side: 0.01, start: 3, period: 4, drift: -0.004 }
  };
  function sprayAt(id, n) {
    const s = SPRAY[id]; if (!s || n <= 0) return [0, 0];
    const pitch = s.max * (1 - Math.exp(-n * s.rise / s.max));
    const k = n <= s.start - 2 ? 0 : n >= s.start + 2 ? 1 : (n - s.start + 2) / 4;
    const yaw = s.drift * Math.min(n, s.start) / s.start + s.side * Math.sin((n - s.start) / s.period * Math.PI) * k;
    return [yaw, pitch];
  }

  const TILE = 2, BASE = -8, WALL_TOP = 9;
  const MAP_REG = {};

  /* ================================================================ VERDENSBYGGER ================================================================
     En bane = { name, GW, GH, GX0, GZ0, layers?, LEVELS?, grid(H), props(H), meta(H) }.
     layers: [{ id, yb, yt, tiles }] – hvert lag dækker højdeintervallet [yb, yt]. Tile-typer:
       { solid: true, top?, kind? }               massiv (væg) fra yb til top (default yt)
       { void: true }                             intet (åbent ned til laget under: skakte, ramper, trapper)
       { floor: y, sill?, lintel?, top? }         gulv i højde y (+ evt. vindueskarm), evt. overligger fra y+lintel til top
     Uden layers: ét lag [BASE, WALL_TOP] med LEVELS (gulvhøjder) + '#', 'w', 'r', 'q' (som før v8). */
  function legacyTiles(LEVELS) {
    const t = { '#': { solid: true }, w: { floor: 0, sill: 0.4, lintel: 2.6 }, r: { solid: true, top: 3.0, kind: 'ruin' }, q: { solid: true, top: 1.4, kind: 'ruin' } };
    for (const k in LEVELS) t[k] = { floor: LEVELS[k] };
    return t;
  }

  function makeWorld(id) {
    const spec = MAP_REG[id];
    const { GW, GH, GX0, GZ0 } = spec;
    const lspecs = spec.layers || [{ id: 'G', yb: BASE, yt: WALL_TOP, tiles: legacyTiles(spec.LEVELS) }];
    const layers = lspecs.map(L => ({ id: L.id, yb: L.yb, yt: L.yt, tiles: L.tiles, grid: Array.from({ length: GH }, () => new Array(GW).fill('#')) }));
    let cur = layers[layers.length - 1];
    const boxes = [];     // {x0,y0,z0,x1,y1,z1, kind, style?, nb?}  kind: wall|floor|slab|stone|prop|ruin|rail|glass|grate|solid(usynlig kollision)
    const ramps = [], labels = [], ladders = [], cyls = [], doors = [];
    const cX = c => GX0 + c * TILE;
    const cZ = r => GZ0 + r * TILE;
    const layer = lid => { cur = layers.find(l => l.id === lid); if (!cur) throw new Error('ukendt lag ' + lid); };
    const fill = (c0, r0, c1, r1, ch) => {
      if (!(ch in cur.tiles)) throw new Error('ukendt tile "' + ch + '" i lag ' + cur.id);
      for (let r = Math.max(0, r0); r <= Math.min(GH - 1, r1); r++) for (let c = Math.max(0, c0); c <= Math.min(GW - 1, c1); c++) cur.grid[r][c] = ch;
    };
    const plainFloor = (L, y) => { for (const k in L.tiles) { const t = L.tiles[k]; if (t.floor !== undefined && !t.sill && t.lintel === undefined && Math.abs(t.floor - y) < 1e-6) return k; } return null; };
    const tileTop = (t, L) => t.void ? undefined : t.solid ? (t.top !== undefined ? t.top : L.yt) : t.floor + (t.sill || 0);
    // gulvhøjde i (x,z) set fra oven: øverste lag hvis tile har gulv, ellers laget under (til placering af props)
    const groundAtGrid = (x, z) => {
      const c = Math.floor((x - GX0) / TILE), r = Math.floor((z - GZ0) / TILE);
      for (let i = layers.length - 1; i >= 0; i--) {
        const L = layers[i], ch = L.grid[r] && L.grid[r][c], t = ch && L.tiles[ch];
        if (!t || t.void) continue;
        if (t.floor !== undefined) return t.floor + (t.sill || 0);
        return tileTop(t, L);
      }
      return 0;
    };

    /* ---- ramper (tile-koordinater). Gulvet under en rampe sættes til rampens laveste niveau i det aktuelle lag */
    function ramp(c0, r0, c1, r1, axis, ya, yb) {
      const yLow = Math.min(ya, yb), ch = plainFloor(cur, yLow);
      if (!ch) throw new Error('intet gulv-tile i niveau ' + yLow + ' (lag ' + cur.id + ')');
      fill(c0, r0, c1, r1, ch);
      const x0 = cX(c0), x1 = cX(c1 + 1), z0 = cZ(r0), z1 = cZ(r1 + 1);
      const r = axis === 'x'
        ? { axis, a0: x0, a1: x1, w0: z0, w1: z1, ya, yb, yBottom: yLow }
        : { axis, a0: z0, a1: z1, w0: x0, w1: x1, ya, yb, yBottom: yLow };
      const m = (yb - ya) / (r.a1 - r.a0);
      r.m = m;
      if (axis === 'x') {
        r.planes = [[-1, 0, 0, -r.a0], [1, 0, 0, r.a1], [0, 0, -1, -r.w0], [0, 0, 1, r.w1], [0, -1, 0, -yLow], [-m, 1, 0, ya - m * r.a0]];
        r.bx0 = r.a0; r.bx1 = r.a1; r.bz0 = r.w0; r.bz1 = r.w1;
      } else {
        r.planes = [[0, 0, -1, -r.a0], [0, 0, 1, r.a1], [-1, 0, 0, -r.w0], [1, 0, 0, r.w1], [0, -1, 0, -yLow], [0, 1, -m, ya - m * r.a0]];
        r.bx0 = r.w0; r.bx1 = r.w1; r.bz0 = r.a0; r.bz1 = r.a1;
      }
      ramps.push(r);
    }
    // meter-baserede varianter (alle mål = multipla af 2 m)
    const tc = v => Math.round((v - GX0) / TILE), tr = v => Math.round((v - GZ0) / TILE);
    const R = (x0, z0, x1, z1, ch) => fill(tc(x0), tr(z0), tc(x1) - 1, tr(z1) - 1, ch);
    const RAMP = (x0, z0, x1, z1, axis, ya, yb) => ramp(tc(x0), tr(z0), tc(x1) - 1, tr(z1) - 1, axis, ya, yb);
    // v12.1: fri rampe i meter (uafhængig af 2 m-gitteret): ya ved min-kanten af aksen, yb ved max-kanten
    function fRamp(x0, z0, x1, z1, axis, ya, yb) {
      const yLow = Math.min(ya, yb);
      const r = axis === 'x' ? { axis, a0: x0, a1: x1, w0: z0, w1: z1, ya, yb, yBottom: yLow } : { axis, a0: z0, a1: z1, w0: x0, w1: x1, ya, yb, yBottom: yLow };
      const m = (yb - ya) / (r.a1 - r.a0); r.m = m;
      if (axis === 'x') { r.planes = [[-1, 0, 0, -r.a0], [1, 0, 0, r.a1], [0, 0, -1, -r.w0], [0, 0, 1, r.w1], [0, -1, 0, -yLow], [-m, 1, 0, ya - m * r.a0]]; r.bx0 = r.a0; r.bx1 = r.a1; r.bz0 = r.w0; r.bz1 = r.w1; }
      else { r.planes = [[0, 0, -1, -r.a0], [0, 0, 1, r.a1], [-1, 0, 0, -r.w0], [1, 0, 0, r.w1], [0, -1, 0, -yLow], [0, 1, -m, ya - m * r.a0]]; r.bx0 = r.w0; r.bx1 = r.w1; r.bz0 = r.a0; r.bz1 = r.a1; }
      ramps.push(r); return r;
    }
    const H = { boxes, ramps, labels, ladders, cyls, doors, fill, ramp, R, RAMP, fRamp, layer, cX, cZ, groundAtGrid };
    Object.defineProperty(H, 'G', { get: () => cur.grid });

    spec.grid(H);

    /* ---- tiles -> bokse (grådig sammensmeltning pr. lag og tegn) ---- */
    for (const L of layers) {
      const G = L.grid, seen = Array.from({ length: GH }, () => new Array(GW).fill(false));
      for (let r = 0; r < GH; r++) {
        for (let c = 0; c < GW; c++) {
          if (seen[r][c]) continue;
          const ch = G[r][c];
          let c1 = c;
          while (c1 + 1 < GW && !seen[r][c1 + 1] && G[r][c1 + 1] === ch) c1++;
          let r1 = r;
          outer: while (r1 + 1 < GH) {
            for (let k = c; k <= c1; k++) if (seen[r1 + 1][k] || G[r1 + 1][k] !== ch) break outer;
            r1++;
          }
          for (let rr = r; rr <= r1; rr++) for (let cc = c; cc <= c1; cc++) seen[rr][cc] = true;
          const x0 = cX(c), x1 = cX(c1 + 1), z0 = cZ(r), z1 = cZ(r1 + 1), t = L.tiles[ch];
          if (t.void) continue;
          if (t.solid) { boxes.push({ x0, y0: L.yb, z0, x1, y1: t.top !== undefined ? t.top : L.yt, z1, kind: t.kind || 'wall', layer: L.id }); continue; }
          boxes.push({ x0, y0: L.yb, z0, x1, y1: t.floor + (t.sill || 0), z1, kind: t.sill ? 'wall' : 'floor', layer: L.id });
          if (t.lintel !== undefined) boxes.push({ x0, y0: t.floor + t.lintel, z0, x1, y1: t.top !== undefined ? t.top : L.yt, z1, kind: t.lkind || 'wall', layer: L.id, lintel: true });
        }
      }
    }

    /* ================== PROPS & STRUKTURER ================== */
    // kasse centreret i (x,z) med bredde w, dybde d, højde h ovenpå gulvet (eller y0 hvis angivet). style vælger udseende (kollision er altid en boks).
    const prop = (x, z, w, d, h, y0, style, extra) => {
      const b = y0 === undefined ? groundAtGrid(x, z) : y0;
      const o = { x0: x - w / 2, y0: b, z0: z - d / 2, x1: x + w / 2, y1: b + h, z1: z + d / 2, kind: 'prop', style };
      if (extra) Object.assign(o, extra);
      boxes.push(o); return o;
    };
    const wallBox = (x0, z0, x1, z1, y0, y1, kind, extra) => { const o = { x0, y0, z0, x1, y1, z1, kind: kind || 'wall' }; if (extra) Object.assign(o, extra); boxes.push(o); return o; };
    const solid = (x0, z0, x1, z1, y0, y1) => boxes.push({ x0, y0, z0, x1, y1, z1, kind: 'solid' });
    const slab = (x0, z0, x1, z1, top, th, kind, extra) => { const o = { x0, y0: top - (th || 0.4), z0, x1, y1: top, z1, kind: kind || 'slab' }; if (extra) Object.assign(o, extra); boxes.push(o); return o; };
    const roof = (x0, z0, x1, z1, y0, kind) => boxes.push({ x0, y0, z0, x1, y1: WALL_TOP, z1, kind: kind || 'ceil' });
    const pillar = (x, z, w, y0, y1, kind) => boxes.push({ x0: x - w / 2, y0, z0: z - w / 2, x1: x + w / 2, y1, z1: z + w / 2, kind: kind || 'wall' });
    // gelænder: tynd kollisionsboks der IKKE stopper kugler/granater (nb) – tegnes som stolper + håndliste
    const rail = (x0, z0, x1, z1, base, h, style) => boxes.push({ x0, y0: base, z0, x1, y1: base + (h || 1.0), z1, kind: 'rail', nb: true, style });
    // glasrude: massiv for bevægelse, gennemskydelig
    const glass = (x0, z0, x1, z1, y0, y1) => boxes.push({ x0, y0, z0, x1, y1, z1, kind: 'glass', nb: true });
    // cylinder-formet kollision (kors af bokse indskrevet i cirklen); selve cylinderen tegnes af visuals (W.cyls)
    const cyl = (x, z, r, y0, y1, style, extra) => {
      const o = { x, z, r, y0, y1, style }; if (extra) Object.assign(o, extra); cyls.push(o);
      if (r < 1.3) { const a = r * 0.9; solid(x - a, z - a, x + a, z + a, y0, y1); return o; }
      const n = r >= 3 ? 5 : 3;                                                // flere lag = rundere kollision på store tanke
      for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * Math.PI / 2, hx = r * Math.cos(a) * 0.985, hz = r * Math.sin(a) * 0.985; solid(x - hx, z - hz, x + hx, z + hz, y0, y1); }
      return o;
    };
    // stige: lodret klatrevolumen foran en væg. (nx,nz) = vægnormal ud mod spilleren. Klatres med W / ned med S, hop = slip.
    const ladder = (x0, z0, x1, z1, y0, y1, nx, nz) => ladders.push({ x0, z0, x1, z1, y0, y1, nx, nz });
    // massive trapper: n trin fra (x0,z0) til (x1,z1) langs akse; dir=+1 stiger mod +akse. yb = trinenes bund (default yBase-0.5)
    const stairs = (x0, z0, x1, z1, axis, dir, yBase, rise, n, yb, kind) => {
      const len = axis === 'x' ? x1 - x0 : z1 - z0, bot = yb === undefined ? yBase - 0.5 : yb;
      for (let k = 1; k <= n; k++) {
        const s0 = dir > 0 ? (k - 1) * len / n : 0;
        const s1 = dir > 0 ? len : len - (k - 1) * len / n;
        const top = yBase + rise * k / n;
        if (axis === 'x') boxes.push({ x0: x0 + s0, y0: bot, z0, x1: x0 + s1, y1: top, z1, kind: kind || 'stone', stair: true });
        else boxes.push({ x0, y0: bot, z0: z0 + s0, x1, y1: top, z1: z0 + s1, kind: kind || 'stone', stair: true });
      }
    };
    // dør (kun visuel + lyd): svinger op når en spiller kommer tæt på. axis: 'x' = døren ligger langs x (man går igennem langs z)
    const door = (x, z, w, axis, y, o) => doors.push(Object.assign({ x, z, w, axis, y, h: 2.5, kind: 'metal', double: false }, o || {}));

    Object.assign(H, { prop, wallBox, solid, slab, roof, pillar, rail, glass, cyl, ladder, stairs, door });

    spec.props(H);
    const { sites, spawns } = spec.meta(H);
    // v14: usynlig kant rundt om banen (stopper kugler, granater og sigt ud i intet, hvor kulissen kun er visuel) – fundet af test/mapqa.js
    if (spec.ring) {
      const bx0 = GX0 + TILE, bx1 = GX0 + (GW - 1) * TILE, bz0 = GZ0 + TILE, bz1 = GZ0 + (GH - 1) * TILE, T = 1, y0 = -14, y1 = WALL_TOP;
      boxes.push({ x0: bx0 - T, x1: bx1 + T, z0: bz0 - T, z1: bz0, y0, y1, kind: 'bound' }, { x0: bx0 - T, x1: bx1 + T, z0: bz1, z1: bz1 + T, y0, y1, kind: 'bound' },
        { x0: bx0 - T, x1: bx0, z0: bz0, z1: bz1, y0, y1, kind: 'bound' }, { x0: bx1, x1: bx1 + T, z0: bz0, z1: bz1, y0, y1, kind: 'bound' });
    }

    /* ---- kolliderere: bokse + ramper i én liste ---- */
    const colliders = [];
    for (const b of boxes) { const c = { x0: b.x0, y0: b.y0, z0: b.z0, x1: b.x1, y1: b.y1, z1: b.z1, k: b.kind }; if (b.nb) c.nb = true; colliders.push(c); }
    for (const r of ramps) colliders.push({ x0: r.bx0, y0: r.yBottom, z0: r.bz0, x1: r.bx1, y1: Math.max(r.ya, r.yb), z1: r.bz1, r, k: 'ramp' });

    const W = {
      id, name: spec.name, data: spec.data || null, grid: layers[layers.length - 1].grid, layers, boxes, ramps, labels, ladders, cyls, doors, sites, spawns, colliders, deco: H.deco || [],
      levels: spec.LEVELS || {},
      bounds: { x0: GX0 + TILE, x1: GX0 + (GW - 1) * TILE, z0: GZ0 + TILE, z1: GZ0 + (GH - 1) * TILE },
      tile: { TILE, GW, GH, GX0, GZ0 }
    };
    W.cg = buildCGrid(colliders);
    return W;
  }
  function buildWorld(id) {
    if (!MAP_REG[id]) id = 'white_dust';
    return MAP_REG[id]._W || (MAP_REG[id]._W = makeWorld(id));
  }

  /* ---------------------------------------------------------------- rumligt gitter for kolliderere (4 m celler) */
  function buildCGrid(cs) {
    const CS = 4;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const c of cs) { if (c.x0 < x0) x0 = c.x0; if (c.z0 < z0) z0 = c.z0; if (c.x1 > x1) x1 = c.x1; if (c.z1 > z1) z1 = c.z1; }
    x0 = Math.floor(x0 / CS) * CS - CS; z0 = Math.floor(z0 / CS) * CS - CS; x1 = Math.ceil(x1 / CS) * CS + CS; z1 = Math.ceil(z1 / CS) * CS + CS;
    const nx = Math.round((x1 - x0) / CS), nz = Math.round((z1 - z0) / CS);
    const cells = Array.from({ length: nx * nz }, () => []);
    cs.forEach((c, i) => {
      c.i = i;
      const a0 = Math.max(0, Math.floor((c.x0 - x0) / CS)), a1 = Math.min(nx - 1, Math.floor((c.x1 - 1e-9 - x0) / CS));
      const b0 = Math.max(0, Math.floor((c.z0 - z0) / CS)), b1 = Math.min(nz - 1, Math.floor((c.z1 - 1e-9 - z0) / CS));
      for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) cells[b * nx + a].push(c);
    });
    return { cs: CS, x0, z0, x1, z1, nx, nz, cells, mark: new Uint32Array(cs.length), stamp: 0, out: [] };
  }
  // alle kolliderere hvis xz-boks overlapper [x0,x1]x[z0,z1] (genbrugt array – må ikke indlejres)
  function query(W, x0, z0, x1, z1) {
    const G = W.cg, out = G.out; out.length = 0;
    const st = ++G.stamp;
    if (st >= 0xfffffff0) { G.mark.fill(0); G.stamp = 1; }
    const a0 = Math.max(0, Math.floor((x0 - G.x0) / G.cs)), a1 = Math.min(G.nx - 1, Math.floor((x1 - G.x0) / G.cs));
    const b0 = Math.max(0, Math.floor((z0 - G.z0) / G.cs)), b1 = Math.min(G.nz - 1, Math.floor((z1 - G.z0) / G.cs));
    for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) {
      const cell = G.cells[b * G.nx + a];
      for (let i = 0; i < cell.length; i++) { const c = cell[i]; if (G.mark[c.i] !== G.stamp) { G.mark[c.i] = G.stamp; out.push(c); } }
    }
    return out;
  }
  const MAP_LIST = () => Object.keys(MAP_REG).map(id => ({ id, name: MAP_REG[id].name, desc: MAP_REG[id].desc || '' }));

  /* ---------------------------------------------------------------- geometri-hjælpere */
  function rampHeight(r, s) {
    if (s <= r.a0) s = r.a0; else if (s >= r.a1) s = r.a1;
    return r.ya + r.m * (s - r.a0);
  }
  // højeste overflade-Y for collideren inden for fodaftrykket (eller -Infinity hvis ingen overlap)
  function topAt(c, fx0, fx1, fz0, fz1) {
    const ax0 = c.x0 > fx0 ? c.x0 : fx0, ax1 = c.x1 < fx1 ? c.x1 : fx1;
    if (ax1 - ax0 < 1e-6) return -Infinity;
    const az0 = c.z0 > fz0 ? c.z0 : fz0, az1 = c.z1 < fz1 ? c.z1 : fz1;
    if (az1 - az0 < 1e-6) return -Infinity;
    const r = c.r;
    if (!r) return c.y1;
    const h0 = r.axis === 'x' ? rampHeight(r, ax0) : rampHeight(r, az0);
    const h1 = r.axis === 'x' ? rampHeight(r, ax1) : rampHeight(r, az1);
    return h0 > h1 ? h0 : h1;
  }

  /* ---------------------------------------------------------------- spillerfysik */
  function newBody(x, y, z) { return { x, y, z, vx: 0, vy: 0, vz: 0, ground: true, crouch: false, onLadder: false }; }

  function groundAt(W, x, z, feetY, maxUp) {
    const R = PL.R, cs = query(W, x - R, z - R, x + R, z + R);
    let best = -Infinity;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (x + R <= c.x0 || x - R >= c.x1 || z + R <= c.z0 || z - R >= c.z1) continue;
      const t = topAt(c, x - R, x + R, z - R, z + R);
      if (t <= feetY + maxUp && t > best) best = t;
    }
    return best;
  }
  function isBlocked(W, x, z, feetY, H, step) {
    const stp = step === undefined ? PL.STEP : step;
    const R = PL.R, cs = query(W, x - R, z - R, x + R, z + R);
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (x + R <= c.x0 || x - R >= c.x1 || z + R <= c.z0 || z - R >= c.z1) continue;
      if (c.y0 >= feetY + H - 1e-4) continue;
      const t = topAt(c, x - R, x + R, z - R, z + R);
      if (t > feetY + stp + 1e-4) return true;
    }
    return false;
  }
  function ceilingHit(W, x, z, oldTop, newTop) {
    const R = PL.R, cs = query(W, x - R, z - R, x + R, z + R);
    let best = null;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (c.r) continue;
      if (x + R <= c.x0 || x - R >= c.x1 || z + R <= c.z0 || z - R >= c.z1) continue;
      if (c.y0 >= oldTop - 1e-4 && c.y0 < newTop && (best === null || c.y0 < best)) best = c.y0;
    }
    return best;
  }
  function canStand(W, b) {
    const R = PL.R, cs = query(W, b.x - R, b.z - R, b.x + R, b.z + R);
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (c.r) continue;
      if (b.x + R <= c.x0 || b.x - R >= c.x1 || b.z + R <= c.z0 || b.z - R >= c.z1) continue;
      if (c.y0 < b.y + PL.H && c.y1 > b.y + PL.HC && c.y0 >= b.y + PL.HC - 1e-4) return false;
    }
    return true;
  }

  function mantle(W, b, nx, nz, H) {
    const g = groundAt(W, nx, nz, b.y, PL.MANTLE);
    if (g > b.y && g <= b.y + PL.MANTLE + 1e-6 && !isBlocked(W, nx, nz, g, H, 0.02)) { b.x = nx; b.z = nz; b.y = g; b.vy = 0; b.ground = true; return true; }
    return false;
  }
  function ladderAt(W, b) {
    const lads = W.ladders, R = PL.R;
    for (let i = 0; i < lads.length; i++) {
      const l = lads[i];
      if (b.x > l.x0 - R && b.x < l.x1 + R && b.z > l.z0 - R && b.z < l.z1 + R && b.y >= l.y0 - 0.3 && b.y < l.y1 + 0.05) return l;
    }
    return null;
  }
  // øverst på stigen: find et sted at stå (mod væggen, væk fra væggen, til siderne). Nedhukket hvis der kun er plads sådan (ventilationskanaler).
  function ladderExit(W, b, l) {
    const tx = -l.nz, tz = l.nx;
    // kandidater: mod væggen, væk fra væggen, til siderne – og til siderne lidt ud fra væggen (smalle kanaler)
    const cand = [[-l.nx, -l.nz, 0.85], [-l.nx, -l.nz, 1.2], [l.nx, l.nz, 0.85], [l.nx, l.nz, 1.2]];
    for (const s of [1, -1]) for (const d of [0.85, 1.2]) for (const k of [0, 0.35, 0.6]) cand.push([tx * s * d + l.nx * k, tz * s * d + l.nz * k, 1]);
    for (const crouch of [false, true]) {
      const H = crouch ? PL.HC : PL.H;
      for (const [dx, dz, d] of cand) {
        const x = b.x + dx * d, z = b.z + dz * d;
        const g = groundAt(W, x, z, l.y1, 0.05);
        if (Math.abs(g - l.y1) < 0.06 && !isBlocked(W, x, z, l.y1, H, 0.02)) { b.x = x; b.z = z; b.y = g; b.crouch = crouch; return true; }
      }
    }
    return false;
  }

  /* input: {fx, sx, yaw, jump, crouch, walk}  (fx: fremad +1, sx: højre +1) */
  function stepBody(W, b, inp, dt) {
    let left = dt;
    while (left > 1e-6) {
      const h = left > 1 / 90 ? 1 / 90 : left;
      left -= h;
      substep(W, b, inp, h);
    }
  }
  function substep(W, b, inp, dt) {
    if (inp.crouch) b.crouch = true;
    else if (b.crouch && canStand(W, b)) b.crouch = false;
    const H = b.crouch ? PL.HC : PL.H;

    // ---- stiger: W op / S ned mens man vender mod væggen; hop slipper. Falder man ned i en stige-skakt, gribes stigen.
    //      Øverst 'trækkes' man op på kanten (mod væggen, ellers væk fra den/til siden – nedhukket hvis der kun er plads sådan).
    if (b.ladderCD > 0) b.ladderCD -= dt;
    if (b.noGrab && b.ground) b.noGrab = false;                 // efter et hop af stigen gribes den ikke igen før man har landet
    if (W.ladders.length) {
      const lad = ladderAt(W, b), fwd = inp.fx || 0;
      if (lad && !(b.ladderCD > 0)) {
        const facing = -Math.sin(inp.yaw) * -lad.nx + -Math.cos(inp.yaw) * -lad.nz;      // >0: kigger mod væggen
        if (b.onLadder && inp.jump) { b.onLadder = false; b.ladderCD = 0.45; b.noGrab = true; b.vy = 3; b.vx = lad.nx * 3.2; b.vz = lad.nz * 3.2; b.ground = false; }
        else if (b.onLadder || (fwd > 0 && facing > 0.35 && b.y < lad.y1 - 0.05) || (!b.ground && !b.noGrab && b.vy <= 0 && b.y < lad.y1 - 0.01)) {
          if (!b.onLadder && !b.ground) b.ladderHold = 0.35;        // greb stigen i faldet (fra toppen): hæng et øjeblik før man kan klatre op igen
          b.onLadder = true; b.ground = false; b.vx = 0; b.vz = 0; b.vy = 0;
          const k = Math.min(1, 12 * dt);
          if (lad.nz) { b.z += ((lad.nz > 0 ? lad.z0 + R0 : lad.z1 - R0) - b.z) * k; b.x += (Math.min(lad.x1 - 0.12, Math.max(lad.x0 + 0.12, b.x)) - b.x) * k; }
          else { b.x += ((lad.nx > 0 ? lad.x0 + R0 : lad.x1 - R0) - b.x) * k; b.z += (Math.min(lad.z1 - 0.12, Math.max(lad.z0 + 0.12, b.z)) - b.z) * k; }
          // som i CS: W klatrer op når man kigger mod stigen, ned når man kigger væk; S omvendt
          let climb = (fwd > 0 ? 1 : fwd < 0 ? -1 : 0) * (facing >= -0.2 ? 1 : -1);
          if (b.ladderHold > 0) { b.ladderHold -= dt; if (climb > 0) climb = 0; }
          b.y += climb * PL.CLIMB * dt;
          if (b.y >= lad.y1) {                       // top: ud på kanten
            b.y = lad.y1;
            if (ladderExit(W, b, lad)) { b.onLadder = false; b.ground = true; b.vy = 0; }
          } else if (b.y <= lad.y0) { b.y = lad.y0; b.onLadder = false; b.ground = true; }
          return;
        }
      } else if (!lad) b.onLadder = false;
    }

    let fx = inp.fx || 0, sx = inp.sx || 0;
    const len = Math.hypot(fx, sx);
    if (len > 1) { fx /= len; sx /= len; }
    const sy = Math.sin(inp.yaw), cy = Math.cos(inp.yaw);
    let wx = -sy * fx + cy * sx, wz = -cy * fx - sy * sx;
    const wl = Math.hypot(wx, wz);
    const spd = (b.crouch ? PL.CROUCH : (inp.walk ? PL.WALK : PL.RUN)) * (inp.spd || 1);
    if (wl > 1e-6) { wx /= wl; wz /= wl; }
    const wish = wl > 1e-6 ? spd * Math.min(1, wl) : 0;
    if (b.ground) {
      // friktion (Source: under stopspeed bremses med konstant kraft => man står helt stille kort efter at have sluppet tasterne)
      const sp = Math.hypot(b.vx, b.vz);
      if (sp > 1e-4) {
        const drop = (sp < PL.STOP ? PL.STOP : sp) * PL.FRIC * dt, ns = sp - drop > 0 ? (sp - drop) / sp : 0;
        b.vx *= ns; b.vz *= ns;
      }
      if (wish > 0) accelerate(b, wx, wz, wish, PL.ACC * wish * dt);
    } else if (wish > 0) {
      // air-strafe: kun en lille 'ønsket' fart (AIRCAP), men høj acceleration => man kan styre/kurve i luften som i CS
      accelerate(b, wx, wz, Math.min(wish, PL.AIRCAP), PL.AIRACC * wish * dt);
      const hs = Math.hypot(b.vx, b.vz), cap = spd * PL.AIRMAX;
      if (hs > cap) { b.vx *= cap / hs; b.vz *= cap / hs; }
    }

    if (inp.jump && b.ground && !b.crouch) { b.vy = PL.JUMP; b.ground = false; }

    // i luften må man IKKE gå ind i en kasse (gammel bug: fast inde i geometrien) — i stedet 'mantles' man op på kanter <= STEP over fødderne
    const st = b.ground ? PL.STEP : 0.02;
    const nx = b.x + b.vx * dt;
    if (!isBlocked(W, nx, b.z, b.y, H, st)) b.x = nx;
    else if (!(b.ground && nudge(W, b, nx, b.z, 'z', b.vx * dt, H, st)) && (b.ground || !mantle(W, b, nx, b.z, H))) b.vx = 0;
    const nz = b.z + b.vz * dt;
    if (!isBlocked(W, b.x, nz, b.y, H, st)) b.z = nz;
    else if (!(b.ground && nudge(W, b, b.x, nz, 'x', b.vz * dt, H, st)) && (b.ground || !mantle(W, b, b.x, nz, H))) b.vz = 0;

    if (b.ground) {
      const g = groundAt(W, b.x, b.z, b.y, PL.STEP);
      if (g >= b.y - PL.SNAP) { b.y = g; b.vy = 0; } else { b.ground = false; }
    }
    if (!b.ground) {
      b.vy -= PL.GRAV * dt;
      const ny = b.y + b.vy * dt;
      if (b.vy <= 0) {
        const g = groundAt(W, b.x, b.z, b.y, 0.02);
        if (ny <= g) { b.y = g; b.vy = 0; b.ground = true; } else b.y = ny;
      } else {
        const ch = ceilingHit(W, b.x, b.z, b.y + H, ny + H);
        if (ch !== null) { b.y = ch - H; b.vy = 0; } else b.y = ny;
      }
    }
  }
  const R0 = PL.R + 0.05;
  // Source-acceleration: læg fart til i ønsket retning, men aldrig ud over 'wish' (projektionen på retningen)
  function accelerate(b, wx, wz, wish, accel) {
    const cur = b.vx * wx + b.vz * wz, add = wish - cur;
    if (add <= 0) return;
    const a = accel < add ? accel : add;
    b.vx += a * wx; b.vz += a * wz;
  }
  // hjørne-glid: bevægelsen langs én akse er blokeret – er det kun en kant (dørkarm, kassehjørne) med lille overlap,
  // skubbes spilleren blødt ud til siden (den anden akse), så man glider rundt om den i stedet for at hænge fast
  function nudge(W, b, nx, nz, side, mv, H, st) {
    const am = Math.abs(mv); if (am < 1e-5) return false;
    const pref = side === 'z' ? b.vz : b.vx;
    const dirs = pref > 0.05 ? [1, -1] : pref < -0.05 ? [-1, 1] : [1, -1];
    for (let o = 0.04; o <= PL.NUDGE + 1e-6; o += 0.04) {
      for (const sg of dirs) {
        const ox = side === 'x' ? sg * o : 0, oz = side === 'z' ? sg * o : 0;
        if (!isBlocked(W, nx + ox, nz + oz, b.y, H, st) && !isBlocked(W, b.x + ox, b.z + oz, b.y, H, st)) {
          const k = Math.min(o, am * 1.2) / o;            // aldrig hurtigere sidelæns end man bevæger sig fremad
          if (side === 'x') b.x += ox * k; else b.z += oz * k;
          return true;
        }
      }
    }
    return false;
  }

  /* ---------------------------------------------------------------- raycasts */
  function rayAABB(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1, out) {
    let tmin = -Infinity, tmax = Infinity, nx = 0, ny = 0, nz = 0;
    if (Math.abs(dx) < 1e-12) { if (ox < x0 || ox > x1) return Infinity; }
    else {
      let t1 = (x0 - ox) / dx, t2 = (x1 - ox) / dx, s = -1;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; s = 1; }
      if (t1 > tmin) { tmin = t1; nx = s; ny = 0; nz = 0; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return Infinity;
    }
    if (Math.abs(dy) < 1e-12) { if (oy < y0 || oy > y1) return Infinity; }
    else {
      let t1 = (y0 - oy) / dy, t2 = (y1 - oy) / dy, s = -1;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; s = 1; }
      if (t1 > tmin) { tmin = t1; nx = 0; ny = s; nz = 0; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return Infinity;
    }
    if (Math.abs(dz) < 1e-12) { if (oz < z0 || oz > z1) return Infinity; }
    else {
      let t1 = (z0 - oz) / dz, t2 = (z1 - oz) / dz, s = -1;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; s = 1; }
      if (t1 > tmin) { tmin = t1; nx = 0; ny = 0; nz = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return Infinity;
    }
    if (tmax < 0) return Infinity;
    if (tmin < 0) { if (out) { out.nx = -dx; out.ny = -dy; out.nz = -dz; } return 0; }
    if (out) { out.nx = nx; out.ny = ny; out.nz = nz; }
    return tmin;
  }
  function rayRamp(ox, oy, oz, dx, dy, dz, r, out) {
    let tEnter = -Infinity, tExit = Infinity, en = null;
    const P = r.planes;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      const denom = p[0] * dx + p[1] * dy + p[2] * dz;
      const num = p[3] - (p[0] * ox + p[1] * oy + p[2] * oz);
      if (Math.abs(denom) < 1e-12) { if (num < 0) return Infinity; continue; }
      const t = num / denom;
      if (denom < 0) { if (t > tEnter) { tEnter = t; en = p; } }
      else if (t < tExit) tExit = t;
      if (tEnter > tExit) return Infinity;
    }
    if (tExit < 0) return Infinity;
    if (tEnter < 0) { if (out) { out.nx = -dx; out.ny = -dy; out.nz = -dz; } return 0; }
    if (out && en) {
      const l = Math.hypot(en[0], en[1], en[2]) || 1;
      out.nx = en[0] / l; out.ny = en[1] / l; out.nz = en[2] / l;
    }
    return tEnter;
  }
  const _tmpN = { nx: 0, ny: 1, nz: 0 };
  // Nærmeste træf mod verdenen (gelændere/glas 'nb' ignoreres – kugler går igennem). Returnerer t; maxT (eller Infinity) ved intet træf.
  // 2D-DDA gennem kollisionsgitteret: kun celler langs strålen testes.
  function raycastWorld(W, ox, oy, oz, dx, dy, dz, maxT, out, all) {
    let best = maxT === undefined ? Infinity : maxT;
    const G = W.cg, CS = G.cs, tmp = out ? _tmpN : null;
    const st = ++G.stamp;
    if (st >= 0xfffffff0) { G.mark.fill(0); G.stamp = 1; }
    let t0 = 0, t1 = Math.min(best, 1000);
    if (Math.abs(dx) < 1e-12) { if (ox < G.x0 || ox > G.x1) return best; }
    else { let a = (G.x0 - ox) / dx, b = (G.x1 - ox) / dx; if (a > b) { const t = a; a = b; b = t; } if (a > t0) t0 = a; if (b < t1) t1 = b; }
    if (Math.abs(dz) < 1e-12) { if (oz < G.z0 || oz > G.z1) return best; }
    else { let a = (G.z0 - oz) / dz, b = (G.z1 - oz) / dz; if (a > b) { const t = a; a = b; b = t; } if (a > t0) t0 = a; if (b < t1) t1 = b; }
    if (t0 > t1) return best;
    let cx = Math.floor((ox + dx * t0 - G.x0) / CS), cz = Math.floor((oz + dz * t0 - G.z0) / CS);
    if (cx < 0) cx = 0; else if (cx >= G.nx) cx = G.nx - 1;
    if (cz < 0) cz = 0; else if (cz >= G.nz) cz = G.nz - 1;
    const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    let tMaxX = Math.abs(dx) < 1e-12 ? Infinity : (G.x0 + (cx + (dx > 0 ? 1 : 0)) * CS - ox) / dx;
    let tMaxZ = Math.abs(dz) < 1e-12 ? Infinity : (G.z0 + (cz + (dz > 0 ? 1 : 0)) * CS - oz) / dz;
    const tDX = Math.abs(dx) < 1e-12 ? Infinity : CS / Math.abs(dx), tDZ = Math.abs(dz) < 1e-12 ? Infinity : CS / Math.abs(dz);
    let tCell = t0;
    for (let guard = 0; guard < 4096; guard++) {
      if (tCell > best) break;
      const cell = G.cells[cz * G.nx + cx];
      for (let i = 0; i < cell.length; i++) {
        const c = cell[i];
        if (G.mark[c.i] === G.stamp) continue;
        G.mark[c.i] = G.stamp;
        if (c.nb && !all) continue;
        let t = rayAABB(ox, oy, oz, dx, dy, dz, c.x0, c.y0, c.z0, c.x1, c.y1, c.z1, tmp);
        if (t >= best) continue;
        if (c.r) { t = rayRamp(ox, oy, oz, dx, dy, dz, c.r, tmp); if (t >= best) continue; }
        best = t;
        if (out) { out.nx = tmp.nx; out.ny = tmp.ny; out.nz = tmp.nz; out.c = c; }
      }
      if (tMaxX < tMaxZ) { cx += sx; tCell = tMaxX; tMaxX += tDX; } else { cz += sz; tCell = tMaxZ; tMaxZ += tDZ; }
      if (cx < 0 || cx >= G.nx || cz < 0 || cz >= G.nz || tCell > t1) break;
    }
    return best;
  }
  function losClear(W, x0, y0, z0, x1, y1, z1) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-6) return true;
    const maxT = d - 0.02;
    // "clear" means nothing was hit strictly before maxT (raycastWorld returns maxT itself, not
    // Infinity, when the ray is unobstructed within range — see raycastWorld's `best` init).
    return raycastWorld(W, x0, y0, z0, dx / d, dy / d, dz / d, maxT) >= maxT - 1e-6;
  }

  /* ---------------------------------------------------------------- spiller-hitbokse */
  const HB = { legs: [0, 0.42, 0.24], torso: [0.42, 0.82, 0.30], head: [0.82, 1.0, 0.19] };
  function rayPlayer(ox, oy, oz, dx, dy, dz, px, py, pz, crouch, maxT) {
    const H = crouch ? PL.HC : PL.H;
    let best = maxT === undefined ? Infinity : maxT, part = null;
    for (const name in HB) {
      const b = HB[name];
      const t = rayAABB(ox, oy, oz, dx, dy, dz, px - b[2], py + b[0] * H, pz - b[2], px + b[2], py + b[1] * H, pz + b[2], null);
      if (t < best) { best = t; part = name; }
    }
    return part ? { t: best, part } : null;
  }

  function siteAt(W, x, y, z) {
    for (const k in W.sites) {
      const s = W.sites[k];
      if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1 && Math.abs(y - s.y) < 0.9) return k;
    }
    return null;
  }

  // stående i site-zonens bounding box (uanset højde) – bruges til fejlbeskeden "kan ikke plante her"
  function inSiteBox(W, x, y, z) {
    for (const k in W.sites) { const s = W.sites[k]; if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1 && y > s.y - 0.9 && y < s.y + 3.2) return k; }
    return null;
  }
  // C4 må kun plantes på flad, åben sitegulv-overflade: ikke oppe på props, ikke ved/under kanter, ikke tæt på geometri (ellers usynlig/ikke-desarmerbar)
  const _pn = { nx: 0, ny: 0, nz: 0, c: null };
  function plantSpot(W, x, y, z) {
    const k = siteAt(W, x, y, z); if (!k) return null;
    const s = W.sites[k];
    if (Math.abs(y - s.y) > 0.06) return null;                                   // kun på selve site-gulvet
    const g = groundAt(W, x, z, y, 0.05);
    if (Math.abs(g - s.y) > 0.02) return null;                                   // fodaftrykket hviler helt på gulvet
    // strengt raycast-tjek: lodrette stråler (midten + fodaftrykkets hjørner) skal ramme selve banens GULV (tile-gulv) i site-højde –
    // ikke en kasse, en platform, en trappe eller en væg
    for (const [ox, oz] of [[0, 0], [-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) {
      _pn.c = null;
      const t = raycastWorld(W, x + ox, y + 0.9, z + oz, 0, -1, 0, 1.6, _pn, true);
      if (t >= 1.6 || !_pn.c || _pn.c.k !== 'floor' || Math.abs(y + 0.9 - t - s.y) > 0.02) return null;
    }
    if (isBlocked(W, x, z, y, PL.H, 0.02)) return null;                           // inde i en væg
    if (raycastWorld(W, x, y + 0.05, z, 0, 1, 0, 1.0) < 0.95) return null;       // lav overligger/loft lige over bomben
    for (let a = 0; a < 8; a++) {                                                // kanter/huller: ring af prøvepunkter skal også være sitegulv
      const px = x + Math.cos(a * 0.785) * 0.5, pz = z + Math.sin(a * 0.785) * 0.5;
      if (Math.abs(groundAt(W, px, pz, y, 0.05) - s.y) > 0.02) return null;
    }
    const R = 0.5, cs = query(W, x - R, z - R, x + R, z + R);
    for (const c of cs) {
      if (c.r) continue;
      if (x + R <= c.x0 || x - R >= c.x1 || z + R <= c.z0 || z - R >= c.z1) continue;
      if (c.y1 > s.y + 0.03 && c.y0 < s.y + 0.8) return null;                    // prop/væg i bombens rum
    }
    return k;
  }

  /* ---------------------------------------------------------------- ild (molotov / brandgranat)
     Zonen er en 3D-polygon på gulvet: FIRE.N stråler ud fra centrum, hver stopper ved vægge/props (ilden kryber ikke op på kasser)
     og ved kanter/huller i gulvet. Server og klient beregner præcis samme polygon (deterministisk). */
  const FIRE = { R: 3.5, N: 20, DUR: 7, DPS: 15 };
  function fireZone(W, x, y, z) {
    const rad = new Array(FIRE.N);
    for (let i = 0; i < FIRE.N; i++) {
      const a = i / FIRE.N * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
      const tw = raycastWorld(W, x, y + 0.25, z, dx, 0, dz, FIRE.R);
      const lim = Math.min(FIRE.R, tw - 0.08);
      let r = lim;
      for (let s = 0.25; s <= lim + 1e-6; s += 0.25) {
        const g = groundAt(W, x + dx * s, z + dz * s, y + 0.3, 0.2);
        if (g === -Infinity || Math.abs(g - y) > 0.55) { r = s - 0.25; break; }
      }
      rad[i] = Math.max(0.35, r);
    }
    return { x, y, z, rad };
  }
  function fireRadiusAt(zone, a) {
    const N = zone.rad.length, f = ((a / (Math.PI * 2)) % 1 + 1) % 1 * N, i = Math.floor(f) % N, j = (i + 1) % N, t = f - Math.floor(f);
    return zone.rad[i] + (zone.rad[j] - zone.rad[i]) * t;
  }
  function inFire(zone, x, y, z) {
    if (y < zone.y - 0.45 || y > zone.y + 0.9) return false;
    const dx = x - zone.x, dz = z - zone.z, d = Math.hypot(dx, dz);
    if (d > FIRE.R + PL.R) return false;
    return d <= fireRadiusAt(zone, Math.atan2(dz, dx)) + PL.R * 0.6;
  }
  // gulv under et punkt (til ild-placering): højeste flade inden for 'down' meter nedenfor
  function floorBelow(W, x, y, z, down) {
    const t = raycastWorld(W, x, y + 0.05, z, 0, -1, 0, (down || 4) + 0.05);
    return t >= (down || 4) + 0.05 ? null : y + 0.05 - t;
  }

  /* ---------------------------------------------------------------- flashbang: blændings-varighed for en spiller
     (sigtelinje kræves; varighed afhænger af vinkel mellem blik og eksplosion + afstand). Smoke-skyer blokerer sigtelinjen. */
  const FLASH = { R: 60, FULL: 3.5, MIN: 0.6, VIEW: 0.55 };   // VIEW: cos(≈57°) – inden for skærmens synsfelt
  function segHitsSphere(ax, ay, az, bx, by, bz, cx, cy, cz, r) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, L2 = dx * dx + dy * dy + dz * dz || 1e-9;
    let t = ((cx - ax) * dx + (cy - ay) * dy + (cz - az) * dz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = ax + dx * t - cx, py = ay + dy * t - cy, pz = az + dz * t - cz;
    return px * px + py * py + pz * pz < r * r;
  }
  // eye = [x,y,z], yaw/pitch = blikretning; smokes = [{x,y,z,r}] → { dur, full } eller null
  function flashAmount(W, fx, fy, fz, eye, yaw, pitch, smokes) {
    const dx = fx - eye[0], dy = fy - eye[1], dz = fz - eye[2], d = Math.hypot(dx, dy, dz);
    if (d > FLASH.R) return null;
    if (d > 0.3 && !losClear(W, fx, fy, fz, eye[0], eye[1], eye[2])) return null;
    if (smokes) for (const s of smokes) if (segHitsSphere(fx, fy, fz, eye[0], eye[1], eye[2], s.x, s.y, s.z, s.r)) return null;
    const cp = Math.cos(pitch), vx = -Math.sin(yaw) * cp, vy = Math.sin(pitch), vz = -Math.cos(yaw) * cp;
    const dot = d < 0.3 ? 1 : (vx * dx + vy * dy + vz * dz) / d;
    // v13: afstanden betyder ikke noget – kan du SE granaten (inden for synsfeltet og fri sigtelinje), bliver skærmen helt hvid.
    //      Kigger du væk, afhænger det kun af vinklen (set ud af øjenkrogen = kortere, bagved = kun et kort glimt).
    if (dot >= FLASH.VIEW) return { dur: FLASH.FULL, full: true };
    const look = dot <= -0.3 ? 0 : (dot + 0.3) / (FLASH.VIEW + 0.3);
    return { dur: Math.max(0.35, FLASH.MIN + (FLASH.FULL * 0.6 - FLASH.MIN) * look * look), full: false };
  }

  /* ================================================================ BANERNE ================================================================ */
  defineMaps(MAP_REG, { TILE, BASE, WALL_TOP });

  return {
    PL, HIT_MUL, plantSpot, inSiteBox, WEAPONS, WEAPON_BY_CODE, HB, sidePistol, SPEED, speedOf, ECON, killReward, lossBonus,
    NADES, NADE_MAX, NADE_TYPE, NADE_BY_TYPE, nadeCount, canTakeNade, BUY, canBuy, THROW, throwVel, SPRAY, sprayAt,
    FIRE, fireZone, fireRadiusAt, inFire, floorBelow, FLASH, flashAmount, segHitsSphere,
    get MAP_LIST() { return MAP_LIST(); },
    buildWorld, newBody, stepBody, groundAt, isBlocked, canStand, ladderAt, query,
    raycastWorld, losClear, rayAABB, rayPlayer, siteAt, rampHeight, topAt
  };

  /* ---------------------------------------------------------------- kort-definitioner (funktionserklæringer => hoisted) */
  function defineMaps(REG, K) {
    REG.white_dust = mapWhiteDust(K);
    REG.nuke = mapNuke(K);
    if (ANCIENT_DATA) REG.ancient = mapAncient(K);
    if (INFERNO_DATA) REG.inferno = mapInferno(K);
    if (HAVN_DATA) REG.havn = mapHavn(K);
    if (CANALS_DATA) REG.canals = mapCanals(K);
  }

  function mapWhiteDust() {
    return {
    id: 'white_dust', desc: 'Ørkenby i eftermiddagssol · Mid med ruinhus, Catwalk, Long A, Pit og tunneler · balkoner og broer.',
    name: 'White Dust', GW: 44, GH: 52, GX0: -44, GZ0: -52, LEVELS: { '.': 0, a: 1.2, b: -0.8, p: -1.8 },
    grid(H) {
      const { fill, ramp } = H;
    // CT-spawn (SWAT) øverst i midten
    fill(16, 2, 27, 12, '.');
    // Mid-døre (to åbninger med en søjle imellem) + Mid
    fill(19, 13, 20, 13, '.');                // Mid-døren (kun den vestlige – ingen lige linje CT ↔ T)
    fill(19, 14, 24, 39, '.');
    fill(19, 39, 22, 39, '#');                // T-siden kommer kun ind i Mid i øst (x 2..6)
    fill(21, 27, 23, 31, '#');                // ruinhus midt i Mid (x -2..4, z 2..12) – bryder sigtelinjen
    // T-spawn (Hijackers) nederst
    fill(13, 40, 30, 49, '.');
    // A site (ophøjet plateau)
    fill(30, 2, 42, 12, 'a');
    // B site (sænket)
    fill(2, 2, 13, 12, 'b');
    // Lower Tunnels (fra Mid mod vest) og Upper Tunnels (langs vestkanten)
    fill(8, 27, 18, 31, '.');
    fill(4, 15, 7, 47, '.');
    fill(8, 42, 12, 47, '.');      // T-spawn → tunnels
    // Catwalk (Short A): åbning fra Mid, så nordpå
    fill(25, 20, 29, 25, '.');
    fill(30, 15, 32, 26, '.');
    // Long A: fra T-spawn mod øst og så nordpå
    fill(31, 42, 39, 47, '.');
    fill(35, 15, 39, 46, '.');
    // Pit (sænket område ved enden af Long A)
    fill(40, 17, 42, 22, 'p');
    // Ramper
    ramp(28, 5, 29, 8, 'x', 0, 1.2);      // CT -> A site
    ramp(14, 5, 15, 8, 'x', -0.8, 0);     // CT -> B site  ("B door")
    ramp(4, 13, 7, 14, 'z', -0.8, 0);     // Tunnels -> B site
    ramp(30, 13, 32, 14, 'z', 1.2, 0);    // Catwalk -> A site
    ramp(35, 13, 39, 14, 'z', 1.2, 0);    // Long A -> A site
    ramp(37, 19, 39, 21, 'x', 0, -1.8);   // Long A -> Pit
    // v4: snørklet 'Sewer Alley' fra Lower Tunnels op til B (zig-zag) + døråbninger mellem Catwalk-passage og Long A
    fill(14, 23, 14, 26, '.'); fill(10, 23, 14, 23, '.'); fill(10, 17, 10, 23, '.'); fill(10, 17, 13, 17, '.'); fill(12, 15, 13, 16, '.');
    ramp(12, 13, 13, 14, 'z', -0.8, 0);   // Alley -> B
    fill(33, 17, 34, 17, 'w'); fill(33, 23, 34, 23, 'w'); fill(33, 20, 34, 20, '.');
    // Closets
    fill(38, 5, 42, 5, '#'); fill(37, 2, 37, 3, '#');           // A-closet (dør ved række 4)
    fill(6, 2, 6, 3, '#'); fill(2, 6, 6, 6, '#');               // B-closet (dør ved række 4-5)
    // B-vindue (lav karm + overligger)
    fill(14, 10, 15, 11, 'w');


    },
    props(H) {
      const { prop, wallBox, boxes, stairs } = H;
    // -- T-spawn
    // v11.2: amforaer og lerkrukker op ad murene (fotoscannede modeller, rigtig kollision) – placeret automatisk hvor der er plads
    for (const [x, y, z] of [[-39.62, -0.8, -37.5], [-35.62, 0, 24.5], [-15.5, 0, 28.38], [2.5, 0, -47.62], [16.38, 1.2, -33.5], [26.38, 0, 20.5], [-11.62, 0, -33.5]]) prop(x, z, 0.7, 0.7, 1.05, y, 'amphora');
    for (const [x, y, z, w, d] of [[-25.5, 0, 32.3, 1.0, 0.55], [6.5, 0, -11.7, 1.0, 0.55], [26.3, 0, -9.5, 0.55, 1.0], [38.5, 1.2, -39.7, 1.0, 0.55]]) prop(x, z, w, d, 0.65, y, 'jars');
    prop(-14, 46, 3, 3, 1.5); prop(-14, 43, 1.5, 1.5, 1.0);
    prop(14, 46, 3, 3, 1.5);  prop(14.5, 43, 1.5, 1.5, 1.0);
    prop(-9, 34, 2, 4, 1.5);  prop(9, 34, 2, 4, 1.5);
    prop(0, 30, 2, 2, 1.0);
    // -- Mid
    prop(0, 15.5, 3, 3, 1.5);         // "Xbox" (foran ruinhuset)
    prop(-4, -6, 2, 2, 1.0);
    prop(3.5, 16, 2, 2, 1.0);
    prop(-4.5, 22, 1.5, 1.5, 1.0);
    prop(0, -21, 1.6, 1.6, 1.5);      // foran Mid-dørene
    // -- Catwalk
    prop(19, -8, 2, 2, 1.0);
    prop(13, -4, 2, 2, 1.5);
    prop(8.5, -10, 1.5, 1.5, 1.0);
    // -- Long A
    wallBox(26, 8, 29, 10, BASE, 6);  // "Long doors"
    wallBox(33, 8, 36, 10, BASE, 6);
    prop(27.2, -2, 2.4, 8, 2.6);      // container
    prop(27.5, -12, 2, 2, 1.5);
    prop(28.2, -17, 1.5, 1.5, 1.0);
    prop(33.5, -19, 2, 2, 1.0);
    prop(33, 22, 2, 2, 1.0);
    prop(29.5, 32, 2, 2, 1.5);
    prop(22, 38, 2, 2, 1.5);
    // -- CT-spawn
    prop(-8, -36, 3, 3, 1.5); prop(8, -36, 3, 3, 1.5);
    prop(0, -29, 4, 1, 1.0);
    prop(-10, -44, 2, 2, 1.0);
    // -- A site (gulv y=1.2)
    prop(30, -34, 3, 3, 1.5);         // "Default"
    prop(30, -30.5, 1.5, 1.5, 1.0);
    prop(38, -29, 3, 3, 1.5);         // "Goose"
    wallBox(18, -45, 27, -41, 1.2, 3.4); // Ninja-blokken (der er et hul bagved)
    prop(38, -36, 5, 5, 0.8);         // lav platform
    prop(22, -32, 2, 2, 1.0);
    prop(24, -27.5, 1.5, 1.5, 1.5);
    // -- B site (gulv y=-0.8)
    prop(-24, -36, 3, 3, 1.5);
    prop(-24, -32.5, 1.5, 1.5, 1.0);
    prop(-37, -32, 6, 8, 1.2);        // "Back plat"
    stairs(-34, -34, -31, -30, 'x', -1, -0.8, 1.2, 3);
    prop(-20, -44, 2, 2, 1.5);
    // -- v3 ekstra taktiske props (solide, delt mellem server og klient)
    prop(-11, -30, 1.6, 1.6, 1.0);
    prop(10.5, -41, 1.5, 1.5, 1.0);
    prop(-4.8, 16, 0.6, 3, 0.9);      // lav betonbarriere i Mid
    prop(24, -38, 4, 0.8, 0.9);       // sandsække-række på A
    prop(-6, 38, 2, 1, 1.0);
    prop(27, 36, 6, 0.6, 1.0);        // lav betonmur (klar collision, kan hoppes over)
    /* ============ v4: etager, trapper, balkoner, døråbninger ============ */
    const slab = (x0, z0, x1, z1, top, th) => boxes.push({ x0, y0: top - (th || 0.4), z0, x1, y1: top, z1, kind: 'slab' });
    const { rail } = H;                // gelændere (kugler går igennem)
    const pillar = (x, z, w, y0, y1) => boxes.push({ x0: x - w / 2, y0, z0: z - w / 2, x1: x + w / 2, y1, z1: z + w / 2, kind: 'wall' });
    // Mid Balcony (y=3.2) på vestsiden af Mid + trappe op fra nord
    stairs(-6, -19, -3.6, -14, 'z', 1, 0, 3.2, 8);
    slab(-6, -14, -3, 0, 3.2);
    rail(-3.2, -14, -3, -9, 3.2); rail(-3.2, -7, -3, 0, 3.2); rail(-6, -0.2, -3.2, 0, 3.2);
    pillar(-3.5, -12, 0.8, 0, 2.8); pillar(-3.5, -2, 0.8, 0, 2.8);
    // Bro over Mid (y=3.2) til Catwalk-loftet
    slab(-3, -9, 8, -7, 3.2);
    rail(-3, -9, 8, -8.8, 3.2); rail(-3, -7.2, 8, -7, 3.2);
    slab(8, -12, 16, -5, 3.2);
    rail(8, -5.2, 14, -5, 3.2); rail(15.8, -12, 16, -5, 3.2); rail(8, -12, 8.2, -9, 3.2); rail(8, -7, 8.2, -5, 3.2);
    pillar(10, -5.4, 0.8, 0, 2.8); pillar(15.6, -11.6, 0.8, 0, 2.8);
    stairs(14, -5, 16, 0, 'z', -1, 0, 3.2, 8);          // trappe ned til Catwalk
    // B-galleri (y=2.8) langs B-sitets sydkant + trappe
    stairs(-24, -30, -19, -28, 'x', -1, -0.8, 3.6, 9);
    slab(-38, -30, -24, -26, 2.8);
    rail(-38, -30, -24, -29.8, 2.8); rail(-38, -30, -37.8, -26, 2.8);
    pillar(-36, -29.6, 0.6, -0.8, 2.4); pillar(-30, -29.6, 0.6, -0.8, 2.4);
    // Ninja-platform: trappe op på blokken (A-site)
    stairs(27, -44, 31, -42, 'x', -1, 1.2, 2.2, 6);
    // Overligger (buer) over døråbninger
    wallBox(-6, -26, -2, -24, 3.6, WALL_TOP);                                             // Mid-døren
    wallBox(22, -12, 26, -10, 3.6, WALL_TOP);                                             // Catwalk <-> Long A
    wallBox(-16, -2, -14, 0, 3.4, WALL_TOP); wallBox(-20, -18, -18, -16, 3.4, WALL_TOP);   // Sewer Alley
    // Ruiner, søjler og brudte mure
    pillar(-4, 36, 1.0, 0, 3.6); pillar(4, 36, 1.0, 0, 3.6); wallBox(-4.5, 35.5, -1.5, 36.5, 2.6, 3.6);   // ruin-port i T-spawn
    wallBox(26, 22, 27.6, 26, 0, 2.2); wallBox(34.4, 30, 36, 33, 0, 1.4);                                 // brudte mure i Long A
    wallBox(-22, 9.5, -17, 10.1, 0, 1.6);                                                                 // lav mur i Lower Tunnels
    // -- Tunnels
    wallBox(-36, -4, -28, 14, 3.4, WALL_TOP);   // tag over Upper Tunnels
    wallBox(-28, 2, -6, 12, 3.4, WALL_TOP);     // tag over Lower Tunnels
    prop(-33, 30, 2, 2, 1.5);
    prop(-30, 20, 2, 2, 1.0);
    prop(-16, 7, 2, 2, 1.5);
    prop(-11, 4, 1.5, 1.5, 1.0);
    prop(-32, 42, 2, 2, 1.0);
    prop(-22, 38, 2, 2, 1.5);


    },
    meta(H) {
      const { labels } = H;
    /* ---- gulvtekster / callouts ---- */
    labels.push({ text: 'A', x: 30, z: -34, y: 1.2, size: 9, kind: 'site' });
    labels.push({ text: 'B', x: -24.5, z: -37, y: -0.8, size: 9, kind: 'site' });
    labels.push({ text: 'MID', x: 0, z: 22, y: 0, size: 3.2 });
    labels.push({ text: 'MID', x: 0, z: -12, y: 0, size: 3.2 });
    labels.push({ text: 'LONG A', x: 31, z: 22, y: 0, size: 3.2 });
    labels.push({ text: 'CATWALK', x: 19, z: -14, y: 0, size: 2.4 });
    labels.push({ text: 'TUNNELS', x: -32, z: 34, y: 0, size: 2.6 });
    labels.push({ text: 'LOWER', x: -17, z: 10, y: 0, size: 2.2 });
    labels.push({ text: 'PIT', x: 39, z: -12, y: -1.8, size: 3 });
    labels.push({ text: 'SWAT SPAWN', x: 0, z: -40, y: 0, size: 3.2 });
    labels.push({ text: 'HIJACKER SPAWN', x: 0, z: 39, y: 0, size: 3 });
    labels.push({ text: 'NINJA', x: 22, z: -46.5, y: 1.2, size: 1.8 });
    labels.push({ text: 'CLOSET', x: -36, z: -44, y: -0.8, size: 2 });
    labels.push({ text: 'CLOSET', x: 37, z: -45, y: 1.2, size: 2 });

    const sites = {
      A: { x0: 22, z0: -40, x1: 38, z1: -28, y: 1.2 },
      B: { x0: -30, z0: -44, x1: -19, z1: -30, y: -0.8 }
    };
    const spawns = {
      hij:  [[-8, 44], [-4, 46], [0, 44], [4, 46], [8, 44]].map(p => ({ x: p[0], y: 0, z: p[1], yaw: 0 })),
      swat: [[-8, -44], [-4, -46], [0, -44], [4, -46], [8, -44]].map(p => ({ x: p[0], y: 0, z: p[1], yaw: Math.PI }))
    };


      return { sites, spawns };
    }
  };
  }

/* ================================================================ de_ancient (v14) ================================================================
     Jungle-tempelkompleks tættere på CS2-Ancient – genereret af tools/ancient_gen.py → shared/ancient_data.js (0,5 m-celler):
       T Spawn → T Ramp → A Main (to knæk) → Elbow → A (hævet: Temple-søjlegang, alter) · Red Room (overdækket) → Mid (vandkanal, House)
       → Top Mid (obelisk) → Donut (ring om stenblok) → A · Top Mid → B Short → B · B Lane → Cave (mørk tunnel) / B Ramp → B (bassin, vandfald)
       CT Spawn → Temple-trappen → A · Ruins → B · CT Mid → Top Mid */
  function mapAncient() {
    const AD = ANCIENT_DATA, G = AD.grid;
    return {
      id: 'ancient', name: 'Ancient', desc: 'Jungle-tempel · hævet tempel (A) og sænket bassin med vandfald (B) · A Main, Elbow, Red Room, Mid med vandkanal, Donut, Cave og B Lane.',
      GW: G.GW, GH: G.GH, GX0: G.GX0, GZ0: G.GZ0, data: AD,
      layers: [{ id: 'G', yb: -3, yt: WALL_TOP, tiles: { '#': { solid: true }, ' ': { void: true } } }],
      grid(H) { H.fill(0, 0, G.GW - 1, G.GH - 1, ' '); },
      props(H) {
        const { wallBox, prop, cyl, stairs, fRamp, pillar } = H, deco = H.deco = H.deco || [];
        for (const b of AD.boxes) wallBox(b[0], b[1], b[2], b[3], b[4], b[5], b[6]);
        for (const r of AD.ramps) fRamp(r[0], r[1], r[2], r[3], r[4], r[5], r[6]);
        for (const t of AD.stairs) { const [x0, z0, x1, z1, ax, ya, yb, n] = t, lo = Math.min(ya, yb); stairs(x0, z0, x1, z1, ax, yb > ya ? 1 : -1, lo, Math.abs(yb - ya), n, lo - 0.3, 'stone'); }
        for (const p of AD.props) prop(p[0], p[1], p[2], p[3], p[4], p[5], p[6]);
        for (const c of AD.cyls) cyl(c[0], c[1], c[2], c[3], c[4], c[5]);
        for (const [x, z, s, y] of AD.trees) { deco.push({ t: 'tree', x, z, s }); pillar(x, z, 0.62, y - 0.2, y + 4.2, 'solid'); }   // stammen = usynlig kollision (temaet tegner træet)
        for (const [x0, z0, x1, z1, y] of AD.beds) deco.push({ t: 'bed', x0, z0, x1, z1, y });
      },
      meta(H) {
        for (const l of AD.labels) H.labels.push({ text: l[0], x: l[1], z: l[2], y: l[3], kind: l[0] === 'A' || l[0] === 'B' ? 'site' : undefined });
        const sites = {}; for (const k in AD.sites) { const S = AD.sites[k]; sites[k] = { x0: S[0], z0: S[1], x1: S[2], z1: S[3], y: S[4] }; }
        const spawns = { hij: AD.spawns.hij.map(p => ({ x: p[0], y: AD.levels.T, z: p[1], yaw: p[2] })), swat: AD.spawns.swat.map(p => ({ x: p[0], y: AD.levels.CT, z: p[1], yaw: p[2] })) };
        return { sites, spawns };
      }
    };
  }

  /* ================================================================ de_havn (v15) ================================================================
     Nordisk havnebydel – layout i tools/havn/layout.py → tools/havn/export_collision.py → shared/havn_data.js (grafikken bygges i
     Blender af samme layout: tools/havn/blender_build.py). Kanalen deler banen og krydses i tre højder: broer (+1,0), slusen (0) og
     nede ved vandet (−1,6: ponton og pram). Se docs/maps/havn/DESIGN.md. */
  function mapHavn() {
    const HD = HAVN_DATA, G = HD.grid;
    return {
      id: 'havn', name: 'Havn', desc: 'Nordisk havnebydel · kanal med sluse og klapbro · pakhus, fiskehal med iskælder, kirke og vold.',
      GW: G.GW, GH: G.GH, GX0: G.GX0, GZ0: G.GZ0, data: HD,
      layers: [{ id: 'G', yb: -4, yt: WALL_TOP, tiles: { '#': { solid: true }, ' ': { void: true } } }],
      grid(H) { H.fill(0, 0, G.GW - 1, G.GH - 1, ' '); },
      props(H) {
        const { wallBox, cyl, stairs, fRamp } = H;
        for (const b of HD.boxes) wallBox(b[0], b[1], b[2], b[3], b[4], b[5], b[6]);
        for (const r of HD.ramps) fRamp(r[0], r[1], r[2], r[3], r[4], r[5], r[6]);
        for (const t of HD.stairs) { const [x0, z0, x1, z1, ax, ya, yb, n] = t, lo = Math.min(ya, yb); stairs(x0, z0, x1, z1, ax, yb > ya ? 1 : -1, lo, Math.abs(yb - ya), n, lo - 0.3, 'stone'); }
        for (const c of HD.cyls) cyl(c[0], c[1], c[2], c[3], c[4], c[5]);
        for (const r of HD.rails) H.rail(r[0], r[1], r[2], r[3], r[4], r[5], 'iron');
        for (const d of HD.doors) H.door(d[0], d[1], d[2], d[3], d[4], { kind: 'wood', double: d[5] === 'gate' });
      },
      meta(H) {
        for (const l of HD.labels) H.labels.push({ text: l[0], x: l[1], z: l[2], y: l[3], kind: l[0] === 'A' || l[0] === 'B' ? 'site' : undefined });
        const sites = {}; for (const k in HD.sites) { const S = HD.sites[k]; sites[k] = { x0: S[0], z0: S[1], x1: S[2], z1: S[3], y: S[4] }; }
        const spawns = { hij: HD.spawns.hij.map(p => ({ x: p[0], y: HD.levels.T, z: p[1], yaw: p[2] })), swat: HD.spawns.swat.map(p => ({ x: p[0], y: HD.levels.CT, z: p[1], yaw: p[2] })) };
        return { sites, spawns };
      }
    };
  }

  /* ================================================================ de_canals (v16) ================================================================
     CS:GO de_canals (Venedig: Piazza San Marco, Dogepaladset, Sukkenes Bro, Campanilen = A) bygget DIREKTE af brugerens Blender-import
     af banen: tools/canals/ scanner geometrien (kollision) og eksporterer banens egne meshes og Source-teksturer (grafik, world.bin).
     Spilleområdet = den registrerede radar (tools/canals_src/radar.webp); sites, spawns og callouts er aflæst på radaren. */
  function mapCanals() {
    const D = CANALS_DATA, G = D.grid, SY = D.spawnY || {};
    return {
      id: 'canals', name: 'Canals', desc: 'CS:GO-banen i Venedig · T Water, Mid-kanalen, Sukkenes Bro, Campanilen (A), B ved CT Water, CT Long og Dock.',
      GW: G.GW, GH: G.GH, GX0: G.GX0, GZ0: G.GZ0, data: D,
      layers: [{ id: 'G', yb: -4, yt: WALL_TOP, tiles: { '#': { solid: true }, ' ': { void: true } } }],
      grid(H) { H.fill(0, 0, G.GW - 1, G.GH - 1, ' '); },
      props(H) {
        for (const b of D.boxes) H.wallBox(b[0], b[1], b[2], b[3], b[4], b[5], b[6]);
        for (const c of D.clips || []) H.wallBox(c[0], c[1], c[2], c[3], c[4], c[5], 'clip', { nb: true });
      },
      meta(H) {
        for (const l of D.labels) H.labels.push({ text: l[0], x: l[1], z: l[2], y: l[3] });
        const sites = {}; for (const k in D.sites) { const S = D.sites[k]; sites[k] = { x0: S[0], z0: S[1], x1: S[2], z1: S[3], y: S[4] }; }
        const sp = side => D.spawns[side].map((p, i) => ({ x: p[0], y: SY[side] ? SY[side][i] : D.levels[side === 'hij' ? 'T' : 'CT'], z: p[1], yaw: p[2] }));
        return { sites, spawns: { hij: sp('hij'), swat: sp('swat') } };
      }
    };
  }

  /* ================================================================ de_inferno (v13) ================================================================
     Gammel italiensk landsby, frit inspireret af CS2-Inferno – genereret af tools/inferno_gen.py → shared/inferno_data.js:
       T Spawn → T-rampen → Banana (snoet, stigende gade) → B (hævet kirkeplads: Church, Coffins, springvand, appelsinbede)
       Second Mid → Mid → Short (bue) → A-piazzaen (Graveyard, Pit, Quad) · T Apps: lejlighedskæden på 1. sal → Boiler → Balcony over A
       CT Spawn → CT-gården → Arch (overdækket) / Library → A · CT-vejen mod vest → Construction → B · Alley: Top Mid ↔ CT-vejen */
  function mapInferno() {
    const ID = INFERNO_DATA, G = ID.grid;
    return {
      id: 'inferno', name: 'Inferno', desc: 'CS:GO-Inferno fra Blender-importen · Banana, Mid, Apartments, Balcony, Pit, Library og kirkepladsen på B.',
      GW: G.GW, GH: G.GH, GX0: G.GX0, GZ0: G.GZ0, data: ID,
      layers: [{ id: 'G', yb: -4, yt: WALL_TOP, tiles: { '#': { solid: true }, ' ': { void: true } } }],
      grid(H) { H.fill(0, 0, G.GW - 1, G.GH - 1, ' '); },
      props(H) {
        const { wallBox, prop, cyl, ladder, stairs, fRamp } = H;
        for (const b of ID.boxes) wallBox(b[0], b[1], b[2], b[3], b[4], b[5], b[6]);
        for (const r of ID.ramps) fRamp(r[0], r[1], r[2], r[3], r[4], r[5], r[6]);
        for (const t of ID.stairs) { const [x0, z0, x1, z1, ax, ya, yb, n] = t, lo = Math.min(ya, yb); stairs(x0, z0, x1, z1, ax, yb > ya ? 1 : -1, lo, Math.abs(yb - ya), n, lo - 0.3, 'stone'); }
        for (const p of ID.props) prop(p[0], p[1], p[2], p[3], p[4], p[5], p[6]);
        for (const c of ID.cyls) cyl(c[0], c[1], c[2], c[3], c[4], c[5]);
        for (const r of ID.rails) H.rail(r[0], r[1], r[2], r[3], r[4], r[5], 'iron');
        for (const l of ID.ladders) ladder(l[0], l[1], l[2], l[3], l[4], l[5], l[6], l[7]);
        for (const d of ID.doors) H.door(d[0], d[1], d[2], d[3], d[4], { kind: 'wood' });
        for (const c of ID.clips || []) wallBox(c[0], c[1], c[2], c[3], c[4], c[5], 'clip', { nb: true });
      },
      meta(H) {
        for (const l of ID.labels) H.labels.push({ text: l[0], x: l[1], z: l[2], y: l[3], nav: l[4] !== 0 });
        const sites = {}; for (const k in ID.sites) { const S = ID.sites[k]; sites[k] = { x0: S[0], z0: S[1], x1: S[2], z1: S[3], y: S[4] }; }
        const SY = ID.spawnY || {};                                       // v16: hver spawn har sin egen gulvhøjde (printets terræn)
        const spawns = { hij: ID.spawns.hij.map((p, i) => ({ x: p[0], y: SY.hij ? SY.hij[i] : ID.levels.T, z: p[1], yaw: p[2] })), swat: ID.spawns.swat.map((p, i) => ({ x: p[0], y: SY.swat ? SY.swat[i] : ID.levels.CT, z: p[1], yaw: p[2] })) };
        return { sites, spawns };
      }
    };
  }

  /* ================================================================ de_nuke (v12.1) ================================================================
     Bygget PRÆCIST efter brugerens 3D-print-model (tools/nuke_stl/upper.stl + lower.stl) af tools/nuke_from_stl.py → shared/nuke_data.js:
     hver 0,225 m-celle af printet er omsat til geometri (gulve, trin, kanter, vægspor → mure med højder fra printets hjørnestolper),
     ramper/trapper/stiger målt i printet, props (kasser, containere, siloen, tankene i A, reaktoren i B) med printets mål.
     Målestok 0,45 m pr. print-enhed (CS-timing). T Spawn og CT Spawn ligger uden for printet og er tilføjet efter radaren.
       A-niveau (y 0): T Spawn → T-siden → Lobby-bygningen (Lobby · Squeaky · Radio · Control, T Roof ovenpå) → A-hallen (Hut, to tanke, Main)
                       Ramp-rummet nord for A med to sidebaner ned mod rampen · CT-siden: Lockers, Turnpike, hævet CT-plads (+2,09 m) med to ramper
                       Outside: Silo, T Red, CT Red, Garage (lastbil, containere), Secret-bygningen og den åbne Secret-trappe i gårdens sydkant
       B-niveau (y −9,3): Ramp (ned mod syd under Ramp-rummet) → Bottom Ramp (−6,2) → B site med reaktoren · Window · Doors · Tunnels → Secret
                       · Decon · Back Vents (kravlekanal) med stige op til ventilationen ved Main */
  function mapNuke() {
    const ND = NUKE_DATA, G = ND.grid, LV = ND.levels;
    return {
      id: 'nuke', name: 'Nuke', desc: 'Præcis efter 3D-modellen · A oppe, B nede under · Ramp, Bottom Ramp, Secret, Back Vents, Garage, Silo og hævet CT-plads.',
      GW: G.GW, GH: G.GH, GX0: G.GX0, GZ0: G.GZ0, data: ND, ring: true,
      layers: [
        { id: 'B', yb: -12, yt: -0.6, tiles: { '#': { solid: true }, ' ': { void: true } } },
        { id: 'G', yb: -0.6, yt: WALL_TOP, tiles: { '#': { solid: true }, ' ': { void: true } } }
      ],
      grid(H) {
        H.layer('B'); H.fill(0, 0, G.GW - 1, G.GH - 1, ' ');
        H.layer('G'); H.fill(0, 0, G.GW - 1, G.GH - 1, ' ');
      },
      props(H) {
        const { wallBox, prop, slab, cyl, ladder, stairs, fRamp } = H;
        for (const b of ND.boxes) wallBox(b[0], b[1], b[2], b[3], b[4], b[5], b[6]);
        for (const r of ND.ramps) fRamp(r[0], r[1], r[2], r[3], r[4], r[5], r[6]);
        for (const t of ND.stairs) {
          const [x0, z0, x1, z1, ax, ya, yb, n] = t, lo = Math.min(ya, yb);
          stairs(x0, z0, x1, z1, ax, yb > ya ? 1 : -1, lo, Math.abs(yb - ya), n, lo - 0.3, 'steelstairs');
        }
        const COLS = ['red', 'blue', 'green', 'blue2'];
        for (const p of ND.props) prop(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[6] === 'container' ? { col: p[7] || COLS[Math.abs(Math.round(p[0] * 7 + p[1] * 3)) % 4] } : undefined);
        for (const c of ND.cyls) cyl(c[0], c[1], c[2], c[3], c[4], c[5], { ceil: LV.roofA });
        for (const r of ND.roofs) slab(r[0], r[1], r[2], r[3], r[5], r[5] - r[4], 'roofslab', { name: r[6], walk: r[7] === 'roof' });
        for (const l of ND.ladders) ladder(l[0], l[1], l[2], l[3], l[4], l[5], l[6], l[7]);
        // v13: gangbroer (rist), gelændere og usynlige clip-vægge (stopper bevægelse, ikke kugler/granater)
        for (const g of ND.grates || []) wallBox(g[0], g[1], g[2], g[3], g[4] - g[5], g[4], g[6] === 'post' ? 'steel' : 'grate');
        for (const r of ND.rails || []) H.rail(r[0], r[1], r[2], r[3], r[4], r[5], 'steel');
        for (const c of ND.clips || []) wallBox(c[0], c[1], c[2], c[3], c[4], c[5], 'clip', { nb: true });
      },
      meta(H) {
        for (const l of ND.labels) H.labels.push({ text: l[0], x: l[1], z: l[2], y: l[3] });
        const S = ND.sites, sites = {};
        for (const k in S) sites[k] = { x0: S[k][0], z0: S[k][1], x1: S[k][2], z1: S[k][3], y: S[k][4] };
        const spawns = {
          hij: ND.spawns.hij.map(p => ({ x: p[0], y: 0, z: p[1], yaw: p[2] })),
          swat: ND.spawns.swat.map(p => ({ x: p[0], y: LV.CT, z: p[1], yaw: p[2] }))
        };
        return { sites, spawns };
      }
    };
  }

});
