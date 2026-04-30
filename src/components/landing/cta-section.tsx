"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { TranslationKey } from "@/lib/i18n";
import { useLandingLocale } from "./landing-locale-provider";

/**
 * Closing CTA — Full-width, Ink background, Bone text.
 * 192px vertical padding.
 * Left-aligned h2 + body-lg on cols 1-7.
 * Primary inverted CTA + ghost "Talk to sales" on cols 9-12.
 */
export function CtaSection() {
  const { t } = useLandingLocale();

  return (
    <section
      className="py-[var(--space-11)]"
      style={{ backgroundColor: "var(--ink)" }}
    >
      <div
        className="mx-auto grid grid-cols-1 gap-[var(--space-8)] px-[var(--gutter-mobile)] md:px-[var(--gutter-tablet)] lg:grid-cols-12 lg:px-[var(--gutter-desktop)]"
        style={{ maxWidth: "var(--container-max)" }}
      >
        {/* Copy */}
        <div className="lg:col-span-7">
          <h2
            style={{
              fontSize: "var(--text-h2)",
              lineHeight: "var(--lh-h2)",
              letterSpacing: "var(--ls-h2)",
              fontWeight: 500,
              color: "var(--bone)",
            }}
          >
            {t("landing.ctaTitle")}
          </h2>
          <p
            className="mt-[var(--space-4)]"
            style={{
              fontSize: "var(--text-body-lg)",
              lineHeight: "var(--lh-body-lg)",
              letterSpacing: "var(--ls-body-lg)",
              color: "rgba(246, 244, 238, 0.7)",
            }}
          >
            {t("landing.ctaSubtitle")}
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col items-start gap-[var(--space-4)] lg:col-span-5 lg:items-end lg:justify-center">
          <Link
            href="/register-clinic"
            className="group inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius)] px-[var(--space-5)] transition-colors"
            style={{
              backgroundColor: "var(--bone)",
              color: "var(--ink)",
              height: "44px",
              fontSize: "var(--text-small)",
              fontWeight: 500,
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
            className="inline-flex items-center gap-[var(--space-2)] transition-colors"
            style={{
              color: "rgba(246, 244, 238, 0.7)",
              fontSize: "var(--text-small)",
              fontWeight: 500,
              height: "44px",
              transitionDuration: "var(--duration)",
            }}
          >
            {t("landing.ctaTalkToSales" as TranslationKey)}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
