import type { Metadata } from "next";
import { CreditCard, Calendar, Info, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import Link from "next/link";
import { getPublicServices } from "@/lib/data/public";
import { clinicConfig } from "@/config/clinic.config";

export const metadata: Metadata = {
  title: "Treatment Price List",
  description:
    "Transparent pricing for all dental treatments. Consultations, cleanings, implants, orthodontics, and more.",
};

export default async function DentistPricesPage() {
  const services = await getPublicServices();
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
        <h1 className="text-3xl font-bold mb-4">Treatment Price List</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Transparent pricing for all our dental services. Prices are in {clinicConfig.currency}
          and may vary based on treatment complexity.
        </p>
      </div>

      {activeServices.length === 0 ? (
        <p className="text-center text-muted-foreground">No services listed yet.</p>
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
                            Duration: ~{service.duration} min
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        {service.price > 0 ? (
                          <span className="font-bold text-sky-600">
                            {service.price} {service.currency}
                          </span>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            On consultation
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
                Payment Information
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-sky-600 mt-0.5 flex-shrink-0" />
                  <span>Cash and card payments accepted</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-sky-600 mt-0.5 flex-shrink-0" />
                  <span>Installment plans available for major treatments</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-sky-600 mt-0.5 flex-shrink-0" />
                  <span>Insurance claims (CNSS, CNOPS) supported</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-sky-600 mt-0.5 flex-shrink-0" />
                  <span>Free initial consultation for complex cases</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA */}
          <div className="text-center pt-4">
            <p className="text-muted-foreground mb-4">
              Prices are indicative and may vary based on individual treatment plans.
              Book a consultation for an accurate estimate.
            </p>
            <Link href="/book" className={buttonVariants({ size: "lg" })}>
              <Calendar className="h-4 w-4 mr-2" />
              Book Consultation
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
