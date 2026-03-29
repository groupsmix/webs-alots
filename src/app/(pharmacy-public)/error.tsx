"use client";

import ClinicErrorBoundary from "@/components/error-boundaries/clinic-error-boundary";

export default function PharmacyPublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ClinicErrorBoundary error={error} reset={reset} context="pharmacy-public" />;
}
