"use client";

import { Mail, MapPin, Phone } from "lucide-react";
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
export function FooterCentered({ clinicName, template, phone, email, address }: FooterProps) {
  const [locale] = useLocale();
  const isRtl = template?.rtl ?? false;
  const year = new Date().getFullYear();
  const hasContact = phone || email || address;

  return (
    <footer
      className="border-t border-border bg-background"
      dir={isRtl ? "rtl" : undefined}
      aria-label={t(locale, "public.footerLabel")}
    >
      <div className="container mx-auto flex flex-col items-center gap-6 px-4 py-8 sm:py-10">
        {/* Clinic name */}
        <h3 className="text-xl font-bold text-primary">{clinicName}</h3>

        {/* Navigation links */}
        <nav
          aria-label={t(locale, "public.quickLinks")}
          className="flex flex-wrap items-center justify-center gap-4"
        >
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

        {/* Contact */}
        {hasContact && (
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
              >
                <Phone className="h-4 w-4 text-primary" aria-hidden="true" />
                {phone}
              </a>
            )}
            {email && (
              <a
                href={`mailto:${email}`}
                className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
              >
                <Mail className="h-4 w-4 text-primary" aria-hidden="true" />
                {email}
              </a>
            )}
            {address && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
                {address}
              </span>
            )}
          </div>
        )}

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
