"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createDsrRequest, getDsrRequest } from "../../../lib/api/pwa/dsr";
import { applyFromQuery, getOrCreateCardId, getOrCreateTenantId } from "../../../lib/pwa-context";
import { defaultProblemType, toUserMessage, type Problem } from "../../../lib/api/problem";
import type { DsrCreateResponse, DsrStatusResponse } from "../../../lib/api/pwa/dsr";

const networkMessage =
  "Service nicht erreichbar. Bitte Prism/Backend starten und erneut versuchen.";

type CreateFormState = {
  cardId: string;
  requestType: "DELETE" | "ERASURE";
  reason: string;
  captchaToken: string;
};

const defaultCreateForm: CreateFormState = {
  cardId: "",
  requestType: "DELETE",
  reason: "",
  captchaToken: "",
};

function toDsrUserMessage(problem: Problem): string {
  if (
    problem.status === 503 &&
    (problem.title === "Network error" ||
      problem.detail === "Service not reachable. Please try again.")
  ) {
    return problem.correlation_id
      ? `${networkMessage} Support-Code: ${problem.correlation_id}`
      : networkMessage;
  }

  if (problem.error_code === "RATE_LIMITED") {
    const retryAfter = problem.retry_after;
    const baseMessage =
      typeof retryAfter === "number" && Number.isFinite(retryAfter)
        ? `Zu viele Anfragen. Bitte ${retryAfter}s warten und erneut versuchen.`
        : "Zu viele Anfragen. Bitte spaeter erneut versuchen.";
    return problem.correlation_id ? `${baseMessage} Support-Code: ${problem.correlation_id}` : baseMessage;
  }

  return toUserMessage(problem);
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("de-DE");
}

