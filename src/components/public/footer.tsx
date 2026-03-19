import Link from "next/link";
import { clinicConfig } from "@/config/clinic.config";

export function PublicFooter() {
  return (
    <footer className="border-t bg-muted/50 py-8">
      <div className="container mx-auto px-4">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="font-semibold mb-2">{clinicConfig.name}</h3>
            {clinicConfig.contact.address && (
              <p className="text-sm text-muted-foreground">
                {clinicConfig.contact.address}
              </p>
            )}
            {clinicConfig.contact.city && (
              <p className="text-sm text-muted-foreground">
                {clinicConfig.contact.city}
              </p>
            )}
          </div>

          <div>
            <h3 className="font-semibold mb-2">Quick Links</h3>
            <nav className="flex flex-col gap-1">
              <Link
                href="/services"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Services
              </Link>
              <Link
                href="/book"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Book Appointment
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
            {clinicConfig.contact.phone && (
              <p className="text-sm text-muted-foreground">
                {clinicConfig.contact.phone}
              </p>
            )}
            {clinicConfig.contact.email && (
              <p className="text-sm text-muted-foreground">
                {clinicConfig.contact.email}
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 border-t pt-4 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} {clinicConfig.name}. All rights
          reserved.
        </div>
      </div>
    </footer>
  );
}
