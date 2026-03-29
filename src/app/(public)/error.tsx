"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { logger } from "@/lib/logger";
import { t } from "@/lib/i18n";
import { useLocale } from "@/components/locale-switcher";
import Link from "next/link";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [locale] = useLocale();

  useEffect(() => {
    logger.warn("Operation failed", { context: "public-error", error });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="mb-2 text-lg font-semibold">{t(locale, "error.title")}</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            {t(locale, "error.description")}
          </p>
          {error.digest && (
            <p className="mb-4 text-xs text-muted-foreground">
              Error ID: {error.digest}
            </p>
          )}
          <div className="flex items-center justify-center gap-3">
            <Button onClick={reset} size="lg">
              <RefreshCw className="mr-2 h-4 w-4" />
              {t(locale, "error.retry")}
            </Button>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted hover:text-foreground transition-colors"
            >
              <Home className="mr-2 h-4 w-4" />
              {t(locale, "notFound.backHome")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