export default function PwaDsrPage() {
  const [tenantId, setTenantId] = useState<string>("");
  const [createForm, setCreateForm] = useState<CreateFormState>(defaultCreateForm);
  const [createResult, setCreateResult] = useState<DsrCreateResponse | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [statusId, setStatusId] = useState<string>("");
  const [statusResult, setStatusResult] = useState<DsrStatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    applyFromQuery(params);

    const tenant = getOrCreateTenantId();
    const card = getOrCreateCardId();

    setTenantId(tenant);
    setCreateForm((prev) => ({ ...prev, cardId: card }));

    const dsr = params.get("dsr");
    if (dsr) {
      setStatusId(dsr);
      void loadStatus(dsr);
    }
  }, []);

  const canSubmitCreate = useMemo(
    () => Boolean(createForm.cardId.trim()) && !loadingCreate,
    [createForm.cardId, loadingCreate],
  );

  async function loadStatus(dsrId: string) {
    if (!dsrId.trim()) return;
    setLoadingStatus(true);
    setStatusError(null);
    setStatusResult(null);

    try {
      const result = await getDsrRequest(dsrId.trim());
      if (!result) {
        setStatusError("Unbekannter Fehler. Bitte erneut versuchen.");
      } else if (result.ok) {
        setStatusResult(result.data);
      } else {
        setStatusError(toDsrUserMessage(result.problem));
      }
    } catch {
      setStatusError(
        toDsrUserMessage({
          type: defaultProblemType,
          status: 503,
          title: "Network error",
          detail: "Service not reachable. Please try again.",
        }),
      );
    } finally {
      setLoadingStatus(false);
    }
  }

  function updateQuery(dsrId: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("dsr", dsrId);
    window.history.replaceState(null, "", url.toString());
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmitCreate) return;

    setLoadingCreate(true);
    setCreateError(null);
    setCreateResult(null);

    const result = await createDsrRequest({
      cardId: createForm.cardId.trim(),
      requestType: createForm.requestType,
      reason: createForm.reason.trim() || undefined,
      captchaToken: createForm.captchaToken.trim() || undefined,
    });

    if (result.ok) {
      setCreateResult(result.data);
      setStatusId(result.data.dsrRequestId);
      updateQuery(result.data.dsrRequestId);
    } else {
      setCreateError(toDsrUserMessage(result.problem));
    }

    setLoadingCreate(false);
  }

  async function handleStatusSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loadingStatus) return;
    await loadStatus(statusId);
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">DSR-Anfrage</h1>
        <p className="text-sm text-neutral-600">
          Anfrage auf Loeschung oder Erasure ueber deine pseudonyme Card-ID.
        </p>
      </header>

      <section className="rounded-md border border-neutral-200 bg-white p-4 text-sm">
        <h2 className="mb-2 text-sm font-semibold">DSR-Anfrage stellen</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Card-ID
            <input
              data-testid="dsr-card-id"
              value={createForm.cardId}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, cardId: event.target.value }))
              }
              className="rounded-md border border-neutral-200 px-3 py-2 text-sm"
              placeholder="card-uuid"
              required
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium">
            Anfrage-Typ
            <select
              value={createForm.requestType}
              onChange={(event) =>
                setCreateForm((prev) => ({
                  ...prev,
                  requestType: event.target.value as CreateFormState["requestType"],
                }))
              }
              className="rounded-md border border-neutral-200 px-3 py-2 text-sm"
            >
              <option value="DELETE">DELETE</option>
              <option value="ERASURE">ERASURE</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium">
            Optionaler Hinweis
            <input
              value={createForm.reason}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, reason: event.target.value }))
              }
              className="rounded-md border border-neutral-200 px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </label>

          <details className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs">
            <summary className="cursor-pointer text-sm font-medium">
              Erweitert (Captcha)
            </summary>
            <label className="mt-2 flex flex-col gap-2 text-sm font-medium">
              X-Captcha-Token
              <input
                value={createForm.captchaToken}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, captchaToken: event.target.value }))
                }
                className="rounded-md border border-neutral-200 px-3 py-2 text-sm"
                placeholder="Optional"
              />
            </label>
          </details>

          <button
            type="submit"
            data-testid="dsr-submit"
            disabled={!canSubmitCreate}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loadingCreate ? "Bitte warten..." : "DSR-Anfrage senden"}
          </button>
        </form>

        {createResult ? (
          <div
            data-testid="dsr-confirmation"
            className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
          >
            <p className="font-semibold">Anfrage eingegangen</p>
            <p className="mt-1 text-xs" data-testid="dsr-request-id">
              {createResult.dsrRequestId}
            </p>
            <p className="mt-1 text-xs">Status: {createResult.status}</p>
            <p className="mt-1 text-xs">Erstellt: {formatDate(createResult.createdAt)}</p>
          </div>
        ) : null}

        {createError ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {createError}
          </div>
        ) : null}
      </section>

      <section className="rounded-md border border-neutral-200 bg-white p-4 text-sm">
        <h2 className="mb-2 text-sm font-semibold">Status pruefen</h2>
        <form onSubmit={handleStatusSubmit} className="space-y-4">
          <label className="flex flex-col gap-2 text-sm font-medium">
            DSR-ID
            <input
              data-testid="dsr-status-request-id"
              value={statusId}
              onChange={(event) => setStatusId(event.target.value)}
              className="rounded-md border border-neutral-200 px-3 py-2 text-sm"
              placeholder="dsr-uuid"
              required
            />
          </label>

          <button
            type="submit"
            data-testid="dsr-status-submit"
            disabled={loadingStatus || !statusId.trim()}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loadingStatus ? "Bitte warten..." : "Status abrufen"}
          </button>
        </form>

        {statusResult ? (
          <div
            data-testid="dsr-status-result"
            className="mt-4 rounded-md border border-neutral-200 bg-white p-3 text-xs text-neutral-800"
          >
            <div>DSR-ID: {statusResult.dsrRequestId}</div>
            <div>Status: {statusResult.status}</div>
            <div>Typ: {statusResult.requestType}</div>
            <div>Card-ID: {statusResult.subject.subject_id}</div>
            <div>Erstellt: {formatDate(statusResult.createdAt)}</div>
            {statusResult.fulfilledAt ? (
              <div>Erfuellt: {formatDate(statusResult.fulfilledAt)}</div>
            ) : (
              <div>Erfuellt: -</div>
            )}
          </div>
        ) : null}

        {statusError ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {statusError}
          </div>
        ) : null}
      </section>

      <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-700">
        <p className="mb-2 font-semibold">Hinweis</p>
        <p>
          Weitere Infos in unseren{" "}
          <a className="underline" href="/datenschutz">
            Datenschutzhinweisen
          </a>
          .
        </p>
        <p className="mt-2 text-[11px] text-neutral-500">Tenant: {tenantId}</p>
      </section>
    </main>
  );
}
