"use client";

import { Mail, MapPin, Phone, Shield } from "lucide-react";
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
export function FooterClassic({ clinicName, template, phone, email, address }: FooterProps) {
  const [locale] = useLocale();
  const isRtl = template?.rtl ?? false;
  const year = new Date().getFullYear();

  return (
    <footer
      className="border-t border-border bg-background"
      dir={isRtl ? "rtl" : undefined}
      aria-label={t(locale, "public.footerLabel")}
    >
      <div className="container mx-auto px-4 py-10 sm:py-12">
        <div className="grid gap-8 sm:gap-10 md:grid-cols-3">
          {/* Column 1 — Clinic info */}
          <div>
            <h3 className="text-lg font-bold text-primary mb-3">{clinicName}</h3>
            {address && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" aria-hidden="true" />
                {address}
              </div>
            )}
          </div>

          {/* Column 2 — Quick links */}
          <div>
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
              {t(locale, "public.quickLinks")}
            </h4>
            <nav aria-label={t(locale, "public.quickLinks")} className="flex flex-col gap-2">
              <Link
                href="/"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {t(locale, "public.home")}
              </Link>
              <Link
                href="/services"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {t(locale, "public.services")}
              </Link>
              <Link
                href="/book"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {t(locale, "public.bookAppointment")}
              </Link>
              <Link
                href="/contact"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {t(locale, "public.contact")}
              </Link>
            </nav>
          </div>

          {/* Column 3 — Contact */}
          <div>
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
              {t(locale, "public.contact")}
            </h4>
            <div className="flex flex-col gap-3 text-sm text-muted-foreground">
              {phone && (
                <a
                  href={`tel:${phone}`}
                  className="flex items-center gap-2 hover:text-primary transition-colors"
                >
                  <Phone className="h-4 w-4 text-primary" aria-hidden="true" />
                  {phone}
                </a>
              )}
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="flex items-center gap-2 hover:text-primary transition-colors"
                >
                  <Mail className="h-4 w-4 text-primary" aria-hidden="true" />
                  {email}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Copyright bar */}
      <div className="border-t border-border px-4 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground container mx-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1">
            <Shield className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {t(locale, "public.cndpBadge")}
          </span>
          <p>
            © {year} {clinicName}. {t(locale, "public.allRightsReserved")}
          </p>
        </div>
      </div>
    </footer>
  );
}
