"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional label shown in the error card (e.g. "Booking Form") */
  section?: string;
  /** Optional compact mode for smaller widgets */
  compact?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Reusable error boundary for wrapping critical UI sections.
 * Catches render errors and shows a friendly inline fallback
 * with a "Try Again" button that re-mounts the subtree.
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

  componentDidCatch(error: Error, info: ErrorInfo) {
    void error;
    void info;
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const { section, compact } = this.props;

      if (compact) {
        return (
          <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-center">
            <AlertTriangle className="mb-1 h-4 w-4 text-destructive" />
            <p className="mb-2 text-xs text-muted-foreground">
              {section ? `${section} failed to load` : "Failed to load"}
            </p>
            <Button
              variant="outline"
              size="xs"
              onClick={this.handleReset}
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              Retry
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
              ? `${section} encountered an error`
              : "Something went wrong"}
          </h3>
          <p className="mb-4 text-xs text-muted-foreground">
            This section failed to render. Click below to try again.
          </p>
          <Button variant="outline" size="sm" onClick={this.handleReset}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
