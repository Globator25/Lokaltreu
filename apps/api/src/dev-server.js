/**
 * apps/api/src/dev-server.js
 *
 * Zweck:
 *  - Wrapper für `npm run security:api:start`
 *  - Setzt Port/Profile-Umgebung und lädt die bereits gebaute API aus ../dist/index.js
 *  - Kein neuer Business-Code, nur Start-Logik für Security-/Testprofile.
 */

// CLI-Argumente auswerten: --port 4010 --profile test
const args = process.argv.slice(2);

function getArgValue(flag) {
  const index = args.indexOf(flag);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return undefined;
}

const portFromArg = getArgValue('--port');
if (portFromArg) {
  process.env.PORT = portFromArg;
}

const profileFromArg = getArgValue('--profile');
if (profileFromArg) {
  process.env.API_PROFILE = profileFromArg;
} else if (!process.env.API_PROFILE) {
  process.env.API_PROFILE = 'dev';
}

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// ESM: statt require() verwenden wir import().
// Der Pfad ist relativ zu dieser Datei: apps/api/src/dev-server.js -> ../dist/index.js
import('../dist/index.js')
  .catch((err) => {
    // Minimales Error-Logging, ohne PII
    console.error('Failed to start API from dev-server.js', err);
    process.exit(1);
  });
