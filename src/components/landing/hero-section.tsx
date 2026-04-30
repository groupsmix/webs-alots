"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { TranslationKey } from "@/lib/i18n";
import { useLandingLocale } from "./landing-locale-provider";

/**
 * Editorial hero — left-aligned, no gradients, no blobs, no decorative pills.
 *
 * Layout (desktop 1440):
 *   - Mono eyebrow with status dot
 *   - Display headline (72px, two lines, cols 1–9)
 *   - Body-lg subhead (cols 1–7)
 *   - Primary CTA + ghost CTA
 *   - Trust hairline strip with mono metadata
 */
export function HeroSection() {
  const { t } = useLandingLocale();

  return (
    <section
      className="relative"
      style={{ backgroundColor: "var(--bone)" }}
    >
      <div
        className="mx-auto w-full px-[var(--gutter-mobile)] md:px-[var(--gutter-tablet)] lg:px-[var(--gutter-desktop)]"
        style={{ maxWidth: "var(--container-max)" }}
      >
        {/* Eyebrow */}
        <p
          className="pt-[var(--space-9)] flex items-center gap-[var(--space-2)]"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-mono)",
            lineHeight: "var(--lh-mono)",
            color: "var(--ink-60)",
            textTransform: "uppercase",
          }}
        >
          <span>v 16.0</span>
          <span aria-hidden="true">&middot;</span>
          <span>{t("landing.heroEyebrowRegion" as TranslationKey)}</span>
          <span aria-hidden="true">&middot;</span>
          <span className="inline-flex items-center gap-[var(--space-1)]">
            {t("landing.heroEyebrowStatus" as TranslationKey)}
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: "var(--signal-green)" }}
              aria-label="Status: operational"
            />
          </span>
        </p>

        {/* Headline */}
        <h1
          className="mt-[var(--space-5)]"
          style={{
            fontSize: "var(--text-display)",
            lineHeight: "var(--lh-display)",
            letterSpacing: "var(--ls-display)",
            fontWeight: 500,
            color: "var(--ink)",
            maxWidth: "75%", /* cols 1-9 of 12 */
          }}
        >
          {t("landing.heroHeadline" as TranslationKey)}
        </h1>

        {/* Subhead */}
        <p
          className="mt-[var(--space-5)]"
          style={{
            fontSize: "var(--text-body-lg)",
            lineHeight: "var(--lh-body-lg)",
            letterSpacing: "var(--ls-body-lg)",
            color: "var(--ink-70)",
            maxWidth: "58.33%", /* cols 1-7 of 12 */
          }}
        >
          {t("landing.heroSubtitle")}
        </p>

        {/* CTA row */}
        <div className="mt-[var(--space-6)] flex items-center gap-[var(--space-5)] flex-wrap">
          <Link
            href="/register-clinic"
            className="group inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius)] px-[var(--space-5)] text-[var(--text-small)] font-medium transition-colors"
            style={{
              backgroundColor: "var(--oltigo-green)",
              color: "var(--bone)",
              height: "44px",
              transitionDuration: "var(--duration)",
              transitionTimingFunction: "var(--easing)",
            }}
          >
            {t("landing.ctaOpenAccount" as TranslationKey)}
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              style={{ transitionDuration: "var(--duration)" }}
            />
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-[var(--space-2)] text-[var(--text-small)] font-medium transition-colors hover:underline"
            style={{
              color: "var(--oltigo-green)",
              height: "44px",
              transitionDuration: "var(--duration)",
              transitionTimingFunction: "var(--easing)",
            }}
          >
            {t("landing.ctaTalkToSales" as TranslationKey)}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Trust hairline strip */}
        <div
          className="mt-[var(--space-10)] pb-[var(--space-9)]"
        >
          <div style={{ borderTop: "1px solid var(--rule)" }} />
          <div
            className="grid grid-cols-2 gap-[var(--space-5)] py-[var(--space-5)] sm:grid-cols-4"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-mono)",
              lineHeight: "var(--lh-mono)",
              color: "var(--ink-60)",
              textTransform: "uppercase",
            }}
          >
            <div>
              <span style={{ color: "var(--ink)" }}>{t("landing.trustUptime" as TranslationKey)}</span>{" "}
              {t("landing.trustUptimeLabel" as TranslationKey)}
            </div>
            <div>
              <span style={{ color: "var(--ink)" }}>{t("landing.trustEncryption" as TranslationKey)}</span>{" "}
              {t("landing.trustEncryptionLabel" as TranslationKey)}
            </div>
            <div>
              <span style={{ color: "var(--ink)" }}>{t("landing.trustCompliance" as TranslationKey)}</span>{" "}
              {t("landing.trustComplianceLabel" as TranslationKey)}
            </div>
            <div>
              <span style={{ color: "var(--ink)" }}>{t("landing.trustLatency" as TranslationKey)}</span>{" "}
              {t("landing.trustLatencyLabel" as TranslationKey)}
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--rule)" }} />
        </div>
      </div>

      {/* Mobile overrides */}
      <style>{`
        @media (max-width: 767px) {
          .hero-headline-override h1 {
            font-size: 2.25rem !important;
            max-width: 100% !important;
          }
        }
      `}</style>
    </section>
  );
}
