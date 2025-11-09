const http = require("http");

const seen = new Set(); // für einfache Anti-Replay/Idempotency

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://127.0.0.1:3001");
  const path = u.pathname.toLowerCase();

  // Health
  if (path === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("ok");
  }

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks).toString("utf8");
  let json;
  try {
    json = body ? JSON.parse(body) : undefined;
  } catch {
    json = undefined;
  }

  if (req.method === "POST" && path.includes("/rewards/redeem")) {
    const problem = {
      type: "UNAUTHORIZED",
      title: "Unauthorized",
      status: 401,
      detail: "Missing or invalid proof",
    };
    res.writeHead(401, { "Content-Type": "application/problem+json" });
    return res.end(JSON.stringify(problem));
  }

  if (req.method === "GET" && path.includes("/referrals/link")) {
    const problem = {
      type: "PLAN_NOT_ALLOWED",
      title: "Plan not allowed",
      status: 403,
      detail: "Starter plan not allowed for this action",
    };
    res.writeHead(403, { "Content-Type": "application/problem+json" });
    return res.end(JSON.stringify(problem));
  }

  const key =
    req.headers["idempotency-key"] ||
    req.headers["x-idempotency-key"] ||
    req.headers["x-replay-key"] ||
    `${req.method} ${path}`;

  if (
    req.method === "POST" &&
    (path.includes("replay") ||
      req.headers["idempotency-key"] ||
      req.headers["x-idempotency-key"] ||
      req.headers["x-replay-key"])
  ) {
    if (seen.has(key)) {
      res.writeHead(409, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, conflict: true }));
    }
    seen.add(key);
    res.writeHead(201, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, created: true }));
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, echo: json ?? null }));
});

const host = "127.0.0.1";
const port = 3001;
server.listen(port, host, () => {
  console.log(`Stub listening on http://${host}:${port} (health: /health)`);
});
