"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import type { TranslationKey } from "@/lib/i18n";
import { useLandingLocale } from "./landing-locale-provider";

const navLinks: readonly { key: TranslationKey; href: string }[] = [
  { key: "landing.navProduct" as TranslationKey, href: "/product" },
  { key: "landing.navCustomers" as TranslationKey, href: "/customers" },
  { key: "landing.navPricing", href: "/pricing" },
  { key: "landing.navDocs" as TranslationKey, href: "/docs" },
  { key: "landing.navStatus" as TranslationKey, href: "/status" },
];

/**
 * Sticky top bar — 64px, Bone background, 1px bottom hairline.
 * Wordmark only (no logo glyph at launch). Status link has a 6px signal dot.
 * No dark-mode toggle (not shipped at launch per spec).
 */
export function LandingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { t } = useLandingLocale();

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
        backgroundColor: scrolled ? "rgba(246, 244, 238, 0.95)" : "var(--bone)",
        borderBottom: "1px solid var(--rule)",
        boxShadow: scrolled ? "var(--shadow-sticky)" : "none",
        transitionDuration: "var(--duration)",
        transitionTimingFunction: "var(--easing)",
      }}
    >
      <div
        className="mx-auto flex h-full items-center justify-between px-[var(--gutter-mobile)] md:px-[var(--gutter-tablet)] lg:px-[var(--gutter-desktop)]"
        style={{ maxWidth: "var(--container-max)" }}
      >
        {/* Wordmark */}
        {/* eslint-disable-next-line i18next/no-literal-string -- brand wordmark is not translatable */}
        <Link
          href="/"
          style={{
            fontSize: "17px",
            fontWeight: 500,
            color: "var(--ink)",
            letterSpacing: "-0.01em",
            textDecoration: "none",
          }}
        >
          Oltigo
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Main navigation" className="hidden items-center gap-[var(--space-5)] md:flex">
          {navLinks.map(({ key, href }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex items-center gap-[var(--space-1)] transition-colors"
              style={{
                fontSize: "var(--text-small)",
                fontWeight: 400,
                color: "var(--ink-80)",
                transitionDuration: "var(--duration)",
              }}
            >
              {t(key)}
              {key === ("landing.navStatus" as TranslationKey) && (
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: "var(--signal-green)" }}
                  aria-label="Status: operational"
                />
              )}
            </Link>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-[var(--space-3)] md:flex">
          <Link
            href="/login"
            className="transition-colors"
            style={{
              fontSize: "var(--text-small)",
              fontWeight: 400,
              color: "var(--ink-80)",
              transitionDuration: "var(--duration)",
            }}
          >
            {t("nav.login")}
          </Link>
          <Link
            href="/register-clinic"
            className="inline-flex items-center rounded-[var(--radius)] px-[var(--space-5)] transition-colors"
            style={{
              fontSize: "var(--text-small)",
              fontWeight: 500,
              backgroundColor: "var(--oltigo-green)",
              color: "var(--bone)",
              height: "28px",
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
          style={{ color: "var(--ink)" }}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
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
          }}
        >
          {navLinks.map(({ key, href }) => (
            <Link
              key={href}
              href={href}
              className="block px-[var(--gutter-mobile)] py-[var(--space-3)] transition-colors"
              onClick={() => setMobileOpen(false)}
              style={{
                fontSize: "var(--text-small)",
                fontWeight: 400,
                color: "var(--ink-80)",
                borderBottom: "1px solid var(--rule)",
              }}
            >
              {t(key)}
            </Link>
          ))}
          <div className="flex gap-[var(--space-3)] px-[var(--gutter-mobile)] py-[var(--space-4)]">
            <Link
              href="/login"
              className="text-[var(--text-small)]"
              style={{ color: "var(--ink-80)" }}
              onClick={() => setMobileOpen(false)}
            >
              {t("nav.login")}
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
