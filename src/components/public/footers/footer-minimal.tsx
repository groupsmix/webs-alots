"use client";

import { Mail, MapPin, Phone } from "lucide-react";
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
export function FooterMinimal({ clinicName, template, phone, email, address }: FooterProps) {
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
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {year} {clinicName}
          </p>
          <nav aria-label={t(locale, "public.quickLinks")} className="flex items-center gap-4">
            <Link
              href="/services"
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              {t(locale, "public.services")}
            </Link>
            <Link
              href="/book"
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              {t(locale, "public.bookAppointment")}
            </Link>
            <Link
              href="/contact"
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              {t(locale, "public.contact")}
            </Link>
          </nav>
        </div>

        {hasContact && (
          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
              >
                <Phone className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {phone}
              </a>
            )}
            {email && (
              <a
                href={`mailto:${email}`}
                className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
              >
                <Mail className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {email}
              </a>
            )}
            {address && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {address}
              </span>
            )}
          </div>
        )}
      </div>
    </footer>
  );
}
