"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { logger } from "@/lib/logger";
import { t } from "@/lib/i18n";
import { useLocale } from "@/components/locale-switcher";

/**
 * Shared error boundary for clinic-type route groups.
 *
 * Used by (clinic-public), (specialist), and other clinic-type route
 * groups to provide consistent error handling with i18n.
 */
export default function ClinicErrorBoundary({
  error,
  reset,
  context = "clinic",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  context?: string;
}) {
  const [locale] = useLocale();

  useEffect(() => {
    logger.warn("Operation failed", { context: `${context}-error`, error });
  }, [error, context]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="mb-2 text-lg font-semibold">
            {t(locale, "error.sectionTitle")}
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            {t(locale, "error.sectionDescription")}
          </p>
          {error.digest && (
            <p className="mb-4 text-xs text-muted-foreground">
              Error ID: {error.digest}
            </p>
          )}
          <Button onClick={reset} size="lg">
            <RefreshCw className="mr-2 h-4 w-4" />
            {t(locale, "error.retry")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
