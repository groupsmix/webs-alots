import Link from "next/link";

const linkBtnPrimary =
  "inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-6 py-3 text-sm font-medium hover:bg-primary/80 transition-colors";

export function BookingSection() {
  return (
    <section className="py-16 bg-primary/5">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold mb-4">Prêt à réserver ?</h2>
        <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
          Prenez rendez-vous en ligne en quelques clics. Nous nous réjouissons
          de vous offrir des soins de qualité.
        </p>
        <Link href="/book" className={linkBtnPrimary}>
          Prendre rendez-vous
        </Link>
      </div>
    </section>
  );
}
