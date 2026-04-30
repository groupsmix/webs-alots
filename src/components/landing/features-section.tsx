"use client";

import type { TranslationKey } from "@/lib/i18n";
import { useLandingLocale } from "./landing-locale-provider";

/**
 * Features section — table layout, not a card grid.
 *
 * Eyebrow: 01 — PRODUCT (mono, 13px, uppercase, Ink/60)
 * h2: Everything your practice needs
 * Right column: a 4-row <table> with 1px row separators.
 * Reads like a spec sheet, not marketing fluff.
 */

const features: readonly { titleKey: TranslationKey; descKey: TranslationKey }[] = [
  {
    titleKey: "landing.featureAppointmentsTitle",
    descKey: "landing.featureAppointmentsDesc",
  },
  {
    titleKey: "landing.featurePatientsTitle",
    descKey: "landing.featurePatientsDesc",
  },
  {
    titleKey: "landing.featureWebsiteTitle",
    descKey: "landing.featureWebsiteDesc",
  },
  {
    titleKey: "landing.featureAutomationTitle",
    descKey: "landing.featureAutomationDesc",
  },
];

export function FeaturesSection() {
  const { t } = useLandingLocale();

  return (
    <section
      id="fonctionnalites"
      className="py-[var(--space-9)] md:py-[var(--space-10)]"
      style={{ backgroundColor: "var(--bone)" }}
    >
      <div
        className="mx-auto px-[var(--gutter-mobile)] md:px-[var(--gutter-tablet)] lg:px-[var(--gutter-desktop)]"
        style={{ maxWidth: "var(--container-max)" }}
      >
        <div className="grid grid-cols-1 gap-[var(--space-8)] lg:grid-cols-12">
          {/* Left column: eyebrow + heading + lead */}
          <div className="lg:col-span-5">
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
              {"01 \u2014 "}
              {t("landing.featuresLabel")}
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
              {t("landing.featuresTitle")}
            </h2>
            <p
              className="mt-[var(--space-4)]"
              style={{
                fontSize: "var(--text-body-lg)",
                lineHeight: "var(--lh-body-lg)",
                letterSpacing: "var(--ls-body-lg)",
                color: "var(--ink-70)",
              }}
            >
              {t("landing.featuresSubtitle")}
            </p>
          </div>

          {/* Right column: feature table */}
          <div className="lg:col-span-7">
            <table
              className="w-full"
              style={{ borderCollapse: "collapse" }}
            >
              <tbody>
                {features.map(({ titleKey, descKey }, idx) => (
                  <tr
                    key={titleKey}
                    style={{
                      borderTop: idx === 0 ? "1px solid var(--rule)" : undefined,
                      borderBottom: "1px solid var(--rule)",
                    }}
                  >
                    <td
                      className="py-[var(--space-4)] pe-[var(--space-5)] align-top"
                      style={{
                        fontSize: "var(--text-h3)",
                        lineHeight: "var(--lh-h3)",
                        letterSpacing: "var(--ls-h3)",
                        fontWeight: 500,
                        color: "var(--ink)",
                      }}
                    >
                      {t(titleKey)}
                    </td>
                    <td
                      className="py-[var(--space-4)] align-top"
                      style={{
                        fontSize: "var(--text-small)",
                        lineHeight: "var(--lh-small)",
                        color: "var(--ink-60)",
                      }}
                    >
                      {t(descKey)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
