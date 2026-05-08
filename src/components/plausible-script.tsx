"use client";

import Script from "next/script";
import { useSyncExternalStore } from "react";
import { getStoredCookiePreferences } from "@/components/cookie-consent";

/**
 * Subscribe to localStorage changes for cookie consent.
 * Uses the `storage` event which fires when another tab/window updates
 * the same key, plus a custom event for same-tab updates dispatched by
 * the cookie-consent component.
 */
function subscribeToConsent(callback: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === "cookie-consent") callback();
  };
  // Also listen for same-tab consent changes (custom event from cookie-consent)
  const onCustom = () => callback();
  window.addEventListener("storage", onStorage);
  window.addEventListener("cookie-consent:changed", onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("cookie-consent:changed", onCustom);
  };
}

function getAnalyticsConsented(): boolean {
  const prefs = getStoredCookiePreferences();
  return prefs?.analytics === true;
}

/** Server snapshot: consent is never granted during SSR. */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * Plausible Analytics — platform-level analytics for the root domain.
 *
 * Unlike the per-clinic AnalyticsScript (GA/GTM), this tracks aggregate
 * metrics across the SaaS landing page (oltigo.com) such as visitor
 * counts, conversion funnels, and page views.
 *
 * Activated by setting NEXT_PUBLIC_PLAUSIBLE_DOMAIN in the environment.
 * Supports both Plausible Cloud and self-hosted instances.
 *
 * A69-F1: Consent-before-fire — the script is only rendered when the user
 * has explicitly accepted analytics cookies. Although Plausible is cookieless
 * and claims GDPR-safe without consent, the EU ePrivacy Directive and
 * French/German DPA guidance may still require prior consent for any
 * tracking. Rendering conditionally eliminates the race window where the
 * script could phone home before the consent check runs on mount.
 */
export function PlausibleScript() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const analyticsConsented = useSyncExternalStore(
    subscribeToConsent,
    getAnalyticsConsented,
    getServerSnapshot,
  );

  if (!domain || !analyticsConsented) return null;

  const host =
    process.env.NEXT_PUBLIC_PLAUSIBLE_HOST ?? "https://plausible.io";

  return (
    <Script
      id="plausible-analytics"
      strategy="afterInteractive"
      data-domain={domain}
      src={`${host}/js/script.js`}
    />
  );
}
