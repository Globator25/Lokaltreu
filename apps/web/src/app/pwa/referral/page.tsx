"use client";

import React, { useEffect, useState } from "react";
import {
  applyFromQuery,
  getOrCreateCardId,
  getOrCreateTenantId,
} from "../../../lib/pwa-context";
import { getReferralLink } from "../../../lib/pwa-api";
import type { components } from "@lokaltreu/types";

type Problem = components["schemas"]["Problem"];

function shortId(value: string): string {
  if (!value) return "n/a";
  return value.length <= 8 ? value : `${value.slice(0, 8)}...`;
}

export default function PwaReferralPage() {
  const [tenantId, setTenantId] = useState<string>("");
  const [cardId, setCardId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    applyFromQuery(params);

    setTenantId(getOrCreateTenantId());
    setCardId(getOrCreateCardId());
  }, []);

  async function handleLoad() {
    if (loading) return;
    setLoading(true);
    setProblem(null);
    setLink(null);

    const result = await getReferralLink();
    if (result.ok) {
      setLink(result.data.refCodeURL);
    } else {
      setProblem(result.problem);
    }

    setLoading(false);
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Referral-Link</h1>
        <p className="text-sm text-neutral-600">
          Link fuer Einladungen abrufen (Mock-first).
        </p>
      </header>

      <section className="rounded-md border border-neutral-200 bg-white p-4 text-sm">
        <h2 className="mb-2 text-sm font-semibold">Debug (pseudonym)</h2>
        <div className="flex flex-col gap-1 text-xs text-neutral-700">
          <span>tenantId: {shortId(tenantId)}</span>
          <span>cardId: {shortId(cardId)}</span>
        </div>
      </section>

      <button
        type="button"
        onClick={handleLoad}
        disabled={loading}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Bitte warten..." : "Referral-Link laden"}
      </button>

      {link ? (
        <section className="rounded-md border border-neutral-200 bg-white p-4 text-sm">
          <h2 className="mb-2 text-sm font-semibold">Dein Link</h2>
          <a
            href={link}
            className="break-words text-sm text-blue-700 underline"
            target="_blank"
            rel="noreferrer"
          >
            {link}
          </a>
        </section>
      ) : null}

      {problem ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <h2 className="mb-2 text-sm font-semibold">Fehler</h2>
          <p className="text-sm">
            {problem.detail ?? problem.title ?? "Unbekannter Fehler."}
          </p>
          {problem.correlation_id ? (
            <p className="mt-2 text-xs">correlation_id: {problem.correlation_id}</p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

