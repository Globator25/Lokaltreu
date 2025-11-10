export function add(a: number, b: number): number {
  return a + b;
}

export function classify(status: number): "ok" | "error" | "unknown" {
  if (status >= 400) return "error";
  if (status >= 200) return "ok";
  return "unknown";
}
