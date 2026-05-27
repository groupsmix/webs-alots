"use client";

import type { TranslationKey } from "@/lib/i18n";
import { useLandingLocale } from "../../landing-locale-provider";

/**
 * Manifesto block \u2014 single column, max-width 720px, left-aligned.
 * No imagery. H2 + body-lg.
 */
export function ManifestoSection() {
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
        <div style={{ maxWidth: "720px" }}>
          <h2
            style={{
              fontSize: "var(--text-h2)",
              lineHeight: "var(--lh-h2)",
              letterSpacing: "var(--ls-h2)",
              fontWeight: 500,
              color: "var(--ink)",
            }}
          >
            {t("landing.featuresTitle" as TranslationKey)}
          </h2>
          <p
            className="mt-[var(--space-5)]"
            style={{
              fontSize: "var(--text-body-lg)",
              lineHeight: "var(--lh-body-lg)",
              color: "var(--ink-70)",
            }}
          >
            {t("landing.featuresSubtitle" as TranslationKey)}
          </p>
        </div>
      </div>
    </section>
  );
}
