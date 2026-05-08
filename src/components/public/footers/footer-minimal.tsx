"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-switcher";
import { t } from "@/lib/i18n";
import type { FooterProps } from "./index";

/**
 * Minimal footer — single line with copyright and links.
 *
 * Ultra-clean, compact footer for templates that want minimal chrome.
 * Supports RTL layout.
 */
export function FooterMinimal({ clinicName, template }: FooterProps) {
  const [locale] = useLocale();
  const isRtl = template?.rtl ?? false;
  const year = new Date().getFullYear();

  return (
    <footer className="border-t" dir={isRtl ? "rtl" : undefined}>
      <div className="container mx-auto flex flex-col items-center justify-between gap-2 px-4 py-4 sm:flex-row">
        <p className="text-xs text-muted-foreground">
          © {year} {clinicName}
        </p>
        <nav aria-label="Footer navigation" className="flex items-center gap-4">
          <Link href="/services" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            {t(locale, "public.services")}
          </Link>
          <Link href="/book" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            {t(locale, "public.bookAppointment")}
          </Link>
          <Link href="/contact" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            {t(locale, "public.contact")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
