import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, Droplet, Syringe, MessageCircle, Cross, Scale, Truck, Pill } from "lucide-react";
import { getPublicPharmacyServices } from "@/lib/data/public";

export const metadata: Metadata = {
  title: "Services Pharmaceutiques",
  description:
    "Découvrez nos services pharmaceutiques : injections, prise de tension, livraison à domicile, conseil médical et plus.",
  openGraph: {
    title: "Services Pharmaceutiques",
    description: "Découvrez nos services pharmaceutiques professionnels.",
  },
};

const iconMap: Record<string, React.ReactNode> = {
  Heart: <Heart className="h-8 w-8" />,
  Droplet: <Droplet className="h-8 w-8" />,
  Syringe: <Syringe className="h-8 w-8" />,
  MessageCircle: <MessageCircle className="h-8 w-8" />,
  Cross: <Cross className="h-8 w-8" />,
  Scale: <Scale className="h-8 w-8" />,
  Truck: <Truck className="h-8 w-8" />,
};

export default async function PharmacyServicesPage() {
  const pharmacyServices = await getPublicPharmacyServices();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Our Services</h1>
      <p className="text-muted-foreground mb-8 max-w-2xl">
        Beyond medications, we offer a range of professional healthcare services.
        No appointment needed for most services.
      </p>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {pharmacyServices.map((service) => (
          <Card key={service.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  {iconMap[service.icon] || <Pill className="h-8 w-8" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-lg">{service.name}</h3>
                    {service.available ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-600 text-xs">
                        Available
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Unavailable</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{service.description}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-emerald-600">
                      {service.price === 0 ? "Free" : `${service.price} ${service.currency}`}
                    </span>
                    {service.duration > 0 && (
                      <span className="text-muted-foreground">~{service.duration} min</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Section */}
      <div className="mt-12 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-8">
        <h2 className="text-xl font-bold mb-4">Important Information</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="font-semibold mb-2">Injections & Vaccinations</h3>
            <p className="text-sm text-muted-foreground">
              Please bring your prescription from a licensed doctor. We administer
              intramuscular (IM) and subcutaneous (SC) injections only. IV injections
              must be done at a clinic.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Blood Pressure Checks</h3>
            <p className="text-sm text-muted-foreground">
              Our pharmacists can measure your blood pressure using calibrated
              digital monitors. For accurate readings, please rest for 5 minutes
              before measurement.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Home Delivery</h3>
            <p className="text-sm text-muted-foreground">
              We offer medication delivery within Casablanca city limits. Delivery
              is available Monday to Saturday. A small delivery fee applies.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Medication Counseling</h3>
            <p className="text-sm text-muted-foreground">
              Our qualified pharmacists are available to discuss your medications,
              potential interactions, and proper usage. This service is always free.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
