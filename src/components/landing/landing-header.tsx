"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X, Moon, Sun } from "lucide-react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useTheme } from "@/components/theme-provider";
import { useLandingLocale } from "./landing-locale-provider";
import type { TranslationKey } from "@/lib/i18n";

const navLinks: readonly { key: TranslationKey; href: string; sectionId?: string }[] = [
  { key: "landing.navFeatures", href: "/#fonctionnalites", sectionId: "fonctionnalites" },
  { key: "landing.navHow", href: "/#comment-ca-marche", sectionId: "comment-ca-marche" },
  { key: "landing.navDemo", href: "/#demo", sectionId: "demo" },
  { key: "landing.navPricing", href: "/pricing" },
];

export function LandingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const { t } = useLandingLocale();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const sectionIds = navLinks
      .map((link) => link.sectionId)
      .filter((id): id is string => !!id);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 },
    );

    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

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
          {navLinks.map(({ key, href, sectionId }) => (
            <a
              key={href}
              href={href}
              className={`text-sm transition-colors hover:text-gray-900 dark:hover:text-gray-50 ${
                sectionId && activeSection === sectionId
                  ? "text-blue-600 dark:text-blue-400 font-medium"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              {t(key)}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="hidden h-8 w-8 items-center justify-center rounded-lg text-gray-600 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 sm:inline-flex"
            aria-label={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <LocaleSwitcher className="hidden sm:block" />
          <Link
            href="/login"
            className="hidden text-sm font-medium text-gray-600 dark:text-gray-400 transition-colors hover:text-gray-900 dark:hover:text-gray-50 sm:inline-flex"
          >
            {t("nav.login")}
          </Link>
          <Link
            href="/register-clinic"
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
          <div className="mt-2 flex items-center gap-3 px-3 sm:hidden">
            <LocaleSwitcher />
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
