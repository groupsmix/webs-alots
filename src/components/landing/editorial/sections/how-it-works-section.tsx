"use client";

import type { TranslationKey } from "@/lib/i18n";
import { useLandingLocale } from "../../landing-locale-provider";
import { HairlineRule } from "../hairline-rule";

const STEPS: readonly { num: string; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  { num: "01", titleKey: "landing.howStep1Title" as TranslationKey, descKey: "landing.howStep1Desc" as TranslationKey },
  { num: "02", titleKey: "landing.howStep2Title" as TranslationKey, descKey: "landing.howStep2Desc" as TranslationKey },
  { num: "03", titleKey: "landing.howStep3Title" as TranslationKey, descKey: "landing.howStep3Desc" as TranslationKey },
  { num: "04", titleKey: "landing.howStep4Title" as TranslationKey, descKey: "landing.howStep4Desc" as TranslationKey },
];

/**
 * How it works \u2014 4 numbered steps.
 * Desktop: 4 columns. Mobile: 1 column.
 * Each step = mono "\u00C9TAPE 01" + h3 + 2 body lines. No icons, no illustration.
 */
export function HowItWorksSection() {
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
        <HairlineRule />

        {/* Section header */}
        <h2
          className="mt-[var(--space-7)]"
          style={{
            fontSize: "var(--text-h2)",
            lineHeight: "var(--lh-h2)",
            letterSpacing: "var(--ls-h2)",
            fontWeight: 500,
            color: "var(--ink)",
          }}
        >
          {t("landing.howTitle" as TranslationKey)}
        </h2>
        <p
          className="mt-[var(--space-3)]"
          style={{
            fontSize: "var(--text-body-lg)",
            lineHeight: "var(--lh-body-lg)",
            color: "var(--ink-70)",
            maxWidth: "720px",
          }}
        >
          {t("landing.howSubtitle" as TranslationKey)}
        </p>

        {/* Steps grid */}
        <div className="mt-[var(--space-7)] grid grid-cols-1 gap-[var(--space-7)] sm:grid-cols-2 lg:grid-cols-4">
          {/* eslint-disable i18next/no-literal-string */}
          {STEPS.map(({ num, titleKey, descKey }) => (
            <div key={num}>
              <p
                style={{
                  fontFamily: "var(--font-mono-landing)",
                  fontSize: "var(--text-mono)",
                  lineHeight: "var(--lh-mono)",
                  letterSpacing: "var(--ls-mono)",
                  textTransform: "uppercase",
                  color: "var(--ink-60)",
                }}
              >
                {`\u00C9TAPE ${num}`}
              </p>
              <h3
                className="mt-[var(--space-3)]"
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
              <p
                className="mt-[var(--space-2)]"
                style={{
                  fontSize: "var(--text-body)",
                  lineHeight: "var(--lh-body)",
                  color: "var(--ink-70)",
                }}
              >
                {t(descKey)}
              </p>
            </div>
          ))}
          {/* eslint-enable i18next/no-literal-string */}
        </div>
      </div>
    </section>
  );
}
