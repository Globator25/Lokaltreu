"use client";

import React, { useMemo, useState } from "react";
import { toUiProblemMessage, type Problem } from "../../lib/api/problem";

type ProblemToastProps = {
  problem: Problem;
  className?: string;
};

type SeverityTone = {
  container: string;
  title: string;
  message: string;
  support: string;
  copyButton: string;
};

const toneBySeverity: Record<ReturnType<typeof toUiProblemMessage>["severity"], SeverityTone> = {
  error: {
    container: "border-red-200 bg-red-50",
    title: "text-red-900",
    message: "text-red-800",
    support: "text-red-700",
    copyButton:
      "border-red-300 text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60",
  },
  warning: {
    container: "border-amber-200 bg-amber-50",
    title: "text-amber-900",
    message: "text-amber-800",
    support: "text-amber-700",
    copyButton:
      "border-amber-300 text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60",
  },
  info: {
    container: "border-sky-200 bg-sky-50",
    title: "text-sky-900",
    message: "text-sky-800",
    support: "text-sky-700",
    copyButton:
      "border-sky-300 text-sky-900 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60",
  },
};

export function ProblemToast({ problem, className }: ProblemToastProps) {
  const ui = toUiProblemMessage(problem);
  const [copied, setCopied] = useState(false);

  const canCopySupportCode = useMemo(() => {
    return Boolean(
      ui.supportCode &&
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function",
    );
  }, [ui.supportCode]);

  const tone = toneBySeverity[ui.severity];
  const retryAfter =
    typeof ui.retryAfterSeconds === "number" && ui.retryAfterSeconds > 0
      ? ` Retry after: ${ui.retryAfterSeconds}s.`
      : "";

  const handleCopySupportCode = async () => {
    if (!ui.supportCode || !canCopySupportCode) return;
    await navigator.clipboard.writeText(ui.supportCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      role="alert"
      className={[
        "flex flex-col gap-2 rounded-lg border p-3 text-sm shadow-sm",
        tone.container,
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={`font-semibold ${tone.title}`}>{ui.title}</div>
      <div className={tone.message}>
        {ui.message}
        {retryAfter}
      </div>

      {ui.supportCode && (
        <div className={`flex items-center gap-2 text-xs ${tone.support}`}>
          <span className="font-medium">Support-Code: {ui.supportCode}</span>
          {canCopySupportCode && (
            <button
              type="button"
              onClick={handleCopySupportCode}
              className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${tone.copyButton}`}
              aria-label="Copy support code"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

