"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  getAdminReportingSummary,
  type Summary200,
} from "../../../lib/reporting";
import { parseProblem, toUserMessage } from "../../../lib/api/problem";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: Summary200 };

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value}%`;
}

function formatNullableNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return String(value);
}

function ProblemInline({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
      <p className="font-semibold">{message}</p>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="h-4 w-32 rounded-full bg-neutral-200" />
        <div className="h-8 w-40 rounded-full bg-neutral-200" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-12 rounded-xl bg-neutral-200" />
          <div className="h-12 rounded-xl bg-neutral-200" />
          <div className="h-12 rounded-xl bg-neutral-200" />
        </div>
      </div>
    </div>
  );
}

function MetricBlock({
  title,
  day,
  week,
  month,
}: {
  title: string;
  day: number;
  week: number;
  month: number;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-3 text-sm text-neutral-800">
        <div>
          <p className="text-xs text-neutral-500">Heute</p>
          <p className="text-lg font-semibold">{day}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-500">Woche</p>
          <p className="text-lg font-semibold">{week}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-500">Monat</p>
          <p className="text-lg font-semibold">{month}</p>
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 shadow-sm">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-neutral-900">{title}</h2>
        {description ? (
          <p className="text-sm text-neutral-600">{description}</p>
        ) : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

const TimeseriesSection = dynamic(
  () => import("../../../components/reporting/TimeseriesSection"),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
        <div className="h-4 w-40 rounded-full bg-neutral-200" />
        <div className="mt-4 h-32 rounded-2xl bg-neutral-200" />
      </div>
    ),
  },
);

export default function AdminDashboardPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const loadSummary = React.useCallback(() => {
    let mounted = true;
    setState({ status: "loading" });
    getAdminReportingSummary()
      .then((data) => {
        if (mounted) setState({ status: "success", data });
      })
      .catch((error) => {
        if (!mounted) return;
        const status =
          error && typeof error === "object" && "status" in error && typeof error.status === "number"
            ? error.status
            : 500;
        const parsed = parseProblem(error, status);
        const message = toUserMessage(parsed);
        setState({ status: "error", message });
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const cleanup = loadSummary();
    return cleanup;
  }, [loadSummary]);

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Admin
          </p>
          <h1 className="text-3xl font-semibold">Reporting Dashboard</h1>
          <p className="text-sm text-neutral-600">
            Überblick über die wichtigsten KPIs der letzten Zeiträume.
          </p>
        </header>

        {state.status === "loading" ? (
          <>
            <LoadingCard />
            <LoadingCard />
          </>
        ) : null}

        {state.status === "error" ? (
          <div className="flex flex-col gap-3">
            <ProblemInline message={state.message} />
            <div>
              <button
                type="button"
                onClick={loadSummary}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Erneut versuchen
              </button>
            </div>
          </div>
        ) : null}

        {state.status === "success" ? (
          <>
            <SectionCard
              title="Stempel & Prämien"
              description="Aktivität nach Zeiträumen"
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <MetricBlock
                  title="Stempel"
                  day={state.data.stamps.day}
                  week={state.data.stamps.week}
                  month={state.data.stamps.month}
                />
                <MetricBlock
                  title="Prämien"
                  day={state.data.rewards.day}
                  week={state.data.rewards.week}
                  month={state.data.rewards.month}
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Referral-KPIs"
              description="Einladungen, Qualifizierung und Bonus-Stempel"
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <MetricBlock
                  title="Links issued"
                  day={state.data.referrals.linksIssued.day}
                  week={state.data.referrals.linksIssued.week}
                  month={state.data.referrals.linksIssued.month}
                />
                <MetricBlock
                  title="Qualified"
                  day={state.data.referrals.qualified.day}
                  week={state.data.referrals.qualified.week}
                  month={state.data.referrals.qualified.month}
                />
                <MetricBlock
                  title="Bonus stamps"
                  day={state.data.referrals.bonusStamps.day}
                  week={state.data.referrals.bonusStamps.week}
                  month={state.data.referrals.bonusStamps.month}
                />
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Conversion rate
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-sm text-neutral-800">
                    <div>
                      <p className="text-xs text-neutral-500">Heute</p>
                      <p className="text-lg font-semibold">
                        {formatPercent(state.data.referrals.conversionRate.day)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Woche</p>
                      <p className="text-lg font-semibold">
                        {formatPercent(state.data.referrals.conversionRate.week)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Monat</p>
                      <p className="text-lg font-semibold">
                        {formatPercent(state.data.referrals.conversionRate.month)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Geräte & Kampagnen">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Active devices
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {state.data.deviceActivity.activeDevices}
                  </p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Active campaigns
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {state.data.activeCampaigns}
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Plan-Nutzung"
              description="Monatlicher Verbrauch und Upgrade-Signale"
            >
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Period
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {state.data.planUsage.period}
                  </p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Stamps used
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {state.data.planUsage.stampsUsed}
                  </p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Stamps limit
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {formatNullableNumber(state.data.planUsage.stampsLimit)}
                  </p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Usage percent
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {formatPercent(state.data.planUsage.usagePercent)}
                  </p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Warning emitted
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {state.data.planUsage.warningEmitted ? "Yes" : "No"}
                  </p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Upgrade signal
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {state.data.planUsage.upgradeSignalEmitted ? "Yes" : "No"}
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Zeitreihen"
              description="Zeitliche Entwicklung der wichtigsten Metriken."
            >
              <TimeseriesSection />
            </SectionCard>
          </>
        ) : null}
      </div>
    </div>
  );
}
