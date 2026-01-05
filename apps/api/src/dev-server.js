/**
 * apps/api/src/dev-server.js
 *
 * Zweck:
 *  - Wrapper für `npm run security:api:start`
 *  - Setzt Port/Profile-Umgebung und lädt die bereits gebaute API aus ../dist/index.js
 *  - Kein neuer Business-Code, nur Start-Logik für Security-/Testprofile.
 */

// CLI-Argumente auswerten: --port=4010 --profile=test
const args = process.argv.slice(2);

function getArgValue(flag) {
  const exactIndex = args.indexOf(flag);
  if (exactIndex !== -1 && args[exactIndex + 1]) {
    return args[exactIndex + 1];
  }
  const prefix = `${flag}=`;
  const matched = args.find((arg) => arg.startsWith(prefix));
  if (matched) {
    return matched.slice(prefix.length);
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

const isBlank = (value) => value === undefined || value === '';

if (process.env.API_PROFILE === 'test') {
  // Set test-profile defaults only when not explicitly provided.
  if (isBlank(process.env.DEV_SEED)) process.env.DEV_SEED = '1';
  if (isBlank(process.env.DEV_DEVICE_SEED_DEVICE_ID)) {
    process.env.DEV_DEVICE_SEED_DEVICE_ID = 'dev-test-key';
  }
  if (isBlank(process.env.DEV_DEVICE_SEED_TENANT_ID)) {
    process.env.DEV_DEVICE_SEED_TENANT_ID = 'tenant-1';
  }
  if (isBlank(process.env.DEV_DEVICE_SEED_PRIVATE_KEY)) {
    process.env.DEV_DEVICE_SEED_PRIVATE_KEY =
      'lF9dQwDVGcy+KfJKccr2KvPdzUypN/LIgPb+oyDoRXXdo7VRplcuwO6xRurjFoj1bHj2mt3XrVPuI12PTy8/yw==';
  }
}

const port = Number(process.env.PORT) || 4010;

// ESM: statt require() verwenden wir import().
// Der Pfad ist relativ zu dieser Datei: apps/api/src/dev-server.js -> ../dist/index.js
import('../dist/index.js')
  .then((mod) => {
    if (typeof mod.startServer !== 'function') {
      throw new Error('startServer export missing in ../dist/index.js');
    }
    return mod.startServer(port);
  })
  .then(() => {
    console.warn(`Lokaltreu API (security profile=${process.env.API_PROFILE}) listening on ${port}`);
  })
  .catch((err) => {
    // Minimales Error-Logging, ohne PII
    console.error('Failed to start API from dev-server.js', err);
    process.exit(1);
  });
