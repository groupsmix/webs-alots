"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/landing/oltigo/components/ui/button";
import { useI18n } from "@/components/landing/oltigo/i18n/context";
import { locales, localeLabel, type Locale } from "@/components/landing/oltigo/i18n/dictionaries";
import { cn } from "@/lib/utils";
import { Wordmark } from "./section-kit";

const links = [
  { href: "/#features", labelKey: "features" as const },
  { href: "/#how", labelKey: "how" as const },
  { href: "/pricing", labelKey: "pricing" as const },
  { href: "/#faq", labelKey: "faq" as const },
] as const;

export function PublicNav() {
  const { dict, locale, setLocale } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const sectionLabels = dict.nav.sections;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled
          ? "border-b border-hairline bg-ink/80 backdrop-blur-md"
          : "border-b border-transparent",
      )}
    >
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6"
        aria-label={dict.nav.menu}
      >
        <Link href="/" className="flex items-center gap-2.5" aria-label="OLTIGO">
          <Wordmark />
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[13.5px] text-text-secondary transition-colors hover:text-text"
            >
              {sectionLabels[l.labelKey]}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <LangToggle locale={locale} setLocale={setLocale} />
          <Button variant="secondary" size="sm" href="/annuaire" className="hidden sm:inline-flex">
            {dict.nav.patientSpace}
          </Button>
          <Button variant="primary" size="sm" href="/register-clinic">
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
              {sectionLabels[l.labelKey]}
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
          <Button variant="primary" size="md" href="/register-clinic" className="mt-2 w-full">
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
