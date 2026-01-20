"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { registerAdmin } from "../../lib/api/register-admin";
import type { Problem, RegisterAdmin201 } from "../../lib/api/register-admin";

type WizardStep = 1 | 2 | 3;

type WizardForm = {
  email: string;
  password: string;
  businessName: string;
  businessCity: string;
};

type WizardState = {
  step: WizardStep;
  form: WizardForm;
  registration?: RegisterAdmin201;
  problem?: Problem;
};

const initialState: WizardState = {
  step: 1,
  form: {
    email: "",
    password: "",
    businessName: "",
    businessCity: "",
  },
};

function isEmailValid(email: string): boolean {
  return email.trim().includes("@");
}

function isPasswordValid(password: string): boolean {
  return password.trim().length >= 12;
}

function renderProblem(problem?: Problem) {
  if (!problem) return null;
  const entries: Array<{ label: string; value: string }> = [
    { label: "title", value: String(problem.title ?? "") },
    { label: "detail", value: String(problem.detail ?? "") },
    { label: "error_code", value: String(problem.error_code ?? "") },
    { label: "correlation_id", value: String(problem.correlation_id ?? "") },
  ].filter((entry) => entry.value.trim().length > 0);

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
        Es ist ein Fehler aufgetreten.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
      {entries.map((entry) => (
        <div key={entry.label}>
          <span className="font-semibold">{entry.label}:</span> {entry.value}
        </div>
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const [state, setState] = useState<WizardState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const apiBaseEnv = process.env.NEXT_PUBLIC_API_BASE_URL;
  const isPrismMock = apiBaseEnv?.includes("4010") ?? false;

  const stepValid = useMemo(() => {
    if (state.step === 1) {
      return isEmailValid(state.form.email) && isPasswordValid(state.form.password);
    }
    if (state.step === 2) {
      return true;
    }
    return false;
  }, [state.step, state.form.email, state.form.password]);

  const goNext = async () => {
    if (!stepValid || isSubmitting) return;
    if (state.step === 1) {
      setIsSubmitting(true);
      const result = await registerAdmin({
        email: state.form.email,
        password: state.form.password,
      });
      if (result.ok) {
        setState((prev) => ({
          ...prev,
          step: 2,
          registration: result.data,
          problem: undefined,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          problem: result.problem,
        }));
      }
      setIsSubmitting(false);
      return;
    }

    setState((prev) => ({ ...prev, step: (prev.step + 1) as WizardStep }));
  };

  const goBack = () => {
    setState((prev) => ({ ...prev, step: (prev.step - 1) as WizardStep }));
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Schritt {state.step} / 3
          </p>
          <h1 className="text-3xl font-semibold">Admin-Onboarding</h1>
          <p className="text-sm text-neutral-600">
            In drei kurzen Schritten zur ersten Kampagne.
          </p>
        </header>

        {isPrismMock && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            Connected to Mock API (Prism).
          </div>
        )}

        <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full bg-neutral-900 transition-all"
            style={{ width: `${(state.step / 3) * 100}%` }}
          />
        </div>

        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 shadow-sm">
          {state.step === 1 && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-xl font-semibold">Registrierung</h2>
                <p className="text-sm text-neutral-600">
                  Lege deinen Admin-Zugang an.
                </p>
              </div>

              <label className="flex flex-col gap-2 text-sm font-medium">
                Email
                <input
                  type="email"
                  value={state.form.email}
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      form: { ...prev.form, email: event.target.value },
                    }))
                  }
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                  placeholder="admin@example.com"
                  required
                />
                {!isEmailValid(state.form.email) && state.form.email.length > 0 && (
                  <span className="text-xs text-red-600">Bitte gültige Email eingeben.</span>
                )}
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium">
                Password
                <input
                  type="password"
                  value={state.form.password}
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      form: { ...prev.form, password: event.target.value },
                    }))
                  }
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                  placeholder="mindestens 12 Zeichen"
                  minLength={12}
                  required
                />
                {!isPasswordValid(state.form.password) && state.form.password.length > 0 && (
                  <span className="text-xs text-red-600">
                    Passwort muss mindestens 12 Zeichen haben.
                  </span>
                )}
              </label>

              <div className="text-xs text-neutral-600">
                <span className="mr-2">Datenschutz:</span>
                <Link className="underline underline-offset-4" href="/">
                  Datenschutzhinweise
                </Link>
              </div>

              {renderProblem(state.problem)}
            </div>
          )}

          {state.step === 2 && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-xl font-semibold">Stammdaten (optional)</h2>
                <p className="text-sm text-neutral-600">
                  Diese Angaben kannst du später jederzeit ergänzen.
                </p>
              </div>

              {state.registration && (
                <div className="rounded-lg border border-neutral-200 bg-white p-3 text-xs text-neutral-700">
                  <div>
                    <span className="font-semibold">adminId:</span> {state.registration.adminId}
                  </div>
                  <div>
                    <span className="font-semibold">tenantId:</span> {state.registration.tenantId}
                  </div>
                </div>
              )}

              <label className="flex flex-col gap-2 text-sm font-medium">
                Geschäftsname
                <input
                  type="text"
                  value={state.form.businessName}
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      form: { ...prev.form, businessName: event.target.value },
                    }))
                  }
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                  placeholder="z. B. Studio Bella"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium">
                Stadt
                <input
                  type="text"
                  value={state.form.businessCity}
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      form: { ...prev.form, businessCity: event.target.value },
                    }))
                  }
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                  placeholder="z. B. Hamburg"
                />
              </label>
            </div>
          )}

          {state.step === 3 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-xl font-semibold">Erste Kampagne</h2>
                <p className="text-sm text-neutral-600">
                  Dieser Schritt ist aktuell gesperrt, da Campaign-APIs noch nicht
                  im OpenAPI-Contract vorhanden sind.
                </p>
              </div>
              <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 text-sm text-neutral-700">
                Hinweis: Bitte Ticket zur Campaign-API (Expand-Contract, additiv)
                umsetzen, bevor dieser Wizard-Schritt aktiv wird.
              </div>
            </div>
          )}
        </section>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={goBack}
            disabled={state.step === 1 || isSubmitting}
            className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
          >
            Zurück
          </button>

          {state.step < 3 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={!stepValid || isSubmitting}
              className="rounded-full bg-neutral-900 px-6 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? "Wird gesendet..." : "Weiter"}
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="rounded-full bg-neutral-400 px-6 py-2 text-sm font-medium text-white opacity-60"
            >
              Fertigstellen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
