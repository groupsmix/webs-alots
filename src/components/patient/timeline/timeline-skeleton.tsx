"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface TimelineSkeletonProps {
  count?: number;
  className?: string;
}

export function TimelineSkeleton({ count = 6, className }: TimelineSkeletonProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {/* Filter skeleton */}
      <div className="flex items-center gap-2 mb-6">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={`filter-${i}`} className="h-7 w-20 rounded-full" />
        ))}
      </div>

      {/* Timeline event skeletons */}
      {Array.from({ length: count }).map((_, i) => (
        <div key={`event-${i}`} className="flex gap-4">
          <div className="flex flex-col items-center">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="w-px flex-1 bg-border" />
          </div>
          <div className="flex-1 mb-4 rounded-xl border p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
