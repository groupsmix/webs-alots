"use client";

import { useEffect } from "react";
import { Hero } from "@/components/landing/oltigo/components/hero/hero";
import { Grain } from "@/components/landing/oltigo/components/primitives/grain";
import { ProgressRail } from "@/components/landing/oltigo/components/primitives/progress-rail";
import { CtaDemo } from "@/components/landing/oltigo/components/sections/cta-demo";
import { Faq, FaqSchema } from "@/components/landing/oltigo/components/sections/faq";
import { Features } from "@/components/landing/oltigo/components/sections/features";
import { Footer } from "@/components/landing/oltigo/components/sections/footer";
import { HowItWorks } from "@/components/landing/oltigo/components/sections/how-it-works";
import { MultiTenant } from "@/components/landing/oltigo/components/sections/multi-tenant";
import { Nav } from "@/components/landing/oltigo/components/sections/nav";
import { Pricing } from "@/components/landing/oltigo/components/sections/pricing";
import { TelemetryTicker } from "@/components/landing/oltigo/components/sections/telemetry-ticker";
import { Testimonials } from "@/components/landing/oltigo/components/sections/testimonials";
import { LanguageProvider } from "@/components/landing/oltigo/i18n/context";
import { useI18n } from "@/components/landing/oltigo/i18n/context";

function SkipLink() {
  const { dict } = useI18n();
  return (
    <a
      href="#top"
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-[10px] focus:bg-emerald focus:px-4 focus:py-2.5 focus:text-ink focus:shadow-lg"
    >
      {dict.nav.skipToContent}
    </a>
  );
}

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
        <SkipLink />
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
        <FaqSchema />
        <Footer />
      </LanguageProvider>
    </div>
  );
}
