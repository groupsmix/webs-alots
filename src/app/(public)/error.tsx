"use client";

import { Home } from "lucide-react";
import Link from "next/link";
import ClinicErrorBoundary from "@/components/error-boundaries/clinic-error-boundary";
import { useLocale } from "@/components/locale-switcher";
import { t } from "@/lib/i18n";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [locale] = useLocale();

  return (
    <ClinicErrorBoundary error={error} reset={reset} context="public" variant="page">
      <Link
        href="/"
        className="mt-3 inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted hover:text-foreground transition-colors"
      >
        <Home className="mr-2 h-4 w-4" />
        {t(locale, "notFound.backHome")}
      </Link>
    </ClinicErrorBoundary>
  );
}
