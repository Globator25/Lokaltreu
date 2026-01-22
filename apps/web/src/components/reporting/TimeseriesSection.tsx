"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  getAdminReportingTimeseries,
  type Timeseries200,
  type TimeseriesQuery,
} from "../../lib/reporting";
import { parseProblem, toUserMessage } from "../../lib/api/problem";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: Timeseries200 };

const metricOptions: Array<{ value: TimeseriesQuery["metric"]; label: string }> = [
  { value: "stamps", label: "Stamps" },
  { value: "rewards", label: "Rewards" },
  { value: "referral_links", label: "Referral links" },
  { value: "referral_qualified", label: "Referral qualified" },
  { value: "referral_bonus_stamps", label: "Referral bonus stamps" },
];

const bucketOptions: Array<{ value: TimeseriesQuery["bucket"]; label: string }> = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

function ProblemInline({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
      <p className="font-semibold">{message}</p>
    </div>
  );
}

function sanitizeDateTime(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!trimmed.includes("T")) return undefined;
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  return trimmed;
}

export default function TimeseriesSection() {
  const [metric, setMetric] = useState<TimeseriesQuery["metric"]>("stamps");
  const [bucket, setBucket] = useState<TimeseriesQuery["bucket"]>("day");
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [validationError, setValidationError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const fromValue = useMemo(() => sanitizeDateTime(fromInput), [fromInput]);
  const toValue = useMemo(() => sanitizeDateTime(toInput), [toInput]);

  const isFromValid = fromInput.trim() === "" || fromValue !== undefined;
  const isToValid = toInput.trim() === "" || toValue !== undefined;

  useEffect(() => {
    if (!isFromValid || !isToValid) {
      setValidationError("Bitte gueltige ISO date-time Werte fuer from/to eingeben.");
      return;
    }

    setValidationError(null);
    setState({ status: "loading" });

    const query: TimeseriesQuery = { metric, bucket };
    if (fromValue) query.from = fromValue;
    if (toValue) query.to = toValue;

    let mounted = true;
    getAdminReportingTimeseries(query)
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
  }, [metric, bucket, fromValue, toValue, isFromValid, isToValid, reloadToken]);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-2 text-sm text-neutral-700">
          Metric
          <select
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900"
            value={metric}
            onChange={(event) =>
              setMetric(event.target.value as TimeseriesQuery["metric"])
            }
          >
            {metricOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm text-neutral-700">
          Bucket
          <select
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900"
            value={bucket}
            onChange={(event) =>
              setBucket(event.target.value as TimeseriesQuery["bucket"])
            }
          >
            {bucketOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm text-neutral-700">
          From (ISO date-time)
          <input
            type="text"
            value={fromInput}
            onChange={(event) => setFromInput(event.target.value)}
            placeholder="2025-09-01T00:00:00Z"
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-neutral-700">
          To (ISO date-time)
          <input
            type="text"
            value={toInput}
            onChange={(event) => setToInput(event.target.value)}
            placeholder="2025-09-30T23:59:59Z"
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900"
          />
        </label>
      </div>

      {validationError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {validationError}
        </div>
      ) : null}

      {state.status === "loading" ? (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
          <div className="h-4 w-40 rounded-full bg-neutral-200" />
          <div className="mt-4 h-32 rounded-2xl bg-neutral-200" />
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="flex flex-col gap-3">
          <ProblemInline message={state.message} />
          <div>
            <button
              type="button"
              onClick={() => setReloadToken((value) => value + 1)}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Erneut versuchen
            </button>
          </div>
        </div>
      ) : null}

      {state.status === "success" ? (
        state.data.series.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
            Keine Daten fuer den gewaehlten Zeitraum.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 text-left">Start</th>
                  <th className="px-4 py-3 text-left">End</th>
                  <th className="px-4 py-3 text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {state.data.series.map((row) => (
                  <tr key={`${row.start}-${row.end}`} className="border-t">
                    <td className="px-4 py-3 text-neutral-700">{row.start}</td>
                    <td className="px-4 py-3 text-neutral-700">{row.end}</td>
                    <td className="px-4 py-3 text-right font-semibold text-neutral-900">
                      {row.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </div>
  );
}
