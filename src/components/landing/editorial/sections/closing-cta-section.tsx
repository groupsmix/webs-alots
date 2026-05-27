"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { TranslationKey } from "@/lib/i18n";
import { useLandingLocale } from "../../landing-locale-provider";

/**
 * Closing CTA \u2014 same compact pattern as the hero top.
 * Primary "Ouvrir un compte" + ghost "Parler aux ventes".
 * No second hero \u2014 just H2, subhead, CTAs.
 */
export function ClosingCtaSection() {
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
        <h2
          style={{
            fontSize: "var(--text-h2)",
            lineHeight: "var(--lh-h2)",
            letterSpacing: "var(--ls-h2)",
            fontWeight: 500,
            color: "var(--ink)",
            maxWidth: "720px",
          }}
        >
          {t("landing.ctaTitle")}
        </h2>
        <p
          className="mt-[var(--space-5)]"
          style={{
            fontSize: "var(--text-body-lg)",
            lineHeight: "var(--lh-body-lg)",
            color: "var(--ink-70)",
            maxWidth: "720px",
          }}
        >
          {t("landing.ctaSubtitle")}
        </p>

        {/* CTA row */}
        <div className="mt-[var(--space-6)] flex flex-wrap items-center gap-[var(--space-5)]">
          <Link
            href="/register-clinic"
            className="landing-btn group inline-flex items-center gap-[var(--space-2)]"
            style={{
              height: "44px",
              paddingInline: "var(--space-5)",
              backgroundColor: "var(--oltigo-green)",
              color: "var(--bone)",
              borderRadius: "var(--radius-landing)",
              fontSize: "var(--text-small)",
              fontWeight: 500,
              textDecoration: "none",
              transitionProperty: "background-color",
              transitionDuration: "var(--duration)",
              transitionTimingFunction: "var(--easing)",
            }}
          >
            {t("landing.ctaOpenAccount" as TranslationKey)}
            <ArrowRight
              size={16}
              strokeWidth={1.5}
              className="cta-arrow transition-transform"
              style={{
                transitionDuration: "var(--duration)",
                transitionTimingFunction: "var(--easing)",
              }}
            />
          </Link>

          <Link
            href="/contact"
            className="inline-flex items-center gap-[var(--space-2)] transition-colors"
            style={{
              fontSize: "var(--text-small)",
              fontWeight: 500,
              color: "var(--oltigo-green)",
              textDecoration: "none",
              transitionDuration: "var(--duration)",
            }}
          >
            {t("landing.ctaTalkToSales" as TranslationKey)}
            <ArrowRight size={16} strokeWidth={1.5} />
          </Link>
        </div>
      </div>
    </section>
  );
}
