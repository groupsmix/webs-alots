"use client";

import { useEffect } from "react";
import { Hero } from "@/components/landing/oltigo/components/hero/hero";
import { Footer } from "@/components/landing/oltigo/components/sections/footer";
import { Nav } from "@/components/landing/oltigo/components/sections/nav";
import { CtaDemo } from "@/components/landing/oltigo/components/sections/cta-demo";
import { Faq } from "@/components/landing/oltigo/components/sections/faq";
import { Features } from "@/components/landing/oltigo/components/sections/features";
import { HowItWorks } from "@/components/landing/oltigo/components/sections/how-it-works";
import { MultiTenant } from "@/components/landing/oltigo/components/sections/multi-tenant";
import { Pricing } from "@/components/landing/oltigo/components/sections/pricing";
import { TelemetryTicker } from "@/components/landing/oltigo/components/sections/telemetry-ticker";
import { Testimonials } from "@/components/landing/oltigo/components/sections/testimonials";
import { Grain } from "@/components/landing/oltigo/components/primitives/grain";
import { ProgressRail } from "@/components/landing/oltigo/components/primitives/progress-rail";
import { LanguageProvider } from "@/components/landing/oltigo/i18n/context";

/**
 * Oltigo marketing landing — ported from groupsmix/oltigo-landing.
 *
 * Self-contained SaaS marketing page shown on the root domain (oltigo.com).
 * Brings its own nav, footer, language toggle (FR / AR / EN / Darija) and
 * texture. All styling is scoped to the `.oltigo-landing` wrapper (see the
 * "OLTIGO marketing landing" block in src/app/globals.css) so the dark
 * "engineering-grade" palette never leaks into the light-theme app shell.
 */
export function OltigoLanding() {
  // Mark JS active so reveal-on-scroll animations engage; no-JS users keep
  // fully visible content (progressive enhancement, mirrors upstream).
  useEffect(() => {
    document.documentElement.classList.add("js");
  }, []);

  return (
    <div className="oltigo-landing">
      <LanguageProvider>
        <Grain />
        <Nav />
        <ProgressRail />
        <main id="top">
          <Hero />
          <TelemetryTicker />
          <Features />
          <HowItWorks />
          <MultiTenant />
          <Testimonials />
          <Pricing />
          <Faq />
          <CtaDemo />
        </main>
        <Footer />
      </LanguageProvider>
    </div>
  );
}
