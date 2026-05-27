"use client";

import type { TranslationKey } from "@/lib/i18n";
import { useLandingLocale } from "../../landing-locale-provider";
import { HairlineRule } from "../hairline-rule";

const ROWS: readonly { titleKey: TranslationKey; descKey: TranslationKey }[] = [
  {
    titleKey: "landing.featureAppointmentsTitle" as TranslationKey,
    descKey: "landing.featureAppointmentsDesc" as TranslationKey,
  },
  {
    titleKey: "landing.featurePatientsTitle" as TranslationKey,
    descKey: "landing.featurePatientsDesc" as TranslationKey,
  },
  {
    titleKey: "landing.featureAutomationTitle" as TranslationKey,
    descKey: "landing.featureAutomationDesc" as TranslationKey,
  },
];

/**
 * Product anatomy \u2014 three rows \u00D7 two columns.
 * Left column = label + 2-line description.
 * Right column = product screenshot placeholder.
 *
 * Section padding --space-9 top/bottom.
 * Each row separated by --rule.
 * No floating browser chrome around screenshots. No isometric mocks.
 */
export function ProductAnatomySection() {
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
        {ROWS.map(({ titleKey, descKey }, idx) => (
          <div key={titleKey}>
            {idx > 0 && <HairlineRule className="my-0" />}
            <div
              className="grid grid-cols-1 gap-[var(--space-6)] py-[var(--space-7)] lg:grid-cols-2 lg:items-center"
            >
              {/* Left: label + description */}
              <div>
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
                <p
                  className="mt-[var(--space-3)]"
                  style={{
                    fontSize: "var(--text-body)",
                    lineHeight: "var(--lh-body)",
                    color: "var(--ink-70)",
                    maxWidth: "480px",
                  }}
                >
                  {t(descKey)}
                </p>
              </div>

              {/* Right: screenshot area (bone bg, hairline border) */}
              <div
                style={{
                  aspectRatio: "16 / 10",
                  backgroundColor: "var(--bone-2)",
                  border: "1px solid var(--rule)",
                  borderRadius: "var(--radius-landing)",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
