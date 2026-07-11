"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { getGaMeasurementId } from "@/lib/env";
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

/**
 * Storage key for the cookie consent envelope.
 * Bump CONSENT_VERSION below to force re-prompt without changing the key.
 */
const STORAGE_KEY = "cookie-consent";

/**
 * A64: Current consent schema version. Bump when categories, copy, or the
 * list of third-party processors changes materially. Users with an older
 * stored version are re-prompted at next page load (GDPR Art. 7(4) "specific
 * consent" + EDPB 03/2022 guidance).
 *
 * Version history:
 *   v1 (2026-05-31): initial versioned envelope. Categories: functional,
 *                    analytics, marketing. Processors: Plausible, Google
 *                    Analytics 4 (per-clinic), Sentry Replay (marketing).
 */
export const CONSENT_VERSION = 1;

/**
 * A64: Maximum age of stored consent before re-prompting. 12 months is the
 * upper bound from ICO + CNIL guidance for cookie consent freshness.
 * 365 * 24 * 60 * 60 * 1000 = 31_536_000_000 ms.
 */
export const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

/** Versioned storage envelope written to localStorage. */
interface StoredConsent {
  /** Schema version. Compared against CONSENT_VERSION. */
  v: number;
  /** Granted-at timestamp (epoch milliseconds). */
  t: number;
  /** Category preferences. */
  prefs: CookiePreferences;
}

/**
 * Result of evaluating stored consent.
 *
 *   - missing:        nothing stored, or stored value is unparseable.
 *   - stale-version:  stored at an older CONSENT_VERSION. Re-prompt required.
 *   - expired:        older than CONSENT_MAX_AGE_MS. Re-prompt required.
 *   - fresh:          valid, current, in-window. Caller can trust preferences.
 */
export type ConsentStatus =
  | { kind: "missing" }
  | { kind: "stale-version" }
  | { kind: "expired" }
  | { kind: "fresh"; preferences: CookiePreferences; grantedAt: number };

/** Key used in the custom event that re-opens the cookie consent banner. */
const REOPEN_EVENT = "cookie-consent:reopen";

/** Key used in the custom event that signals same-tab consent changes. */
const CHANGED_EVENT = "cookie-consent:changed";

/**
 * Programmatically re-open the cookie consent banner.
 * Call from a "Cookie Settings" link in the footer (COOKIE-01).
 */
export function reopenCookieConsent(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(REOPEN_EVENT));
  }
}

/** Type guard for `Record<string, unknown>`. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Type guard for the CookiePreferences shape. */
function isCookiePreferences(value: unknown): value is CookiePreferences {
  return (
    isRecord(value) &&
    typeof value.functional === "boolean" &&
    typeof value.analytics === "boolean" &&
    typeof value.marketing === "boolean"
  );
}

/**
 * Read the raw stored envelope, migrating legacy formats.
 *
 * Legacy formats accepted:
 *   - Legacy v0a: bare strings "accepted" / "declined" from the original banner.
 *                 Migrated to a fresh envelope at the current version.
 *   - Legacy v0b: bare CookiePreferences object (no version, no timestamp).
 *                 Returned as `{ v: 0, t: 0, prefs }` so the caller detects
 *                 stale-version and re-prompts.
 *
 * Returns `null` when no value is stored, the value is unparseable, or the
 * shape does not match any known format.
 */
function readStoredEnvelope(): StoredConsent | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  // Legacy v0a: bare string from the original banner.
  if (raw === "accepted") {
    return { v: CONSENT_VERSION, t: Date.now(), prefs: ALL_ACCEPTED };
  }
  if (raw === "declined") {
    return { v: CONSENT_VERSION, t: Date.now(), prefs: DEFAULT_PREFERENCES };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;

  // v1+ envelope: { v: number, t: number, prefs: CookiePreferences }
  if (
    typeof parsed.v === "number" &&
    typeof parsed.t === "number" &&
    isCookiePreferences(parsed.prefs)
  ) {
    return { v: parsed.v, t: parsed.t, prefs: parsed.prefs };
  }

  // Legacy v0b: bare CookiePreferences object. Force re-prompt via
  // stale-version path by returning v:0, t:0.
  if (isCookiePreferences(parsed)) {
    return { v: 0, t: 0, prefs: parsed };
  }

  return null;
}

