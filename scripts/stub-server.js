// CJS-Stub für Port 3001 mit Health-Check
const http = require("http");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "127.0.0.1";
const store = new Map(); // Idempotency-Keys

function send(res, status, body, headers = {}) {
  const h = { "content-type": "application/problem+json", ...headers };
  res.writeHead(status, h);
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);
  const { method } = req;

  // Health 200
  if (u.pathname === "/" && method === "GET") {
    res.writeHead(200, { "content-type": "text/plain" });
    return res.end("ok");
  }
  if (u.pathname === "/health" && method === "GET") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }

  // 401 ohne Device-Proof
  if (u.pathname === "/rewards/redeem" && method === "POST") {
    const proof = req.headers["x-device-proof"];
    if (!proof) {
      return send(res, 401, {
        type: "about:blank",
        title: "Unauthorized",
        status: 401,
        error_code: "DEVICE_PROOF_MISSING",
        correlation_id: "stub-401",
      });
    }
    return send(res, 200, { ok: true }, { "content-type": "application/json" });
  }

  // 403 Plan-Gate
  if (u.pathname === "/referrals/link" && method === "GET") {
    return send(res, 403, {
      type: "about:blank",
      title: "Forbidden",
      status: 403,
      error_code: "PLAN_NOT_ALLOWED",
      correlation_id: "stub-403",
    });
  }

  // Idempotency: 1x201, dann 409
  if (u.pathname === "/stamps/claim" && method === "POST") {
    const key = req.headers["idempotency-key"] || "default-key";
    if (!store.has(key)) {
      store.set(key, true);
      return send(res, 201, {
        type: "about:blank",
        title: "Created",
        status: 201,
        error_code: "CREATED",
        correlation_id: "stub-201",
      });
    }
    return send(res, 409, {
      type: "about:blank",
      title: "Conflict",
      status: 409,
      error_code: "IDEMPOTENT_REPLAY",
      correlation_id: "stub-409",
    });
  }

  // 404
  return send(res, 404, {
    type: "about:blank",
    title: "Not Found",
    status: 404,
    error_code: "NOT_FOUND",
    correlation_id: "stub-404",
  });
});

server.on("error", (e) => {
  // eslint-disable-next-line no-console
  console.error("Stub-Server-Fehler:", e.message);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Stub listening on http://${HOST}:${PORT} (health: /health)`);
});
