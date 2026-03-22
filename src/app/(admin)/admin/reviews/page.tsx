"use client";

import { useEffect, useState } from "react";
import { Star, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getCurrentUser, fetchReviews, type ReviewView } from "@/lib/data/client";
import { PageLoader } from "@/components/ui/page-loader";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

export default function ReviewManagementPage() {
  const [reviews, setReviews] = useState<ReviewView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const r = await fetchReviews(user.clinic_id);
    setReviews(r);
    setLoading(false);
  }
    load();
  }, []);

  if (loading) {
    return <PageLoader message="Loading reviews..." />;
  }

  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const ratingCounts = [5, 4, 3, 2, 1].map((r) => ({
    stars: r,
    count: reviews.filter((rv) => rv.rating === r).length,
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Review Management</h1>

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-4xl font-bold">{avgRating.toFixed(1)}</p>
            <StarRating rating={Math.round(avgRating)} />
            <p className="text-sm text-muted-foreground mt-1">{reviews.length} reviews</p>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <div className="space-y-2">
              {ratingCounts.map((rc) => (
                <div key={rc.stars} className="flex items-center gap-2">
                  <span className="text-sm w-12">{rc.stars} star</span>
                  <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-yellow-400 h-full rounded-full"
                      style={{ width: `${reviews.length > 0 ? (rc.count / reviews.length) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-6">{rc.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {reviews.map((review) => (
          <Card key={review.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Avatar>
                  <AvatarFallback className="text-xs">
                    {review.patientName.split(" ").map((n) => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="font-medium text-sm">{review.patientName}</p>
                      <StarRating rating={review.rating} />
                    </div>
                    <Badge variant="outline">{review.date}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{review.comment}</p>
                  <Button variant="outline" size="sm" className="mt-3">
                    <MessageSquare className="h-3.5 w-3.5 mr-1" />
                    Reply
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
