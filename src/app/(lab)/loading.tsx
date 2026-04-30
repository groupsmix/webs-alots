import { Skeleton } from "@/components/ui/skeleton";

/**
 * Audit Finding #13: Loading state for lab route group.
 */
export default function LabLoading() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
