import fs from "node:fs";
import path from "node:path";

function* walk(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stats = fs.statSync(full);
    if (stats.isDirectory()) {
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

let fail = false;
for (const file of walk("apps")) {
  if (!file.match(/\.(ts|tsx)$/) || file.endsWith(".d.ts")) continue;
  const content = fs.readFileSync(file, "utf8");
  if (/interface\s+\w+Response/.test(content) && !content.includes("@lokaltreu/types")) {
    console.error(`Manuelle API-Typen in ${file}`);
    fail = true;
  }
  if (/import\s+type\s+{[^}]*}\s+from\s+['"]\.{0,2}\/.*types/.test(content)) {
    console.error(`Direktimport lokaler Types in ${file}`);
    fail = true;
  }
}

if (fail) process.exit(1);
