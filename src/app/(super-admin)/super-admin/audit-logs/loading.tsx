import { SkeletonTable } from "@/components/ui/skeleton-table";

export default function AuditLogsLoading() {
  return (
    <div className="space-y-4 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="h-8 w-48 bg-muted animate-pulse rounded" />
      <SkeletonTable rows={20} cols={4} />
    </div>
  );
}
