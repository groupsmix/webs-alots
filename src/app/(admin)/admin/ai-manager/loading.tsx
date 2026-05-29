import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function AiManagerLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-36 mb-6" />
      <CardSkeleton count={3} className="mb-6" />
      <div className="rounded-xl border p-6 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-28" />
      </div>
    </div>
  );
}
