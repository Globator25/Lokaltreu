"use client";

import React, { useState } from "react";
import { buildIdempotencyKey } from "../../../lib/api/staff/base";
import { createStampToken } from "../../../lib/api/staff/stamps";
import { toStaffUserMessage } from "../../../lib/api/staff/problem";
import { ProblemBanner } from "../../../components/staff/ProblemBanner";

type StampFormState = {
  deviceKey: string;
  deviceTimestamp: string;
  deviceProof: string;
};

const emptyForm: StampFormState = {
  deviceKey: "",
  deviceTimestamp: "",
  deviceProof: "",
};

function isValidTimestamp(value: string): boolean {
  const trimmed = value.trim();
  return /^[0-9]+$/.test(trimmed) && trimmed.length >= 10;
}

function getValidationMessage(form: StampFormState): string | null {
  if (!form.deviceKey.trim()) {
    return "Device Key ist erforderlich.";
  }
  const ts = form.deviceTimestamp.trim();
  if (!ts) {
    return "Device Timestamp ist erforderlich.";
  }
  if (!/^[0-9]+$/.test(ts) || ts.length < 10) {
    return "Device Timestamp muss Unix-Sekunden (mind. 10 Ziffern) sein.";
  }
  if (!form.deviceProof.trim()) {
    return "Device Proof ist erforderlich.";
  }
  return null;
}

export default function StaffStampsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<unknown | null>(null);
  const [form, setForm] = useState<StampFormState>(emptyForm);

  function updateField(key: keyof StampFormState) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
    };
  }

  async function handleCreate() {
    if (loading) return;
    if (!form.deviceKey.trim() || !form.deviceTimestamp.trim() || !form.deviceProof.trim()) {
      return;
    }
    if (!isValidTimestamp(form.deviceTimestamp)) {
      return;
    }

    const validationMessage = getValidationMessage(form);
    if (validationMessage) {
      setError(null);
      setPayload(null);
      return;
    }

    setLoading(true);
    setError(null);
    setPayload(null);

    const result = await createStampToken({
      idempotencyKey: buildIdempotencyKey("staff-stamps"),
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
        <h1 className="text-2xl font-semibold">Stempel vergeben</h1>
        <p className="text-sm text-neutral-600">
          Erzeuge einen neuen Code fuer den Kunden.
        </p>
      </header>

      <button
        type="button"
        onClick={handleCreate}
        disabled={loading || Boolean(getValidationMessage(form))}
        data-testid="staff-stamps-submit"
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Bitte warten..." : "Neuen Code erzeugen"}
      </button>

      <div className="grid gap-4">
        <label className="flex flex-col gap-2 text-sm font-medium">
          Device Key
          <input
            value={form.deviceKey}
            onChange={updateField("deviceKey")}
            data-testid="staff-stamps-device-key"
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm"
            required
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium">
          Device Timestamp (seconds)
          <input
            value={form.deviceTimestamp}
            onChange={updateField("deviceTimestamp")}
            data-testid="staff-stamps-device-timestamp"
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm"
            required
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium">
          Device Proof
          <input
            value={form.deviceProof}
            onChange={updateField("deviceProof")}
            data-testid="staff-stamps-device-proof"
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm"
            type="password"
            required
          />
        </label>
      </div>

      {getValidationMessage(form) ? (
        <p className="text-sm text-amber-700">{getValidationMessage(form)}</p>
      ) : null}

      {error ? <ProblemBanner message={error} /> : null}

      {payload ? (
        <section
          className="rounded-md border border-neutral-200 bg-white p-4 text-sm"
          data-testid="staff-stamps-payload"
        >
          <h2 className="mb-2 text-sm font-semibold">Token</h2>
          <pre className="whitespace-pre-wrap break-words text-xs text-neutral-700">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </section>
      ) : null}
    </main>
  );
}
