"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { t, type Locale } from "@/lib/i18n";
import { logger } from "@/lib/logger";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback UI. If provided, overrides the default error card. */
  fallback?: ReactNode;
  /** Optional label shown in the error card (e.g. "Booking Form") */
  section?: string;
  /** Optional compact mode for smaller widgets */
  compact?: boolean;
  /** Locale for i18n strings (defaults to "fr") */
  locale?: Locale;
  /** Optional callback invoked when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Unified error boundary that catches rendering errors in its subtree
 * and displays a user-friendly fallback UI instead of crashing the page.
 *
 * Supports multiple display modes:
 * - Default: full-width error card with retry button
 * - Compact: smaller inline error for widgets
 * - Custom fallback: render your own fallback UI
 *
 * All strings are internationalised via the i18n system.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.warn("React error boundary caught an error", {
      context: "error-boundary",
      error,
      componentStack: errorInfo.componentStack ?? undefined,
    });
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const locale = this.props.locale ?? "fr";
      const { section, compact } = this.props;

      if (compact) {
        return (
          <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-center">
            <AlertTriangle className="mb-1 h-4 w-4 text-destructive" />
            <p className="mb-2 text-xs text-muted-foreground">
              {section
                ? `${section} — ${t(locale, "error.loadFailed")}`
                : t(locale, "error.sectionTitle")}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleReset}
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              {t(locale, "error.retry")}
            </Button>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <h3 className="mb-1 text-sm font-semibold">
            {section
              ? `${section} — ${t(locale, "error.sectionTitle")}`
              : t(locale, "error.title")}
          </h3>
          <p className="mb-4 text-xs text-muted-foreground">
            {t(locale, "error.sectionDescription")}
          </p>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <pre className="mt-2 mb-4 rounded bg-muted p-3 text-left text-xs overflow-auto max-h-40">
              {this.state.error.message}
            </pre>
          )}
          <Button variant="outline" size="sm" onClick={this.handleReset}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            {t(locale, "error.retry")}
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
