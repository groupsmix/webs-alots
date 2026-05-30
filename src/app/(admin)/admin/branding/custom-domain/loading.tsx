import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Streaming skeleton for custom domain settings.
 * Rendered automatically by Next.js while the server segment loads,
 * so the user sees structure instantly instead of a blank screen.
 */
export default function BrandingCustomDomainLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-56 mb-3" />
      <Skeleton className="h-4 w-80 mb-6" />
      <CardSkeleton count={2} />
    </div>
  );
}
