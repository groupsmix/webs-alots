"use client";

import { EditorialLandingPage } from "./editorial/editorial-landing-page";

/**
 * SaaS landing page shown on the root domain (oltigo.com).
 *
 * This page does NOT load any tenant/clinic data.
 * Clinic websites live on subdomains (e.g. dr-ahmed.oltigo.com).
 *
 * Design direction: editorial-institutional (Stripe Docs + Bloomberg Terminal
 * + Linear typographic restraint). See docs/oltigo-design-direction.md.
 *
 * Note: <CookieConsent /> is mounted globally in src/app/layout.tsx; do not
 * re-mount here — duplicate `#cookie-consent-banner` IDs break E2E tests and
 * accessibility (two `role="dialog"` with the same aria-label).
 */
export function LandingPage() {
  return <EditorialLandingPage />;
}
