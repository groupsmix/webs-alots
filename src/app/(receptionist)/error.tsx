"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { logger } from "@/lib/logger";
import { t } from "@/lib/i18n";

export default function ReceptionistError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.warn("Operation failed", { context: "receptionist-error", error });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="mb-2 text-lg font-semibold">{t("fr", "error.title")}</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            {t("fr", "error.description")}
          </p>
          {error.digest && (
            <p className="mb-4 text-xs text-muted-foreground">
              Error ID: {error.digest}
            </p>
          )}
          <Button onClick={reset} size="lg">
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("fr", "error.retry")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
