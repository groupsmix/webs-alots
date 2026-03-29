import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  Smile, Phone, Clock, MapPin, ArrowRight, Star,
  Shield, CalendarCheck, AlertTriangle,
} from "lucide-react";
import {
  getPublicServices,
  getPublicBranding,
  getPublicReviews,
  getPublicAverageRating,
} from "@/lib/data/public";

export const metadata: Metadata = {
  title: "Cabinet Dentaire — Accueil",
  description:
    "Votre cabinet dentaire de confiance. Soins dentaires, implantologie, orthodontie, esthétique dentaire et urgences.",
  openGraph: {
    title: "Cabinet Dentaire — Accueil",
    description: "Votre cabinet dentaire de confiance. Soins et urgences dentaires.",
  },
};

const linkBtnPrimary =
  "inline-flex items-center justify-center rounded-lg bg-sky-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-sky-700 transition-colors";
const linkBtnOutline =
  "inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted hover:text-foreground transition-colors";

export default async function DentistHomePage() {
  const [services, branding, reviews, avgRating] = await Promise.all([
    getPublicServices(),
    getPublicBranding(),
    getPublicReviews(),
    getPublicAverageRating(),
  ]);

  const activeServices = services.filter((s) => s.active).slice(0, 6);
  const topReviews = reviews.filter((r) => r.rating >= 4).slice(0, 3);

  return (
    <>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-950/20 dark:to-sky-900/10 py-20">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
                Your Smile, <span className="text-sky-600">Our Expertise</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-8 max-w-lg">
                Comprehensive dental care with a gentle touch. From routine cleanings
                to advanced cosmetic dentistry, we create beautiful, healthy smiles.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/book" className={linkBtnPrimary}>
                  <CalendarCheck className="mr-2 h-4 w-4" />
                  Book Appointment
                </Link>
                <Link href="/dentist/services" className={linkBtnOutline}>
                  <Smile className="mr-2 h-4 w-4" />
                  Our Services
                </Link>
              </div>
            </div>
            <div className="hidden lg:flex justify-center">
              <div className="relative">
                <div className="h-72 w-72 rounded-full bg-sky-200/50 dark:bg-sky-800/20 flex items-center justify-center">
                  <Smile className="h-32 w-32 text-sky-600/30" />
                </div>
                <div className="absolute -top-4 -right-4 bg-white dark:bg-card rounded-xl shadow-lg p-4">
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    <div>
                      <p className="text-sm font-semibold">{avgRating.toFixed(1)}/5</p>
                      <p className="text-xs text-muted-foreground">Rating</p>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-4 -left-4 bg-white dark:bg-card rounded-xl shadow-lg p-4">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-sky-600" />
                    <div>
                      <p className="text-sm font-semibold">15+ yrs</p>
                      <p className="text-xs text-muted-foreground">Experience</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Preview */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold">Dental Services</h2>
            <Link href="/dentist/services" className={linkBtnOutline}>
              All Services <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {activeServices.map((service) => (
              <Card key={service.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="h-10 w-10 rounded-lg bg-sky-100 dark:bg-sky-900/30 text-sky-600 flex items-center justify-center mb-4">
                    <Smile className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold mb-2">{service.name}</h3>
                  {service.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {service.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    {service.price > 0 && (
                      <span className="font-semibold text-sky-600">
                        {service.price} {service.currency}
                      </span>
                    )}
                    {service.duration > 0 && (
                      <span className="text-muted-foreground">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {service.duration} min
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Before/After CTA */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">See Our Results</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Browse our before &amp; after gallery to see real transformations from our dental treatments.
          </p>
          <Link href="/dentist/gallery" className={linkBtnPrimary}>
            View Gallery <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Reviews Preview */}
      {topReviews.length > 0 && (
        <section className="py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-8">Patient Reviews</h2>
            <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
              {topReviews.map((review) => (
                <Card key={review.id}>
                  <CardContent className="pt-6">
                    <div className="flex gap-0.5 mb-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < review.rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "fill-muted text-muted"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      &ldquo;{review.comment}&rdquo;
                    </p>
                    <p className="text-sm font-medium">{review.patientName}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Emergency Contact */}
      <section className="py-16 bg-red-50 dark:bg-red-950/10">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <h2 className="text-2xl font-bold text-red-700 dark:text-red-400">Dental Emergency?</h2>
          </div>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
            For urgent dental issues such as severe pain, broken teeth, or swelling,
            contact us immediately. We prioritize emergency appointments.
          </p>
          <div className="flex justify-center gap-3">
            {branding.phone && (
              <a
                href={`tel:${branding.phone}`}
                className="inline-flex items-center justify-center rounded-lg bg-red-600 text-white px-6 py-2.5 text-sm font-medium hover:bg-red-700 transition-colors"
              >
                <Phone className="mr-2 h-4 w-4" />
                Call Now: {branding.phone}
              </a>
            )}
            <Link
              href="/book"
              className="inline-flex items-center justify-center rounded-lg border border-red-300 text-red-600 px-4 py-2 text-sm font-medium hover:bg-red-50 transition-colors"
            >
              <MapPin className="mr-2 h-4 w-4" />
              Find Us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
