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
    <footer
      style={{
        backgroundColor: "var(--bone)",
        borderTop: "1px solid var(--rule)",
      }}
    >
      <div
        className="mx-auto px-[var(--gutter-mobile)] py-[var(--space-8)] md:px-[var(--gutter-tablet)] lg:px-[var(--gutter-desktop)]"
        style={{ maxWidth: "var(--container-max)" }}
      >
        {/* 4-column grid */}
        <div className="grid grid-cols-1 gap-[var(--space-7)] sm:grid-cols-2 lg:grid-cols-4">
          {/* Col 1: Wordmark + address */}
          <div>
            <Link
              href="/"
              style={{
                fontSize: "17px",
                fontWeight: 500,
                color: "var(--ink)",
                textDecoration: "none",
              }}
            >
              {"Oltigo"}
            </Link>
            <address
              className="mt-[var(--space-4)] not-italic"
              style={{
                fontSize: "var(--text-small)",
                lineHeight: "var(--lh-small)",
                color: "var(--ink-60)",
              }}
            >
              {"Casablanca, Morocco"}
            </address>
            <p
              className="mt-[var(--space-2)]"
              style={{
                fontFamily: "var(--font-mono-landing)",
                fontSize: "var(--text-mono)",
                lineHeight: "var(--lh-mono)",
                color: "var(--ink-60)",
              }}
            >
              {t("landing.footerRegistration" as TranslationKey)}
            </p>
          </div>

          {/* Col 2: Product */}
          <div>
            <h3
              style={{
                fontFamily: "var(--font-mono-landing)",
                fontSize: "var(--text-mono)",
                lineHeight: "var(--lh-mono)",
                color: "var(--ink-60)",
                textTransform: "uppercase",
                marginBottom: "var(--space-4)",
              }}
            >
              {t("landing.footerProductHeading" as TranslationKey)}
            </h3>
            <nav aria-label="Product links">
              <ul className="list-none p-0 m-0">
                {productLinks.map(({ key, href }) => (
                  <li key={href} className="mb-[var(--space-2)]">
                    <Link
                      href={href}
                      className="transition-colors"
                      style={{
                        fontSize: "var(--text-small)",
                        color: "var(--ink-80)",
                        textDecoration: "none",
                        transitionDuration: "var(--duration)",
                      }}
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
            <h3
              style={{
                fontFamily: "var(--font-mono-landing)",
                fontSize: "var(--text-mono)",
                lineHeight: "var(--lh-mono)",
                color: "var(--ink-60)",
                textTransform: "uppercase",
                marginBottom: "var(--space-4)",
              }}
            >
              {t("landing.footerCompanyHeading" as TranslationKey)}
            </h3>
            <nav aria-label="Company links">
              <ul className="list-none p-0 m-0">
                {companyLinks.map(({ key, href }) => (
                  <li key={href} className="mb-[var(--space-2)]">
                    <Link
                      href={href}
                      className="transition-colors"
                      style={{
                        fontSize: "var(--text-small)",
                        color: "var(--ink-80)",
                        textDecoration: "none",
                        transitionDuration: "var(--duration)",
                      }}
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
            <h3
              style={{
                fontFamily: "var(--font-mono-landing)",
                fontSize: "var(--text-mono)",
                lineHeight: "var(--lh-mono)",
                color: "var(--ink-60)",
                textTransform: "uppercase",
                marginBottom: "var(--space-4)",
              }}
            >
              {t("landing.footerLegalHeading" as TranslationKey)}
            </h3>
            <nav aria-label="Legal links">
              <ul className="list-none p-0 m-0">
                {legalLinks.map(({ key, href }) => (
                  <li key={href} className="mb-[var(--space-2)]">
                    <Link
                      href={href}
                      className="transition-colors"
                      style={{
                        fontSize: "var(--text-small)",
                        color: "var(--ink-80)",
                        textDecoration: "none",
                        transitionDuration: "var(--duration)",
                      }}
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
        <div
          className="mt-[var(--space-8)] flex flex-col items-center justify-between gap-[var(--space-3)] sm:flex-row"
          style={{
            borderTop: "1px solid var(--rule)",
            paddingTop: "var(--space-5)",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-small)",
              color: "var(--ink-60)",
            }}
          >
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
                className="transition-colors"
                style={{
                  fontSize: "var(--text-small)",
                  fontWeight: locale === code ? 500 : 400,
                  color: locale === code ? "var(--ink)" : "var(--ink-60)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textDecoration: "none",
                  padding: 0,
                  transitionDuration: "var(--duration)",
                }}
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
