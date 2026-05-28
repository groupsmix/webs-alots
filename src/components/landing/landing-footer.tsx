"use client";

import Link from "next/link";
import type { Locale, TranslationKey } from "@/lib/i18n";
import { useLandingLocale } from "./landing-locale-provider";

/**
 * 4-column footer on Bone, 1px top hairline.
 * Col 1: wordmark, address, registration.
 * Col 2: Product links.
 * Col 3: Company links.
 * Col 4: Legal & Compliance links.
 * Bottom bar: copyright left, locale switcher right.
 */

const productLinks: readonly { key: TranslationKey; href: string }[] = [
  { key: "landing.footerFeatures" as TranslationKey, href: "/product" },
  { key: "landing.footerPricing", href: "/pricing" },
  { key: "landing.footerStatus" as TranslationKey, href: "/status" },
  { key: "landing.footerChangelog" as TranslationKey, href: "/changelog" },
];

const companyLinks: readonly { key: TranslationKey; href: string }[] = [
  { key: "landing.footerAbout", href: "/about" },
  { key: "landing.footerCustomers" as TranslationKey, href: "/customers" },
  { key: "landing.footerContact", href: "/contact" },
  { key: "landing.footerCareers" as TranslationKey, href: "/careers" },
];

const legalLinks: readonly { key: TranslationKey; href: string }[] = [
  { key: "landing.footerPrivacy", href: "/privacy" },
  { key: "landing.footerTerms", href: "/terms" },
  { key: "landing.footerLaw0908" as TranslationKey, href: "/compliance/law-09-08" },
  { key: "landing.footerDPA" as TranslationKey, href: "/compliance/dpa" },
  { key: "landing.footerSubprocessors" as TranslationKey, href: "/compliance/subprocessors" },
  { key: "landing.footerSecurity" as TranslationKey, href: "/security" },
];

const locales: readonly { code: Locale; label: string }[] = [
  { code: "fr", label: "FR" },
  { code: "ar", label: "AR" },
  { code: "en", label: "EN" },
];

export function LandingFooter() {
  const { t, locale, setLocale } = useLandingLocale();

  return (
    <footer className="bg-[var(--bone)] border-t border-t-[var(--rule)]">
      <div className="mx-auto px-[var(--gutter-mobile)] py-[var(--space-8)] md:px-[var(--gutter-tablet)] lg:px-[var(--gutter-desktop)] max-w-[var(--container-max)]">
        {/* 4-column grid */}
        <div className="grid grid-cols-1 gap-[var(--space-7)] sm:grid-cols-2 lg:grid-cols-4">
          {/* Col 1: Wordmark + address */}
          <div>
            <Link href="/" className="text-[17px] font-medium text-[var(--ink)] no-underline">
              {"Oltigo"}
            </Link>
            <address className="mt-[var(--space-4)] not-italic text-[length:var(--text-small)] leading-[var(--lh-small)] text-[var(--ink-60)]">
              {"Casablanca, Morocco"}
            </address>
            <p className="mt-[var(--space-2)] font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] text-[var(--ink-60)]">
              {t("landing.footerRegistration" as TranslationKey)}
            </p>
          </div>

          {/* Col 2: Product */}
          <div>
            <h3 className="font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] text-[var(--ink-60)] uppercase mb-[var(--space-4)]">
              {t("landing.footerProductHeading" as TranslationKey)}
            </h3>
            <nav aria-label="Product links">
              <ul className="list-none p-0 m-0">
                {productLinks.map(({ key, href }) => (
                  <li key={href} className="mb-[var(--space-2)]">
                    <Link
                      href={href}
                      className="transition-colors text-[length:var(--text-small)] text-[var(--ink-80)] no-underline duration-[var(--duration)]"
                    >
                      {t(key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Col 3: Company */}
          <div>
            <h3 className="font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] text-[var(--ink-60)] uppercase mb-[var(--space-4)]">
              {t("landing.footerCompanyHeading" as TranslationKey)}
            </h3>
            <nav aria-label="Company links">
              <ul className="list-none p-0 m-0">
                {companyLinks.map(({ key, href }) => (
                  <li key={href} className="mb-[var(--space-2)]">
                    <Link
                      href={href}
                      className="transition-colors text-[length:var(--text-small)] text-[var(--ink-80)] no-underline duration-[var(--duration)]"
                    >
                      {t(key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Col 4: Legal & Compliance */}
          <div>
            <h3 className="font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] text-[var(--ink-60)] uppercase mb-[var(--space-4)]">
              {t("landing.footerLegalHeading" as TranslationKey)}
            </h3>
            <nav aria-label="Legal links">
              <ul className="list-none p-0 m-0">
                {legalLinks.map(({ key, href }) => (
                  <li key={href} className="mb-[var(--space-2)]">
                    <Link
                      href={href}
                      className="transition-colors text-[length:var(--text-small)] text-[var(--ink-80)] no-underline duration-[var(--duration)]"
                    >
                      {t(key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-[var(--space-8)] flex flex-col items-center justify-between gap-[var(--space-3)] sm:flex-row border-t border-t-[var(--rule)] pt-[var(--space-5)]">
          <p className="text-[length:var(--text-small)] text-[var(--ink-60)]">
            {`\u00A9 ${new Date().getFullYear()} Oltigo. `}
            {t("landing.footerCopyright")}
          </p>

          {/* Locale switcher */}
          <div className="flex items-center gap-[var(--space-3)]">
            {locales.map(({ code, label }) => (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                className={`transition-colors text-[length:var(--text-small)] bg-transparent border-none cursor-pointer no-underline p-0 duration-[var(--duration)] ${locale === code ? "font-medium text-[var(--ink)]" : "font-normal text-[var(--ink-60)]"}`}
                aria-current={locale === code ? "true" : undefined}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
