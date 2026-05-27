"use client";

import { useEffect, useState } from "react";
import { CookieConsent } from "@/components/cookie-consent";
import { LandingLocaleProvider } from "../landing-locale-provider";
import { EditorialFooter } from "./editorial-footer";
import { EditorialNav } from "./editorial-nav";
import { ClaimsSection } from "./sections/claims-section";
import { ClosingCtaSection } from "./sections/closing-cta-section";
import { CustomersTeaser } from "./sections/customers-teaser";
import { HeroSection } from "./sections/hero-section";
import { HowItWorksSection } from "./sections/how-it-works-section";
import { ManifestoSection } from "./sections/manifesto-section";
import { MultiTenantSection } from "./sections/multi-tenant-section";
import { PricingTeaser } from "./sections/pricing-teaser";
import { ProductAnatomySection } from "./sections/product-anatomy-section";

/**
 * Editorial-institutional landing page for Oltigo Health.
 *
 * Visual model: Stripe Docs × Bloomberg Terminal × Linear.
 * One grotesk typeface, four tokens, hairline rules, mono metadata.
 * No gradients on type, no glassmorphism, no Lottie.
 */
export function EditorialLandingPage() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem("oltigo-theme") as "light" | "dark" | null;
    if (stored) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("oltigo-theme")) {
        setTheme(e.matches ? "dark" : "light");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <LandingLocaleProvider>
      <div
        data-theme={theme}
        className="relative min-h-screen"
        style={{
          backgroundColor: "var(--bone)",
          color: "var(--ink)",
          fontFamily: "var(--font-sans-landing)",
        }}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:px-4 focus:py-2 focus:text-sm focus:font-medium"
          style={{ backgroundColor: "var(--oltigo-green)", color: "var(--bone)" }}
        >
          {"Aller au contenu principal"}
        </a>

        <EditorialNav />

        <main id="main-content">
          <HeroSection />
          <ClaimsSection />
          <ManifestoSection />
          <ProductAnatomySection />
          <HowItWorksSection />
          <MultiTenantSection />
          <CustomersTeaser />
          <PricingTeaser />
          <ClosingCtaSection />
        </main>

        <EditorialFooter />
        <CookieConsent />
      </div>
    </LandingLocaleProvider>
  );
}
