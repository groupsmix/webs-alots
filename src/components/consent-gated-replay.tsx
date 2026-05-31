"use client";

/**
 * A69-F2: Consent-gated Sentry Replay.
 *
 * Problem:
 *   Sentry Replay was initialised unconditionally in sentry.client.config.ts
 *   with replaysSessionSampleRate: 0.01. On public marketing pages (/, /services,
 *   /blog, etc.) this fires session recording without user consent, violating
 *   the ePrivacy Directive and GDPR Art.7.
 *
 * Solution:
 *   This component dynamically enables the Sentry Replay integration ONLY after
 *   the user has explicitly accepted the "marketing" consent category (which
 *   covers session recording / behavioural analytics).
 *
 *   On authenticated PHI routes, Sentry's own beforeSend handler in
 *   sentry.client.config.ts already drops replay events — that remains
 *   the server-side safety net. This component handles the consent gate
 *   for public pages.
 *
 * How it works:
 *   1. On mount, reads the stored cookie consent from localStorage.
 *   2. If marketing consent is given, calls Sentry.addIntegration(replayIntegration()).
 *   3. Listens for consent changes (cookie-consent:changed event) and
 *      adds or signals a reload so the integration state matches consent.
 *   4. If consent is withdrawn, the page must reload to remove the integration
 *      (Sentry does not support removing integrations at runtime).
 *
 * Note: sentry.client.config.ts MUST remove the static Replay integration
 * initialisation (replaysSessionSampleRate / replayIntegration() in Sentry.init)
 * for this component to be the sole gatekeeper. See the companion change there.
 */

import { useEffect } from "react";
import { getStoredCookiePreferences } from "@/components/cookie-consent";

let replayAdded = false;

async function enableReplay() {
  if (replayAdded) return;
  try {
    const Sentry = await import("@sentry/nextjs");
    // dynamically import replayIntegration to keep it out of the initial bundle
    const { replayIntegration } = await import("@sentry/nextjs");
    Sentry.addIntegration(
      replayIntegration({
        // Mask all text/inputs to prevent accidental PII capture.
        // Even with consent, we mask because users may not expect
        // session recording to capture exact keystrokes.
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    );
    replayAdded = true;
  } catch {
    // Sentry not configured — ignore
  }
}

export function ConsentGatedReplay() {
  useEffect(() => {
    // Check on mount
    const prefs = getStoredCookiePreferences();
    if (prefs.marketing) {
      void enableReplay();
    }

    // Listen for consent updates within the same tab
    const onConsentChanged = () => {
      const updated = getStoredCookiePreferences();
      if (updated.marketing) {
        void enableReplay();
      } else if (replayAdded) {
        // Replay cannot be removed at runtime. Reload so the next
        // page load starts without it. Only reload if we're on a public
        // (unauthenticated) page — authenticated sessions stay alive.
        const isPublicPage = !document.cookie.includes("sb-") && !document.cookie.includes("auth");
        if (isPublicPage) {
          window.location.reload();
        }
      }
    };

    window.addEventListener("cookie-consent:changed", onConsentChanged);
    return () => window.removeEventListener("cookie-consent:changed", onConsentChanged);
  }, []);

  // Renders nothing — purely a side-effect component
  return null;
}
