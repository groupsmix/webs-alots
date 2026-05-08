import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      {/* Stats cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-4 space-y-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
      {/* Table skeleton */}
      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={`h-${i}`} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, rowIdx) => (
          <div key={`r-${rowIdx}`} className="flex gap-4">
            {Array.from({ length: 4 }).map((_, colIdx) => (
              <Skeleton key={`c-${rowIdx}-${colIdx}`} className="h-8 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
