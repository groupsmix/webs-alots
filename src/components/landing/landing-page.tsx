"use client";

import { CookieConsent } from "@/components/cookie-consent";
import { EditorialLandingPage } from "./editorial/editorial-landing-page";

/**
 * SaaS landing page shown on the root domain (oltigo.com).
 *
 * This page does NOT load any tenant/clinic data.
 * Clinic websites live on subdomains (e.g. dr-ahmed.oltigo.com).
 *
 * Design direction: editorial-institutional (Stripe Docs + Bloomberg Terminal
 * + Linear typographic restraint). See docs/oltigo-design-direction.md.
 */
export function LandingPage() {
  return (
    <>
      <EditorialLandingPage />
      <CookieConsent />
    </>
  );
}
