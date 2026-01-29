export type JsonResponse = {
  status: number;
  headers: Record<string, string>;
  json: unknown;
};

const DEFAULT_PRISM_BASE_URL = "http://127.0.0.1:4010";

function resolveBaseUrl(): string {
  const baseUrl = process.env.LOKALTREU_API_BASE_URL?.trim();
  if (baseUrl) {
    return baseUrl;
  }
  // Prism mock server default (see repo docs) uses port 4010.
  return DEFAULT_PRISM_BASE_URL;
}

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...extra,
  };
  const auth = process.env.LOKALTREU_TEST_AUTH?.trim();
  if (auth) {
    headers.authorization = auth;
  }
  return headers;
}

function headersToRecord(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries());
}

export async function postJson(
  path: string,
  body: unknown,
  headers?: Record<string, string>
): Promise<JsonResponse> {
  const baseUrl = resolveBaseUrl();
  if (!baseUrl) {
    throw new Error(
      "LOKALTREU_API_BASE_URL is required. Set it to a running API or Prism mock base URL."
    );
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: buildHeaders(headers),
    body: JSON.stringify(body),
  });
  const json: unknown = await res.json();
  return { status: res.status, headers: headersToRecord(res.headers), json };
}
