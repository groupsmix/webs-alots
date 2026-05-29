"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { TranslationKey } from "@/lib/i18n";
import { useLandingLocale } from "../landing-locale-provider";
import { HairlineRule } from "./hairline-rule";

/**
 * §3.1.8 Pricing teaser — one row, 4 plan names with starting prices.
 * Professional column has a 2px left rule in --oltigo-green.
 */
export function PricingSection() {
  const { t } = useLandingLocale();

  const plans: Array<{ nameKey: TranslationKey; priceKey: TranslationKey; highlighted: boolean }> =
    [
      {
        nameKey: "landing.editorial.pricing-section.free",
        priceKey: "landing.editorial.pricing-section.freePrice",
        highlighted: false,
      },
      {
        nameKey: "landing.editorial.pricing-section.starter",
        priceKey: "landing.editorial.pricing-section.starterPrice",
        highlighted: false,
      },
      {
        nameKey: "landing.editorial.pricing-section.professional",
        priceKey: "landing.editorial.pricing-section.professionalPrice",
        highlighted: true,
      },
      {
        nameKey: "landing.editorial.pricing-section.enterprise",
        priceKey: "landing.editorial.pricing-section.enterprisePrice",
        highlighted: false,
      },
    ];

  return (
    <section id="pricing" className="bg-[var(--bone)] py-[var(--space-9)]">
      <div className="mx-auto w-full max-w-[var(--container-max)] px-[var(--gutter-desktop)]">
        <HairlineRule />
        <div className="grid grid-cols-2 md:grid-cols-4 py-[var(--space-6)]">
          {plans.map((plan) => (
            <div
              key={plan.nameKey}
              className={`px-[var(--space-4)] py-[var(--space-4)] ${plan.highlighted ? "border-s-2 border-s-[var(--oltigo-green)]" : ""}`}
            >
              <span className="font-[var(--font-sans-landing)] text-[length:var(--text-small)] font-medium text-[var(--ink)]">
                {t(plan.nameKey)}
              </span>
              <span className="block mt-[var(--space-1)] font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] tracking-[var(--ls-mono)] text-[var(--ink-60)] break-words">
                {t(plan.priceKey)}
              </span>
            </div>
          ))}
        </div>
        <HairlineRule />

        {/* CTA */}
        <div className="mt-[var(--space-5)]">
          <Link
            href="/pricing"
            className="group inline-flex items-center gap-1 font-[var(--font-sans-landing)] text-[length:var(--text-small)] font-medium text-[var(--oltigo-green)] no-underline"
          >
            {t("landing.editorial.pricing-section.viewAll")}
            <ArrowRight className="size-3.5 transition-transform duration-[var(--duration)] ease-[var(--easing)] group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 rtl:rotate-180" />
          </Link>
        </div>
      </div>
    </section>
  );
}
