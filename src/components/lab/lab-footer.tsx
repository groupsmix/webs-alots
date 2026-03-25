import Link from "next/link";

export function LabFooter() {
  return (
    <footer className="border-t bg-muted/50 py-8">
      <div className="container mx-auto px-4">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <h3 className="font-semibold mb-2">Laboratoire</h3>
            <p className="text-sm text-muted-foreground">
              Votre laboratoire de confiance pour des diagnostics précis, des examens de radiologie et des résultats rapides.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Liens rapides</h3>
            <nav className="flex flex-col gap-1">
              <Link href="/lab/tests" className="text-sm text-muted-foreground hover:text-foreground">Analyses & Examens</Link>
              <Link href="/lab/my-results" className="text-sm text-muted-foreground hover:text-foreground">Accéder aux résultats</Link>
              <Link href="/lab/collection-points" className="text-sm text-muted-foreground hover:text-foreground">Points de prélèvement</Link>
              <Link href="/lab/contact" className="text-sm text-muted-foreground hover:text-foreground">Contact</Link>
            </nav>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Horaires</h3>
            <p className="text-sm text-muted-foreground">Lun - Ven : 07h00 - 18h00</p>
            <p className="text-sm text-muted-foreground">Samedi : 07h00 - 13h00</p>
            <p className="text-sm text-muted-foreground">Dimanche : Fermé</p>
            <p className="text-sm text-blue-600 font-medium mt-1">Prélèvement à domicile disponible</p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Contact</h3>
            <p className="text-sm text-muted-foreground"></p>
            <p className="text-sm text-muted-foreground"></p>
            <p className="text-sm text-muted-foreground"></p>
          </div>
        </div>

        <div className="mt-8 border-t pt-4 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Laboratoire. Tous droits réservés.
        </div>
      </div>
    </footer>
  );
}
