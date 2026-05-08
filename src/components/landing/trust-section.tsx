"use client";

import type { TranslationKey } from "@/lib/i18n";
import { useLandingLocale } from "./landing-locale-provider";

/**
 * Evidence strip — replaces the "trusted by" pattern with verifiable data.
 *
 * Full-width band, Bone-2 background, 96px vertical padding, 1px hairlines top + bottom.
 * 4 columns of stat blocks, left-aligned.
 * Each stat: number in display (72px), descriptor in small (14px, Ink/60), 1px rule above.
 */

const stats: readonly {
  valueKey: TranslationKey;
  labelKey: TranslationKey;
}[] = [
  {
    valueKey: "landing.evidenceUptimeValue" as TranslationKey,
    labelKey: "landing.evidenceUptimeDesc" as TranslationKey,
  },
  {
    valueKey: "landing.evidenceEncryptionValue" as TranslationKey,
    labelKey: "landing.evidenceEncryptionDesc" as TranslationKey,
  },
  {
    valueKey: "landing.evidenceComplianceValue" as TranslationKey,
    labelKey: "landing.evidenceComplianceDesc" as TranslationKey,
  },
  {
    valueKey: "landing.evidenceLatencyValue" as TranslationKey,
    labelKey: "landing.evidenceLatencyDesc" as TranslationKey,
  },
];

export function TrustSection() {
  const { t } = useLandingLocale();

  return (
    <section
      style={{
        backgroundColor: "var(--bone-2)",
        borderTop: "1px solid var(--rule)",
        borderBottom: "1px solid var(--rule)",
      }}
    >
      <div
        className="mx-auto grid grid-cols-1 gap-[var(--space-7)] px-[var(--gutter-mobile)] py-[var(--space-9)] sm:grid-cols-2 lg:grid-cols-4 md:px-[var(--gutter-tablet)] lg:px-[var(--gutter-desktop)]"
        style={{ maxWidth: "var(--container-max)" }}
      >
        {stats.map(({ valueKey, labelKey }) => (
          <dl key={valueKey} className="m-0">
            <div style={{ borderTop: "1px solid var(--rule)", paddingTop: "var(--space-4)" }}>
              <dt
                style={{
                  fontSize: "var(--text-display)",
                  lineHeight: "var(--lh-display)",
                  letterSpacing: "var(--ls-display)",
                  fontWeight: 500,
                  color: "var(--ink)",
                }}
              >
                {t(valueKey)}
              </dt>
              <dd
                className="mt-[var(--space-2)]"
                style={{
                  fontSize: "var(--text-small)",
                  lineHeight: "var(--lh-small)",
                  color: "var(--ink-60)",
                  margin: 0,
                  marginTop: "var(--space-2)",
                }}
              >
                {t(labelKey)}
              </dd>
            </div>
          </dl>
        ))}
      </div>
    </section>
  );
}
