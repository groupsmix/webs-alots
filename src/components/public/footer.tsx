import { Shield } from "lucide-react";
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
    <footer className="border-t bg-muted/50 py-8" role="contentinfo" aria-label="Pied de page">
      <div className="container mx-auto px-4">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <h2 className="text-base font-semibold mb-2">{displayName}</h2>
            {address ? <p className="text-sm text-muted-foreground">{address}</p> : null}
          </div>

          <div>
            <h2 className="text-base font-semibold mb-2">{t(locale, "public.quickLinks")}</h2>
            <nav aria-label={t(locale, "public.quickLinks")} className="flex flex-col gap-0">
              <Link
                href="/services/"
                className="text-sm text-muted-foreground hover:text-foreground min-h-11 flex items-center"
              >
                {t(locale, "public.services")}
              </Link>
              <Link
                href="/how-to-book/"
                className="text-sm text-muted-foreground hover:text-foreground min-h-11 flex items-center"
              >
                {t(locale, "public.appointments")}
              </Link>
              <Link
                href="/location/"
                className="text-sm text-muted-foreground hover:text-foreground min-h-11 flex items-center"
              >
                {t(locale, "public.locationHours")}
              </Link>
              <Link
                href="/contact/"
                className="text-sm text-muted-foreground hover:text-foreground min-h-11 flex items-center"
              >
                {t(locale, "public.contact")}
              </Link>
              <Link
                href="/privacy/"
                className="text-sm text-muted-foreground hover:text-foreground min-h-11 flex items-center"
              >
                {t(locale, "public.privacy")}
              </Link>
              <CookieSettingsLink locale={locale} />
            </nav>
          </div>

          <div>
            <h2 className="text-base font-semibold mb-2">{t(locale, "public.contact")}</h2>
            {phone ? <p className="text-sm text-muted-foreground">{phone}</p> : null}
            {email ? <p className="text-sm text-muted-foreground">{email}</p> : null}
          </div>
        </div>

        <div className="mt-8 border-t pt-4 flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-1 text-muted-foreground">
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
