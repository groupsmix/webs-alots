"use client";

import { reopenCookieConsent } from "@/components/cookie-consent";
import { t, type Locale } from "@/lib/i18n";

/**
 * Client-side "Cookie Settings" link for the footer (COOKIE-01).
 * Re-opens the cookie consent banner so users can withdraw/update consent.
 */
export function CookieSettingsLink({ locale = "fr" }: { locale?: Locale }) {
  return (
    <button
      type="button"
      onClick={reopenCookieConsent}
      className="text-sm text-muted-foreground hover:text-foreground min-h-11 flex items-center"
    >
      {t(locale, "cookie.managePreferences")}
    </button>
  );
}
