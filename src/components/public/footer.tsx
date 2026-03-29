import Link from "next/link";
import { clinicConfig } from "@/config/clinic.config";
import { defaultWebsiteConfig } from "@/lib/website-config";

interface PublicFooterProps {
  clinicName?: string;
}

export function PublicFooter({ clinicName }: PublicFooterProps) {
  const contact = defaultWebsiteConfig.contact;
  const displayName = clinicName || clinicConfig.name || "Oltigo";

  return (
    <footer className="border-t bg-muted/50 py-8" role="contentinfo" aria-label="Pied de page">
      <div className="container mx-auto px-4">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <h2 className="text-base font-semibold mb-2">{displayName}</h2>
            <p className="text-sm text-muted-foreground">{contact.address}</p>
          </div>

          <div>
            <h2 className="text-base font-semibold mb-2">Liens rapides</h2>
            <nav aria-label="Liens rapides" className="flex flex-col gap-1">
              <Link
                href="/services"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Services
              </Link>
              <Link
                href="/how-to-book"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Rendez-vous
              </Link>
              <Link
                href="/location"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Accès & Horaires
              </Link>
              <Link
                href="/contact"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Contact
              </Link>
              <Link
                href="/privacy"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Confidentialité
              </Link>
            </nav>
          </div>

          <div>
            <h2 className="text-base font-semibold mb-2">Contact</h2>
            <p className="text-sm text-muted-foreground">{contact.phone}</p>
            <p className="text-sm text-muted-foreground">{contact.email}</p>
          </div>
        </div>

        <div className="mt-8 border-t pt-4 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} {displayName}. Tous droits
          réservés.
        </div>
      </div>
    </footer>
  );
}
