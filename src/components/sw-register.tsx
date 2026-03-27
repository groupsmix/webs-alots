"use client";

import { useEffect } from "react";

/**
 * Register the service worker for PWA offline support.
 * Only registers in production to avoid caching dev assets.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Silent fail — SW is a progressive enhancement
      });
    }
  }, []);

  return null;
}
