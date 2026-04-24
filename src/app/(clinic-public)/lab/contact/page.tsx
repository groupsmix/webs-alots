import { Phone, Mail, MapPin, Clock } from "lucide-react";
import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Contact — Laboratoire",
  description: "Contactez notre laboratoire pour toute question concernant vos analyses ou résultats.",
};

export default function LabContactPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">Contact Us</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Have questions about your tests, results, or sample collection? We&apos;re here to help.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center shrink-0">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Phone</h3>
                  <p className="text-sm text-muted-foreground">+212 5 22 40 50 60</p>
                  <p className="text-xs text-muted-foreground mt-1">Available during business hours</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center shrink-0">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Email</h3>
                  <p className="text-sm text-muted-foreground">contact@labo-central.ma</p>
                  <p className="text-xs text-muted-foreground mt-1">We respond within 24 hours</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center shrink-0">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Address</h3>
                  <p className="text-sm text-muted-foreground">123 Bd Mohammed V</p>
                  <p className="text-sm text-muted-foreground">Casablanca, Morocco</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              Opening Hours
            </h3>
            <div className="space-y-2">
              {[
                { day: "Monday - Friday", hours: "07:00 - 18:00" },
                { day: "Saturday", hours: "07:00 - 13:00" },
                { day: "Sunday", hours: "Closed" },
              ].map((item) => (
                <div key={item.day} className="flex justify-between text-sm py-2 border-b last:border-0">
                  <span className="text-muted-foreground">{item.day}</span>
                  <span className="font-medium">{item.hours}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-1">
                Home Collection Service
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-300">
                We offer home sample collection for patients who cannot visit our collection points.
                Call us to schedule an appointment.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
