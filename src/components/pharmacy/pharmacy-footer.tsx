import Link from "next/link";

export function PharmacyFooter() {
  return (
    <footer className="border-t bg-muted/50 py-8">
      <div className="container mx-auto px-4">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <h3 className="font-semibold mb-2">Pharmacie</h3>
            <p className="text-sm text-muted-foreground">
              Votre pharmacie de confiance pour des produits et services de santé de qualité.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Liens rapides</h3>
            <nav className="flex flex-col gap-1">
              <Link href="/pharmacy/catalog" className="text-sm text-muted-foreground hover:text-foreground">Produits</Link>
              <Link href="/pharmacy/services" className="text-sm text-muted-foreground hover:text-foreground">Services</Link>
              <Link href="/pharmacy/prescription-upload" className="text-sm text-muted-foreground hover:text-foreground">Envoyer une ordonnance</Link>
              <Link href="/pharmacy/prescription-history" className="text-sm text-muted-foreground hover:text-foreground">Historique des ordonnances</Link>
            </nav>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Horaires</h3>
            <p className="text-sm text-muted-foreground">Lun - Ven : 08h30 - 20h00</p>
            <p className="text-sm text-muted-foreground">Samedi : 09h00 - 18h00</p>
            <p className="text-sm text-muted-foreground">Dimanche : Fermé</p>
            <p className="text-sm text-emerald-600 font-medium mt-1">Garde de nuit : Voir le planning</p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Contact</h3>
            <p className="text-sm text-muted-foreground"></p>
            <p className="text-sm text-muted-foreground"></p>
            <p className="text-sm text-muted-foreground"></p>
          </div>
        </div>

        <div className="mt-8 border-t pt-4 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Pharmacie. Tous droits réservés.
        </div>
      </div>
    </footer>
  );
}
