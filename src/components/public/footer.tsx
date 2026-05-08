import Link from "next/link";
import { t, type Locale } from "@/lib/i18n";
import { defaultWebsiteConfig } from "@/lib/website-config";
import { CookieSettingsLink } from "./cookie-settings-link";
import { CopyrightYear } from "./copyright-year";

interface PublicFooterProps {
  clinicName?: string;
  phone?: string;
  email?: string;
  address?: string;
  locale?: Locale;
}

export function PublicFooter({ clinicName, phone, email, address, locale = "fr" }: PublicFooterProps) {
  const contact = defaultWebsiteConfig.contact;
  const displayName = clinicName || "Oltigo";
  const displayPhone = phone || contact.phone;
  const displayEmail = email || contact.email;
  const displayAddress = address || contact.address;

  return (
    <footer className="border-t bg-muted/50 py-8" role="contentinfo" aria-label="Pied de page">
      <div className="container mx-auto px-4">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <h2 className="text-base font-semibold mb-2">{displayName}</h2>
            <p className="text-sm text-muted-foreground">{displayAddress}</p>
          </div>

          <div>
            <h2 className="text-base font-semibold mb-2">{t(locale, "public.quickLinks")}</h2>
            <nav aria-label={t(locale, "public.quickLinks")} className="flex flex-col gap-0">
              <Link
                href="/services"
                className="text-sm text-muted-foreground hover:text-foreground min-h-11 flex items-center"
              >
                {t(locale, "public.services")}
              </Link>
              <Link
                href="/how-to-book"
                className="text-sm text-muted-foreground hover:text-foreground min-h-11 flex items-center"
              >
                {t(locale, "public.appointments")}
              </Link>
              <Link
                href="/location"
                className="text-sm text-muted-foreground hover:text-foreground min-h-11 flex items-center"
              >
                {t(locale, "public.locationHours")}
              </Link>
              <Link
                href="/contact"
                className="text-sm text-muted-foreground hover:text-foreground min-h-11 flex items-center"
              >
                {t(locale, "public.contact")}
              </Link>
              <Link
                href="/privacy"
                className="text-sm text-muted-foreground hover:text-foreground min-h-11 flex items-center"
              >
                {t(locale, "public.privacy")}
              </Link>
              <CookieSettingsLink locale={locale} />
            </nav>
          </div>

          <div>
            <h2 className="text-base font-semibold mb-2">{t(locale, "public.contact")}</h2>
            <p className="text-sm text-muted-foreground">{displayPhone}</p>
            <p className="text-sm text-muted-foreground">{displayEmail}</p>
          </div>
        </div>

        <div className="mt-8 border-t pt-4 text-center text-xs text-muted-foreground">
          &copy; <CopyrightYear /> {displayName}. {t(locale, "public.allRightsReserved")}
        </div>
      </div>
    </footer>
  );
}
