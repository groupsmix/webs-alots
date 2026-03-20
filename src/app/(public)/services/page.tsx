import { Clock, CreditCard } from "lucide-react";
import Link from "next/link";
import { getPublicServices } from "@/lib/data/public";
import { defaultWebsiteConfig } from "@/lib/website-config";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function ServicesPage() {
  const cfg = defaultWebsiteConfig.services;

  const services = await getPublicServices();

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">{cfg.title}</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          {cfg.subtitle}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {services
          .filter((s) => s.active)
          .map((service) => (
            <Card key={service.id}>
              <CardHeader>
                <CardTitle>{service.name}</CardTitle>
                <CardDescription>{service.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {service.duration} min
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <CreditCard className="h-4 w-4" />
                    {service.price} {service.currency}
                  </span>
                </div>
              </CardContent>
              <CardFooter>
                <Link
                  href="/book"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Book Now
                </Link>
              </CardFooter>
            </Card>
          ))}
      </div>
    </div>
  );
}
