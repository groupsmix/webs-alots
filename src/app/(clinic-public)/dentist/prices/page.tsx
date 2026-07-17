import { CreditCard, Calendar, Info, CheckCircle } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicServices } from "@/lib/data/public";
import { t, type Locale } from "@/lib/i18n";
import { requireTenantWithConfig } from "@/lib/tenant";

export const metadata: Metadata = {
  title: "Grille tarifaire des soins",
  description:
    "Des tarifs transparents pour tous les soins dentaires : consultations, détartrages, implants, orthodontie et plus encore.",
};

export default async function DentistPricesPage() {
  const [services, { config: tenantConfig }, h] = await Promise.all([
    getPublicServices(),
    requireTenantWithConfig(),
    headers(),
  ]);
  const locale: Locale = (h.get("x-tenant-locale") as Locale) || "fr";
  const activeServices = services.filter((s) => s.active);

  // Group by category
  const grouped = new Map<string, typeof activeServices>();
  for (const service of activeServices) {
    const cat = service.category || "General";
    const list = grouped.get(cat) ?? [];
    list.push(service);
    grouped.set(cat, list);
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">{t(locale, "dentist.prices.heading")}</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          {t(locale, "dentist.prices.subtitle", { currency: tenantConfig.currency })}
        </p>
      </div>

      {activeServices.length === 0 ? (
        <p className="text-center text-muted-foreground">{t(locale, "dentist.prices.empty")}</p>
      ) : (
        <div className="max-w-3xl mx-auto space-y-8">
          {Array.from(grouped.entries()).map(([category, categoryServices]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-sky-600" />
                  {category}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {categoryServices.map((service) => (
                    <div
                      key={service.id}
                      className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{service.name}</p>
                        {service.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {service.description}
                          </p>
                        )}
                        {service.duration > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t(locale, "dentist.prices.duration", { duration: service.duration })}
                          </p>
                        )}
                      </div>
                      <div className="text-end ms-4">
                        {service.price > 0 ? (
                          <span className="font-bold text-sky-600">
                            {service.price} {service.currency}
                          </span>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            {t(locale, "dentist.prices.onConsultation")}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Payment Info */}
          <Card className="bg-sky-50/50 dark:bg-sky-950/10 border-sky-200 dark:border-sky-800">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Info className="h-5 w-5 text-sky-600" />
                {t(locale, "dentist.prices.paymentInfo")}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-sky-600 mt-0.5 flex-shrink-0" />
                  <span>{t(locale, "dentist.prices.payCash")}</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-sky-600 mt-0.5 flex-shrink-0" />
                  <span>{t(locale, "dentist.prices.payInstallments")}</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-sky-600 mt-0.5 flex-shrink-0" />
                  <span>{t(locale, "dentist.prices.payInsurance")}</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-sky-600 mt-0.5 flex-shrink-0" />
                  <span>{t(locale, "dentist.prices.payFirstFree")}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA */}
          <div className="text-center pt-4">
            <p className="text-muted-foreground mb-4">{t(locale, "dentist.prices.ctaText")}</p>
            <Link href="/book" className={buttonVariants({ size: "lg" })}>
              <Calendar className="h-4 w-4 me-2" />
              {t(locale, "dentist.prices.book")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
