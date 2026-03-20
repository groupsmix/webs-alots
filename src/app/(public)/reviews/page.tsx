import type { Metadata } from "next";
import { Star } from "lucide-react";
import { getPublicReviews, getPublicAverageRating } from "@/lib/data/public";
import { defaultWebsiteConfig } from "@/lib/website-config";
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
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
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

  return (
    <div className="container mx-auto px-4 py-12">
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
              Based on {reviews.length} reviews
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
