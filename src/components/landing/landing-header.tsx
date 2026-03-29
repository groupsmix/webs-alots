"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useLandingLocale } from "./landing-locale-provider";
import type { TranslationKey } from "@/lib/i18n";

const navLinks: readonly { key: TranslationKey; href: string }[] = [
  { key: "landing.navFeatures", href: "/#fonctionnalites" },
  { key: "landing.navHow", href: "/#comment-ca-marche" },
  { key: "landing.navDemo", href: "/#demo" },
  { key: "landing.navPricing", href: "/pricing" },
];

export function LandingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useLandingLocale();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-50"
        >
          Oltigo
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Navigation principale" className="hidden items-center gap-8 md:flex">
          {navLinks.map(({ key, href }) => (
            <a
              key={href}
              href={href}
              className="text-sm text-gray-600 dark:text-gray-400 transition-colors hover:text-gray-900 dark:hover:text-gray-50"
            >
              {t(key)}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <LocaleSwitcher className="hidden sm:block" />
          <Link
            href="/login"
            className="hidden text-sm font-medium text-gray-600 dark:text-gray-400 transition-colors hover:text-gray-900 dark:hover:text-gray-50 sm:inline-flex"
          >
            {t("nav.login")}
          </Link>
          <Link
            href="/register"
            className="hidden h-9 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 sm:inline-flex"
          >
            {t("landing.ctaPrimary")}
          </Link>
          <Link
            href="/contact"
            className="inline-flex h-9 items-center rounded-lg bg-gray-900 px-4 text-sm font-medium text-white transition-colors hover:bg-gray-800 sm:hidden"
          >
            {t("nav.contact")}
          </Link>

          {/* Mobile menu toggle */}
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? t("landing.menuClose") : t("landing.menuOpen")}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav id="mobile-nav" aria-label="Navigation mobile" className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 pb-4 pt-2 md:hidden">
          {navLinks.map(({ key, href }) => (
            <a
              key={href}
              href={href}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-50"
              onClick={() => setMobileOpen(false)}
            >
              {t(key)}
            </a>
          ))}
          <Link
            href="/login"
            className="block rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-50 sm:hidden"
            onClick={() => setMobileOpen(false)}
          >
            {t("nav.login")}
          </Link>
          <div className="mt-2 px-3 sm:hidden">
            <LocaleSwitcher />
          </div>
        </nav>
      )}
    </header>
  );
}
