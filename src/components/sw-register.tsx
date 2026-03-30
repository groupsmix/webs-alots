"use client";

import { useEffect, useState, useCallback } from "react";
import { logger } from "@/lib/logger";

/**
 * Register the service worker for PWA offline support and push notifications.
 * Only registers in production to avoid caching dev assets.
 * Shows a toast when a new version is available (Issue 29).
 */
export function ServiceWorkerRegister() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  const handleUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
  }, [waitingWorker]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }

    // Listen for controller changes (new SW activated) and reload
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        logger.info("Service worker registered", { context: "sw-register" });

        // Check for updates periodically (every 60 minutes)
        const updateInterval = setInterval(() => {
          registration.update().catch(() => {});
        }, 60 * 60 * 1000);

        // Detect waiting worker (new version available)
        const onStateChange = () => {
          if (registration.waiting) {
            setWaitingWorker(registration.waiting);
            setUpdateAvailable(true);
          }
        };

        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setUpdateAvailable(true);
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
      .catch(() => {
        // Silent fail — SW is a progressive enhancement
      });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[90] flex justify-center pointer-events-none sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 shadow-lg dark:border-blue-800 dark:bg-blue-950">
        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
          Nouvelle version disponible
        </p>
        <button
          onClick={handleUpdate}
          className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          Mettre à jour
        </button>
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
