"use client";

import { Menu, Moon, Sun, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { label: "Produit", href: "#product" },
    { label: "Clients", href: "#clients" },
    { label: "Tarifs", href: "#pricing" },
  ];

  return (
    <>
      {/* 1px hairline at viewport top */}
      <div style={{ height: 1, backgroundColor: "var(--rule)" }} />

      <header
        className="sticky top-0 z-50"
        style={{
          backgroundColor: "var(--bone)",
          borderBottom: "1px solid var(--rule)",
        }}
      >
        <div
          className="mx-auto flex w-full items-center justify-between"
          style={{
            maxWidth: "var(--container-max)",
            paddingInline: "var(--gutter-desktop)",
            height: 64,
          }}
        >
          {/* eslint-disable i18next/no-literal-string */}

          {/* Logo */}
          <Link
            href="/"
            style={{
              fontFamily: "var(--font-sans-landing)",
              fontSize: "var(--text-small)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
              textDecoration: "none",
            }}
          >
            oltig<span style={{ color: "var(--oltigo-green)" }}>o</span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                style={{
                  fontFamily: "var(--font-sans-landing)",
                  fontSize: "var(--text-small)",
                  fontWeight: 500,
                  color: "var(--ink-70)",
                  textDecoration: "none",
                  transition: `color var(--duration) var(--easing)`,
                }}
              >
                {link.label}
              </a>
            ))}

            {/* Status dot link */}
            <a
              href="#status"
              className="inline-flex items-center gap-1.5"
              style={{
                fontFamily: "var(--font-mono-landing)",
                fontSize: "var(--text-mono)",
                letterSpacing: "var(--ls-mono)",
                textTransform: "uppercase",
                fontWeight: 500,
                color: "var(--ink-60)",
                textDecoration: "none",
              }}
            >
              Statut <StatusDot />
            </a>
          </nav>

          {/* Right cluster */}
          <div className="flex items-center gap-3">
            {/* Language switcher (mono) */}
            <button
              onClick={onToggleLang}
              style={{
                fontFamily: "var(--font-mono-landing)",
                fontSize: "var(--text-mono)",
                letterSpacing: "var(--ls-mono)",
                textTransform: "uppercase",
                fontWeight: 500,
                color: "var(--ink-60)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 0",
              }}
              aria-label="Change language"
            >
              {lang === "fr" ? "FR" : lang === "ar" ? "AR" : "EN"}
            </button>

            {/* Theme toggle */}
            <button
              onClick={onToggleTheme}
              className="flex items-center justify-center"
              style={{
                width: 32,
                height: 32,
                borderRadius: "var(--radius-landing)",
                border: "1px solid var(--rule)",
                color: "var(--ink-60)",
                background: "none",
                cursor: "pointer",
              }}
              aria-label={theme === "light" ? "Mode sombre" : "Mode clair"}
            >
              {theme === "light" ? (
                <Moon style={{ width: 14, height: 14 }} />
              ) : (
                <Sun style={{ width: 14, height: 14 }} />
              )}
            </button>

            {/* Connexion (hidden on mobile) */}
            <Link
              href="/login"
              className="hidden md:inline-flex"
              style={{
                fontFamily: "var(--font-sans-landing)",
                fontSize: "var(--text-small)",
                fontWeight: 500,
                color: "var(--ink-70)",
                textDecoration: "none",
              }}
            >
              Connexion
            </Link>

            {/* Primary CTA (hidden on mobile) */}
            <Link
              href="/register-clinic"
              className="hidden md:inline-flex"
              style={{
                fontFamily: "var(--font-sans-landing)",
                fontSize: "var(--text-small)",
                fontWeight: 500,
                height: 32,
                paddingInline: 16,
                display: "inline-flex",
                alignItems: "center",
                borderRadius: "var(--radius-landing)",
                backgroundColor: "var(--oltigo-green)",
                color: "var(--bone)",
                textDecoration: "none",
                transition: `opacity var(--duration) var(--easing)`,
              }}
            >
              Ouvrir un compte
            </Link>

            {/* Mobile hamburger */}
            <button
              className="flex items-center justify-center md:hidden"
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                width: 32,
                height: 32,
                color: "var(--ink)",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              {menuOpen ? (
                <X style={{ width: 20, height: 20 }} />
              ) : (
                <Menu style={{ width: 20, height: 20 }} />
              )}
            </button>
          </div>

          {/* eslint-enable i18next/no-literal-string */}
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <nav
            className="flex flex-col gap-4 border-t px-[var(--gutter-mobile)] py-4 md:hidden"
            style={{
              borderColor: "var(--rule)",
              backgroundColor: "var(--bone)",
            }}
          >
            {/* eslint-disable i18next/no-literal-string */}
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                style={{
                  fontFamily: "var(--font-sans-landing)",
                  fontSize: "var(--text-body)",
                  fontWeight: 500,
                  color: "var(--ink-70)",
                  textDecoration: "none",
                }}
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/register-clinic"
              style={{
                fontFamily: "var(--font-sans-landing)",
                fontSize: "var(--text-small)",
                fontWeight: 500,
                height: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "var(--radius-landing)",
                backgroundColor: "var(--oltigo-green)",
                color: "var(--bone)",
                textDecoration: "none",
              }}
            >
              Ouvrir un compte
            </Link>
            {/* eslint-enable i18next/no-literal-string */}
          </nav>
        )}
      </header>
    </>
  );
}
