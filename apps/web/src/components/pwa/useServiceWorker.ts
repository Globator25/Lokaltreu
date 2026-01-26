"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseServiceWorkerResult = {
  updateAvailable: boolean;
  applyUpdate: () => void;
};

function isSecureContextForSw(): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.protocol === "https:") return true;
  return window.location.hostname === "localhost";
}

export function useServiceWorker(): UseServiceWorkerResult {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const waitingRef = useRef<ServiceWorker | null>(null);
  const reloadOnControllerChangeRef = useRef(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const applyUpdate = useCallback(() => {
    const waiting = waitingRef.current;
    reloadOnControllerChangeRef.current = true;
    if (waiting) {
      waiting.postMessage({ type: "SKIP_WAITING" });
      return;
    }
    const registration = registrationRef.current;
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      return;
    }
    window.location.reload();
  }, []);

  useEffect(() => {
    if (!isSecureContextForSw()) return;
    if (!("serviceWorker" in navigator)) return;

    let mounted = true;

    navigator.serviceWorker
      .register("/pwa/sw.js", { scope: "/pwa/" })
      .then((registration) => {
        if (!mounted) return;

        registrationRef.current = registration;

        if (registration.waiting) {
          waitingRef.current = registration.waiting;
          setUpdateAvailable(true);
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener("statechange", () => {
            if (installing.state !== "installed") return;
            if (!navigator.serviceWorker.controller) return;
            waitingRef.current = registration.waiting ?? installing;
            setUpdateAvailable(true);
          });
        });

        registration.update().catch(() => {
          // Ignore update errors.
        });
      })
      .catch(() => {
        // Silent: SW optional for PWA UX.
      });

    const handleControllerChange = () => {
      if (reloadOnControllerChangeRef.current) {
        window.location.reload();
        return;
      }
      setUpdateAvailable(true);
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      mounted = false;
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
    };
  }, []);

  return { updateAvailable, applyUpdate };
}
