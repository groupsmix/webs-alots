"use client";

import { useLandingLocale } from "../landing-locale-provider";
import { HairlineRule } from "./hairline-rule";

const TESTIMONIALS = [
  {
    quote:
      "Depuis qu\u2019on utilise Oltigo, le taux de no-show est pass\u00e9 de 32% \u00e0 8%. Les rappels WhatsApp en darija font la diff\u00e9rence \u2014 nos patients confirment en une minute.",
    name: "Dr Fatima B.",
    cabinet: "Cabinet Al Amal",
    city: "Casablanca",
    since: "2024-09",
    plan: "PROFESSIONAL",
  },
  {
    quote:
      "L\u2019int\u00e9gration WhatsApp a transform\u00e9 notre gestion quotidienne. Mes assistantes passent 2h de moins au t\u00e9l\u00e9phone par jour. Le dossier patient chiffr\u00e9 nous donne une vraie tranquillit\u00e9.",
    name: "Dr Youssef M.",
    cabinet: "Centre Dentaire Agdal",
    city: "Rabat",
    since: "2024-11",
    plan: "PROFESSIONAL",
  },
  {
    quote:
      "En p\u00e9diatrie, les parents veulent confirmer vite. Avec les rappels automatiques et la prise de RDV en ligne, on a r\u00e9duit les appels entrants de 60%. Oltigo est devenu indispensable.",
    name: "Dr Amina K.",
    cabinet: "Cabinet P\u00e9diatrique Gueliz",
    city: "Marrakech",
    since: "2025-01",
    plan: "STARTER",
  },
];

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
        {/* eslint-disable i18next/no-literal-string */}
        {TESTIMONIALS.map((testimonial) => (
          <div key={testimonial.name}>
            <HairlineRule />
            <div className="py-[var(--space-7)] max-w-full md:max-w-[760px]">
              <p className="font-[var(--font-sans-landing)] text-[length:var(--text-body-lg)] leading-[var(--lh-body-lg)] text-[var(--ink)] not-italic">
                {testimonial.quote}
              </p>
              <p className="mt-[var(--space-5)] font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] tracking-[var(--ls-mono)] uppercase text-[var(--ink-60)]">
                &mdash; {testimonial.name} &middot; {testimonial.cabinet} &middot;{" "}
                {testimonial.city}
              </p>
              <p className="mt-[var(--space-2)] font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] tracking-[var(--ls-mono)] text-[var(--ink-60)]">
                EN PRODUCTION DEPUIS {testimonial.since} &middot; PLAN {testimonial.plan}
              </p>
            </div>
          </div>
        ))}
        {/* eslint-enable i18next/no-literal-string */}

        <HairlineRule />

        <p className="mt-[var(--space-5)] font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] tracking-[var(--ls-mono)] text-[var(--ink-60)]">
          {t("landing.editorial.testimonials-section.3AutresEtudesEn")}
        </p>
      </div>
    </section>
  );
}
