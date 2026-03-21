import Link from "next/link";

export function LabFooter() {
  return (
    <footer className="border-t bg-muted/50 py-8">
      <div className="container mx-auto px-4">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <h3 className="font-semibold mb-2">Laboratoire Central</h3>
            <p className="text-sm text-muted-foreground">
              Your trusted laboratory for accurate diagnostics, radiology exams, and timely results.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Quick Links</h3>
            <nav className="flex flex-col gap-1">
              <Link href="/lab/tests" className="text-sm text-muted-foreground hover:text-foreground">Tests &amp; Exams</Link>
              <Link href="/lab/my-results" className="text-sm text-muted-foreground hover:text-foreground">Access Results</Link>
              <Link href="/lab/collection-points" className="text-sm text-muted-foreground hover:text-foreground">Collection Points</Link>
              <Link href="/lab/contact" className="text-sm text-muted-foreground hover:text-foreground">Contact</Link>
            </nav>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Hours</h3>
            <p className="text-sm text-muted-foreground">Mon - Fri: 07:00 - 18:00</p>
            <p className="text-sm text-muted-foreground">Saturday: 07:00 - 13:00</p>
            <p className="text-sm text-muted-foreground">Sunday: Closed</p>
            <p className="text-sm text-blue-600 font-medium mt-1">Home collection available</p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Contact</h3>
            <p className="text-sm text-muted-foreground">+212 5 22 40 50 60</p>
            <p className="text-sm text-muted-foreground">contact@labo-central.ma</p>
            <p className="text-sm text-muted-foreground">123 Bd Mohammed V, Casablanca</p>
          </div>
        </div>

        <div className="mt-8 border-t pt-4 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Laboratoire Central. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
