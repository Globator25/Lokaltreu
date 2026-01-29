export type ParallelResult = {
  ok: boolean;
  status?: number;
  json?: unknown;
  headers?: Record<string, string>;
  error?: string;
};

function isResponse(value: unknown): value is Response {
  return typeof Response !== "undefined" && value instanceof Response;
}

function headersToRecord(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries());
}

async function readJsonSafe(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json") && !contentType.includes("application/problem+json")) {
    return undefined;
  }
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

export async function runParallel(
  n: number,
  fn: (index: number) => Promise<unknown>
): Promise<ParallelResult[]> {
  const tasks = Array.from({ length: n }, (_value, index) => fn(index));
  const settled = await Promise.allSettled(tasks);
  const results: ParallelResult[] = [];

  for (const item of settled) {
    if (item.status === "rejected") {
      results.push({ ok: false, error: item.reason instanceof Error ? item.reason.message : String(item.reason) });
      continue;
    }

    const value = item.value;
    if (isResponse(value)) {
      const json = await readJsonSafe(value);
      results.push({
        ok: value.ok,
        status: value.status,
        headers: headersToRecord(value.headers),
        json,
      });
      continue;
    }

    results.push({ ok: true });
  }

  return results;
}
