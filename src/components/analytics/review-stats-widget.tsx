"use client";

import { Star, TrendingUp, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  positiveReviews: number;
  negativeReviews: number;
  googleReviewsSent: number;
  recentRatings: { month: string; average: number; count: number }[];
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i < Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );
}

export function ReviewStatsWidget({ stats }: { stats: ReviewStats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="h-4 w-4" />
          Patient Feedback Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Average Rating */}
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <p className="text-3xl font-bold text-yellow-700">
              {stats.averageRating.toFixed(1)}
            </p>
            <StarDisplay rating={stats.averageRating} />
            <p className="text-xs text-muted-foreground mt-1">
              Average Rating
            </p>
          </div>

          {/* Total Reviews */}
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-3xl font-bold text-blue-700">
              {stats.totalReviews}
            </p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
              <p className="text-xs text-muted-foreground">Total Reviews</p>
            </div>
          </div>

          {/* Positive vs Negative */}
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-3xl font-bold text-green-700">
              {stats.positiveReviews}
            </p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendingUp className="h-3.5 w-3.5 text-green-600" />
              <p className="text-xs text-muted-foreground">
                Positive (4-5 stars)
              </p>
            </div>
          </div>

          {/* Google Reviews Sent */}
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <p className="text-3xl font-bold text-purple-700">
              {stats.googleReviewsSent}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Google Review Links Sent
            </p>
          </div>
        </div>

        {/* Rating Distribution Bar */}
        {stats.totalReviews > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <Badge variant="outline" className="text-green-600 border-green-200">
              {Math.round((stats.positiveReviews / stats.totalReviews) * 100)}% positive
            </Badge>
            <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-green-500 h-full rounded-full"
                style={{
                  width: `${(stats.positiveReviews / stats.totalReviews) * 100}%`,
                }}
              />
            </div>
            <Badge variant="outline" className="text-red-600 border-red-200">
              {stats.negativeReviews} negative
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
