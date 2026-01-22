"use client";

import Link from "next/link";

export default function AdminHomePage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Admin
          </p>
          <h1 className="text-3xl font-semibold">Übersicht</h1>
          <p className="text-sm text-neutral-600">
            Wähle einen Bereich, um fortzufahren.
          </p>
        </header>

        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 shadow-sm">
          <div className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">Reporting Dashboard</h2>
            <p className="text-sm text-neutral-600">
              KPIs, Plan-Nutzung und Aktivität im Überblick.
            </p>
            <div>
              <Link
                href="/admin/dashboard"
                className="inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Zum Dashboard
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 shadow-sm">
          <div className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">Geräteverwaltung</h2>
            <p className="text-sm text-neutral-600">
              Mitarbeiter-Geräte einladen und verwalten.
            </p>
            <div>
              <Link
                href="/admin/devices"
                className="inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-neutral-900 ring-1 ring-neutral-200"
              >
                Zu den Geräten
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
