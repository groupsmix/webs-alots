"use client";

import { LoadingWithTimeout } from "@/components/loading-with-timeout";

export default function SuperAdminLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <LoadingWithTimeout
        message="Loading admin panel..."
        slowThresholdMs={10_000}
        retryThresholdMs={30_000}
        onRetry={() => window.location.reload()}
      />
    </div>
  );
}
