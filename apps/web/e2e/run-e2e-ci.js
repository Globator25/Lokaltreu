const { spawn } = require("child_process");
const http = require("http");

const isWin = process.platform === "win32";
const prismUrl = "http://127.0.0.1:4010/.well-known/jwks.json";
const prismTimeoutMs = 30000;
const prismPollIntervalMs = 500;

function spawnCmd(cmd, args, options = {}) {
  return spawn(cmd, args, { stdio: "inherit", ...options });
}

function startPrism() {
  const cmd = isWin ? "cmd.exe" : "npx";
  const args = isWin
    ? [
        "/d",
        "/s",
        "/c",
        "npx",
        "prism",
        "mock",
        "../api/openapi/lokaltreu-openapi-v2.0.yaml",
        "-p",
        "4010",
        "--host",
        "127.0.0.1",
      ]
    : [
        "prism",
        "mock",
        "../api/openapi/lokaltreu-openapi-v2.0.yaml",
        "-p",
        "4010",
        "--host",
        "127.0.0.1",
      ];

  return spawnCmd(cmd, args, { env: process.env });
}

function requestOnce(url, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode && res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForPrism() {
  const started = Date.now();
  while (Date.now() - started < prismTimeoutMs) {
    const ok = await requestOnce(prismUrl);
    if (ok) return;
    await new Promise((r) => setTimeout(r, prismPollIntervalMs));
  }
  throw new Error("Prism did not become ready in time.");
}

function isPrismAlreadyRunning() {
  return requestOnce(prismUrl, 2500);
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
  let prism = null;
  let prismStartedByRunner = false;

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

  try {
    if (!alreadyRunning) {
      await waitForPrism();
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
