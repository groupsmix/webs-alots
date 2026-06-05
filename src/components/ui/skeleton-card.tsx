import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SkeletonCardProps {
  count?: number;
  className?: string;
}

/**
 * Grid of skeleton card placeholders while async RSC data loads.
 * Use as the fallback inside a <Suspense> boundary or a loading.tsx file.
 */
export function SkeletonCard({ count = 3, className }: SkeletonCardProps) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-3 gap-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border p-4 space-y-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}
