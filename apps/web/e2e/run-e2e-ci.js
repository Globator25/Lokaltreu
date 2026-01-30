const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const net = require("net");

const isWin = process.platform === "win32";
const prismUrl = "http://127.0.0.1:4010/.well-known/jwks.json";
const prismTimeoutMs = Number(process.env.E2E_PRISM_TIMEOUT_MS) || 60000;
const prismPollIntervalMs = 500;
const webServerTimeoutMs = 30000;
const webServerPollIntervalMs = 250;

function spawnCmd(cmd, args, options = {}) {
  const safeCmd = typeof cmd === "string" ? cmd.trim() : "";
  const safeArgs = Array.isArray(args)
    ? args
        .filter((value) => value !== undefined && value !== null)
        .map((value) => (typeof value === "string" ? value : String(value)))
    : [];
  const safeOptions = { ...options };
  if (safeOptions.cwd && typeof safeOptions.cwd !== "string") {
    delete safeOptions.cwd;
  }
  if (!("stdio" in safeOptions)) {
    safeOptions.stdio = "inherit";
  }

  let finalCmd = safeCmd;
  let finalArgs = safeArgs;

  if (isWin && finalCmd === "npx") {
    finalCmd = "npx.cmd";
  }

  const debugSpawn = process.env.E2E_DEBUG_SPAWN === "1";
  if (debugSpawn) {
    console.log(
      "[spawn]",
      JSON.stringify({ cmd: finalCmd, args: finalArgs, cwd: safeOptions.cwd ?? null }),
    );
  }

  if (!finalCmd) {
    throw new Error("spawnCmd: command is empty");
  }

  try {
    return spawn(finalCmd, finalArgs, { ...safeOptions });
  } catch (err) {
    if (!isWin) throw err;
    const cmdline = [finalCmd, ...finalArgs].join(" ");
    return spawn("cmd.exe", ["/d", "/s", "/c", cmdline], { ...safeOptions });
  }
}

function resolveOpenApiSpecPath() {
  const override = process.env.E2E_OPENAPI_SPEC;
  if (override && override.trim().length > 0) {
    return path.resolve(override.trim());
  }
  return path.resolve(
    path.join(__dirname, "..", "..", "api", "openapi", "lokaltreu-openapi-v2.0.yaml"),
  );
}

function resolveStandaloneServerEntry() {
  const webRoot = path.join(__dirname, "..");
  const standaloneRoot = path.join(webRoot, ".next", "standalone");
  const expectedSuffix = path.normalize(path.join("apps", "web", "server.js"));

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = walk(full);
        if (found) return found;
      } else if (entry.isFile() && entry.name === "server.js") {
        const normalized = path.normalize(full);
        if (normalized.endsWith(path.normalize(path.join(standaloneRoot, expectedSuffix)))) {
          return full;
        }
      }
    }
    return null;
  }

  if (!fs.existsSync(standaloneRoot)) {
    throw new Error(
      "Standalone server entry not found. Expected .next/standalone/apps/web/server.js. Did you run `npm run build`?",
    );
  }

  const found = walk(standaloneRoot);
  if (!found) {
    throw new Error(
      "Standalone server entry not found. Expected .next/standalone/apps/web/server.js. Did you run `npm run build`?",
    );
  }
  return found;
}

function copyDirIfMissing(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) return;
  if (fs.existsSync(targetDir)) {
    const entries = fs.readdirSync(targetDir);
    if (entries.length > 0) return;
  }
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const src = path.join(sourceDir, entry.name);
    const dest = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirIfMissing(src, dest);
    } else if (entry.isFile()) {
      fs.copyFileSync(src, dest);
    }
  }
}

function ensureStandaloneAssets() {
  // Monorepo standalone path: apps/web/.next/standalone/apps/web
  const webRoot = path.join(__dirname, "..");
  const standaloneWeb = path.join(webRoot, ".next", "standalone", "apps", "web");
  const staticSrc = path.join(webRoot, ".next", "static");
  const staticDest = path.join(standaloneWeb, ".next", "static");
  const publicSrc = path.join(webRoot, "public");
  const publicDest = path.join(standaloneWeb, "public");

  copyDirIfMissing(staticSrc, staticDest);
  copyDirIfMissing(publicSrc, publicDest);
}

function createOutputBuffer(maxLines = 200) {
  const lines = [];
  return {
    push(chunk) {
      const text = String(chunk);
      for (const line of text.split(/\r?\n/)) {
        if (!line) continue;
        lines.push(line);
        if (lines.length > maxLines) lines.shift();
      }
    },
    dump() {
      return lines.join("\n");
    },
  };
}

function attachProcRingBuffer(proc) {
  const buffer = createOutputBuffer(200);
  proc.__e2e_lastOutput = () => buffer.dump();
  proc.__e2e_exit = null;
  proc.on("exit", (code, signal) => {
    proc.__e2e_exit = { code, signal };
  });
  proc.stdout?.on("data", (chunk) => {
    buffer.push(chunk);
    if (process.env.E2E_DEBUG_SPAWN === "1") process.stdout.write(chunk);
  });
  proc.stderr?.on("data", (chunk) => {
    buffer.push(chunk);
    if (process.env.E2E_DEBUG_SPAWN === "1") process.stderr.write(chunk);
  });
}

