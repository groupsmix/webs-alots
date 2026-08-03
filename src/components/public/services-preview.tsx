/* eslint-disable i18next/no-literal-string */
import {
  Activity,
  ArrowRight,
  HeartPulse,
  Pill,
  Stethoscope,
  Syringe,
  Thermometer,
} from "lucide-react";
import Link from "next/link";
import { getPublicServices } from "@/lib/data/public";
import { publicCardClass } from "@/lib/public-theme";
import type { TemplateDefinition } from "@/lib/templates";
import { cn } from "@/lib/utils";

const linkBtnOutline =
  "inline-flex items-center justify-center rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-medium hover:bg-muted hover:text-foreground transition-colors min-h-11";

interface ServicesPreviewProps {
  cardStyle?: TemplateDefinition["cardStyle"];
  template?: TemplateDefinition;
}

function serviceIcon(name: string, category?: string) {
  const key = `${name} ${category ?? ""}`.toLowerCase();
  if (key.includes("vaccin") || key.includes("vaccination")) return Syringe;
  if (
    key.includes("ecg") ||
    key.includes("cardio") ||
    key.includes("blood pressure") ||
    key.includes("tension")
  )
    return HeartPulse;
  if (
    key.includes("consult") ||
    key.includes("général") ||
    key.includes("general") ||
    key.includes("follow")
  )
    return Stethoscope;
  if (
    key.includes("exam") ||
    key.includes("test") ||
    key.includes("dianostic") ||
    key.includes("screening")
  )
    return Activity;
  if (key.includes("fever") || key.includes("temp") || key.includes("temperature"))
    return Thermometer;
  if (key.includes("medic") || key.includes("drug") || key.includes("prescription")) return Pill;
  return Stethoscope;
}

export async function ServicesPreview({ cardStyle = "shadow", template }: ServicesPreviewProps) {
  const services = await getPublicServices();
  const isPremium = template?.id === "premium";

  // Deduplicate by name (case-insensitive) and prefer active services.
  const seen = new Set<string>();
  const uniqueServices = services
    .filter((s) => s.active)
    .filter((s) => {
      const key = s.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, isPremium ? 6 : 3);

  return (
    <section className="py-16 sm:py-24">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-14">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-balance mb-4">
            Nos Services
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground">
            Des soins de médecine générale complets, adaptés à chaque patient.
          </p>
        </div>

        <div
          className={cn(
            "grid gap-5 sm:gap-6",
            isPremium ? "sm:grid-cols-2 lg:grid-cols-3 max-w-6xl" : "md:grid-cols-3 max-w-5xl",
            "mx-auto",
          )}
        >
          {uniqueServices.length > 0 ? (
            uniqueServices.map((service) => {
              const Icon = serviceIcon(service.name, service.category ?? undefined);
              return (
                <div
                  key={service.id}
                  className={cn(
                    "group rounded-2xl bg-card p-6 sm:p-8 text-start transition-all duration-300 hover:-translate-y-1",
                    isPremium && "hover:shadow-xl",
                    publicCardClass(cardStyle),
                  )}
                >
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{service.name}</h3>
                  {service.description ? (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                      {service.description}
                    </p>
                  ) : null}
                  <Link
                    href={`/services`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    En savoir plus
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              );
            })
          ) : (
            <p className="col-span-full text-center text-muted-foreground">
              Aucun service disponible pour le moment.
            </p>
          )}
        </div>
        <div className="mt-10 sm:mt-12 text-center">
          <Link href="/services" className={`${linkBtnOutline} w-full sm:w-auto`}>
            Voir tous les services
            <ArrowRight className="ms-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
