import type { Metadata } from "next";
import { HeroSection } from "@/components/public/hero-section";
import { ServicesPreview } from "@/components/public/services-preview";
import { defaultWebsiteConfig } from "@/lib/website-config";
import { reviews, getAverageRating } from "@/lib/demo-data";
import { Star, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const metadata: Metadata = {
  title: "Accueil — Cabinet Médical",
  description:
    "Bienvenue dans notre cabinet médical. Prenez rendez-vous en ligne, consultez nos services et découvrez notre équipe médicale.",
  openGraph: {
    title: "Accueil — Cabinet Médical",
    description:
      "Bienvenue dans notre cabinet médical. Prenez rendez-vous en ligne, consultez nos services.",
  },
};

const linkBtnOutline =
  "inline-flex items-center justify-center rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-medium hover:bg-muted hover:text-foreground transition-colors";
const linkBtnPrimary =
  "inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/80 transition-colors";

export default function HomePage() {
  const aboutCfg = defaultWebsiteConfig.about;
  const avgRating = getAverageRating();
  const topReviews = reviews.filter((r) => r.rating >= 4).slice(0, 3);

  return (
    <>
      <HeroSection />
      <ServicesPreview />

      {/* About Doctor Preview */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="flex justify-center">
              {aboutCfg.photoUrl ? (
                <img
                  src={aboutCfg.photoUrl}
                  alt={aboutCfg.doctorName}
                  className="rounded-2xl shadow-lg max-h-80 object-cover"
                />
              ) : (
                <Avatar className="h-48 w-48">
                  <AvatarFallback className="text-5xl bg-primary/10 text-primary">
                    {aboutCfg.doctorName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
            <div>
              <h2 className="text-3xl font-bold mb-2">{aboutCfg.doctorName}</h2>
              <p className="text-lg text-primary font-medium mb-4">
                {aboutCfg.specialty}
              </p>
              <p className="text-muted-foreground mb-6">{aboutCfg.bio}</p>
              <Link
                href="/about"
                className={linkBtnOutline}
              >
                Learn More
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews Preview */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">What Our Patients Say</h2>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-bold">{avgRating}</span>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-5 w-5 ${
                      i < Math.round(avgRating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "fill-muted text-muted"
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                ({reviews.length} reviews)
              </span>
            </div>
          </div>
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
          <div className="mt-10 text-center">
            <Link
              href="/reviews"
              className={linkBtnOutline}
            >
              View All Reviews
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Book?</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Schedule your appointment online in just a few clicks. We look
            forward to providing you with excellent care.
          </p>
          <Link href="/book" className={linkBtnPrimary}>
            Book an Appointment
          </Link>
        </div>
      </section>
    </>
  );
}
