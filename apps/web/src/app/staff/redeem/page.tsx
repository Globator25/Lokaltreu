"use client";

import { useState } from "react";
import { buildIdempotencyKey } from "../../../lib/api/staff/base";
import { redeemReward } from "../../../lib/api/staff/rewards";
import { toStaffUserMessage } from "../../../lib/api/staff/problem";
import { ProblemBanner } from "../../../components/staff/ProblemBanner";

type RedeemFormState = {
  redeemToken: string;
  deviceKey: string;
  deviceTimestamp: string;
  deviceProof: string;
};

const emptyState: RedeemFormState = {
  redeemToken: "",
  deviceKey: "",
  deviceTimestamp: "",
  deviceProof: "",
};

function isUnixSecondsTimestamp(value: string): boolean {
  if (!/^[0-9]+$/.test(value)) return false;
  if (value.length >= 13) return false;
  return value.length >= 9;
}

export default function StaffRedeemPage() {
  const [form, setForm] = useState<RedeemFormState>(emptyState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<unknown | null>(null);

  function updateField(key: keyof RedeemFormState) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
    };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setPayload(null);

    if (!isUnixSecondsTimestamp(form.deviceTimestamp.trim())) {
      setError(
        form.deviceTimestamp.trim().length >= 13
          ? "Timestamp muss in Sekunden (10-stellig) angegeben werden."
          : "Ungueltiger Timestamp. Bitte Sekunden als Zahl eingeben.",
      );
      setLoading(false);
      return;
    }

    const result = await redeemReward({
      redeemToken: form.redeemToken.trim(),
      idempotencyKey: buildIdempotencyKey("staff-redeem"),
      deviceKey: form.deviceKey.trim(),
      deviceTimestamp: form.deviceTimestamp.trim(),
      deviceProof: form.deviceProof.trim(),
    });

    if (result.ok) {
      setPayload(result.data);
    } else {
      setError(toStaffUserMessage(result.problem));
    }

    setLoading(false);
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Praemie einloesen</h1>
        <p className="text-sm text-neutral-600">
          Redeem-Token und Device-Proof eingeben.
        </p>
      </header>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Redeem Token
          <input
            value={form.redeemToken}
            onChange={updateField("redeemToken")}
            data-testid="staff-redeem-token"
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm"
            required
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium">
          Device Key
          <input
            value={form.deviceKey}
            onChange={updateField("deviceKey")}
            data-testid="staff-redeem-device-key"
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm"
            required
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium">
          Device Timestamp (seconds)
          <input
            value={form.deviceTimestamp}
            onChange={updateField("deviceTimestamp")}
            data-testid="staff-redeem-device-timestamp"
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm"
            required
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium">
          Device Proof
          <input
            value={form.deviceProof}
            onChange={updateField("deviceProof")}
            data-testid="staff-redeem-device-proof"
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm"
            type="password"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          data-testid="staff-redeem-submit"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Bitte warten..." : "Praemie einloesen"}
        </button>
      </form>

      {error ? <ProblemBanner message={error} /> : null}

      {payload ? (
        <section
          className="rounded-md border border-neutral-200 bg-white p-4 text-sm"
          data-testid="staff-redeem-payload"
        >
          <h2 className="mb-2 text-sm font-semibold">Antwort</h2>
          <pre className="whitespace-pre-wrap break-words text-xs text-neutral-700">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </section>
      ) : null}

      {/* Spot-check: Enter ms timestamp (13+ digits) to verify client-side validation; valid seconds should call API. */}
    </main>
  );
}
