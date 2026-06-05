import { SkeletonTable } from "@/components/ui/skeleton-table";

export default function KycLoading() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="h-8 w-40 bg-muted animate-pulse rounded" />
      <SkeletonTable rows={5} cols={5} />
    </div>
  );
}
