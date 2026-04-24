"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { logger } from "@/lib/logger";
import { t } from "@/lib/i18n";
import { useLocale } from "@/components/locale-switcher";

/**
 * Shared error boundary for all route groups.
 *
 * Consolidates the duplicated error boundary pattern across
 * (admin), (doctor), (patient), (receptionist), (super-admin),
 * (clinic-public), and the root error.tsx (audit DRY-01).
 *
 * @param context  - Logging context label (e.g. "admin", "doctor")
 * @param variant  - "page" uses error.title / error.description (root-level);
 *                   "section" uses error.sectionTitle / error.sectionDescription
 * @param children - Optional extra actions rendered after the retry button
 */
export default function ClinicErrorBoundary({
  error,
  reset,
  context = "clinic",
  variant = "section",
  children,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  context?: string;
  variant?: "page" | "section";
  children?: React.ReactNode;
}) {
  const [locale] = useLocale();

  const titleKey = variant === "page" ? "error.title" : "error.sectionTitle";
  const descKey = variant === "page" ? "error.description" : "error.sectionDescription";

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
            {t(locale, titleKey)}
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            {t(locale, descKey)}
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
          {children}
        </CardContent>
      </Card>
    </div>
  );
}
