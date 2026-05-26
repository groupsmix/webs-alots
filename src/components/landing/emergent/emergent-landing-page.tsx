"use client";

import { useState } from "react";
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
 * Bilingual FR/AR with RTL toggle. Respects prefers-reduced-motion.
 */
export function EmergentLandingPage() {
  const [lang, setLang] = useState<"fr" | "ar">("fr");
  const rtl = lang === "ar";

  return (
    <div
      dir={rtl ? "rtl" : "ltr"}
      className="relative min-h-screen transition-all duration-300"
      style={{
        backgroundColor: "var(--lab-linen)",
        color: "var(--ink)",
        fontFamily: "var(--font-sans-landing)",
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
        onToggleLang={() => setLang(lang === "fr" ? "ar" : "fr")}
      />

      <main id="main-content">
        {/* 1. Hero */}
        <EmergentHero rtl={rtl} />

        {/* 2. Multi-tenant */}
        <MultiTenantSection />

        {/* 3. Booking flow */}
        <BookingSection />

        {/* 4. WhatsApp */}
        <WhatsAppSection />

        {/* 5. Security */}
        <SecuritySection />

        {/* 6. RBAC */}
        <RbacSection />

        {/* 7. Insurance */}
        <InsuranceSection />

        {/* 8. Payments */}
        <PaymentsSection />

        {/* 9. Dashboard */}
        <DashboardSection />

        {/* 10. Manifesto */}
        <ManifestoSection />

        {/* 11. Trust strip */}
        <TrustStripSection />

        {/* 12. Pricing */}
        <PricingSection />

        {/* 13. Testimonials */}
        <TestimonialsSection />

        {/* 14. FAQ */}
        <FaqSection />

        {/* 15. Final CTA */}
        <FinalCtaSection />
      </main>

      {/* 16. Footer */}
      <EmergentFooter />

      {/* Floating carnet de santé */}
      <CarnetSante rtl={rtl} />
    </div>
  );
}
