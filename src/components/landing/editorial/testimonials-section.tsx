"use client";

import { HairlineRule } from "./hairline-rule";

/**
 * §3.3 / §5.9 Testimonials — attributed quotes.
 * Max 280 chars. No quotation-mark glyph at 96pt. No headshots. No carousel.
 * Mono attribution: — DR NAME · CABINET · CITY
 */
export function TestimonialsSection() {
  return (
    <section
      id="clients"
      style={{
        backgroundColor: "var(--bone)",
        paddingBlock: "var(--space-9)",
      }}
    >
      <div
        className="mx-auto w-full"
        style={{
          maxWidth: "var(--container-max)",
          paddingInline: "var(--gutter-desktop)",
        }}
      >
        {/* eslint-disable i18next/no-literal-string */}
        <HairlineRule />
        <div style={{ paddingBlock: "var(--space-7)", maxWidth: 760 }}>
          <p
            style={{
              fontFamily: "var(--font-sans-landing)",
              fontSize: "var(--text-body-lg)",
              lineHeight: "var(--lh-body-lg)",
              color: "var(--ink)",
              fontStyle: "normal",
            }}
          >
            Depuis qu&apos;on utilise Oltigo, le taux de no-show est passé de
            32% à 8%. Les rappels WhatsApp en darija font la différence — nos
            patients confirment en une minute.
          </p>
          <p
            style={{
              marginTop: "var(--space-5)",
              fontFamily: "var(--font-mono-landing)",
              fontSize: "var(--text-mono)",
              lineHeight: "var(--lh-mono)",
              letterSpacing: "var(--ls-mono)",
              textTransform: "uppercase",
              color: "var(--ink-60)",
            }}
          >
            — Dr Fatima B. · Cabinet Al Amal · Casablanca
          </p>
          <p
            style={{
              marginTop: "var(--space-2)",
              fontFamily: "var(--font-mono-landing)",
              fontSize: "var(--text-mono)",
              lineHeight: "var(--lh-mono)",
              letterSpacing: "var(--ls-mono)",
              color: "var(--ink-60)",
            }}
          >
            EN PRODUCTION DEPUIS 2024-09 · PLAN PROFESSIONAL
          </p>
        </div>

        <HairlineRule />

        <p
          style={{
            marginTop: "var(--space-5)",
            fontFamily: "var(--font-mono-landing)",
            fontSize: "var(--text-mono)",
            lineHeight: "var(--lh-mono)",
            letterSpacing: "var(--ls-mono)",
            color: "var(--ink-60)",
          }}
        >
          3 autres études en préparation
        </p>
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </section>
  );
}
