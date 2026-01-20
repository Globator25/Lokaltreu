"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createDeviceRegistrationLink } from "../../lib/api/devices";
import { toUserMessage } from "../../lib/api/problem";

type InviteStatus = "idle" | "loading" | "success" | "error";

type InviteDeviceModalProps = {
  open: boolean;
  onClose: () => void;
};

const defaultError = "Link konnte nicht erzeugt werden. Bitte erneut versuchen.";

export function InviteDeviceModal({ open, onClose }: InviteDeviceModalProps) {
  const [status, setStatus] = useState<InviteStatus>("idle");
  const [link, setLink] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (open) {
      setStatus("idle");
      setLink(undefined);
      setErrorMessage(undefined);
    }
  }, [open]);

  const canCopy = useMemo(() => {
    return Boolean(
      link && typeof navigator !== "undefined" && Boolean(navigator.clipboard),
    );
  }, [link]);

  const handleGenerate = async () => {
    if (status === "loading") return;
    setStatus("loading");
    setErrorMessage(undefined);
    setLink(undefined);

    const result = await createDeviceRegistrationLink();
    if (result.ok) {
      setStatus("success");
      setLink(result.data.linkUrl);
      return;
    }

    setStatus("error");
    setErrorMessage(toUserMessage(result.problem));
  };

  const handleCopy = async () => {
    if (!link || typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(link);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold">Registrierungslink erzeugen</h3>
            <p className="text-sm text-neutral-600">Einmalig, 15 Minuten gueltig.</p>
          </div>

          {status === "idle" && (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
              Erzeuge einen Link fuer ein neues Mitarbeiter-Geraet.
            </div>
          )}

          {status === "loading" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Link wird erzeugt ...
            </div>
          )}

          {status === "error" && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {errorMessage ?? defaultError}
            </div>
          )}

          {status === "success" && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <div className="flex flex-col gap-3">
                <div className="break-all">{link ?? "https://example.invalid/device-register"}</div>
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!canCopy}
                  className="rounded-md border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Link kopieren
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700"
            >
              Schliessen
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={status === "loading"}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Link erzeugen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
