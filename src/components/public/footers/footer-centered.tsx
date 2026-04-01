"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-switcher";
import { t } from "@/lib/i18n";
import type { FooterProps } from "./index";

/**
 * Centered footer — stacked layout with social icons.
 *
 * Everything centered: clinic name, navigation links, social icons,
 * and copyright. Works well with elegant and luxury templates.
 * Supports RTL layout.
 */
export function FooterCentered({ clinicName, template }: FooterProps) {
  const [locale] = useLocale();
  const isRtl = template?.rtl ?? false;
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/20" dir={isRtl ? "rtl" : undefined}>
      <div className="container mx-auto flex flex-col items-center gap-6 px-4 py-10">
        {/* Clinic name */}
        <h3 className="text-xl font-bold">{clinicName}</h3>

        {/* Navigation links */}
        <nav aria-label="Footer navigation" className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {t(locale, "public.home")}
          </Link>
          <Link href="/services" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {t(locale, "public.services")}
          </Link>
          <Link href="/book" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {t(locale, "public.bookAppointment")}
          </Link>
          <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {t(locale, "public.contact")}
          </Link>
        </nav>

        {/* Divider */}
        <div className="h-px w-full max-w-xs bg-border" />

        {/* Copyright */}
        <p className="text-xs text-muted-foreground">
          © {year} {clinicName}. {t(locale, "public.allRightsReserved")}
        </p>
      </div>
    </footer>
  );
}
