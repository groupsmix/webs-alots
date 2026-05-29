"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useLandingLocale } from "../landing-locale-provider";
import { HairlineRule } from "./hairline-rule";

/**
 * §3.1.9 Closing CTA — same compact pattern as hero top.
 * No second hero. Primary + ghost.
 */
export function ClosingCtaSection() {
  const { t } = useLandingLocale();

  return (
    <section className="bg-[var(--bone)] py-[var(--space-9)]">
      <div className="mx-auto w-full max-w-[var(--container-max)] px-[var(--gutter-desktop)]">
        <HairlineRule />
        <div className="py-[var(--space-7)] max-w-[720px]">
          <h2 className="font-[var(--font-sans-landing)] text-[length:var(--text-h1)] leading-[var(--lh-h1)] tracking-[var(--ls-h1)] font-medium text-[var(--ink)]">
            {t("landing.editorial.closing-cta-section.pretASimplifierVotre")}
          </h2>
          <p className="mt-[var(--space-5)] font-[var(--font-sans-landing)] text-[length:var(--text-body-lg)] leading-[var(--lh-body-lg)] text-[var(--ink-70)]">
            {t("landing.editorial.closing-cta-section.creezVotreCompteEn")}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/register-clinic"
              className="group inline-flex items-center gap-2 font-[var(--font-sans-landing)] text-[length:var(--text-small)] font-medium h-11 px-6 rounded-[var(--radius-landing)] bg-[var(--oltigo-green)] text-[var(--bone)] no-underline transition-opacity duration-[var(--duration)] ease-[var(--easing)]"
            >
              {t("landing.ctaOpenAccount")}
              <ArrowRight className="size-4 transition-transform duration-[var(--duration)] ease-[var(--easing)] group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 rtl:rotate-180" />
            </Link>
            <a
              href="#contact"
              className="font-[var(--font-sans-landing)] text-[length:var(--text-small)] font-medium text-[var(--oltigo-green)] no-underline hover:underline"
            >
              {t("landing.ctaTalkToSales")} →
            </a>
          </div>
        </div>
        <HairlineRule />
      </div>
    </section>
  );
}
