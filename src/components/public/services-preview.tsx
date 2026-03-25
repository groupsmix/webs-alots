import Link from "next/link";
import { ArrowRight, Stethoscope } from "lucide-react";
import { getPublicServices } from "@/lib/data/public";

const linkBtnOutline =
  "inline-flex items-center justify-center rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-medium hover:bg-muted hover:text-foreground transition-colors";

export async function ServicesPreview() {
  const services = await getPublicServices();
  const activeServices = services.filter((s) => s.active).slice(0, 3);

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <h2 className="text-center text-3xl font-bold mb-12">Nos Services</h2>
        <div className="grid gap-8 md:grid-cols-3">
          {activeServices.length > 0 ? (
            activeServices.map((service) => (
              <div
                key={service.id}
                className="rounded-xl border bg-card p-6 text-center shadow-sm"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Stethoscope className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{service.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {service.description}
                </p>
              </div>
            ))
          ) : (
            <p className="col-span-3 text-center text-muted-foreground">
              Aucun service disponible pour le moment.
            </p>
          )}
        </div>
        <div className="mt-10 text-center">
          <Link
            href="/services"
            className={linkBtnOutline}
          >
            Voir tous les services
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
