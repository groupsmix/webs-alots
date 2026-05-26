"use client";

import Link from "next/link";

export function EmergentHeader({
  lang,
  onToggleLang,
}: {
  lang: "fr" | "ar";
  onToggleLang: () => void;
}) {
  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-md"
      style={{
        backgroundColor: "rgba(250, 248, 243, 0.85)",
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

        <div className="flex items-center gap-4">
          <button
            onClick={onToggleLang}
            className="rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
            style={{
              borderColor: "var(--rule)",
              color: "var(--ink-60)",
              fontFamily: "var(--font-mono-landing)",
            }}
          >
            {lang === "fr" ? "FR" : "AR"} | {lang === "fr" ? "AR" : "FR"}
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
