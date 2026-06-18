"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/landing/oltigo/components/ui/button";
import { useI18n } from "@/components/landing/oltigo/i18n/context";
import { locales, localeLabel, type Locale } from "@/components/landing/oltigo/i18n/dictionaries";
import { cn } from "@/lib/utils";
import { Wordmark } from "./section-kit";

export function Nav() {
  const { dict, locale, setLocale } = useI18n();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "#features", label: dict.nav.sections.features },
    { href: "#how", label: dict.nav.sections.how },
    { href: "#pricing", label: dict.nav.sections.pricing },
    { href: "#faq", label: dict.nav.sections.faq },
  ];

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled
          ? "border-b border-hairline bg-ink/80 backdrop-blur-md"
          : "border-b border-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
        <a href="#top" className="flex items-center gap-2.5" aria-label="OLTIGO">
          <Wordmark />
          <span className="hidden items-center gap-1.5 sm:flex">
            <span className="size-1.5 animate-soft-pulse rounded-full bg-emerald" />
            <span className="telemetry text-[10px] uppercase tracking-[0.16em] text-text-muted">
              {dict.nav.status}
            </span>
          </span>
        </a>

        <div className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[13.5px] text-text-secondary transition-colors hover:text-text"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <LangToggle locale={locale} setLocale={setLocale} />
          <a
            href="/login"
            className="hidden text-[13.5px] text-text-secondary transition-colors hover:text-text sm:inline"
          >
            {dict.nav.login}
          </a>
          <Button variant="primary" size="sm" href="#demo">
            {dict.nav.openAccount}
          </Button>
        </div>
      </nav>
    </header>
  );
}

function LangToggle({ locale, setLocale }: { locale: Locale; setLocale: (l: Locale) => void }) {
  return (
    <div className="flex items-center rounded-full border border-hairline bg-surface/40 p-0.5">
      {locales.map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={cn(
            "telemetry rounded-full px-2 py-1 text-[10.5px] uppercase tracking-wider transition-colors",
            locale === l
              ? "bg-surface-high text-text"
              : "text-text-muted hover:text-text-secondary",
          )}
        >
          {localeLabel[l]}
        </button>
      ))}
    </div>
  );
}
