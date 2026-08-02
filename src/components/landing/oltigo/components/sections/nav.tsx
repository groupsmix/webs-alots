"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/landing/oltigo/components/ui/button";
import { useI18n } from "@/components/landing/oltigo/i18n/context";
import { locales, localeLabel, type Locale } from "@/components/landing/oltigo/i18n/dictionaries";
import { cn } from "@/lib/utils";
import { Wordmark } from "./section-kit";
import { useActiveAnchor } from "./use-active-anchor";

export function Nav() {
  const { dict, locale, setLocale } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
  const anchorIds = links.map((l) => l.href.replace("#", ""));
  const activeAnchor = useActiveAnchor(anchorIds);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled
          ? "border-b border-hairline bg-ink/80 backdrop-blur-md"
          : "border-b border-transparent",
      )}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[10px] focus:bg-emerald focus:px-4 focus:py-2 focus:text-ink"
      >
        {dict.nav.skipToContent}
      </a>
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6"
        aria-label={dict.nav.menu}
      >
        <Link href="#top" className="flex items-center gap-2.5" aria-label="OLTIGO">
          <Wordmark />
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {links.map((l) => {
            const isActive = activeAnchor === l.href.replace("#", "");
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "text-[13.5px] transition-colors hover:text-text",
                  isActive ? "font-medium text-emerald" : "text-text-secondary",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <LangToggle locale={locale} setLocale={setLocale} />
          <Button variant="secondary" size="sm" href="/annuaire">
            {dict.nav.patientSpace}
          </Button>
          <Button variant="secondary" size="sm" href="/register-clinic">
            {dict.nav.doctorSpace}
          </Button>
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? "Fermer le menu" : dict.nav.menu}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-text-secondary transition-colors hover:bg-surface/40 hover:text-text md:hidden"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      <div
        id="mobile-menu"
        className={cn(
          "absolute inset-x-0 top-16 border-b border-hairline bg-ink/95 backdrop-blur-md px-6 py-4 md:hidden",
          mobileOpen ? "block" : "hidden",
        )}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className="text-[15px] text-text-secondary transition-colors hover:text-text"
            >
              {l.label}
            </Link>
          ))}
          <Button
            variant="secondary"
            size="md"
            href="/annuaire"
            className="w-full"
            onClick={() => setMobileOpen(false)}
          >
            {dict.nav.patientSpace}
          </Button>
          <Button
            variant="secondary"
            size="md"
            href="/register-clinic"
            className="mt-2 w-full"
            onClick={() => setMobileOpen(false)}
          >
            {dict.nav.doctorSpace}
          </Button>
        </div>
      </div>
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
          aria-label={localeLabel[l]}
          className={cn(
            "telemetry rounded-full px-2 py-1 text-[10.5px] uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald",
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
