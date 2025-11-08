// Node >=18
import express from "express";

const app = express();
app.use(express.json());

// Health
app.get("/health", (_req, res) => res.status(200).send("ok"));

// Plan-Gate: immer 403
app.get("/referrals/link", (_req, res) => {
  res.status(403).json({
    type: "PLAN_NOT_ALLOWED",
    title: "Forbidden",
    status: 403,
  });
});

// Device-Proof: 401 wenn Header fehlt
app.post("/rewards/redeem", (req, res) => {
  const proof = req.header("x-device-proof");
  if (!proof) {
    return res.status(401).json({
      type: "UNAUTHORIZED",
      title: "Missing device proof",
      status: 401,
    });
  }
  return res.status(200).json({ ok: true });
});

// Anti-Replay / Idempotency: erste Anfrage 201, weitere 409
const seen = new Map(); // key -> timestamp
app.post("/stamps/claim", (req, res) => {
  const idem = req.header("Idempotency-Key");
  if (!idem) return res.status(400).json({ type: "BAD_REQUEST" });
  if (seen.has(idem)) return res.status(409).json({ type: "CONFLICT" });
  seen.set(idem, Date.now());
  return res.status(201).json({ stampId: "stub-1" });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`[stub] http://localhost:${port}`);
});
