"use client";

import ClinicErrorBoundary from "@/components/error-boundaries/clinic-error-boundary";

export default function SpecialistError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ClinicErrorBoundary error={error} reset={reset} context="specialist" variant="page" />;
}
