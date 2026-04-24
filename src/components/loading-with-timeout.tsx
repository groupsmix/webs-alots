"use client";

/**
 * Loading component with timeout and retry functionality.
 *
 * Shows a spinner initially, then after 10s shows "Taking longer than expected...",
 * and after 30s shows a retry button.
 */

import { Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface LoadingWithTimeoutProps {
  /** Message to show while loading */
  message?: string;
  /** Milliseconds before showing "taking longer" message (default: 10000) */
  slowThresholdMs?: number;
  /** Milliseconds before showing retry button (default: 30000) */
  retryThresholdMs?: number;
  /** Called when user clicks retry */
  onRetry?: () => void;
}

export function LoadingWithTimeout({
  message = "Loading...",
  slowThresholdMs = 10_000,
  retryThresholdMs = 30_000,
  onRetry,
}: LoadingWithTimeoutProps) {
  const [phase, setPhase] = useState<"loading" | "slow" | "retry">("loading");

  useEffect(() => {
    const slowTimer = setTimeout(() => setPhase("slow"), slowThresholdMs);
    const retryTimer = setTimeout(() => setPhase("retry"), retryThresholdMs);
    return () => {
      clearTimeout(slowTimer);
      clearTimeout(retryTimer);
    };
  }, [slowThresholdMs, retryThresholdMs]);

  return (
    <Card>
      <CardContent className="p-8 text-center">
        {phase === "retry" ? (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <AlertCircle className="h-6 w-6 text-amber-600" />
            </div>
            <p className="text-sm font-medium mb-1">Request timed out</p>
            <p className="text-xs text-muted-foreground mb-4">
              The server is not responding. Please check your connection and try again.
            </p>
            {onRetry && (
              <Button onClick={onRetry} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry
              </Button>
            )}
          </>
        ) : (
          <>
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{message}</p>
            {phase === "slow" && (
              <p className="text-xs text-amber-600 mt-2">
                Taking longer than expected...
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
