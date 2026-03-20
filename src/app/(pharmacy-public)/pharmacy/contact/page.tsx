import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, Mail, MapPin, Clock, MessageCircle } from "lucide-react";
import { onDutySchedule } from "@/lib/pharmacy-demo-data";

export const metadata: Metadata = {
  title: "Contact Pharmacie",
  description:
    "Contactez notre pharmacie : téléphone, WhatsApp, email. Horaires d'ouverture, adresse et planning de garde.",
  openGraph: {
    title: "Contact Pharmacie",
    description: "Contactez notre pharmacie. Horaires et planning de garde.",
  },
};

export default function PharmacyContactPage() {
  const upcomingDuties = onDutySchedule.filter((d) => d.isOnDuty);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Contact & Location</h1>
      <p className="text-muted-foreground mb-8">
        Find us easily or reach out through any of our contact channels
      </p>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Contact Info */}
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Phone</h3>
                    <p className="text-muted-foreground">+212 5 22 30 40 50</p>
                    <p className="text-xs text-muted-foreground mt-1">Mon-Fri 08:30-20:00, Sat 09:00-18:00</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">WhatsApp</h3>
                    <p className="text-muted-foreground">+212 6 12 34 56 78</p>
                    <a
                      href="https://wa.me/212612345678?text=Hello%2C%20I%20need%20help%20with%20my%20prescription"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-emerald-600 hover:underline"
                    >
                      Send WhatsApp Message
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Email</h3>
                    <p className="text-muted-foreground">contact@pharmacie-centrale.ma</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Address</h3>
                    <p className="text-muted-foreground">123 Bd Mohammed V</p>
                    <p className="text-muted-foreground">Casablanca, Morocco</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Working Hours */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-emerald-600" />
                <h3 className="font-semibold">Working Hours</h3>
              </div>
              <div className="space-y-2">
                {[
                  { day: "Monday", hours: "08:30 - 20:00" },
                  { day: "Tuesday", hours: "08:30 - 20:00" },
                  { day: "Wednesday", hours: "08:30 - 20:00" },
                  { day: "Thursday", hours: "08:30 - 20:00" },
                  { day: "Friday", hours: "08:30 - 20:00" },
                  { day: "Saturday", hours: "09:00 - 18:00" },
                  { day: "Sunday", hours: "Closed" },
                ].map((wh) => (
                  <div key={wh.day} className="flex justify-between text-sm">
                    <span className="font-medium">{wh.day}</span>
                    <span className={wh.hours === "Closed" ? "text-red-500" : "text-muted-foreground"}>
                      {wh.hours}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* On-Duty Schedule */}
          {upcomingDuties.length > 0 && (
            <Card className="border-emerald-200 dark:border-emerald-800">
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-4 text-emerald-600">
                  On-Duty Schedule (Pharmacie de Garde)
                </h3>
                <div className="space-y-3">
                  {upcomingDuties.map((duty) => (
                    <div
                      key={duty.id}
                      className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{duty.date}</p>
                        {duty.notes && (
                          <p className="text-xs text-muted-foreground">{duty.notes}</p>
                        )}
                      </div>
                      <span className="text-sm text-emerald-600 font-medium">
                        {duty.startTime} - {duty.endTime}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Map */}
        <div>
          <Card className="overflow-hidden h-full min-h-[400px]">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3323.846!2d-7.6192!3d33.5731!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzPCsDM0JzIzLjIiTiA3wrAzNycwOS4xIlc!5e0!3m2!1sen!2sma!4v1"
              width="100%"
              height="100%"
              style={{ border: 0, minHeight: "500px" }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Pharmacy Location"
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
