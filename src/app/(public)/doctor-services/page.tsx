import { Clock, CreditCard, Calendar, Stethoscope } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicServices, getPublicBranding } from "@/lib/data/public";

export const metadata: Metadata = {
  title: "Nos Services Médicaux",
  description:
    "Découvrez nos services médicaux avec descriptions détaillées et tarifs. Consultations, examens, soins spécialisés.",
  openGraph: {
    title: "Nos Services Médicaux",
    description: "Découvrez nos services médicaux avec descriptions détaillées et tarifs.",
  },
};

export default async function DoctorServicesPage() {
  const [services, branding] = await Promise.all([
    getPublicServices(),
    getPublicBranding(),
  ]);

  const activeServices = services.filter((s) => s.active);

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">Our Medical Services</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Comprehensive healthcare services at {branding.clinicName}. Each consultation includes
          a thorough examination and personalized treatment plan.
        </p>
      </div>

      {activeServices.length === 0 ? (
        <p className="text-center text-muted-foreground">No services available yet.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {activeServices.map((service) => (
            <Card key={service.id} className="flex flex-col hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Stethoscope className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{service.name}</CardTitle>
                  </div>
                </div>
                {service.description && (
                  <CardDescription className="line-clamp-3">
                    {service.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-1">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {service.duration > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {service.duration} min
                    </span>
                  )}
                  {service.price > 0 && (
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      <CreditCard className="h-4 w-4" />
                      {service.price} {service.currency}
                    </span>
                  )}
                </div>
                {service.category && (
                  <Badge variant="outline" className="mt-3 text-xs capitalize">
                    {service.category}
                  </Badge>
                )}
              </CardContent>
              <CardFooter>
                <Link
                  href="/book"
                  className={buttonVariants({ variant: "outline", size: "sm", className: "w-full" })}
                >
                  <Calendar className="h-4 w-4 mr-1" />
                  Book Now
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
