import { CardSkeleton, TableSkeleton } from "@/components/ui/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <CardSkeleton count={3} />
      <div className="rounded-xl border p-4">
        <TableSkeleton rows={6} columns={4} />
      </div>
    </div>
  );
}
