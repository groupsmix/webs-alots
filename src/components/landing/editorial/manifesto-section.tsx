"use client";

import { useLandingLocale } from "../landing-locale-provider";

/**
 * §3.1.3 — "What it is, in 5 lines."
 * Single column, max-width 720px, left-aligned. No imagery.
 */
export function ManifestoSection() {
  const { t } = useLandingLocale();

  return (
    <section className="bg-[var(--bone)] py-[var(--space-9)]">
      <div className="mx-auto w-full max-w-[var(--container-max)] px-[var(--gutter-desktop)]">
        <div className="max-w-full md:max-w-[720px]">
          <h2 className="font-[var(--font-sans-landing)] text-[length:var(--text-h1)] leading-[var(--lh-h1)] tracking-[var(--ls-h1)] font-medium text-[var(--ink)]">
            {t("landing.featuresTitle")}
          </h2>

          <p className="mt-[var(--space-5)] font-[var(--font-sans-landing)] text-[length:var(--text-body-lg)] leading-[var(--lh-body-lg)] text-[var(--ink-70)]">
            {t("landing.featuresSubtitle")}
          </p>
        </div>
      </div>
    </section>
  );
}
