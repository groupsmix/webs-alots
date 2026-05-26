"use client";

import { CookieConsent } from "@/components/cookie-consent";
import { EmergentLandingPage } from "./emergent/emergent-landing-page";

/**
 * SaaS landing page shown on the root domain (oltigo.com).
 *
 * This page does NOT load any tenant/clinic data.
 * Clinic websites live on subdomains (e.g. dr-ahmed.oltigo.com).
 *
 * Uses the Emergent cinematic design: 16 sections, bilingual FR/AR,
 * ECG pulse, floating carnet de santé, paper grain overlay.
 */
export function LandingPage() {
  return (
    <>
      <EmergentLandingPage />
      <CookieConsent />
    </>
  );
}
