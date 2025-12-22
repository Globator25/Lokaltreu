// Sehr einfache erste Coverage-Schranke für Schritt 4.
// Annahme: Vitest legt coverage/coverage-summary.json im API-Workspace an.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const MIN_COVERAGE = Number(process.env.MIN_COVERAGE ?? '30'); // später auf 80 % erhöhen

const summaryPath = resolve('apps/api/coverage/coverage-summary.json');

try {
  const raw = await readFile(summaryPath, 'utf8');
  const data = JSON.parse(raw);

  const total = data.total.lines.pct;
  if (total < MIN_COVERAGE) {
    console.error(
      `[coverage] lines ${total}% < MIN_COVERAGE ${MIN_COVERAGE}%. Bitte Tests nachziehen.`
    );
    process.exit(1);
  } else {
    console.log(`[coverage] OK – lines ${total}% ≥ MIN_COVERAGE ${MIN_COVERAGE}%`);
  }
} catch (err) {
  console.error('[coverage] coverage-summary.json nicht gefunden oder ungültig.', err);
  process.exit(1);
}
