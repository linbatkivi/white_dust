// v26.12: samler lamper og destruerbare props til shared/*.js (serveren i appen får kun server.js + shared/*.js).
//   Kør efter en ny bagning:  node scripts/gen-shared-data.js
const fs = require('fs'), path = require('path'), R = path.join(__dirname, '..');
const lamps = JSON.parse(fs.readFileSync(path.join(R, 'shared', 'lamps.json'), 'utf8'));
const dp = {}; for (const m of ['bureau']) { try { dp[m] = JSON.parse(fs.readFileSync(path.join(R, 'public', 'assets', m, 'dprops.json'), 'utf8')); } catch (e) { dp[m] = []; } }
fs.writeFileSync(path.join(R, 'shared', 'lamps.js'), '// GENERERET af scripts/gen-shared-data.js (lamper: [x, y, z, art])\nmodule.exports = ' + JSON.stringify(lamps) + ';\n');
fs.writeFileSync(path.join(R, 'shared', 'dprops_data.js'), '// GENERERET af scripts/gen-shared-data.js (destruerbare props pr. bane)\nmodule.exports = ' + JSON.stringify(dp) + ';\n');
console.log('shared/lamps.js + dprops_data.js', Object.fromEntries(Object.entries(dp).map(([k, v]) => [k, v.length])));
