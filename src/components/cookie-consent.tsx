"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

/** Cookie preference categories. */
export interface CookiePreferences {
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

const DEFAULT_PREFERENCES: CookiePreferences = {
  functional: true,
  analytics: false,
  marketing: false,
};

const ALL_ACCEPTED: CookiePreferences = {
  functional: true,
  analytics: true,
  marketing: true,
};

/** Key used in the custom event that re-opens the cookie consent banner. */
const REOPEN_EVENT = "cookie-consent:reopen";

/**
 * Programmatically re-open the cookie consent banner.
 * Call from a "Cookie Settings" link in the footer (COOKIE-01).
 */
export function reopenCookieConsent(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(REOPEN_EVENT));
  }
}

/**
 * Read stored cookie preferences from localStorage.
 * Returns `null` when no consent has been given yet.
 */
export function getStoredCookiePreferences(): CookiePreferences | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("cookie-consent");
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "functional" in parsed &&
      "analytics" in parsed &&
      "marketing" in parsed
    ) {
      return parsed as CookiePreferences;
    }
  } catch {
    // Legacy format ("accepted" / "declined") — migrate
    if (raw === "accepted") return ALL_ACCEPTED;
    if (raw === "declined") return DEFAULT_PREFERENCES;
  }
  return null;
}

/**
 * Disable or enable analytics scripts based on consent.
 *
 * When analytics is declined we remove the Plausible script tag (and any
 * GA/GTM scripts) so they stop collecting data for the rest of the session.
 */
function applyAnalyticsConsent(allowed: boolean): void {
  if (typeof document === "undefined") return;

  if (!allowed) {
    // Remove Plausible
    document.getElementById("plausible-analytics")?.remove();
    // Remove GA / GTM if present
    document
      .querySelectorAll(
        'script[src*="googletagmanager.com"], script[src*="google-analytics.com"]',
      )
      .forEach((el) => el.remove());
    // Opt-out flag for Google Analytics (if loaded before removal)
    const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    if (gaMeasurementId) {
      (window as unknown as { [k: string]: boolean })[`ga-disable-${gaMeasurementId}`] = true;
    }
  }
}

/**
 * Log consent event to the server for GDPR/Loi 09-08 compliance.
 * Fire-and-forget — never blocks the UI or shows errors to the user.
 */
function logConsentToServer(preferences: CookiePreferences): void {
  fetch("/api/consent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      consentType: "granular",
      preferences,
      granted: preferences.analytics || preferences.marketing,
    }),
  }).catch(() => {
    // Consent logging is best-effort — never block the user experience
  });
}

/**
 * GDPR / Loi 09-08 cookie consent banner with granular preferences.
 *
 * Features:
 * - Accept All / Decline / Manage Preferences
 * - Granular toggles for Functional (always on), Analytics, Marketing
 * - Properly disables analytics scripts when declined
 * - Adds bottom padding to prevent content overlap
 * - Fully internationalised (fr, ar, en)
 */
export function CookieConsent() {
  const [locale] = useLocale();
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = getStoredCookiePreferences();
    if (stored) {
      applyAnalyticsConsent(stored.analytics);
      return false;
    }
    return true;
  });
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] =
    useState<CookiePreferences>(DEFAULT_PREFERENCES);

  // Listen for programmatic re-open (e.g. footer "Cookie Settings" link)
  useEffect(() => {
    const handler = () => {
      const stored = getStoredCookiePreferences();
      if (stored) setPreferences(stored);
      setVisible(true);
    };
    window.addEventListener(REOPEN_EVENT, handler);
    return () => window.removeEventListener(REOPEN_EVENT, handler);
  }, []);

  // Add bottom padding to body when banner is visible
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (visible) {
      document.body.style.paddingBottom = "80px";
    } else {
      document.body.style.paddingBottom = "";
    }
    return () => {
      document.body.style.paddingBottom = "";
    };
  }, [visible]);

  const saveAndClose = useCallback((prefs: CookiePreferences) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("cookie-consent", JSON.stringify(prefs));
    }
    applyAnalyticsConsent(prefs.analytics);
    logConsentToServer(prefs);
    // A80-1 fix: Dispatch custom event so PlausibleScript's same-tab listener updates
    window.dispatchEvent(new CustomEvent("cookie-consent:changed"));
    setVisible(false);
    setShowPreferences(false);
  }, []);

  const acceptAll = useCallback(
    () => saveAndClose(ALL_ACCEPTED),
    [saveAndClose],
  );
  const declineAll = useCallback(
    () => saveAndClose(DEFAULT_PREFERENCES),
    [saveAndClose],
  );
  const saveCustom = useCallback(
    () => saveAndClose(preferences),
    [saveAndClose, preferences],
  );

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label={t(locale, "cookie.ariaLabel")}
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background shadow-lg"
    >
      <div className="mx-auto max-w-5xl p-4 md:px-6">
        {/* Main banner */}
        <div className="md:flex md:items-center md:justify-between md:gap-4">
          <p className="text-sm text-muted-foreground mb-3 md:mb-0">
            {t(locale, "cookie.message")}{" "}
            <a href="/privacy" className="underline hover:text-foreground">
              {t(locale, "cookie.privacyPolicy")}
            </a>
            .
          </p>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={declineAll}>
              {t(locale, "cookie.decline")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreferences(!showPreferences)}
            >
              {t(locale, "cookie.managePreferences")}
            </Button>
            <Button size="sm" onClick={acceptAll}>
              {t(locale, "cookie.acceptAll")}
            </Button>
          </div>
        </div>

        {/* Granular preferences panel */}
        {showPreferences && (
          <div className="mt-4 space-y-3 border-t pt-4">
            {/* Functional — always on */}
            <label className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">
                  {t(locale, "cookie.functional")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t(locale, "cookie.functionalDesc")}
                </p>
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {t(locale, "cookie.required")}
              </span>
            </label>

            {/* Analytics */}
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <p className="text-sm font-medium">
                  {t(locale, "cookie.analytics")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t(locale, "cookie.analyticsDesc")}
                </p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 accent-primary"
                checked={preferences.analytics}
                onChange={(e) =>
                  setPreferences((p) => ({ ...p, analytics: e.target.checked }))
                }
              />
            </label>

            {/* Marketing */}
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <p className="text-sm font-medium">
                  {t(locale, "cookie.marketing")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t(locale, "cookie.marketingDesc")}
                </p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 accent-primary"
                checked={preferences.marketing}
                onChange={(e) =>
                  setPreferences((p) => ({
                    ...p,
                    marketing: e.target.checked,
                  }))
                }
              />
            </label>

            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={saveCustom}>
                {t(locale, "cookie.savePreferences")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
