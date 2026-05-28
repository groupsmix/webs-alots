"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { HairlineRule } from "./hairline-rule";

const PLANS = [
  { name: "Free", price: "0 MAD", highlighted: false },
  { name: "Starter", price: "199 MAD/mois", highlighted: false },
  { name: "Professional", price: "599 MAD/mois", highlighted: true },
  { name: "Enterprise", price: "999 MAD/mois", highlighted: false },
];

/**
 * §3.1.8 Pricing teaser — one row, 4 plan names with starting prices.
 * Professional column has a 2px left rule in --oltigo-green.
 */
export function PricingSection() {
  return (
    <section id="pricing" className="bg-[var(--bone)] py-[var(--space-9)]">
      <div className="mx-auto w-full max-w-[var(--container-max)] px-[var(--gutter-desktop)]">
        {/* eslint-disable i18next/no-literal-string */}
        <HairlineRule />
        <div className="grid grid-cols-2 md:grid-cols-4 py-[var(--space-6)]">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`px-[var(--space-4)] py-[var(--space-4)] ${plan.highlighted ? "border-s-2 border-s-[var(--oltigo-green)]" : ""}`}
            >
              <span className="font-[var(--font-sans-landing)] text-[length:var(--text-small)] font-medium text-[var(--ink)]">
                {plan.name}
              </span>
              <span className="block mt-[var(--space-1)] font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] tracking-[var(--ls-mono)] text-[var(--ink-60)]">
                {plan.price}
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
            Voir tous les tarifs
            <ArrowRight className="size-3.5 transition-transform duration-[var(--duration)] ease-[var(--easing)] group-hover:translate-x-0.5" />
          </Link>
        </div>
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </section>
  );
}