function startPrism() {
  const specPath = resolveOpenApiSpecPath();
  if (!fs.existsSync(specPath)) {
    throw new Error(
      `OpenAPI spec not found: ${specPath}. Set E2E_OPENAPI_SPEC or check repo layout.`,
    );
  }
  const host = String(process.env.PRISM_HOST ?? "127.0.0.1");
  const port = String(process.env.PRISM_PORT ?? "4010");
  const cwd = path.join(__dirname, "..");

  let proc;
  if (isWin) {
    proc = spawnCmd(
      "cmd.exe",
      ["/d", "/s", "/c", "npx", "prism", "mock", specPath, "-p", port, "--host", host],
      { cwd, env: process.env, stdio: "pipe" },
    );
  } else {
    proc = spawnCmd(
      "npx",
      ["prism", "mock", specPath, "-p", port, "--host", host],
      { cwd, env: process.env, stdio: "pipe" },
    );
  }

  attachProcRingBuffer(proc);

  return proc;
}

function requestOnce(url, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const client = url.startsWith("https:") ? https : http;
    const req = client.get(url, (res) => {
      res.resume();
      resolve(res.statusCode ?? null);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(null);
    });
  });
}

function requestStatus(url, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const client = url.startsWith("https:") ? https : http;
    const req = client.get(url, (res) => {
      res.resume();
      resolve({ status: res.statusCode ?? null, error: null });
    });
    req.on("error", (err) => resolve({ status: null, error: err }));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve({ status: null, error: new Error("timeout") });
    });
  });
}

async function waitForPrism(prismProc) {
  const started = Date.now();
  let lastStatus = null;
  let lastError = null;
  while (Date.now() - started < prismTimeoutMs) {
    if (prismProc && (prismProc.__e2e_exit || prismProc.exitCode != null)) {
      const exitInfo = prismProc.__e2e_exit ?? {
        code: prismProc.exitCode,
        signal: prismProc.signalCode,
      };
      const lastOutput =
        typeof prismProc.__e2e_lastOutput === "function"
          ? prismProc.__e2e_lastOutput()
          : "";
      throw new Error(
        `Prism exited before becoming ready. code=${exitInfo.code} signal=${exitInfo.signal ?? "null"} lastOutput=${lastOutput}`,
      );
    }
    const { status, error } = await requestStatus(prismUrl, 2000);
    lastStatus = status;
    lastError = error;
    if (status === 200) return;
    await new Promise((r) => setTimeout(r, prismPollIntervalMs));
  }
  const suffix =
    lastStatus !== null
      ? `Last status: ${lastStatus}`
      : lastError
        ? `Last error: ${lastError.message}`
        : "No response";
  throw new Error(`Prism did not become ready in time. ${suffix}`);
}

function isPrismAlreadyRunning() {
  return requestOnce(prismUrl, 2500).then(
    (status) => typeof status === "number" && status >= 200 && status < 500,
  );
}

async function waitForHttpOk(url, timeoutMs, pollIntervalMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const status = await requestOnce(url, 2000);
    if (typeof status === "number" && status >= 200 && status < 400) return;
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  throw new Error(`Timeout waiting for ${url}`);
}

function isPortFree(hostname, port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (err) => {
      if (err && err.code === "EADDRINUSE") {
        resolve(false);
        return;
      }
      reject(err);
    });
    server.listen(port, hostname, () => {
      server.close(() => resolve(true));
    });
  });
}

function runPlaywright(specs) {
  return new Promise((resolve) => {
    const cmd = isWin ? "cmd.exe" : "npx";
    const args = isWin
      ? [
          "/d",
          "/s",
          "/c",
          "npx",
          "playwright",
          "test",
          "--workers=1",
          "--retries=1",
          "--reporter=line",
          ...specs,
        ]
      : [
          "playwright",
          "test",
          "--workers=1",
          "--retries=1",
          "--reporter=line",
          ...specs,
        ];

    const proc = spawnCmd(cmd, args, { env: process.env });
    proc.on("close", (code) => resolve(code ?? 1));
  });
}

