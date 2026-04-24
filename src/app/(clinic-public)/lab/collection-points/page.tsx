import {
  MapPin, Phone, Clock, Car, Accessibility,
  FlaskConical,
} from "lucide-react";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getPublicCollectionPoints } from "@/lib/data/lab-public";

export const metadata: Metadata = {
  title: "Points de Prélèvement — Laboratoire",
  description: "Trouvez le point de prélèvement le plus proche avec nos horaires d'ouverture et informations d'accès.",
};

const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default async function CollectionPointsPage() {
  const points = await getPublicCollectionPoints();

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">Sample Collection Points</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Find the nearest collection point and check opening hours. All our points are staffed by trained phlebotomists.
        </p>
      </div>

      {points.length === 0 ? (
        <div className="text-center py-16">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">No collection points listed</p>
          <p className="text-muted-foreground">Please contact us directly for sample collection information.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {points.map((point) => (
            <Card key={point.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center shrink-0">
                      <FlaskConical className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{point.name}</h3>
                      {point.isMainLab && (
                        <Badge className="bg-blue-100 text-blue-700 border-0 text-xs mt-1">
                          Main Laboratory
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {point.hasParking && (
                      <Badge variant="outline" className="text-xs">
                        <Car className="h-3 w-3 mr-1" /> Parking
                      </Badge>
                    )}
                    {point.wheelchairAccessible && (
                      <Badge variant="outline" className="text-xs">
                        <Accessibility className="h-3 w-3 mr-1" /> Accessible
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <span>{point.address}{point.city ? `, ${point.city}` : ""}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{point.phone}</span>
                  </div>
                </div>

                {/* Hours Table */}
                {point.hours.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                      <Clock className="h-4 w-4 text-blue-600" />
                      Opening Hours
                    </h4>
                    <div className="grid grid-cols-2 gap-1">
                      {point.hours.map((h, idx) => (
                        <div key={idx} className="flex justify-between text-sm py-1 px-2 rounded bg-muted/50">
                          <span className="text-muted-foreground">{h.day ?? dayNames[idx]}</span>
                          <span className="font-medium">
                            {h.open === "closed" || !h.open ? "Closed" : `${h.open} - ${h.close}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
