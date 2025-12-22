import { pathToFileURL } from "node:url";
import { resolveOtelConfig, startOtel, type OtelConfig } from "./observability/otel";
// Platzhalter für unsere zukünftige HTTP-API.
// Gemäß RFC 7807 für Fehlerbehandlung [DOC:SPEC].
// In späteren Roadmap-Schritten wird hier der HTTP-Server
// (z. B. Fastify/Express) sowie die Problem+JSON-Fehlerbehandlung
// nach SPEC / OpenAPI angebunden.

export type StartupPlan = {
  otelConfig: OtelConfig;
};

export function createStartupPlan(env: NodeJS.ProcessEnv = process.env): StartupPlan {
  return {
    otelConfig: resolveOtelConfig(env),
  };
}

export function shouldBootstrap(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.LOKALTREU_DISABLE_OTEL_BOOTSTRAP !== "true";
}

export function isEntryModule(
  argv: string[] | undefined = process.argv,
  moduleUrl: string | undefined = typeof import.meta.url === "string" ? import.meta.url : undefined,
): boolean {
  if (!argv || argv.length < 2 || !moduleUrl) {
    return false;
  }
  const entryFile = argv[1];
  if (!entryFile) {
    return false;
  }
  try {
    return pathToFileURL(entryFile).href === moduleUrl;
  } catch {
    return false;
  }
}

export async function bootstrapObservability(
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const plan = createStartupPlan(env);
  await startOtel(plan.otelConfig);
}

if (shouldBootstrap() && isEntryModule()) {
  void bootstrapObservability();
}

export {};
