import type { Metadata } from "next";
import { Star } from "lucide-react";
import { getPublicReviews, getPublicAverageRating } from "@/lib/data/public";
import { defaultWebsiteConfig } from "@/lib/website-config";
import { safeJsonLdStringify } from "@/lib/json-ld";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const metadata: Metadata = {
  title: "Avis Patients",
  description:
    "Lisez les avis et témoignages de nos patients. Découvrez pourquoi ils nous font confiance pour leurs soins médicaux.",
  openGraph: {
    title: "Avis Patients",
    description: "Lisez les avis et témoignages de nos patients.",
  },
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={`h-4 w-4 ${
            i < rating
              ? "fill-yellow-400 text-yellow-400"
              : "fill-muted text-muted"
          }`}
        />
      ))}
    </div>
  );
}

export default async function ReviewsPage() {
  const cfg = defaultWebsiteConfig.reviews;

  const reviews = await getPublicReviews();
  const avgRating = await getPublicAverageRating();

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";

  const reviewsSchema = {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    url: `${baseUrl}/reviews`,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: avgRating,
      reviewCount: reviews.length,
      bestRating: 5,
      worstRating: 1,
    },
    review: reviews.slice(0, 10).map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.patientName },
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
      reviewBody: r.comment,
      datePublished: r.date,
    })),
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        // SAFETY: safeJsonLdStringify escapes "<" to prevent </script> injection
        // from database-sourced fields (patientName, comment, date).
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(reviewsSchema) }}
      />
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">{cfg.title}</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
          {cfg.subtitle}
        </p>
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-4xl font-bold">{avgRating}</span>
          <div>
            <StarRating rating={Math.round(avgRating)} />
            <p className="text-sm text-muted-foreground mt-1">
              Basé sur {reviews.length} {reviews.length <= 1 ? "avis" : "avis"}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto space-y-4">
        {reviews.map((review) => (
          <Card key={review.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="text-sm bg-primary/10 text-primary">
                    {review.patientName.split(" ").map((n) => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium text-sm">{review.patientName}</p>
                  <div className="flex items-center gap-2">
                    <StarRating rating={review.rating} />
                    <span className="text-xs text-muted-foreground">
                      {review.date}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{review.comment}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
