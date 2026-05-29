import { Skeleton } from "@/components/ui/skeleton";

export default function BrandingLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-32 mb-6" />
      <div className="space-y-6">
        <div className="rounded-xl border p-6 space-y-4">
          <Skeleton className="h-5 w-24" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="rounded-xl border p-6 space-y-4">
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
