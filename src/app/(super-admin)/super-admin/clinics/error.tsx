"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { logger } from "@/lib/logger";
import Link from "next/link";

export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.warn("Operation failed", { context: "super-admin-page-error", error });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="mb-2 text-lg font-semibold">Failed to load page</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Something went wrong while loading this page. This could be a
            temporary connection issue.
          </p>
          {error.digest && (
            <p className="mb-4 text-xs text-muted-foreground">
              Error ID: {error.digest}
            </p>
          )}
          <div className="flex items-center justify-center gap-3">
            <Button onClick={reset} size="lg">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
            <Link
              href="/super-admin/dashboard"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
