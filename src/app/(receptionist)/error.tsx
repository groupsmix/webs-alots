"use client";

import ClinicErrorBoundary from "@/components/error-boundaries/clinic-error-boundary";

export default function ReceptionistError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ClinicErrorBoundary error={error} reset={reset} context="receptionist" variant="page" />;
}
