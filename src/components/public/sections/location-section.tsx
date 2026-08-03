import { MapPin, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { defaultWebsiteConfig } from "@/lib/website-config";
import type { WebsiteConfig } from "@/lib/website-config";

interface LocationSectionProps {
  address?: string | null;
  websiteConfig?: Record<string, unknown> | null;
}

export function LocationSection({ address, websiteConfig }: LocationSectionProps) {
  const override = (websiteConfig?.location ?? {}) as Partial<WebsiteConfig["location"]>;
  const loc = {
    ...defaultWebsiteConfig.location,
    ...override,
  };
  // Prefer the clinic's real address from branding; otherwise keep website-config override.
  if (address) {
    loc.address = address;
  }

  // Avoid duplicated city if the address string already contains it.
  const displayAddressParts = [loc.address];
  if (loc.city && !loc.address.toLowerCase().includes(loc.city.toLowerCase())) {
    displayAddressParts.push(loc.city);
  }
  const displayAddress = displayAddressParts.filter(Boolean).join(", ");

  return (
    <section className="py-12 sm:py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <h2 className="text-center text-2xl sm:text-3xl font-bold text-balance mb-4">
          {loc.title}
        </h2>
        <p className="text-center text-muted-foreground mb-6 sm:mb-8 max-w-xl mx-auto">
          {loc.subtitle}
        </p>
        <div className="grid gap-6 sm:gap-8 lg:grid-cols-2 max-w-4xl mx-auto">
          {/* Map */}
          <Card>
            <CardContent className="pt-6">
              {loc.googleMapsEmbedUrl ? (
                <iframe
                  src={loc.googleMapsEmbedUrl}
                  width="100%"
                  height="300"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="rounded-lg border-0 min-h-[220px]"
                  title="Localisation du cabinet"
                />
              ) : (
                <div className="min-h-[220px] h-[300px] rounded-lg bg-muted flex items-center justify-center">
                  <MapPin className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex items-start gap-2 mt-4">
                <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm">{displayAddress}</p>
              </div>
            </CardContent>
          </Card>

          {/* Working Hours */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Horaires d&apos;ouverture</h3>
              </div>
              <div className="space-y-3">
                {loc.workingHours.map((wh) => (
                  <div key={wh.day} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{wh.day}</span>
                    <span
                      className={
                        wh.hours === "Fermé" ? "text-destructive" : "text-muted-foreground"
                      }
                    >
                      {wh.hours}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
