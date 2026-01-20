"use client";

import React, { useState } from "react";
import { InviteDeviceModal } from "../../../components/devices/InviteDeviceModal";

export default function DevicesPage() {
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Admin
          </p>
          <h1 className="text-3xl font-semibold">Geräteverwaltung</h1>
          <p className="text-sm text-neutral-600">
            Lade Mitarbeiter-Geräte ein und verwalte den Zugriff.
          </p>
        </header>

        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 shadow-sm">
          <div className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">Einladung</h2>
            <p className="text-sm text-neutral-600">
              Erzeuge einen einmaligen Registrierungslink für ein neues Gerät.
            </p>
            <div>
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Registrierungslink erzeugen
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-neutral-600">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-neutral-800">
              Geräte (US-3)
            </h2>
            <p className="text-sm">
              Noch nicht verfügbar – OpenAPI-Endpunkte fehlen (separates Contract-Ticket).
            </p>
          </div>
        </section>
      </div>

      <InviteDeviceModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
