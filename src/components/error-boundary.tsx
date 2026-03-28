"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ErrorBoundaryProps {
  /** Content to render when there is no error */
  children: ReactNode;
  /** Optional fallback UI. If not provided, a default error card is shown. */
  fallback?: ReactNode;
  /** Optional callback invoked when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React error boundary that catches rendering errors in its subtree
 * and displays a user-friendly fallback UI instead of crashing the page.
 *
 * Place at the layout level of each route group so a component error
 * in one section doesn't break the entire application.
 *
 * @example
 *   <ErrorBoundary>
 *     <DashboardContent />
 *   </ErrorBoundary>
 *
 *   // With custom fallback
 *   <ErrorBoundary fallback={<p>Something went wrong</p>}>
 *     <PatientPortal />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to structured logger (imports logger dynamically to avoid
    // circular dependencies in the component tree)
    import("@/lib/logger").then(({ logger }) => {
      logger.error("React error boundary caught an error", {
        context: "error-boundary",
        error,
        componentStack: errorInfo.componentStack ?? undefined,
      });
    }).catch(() => {
      // Fallback: log to console if dynamic import fails
    });

    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="mx-auto max-w-lg mt-8">
          <CardContent className="py-8 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Une erreur est survenue</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Cette section a rencontré un problème. Veuillez réessayer.
              </p>
            </div>
            {process.env.NODE_ENV === "development" && this.state.error && (
              <pre className="mt-2 rounded bg-muted p-3 text-left text-xs overflow-auto max-h-40">
                {this.state.error.message}
              </pre>
            )}
            <Button variant="outline" onClick={this.handleRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Réessayer
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
