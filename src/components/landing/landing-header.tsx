"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import type { TranslationKey } from "@/lib/i18n";
import { useLandingLocale } from "./landing-locale-provider";

const navLinks: readonly { key: TranslationKey; href: string; prefetch?: boolean }[] = [
  { key: "landing.navProduct" as TranslationKey, href: "/#product" },
  { key: "landing.navCustomers" as TranslationKey, href: "/#clients" },
  { key: "landing.navPricing", href: "/#pricing" },
  { key: "landing.navStatus" as TranslationKey, href: "/status", prefetch: false },
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
      className={`sticky top-0 z-50 w-full transition-shadow h-16 border-b border-b-[var(--rule)] duration-[var(--duration)] ease-[var(--easing)] ${scrolled ? "bg-[rgba(246,244,238,0.95)] shadow-[var(--shadow-sticky)]" : "bg-[var(--bone)] shadow-none"}`}
    >
      <div className="mx-auto flex h-full items-center justify-between px-[var(--gutter-mobile)] md:px-[var(--gutter-tablet)] lg:px-[var(--gutter-desktop)] max-w-[var(--container-max)]">
        {/* Wordmark */}
        {/* eslint-disable i18next/no-literal-string -- brand name, never translated */}
        <Link
          href="/"
          className="text-[17px] font-medium text-[var(--ink)] tracking-[-0.01em] no-underline"
        >
          Oltig<span style={{ color: "var(--oltigo-green)" }}>o</span>
        </Link>
        {/* eslint-enable i18next/no-literal-string */}

        {/* Desktop nav */}
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-[var(--space-5)] md:flex"
        >
          {navLinks.map(({ key, href, prefetch }) => (
            <Link
              key={href}
              href={href}
              prefetch={prefetch ?? false}
              className="inline-flex items-center gap-[var(--space-1)] transition-colors text-[length:var(--text-small)] font-normal text-[var(--ink-80)] duration-[var(--duration)]"
            >
              {t(key)}
              {key === ("landing.navStatus" as TranslationKey) && (
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--signal-green)]"
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
            className="transition-colors text-[length:var(--text-small)] font-normal text-[var(--ink-80)] duration-[var(--duration)]"
          >
            {t("nav.login")}
          </Link>
          <Link
            href="/register-clinic"
            className="inline-flex items-center rounded-[var(--radius-landing)] px-[var(--space-5)] transition-colors text-[length:var(--text-small)] font-medium bg-[var(--oltigo-green)] text-[var(--bone)] h-7 duration-[var(--duration)] ease-[var(--easing)]"
          >
            {t("landing.ctaOpenAccount" as TranslationKey)}
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center md:hidden text-[var(--ink)]"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? t("landing.menuClose") : t("landing.menuOpen")}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <nav
          id="mobile-nav"
          aria-label="Mobile navigation"
          className="md:hidden bg-[var(--bone)] border-b border-b-[var(--rule)]"
        >
          {navLinks.map(({ key, href, prefetch }) => (
            <Link
              key={href}
              href={href}
              prefetch={prefetch ?? false}
              className="block px-[var(--gutter-mobile)] py-[var(--space-3)] transition-colors text-[length:var(--text-small)] font-normal text-[var(--ink-80)] border-b border-b-[var(--rule)]"
              onClick={() => setMobileOpen(false)}
            >
              {t(key)}
            </Link>
          ))}
          <div className="flex gap-[var(--space-3)] px-[var(--gutter-mobile)] py-[var(--space-4)]">
            <Link
              href="/login"
              className="text-[var(--text-small)] text-[var(--ink-80)]"
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
