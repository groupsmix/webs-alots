import { Skeleton } from "@/components/ui/skeleton";

export default function PublicLoading() {
  return (
    <div className="min-h-[60vh] container mx-auto px-4 py-12 space-y-8">
      {/* Hero skeleton */}
      <div className="space-y-4 text-center">
        <Skeleton className="h-10 w-2/3 mx-auto" />
        <Skeleton className="h-5 w-1/2 mx-auto" />
        <Skeleton className="h-10 w-40 mx-auto rounded-lg" />
      </div>
      {/* Content cards skeleton */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mt-12">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-6 space-y-4">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
