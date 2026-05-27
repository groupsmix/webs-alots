"use client";

import Link from "next/link";
import type { Locale, TranslationKey } from "@/lib/i18n";
import { useLandingLocale } from "../landing-locale-provider";
import { HairlineRule } from "./hairline-rule";
import { StatusDot } from "./status-dot";

const productLinks: readonly { key: TranslationKey; href: string }[] = [
  { key: "landing.footerFeatures" as TranslationKey, href: "/product" },
  { key: "landing.footerPricing", href: "/pricing" },
  { key: "landing.footerStatus" as TranslationKey, href: "/status" },
  { key: "landing.footerChangelog" as TranslationKey, href: "/changelog" },
];

const clientLinks: readonly { key: TranslationKey; href: string }[] = [
  { key: "landing.footerCustomers" as TranslationKey, href: "/customers" },
  { key: "landing.footerCareers" as TranslationKey, href: "/careers" },
];

const companyLinks: readonly { key: TranslationKey; href: string }[] = [
  { key: "landing.footerAbout", href: "/about" },
  { key: "landing.footerContact", href: "/contact" },
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

function FooterColumn({
  heading,
  links,
  t,
}: {
  heading: string;
  links: readonly { key: TranslationKey; href: string }[];
  t: (k: TranslationKey) => string;
}) {
  return (
    <div>
      <h3
        style={{
          fontFamily: "var(--font-mono-landing)",
          fontSize: "var(--text-mono)",
          lineHeight: "var(--lh-mono)",
          letterSpacing: "var(--ls-mono)",
          textTransform: "uppercase",
          color: "var(--ink)",
          fontWeight: 500,
          marginBottom: "var(--space-4)",
        }}
      >
        {heading}
      </h3>
      <nav>
        <ul className="m-0 list-none p-0">
          {links.map(({ key, href }) => (
            <li key={href} className="mb-[var(--space-2)]">
              <Link
                href={href}
                className="transition-colors"
                style={{
                  fontSize: "var(--text-body)",
                  lineHeight: "var(--lh-body)",
                  color: "var(--ink-70)",
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
  );
}

/**
 * Editorial footer \u2014 5 columns, mono labels.
 * Bottom row: copyright left, locale switcher right.
 * Language switcher: FR \u00B7 AR \u00B7 EN mono labels, no flags.
 */
export function EditorialFooter() {
  const { t, locale, setLocale } = useLandingLocale();

  return (
    <footer style={{ backgroundColor: "var(--bone)" }}>
      <HairlineRule />
      <div
        className="mx-auto py-[var(--space-8)]"
        style={{
          maxWidth: "var(--container-max)",
          paddingInline: "var(--gutter-desktop)",
        }}
      >
        {/* 5-column grid */}
        <div className="grid grid-cols-2 gap-[var(--space-7)] sm:grid-cols-3 lg:grid-cols-5">
          {/* Col 1: Produit */}
          <FooterColumn
            heading={t("landing.footerProductHeading" as TranslationKey)}
            links={productLinks}
            t={t}
          />

          {/* Col 2: Clients */}
          <FooterColumn
            heading={t("landing.footerCustomers" as TranslationKey)}
            links={clientLinks}
            t={t}
          />

          {/* Col 3: Entreprise */}
          <FooterColumn
            heading={t("landing.footerCompanyHeading" as TranslationKey)}
            links={companyLinks}
            t={t}
          />

          {/* Col 4: Juridique et conformit\u00E9 */}
          <FooterColumn
            heading={t("landing.footerLegalHeading" as TranslationKey)}
            links={legalLinks}
            t={t}
          />

          {/* Col 5: Soci\u00E9t\u00E9 */}
          <div>
            <h3
              style={{
                fontFamily: "var(--font-mono-landing)",
                fontSize: "var(--text-mono)",
                lineHeight: "var(--lh-mono)",
                letterSpacing: "var(--ls-mono)",
                textTransform: "uppercase",
                color: "var(--ink)",
                fontWeight: 500,
                marginBottom: "var(--space-4)",
              }}
            >
              {/* eslint-disable i18next/no-literal-string */}
              {"Soci\u00E9t\u00E9"}
            </h3>
            <address
              className="not-italic"
              style={{
                fontFamily: "var(--font-mono-landing)",
                fontSize: "var(--text-mono)",
                lineHeight: 1.6,
                letterSpacing: "var(--ls-mono)",
                color: "var(--ink-60)",
              }}
            >
              <p>{"Oltigo Health / MediaHoly"}</p>
              <p>{t("landing.footerRegistration" as TranslationKey)}</p>
              <p>{"Casablanca, Maroc"}</p>
              <p>{"dpo@oltigo.com"}</p>
            </address>
            {/* eslint-enable i18next/no-literal-string */}
          </div>
        </div>

        <HairlineRule className="mt-[var(--space-8)]" />

        {/* Bottom bar */}
        <div
          className="mt-[var(--space-5)] flex flex-wrap items-center justify-between gap-[var(--space-4)]"
          style={{
            fontFamily: "var(--font-mono-landing)",
            fontSize: "var(--text-mono)",
            lineHeight: "var(--lh-mono)",
            letterSpacing: "var(--ls-mono)",
            color: "var(--ink-60)",
          }}
        >
          {/* eslint-disable i18next/no-literal-string */}
          <span className="inline-flex items-center gap-[var(--space-2)]">
            {"\u00A9 2026 Oltigo. "}
            {t("landing.footerCopyright")}
            {" \u00B7 "}
            {t("landing.footerRegistration" as TranslationKey)}
            {" \u00B7 v 16.0 \u00B7 Status "}
            <StatusDot variant="operational" />
          </span>
          {/* eslint-enable i18next/no-literal-string */}

          {/* Language switcher */}
          <div className="flex items-center gap-[var(--space-3)]">
            {locales.map(({ code, label }) => (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                className="transition-colors"
                style={{
                  color: locale === code ? "var(--oltigo-green)" : "var(--ink-60)",
                  textDecoration: locale === code ? "underline" : "none",
                  textUnderlineOffset: "4px",
                  textDecorationColor: "var(--oltigo-green)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  letterSpacing: "inherit",
                  transitionDuration: "var(--duration)",
                }}
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
