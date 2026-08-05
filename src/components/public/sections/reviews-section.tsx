import { Star, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { PublicReview } from "@/lib/data/public";
import { t, type Locale } from "@/lib/i18n";
import { publicCardClass } from "@/lib/public-theme";

interface ReviewsSectionProps {
  reviews: PublicReview[];
  avgRating: number;
  locale: Locale;
  cardStyle?: "shadow" | "bordered" | "flat" | "elevated";
}

const linkBtnOutline =
  "inline-flex items-center justify-center rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-medium hover:bg-muted hover:text-foreground transition-colors min-h-11";

export function ReviewsSection({
  reviews,
  avgRating,
  locale,
  cardStyle = "shadow",
}: ReviewsSectionProps) {
  const topReviews = reviews.slice(0, 6);

  return (
    <section className="py-12 sm:py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-balance mb-4">
            {t(locale, "public.reviews.heading")}
          </h2>
          <p className="text-sm text-muted-foreground mb-2">
            {t(locale, "public.reviews.subtitle")}
          </p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl sm:text-3xl font-bold">{avgRating}</span>
            <div className="flex gap-0.5" role="img" aria-label={`${avgRating} out of 5 stars`}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  aria-hidden="true"
                  className={`h-5 w-5 ${
                    i < Math.round(avgRating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "fill-muted text-muted"
                  }`}
                />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">
              {t(locale, "public.reviews.count", { count: reviews.length })}
            </span>
          </div>
        </div>
        {/* Rating distribution */}
        {reviews.length > 0 && (
          <div className="mx-auto mb-8 sm:mb-10 max-w-xs space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = reviews.filter((r) => r.rating === star).length;
              const pct = Math.round((count / reviews.length) * 100);
              return (
                <div key={star} className="flex items-center gap-2 text-sm">
                  <span className="w-6 text-end font-medium">
                    {star}
                    <span className="text-yellow-400">&#9733;</span>
                  </span>
                  <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-yellow-400 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-xs text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
          {topReviews.map((review) => (
            <Card key={review.id} className={publicCardClass(cardStyle)}>
              <CardContent className="pt-6">
                <div
                  className="flex gap-0.5 mb-3"
                  role="img"
                  aria-label={`${review.rating} out of 5 stars`}
                >
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      aria-hidden="true"
                      className={`h-4 w-4 ${
                        i < review.rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "fill-muted text-muted"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mb-4">&ldquo;{review.comment}&rdquo;</p>
                <p className="text-sm font-medium">{review.patientName}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-8 sm:mt-10 text-center">
          <Link href="/reviews" className={`${linkBtnOutline} w-full sm:w-auto`}>
            {t(locale, "public.reviews.viewAll")}
            <ArrowRight className="ms-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
