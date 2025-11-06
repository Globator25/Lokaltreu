const { randomUUID } = (() => { try { return require("node:crypto"); } catch { return { randomUUID: null }; } })();
function normalize(input) {
  if (typeof input === "object" && input && "status" in input) return input;
  const [status, title, detail, error_code] = arguments;
  return {
    type: "about:blank",
    title: title ?? "Error",
    status: typeof status === "number" ? status : 500,
    detail,
    error_code: error_code ?? "UNKNOWN",
    correlation_id: typeof randomUUID === "function" ? randomUUID() : String(Date.now())
  };
}
function throwWithCause(p) { const err = new Error(p.title); err.name = "HttpProblem"; err.cause = p; throw err; }
function problem(a, b, c, d) { return throwWithCause(normalize(a, b, c, d)); }
const RETENTION_DAYS = 180;
module.exports = { problem, RETENTION_DAYS };