/**
 * Evaluate the current consent status.
 *
 * Used by the banner to decide whether to display, and by tests to assert
 * migration + expiry behaviour. Public so server-rendered or library code
 * can introspect, though both layers should remain unaware of localStorage
 * during SSR.
 */
export function getConsentStatus(): ConsentStatus {
  const env = readStoredEnvelope();
  if (!env) return { kind: "missing" };
  if (env.v < CONSENT_VERSION) return { kind: "stale-version" };
  if (Date.now() - env.t > CONSENT_MAX_AGE_MS) return { kind: "expired" };
  return { kind: "fresh", preferences: env.prefs, grantedAt: env.t };
}

/**
 * Read stored cookie preferences from localStorage.
 *
 * L6-M-10: Returns defaults (all non-essential off) instead of null when
 * no consent has been given, eliminating nullable paths in callers.
 *
 * A64: Also returns defaults when the stored consent is at an older
 * version or older than CONSENT_MAX_AGE_MS. Callers see "no consent given"
 * until the user re-confirms via the banner, which prevents stale opt-in
 * from leaking past a re-prompt event.
 */
export function getStoredCookiePreferences(): CookiePreferences {
  const status = getConsentStatus();
  return status.kind === "fresh" ? status.preferences : DEFAULT_PREFERENCES;
}

/**
 * Disable or enable analytics scripts based on consent.
 *
 * When analytics is declined we remove the Plausible script tag (and any
 * GA/GTM scripts) so they stop collecting data for the rest of the session.
 */
function applyAnalyticsConsent(allowed: boolean): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  if (!allowed) {
    // Remove Plausible
    document.getElementById("plausible-analytics")?.remove();
    // Remove GA / GTM if present
    document
      .querySelectorAll('script[src*="googletagmanager.com"], script[src*="google-analytics.com"]')
      .forEach((el) => el.remove());
    // Opt-out flag for Google Analytics (if loaded before removal).
    // A64: read through the env accessor so this file does not touch process.env directly.
    const gaMeasurementId = getGaMeasurementId();
    if (gaMeasurementId) {
      (window as unknown as { [k: string]: boolean })[`ga-disable-${gaMeasurementId}`] = true;
    }
  }
}

/**
 * Log consent event to the server for GDPR/Loi 09-08 compliance.
 * Fire-and-forget. Never blocks the UI or shows errors to the user.
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
    // Consent logging is best-effort. Never block the user experience.
  });
}

/**
 * Persist a preferences set to localStorage as a versioned envelope.
 * Exposed for tests; the banner calls `saveAndClose` which wraps this.
 */
export function persistConsent(prefs: CookiePreferences, now: number = Date.now()): void {
  if (typeof window === "undefined") return;
  const envelope: StoredConsent = { v: CONSENT_VERSION, t: now, prefs };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
}

/**
 * GDPR / Loi 09-08 cookie consent banner with granular preferences.
 *
 * Features:
 *   - Accept All / Decline / Manage Preferences
 *   - Granular toggles for Functional (always on), Analytics, Marketing
 *   - Properly disables analytics scripts when declined
 *   - Adds bottom padding to prevent content overlap
 *   - Fully internationalised (fr, ar, en)
 *
 * A64 v1 hardening:
 *   - Versioned storage envelope ({ v, t, prefs }) with 12-month expiry.
 *   - Side effects moved out of useState initialiser into useEffect.
 *   - Cross-tab sync via the storage event so accepting in one tab closes
 *     the banner in another.
 */
