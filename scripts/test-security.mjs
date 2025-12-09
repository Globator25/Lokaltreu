// scripts/test-security.mjs
import { spawn } from 'node:child_process';

const gates = [
  {
    name: 'Device-Proof',
    script: 'npm run test:security:device-proof',
    enabled: false,
  },
  {
    name: 'Anti-Replay',
    script: 'npm run test:security:anti-replay',
    enabled: false,
  },
  {
    name: 'Rate-Limits / Plan-Gate',
    script: 'npm run test:security:plan-gate',
    enabled: false,
  },
];

const activeGates = gates.filter((gate) => gate.enabled);

async function runSecurityGates() {
  if (activeGates.length === 0) {
    console.log(
      '[security] Noch keine Security-Gates aktiviert – Platzhalter für Device-Proof, Anti-Replay und Rate-Limits.',
    );
    return 0;
  }

  for (const gate of activeGates) {
    console.log(`[security] Starte ${gate.name} …`);

    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn(gate.script, {
        shell: true,
        stdio: 'inherit',
      });

      child.on('exit', (code) => {
        // Falls kein Code geliefert wird, behandeln wir es als Fehler
        resolve(code ?? 1);
      });

      child.on('error', (err) => {
        reject(err);
      });
    });

    if (exitCode !== 0) {
      console.error(
        `[security] ${gate.name} fehlgeschlagen (exit ${exitCode})`,
      );
      return exitCode;
    }

    console.log(`[security] ${gate.name} ✓`);
  }

  console.log('[security] Alle aktivierten Gates erfolgreich durchlaufen.');
  return 0;
}

runSecurityGates()
  .then((code) => {
    // Exit-Code für den CI-Runner setzen
    process.exitCode = code;
  })
  .catch((err) => {
    console.error('[security] Unerwarteter Fehler beim Ausführen der Security-Gates:', err);
    process.exitCode = 1;
  });
