"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useLandingLocale } from "../../landing-locale-provider";
import { HairlineRule } from "../hairline-rule";

const PLANS = [
  { name: "Free", price: "0 MAD" },
  { name: "Starter", price: "199 MAD/mois" },
  { name: "Professional", price: "599 MAD/mois" },
  { name: "Enterprise", price: "999 MAD/mois" },
] as const;

/**
 * Pricing teaser \u2014 one row with 4 plan names + starting prices.
 * CTA: "Voir tous les tarifs \u2192".
 */
export function PricingTeaser() {
  const { t } = useLandingLocale();

  return (
    <section style={{ backgroundColor: "var(--bone)" }}>
      <div
        className="mx-auto"
        style={{
          maxWidth: "var(--container-max)",
          paddingInline: "var(--gutter-desktop)",
          paddingBlock: "var(--space-9)",
        }}
      >
        {/* Plan row */}
        {/* eslint-disable i18next/no-literal-string */}
        <div className="grid grid-cols-2 gap-[var(--space-5)] lg:grid-cols-4">
          {PLANS.map(({ name, price }) => (
            <div key={name}>
              <p
                style={{
                  fontSize: "var(--text-h3)",
                  lineHeight: "var(--lh-h3)",
                  letterSpacing: "var(--ls-h3)",
                  fontWeight: 500,
                  color: "var(--ink)",
                }}
              >
                {name}
              </p>
              <p
                className="mt-[var(--space-1)]"
                style={{
                  fontFamily: "var(--font-mono-landing)",
                  fontSize: "var(--text-mono)",
                  lineHeight: "var(--lh-mono)",
                  letterSpacing: "var(--ls-mono)",
                  color: "var(--ink-60)",
                }}
              >
                {price}
              </p>
            </div>
          ))}
        </div>
        {/* eslint-enable i18next/no-literal-string */}

        {/* CTA */}
        <div className="mt-[var(--space-7)]">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-[var(--space-2)] transition-colors"
            style={{
              fontSize: "var(--text-small)",
              fontWeight: 500,
              color: "var(--oltigo-green)",
              textDecoration: "none",
              transitionDuration: "var(--duration)",
            }}
          >
            {t("landing.ctaPricing")}
            <ArrowRight size={16} strokeWidth={1.5} />
          </Link>
        </div>

        <HairlineRule className="mt-[var(--space-7)]" />
      </div>
    </section>
  );
}
