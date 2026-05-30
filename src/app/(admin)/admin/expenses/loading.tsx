import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Streaming skeleton for expenses.
 * Rendered automatically by Next.js while the server segment loads,
 * so the user sees structure instantly instead of a blank screen.
 */
export default function ExpensesLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-56 mb-3" />
      <Skeleton className="h-4 w-80 mb-6" />
      <TableSkeleton rows={10} columns={5} />
    </div>
  );
}
