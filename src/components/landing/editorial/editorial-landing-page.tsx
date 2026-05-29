"use client";

import { useEffect, useState } from "react";
import { LandingLocaleProvider, useLandingLocale } from "../landing-locale-provider";
import { ClosingCtaSection } from "./closing-cta-section";
import { EditorialFooter } from "./editorial-footer";
import { EditorialHeader } from "./editorial-header";
import { EditorialHero } from "./hero-section";
import { HowItWorksSection } from "./how-it-works-section";
import { ManifestoSection } from "./manifesto-section";
import { MultiTenantSection } from "./multi-tenant-section";
import { PricingSection } from "./pricing-section";
import { ProductSection } from "./product-section";
import { TestimonialsSection } from "./testimonials-section";

/**
 * Editorial-institutional landing page for Oltigo Health.
 *
 * Design direction: Stripe Docs header treatment + Bloomberg Terminal mono
 * metadata + Linear's typographic restraint. No gradients on type, no
 * parallax, no Lottie, no glassmorphism.
 *
 * Sections follow §3.1 order: Hero → Manifesto → Product → How → MultiTenant
 * → Clients → Pricing → Closing CTA → Footer.
 */
export function EditorialLandingPage() {
  return (
    <LandingLocaleProvider>
      <EditorialLandingPageInner />
    </LandingLocaleProvider>
  );
}

function EditorialLandingPageInner() {
  const { locale, setLocale, t } = useLandingLocale();
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

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("oltigo-theme", next);
  };

  const cycleLang = () => {
    const order: Array<"fr" | "ar" | "en"> = ["fr", "ar", "en"];
    const next = order[(order.indexOf(locale) + 1) % order.length];
    setLocale(next);
  };

  const rtl = locale === "ar";

  return (
    <div
      dir={rtl ? "rtl" : "ltr"}
      data-theme={theme}
      className="bg-[var(--bone)] text-[var(--ink)] font-[var(--font-sans-landing)] min-h-screen"
    >
      {/* Skip to content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:px-4 focus:py-2 focus:text-sm focus:font-medium bg-[var(--oltigo-green)] text-[var(--bone)]"
      >
        {t("landing.editorial.skipToContent")}
      </a>

      <EditorialHeader
        lang={locale}
        theme={theme}
        onToggleLang={cycleLang}
        onToggleTheme={toggleTheme}
      />

      <main id="main-content">
        <EditorialHero />
        <ManifestoSection />
        <ProductSection />
        <HowItWorksSection />
        <MultiTenantSection />
        <TestimonialsSection />
        <PricingSection />
        <ClosingCtaSection />
      </main>

      <EditorialFooter />
    </div>
  );
}
