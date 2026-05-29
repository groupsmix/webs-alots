import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function BedsLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-10 w-36" />
      </div>
      <TableSkeleton rows={6} columns={4} />
    </div>
  );
}
