"use client";

import type { paths, components } from "@lokaltreu/types/src/openapi";

export type RegisterAdminRequest =
  paths["/admins/register"]["post"]["requestBody"]["content"]["application/json"];
export type RegisterAdmin201 =
  paths["/admins/register"]["post"]["responses"]["201"]["content"]["application/json"];
export type Problem = components["schemas"]["Problem"];

export type RegisterAdminResult =
  | { ok: true; data: RegisterAdmin201 }
  | { ok: false; problem: Problem };

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

export async function registerAdmin(
  req: RegisterAdminRequest,
): Promise<RegisterAdminResult> {
  const res = await fetch(`${baseUrl}/admins/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(req),
  });

  if (res.ok) {
    const data = (await res.json()) as RegisterAdmin201;
    return { ok: true, data };
  }

  const problem = (await res.json()) as Problem;
  return { ok: false, problem };
}
