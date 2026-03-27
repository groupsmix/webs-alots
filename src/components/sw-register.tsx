"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

/**
 * Register the service worker for PWA offline support and push notifications.
 * Only registers in production to avoid caching dev assets.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        logger.info("Service worker registered", { context: "sw-register" });

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
      })
      .catch(() => {
        // Silent fail — SW is a progressive enhancement
      });
  }, []);

  return null;
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
