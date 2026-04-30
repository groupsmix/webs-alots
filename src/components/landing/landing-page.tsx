"use client";

import { CookieConsent } from "@/components/cookie-consent";
import { CtaSection } from "./cta-section";
import { DemoSection } from "./demo-section";
import { FeaturesSection } from "./features-section";
import { HeroSection } from "./hero-section";
import { HowItWorksSection } from "./how-it-works-section";
import { LandingFooter } from "./landing-footer";
import { LandingHeader } from "./landing-header";
import { LandingLocaleProvider } from "./landing-locale-provider";
import { TrustSection } from "./trust-section";

/**
 * SaaS landing page shown on the root domain (oltigo.com).
 *
 * This page does NOT load any tenant/clinic data.
 * Clinic websites live on subdomains (e.g. dr-ahmed.oltigo.com).
 *
 * Section order per spec:
 *   1. Top bar (LandingHeader)
 *   2. Hero (editorial, left-aligned)
 *   3. Evidence strip (TrustSection — stat blocks)
 *   4. What Oltigo is (FeaturesSection — table layout)
 *   5. How it works (HowItWorksSection — numbered rows)
 *   6. Live example (DemoSection — screenshot frame)
 *   7. Closing CTA (CtaSection — Ink background)
 *   8. Footer (LandingFooter — 4-column)
 *
 * Removed: ComparisonSection (not in spec), decorative blobs, amber demo CTA.
 */
export function LandingPage() {
  return (
    <LandingLocaleProvider>
      <div
        className="flex min-h-screen flex-col"
        style={{ backgroundColor: "var(--bone)", color: "var(--ink)" }}
      >
        {/* eslint-disable-next-line i18next/no-literal-string -- skip-to-content is a standard accessibility pattern */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:px-4 focus:py-2 focus:text-sm focus:font-medium"
          style={{
            backgroundColor: "var(--oltigo-green)",
            color: "var(--bone)",
          }}
        >
          Aller au contenu principal
        </a>
        <LandingHeader />
        <main id="main-content" className="flex-1">
          <HeroSection />
          <TrustSection />
          <FeaturesSection />
          <HowItWorksSection />
          <DemoSection />
          <CtaSection />
        </main>
        <LandingFooter />
        <CookieConsent />
      </div>
    </LandingLocaleProvider>
  );
}
