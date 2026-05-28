"use client";

import { HairlineRule } from "./hairline-rule";

/**
 * §3.3 / §5.9 Testimonials — attributed quotes.
 * Max 280 chars. No quotation-mark glyph at 96pt. No headshots. No carousel.
 * Mono attribution: — DR NAME · CABINET · CITY
 */
export function TestimonialsSection() {
  return (
    <section id="clients" className="bg-[var(--bone)] py-[var(--space-9)]">
      <div className="mx-auto w-full max-w-[var(--container-max)] px-[var(--gutter-desktop)]">
        {/* eslint-disable i18next/no-literal-string */}
        <HairlineRule />
        <div className="py-[var(--space-7)] max-w-[760px]">
          <p className="font-[var(--font-sans-landing)] text-[length:var(--text-body-lg)] leading-[var(--lh-body-lg)] text-[var(--ink)] not-italic">
            Depuis qu&apos;on utilise Oltigo, le taux de no-show est passé de 32% à 8%. Les rappels
            WhatsApp en darija font la différence — nos patients confirment en une minute.
          </p>
          <p className="mt-[var(--space-5)] font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] tracking-[var(--ls-mono)] uppercase text-[var(--ink-60)]">
            — Dr Fatima B. · Cabinet Al Amal · Casablanca
          </p>
          <p className="mt-[var(--space-2)] font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] tracking-[var(--ls-mono)] text-[var(--ink-60)]">
            EN PRODUCTION DEPUIS 2024-09 · PLAN PROFESSIONAL
          </p>
        </div>

        <HairlineRule />

        <p className="mt-[var(--space-5)] font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] tracking-[var(--ls-mono)] text-[var(--ink-60)]">
          3 autres études en préparation
        </p>
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </section>
  );
}
