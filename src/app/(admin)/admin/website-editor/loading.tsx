import { Skeleton } from "@/components/ui/skeleton";

export default function WebsiteEditorLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-40 mb-6" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded" />
          ))}
        </div>
        <div className="lg:col-span-2 rounded-xl border p-4">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    </div>
  );
}
