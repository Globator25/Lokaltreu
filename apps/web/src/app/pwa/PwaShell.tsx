"use client";

import { SwUpdateBanner } from "../../components/pwa/SwUpdateBanner";
import { useServiceWorker } from "../../components/pwa/useServiceWorker";

type PwaShellProps = {
  children: React.ReactNode;
};

export function PwaShell({ children }: PwaShellProps) {
  const { updateAvailable, applyUpdate } = useServiceWorker();

  return (
    <div className="min-h-screen">
      <SwUpdateBanner visible={updateAvailable} onUpdate={applyUpdate} />
      {children}
    </div>
  );
}
