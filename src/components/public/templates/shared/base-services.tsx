/* eslint-disable i18next/no-literal-string */
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { getPublicServices } from "@/lib/data/public";
import { publicCardClass } from "@/lib/public-theme";
import { cn } from "@/lib/utils";
import { defaultWebsiteConfig } from "@/lib/website-config";
import { getServiceIcon } from "./service-icon";

export interface BaseServicesProps {
  cardStyle?: "shadow" | "bordered" | "flat" | "elevated";
  maxItems?: number;
  gridClass?: string;
  containerClass?: string;
  itemClass?: string;
  iconContainerClass?: string;
  title?: string;
  subtitle?: string;
  showAllLink?: boolean;
}

const defaultItemClass =
  "group rounded-2xl bg-card p-6 sm:p-8 text-start transition-all duration-300 hover:-translate-y-1";

const defaultIconClass =
  "mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground";

const linkBtnOutline =
  "inline-flex items-center justify-center rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-medium hover:bg-muted hover:text-foreground transition-colors min-h-11";

export async function BaseServices({
  cardStyle = "shadow",
  maxItems = 3,
  gridClass = "max-w-5xl mx-auto",
  containerClass = "",
  itemClass = defaultItemClass,
  iconContainerClass = defaultIconClass,
  title = defaultWebsiteConfig.services.title,
  subtitle = defaultWebsiteConfig.services.subtitle,
  showAllLink = true,
}: BaseServicesProps) {
  const services = await getPublicServices();

  const seen = new Set<string>();
  const uniqueServices = services
    .filter((s) => s.active)
    .filter((s) => {
      const key = s.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxItems);

  return (
    <section className={cn("py-16 sm:py-24", containerClass)}>
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-14">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-balance mb-4">{title}</h2>
          <p className="text-base sm:text-lg text-muted-foreground">{subtitle}</p>
        </div>

        <div className={cn("grid gap-5 sm:gap-6 md:grid-cols-2 lg:grid-cols-3", gridClass)}>
          {uniqueServices.length > 0 ? (
            uniqueServices.map((service) => {
              const Icon = getServiceIcon(service.name, service.category ?? undefined);
              return (
                <div key={service.id} className={cn(publicCardClass(cardStyle), itemClass)}>
                  <div className={iconContainerClass}>
                    <Icon className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{service.name}</h3>
                  {service.description ? (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                      {service.description}
                    </p>
                  ) : null}
                  <Link
                    href="/services"
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
        {showAllLink && (
          <div className="mt-10 sm:mt-12 text-center">
            <Link href="/services" className={cn(linkBtnOutline, "w-full sm:w-auto")}>
              Voir tous les services
              <ArrowRight className="ms-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
