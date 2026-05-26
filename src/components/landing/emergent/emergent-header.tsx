"use client";

import { Moon, Sun } from "lucide-react";
import Link from "next/link";

export function EmergentHeader({
  lang,
  theme,
  onToggleLang,
  onToggleTheme,
}: {
  lang: "fr" | "ar";
  theme: "light" | "dark";
  onToggleLang: () => void;
  onToggleTheme: () => void;
}) {
  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-md"
      style={{
        backgroundColor: theme === "dark" ? "rgba(13, 17, 23, 0.85)" : "rgba(250, 248, 243, 0.85)",
        borderColor: "var(--rule)",
        boxShadow: "var(--shadow-sticky)",
      }}
    >
      <div
        className="mx-auto flex h-14 w-full items-center justify-between px-[var(--gutter-mobile)] md:px-[var(--gutter-tablet)] lg:px-[var(--gutter-desktop)]"
        style={{ maxWidth: "var(--container-max)" }}
      >
        {/* eslint-disable i18next/no-literal-string */}
        <Link
          href="/"
          className="text-sm font-bold tracking-tight"
          style={{ color: "var(--ink)", fontFamily: "var(--font-sans-landing)" }}
        >
          Oltigo Health
        </Link>

        <div className="flex items-center gap-3">
          {/* Language toggle */}
          <button
            onClick={onToggleLang}
            className="rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
            style={{
              borderColor: "var(--rule)",
              color: "var(--ink-60)",
              fontFamily: "var(--font-mono-landing)",
            }}
            aria-label={lang === "fr" ? "Passer en arabe" : "التبديل إلى الفرنسية"}
          >
            {lang === "fr" ? "FR" : "AR"} | {lang === "fr" ? "AR" : "FR"}
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={onToggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-md border transition-colors"
            style={{ borderColor: "var(--rule)", color: "var(--ink-60)" }}
            aria-label={theme === "light" ? "Mode sombre" : "Mode clair"}
          >
            {theme === "light" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
          </button>

          <Link
            href="/register-clinic"
            className="hidden rounded-md px-4 py-1.5 text-xs font-medium text-white sm:inline-flex"
            style={{ backgroundColor: "var(--surgical-sage)" }}
          >
            Commencer
          </Link>
        </div>
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </header>
  );
}
