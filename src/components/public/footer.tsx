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
    <footer className="border-t bg-muted/50 py-8">
      <div className="container mx-auto px-4">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="font-semibold mb-2">{displayName}</h3>
            <p className="text-sm text-muted-foreground">{contact.address}</p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Liens rapides</h3>
            <nav className="flex flex-col gap-1">
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
            </nav>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Contact</h3>
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
