import { Skeleton } from "@/components/ui/skeleton";

/**
 * Audit Finding #13: Loading state for auth route group (login, register, etc.).
 */
export default function AuthLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-5 w-64 mx-auto" />
        </div>
        <div className="rounded-xl border p-6 space-y-4">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-32 mx-auto rounded-md" />
        </div>
      </div>
    </div>
  );
}
