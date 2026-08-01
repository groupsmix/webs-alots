"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/locale-switcher";
import { t, type TranslationKey } from "@/lib/i18n";
import { logger } from "@/lib/logger";

const DISMISSED_KEY = "sw-update-shown";

function readDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function setDismissedFlag(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    } else {
      sessionStorage.removeItem(DISMISSED_KEY);
    }
  } catch {
    // ignore
  }
}

/**
 * Register the service worker for PWA offline support and push notifications.
 * Only registers in production to avoid caching dev assets.
 * Shows a toast once per tab session when a new version is waiting (Issue 29).
 */
export function ServiceWorkerRegister() {
  const [locale] = useLocale();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(readDismissed);

  const show = updateAvailable && !dismissed;

  const handleUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
  }, [waitingWorker]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setDismissedFlag(true);
  }, []);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }

    // Listen for controller changes (new SW activated) and reload.
    //
    // IMPORTANT: `controllerchange` also fires on the FIRST install —
    // sw.js calls skipWaiting() + clients.claim(), so a brand-new SW
    // claims the page moments after load. Reloading then forces every
    // first-time visitor through a gratuitous page reload right after
    // the page becomes interactive (and makes E2E tests racy: the
    // reload blanks the DOM mid-test). Only reload when the page was
    // already controlled by a previous SW — i.e. a genuine update.
    let refreshing = false;
    let hadController = !!navigator.serviceWorker.controller;
    const onControllerChange = () => {
      if (!hadController) {
        // First install just claimed this page. The current page was
        // served by the network anyway — no reload needed.
        hadController = true;
        return;
      }
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const markWaiting = (worker: ServiceWorker) => {
      setWaitingWorker(worker);
      setUpdateAvailable(true);
      setDismissedFlag(true);
    };

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        logger.info("Service worker registered", { context: "sw-register" });

        // Check for updates periodically (every 60 minutes)
        const updateInterval = setInterval(
          () => {
            registration.update().catch(() => {});
          },
          60 * 60 * 1000,
        );

        // Detect waiting worker (new version available)
        const onStateChange = () => {
          if (registration.waiting) {
            markWaiting(registration.waiting);
          }
        };

        if (registration.waiting) {
          markWaiting(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", onStateChange);
          }
        });

        // Subscribe to push notifications if supported and permission granted
        if (!("PushManager" in window)) return;

        // Check if already subscribed
        registration.pushManager.getSubscription().then((existing) => {
          if (existing) return; // already subscribed

          // Only request permission if the user hasn't been asked yet
          if (Notification.permission === "default") {
            Notification.requestPermission().then((permission) => {
              if (permission === "granted") {
                subscribeToPush(registration);
              }
            });
          } else if (Notification.permission === "granted") {
            subscribeToPush(registration);
          }
        });

        return () => clearInterval(updateInterval);
      })
      .catch((err) => {
        logger.warn("Service worker registration failed", {
          context: "sw-register",
          error: err,
        });
      });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[90] max-w-sm pointer-events-auto"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 rounded-lg border border-emerald/30 bg-emerald/10 p-3 shadow-lg dark:border-emerald-800/50 dark:bg-emerald-950/40">
        <p className="flex-1 text-sm font-medium text-emerald-900 dark:text-emerald-100">
          {t(locale, "sw.updateAvailable" as TranslationKey)}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleUpdate}
            className="shrink-0 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            {t(locale, "sw.update" as TranslationKey)}
          </button>
          <button
            onClick={handleDismiss}
            aria-label="Fermer"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-emerald-800 transition-colors hover:bg-emerald-200/50 dark:text-emerald-100 dark:hover:bg-emerald-900/50"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Subscribe to push notifications and send the subscription to the server.
 */
async function subscribeToPush(registration: ServiceWorkerRegistration) {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return;

  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    // Send subscription to the server for appointment reminders
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    });
  } catch (err) {
    logger.warn("Push subscription failed", { context: "sw-register", error: err });
  }
}

/** Convert a VAPID public key from base64 URL-safe to Uint8Array. */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}
