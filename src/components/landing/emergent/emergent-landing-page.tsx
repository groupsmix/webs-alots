"use client";

import { useEffect, useState } from "react";
import { BookingSection } from "./booking-section";
import { CarnetSante } from "./carnet-sante";
import { DashboardSection } from "./dashboard-section";
import { EcgPulse } from "./ecg-pulse";
import { EmergentFooter } from "./emergent-footer";
import { EmergentHeader } from "./emergent-header";
import { FaqSection } from "./faq-section";
import { FinalCtaSection } from "./final-cta-section";
import { EmergentHero } from "./hero-section";
import { InsuranceSection } from "./insurance-section";
import { ManifestoSection } from "./manifesto-section";
import { MultiTenantSection } from "./multi-tenant-section";
import { PaperGrain } from "./paper-grain";
import { PaymentsSection } from "./payments-section";
import { PricingSection } from "./pricing-section";
import { RbacSection } from "./rbac-section";
import { SecuritySection } from "./security-section";
import { TestimonialsSection } from "./testimonials-section";
import { TrustStripSection } from "./trust-strip-section";
import { WhatsAppSection } from "./whatsapp-section";

/**
 * Emergent cinematic landing page for Oltigo Health.
 *
 * 16 sections + floating carnet de santé + ECG pulse + paper grain.
 * Bilingual FR/AR with RTL toggle. Dark/light mode. Respects prefers-reduced-motion.
 */
export function EmergentLandingPage() {
  const [lang, setLang] = useState<"fr" | "ar">("fr");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem("oltigo-theme") as "light" | "dark" | null;
    if (stored) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const rtl = lang === "ar";

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

  return (
    <div
      dir={rtl ? "rtl" : "ltr"}
      data-theme={theme}
      className="relative min-h-screen transition-all duration-300"
      style={{
        backgroundColor: "var(--lab-linen)",
        color: "var(--ink)",
        fontFamily: "var(--font-sans-landing)",
        cursor: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12'%3E%3Ccircle cx='6' cy='6' r='4' fill='%231A1D21'/%3E%3C/svg%3E\") 6 6, auto",
      }}
    >
      {/* Skip to content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:px-4 focus:py-2 focus:text-sm focus:font-medium"
        style={{ backgroundColor: "var(--surgical-sage)", color: "white" }}
      >
        {rtl ? "الانتقال إلى المحتوى الرئيسي" : "Aller au contenu principal"}
      </a>

      <PaperGrain />
      <EcgPulse rtl={rtl} />

      <EmergentHeader
        lang={lang}
        theme={theme}
        onToggleLang={() => setLang(lang === "fr" ? "ar" : "fr")}
        onToggleTheme={toggleTheme}
      />

      <main id="main-content">
        {/* 1. Hero */}
        <EmergentHero rtl={rtl} />

        {/* 2. Multi-tenant */}
        <section className="emergent-section">
          <MultiTenantSection />
        </section>

        {/* 3. Booking flow */}
        <section className="emergent-section">
          <BookingSection />
        </section>

        {/* 4. WhatsApp */}
        <section className="emergent-section">
          <WhatsAppSection />
        </section>

        {/* 5. Security */}
        <section className="emergent-section">
          <SecuritySection />
        </section>

        {/* 6. RBAC */}
        <section className="emergent-section">
          <RbacSection />
        </section>

        {/* 7. Insurance */}
        <section className="emergent-section">
          <InsuranceSection />
        </section>

        {/* 8. Payments */}
        <section className="emergent-section">
          <PaymentsSection />
        </section>

        {/* 9. Dashboard */}
        <section className="emergent-section">
          <DashboardSection />
        </section>

        {/* 10. Manifesto */}
        <section className="emergent-section">
          <ManifestoSection />
        </section>

        {/* 11. Trust strip */}
        <section className="emergent-section">
          <TrustStripSection />
        </section>

        {/* 12. Pricing */}
        <section className="emergent-section">
          <PricingSection />
        </section>

        {/* 13. Testimonials */}
        <section className="emergent-section">
          <TestimonialsSection />
        </section>

        {/* 14. FAQ */}
        <section className="emergent-section">
          <FaqSection />
        </section>

        {/* 15. Final CTA */}
        <FinalCtaSection />
      </main>

      {/* 16. Footer */}
      <EmergentFooter />

      {/* Floating carnet de santé */}
      <CarnetSante rtl={rtl} />

      <style>{`
        .emergent-section {
          position: relative;
          z-index: 1;
        }
        @media (prefers-reduced-motion: no-preference) {
          .emergent-section {
            clip-path: inset(0 0 0 0);
          }
        }
        /* Custom cursor on interactive elements */
        [data-theme] a,
        [data-theme] button,
        [data-theme] [role="button"] {
          cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Ccircle cx='10' cy='10' r='8' fill='none' stroke='%235B8A72' stroke-width='2'/%3E%3Ccircle cx='10' cy='10' r='3' fill='%235B8A72'/%3E%3C/svg%3E") 10 10, pointer;
        }
      `}</style>
    </div>
  );
}
