"use client";

import { useLandingLocale } from "../landing-locale-provider";
import { HairlineRule } from "./hairline-rule";

/**
 * §3.1.4 Product Anatomy — 3 rows × 2 columns.
 * Left = label + description, right = screenshot placeholder.
 * Separated by --rule. No device frames, no rotation, no shadows.
 */
export function ProductSection() {
  const { t } = useLandingLocale();

  const products = [
    {
      label: t("landing.editorial.product-section.appointmentsLabel"),
      description: t("landing.editorial.product-section.appointmentsDesc"),
    },
    {
      label: t("landing.editorial.product-section.patientRecordLabel"),
      description: t("landing.editorial.product-section.patientRecordDesc"),
    },
    {
      label: t("landing.editorial.product-section.whatsappLabel"),
      description: t("landing.editorial.product-section.whatsappDesc"),
    },
  ];

  return (
    <section id="product" className="bg-[var(--bone)] py-[var(--space-9)]">
      <div className="mx-auto w-full max-w-[var(--container-max)] px-[var(--gutter-desktop)]">
        {products.map((product, i) => (
          <div key={i}>
            {i > 0 && <HairlineRule />}
            <div className="grid gap-8 md:grid-cols-2 md:items-center py-[var(--space-7)]">
              <div>
                <h3 className="font-[var(--font-sans-landing)] text-[length:var(--text-h3)] leading-[var(--lh-h3)] tracking-[var(--ls-h3)] font-medium text-[var(--ink)]">
                  {product.label}
                </h3>
                <p className="mt-[var(--space-3)] font-[var(--font-sans-landing)] text-[length:var(--text-body)] leading-[var(--lh-body)] text-[var(--ink-70)]">
                  {product.description}
                </p>
              </div>

              {/* Screenshot placeholder — replace with real product PNGs */}
              <div className="aspect-[16/10] rounded-[var(--radius-landing)] border border-[var(--rule)] bg-[var(--bone)] flex items-center justify-center">
                <span className="font-[var(--font-mono-landing)] text-[length:var(--text-mono)] text-[var(--ink-60)] uppercase tracking-[var(--ls-mono)]">
                  {t("landing.editorial.product-section.capturePrefix")} {product.label}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
