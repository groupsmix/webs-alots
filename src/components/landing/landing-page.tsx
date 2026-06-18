"use client";

import { EditorialLandingPage } from "./editorial/editorial-landing-page";
import { OltigoLanding } from "./oltigo/oltigo-landing";

/**
 * SaaS landing page shown on the root domain (oltigo.com).
 *
 * This page does NOT load any tenant/clinic data.
 * Clinic websites live on subdomains (e.g. dr-ahmed.oltigo.com).
 *
 * Two designs are available:
 *  - <OltigoLanding />        — the engineering-grade marketing landing
 *                               (ported from groupsmix/oltigo-landing).
 *  - <EditorialLandingPage /> — the previous editorial-institutional design.
 *
 * Flip USE_OLTIGO_LANDING to switch back; default is the new Oltigo landing.
 *
 * Note: <CookieConsent /> is mounted globally in src/app/layout.tsx; do not
 * re-mount here — duplicate `#cookie-consent-banner` IDs break E2E tests and
 * accessibility (two `role="dialog"` with the same aria-label).
 */
const USE_OLTIGO_LANDING: boolean = true;

export function LandingPage() {
  return USE_OLTIGO_LANDING ? <OltigoLanding /> : <EditorialLandingPage />;
}
