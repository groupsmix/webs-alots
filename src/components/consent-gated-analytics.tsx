"use client";

import { useState, useEffect } from "react";
import { AnalyticsScript } from "@/components/analytics-script";
import { getStoredCookiePreferences } from "@/components/cookie-consent";

/**
 * L1-CRIT-01: Client wrapper that reads cookie consent from localStorage
 * and only renders AnalyticsScript when the user has explicitly opted in
 * to analytics tracking.
 *
 * The server-rendered layout cannot access localStorage, so this client
 * component bridges the gap. On first render (SSR), no scripts are
 * injected. After hydration, if the user previously accepted analytics,
 * the scripts mount via afterInteractive strategy.
 *
 * Listens for storage events so consent changes in other tabs take effect
 * without a full page reload.
 */
export function ConsentGatedAnalytics({
  gaId,
  gtmId,
  nonce,
}: {
  gaId?: string | null;
  gtmId?: string | null;
  nonce?: string;
}) {
  const [analyticsConsented, setAnalyticsConsented] = useState(false);

  useEffect(() => {
    const prefs = getStoredCookiePreferences();
    setAnalyticsConsented(prefs?.analytics === true);

    const onStorage = (e: StorageEvent) => {
      if (e.key === "cookie-consent") {
        const updated = getStoredCookiePreferences();
        setAnalyticsConsented(updated?.analytics === true);
      }
    };
    window.addEventListener("storage", onStorage);

    const onConsentUpdate = () => {
      const updated = getStoredCookiePreferences();
      setAnalyticsConsented(updated?.analytics === true);
    };
    window.addEventListener("cookie-consent:changed", onConsentUpdate);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("cookie-consent:changed", onConsentUpdate);
    };
  }, []);

  return (
    <AnalyticsScript gaId={gaId} gtmId={gtmId} nonce={nonce} consentGiven={analyticsConsented} />
  );
}
