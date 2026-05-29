"use client";

import { Menu, Moon, Sun, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useLandingLocale } from "../landing-locale-provider";
import { StatusDot } from "./status-dot";

/**
 * §5.5 Nav — 64px desktop / 56px mobile.
 * --bone background. Bottom 1px --rule. Logo left. Mono labels.
 * Active link = 2px bottom rule in --oltigo-green.
 * Right cluster: FR/AR/EN, status dot, Connexion, primary CTA.
 */
export function EditorialHeader({
  lang,
  theme,
  onToggleLang,
  onToggleTheme,
}: {
  lang: "fr" | "ar" | "en";
  theme: "light" | "dark";
  onToggleLang: () => void;
  onToggleTheme: () => void;
}) {
  const { t } = useLandingLocale();
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { label: t("landing.navProduct"), href: "#product" },
    { label: t("landing.navCustomers"), href: "#clients" },
    { label: t("landing.navPricing"), href: "#pricing" },
  ];

  return (
    <>
      {/* 1px hairline at viewport top */}
      <div className="h-px bg-[var(--rule)]" />

      <header className="sticky top-0 z-50 bg-[var(--bone)] border-b border-b-[var(--rule)]">
        <div className="mx-auto flex w-full items-center justify-between max-w-[var(--container-max)] px-[var(--gutter-desktop)] h-16">
          {/* Logo */}
          {/* eslint-disable i18next/no-literal-string */}
          <Link
            href="/"
            className="font-[var(--font-sans-landing)] text-[length:var(--text-small)] font-bold tracking-[-0.02em] text-[var(--ink)] no-underline"
          >
            oltig<span style={{ color: "var(--oltigo-green)" }}>o</span>
          </Link>
          {/* eslint-enable i18next/no-literal-string */}

          {/* Desktop nav links */}
          <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="font-[var(--font-sans-landing)] text-[length:var(--text-small)] font-medium text-[var(--ink-70)] no-underline transition-colors duration-[var(--duration)] ease-[var(--easing)]"
              >
                {link.label}
              </a>
            ))}

            {/* Status dot link */}
            <a
              href="#status"
              className="inline-flex items-center gap-1.5 font-[var(--font-mono-landing)] text-[length:var(--text-mono)] tracking-[var(--ls-mono)] uppercase font-medium text-[var(--ink-60)] no-underline"
            >
              {t("landing.navStatus")} <StatusDot />
            </a>
          </nav>

          {/* Right cluster */}
          <div className="flex items-center gap-3">
            {/* Language switcher (mono) */}
            <button
              onClick={onToggleLang}
              className="font-[var(--font-mono-landing)] text-[length:var(--text-mono)] tracking-[var(--ls-mono)] uppercase font-medium text-[var(--ink-60)] bg-transparent border-none cursor-pointer py-1 px-0"
              aria-label="Change language"
            >
              {lang === "fr" ? "FR" : lang === "ar" ? "AR" : "EN"}
            </button>

            {/* Theme toggle */}
            <button
              onClick={onToggleTheme}
              className="flex items-center justify-center size-8 rounded-[var(--radius-landing)] border border-[var(--rule)] text-[var(--ink-60)] bg-transparent cursor-pointer"
              aria-label={
                theme === "light"
                  ? t("landing.editorial.header.darkMode")
                  : t("landing.editorial.header.lightMode")
              }
            >
              {theme === "light" ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
            </button>

            {/* Connexion (hidden on mobile) */}
            <Link
              href="/login"
              className="hidden md:inline-flex font-[var(--font-sans-landing)] text-[length:var(--text-small)] font-medium text-[var(--ink-70)] no-underline"
            >
              {t("landing.footerLogin")}
            </Link>

            {/* Primary CTA (hidden on mobile) */}
            <Link
              href="/register-clinic"
              className="hidden md:inline-flex items-center font-[var(--font-sans-landing)] text-[length:var(--text-small)] font-medium h-8 px-4 rounded-[var(--radius-landing)] bg-[var(--oltigo-green)] text-[var(--bone)] no-underline transition-opacity duration-[var(--duration)] ease-[var(--easing)]"
            >
              {t("landing.ctaOpenAccount")}
            </Link>

            {/* Mobile hamburger */}
            <button
              className="flex items-center justify-center md:hidden size-8 text-[var(--ink)] bg-transparent border-none cursor-pointer"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? t("landing.menuClose") : t("landing.menuOpen")}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <nav className="flex flex-col gap-4 border-t border-t-[var(--rule)] bg-[var(--bone)] px-[var(--gutter-mobile)] py-4 md:hidden">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="font-[var(--font-sans-landing)] text-[length:var(--text-body)] font-medium text-[var(--ink-70)] no-underline"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/register-clinic"
              className="flex items-center justify-center font-[var(--font-sans-landing)] text-[length:var(--text-small)] font-medium h-11 rounded-[var(--radius-landing)] bg-[var(--oltigo-green)] text-[var(--bone)] no-underline"
            >
              {t("landing.ctaOpenAccount")}
            </Link>
          </nav>
        )}
      </header>
    </>
  );
}
