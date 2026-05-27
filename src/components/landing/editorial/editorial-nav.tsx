"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Locale, TranslationKey } from "@/lib/i18n";
import { useLandingLocale } from "../landing-locale-provider";
import { StatusDot } from "./status-dot";

const navLinks: readonly { key: TranslationKey; href: string; hasStatusDot?: boolean }[] = [
  { key: "landing.navProduct" as TranslationKey, href: "/product" },
  { key: "landing.navCustomers" as TranslationKey, href: "/customers" },
  { key: "landing.navPricing", href: "/pricing" },
  { key: "landing.navDocs" as TranslationKey, href: "/docs" },
  { key: "landing.navStatus" as TranslationKey, href: "/status", hasStatusDot: true },
];

const locales: readonly { code: Locale; label: string }[] = [
  { code: "fr", label: "FR" },
  { code: "ar", label: "AR" },
  { code: "en", label: "EN" },
];

/**
 * Editorial nav — 64px desktop / 56px mobile.
 * --bone background. Bottom 1px --rule.
 * Logo left. 5-6 links at --text-small. Lang switcher (mono, no flags).
 * Active locale underlined with --oltigo-green.
 */
export function EditorialNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { t, locale, setLocale } = useLandingLocale();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="sticky top-0 z-50 w-full transition-shadow"
      style={{
        height: "64px",
        backgroundColor: "var(--bone)",
        borderBottom: "1px solid var(--rule)",
        boxShadow: scrolled ? "var(--shadow-sticky)" : "none",
        transitionDuration: "var(--duration)",
        transitionTimingFunction: "var(--easing)",
      }}
    >
      {/* 1px hairline at top of viewport */}
      <div
        className="absolute top-0 inset-x-0"
        style={{ height: "1px", backgroundColor: "var(--rule)" }}
      />

      <div
        className="mx-auto flex h-full items-center justify-between"
        style={{
          maxWidth: "var(--container-max)",
          paddingInline: "var(--gutter-desktop)",
        }}
      >
        {/* Wordmark */}
        <Link
          href="/"
          style={{
            fontSize: "var(--text-h3)",
            fontWeight: 500,
            lineHeight: "var(--lh-h3)",
            letterSpacing: "var(--ls-h3)",
            color: "var(--ink)",
            textDecoration: "none",
          }}
        >
          {"oltigo"}
        </Link>

        {/* Desktop nav links */}
        <nav aria-label="Main navigation" className="hidden items-center gap-[var(--space-6)] md:flex">
          {navLinks.map(({ key, href, hasStatusDot }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex items-center gap-[var(--space-1)] transition-colors"
              style={{
                fontSize: "var(--text-small)",
                fontWeight: 500,
                color: "var(--ink-70)",
                textDecoration: "none",
                transitionDuration: "var(--duration)",
              }}
            >
              {t(key)}
              {hasStatusDot && <StatusDot status="operational" />}
            </Link>
          ))}
        </nav>

        {/* Right cluster: locale + login + CTA */}
        <div className="hidden items-center gap-[var(--space-4)] md:flex">
          {/* Language switcher — mono labels, no flags */}
          <div
            className="flex items-center gap-[var(--space-3)]"
            style={{
              fontFamily: "var(--font-mono-landing)",
              fontSize: "var(--text-mono)",
              lineHeight: "var(--lh-mono)",
              letterSpacing: "var(--ls-mono)",
            }}
          >
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
                  transitionDuration: "var(--duration)",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Login */}
          <Link
            href="/login"
            style={{
              fontSize: "var(--text-small)",
              fontWeight: 500,
              color: "var(--ink-70)",
              textDecoration: "none",
            }}
          >
            {t("nav.login")}
          </Link>

          {/* Primary CTA (compact 32px height for nav) */}
          <Link
            href="/register-clinic"
            className="inline-flex items-center transition-colors"
            style={{
              fontSize: "var(--text-small)",
              fontWeight: 500,
              backgroundColor: "var(--oltigo-green)",
              color: "var(--bone)",
              height: "32px",
              paddingInline: "var(--space-4)",
              borderRadius: "var(--radius-landing)",
              textDecoration: "none",
              transitionDuration: "var(--duration)",
              transitionTimingFunction: "var(--easing)",
            }}
          >
            {t("landing.ctaOpenAccount" as TranslationKey)}
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? t("landing.menuClose") : t("landing.menuOpen")}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          style={{ color: "var(--ink)", background: "none", border: "none" }}
        >
          {mobileOpen ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
        </button>
      </div>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <nav
          id="mobile-nav"
          aria-label="Mobile navigation"
          className="md:hidden"
          style={{
            backgroundColor: "var(--bone)",
            borderBottom: "1px solid var(--rule)",
            paddingBlock: "var(--space-5)",
            paddingInline: "var(--gutter-mobile)",
          }}
        >
          <ul className="m-0 list-none p-0">
            {navLinks.map(({ key, href, hasStatusDot }) => (
              <li key={href} className="mb-[var(--space-3)]">
                <Link
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center gap-[var(--space-1)]"
                  style={{
                    fontSize: "var(--text-body)",
                    fontWeight: 500,
                    color: "var(--ink-70)",
                    textDecoration: "none",
                  }}
                >
                  {t(key)}
                  {hasStatusDot && <StatusDot status="operational" />}
                </Link>
              </li>
            ))}
          </ul>

          <div
            className="mt-[var(--space-5)] flex flex-col gap-[var(--space-3)]"
            style={{ borderTop: "1px solid var(--rule)", paddingTop: "var(--space-5)" }}
          >
            {/* Mobile locale switcher */}
            <div
              className="flex items-center gap-[var(--space-3)]"
              style={{
                fontFamily: "var(--font-mono-landing)",
                fontSize: "var(--text-mono)",
                letterSpacing: "var(--ls-mono)",
              }}
            >
              {locales.map(({ code, label }) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLocale(code)}
                  style={{
                    color: locale === code ? "var(--oltigo-green)" : "var(--ink-60)",
                    textDecoration: locale === code ? "underline" : "none",
                    textUnderlineOffset: "4px",
                    textDecorationColor: "var(--oltigo-green)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              style={{
                fontSize: "var(--text-body)",
                fontWeight: 500,
                color: "var(--ink-70)",
                textDecoration: "none",
              }}
            >
              {t("nav.login")}
            </Link>

            <Link
              href="/register-clinic"
              onClick={() => setMobileOpen(false)}
              className="inline-flex items-center justify-center"
              style={{
                fontSize: "var(--text-small)",
                fontWeight: 500,
                backgroundColor: "var(--oltigo-green)",
                color: "var(--bone)",
                height: "44px",
                borderRadius: "var(--radius-landing)",
                textDecoration: "none",
              }}
            >
              {t("landing.ctaOpenAccount" as TranslationKey)}
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
