"use client";

import { useLandingLocale } from "../landing-locale-provider";
import { HairlineRule } from "./hairline-rule";

/**
 * §3.3 / §5.9 Testimonials — attributed quotes.
 * Max 280 chars. No quotation-mark glyph at 96pt. No headshots. No carousel.
 * Mono attribution: — DR NAME · CABINET · CITY
 */
export function TestimonialsSection() {
  const { t } = useLandingLocale();

  return (
    <section id="clients" className="bg-[var(--bone)] py-[var(--space-9)]">
      <div className="mx-auto w-full max-w-[var(--container-max)] px-[var(--gutter-desktop)]">
        <HairlineRule />
        <div className="py-[var(--space-7)] max-w-[760px]">
          <p className="font-[var(--font-sans-landing)] text-[length:var(--text-body-lg)] leading-[var(--lh-body-lg)] text-[var(--ink)] not-italic">
            {t("landing.editorial.testimonials-section.depuisQuaposonUtiliseOltigo")}
          </p>
          <p className="mt-[var(--space-5)] font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] tracking-[var(--ls-mono)] uppercase text-[var(--ink-60)]">
            {t("landing.editorial.testimonials-section.attribution")}
          </p>
          <p className="mt-[var(--space-2)] font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] tracking-[var(--ls-mono)] text-[var(--ink-60)]">
            {t("landing.editorial.testimonials-section.productionInfo")}
          </p>
        </div>

        <HairlineRule />

        <p className="mt-[var(--space-5)] font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] tracking-[var(--ls-mono)] text-[var(--ink-60)]">
          {t("landing.editorial.testimonials-section.3AutresEtudesEn")}
        </p>
      </div>
    </section>
  );
}
