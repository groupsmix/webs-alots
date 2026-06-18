import { Skeleton } from "@/components/ui/skeleton";
import { CardSkeleton } from "@/components/ui/loading-skeleton";

export default function Loading() {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <CardSkeleton count={3} />
    </div>
  );
}
