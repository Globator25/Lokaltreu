import createClient from "openapi-fetch";
import type { paths } from "@lokaltreu/types";

/**
 * Creates a typed API client that defaults to the Prism mock server.
 */
export function makeApiClient(baseUrl?: string) {
  const resolvedBaseUrl =
    baseUrl ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://localhost:4010/v1";

  return createClient<paths>({
    baseUrl: resolvedBaseUrl,
  });
}

export type ApiClient = ReturnType<typeof makeApiClient>;