function killPrism(proc) {
  return new Promise((resolve) => {
    if (!proc || proc.killed || proc.pid == null) {
      resolve();
      return;
    }

    if (isWin) {
      const killer = spawnCmd("taskkill", ["/PID", String(proc.pid), "/T", "/F"]);
      killer.on("close", () => resolve());
      return;
    }

    proc.kill("SIGTERM");
    const timeout = setTimeout(() => {
      if (!proc.killed) {
        proc.kill("SIGKILL");
      }
    }, 3000);
    proc.on("close", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function main() {
  const specs = require("./smoke.manifest.js");
  process.env.E2E_RUNNER_OWNS_WEBSERVER = "1";
  if (!process.env.E2E_BASE_URL) {
    process.env.E2E_BASE_URL = "http://127.0.0.1:3002";
  }
  const baseUrl = process.env.E2E_BASE_URL;
  const webCheckUrl = `${baseUrl.replace(/\/$/, "")}/onboarding`;
  let prism = null;
  let prismStartedByRunner = false;
  let webServer = null;
  let webServerStartedByRunner = false;
  const useExternalWebServer = process.env.E2E_EXTERNAL_WEBSERVER === "1";

  const alreadyRunning = await isPrismAlreadyRunning();
  if (!alreadyRunning) {
    prism = startPrism();
    prismStartedByRunner = true;

    if (prism && prism.pid) {
      prism.once("error", async (err) => {
        if (err && err.code === "EADDRINUSE") {
          const ok = await isPrismAlreadyRunning();
          if (ok) return;
          console.error("Port 4010 in use but Prism not responding");
        } else {
          console.error(err);
        }
        process.exit(1);
      });
    }
  }

  const cleanup = async () => {
    if (webServerStartedByRunner && webServer && webServer.pid != null) {
      if (isWin) {
        const killer = spawnCmd("taskkill", ["/PID", String(webServer.pid), "/T", "/F"]);
        await new Promise((resolve) => killer.on("close", () => resolve()));
      } else {
        webServer.kill("SIGTERM");
      }
    }
    if (prismStartedByRunner) {
      await killPrism(prism);
    }
  };

  process.on("SIGINT", async () => {
    await cleanup();
    process.exit(130);
  });
  process.on("SIGTERM", async () => {
    await cleanup();
    process.exit(143);
  });
  process.on("uncaughtException", async (err) => {
    console.error(err);
    await cleanup();
    process.exit(1);
  });
  process.on("unhandledRejection", async (err) => {
    console.error(err);
    await cleanup();
    process.exit(1);
  });

  process.on("exit", () => {
    if (webServerStartedByRunner && webServer && webServer.pid != null) {
      try {
        if (isWin) {
          spawnCmd("taskkill", ["/PID", String(webServer.pid), "/T", "/F"]);
        } else {
          webServer.kill("SIGTERM");
        }
      } catch {
        // best-effort cleanup
      }
    }
  });

  try {
    if (!alreadyRunning) {
      await waitForPrism(prism ?? null);
    }
    const prismCheck = await requestStatus(prismUrl, 2000);
    if (prismCheck.status !== 200) {
      throw new Error("Prism readiness check failed after startup.");
    }

    if (!useExternalWebServer) {
      ensureStandaloneAssets();
      const entry = resolveStandaloneServerEntry();
      const env = {
        ...process.env,
        HOSTNAME: process.env.HOSTNAME ?? "127.0.0.1",
        PORT: process.env.PORT ?? "3002",
      };
      const port = env.PORT;
      const hostname = env.HOSTNAME;
      const free = await isPortFree(hostname, port);
      if (!free) {
        console.error(
          `Port ${hostname}:${port} already in use. Stop the running server or set PORT to a free port.`,
        );
        if (isWin) {
          try {
            spawnCmd("cmd.exe", ["/d", "/s", "/c", "netstat -ano | findstr :" + port]);
          } catch {
            // best-effort only
          }
        }
        process.exit(1);
      }
      webServer = spawnCmd(process.execPath, [entry], {
        env,
        cwd: path.join(__dirname, ".."),
      });
      webServerStartedByRunner = true;

      const exitEarly = new Promise((_, reject) => {
        webServer.once("exit", (code) => {
          if (code && code !== 0) {
            reject(
              new Error(
                `Port ${hostname}:${port} is already in use. Stop the running server or set PORT to a free port.`,
              ),
            );
          }
        });
        webServer.once("error", (err) => {
          if (err && err.code === "EADDRINUSE") {
            console.error(
              `Port ${hostname}:${port} is already in use. Stop the running server or set PORT to a free port.`,
            );
            if (isWin) {
              try {
                spawnCmd("cmd.exe", [
                  "/d",
                  "/s",
                  "/c",
                  "netstat -ano | findstr :" + port,
                ]);
              } catch {
                // best-effort only
              }
            }
            reject(
              new Error(
                `Port ${hostname}:${port} is already in use. Stop the running server or set PORT to a free port.`,
              ),
            );
          } else if (err) {
            reject(err);
          }
        });
      });

      await Promise.race([
        waitForHttpOk(webCheckUrl, webServerTimeoutMs, webServerPollIntervalMs),
        exitEarly,
      ]);
    } else {
      await waitForHttpOk(webCheckUrl, webServerTimeoutMs, webServerPollIntervalMs);
    }

    const code = await runPlaywright(specs);
    await cleanup();
    process.exit(code);
  } catch (err) {
    console.error(err);
    await cleanup();
    process.exit(1);
  }
}

main();
