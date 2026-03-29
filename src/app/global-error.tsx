"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { t } from "@/lib/i18n";

/**
 * Global error boundary — catches errors thrown inside the root layout
 * itself (e.g. TenantProvider, font loading, etc.). Because the root
 * layout is replaced, we must render our own <html>/<body> tags.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.warn("Operation failed", { context: "global-error", error });
  }, [error]);

  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="min-h-screen flex items-center justify-center bg-white text-gray-900">
        <div className="max-w-md w-full text-center px-6 py-12">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-7 w-7 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01M10.29 3.86l-8.58 14.86A1 1 0 002.59 20h18.82a1 1 0 00.88-1.28L13.71 3.86a1 1 0 00-1.42 0z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold mb-2">
            {t("fr", "error.title")}
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            {t("fr", "error.criticalDescription")}
          </p>
          {error.digest && (
            <p className="text-xs text-gray-400 mb-4">
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {t("fr", "error.retry")}
          </button>
        </div>
      </body>
    </html>
  );
}
