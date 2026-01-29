"use client";

import React, { useEffect, useState } from "react";
import { claimStamp } from "../../../lib/pwa-api";
import type { components } from "@lokaltreu/types";

type Problem = components["schemas"]["Problem"];

type ScanResult = {
  ok: boolean;
  payload?: unknown;
  problem?: Problem;
};

async function tryDecodeFromCamera(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (!("BarcodeDetector" in window)) return null;

  try {
    // @ts-expect-error BarcodeDetector is not in lib.dom types for all TS targets.
    const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });

    const video = document.createElement("video");
    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    await video.play();

    // Give the camera a short moment to render a frame.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const detections = await detector.detect(video);
    stream.getTracks().forEach((track) => track.stop());

    if (detections && detections.length > 0 && detections[0]?.rawValue) {
      return detections[0].rawValue as string;
    }
  } catch {
    // Ignore camera or detector errors and fall back to manual input.
  }

  return null;
}

export default function PwaScanPage() {
  const [qrToken, setQrToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanSupported, setScanSupported] = useState(false);

  useEffect(() => {
    setScanSupported(typeof window !== "undefined" && "BarcodeDetector" in window);
  }, []);

  async function handleScan() {
    if (loading) return;
    setLoading(true);
    setResult(null);

    const detected = await tryDecodeFromCamera();
    if (detected) {
      setQrToken(detected);
    }

    setLoading(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const token = qrToken.trim();
    if (!token) return;

    setLoading(true);
    setResult(null);

    const response = await claimStamp(token);
    if (response.ok) {
      setResult({ ok: true, payload: response.data });
    } else {
      setResult({ ok: false, problem: response.problem });
    }

    setLoading(false);
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Stempel einloesen</h1>
        <p className="text-sm text-neutral-600">
          Scanne einen QR-Code oder gib den Token manuell ein.
        </p>
      </header>

      {scanSupported ? (
        <button
          type="button"
          onClick={handleScan}
          disabled={loading}
          className="rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
        >
          {loading ? "Kamera wird geoeffnet..." : "QR-Code scannen"}
        </button>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex flex-col gap-2 text-sm font-medium">
          QR-Token
          <input
            value={qrToken}
            onChange={(event) => setQrToken(event.target.value)}
            data-testid="pwa-scan-token"
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm"
            placeholder="qrToken"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading || !qrToken.trim()}
          data-testid="pwa-scan-submit"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Bitte warten..." : "Stempel einloesen"}
        </button>
      </form>

      {result?.ok ? (
        <section
          className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
          data-testid="pwa-scan-success"
        >
          <h2 className="mb-2 text-sm font-semibold">Erfolg</h2>
          <p className="text-sm">Stempel erfolgreich eingeloest.</p>
          {result.payload ? (
            <pre className="mt-3 whitespace-pre-wrap break-words text-xs text-emerald-900">
              {JSON.stringify(result.payload, null, 2)}
            </pre>
          ) : null}
        </section>
      ) : null}

      {result && !result.ok && result.problem ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <h2 className="mb-2 text-sm font-semibold">Fehler</h2>
          <p className="text-sm">
            {result.problem.detail ?? result.problem.title ?? "Unbekannter Fehler."}
          </p>
          {result.problem.correlation_id ? (
            <p className="mt-2 text-xs">
              correlation_id: {result.problem.correlation_id}
            </p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
