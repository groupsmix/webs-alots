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
    <section
      id="pricing"
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
        <div className="grid grid-cols-2 md:grid-cols-4" style={{ paddingBlock: "var(--space-6)" }}>
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              style={{
                paddingInline: "var(--space-4)",
                paddingBlock: "var(--space-4)",
                borderInlineStart: plan.highlighted
                  ? "2px solid var(--oltigo-green)"
                  : "none",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-sans-landing)",
                  fontSize: "var(--text-small)",
                  fontWeight: 500,
                  color: "var(--ink)",
                }}
              >
                {plan.name}
              </span>
              <span
                className="block"
                style={{
                  marginTop: "var(--space-1)",
                  fontFamily: "var(--font-mono-landing)",
                  fontSize: "var(--text-mono)",
                  lineHeight: "var(--lh-mono)",
                  letterSpacing: "var(--ls-mono)",
                  color: "var(--ink-60)",
                }}
              >
                {plan.price}
              </span>
            </div>
          ))}
        </div>
        <HairlineRule />

        {/* CTA */}
        <div style={{ marginTop: "var(--space-5)" }}>
          <Link
            href="/pricing"
            className="group inline-flex items-center gap-1"
            style={{
              fontFamily: "var(--font-sans-landing)",
              fontSize: "var(--text-small)",
              fontWeight: 500,
              color: "var(--oltigo-green)",
              textDecoration: "none",
            }}
          >
            Voir tous les tarifs
            <ArrowRight
              style={{
                width: 14,
                height: 14,
                transition: `transform var(--duration) var(--easing)`,
              }}
              className="group-hover:translate-x-0.5"
            />
          </Link>
        </div>
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </section>
  );
}
