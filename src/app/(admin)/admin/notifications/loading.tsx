import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-40 mb-6" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-4 flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
