import { MapPin, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { defaultWebsiteConfig } from "@/lib/website-config";

export function LocationSection() {
  const loc = defaultWebsiteConfig.location;

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <h2 className="text-center text-3xl font-bold mb-4">
          Location &amp; Hours
        </h2>
        <p className="text-center text-muted-foreground mb-8 max-w-xl mx-auto">
          {loc.subtitle}
        </p>
        <div className="grid gap-8 lg:grid-cols-2 max-w-4xl mx-auto">
          {/* Map */}
          <Card>
            <CardContent className="pt-6">
              {loc.googleMapsEmbedUrl ? (
                <iframe
                  src={loc.googleMapsEmbedUrl}
                  width="100%"
                  height="300"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="rounded-lg"
                  title="Clinic Location"
                />
              ) : (
                <div className="h-[300px] rounded-lg bg-muted flex items-center justify-center">
                  <MapPin className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex items-start gap-2 mt-4">
                <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm">
                  {loc.address}, {loc.city}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Working Hours */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Working Hours</h3>
              </div>
              <div className="space-y-3">
                {loc.workingHours.map((wh) => (
                  <div
                    key={wh.day}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="font-medium">{wh.day}</span>
                    <span
                      className={
                        wh.hours === "Closed"
                          ? "text-destructive"
                          : "text-muted-foreground"
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
