"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { components } from "@lokaltreu/types";
import { getAdminPlan } from "../../../lib/api/adminPlan";
import {
  getCurrentOffer,
  putCurrentOffer,
  type OfferUpsertRequest,
} from "../../../lib/api/adminOffer";
import { defaultProblemType, toUserMessage, type Problem } from "../../../lib/api/problem";

type AdminPlanResponse = components["schemas"]["AdminPlanResponse"];
type OfferCurrentResponse = components["schemas"]["OfferCurrentResponse"];

type LoadState =
  | { status: "idle" | "loading" }
  | { status: "error"; error: Problem }
  | { status: "success"; plan: AdminPlanResponse; offer: OfferCurrentResponse };

type OfferDraft = {
  title: string;
  body: string;
  active: boolean;
  activeFrom: string;
  activeTo: string;
};

const emptyOfferDraft: OfferDraft = {
  title: "",
  body: "",
  active: false,
  activeFrom: "",
  activeTo: "",
};

function formatNullable(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return String(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value}%`;
}

function pickProblem(
  planResult: Awaited<ReturnType<typeof getAdminPlan>>,
  offerResult: Awaited<ReturnType<typeof getCurrentOffer>>,
): Problem | null {
  if (!planResult.ok) return planResult.problem;
  if (!offerResult.ok) return offerResult.problem;
  return null;
}

function ProblemInline({ problem }: { problem: Problem }) {
  const message = toUserMessage(problem);
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
      <p className="font-semibold">{message}</p>
    </div>
  );
}

export default function AdminPlanPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [offerDraft, setOfferDraft] = useState<OfferDraft>(emptyOfferDraft);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<Problem | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setState({ status: "loading" });
    Promise.all([getAdminPlan(), getCurrentOffer()])
      .then(([planResult, offerResult]) => {
        if (!mounted) return;
        const problem = pickProblem(planResult, offerResult);
        if (problem) {
          setState({ status: "error", error: problem });
          return;
        }
        const plan = planResult.ok ? planResult.data : null;
        const offer = offerResult.ok ? offerResult.data : null;
        if (!plan || !offer) {
          setState({
            status: "error",
            error: { type: defaultProblemType, status: 500, title: "Unexpected response" },
          });
          return;
        }
        setState({ status: "success", plan, offer });
        const current = offer.offer;
        if (current) {
          setOfferDraft({
            title: current.title ?? "",
            body: current.body ?? "",
            active: current.active ?? false,
            activeFrom: current.activeFrom ?? "",
            activeTo: current.activeTo ?? "",
          });
        } else {
          setOfferDraft(emptyOfferDraft);
        }
      })
      .catch(() => {
        if (!mounted) return;
        setState({
          status: "error",
          error: {
            type: defaultProblemType,
            status: 503,
            title: "Network error",
            detail: "Service not reachable.",
          },
        });
      });

    return () => {
      mounted = false;
    };
  }, []);

  const usage = useMemo(() => {
    if (state.status !== "success") return null;
    return state.plan.upgradeHint?.usage ?? null;
  }, [state]);

  const ctaUrl =
    state.status === "success" ? state.plan.upgradeHint?.ctaUrl ?? null : null;
  const ctaText =
    state.status === "success" ? state.plan.upgradeHint?.message ?? null : null;

  async function handleSave(payload: OfferUpsertRequest) {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const result = await putCurrentOffer(payload, crypto.randomUUID());
      if (!result.ok) {
        setSaveError(result.problem);
        return;
      }
      setSaveSuccess("Offer updated.");
      setState((prev) =>
        prev.status === "success" ? { ...prev, offer: result.data } : prev,
      );
    } finally {
      setSaving(false);
    }
  }

  async function onSaveOffer() {
    const payload: OfferUpsertRequest = {
      offer: {
        title: offerDraft.title.trim(),
        body: offerDraft.body.trim() || null,
        active: offerDraft.active ? true : null,
        activeFrom: offerDraft.activeFrom || null,
        activeTo: offerDraft.activeTo || null,
      },
    };
    await handleSave(payload);
  }

  async function onClearOffer() {
    const payload: OfferUpsertRequest = { offer: null };
    await handleSave(payload);
  }

  if (state.status === "idle" || state.status === "loading") {
    return (
      <div className="min-h-screen bg-white text-neutral-900">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <div className="h-6 w-40 rounded-full bg-neutral-200" />
          <div className="mt-4 h-10 w-56 rounded-full bg-neutral-200" />
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    const problem = state.error;
    if (problem.status === 401) {
      return (
        <div className="min-h-screen bg-white text-neutral-900">
          <div className="mx-auto max-w-3xl px-6 py-10">
            <h1 className="text-2xl font-semibold">Unauthorized</h1>
            <p className="mt-3 text-sm text-neutral-600">
              Bitte melde dich erneut an.
            </p>
          </div>
        </div>
      );
    }
    if (problem.status === 403 && problem.error_code === "PLAN_NOT_ALLOWED") {
      return (
        <div className="min-h-screen bg-white text-neutral-900">
          <div className="mx-auto max-w-3xl px-6 py-10">
            <h1 className="text-2xl font-semibold">Plan nicht erlaubt</h1>
            <p className="mt-3 text-sm text-neutral-600">
              Diese Funktion ist in deinem aktuellen Plan nicht enthalten.
            </p>
            {ctaUrl ? (
              <a
                href={ctaUrl}
                className="mt-4 inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
              >
                {ctaText ?? "Upgrade starten"}
              </a>
            ) : null}
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-white text-neutral-900">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <ProblemInline problem={problem} />
        </div>
      </div>
    );
  }

  if (state.status !== "success") {
    return null;
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Admin
          </p>
          <h1 className="text-3xl font-semibold">Plan & Angebote</h1>
          <p className="text-sm text-neutral-600">
            Aktueller Plan, Limits und Angebotsverwaltung.
          </p>
        </header>

        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-neutral-900">Plan</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Plan code
              </p>
              <p className="mt-2 text-lg font-semibold">{state.plan.planCode}</p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Features
              </p>
              <p className="mt-2 text-sm text-neutral-700">
                Referral: {state.plan.features.referral ? "Yes" : "No"}
              </p>
              <p className="text-sm text-neutral-700">
                Offers: {state.plan.features.offers ? "Yes" : "No"}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Limits (Stamps)
              </p>
              <p className="mt-2 text-sm text-neutral-700">
                {formatNullable(usage?.stampsUsed)} /{" "}
                {formatNullable(state.plan.limits.stampsPerMonth)}
              </p>
              <p className="text-sm text-neutral-500">
                {formatPercent(usage?.usagePercent)}
              </p>
            </div>
          </div>
        </section>

        {state.plan.upgradeHint ? (
          <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-neutral-900">Upgrade-Hinweis</h2>
            <p className="mt-2 text-sm text-neutral-700">{ctaText}</p>
            {ctaUrl ? (
              <a
                href={ctaUrl}
                className="mt-4 inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Upgrade starten
              </a>
            ) : null}
          </section>
        ) : null}

        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-neutral-900">Aktuelles Angebot</h2>
          <div className="mt-4 grid gap-4">
            <label className="text-sm text-neutral-700">
              Title
              <input
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                value={offerDraft.title}
                onChange={(event) =>
                  setOfferDraft((prev) => ({ ...prev, title: event.target.value }))
                }
              />
            </label>
            <label className="text-sm text-neutral-700">
              Body
              <textarea
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                rows={3}
                value={offerDraft.body}
                onChange={(event) =>
                  setOfferDraft((prev) => ({ ...prev, body: event.target.value }))
                }
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={offerDraft.active}
                onChange={(event) =>
                  setOfferDraft((prev) => ({ ...prev, active: event.target.checked }))
                }
              />
              Active
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm text-neutral-700">
                Active from
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  value={offerDraft.activeFrom}
                  onChange={(event) =>
                    setOfferDraft((prev) => ({ ...prev, activeFrom: event.target.value }))
                  }
                />
              </label>
              <label className="text-sm text-neutral-700">
                Active to
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  value={offerDraft.activeTo}
                  onChange={(event) =>
                    setOfferDraft((prev) => ({ ...prev, activeTo: event.target.value }))
                  }
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onSaveOffer}
                disabled={saving}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save offer"}
              </button>
              <button
                type="button"
                onClick={onClearOffer}
                disabled={saving}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 disabled:opacity-60"
              >
                Clear offer
              </button>
            </div>
            {saveSuccess ? (
              <p className="text-sm text-green-700">{saveSuccess}</p>
            ) : null}
            {saveError ? <ProblemInline problem={saveError} /> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
