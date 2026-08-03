"use client";

interface TrackEventProps {
  [key: string]: string | number | boolean | undefined;
}

declare global {
  interface Window {
    plausible?: (eventName: string, options?: { props?: TrackEventProps }) => void;
    gtag?: (...args: (string | number | TrackEventProps | Date | null)[]) => void;
    dataLayer?: unknown[];
  }
}

/**
 * Send a custom event to whichever analytics provider is present.
 *
 * - Plausible: `plausible("Event Name", { props })`
 * - GA4 / GTM: `gtag("event", "Event Name", props)`
 *
 * Fails silently if neither provider is loaded (e.g. user rejected analytics cookies).
 */
export function trackEvent(name: string, props?: TrackEventProps): void {
  if (typeof window === "undefined") return;

  try {
    if (typeof window.plausible === "function") {
      window.plausible(name, { props });
    }

    if (typeof window.gtag === "function") {
      window.gtag("event", name, props ?? null);
    }
  } catch {
    // Analytics must never break the UI.
  }
}
