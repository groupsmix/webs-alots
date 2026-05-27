"use client";

import { EditorialLandingPage } from "./editorial/editorial-landing-page";

/**
 * SaaS landing page shown on the root domain (oltigo.com).
 *
 * This page does NOT load any tenant/clinic data.
 * Clinic websites live on subdomains (e.g. dr-ahmed.oltigo.com).
 *
 * Uses the editorial-institutional design: Stripe Docs header treatment,
 * Bloomberg Terminal mono metadata, Linear typographic scale.
 */
export function LandingPage() {
  return <EditorialLandingPage />;
}
