import express from "express";
import { problem } from "@lokaltreu/config";

const app = express();
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/error-demo", (_req, _res) => { problem(400, "Bad Request", "demo", "BAD_REQUEST"); });

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`[api] http://localhost:${port}`));
export default app;