export function CookieConsent() {
  const [locale] = useLocale();

  // SSR-stable initial state: both server and the first client render must
  // produce identical markup (banner hidden) to avoid a hydration mismatch
  // (React #418). The real consent status is read AFTER mount in the effect
  // below, which then reveals the banner. Reading localStorage in a useState
  // initializer here previously rendered the banner on the client but `null`
  // on the server, corrupting hydration for the whole document.
  const [visible, setVisible] = useState(false);

  const [showPreferences, setShowPreferences] = useState(false);

  const [preferences, setPreferences] = useState<CookiePreferences>(DEFAULT_PREFERENCES);

  // Read stored consent after mount: reveal the banner when consent is not
  // fresh, and apply analytics consent when it is. Runs once on the client
  // only, so it can safely touch localStorage without breaking hydration.
  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const status = getConsentStatus();

    if (status.kind === "fresh") {
      timeouts.push(
        setTimeout(() => {
          setPreferences(status.preferences);
        }, 0),
      );

      applyAnalyticsConsent(status.preferences.analytics);
    } else {
      timeouts.push(
        setTimeout(() => {
          setVisible(true);
        }, 0),
      );
    }

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, []);

  // Listen for programmatic re-open (e.g. footer "Cookie Settings" link).
  useEffect(() => {
    const handler = () => {
      const status = getConsentStatus();
      if (status.kind === "fresh") setPreferences(status.preferences);
      setVisible(true);
    };
    window.addEventListener(REOPEN_EVENT, handler);
    return () => window.removeEventListener(REOPEN_EVENT, handler);
  }, []);

  // A64: cross-tab sync. When another tab writes consent, close the banner
  // here too so the user does not see the dialog they already dismissed.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const status = getConsentStatus();
      if (status.kind === "fresh") {
        setPreferences(status.preferences);
        setVisible(false);
        applyAnalyticsConsent(status.preferences.analytics);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Add bottom padding to body when banner is visible.
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
    persistConsent(prefs);
    applyAnalyticsConsent(prefs.analytics);
    logConsentToServer(prefs);
    // A80-1 fix: dispatch custom event so same-tab listeners (PlausibleScript,
    // ConsentGatedAnalytics, ConsentGatedReplay) update without a reload.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
    }
    setVisible(false);
    setShowPreferences(false);
  }, []);

  const acceptAll = useCallback(() => saveAndClose(ALL_ACCEPTED), [saveAndClose]);
  const declineAll = useCallback(() => saveAndClose(DEFAULT_PREFERENCES), [saveAndClose]);
  const saveCustom = useCallback(() => saveAndClose(preferences), [saveAndClose, preferences]);

  if (!visible) return null;

  return (
    <div
      id="cookie-consent-banner"
      role="dialog"
      aria-label={t(locale, "cookie.ariaLabel")}
      className="fixed bottom-0 left-0 right-0 z-[60] border-t bg-background shadow-lg"
    >
      <div className="mx-auto max-w-5xl p-4 md:px-6">
        {/* Main banner */}
        <div className="md:flex md:items-center md:justify-between md:gap-4">
          <p className="text-sm text-muted-foreground mb-3 md:mb-0">
            {t(locale, "cookie.message")}{" "}
            <a href="/privacy/" className="underline hover:text-foreground">
              {t(locale, "cookie.privacyPolicy")}
            </a>
            .
          </p>
          {/* A69-3: Decline has equal visual weight as Accept All (EDPB 03/2022). */}
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button size="sm" onClick={declineAll}>
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
            {/* Functional. Always on. */}
            <label className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{t(locale, "cookie.functional")}</p>
                <p className="text-xs text-muted-foreground">
                  {t(locale, "cookie.functionalDesc")}
                </p>
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {t(locale, "cookie.required")}
              </span>
            </label>

            {/* Analytics */}
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- control is associated via adjacent Input/sibling element */}
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <p className="text-sm font-medium">{t(locale, "cookie.analytics")}</p>
                <p className="text-xs text-muted-foreground">{t(locale, "cookie.analyticsDesc")}</p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 accent-primary"
                checked={preferences.analytics}
                onChange={(e) => setPreferences((p) => ({ ...p, analytics: e.target.checked }))}
              />
            </label>

            {/* Marketing */}
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- control is associated via adjacent Input/sibling element */}
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <p className="text-sm font-medium">{t(locale, "cookie.marketing")}</p>
                <p className="text-xs text-muted-foreground">{t(locale, "cookie.marketingDesc")}</p>
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
