import fs from 'node:fs';
import path from 'node:path';
function* walk(dir){ for (const f of fs.readdirSync(dir)){ const p=path.join(dir,f); const s=fs.statSync(p); if(s.isDirectory()) yield* walk(p); else yield p; } }
let fail=false;
for (const f of walk('apps')) {
  if (!f.match(/\.(ts|tsx)$/) || f.endsWith('.d.ts')) continue;
  const s=fs.readFileSync(f,'utf8');
  if (/interface\s+\w+Response/.test(s) && !s.includes("@lokaltreu/types")) { console.error(`Manuelle API-Typen in ${f}`); fail = true; }
  if (/import\s+type\s+{[^}]*}\s+from\s+['"]\.{0,2}\/.*types/.test(s)) { console.error(`Direktimport lokaler Types in ${f}`); fail = true; }
}
if (fail) process.exit(1);
