"use client";

import type { TranslationKey } from "@/lib/i18n";
import { useLandingLocale } from "../landing-locale-provider";

/**
 * §3.1.5 How it works — 4 numbered steps.
 * 4 columns desktop, 1 column mobile.
 * Each = mono "ÉTAPE 01" + h3 + 2 body lines. No icons, no illustration.
 */
export function HowItWorksSection() {
  const { t } = useLandingLocale();

  const steps: Array<{ step: string; titleKey: TranslationKey; descKey: TranslationKey }> = [
    {
      step: "01",
      titleKey: "landing.editorial.how-it-works-section.step1Title",
      descKey: "landing.editorial.how-it-works-section.step1Desc",
    },
    {
      step: "02",
      titleKey: "landing.editorial.how-it-works-section.step2Title",
      descKey: "landing.editorial.how-it-works-section.step2Desc",
    },
    {
      step: "03",
      titleKey: "landing.editorial.how-it-works-section.step3Title",
      descKey: "landing.editorial.how-it-works-section.step3Desc",
    },
    {
      step: "04",
      titleKey: "landing.editorial.how-it-works-section.step4Title",
      descKey: "landing.editorial.how-it-works-section.step4Desc",
    },
  ];

  return (
    <section className="bg-[var(--bone)] py-[var(--space-9)]">
      <div className="mx-auto w-full max-w-[var(--container-max)] px-[var(--gutter-desktop)]">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.step}>
              <span className="font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] tracking-[var(--ls-mono)] uppercase font-medium text-[var(--ink-60)]">
                {t("landing.howStep")} {s.step}
              </span>
              <h3 className="mt-[var(--space-3)] font-[var(--font-sans-landing)] text-[length:var(--text-h3)] leading-[var(--lh-h3)] tracking-[var(--ls-h3)] font-medium text-[var(--ink)]">
                {t(s.titleKey)}
              </h3>
              <p className="mt-[var(--space-2)] font-[var(--font-sans-landing)] text-[length:var(--text-body)] leading-[var(--lh-body)] text-[var(--ink-70)]">
                {t(s.descKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
