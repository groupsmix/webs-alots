import { Mail, MapPin, Phone, Shield } from "lucide-react";
import Link from "next/link";
import { t, type Locale } from "@/lib/i18n";
import { CookieSettingsLink } from "./cookie-settings-link";
import { CopyrightYear } from "./copyright-year";

interface PublicFooterProps {
  clinicName?: string;
  phone?: string;
  email?: string;
  address?: string;
  locale?: Locale;
}

export function PublicFooter({
  clinicName,
  phone,
  email,
  address,
  locale = "fr",
}: PublicFooterProps) {
  const displayName = clinicName || "Oltigo";

  return (
    <footer
      className="border-t border-border bg-background py-10 sm:py-12"
      role="contentinfo"
      aria-label={t(locale, "public.footerLabel")}
    >
      <div className="container mx-auto px-4">
        <div className="grid gap-8 sm:gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand column */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-bold text-primary mb-3">{displayName}</h2>
            {address && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" aria-hidden="true" />
                {address}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
              {t(locale, "public.quickLinks")}
            </h3>
            <nav aria-label={t(locale, "public.quickLinks")} className="flex flex-col gap-2">
              <Link
                href="/services/"
                className="text-sm text-muted-foreground hover:text-primary transition-colors min-h-10 flex items-center"
              >
                {t(locale, "public.services")}
              </Link>
              <Link
                href="/how-to-book/"
                className="text-sm text-muted-foreground hover:text-primary transition-colors min-h-10 flex items-center"
              >
                {t(locale, "public.appointments")}
              </Link>
              <Link
                href="/location/"
                className="text-sm text-muted-foreground hover:text-primary transition-colors min-h-10 flex items-center"
              >
                {t(locale, "public.locationHours")}
              </Link>
              <Link
                href="/contact/"
                className="text-sm text-muted-foreground hover:text-primary transition-colors min-h-10 flex items-center"
              >
                {t(locale, "public.contact")}
              </Link>
            </nav>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
              {t(locale, "public.legal")}
            </h3>
            <nav aria-label={t(locale, "public.legal")} className="flex flex-col gap-2">
              <Link
                href="/privacy/"
                className="text-sm text-muted-foreground hover:text-primary transition-colors min-h-10 flex items-center"
              >
                {t(locale, "public.privacy")}
              </Link>
              <Link
                href="/terms/"
                className="text-sm text-muted-foreground hover:text-primary transition-colors min-h-10 flex items-center"
              >
                {t(locale, "public.terms")}
              </Link>
              <CookieSettingsLink locale={locale} />
            </nav>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
              {t(locale, "public.contact")}
            </h3>
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

        <div className="mt-10 border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5">
            <Shield className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {t(locale, "public.cndpBadge")}
          </span>
          <span>
            &copy; <CopyrightYear /> {displayName}. {t(locale, "public.allRightsReserved")}
          </span>
        </div>
      </div>
    </footer>
  );
}
