import Link from "next/link";

export function PharmacyFooter() {
  return (
    <footer className="border-t bg-muted/50 py-8">
      <div className="container mx-auto px-4">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <h3 className="font-semibold mb-2">Pharmacie Centrale</h3>
            <p className="text-sm text-muted-foreground">
              Your trusted neighborhood pharmacy providing quality healthcare products and services.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Quick Links</h3>
            <nav className="flex flex-col gap-1">
              <Link href="/pharmacy/catalog" className="text-sm text-muted-foreground hover:text-foreground">Products</Link>
              <Link href="/pharmacy/services" className="text-sm text-muted-foreground hover:text-foreground">Services</Link>
              <Link href="/pharmacy/prescription-upload" className="text-sm text-muted-foreground hover:text-foreground">Upload Prescription</Link>
              <Link href="/pharmacy/prescription-history" className="text-sm text-muted-foreground hover:text-foreground">Prescription History</Link>
            </nav>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Hours</h3>
            <p className="text-sm text-muted-foreground">Mon - Fri: 08:30 - 20:00</p>
            <p className="text-sm text-muted-foreground">Saturday: 09:00 - 18:00</p>
            <p className="text-sm text-muted-foreground">Sunday: Closed</p>
            <p className="text-sm text-emerald-600 font-medium mt-1">On-duty nights: See schedule</p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Contact</h3>
            <p className="text-sm text-muted-foreground">+212 5 22 30 40 50</p>
            <p className="text-sm text-muted-foreground">contact@pharmacie-centrale.ma</p>
            <p className="text-sm text-muted-foreground">123 Bd Mohammed V, Casablanca</p>
          </div>
        </div>

        <div className="mt-8 border-t pt-4 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Pharmacie Centrale. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
