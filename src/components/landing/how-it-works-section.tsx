"use client";

import type { TranslationKey } from "@/lib/i18n";
import { useLandingLocale } from "./landing-locale-provider";

/**
 * How it works — 4 numbered rows, mono numerals, stacked, left-aligned.
 * No connecting arrows or progress bars. No icons.
 * 64px between rows.
 */

const steps: readonly {
  number: string;
  titleKey: TranslationKey;
  descKey: TranslationKey;
}[] = [
  { number: "01", titleKey: "landing.howStep1Title", descKey: "landing.howStep1Desc" },
  { number: "02", titleKey: "landing.howStep2Title", descKey: "landing.howStep2Desc" },
  { number: "03", titleKey: "landing.howStep3Title", descKey: "landing.howStep3Desc" },
  { number: "04", titleKey: "landing.howStep4Title", descKey: "landing.howStep4Desc" },
];

export function HowItWorksSection() {
  const { t } = useLandingLocale();

  return (
    <section
      id="comment-ca-marche"
      className="py-[var(--space-9)] md:py-[var(--space-10)]"
      style={{ backgroundColor: "var(--bone)" }}
    >
      <div
        className="mx-auto px-[var(--gutter-mobile)] md:px-[var(--gutter-tablet)] lg:px-[var(--gutter-desktop)]"
        style={{ maxWidth: "var(--container-max)" }}
      >
        {/* Eyebrow + heading */}
        <p
          style={{
            fontFamily: "var(--font-mono-landing)",
            fontSize: "var(--text-mono)",
            lineHeight: "var(--lh-mono)",
            color: "var(--ink-60)",
            textTransform: "uppercase",
            marginBottom: "var(--space-4)",
          }}
        >
          {"02 \u2014 "}
          {t("landing.howLabel")}
        </p>
        <h2
          style={{
            fontSize: "var(--text-h2)",
            lineHeight: "var(--lh-h2)",
            letterSpacing: "var(--ls-h2)",
            fontWeight: 500,
            color: "var(--ink)",
          }}
        >
          {t("landing.howTitle")}
        </h2>

        {/* Steps */}
        <div className="mt-[var(--space-8)]">
          {steps.map(({ number, titleKey, descKey }, idx) => (
            <div
              key={number}
              className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-12"
              style={{
                paddingTop: idx === 0 ? 0 : "var(--space-8)",
                borderTop: idx === 0 ? undefined : "1px solid var(--rule)",
                marginTop: idx === 0 ? 0 : "var(--space-8)",
              }}
            >
              {/* Number */}
              <div
                className="sm:col-span-1"
                style={{
                  fontFamily: "var(--font-mono-landing)",
                  fontSize: "var(--text-mono)",
                  lineHeight: "var(--lh-mono)",
                  color: "var(--ink-60)",
                }}
              >
                {number}.
              </div>
              {/* Title */}
              <div className="sm:col-span-3">
                <h3
                  style={{
                    fontSize: "var(--text-h3)",
                    lineHeight: "var(--lh-h3)",
                    letterSpacing: "var(--ls-h3)",
                    fontWeight: 500,
                    color: "var(--ink)",
                  }}
                >
                  {t(titleKey)}
                </h3>
              </div>
              {/* Description */}
              <div className="sm:col-span-8">
                <p
                  style={{
                    fontSize: "var(--text-body)",
                    lineHeight: "var(--lh-body)",
                    color: "var(--ink-60)",
                  }}
                >
                  {t(descKey)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
