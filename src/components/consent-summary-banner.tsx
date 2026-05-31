"use client";

import { AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { getStoredCookiePreferences, reopenCookieConsent } from "@/components/cookie-consent";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

/**
 * A62-B1: Consent Summary Banner.
 *
 * Displays the user's current consent state for all categories:
 *   - Functional (required, always on)
 *   - Analytics (user choice)
 *   - Marketing (user choice)
 *   - Session Replay (user choice, controlled separately)
 *
 * Allows users to re-open cookie settings to adjust.
 * Shown on page load and updates when consent changes.
 */
export function ConsentSummaryBanner(): JSX.Element | null {
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null);
  const [replayEnabled, setReplayEnabled] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Read current consent state from localStorage
    const cookiePrefs = getStoredCookiePreferences();
    setPrefs(cookiePrefs);

    // Read session replay consent from cookie-consent entry
    const raw = localStorage.getItem("cookie-consent");
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed === "object" && parsed !== null && "sentry_replay" in parsed) {
          setReplayEnabled((parsed as Record<string, unknown>).sentry_replay === true);
        }
      } catch {
        // Failed to parse
      }
    }

    // Show banner if not yet dismissed this session
    const dismissed = sessionStorage.getItem("consent-summary-dismissed");
    if (!dismissed) {
      setVisible(true);
    }

    // Listen for consent changes
    const handleConsentChange = () => {
      const updated = getStoredCookiePreferences();
      setPrefs(updated);
      const raw2 = localStorage.getItem("cookie-consent");
      if (raw2) {
        try {
          const parsed: unknown = JSON.parse(raw2);
          if (typeof parsed === "object" && parsed !== null && "sentry_replay" in parsed) {
            setReplayEnabled((parsed as Record<string, unknown>).sentry_replay === true);
          }
        } catch {
          // Failed to parse
        }
      }
      setVisible(true);
      sessionStorage.removeItem("consent-summary-dismissed");
    };

    window.addEventListener("storage", handleConsentChange);
    window.addEventListener("cookie-consent:changed", handleConsentChange);

    return () => {
      window.removeEventListener("storage", handleConsentChange);
      window.removeEventListener("cookie-consent:changed", handleConsentChange);
    };
  }, []);

  if (!visible || !prefs) return null;

  return (
    <div className="sticky top-0 z-50 border-b border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950">
      <div className="mx-auto flex max-w-6xl items-start justify-between gap-4">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold text-blue-900 dark:text-blue-100">
              {t("consent.summary.title") || "Your privacy settings"}
            </h3>
          </div>

          {/* Consent categories with visual indicators */}
          <div className="space-y-2 text-sm">
            {/* Functional (always required) */}
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-blue-800 dark:text-blue-200">
                <strong>{t("consent.category.functional") || "Functional"}</strong>:
                {t("consent.summary.functional_desc") || "Always enabled"}
              </span>
            </div>

            {/* Analytics */}
            <div className="flex items-center gap-2">
              {prefs.analytics ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <span className="text-blue-800 dark:text-blue-200">
                <strong>{t("consent.category.analytics") || "Analytics"}</strong>:
                {prefs.analytics
                  ? t("consent.summary.enabled") || "Enabled"
                  : t("consent.summary.disabled") || "Disabled"}
              </span>
            </div>

            {/* Marketing */}
            <div className="flex items-center gap-2">
              {prefs.marketing ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <span className="text-blue-800 dark:text-blue-200">
                <strong>{t("consent.category.marketing") || "Marketing"}</strong>:
                {prefs.marketing
                  ? t("consent.summary.enabled") || "Enabled"
                  : t("consent.summary.disabled") || "Disabled"}
              </span>
            </div>

            {/* Session Replay */}
            <div className="flex items-center gap-2">
              {replayEnabled ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <span className="text-blue-800 dark:text-blue-200">
                <strong>{t("consent.category.replay") || "Session Replay"}</strong>:
                {replayEnabled
                  ? t("consent.summary.enabled") || "Enabled"
                  : t("consent.summary.disabled") || "Disabled"}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => reopenCookieConsent()}
            className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900"
          >
            {t("consent.summary.change") || "Change settings"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setVisible(false);
              sessionStorage.setItem("consent-summary-dismissed", "true");
            }}
            className="text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900"
          >
            {t("consent.summary.dismiss") || "Dismiss"}
          </Button>
        </div>
      </div>
    </div>
  );
}
