"use client";

import { LandingLocaleProvider } from "./landing-locale-provider";
import { LandingHeader } from "./landing-header";
import { HeroSection } from "./hero-section";
import { TrustSection } from "./trust-section";
import { FeaturesSection } from "./features-section";
import { HowItWorksSection } from "./how-it-works-section";
import { DemoSection } from "./demo-section";
import { CtaSection } from "./cta-section";
import { LandingFooter } from "./landing-footer";

/**
 * SaaS landing page shown on the root domain (oltigo.com).
 *
 * This page does NOT load any tenant/clinic data.
 * Clinic websites live on subdomains (e.g. dr-ahmed.oltigo.com).
 */
export function LandingPage() {
  return (
    <LandingLocaleProvider>
      <div className="flex min-h-screen flex-col bg-white">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-white focus:text-sm focus:font-medium"
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
      </div>
    </LandingLocaleProvider>
  );
}
