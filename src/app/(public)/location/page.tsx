import type { Metadata } from "next";
import { MapPin, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultWebsiteConfig } from "@/lib/website-config";

export const metadata: Metadata = {
  title: "Localisation & Horaires",
  description:
    "Trouvez notre cabinet médical facilement. Adresse, carte Google Maps et horaires d'ouverture.",
  openGraph: {
    title: "Localisation & Horaires",
    description: "Trouvez notre cabinet médical facilement. Adresse et horaires.",
  },
};

export default function LocationPage() {
  const cfg = defaultWebsiteConfig.location;

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">{cfg.title}</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          {cfg.subtitle}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Our Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{cfg.address}</p>
              <p className="text-muted-foreground">{cfg.city}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Working Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {cfg.workingHours.map((wh) => (
                  <div key={wh.day} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{wh.day}</span>
                    <span className={`font-medium ${wh.hours === "Closed" ? "text-destructive" : ""}`}>
                      {wh.hours}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0 overflow-hidden rounded-xl">
            {cfg.googleMapsEmbedUrl ? (
              <iframe
                src={cfg.googleMapsEmbedUrl}
                width="100%"
                height="450"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Clinic Location"
              />
            ) : (
              <div className="h-[450px] bg-muted flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <MapPin className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Google Maps embed</p>
                  <p className="text-xs mt-1">Set the embed URL in Website Editor</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
