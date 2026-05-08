import { Skeleton } from "@/components/ui/skeleton";

export default function PublicLoading() {
  return (
    <div className="min-h-screen">
      {/* Hero section skeleton */}
      <section className="relative py-20 lg:py-28">
        <div className="container mx-auto px-4 text-center space-y-6">
          <Skeleton className="h-12 w-3/4 mx-auto rounded-lg" />
          <Skeleton className="h-6 w-1/2 mx-auto" />
          <div className="flex items-center justify-center gap-4 pt-4">
            <Skeleton className="h-12 w-44 rounded-lg" />
            <Skeleton className="h-12 w-36 rounded-lg" />
          </div>
        </div>
      </section>

      {/* Services section skeleton */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 space-y-3">
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-5 w-72 mx-auto" />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border p-6 space-y-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-9 w-28 rounded-lg mt-2" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews section skeleton */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 space-y-3">
            <Skeleton className="h-8 w-64 mx-auto" />
            <div className="flex items-center justify-center gap-2">
              <Skeleton className="h-8 w-12" />
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-5 rounded-sm" />
                ))}
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border p-6 space-y-4">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Skeleton key={j} className="h-4 w-4 rounded-sm" />
                  ))}
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-24 mt-2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
