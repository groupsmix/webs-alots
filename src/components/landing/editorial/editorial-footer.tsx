"use client";

import Link from "next/link";
import type { TranslationKey } from "@/lib/i18n";
import { useLandingLocale } from "../landing-locale-provider";
import { HairlineRule } from "./hairline-rule";

/**
 * §5.6 Footer — top 1px rule. 5-column grid.
 * Column heading --text-small/500/--ink. Links --text-body/400/--ink-70.
 * Bottom row --text-mono/--ink-60. No social icons in body.
 */
export function EditorialFooter() {
  const { t } = useLandingLocale();

  const columns: Array<{
    headingKey: TranslationKey;
    links: Array<{ labelKey: TranslationKey; href: string }>;
  }> = [
    {
      headingKey: "landing.footerProductHeading",
      links: [
        { labelKey: "landing.editorial.editorial-footer.appointments", href: "#product" },
        { labelKey: "landing.editorial.editorial-footer.patientRecord", href: "#product" },
        { labelKey: "landing.editorial.editorial-footer.whatsapp", href: "#product" },
        { labelKey: "landing.editorial.editorial-footer.billing", href: "#product" },
      ],
    },
    {
      headingKey: "landing.editorial.editorial-footer.resourcesHeading",
      links: [
        { labelKey: "landing.editorial.editorial-footer.documentation", href: "/docs" },
        { labelKey: "landing.footerStatus", href: "/status" },
        { labelKey: "landing.editorial.editorial-footer.changelog", href: "/changelog" },
      ],
    },
    {
      headingKey: "landing.footerCompanyHeading",
      links: [
        { labelKey: "landing.footerAbout", href: "/about" },
        { labelKey: "landing.footerContact", href: "/contact" },
        { labelKey: "landing.footerCareers", href: "/careers" },
      ],
    },
    {
      headingKey: "landing.editorial.editorial-footer.legalHeading",
      links: [
        { labelKey: "landing.editorial.editorial-footer.conditions", href: "/terms" },
        { labelKey: "landing.editorial.editorial-footer.privacy", href: "/privacy" },
        { labelKey: "landing.footerDPA", href: "/dpa" },
        { labelKey: "landing.editorial.editorial-footer.law0908", href: "/compliance" },
      ],
    },
  ];

  return (
    <footer className="bg-[var(--bone)]">
      <div className="mx-auto w-full max-w-[var(--container-max)] px-[var(--gutter-desktop)]">
        <HairlineRule />

        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5 py-[var(--space-8)]">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            {/* eslint-disable i18next/no-literal-string */}
            <Link
              href="/"
              className="font-[var(--font-sans-landing)] text-[length:var(--text-small)] font-bold tracking-[-0.02em] text-[var(--ink)] no-underline"
            >
              oltig<span style={{ color: "var(--oltigo-green)" }}>o</span>
            </Link>
            {/* eslint-enable i18next/no-literal-string */}
            <p className="mt-[var(--space-3)] font-[var(--font-sans-landing)] text-[length:var(--text-body)] leading-[var(--lh-body)] text-[var(--ink-70)] max-w-[240px]">
              {t("landing.editorial.editorial-footer.laPlateformeCompletePour")}
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.headingKey}>
              <span className="font-[var(--font-sans-landing)] text-[length:var(--text-small)] font-medium text-[var(--ink)]">
                {t(col.headingKey)}
              </span>
              <ul className="mt-3 flex flex-col gap-2 list-none p-0">
                {col.links.map((link) => (
                  <li key={link.labelKey}>
                    <Link
                      href={link.href}
                      className="font-[var(--font-sans-landing)] text-[length:var(--text-body)] leading-[var(--lh-body)] text-[var(--ink-70)] no-underline"
                    >
                      {t(link.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <HairlineRule />

        {/* Bottom row */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-[var(--space-5)] font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] tracking-[var(--ls-mono)] text-[var(--ink-60)]">
          <span>
            {t("landing.editorial.editorial-footer.copyright", {
              year: String(new Date().getFullYear()),
            })}
          </span>
          <span>{t("landing.editorial.editorial-footer.social")}</span>
        </div>
      </div>
    </footer>
  );
}
