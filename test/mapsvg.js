// Udviklingsværktøj: tegner en bane ovenfra som SVG (et panel pr. højdeskive) til layout-review.
//   node test/mapsvg.js nuke > nuke.svg
const WD = require('../shared/wd.js');
const id = process.argv[2] || 'nuke';
const W = WD.buildWorld(id);
const b = W.bounds, S = 7, pad = 20;
let slices = W.layers.length > 1 ? [['B-etage (y≈-6)', -6.5, -0.7], ['G-etage (y≈0)', -0.7, 3.4], ['Øvre (y≈4.2)', 3.4, 7]] : [['Gulv', -9, 3.4], ['Øvre', 1.6, 6]];
if (process.argv[3] !== undefined) slices = [slices[+process.argv[3]]];
const pw = (b.x1 - b.x0) * S, ph = (b.z1 - b.z0) * S;
const X = x => (x - b.x0) * S, Z = z => (z - b.z0) * S;
let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${slices.length * (pw + pad) + pad}" height="${ph + 60}" font-family="Arial" font-size="9">`;
out += `<rect width="100%" height="100%" fill="#222"/>`;
const col = y => { const t = Math.max(0, Math.min(1, (y + 7) / 13)); return `hsl(${220 - t * 200},55%,${30 + t * 35}%)`; };
slices.forEach(([title, ya, yb], si) => {
  const ox = pad + si * (pw + pad), oy = 40;
  out += `<g transform="translate(${ox},${oy})"><text x="0" y="-8" fill="#fff" font-size="14">${id} – ${title}</text><rect width="${pw}" height="${ph}" fill="#000"/>`;
  // walkable tops within slice
  const items = [];
  for (const c of W.boxes) {
    const top = c.y1;
    if (c.kind === 'ceil' || c.lintel) continue;
    if (top >= ya && top <= yb) items.push({ c, top, k: 'walk' });
    else if (c.y0 < yb && top > yb) items.push({ c, top, k: 'wall' });
  }
  items.sort((a, b2) => a.top - b2.top);
  for (const it of items) {
    const c = it.c;
    const fill = it.k === 'wall' ? '#555' : c.kind === 'rail' ? '#ff0' : c.kind === 'prop' ? '#c84' : c.kind === 'solid' ? '#a66' : col(it.top);
    out += `<rect x="${X(c.x0)}" y="${Z(c.z0)}" width="${(c.x1 - c.x0) * S}" height="${(c.z1 - c.z0) * S}" fill="${fill}" stroke="#000" stroke-width="0.3" opacity="${it.k === 'wall' ? 1 : 0.95}"><title>${c.kind} ${c.style || ''} top ${it.top}</title></rect>`;
  }
  for (const r of W.ramps) { const lo = Math.min(r.ya, r.yb), hi = Math.max(r.ya, r.yb); if (hi < ya || lo > yb) continue; out += `<rect x="${X(r.bx0)}" y="${Z(r.bz0)}" width="${(r.bx1 - r.bx0) * S}" height="${(r.bz1 - r.bz0) * S}" fill="url(#none)" stroke="#0ff" stroke-width="2"/><text x="${X((r.bx0 + r.bx1) / 2)}" y="${Z((r.bz0 + r.bz1) / 2)}" fill="#0ff">RAMPE ${r.ya}→${r.yb}</text>`; }
  for (const l of W.ladders) if (l.y1 >= ya && l.y0 <= yb) out += `<rect x="${X(l.x0)}" y="${Z(l.z0)}" width="${Math.max(3, (l.x1 - l.x0) * S)}" height="${Math.max(3, (l.z1 - l.z0) * S)}" fill="#f0f"/><text x="${X(l.x1) + 3}" y="${Z(l.z0)}" fill="#f0f">stige ${l.y0}→${l.y1}</text>`;
  for (const d of W.doors) if (d.y >= ya - 0.5 && d.y <= yb) { const hw = d.w / 2; out += d.axis === 'x' ? `<line x1="${X(d.x - hw)}" y1="${Z(d.z)}" x2="${X(d.x + hw)}" y2="${Z(d.z)}" stroke="${d.kind === 'squeaky' ? '#f44' : '#0f0'}" stroke-width="3"/>` : `<line x1="${X(d.x)}" y1="${Z(d.z - hw)}" x2="${X(d.x)}" y2="${Z(d.z + hw)}" stroke="${d.kind === 'squeaky' ? '#f44' : '#0f0'}" stroke-width="3"/>`; }
  for (const k in W.sites) { const s = W.sites[k]; if (s.y >= ya - 0.5 && s.y <= yb) out += `<rect x="${X(s.x0)}" y="${Z(s.z0)}" width="${(s.x1 - s.x0) * S}" height="${(s.z1 - s.z0) * S}" fill="none" stroke="#f22" stroke-width="2" stroke-dasharray="6 3"/><text x="${X(s.x0) + 4}" y="${Z(s.z0) + 22}" fill="#f22" font-size="22">${k}</text>`; }
  for (const side of ['hij', 'swat']) for (const p of W.spawns[side]) if (p.y >= ya - 0.5 && p.y <= yb) out += `<circle cx="${X(p.x)}" cy="${Z(p.z)}" r="4" fill="${side === 'hij' ? '#f33' : '#39f'}"/>`;
  for (const c of W.cyls) if (c.y1 > ya && c.y0 < yb) out += `<circle cx="${X(c.x)}" cy="${Z(c.z)}" r="${c.r * S}" fill="none" stroke="#fff" stroke-width="1"/>`;
  for (const l of W.labels) if ((l.y === undefined ? 0 : l.y) >= ya - 0.5 && (l.y === undefined ? 0 : l.y) <= yb) out += `<text x="${X(l.x)}" y="${Z(l.z)}" fill="#fff" text-anchor="middle" font-weight="bold" stroke="#000" stroke-width="0.4">${l.text}</text>`;
  // 10 m gitter
  for (let x = Math.ceil(b.x0 / 10) * 10; x <= b.x1; x += 10) out += `<line x1="${X(x)}" y1="0" x2="${X(x)}" y2="${ph}" stroke="#fff" stroke-opacity="0.08"/><text x="${X(x) + 1}" y="${ph + 10}" fill="#888">${x}</text>`;
  for (let z = Math.ceil(b.z0 / 10) * 10; z <= b.z1; z += 10) out += `<line x1="0" y1="${Z(z)}" x2="${pw}" y2="${Z(z)}" stroke="#fff" stroke-opacity="0.08"/><text x="-18" y="${Z(z) + 3}" fill="#888">${z}</text>`;
  out += '</g>';
});
out += '</svg>';
process.stdout.write(out);
