import { Star, Quote, Calendar } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getPublicReviews, getPublicAverageRating, getPublicBranding } from "@/lib/data/public";
import { t, type Locale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Témoignages Patients",
  description:
    "Découvrez les témoignages de nos patients satisfaits. Avis vérifiés sur la qualité de nos soins médicaux.",
  openGraph: {
    title: "Témoignages Patients",
    description: "Découvrez les témoignages de nos patients satisfaits.",
  },
};

function StarRating({ rating, locale }: { rating: number; locale: Locale }) {
  return (
    <div
      className="flex gap-0.5"
      role="img"
      aria-label={t(locale, "testimonials.starsAria", { rating })}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={`h-4 w-4 ${
            i < rating ? "fill-yellow-400 text-yellow-400" : "fill-muted text-muted"
          }`}
        />
      ))}
    </div>
  );
}

export default async function TestimonialsPage() {
  const h = await headers();
  const locale: Locale = (h.get("x-tenant-locale") as Locale) || "fr";
  const [reviews, avgRating, branding] = await Promise.all([
    getPublicReviews(),
    getPublicAverageRating(),
    getPublicBranding(),
  ]);

  const ratingDistribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews.filter((r) => r.rating === stars).length,
    percentage:
      reviews.length > 0
        ? Math.round((reviews.filter((r) => r.rating === stars).length / reviews.length) * 100)
        : 0,
  }));

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">{t(locale, "testimonials.heading")}</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
          {t(locale, "testimonials.subtitle", { clinic: branding.clinicName })}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="max-w-3xl mx-auto mb-12">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Average Rating */}
              <div className="text-center">
                <p className="text-5xl font-bold mb-2">{avgRating.toFixed(1)}</p>
                <StarRating rating={Math.round(avgRating)} locale={locale} />
                <p className="text-sm text-muted-foreground mt-2">
                  {t(
                    locale,
                    reviews.length === 1
                      ? "testimonials.verifiedReview"
                      : "testimonials.verifiedReviews",
                    { count: reviews.length },
                  )}
                </p>
              </div>

              {/* Distribution */}
              <div className="flex-1 space-y-2 w-full">
                {ratingDistribution.map((dist) => (
                  <div key={dist.stars} className="flex items-center gap-2 text-sm">
                    <span className="w-8 text-end">
                      {dist.stars}{" "}
                      <Star
                        aria-hidden="true"
                        className="h-3 w-3 inline fill-yellow-400 text-yellow-400"
                      />
                    </span>
                    <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-full bg-yellow-400 rounded-full transition-all"
                        data-width={Math.round(dist.percentage)}
                      />
                    </div>
                    <span className="w-12 text-muted-foreground">{dist.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Testimonials Grid */}
      {reviews.length === 0 ? (
        <p className="text-center text-muted-foreground">{t(locale, "testimonials.empty")}</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
          {reviews.map((review) => (
            <Card key={review.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="text-sm bg-primary/10 text-primary">
                      {review.patientName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{review.patientName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StarRating rating={review.rating} locale={locale} />
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {review.date}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Quote className="h-6 w-6 text-primary/20 absolute -top-1 -left-1" />
                  <p className="text-sm text-muted-foreground ps-4 italic">{review.comment}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* CTA */}
      <div className="text-center mt-12">
        <p className="text-muted-foreground mb-4">{t(locale, "testimonials.ctaText")}</p>
        <Link href="/book" className={buttonVariants({ size: "lg" })}>
          <Calendar className="h-4 w-4 me-2" />
          {t(locale, "testimonials.ctaButton")}
        </Link>
      </div>
    </div>
  );
}
