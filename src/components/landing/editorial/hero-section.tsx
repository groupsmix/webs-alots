"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useLandingLocale } from "../landing-locale-provider";
import { HairlineRule } from "./hairline-rule";
import { StatBlock } from "./stat-block";
import { StatusDot } from "./status-dot";

/**
 * §3.1 / §4.1 Hero — editorial-institutional.
 * Mono eyebrow → display headline → body-lg subhead → CTAs → trust strip.
 */
export function EditorialHero() {
  const { t } = useLandingLocale();

  return (
    <section className="bg-[var(--bone)]">
      <div className="mx-auto w-full max-w-[var(--container-max)] px-[var(--gutter-desktop)]">
        {/* Spacer: --space-9 (96px) */}
        <div className="h-[var(--space-9)]" />

        {/* Mono eyebrow */}
        <div className="flex items-center gap-2 font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] tracking-[var(--ls-mono)] uppercase font-medium text-[var(--ink-60)]">
          {t("landing.editorial.hero-section.v160RegionCasablanca")} <StatusDot />
        </div>

        {/* Spacer */}
        <div className="h-[var(--space-5)]" />

        {/* Display headline — responsive width */}
        <h1 className="font-[var(--font-sans-landing)] text-[length:clamp(2.5rem,5vw,var(--text-display))] leading-[var(--lh-display)] tracking-[var(--ls-display)] font-medium text-[var(--ink)] max-w-full md:max-w-[75%]">
          {t("landing.editorial.hero-section.laPlateformeCompletePour")}
        </h1>

        {/* Spacer */}
        <div className="h-[var(--space-5)]" />

        {/* Subhead — responsive width */}
        <p className="font-[var(--font-sans-landing)] text-[length:var(--text-body-lg)] leading-[var(--lh-body-lg)] text-[var(--ink-70)] max-w-full md:max-w-[58%]">
          {t("landing.editorial.hero-section.creezLeSiteDe")}
        </p>

        {/* Spacer */}
        <div className="h-[var(--space-6)]" />

        {/* CTAs */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Primary CTA */}
          <Link
            href="/register-clinic"
            className="group inline-flex items-center gap-2 font-[var(--font-sans-landing)] text-[length:var(--text-small)] font-medium h-11 px-6 rounded-[var(--radius-landing)] bg-[var(--oltigo-green)] text-[var(--bone)] no-underline transition-opacity duration-[var(--duration)] ease-[var(--easing)]"
          >
            {t("landing.ctaOpenAccount")}
            <ArrowRight className="size-4 transition-transform duration-[var(--duration)] ease-[var(--easing)] group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 rtl:rotate-180" />
          </Link>

          {/* Demo CTA */}
          <a
            href="http://demo.localhost:3000"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center font-[var(--font-sans-landing)] text-[length:var(--text-small)] font-medium h-11 px-6 rounded-[var(--radius-landing)] border border-[var(--ink-20)] text-[var(--ink)] bg-transparent hover:bg-[var(--ink-5)] transition-colors"
          >
            Voir la démo
          </a>

          {/* Ghost CTA */}
          <a
            href="#contact"
            className="font-[var(--font-sans-landing)] text-[length:var(--text-small)] font-medium text-[var(--oltigo-green)] no-underline underline-offset-4 transition-[text-decoration] duration-[var(--duration)] ease-[var(--easing)] hover:underline"
          >
            {t("landing.ctaTalkToSales")} →
          </a>
        </div>

        {/* Spacer: --space-10 (128px) */}
        <div className="h-[var(--space-10)]" />

        {/* Trust hairline (top) */}
        <HairlineRule />

        {/* Trust strip: 6 stat blocks */}
        <div className="py-[var(--space-5)]">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <StatBlock
              value={t("landing.trustUptime")}
              label={t("landing.editorial.hero-section.statUptimeLabel")}
            />
            <StatBlock
              value={t("landing.trustEncryption")}
              label={t("landing.editorial.hero-section.statEncryptionLabel")}
            />
            <StatBlock
              value={t("landing.trustCompliance")}
              label={t("landing.editorial.hero-section.statComplianceLabel")}
            />
            <StatBlock
              value={t("landing.trustLatency")}
              label={t("landing.editorial.hero-section.statLatencyLabel")}
            />
          </div>
        </div>

        {/* Trust hairline (bottom) */}
        <HairlineRule />

        {/* Spacer: --space-9 */}
        <div className="h-[var(--space-9)]" />
      </div>
    </section>
  );
}
