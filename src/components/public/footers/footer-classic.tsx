"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-switcher";
import { t } from "@/lib/i18n";
import type { FooterProps } from "./index";

/**
 * Classic 3-column footer — the default footer variant.
 *
 * Three columns: clinic info, quick links, and contact info.
 * Includes copyright bar at the bottom.
 * Supports RTL layout.
 */
export function FooterClassic({ clinicName, template }: FooterProps) {
  const [locale] = useLocale();
  const isRtl = template?.rtl ?? false;
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/30" dir={isRtl ? "rtl" : undefined}>
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Column 1 — Clinic info */}
          <div>
            <h3 className="text-lg font-bold">{clinicName}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(locale, "public.services")}
            </p>
          </div>

          {/* Column 2 — Quick links */}
          <div>
            <h4 className="font-semibold">{t(locale, "public.quickLinks")}</h4>
            <nav aria-label="Footer navigation" className="mt-3 flex flex-col gap-2">
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
          </div>

          {/* Column 3 — Contact */}
          <div>
            <h4 className="font-semibold">{t(locale, "public.contact")}</h4>
            <div className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
              <p>{t(locale, "public.contact")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright bar */}
      <div className="border-t px-4 py-4">
        <p className="text-center text-xs text-muted-foreground">
          © {year} {clinicName}. {t(locale, "public.allRightsReserved")}
        </p>
      </div>
    </footer>
  );
}
