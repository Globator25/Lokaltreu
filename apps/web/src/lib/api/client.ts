import createClient from "openapi-fetch";
import type { paths } from "@lokaltreu/types";

const baseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4010"; // Prism-Mock Default

export const api = createClient<paths>({ baseUrl });
