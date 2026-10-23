// ==========================================================================
// BOTS · MÅL OG RÅDE (v26.12): menneskelig sigtekurve i stedet for øjeblikkelig snap-sigte.
//   • reaktionstid 150–220 ms efter et nyt mål er set (hurtigere for dygtige bots), derefter en dæmpet fjeder (ζ < 1 → lille overskydning)
//   • hånd-rystelse (lavfrekvent støj) og et 'rod' på sigtet der skrumper jo længere målet har været fulgt
//   • recoil: hvert skud løfter sigtet; botten trækker ned med en kompensation (0,55–0,92 afh. af dygtighed) → resten er spray
//   • spredning: våbnets egen + bevægelse/hop, mindre ved stilstand/nedhuk
//   createAim(skill) · aim.setWant(yaw, pitch, t, fresh) · aim.step(dt, t) · aim.dir(w, moving, crouch, air) → [dx,dy,dz]
// ==========================================================================
const TAU = Math.PI * 2;
const wrap = a => { a %= TAU; if (a > Math.PI) a -= TAU; if (a < -Math.PI) a += TAU; return a; };
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };

function createAim(skill) {
  const A = {
    yaw: Math.random() * TAU, pitch: 0, vy: 0, vp: 0, wy: 0, wp: 0, ty: 0, tp: 0, react: 0, since: 0, skill,
    recoil: 0, ph: [Math.random() * 9, Math.random() * 9, Math.random() * 9, Math.random() * 9],
    /* nyt mål: 'fresh' = første gang målet ses → reaktionsforsinkelse; ellers glider ønsket retning bare med */
    setWant(yaw, pitch, t, fresh) {
      if (fresh) { A.react = t + (0.15 + (1 - A.skill) * 0.07 + Math.random() * 0.03) * 1000; A.since = t; }
      A.ty = yaw; A.tp = pitch;
    },
    /* én tidsstep: ønsket retning følger først efter reaktionstiden */
    step(dt, t) {
      if (t >= A.react) { A.wy = A.ty; A.wp = A.tp; }
      const ey = wrap(A.wy - A.yaw), ep = A.wp - A.pitch;
      // hånd-rystelse + rod (rod aftager 1,6 s efter målet blev set)
      const settle = Math.max(0, 1 - (t - A.since) / 1600), tremor = (0.0026 + (1 - A.skill) * 0.006) * (0.5 + settle * 1.2);
      const ny = (Math.sin(t * 0.011 + A.ph[0]) + 0.6 * Math.sin(t * 0.027 + A.ph[1])) * tremor, np = (Math.sin(t * 0.013 + A.ph[2]) + 0.6 * Math.sin(t * 0.031 + A.ph[3])) * tremor;
      const w0 = 15 + 9 * A.skill, z = 0.74;                                        // egenfrekvens (rad/s) og dæmpning
      const big = Math.min(1, Math.abs(ey) / 0.6), cap = (5 + 9 * A.skill) * (0.4 + big);        // fartgrænse – store drej er hurtigere
      const ay = ey * w0 * w0 - 2 * z * w0 * A.vy, ap = ep * w0 * w0 - 2 * z * w0 * A.vp;
      A.vy += ay * dt; A.vp += ap * dt;
      A.vy = Math.max(-cap, Math.min(cap, A.vy)); A.vp = Math.max(-cap, Math.min(cap, A.vp));
      A.yaw = wrap(A.yaw + A.vy * dt + (ny - (A._ny || 0))); A.pitch = Math.max(-1.4, Math.min(1.4, A.pitch + A.vp * dt + (np - (A._np || 0))));
      A._ny = ny; A._np = np;
      // recoil klinger af; kompensation trækker sigtet ned mens der skydes
      A.recoil = Math.max(0, A.recoil - dt * 2.4);
    },
    error() { return Math.hypot(wrap(A.ty - A.yaw) * 0.9, A.tp - A.pitch); },
    kick(w) {                                                                           // et skud er afgivet
      A.recoil += (w.recoil || 0.01) * (0.8 + Math.random() * 0.5) * 1.8;
      const comp = 0.55 + 0.37 * A.skill; A.pitch -= (w.recoil || 0.01) * 1.8 * comp * 0.9 * 0.5;   // aktiv modtræk (den halve del direkte)
    },
    /* retning for et skud (enhedsvektor); spredning vokser ved bevægelse/hop og aftager ved nedhuk */
    dir(w, speed, crouch, air) {
      const res = A.recoil * (1 - (0.55 + 0.37 * A.skill)), mv = Math.min(1, speed / 6);
      const sd = (w.spread || 0.006) * (1 + mv * 7 + (air ? 10 : 0)) * (crouch ? 0.6 : 1) * (1.15 - A.skill * 0.25);
      const yaw = A.yaw + gauss() * sd, pitch = A.pitch + res + gauss() * sd, cp = Math.cos(pitch);
      return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
    }
  };
  return A;
}
module.exports = { createAim, wrap, gauss };
