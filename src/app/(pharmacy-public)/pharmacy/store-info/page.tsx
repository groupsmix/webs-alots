import type { Metadata } from "next";
import {
  Clock, MapPin, Phone, Mail, Truck, Store,
  ShieldCheck, CreditCard,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPublicBranding, isPublicCurrentlyOnDuty, getPublicNextOnDuty } from "@/lib/data/public";

export const metadata: Metadata = {
  title: "Pharmacy Info — Hours, Location & Delivery",
  description:
    "Find our pharmacy hours, location, and delivery options. We offer home delivery and prescription pickup services.",
};

export default async function StoreInfoPage() {
  const [branding, onDuty, nextDuty] = await Promise.all([
    getPublicBranding(),
    isPublicCurrentlyOnDuty(),
    getPublicNextOnDuty(),
  ]);

  const workingHours = [
    { day: "Monday", hours: "08:30 - 20:00" },
    { day: "Tuesday", hours: "08:30 - 20:00" },
    { day: "Wednesday", hours: "08:30 - 20:00" },
    { day: "Thursday", hours: "08:30 - 20:00" },
    { day: "Friday", hours: "08:30 - 20:00" },
    { day: "Saturday", hours: "09:00 - 18:00" },
    { day: "Sunday", hours: "Closed" },
  ];

  const deliveryOptions = [
    {
      icon: Store,
      title: "In-Store Pickup",
      description: "Order online and pick up at our pharmacy. Ready in 30 minutes.",
      badge: "Free",
    },
    {
      icon: Truck,
      title: "Home Delivery",
      description: "We deliver to your doorstep within the city. Same-day delivery available.",
      badge: "From 20 MAD",
    },
    {
      icon: ShieldCheck,
      title: "Prescription Delivery",
      description: "Upload your prescription and we'll prepare your medications for delivery.",
      badge: "Available",
    },
  ];

  const currentDay = new Date().toLocaleDateString("en-US", { weekday: "long" });

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">Pharmacy Information</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          {branding.clinicName} — Your trusted neighborhood pharmacy
        </p>
        {onDuty && (
          <Badge className="mt-4 bg-emerald-600 text-white animate-pulse">
            <Clock className="h-3 w-3 mr-1" /> On Duty Now
          </Badge>
        )}
        {!onDuty && nextDuty && (
          <Badge variant="outline" className="mt-4 border-emerald-600 text-emerald-600">
            <Clock className="h-3 w-3 mr-1" /> Next on duty: {nextDuty.date}
          </Badge>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-2 max-w-5xl mx-auto">
        {/* Contact & Location */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-emerald-600" />
              Contact & Location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {branding.address && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="font-medium">Address</p>
                  <p className="text-sm text-muted-foreground">{branding.address}</p>
                </div>
              </div>
            )}
            {branding.phone && (
              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="font-medium">Phone</p>
                  <p className="text-sm text-muted-foreground">{branding.phone}</p>
                </div>
              </div>
            )}
            {branding.email && (
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{branding.email}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <CreditCard className="h-4 w-4 mt-1 text-muted-foreground" />
              <div>
                <p className="font-medium">Payment Methods</p>
                <p className="text-sm text-muted-foreground">Cash, Credit/Debit Cards, Mobile Payment</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Working Hours */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-emerald-600" />
              Working Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {workingHours.map((wh) => (
                <div
                  key={wh.day}
                  className={`flex items-center justify-between py-2 px-3 rounded-lg text-sm ${
                    wh.day === currentDay
                      ? "bg-emerald-50 dark:bg-emerald-950/20 font-medium"
                      : ""
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {wh.day === currentDay && (
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    )}
                    {wh.day}
                  </span>
                  <span className={wh.hours === "Closed" ? "text-red-500" : "text-muted-foreground"}>
                    {wh.hours}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delivery Options */}
      <div className="mt-12 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 text-center">Delivery Options</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {deliveryOptions.map((option) => (
            <Card key={option.title} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center flex-shrink-0">
                    <option.icon className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{option.title}</h3>
                    <Badge variant="secondary" className="text-xs mt-1">
                      {option.badge}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{option.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Map placeholder */}
      <div className="mt-12 max-w-5xl mx-auto">
        <Card>
          <CardContent className="pt-6">
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">Location Map</p>
                <p className="text-xs">Configure via Website Editor</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
