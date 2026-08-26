const fs = require('fs');
const path = require('path');
const needle = process.argv[2];
const roots = process.argv.slice(3);
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'dist' || e.name === 'out') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx|cjs|mjs|js|json|md)$/.test(e.name)) {
      const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
      lines.forEach((l, i) => {
        if (l.includes(needle)) console.log(p + ':' + (i + 1) + ': ' + l.trim().slice(0, 160));
      });
    }
  }
}
roots.forEach(walk);
