"use client";

import { AlertTriangle, RefreshCw, Home, ArrowLeft, LifeBuoy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { t, type TranslationKey } from "@/lib/i18n";
import { logger } from "@/lib/logger";

/** Map of route-group context → dashboard home route. */
const CONTEXT_DASHBOARD_MAP: Record<string, string> = {
  admin: "/admin/dashboard",
  doctor: "/doctor/dashboard",
  patient: "/patient/dashboard",
  receptionist: "/receptionist/dashboard",
  "super-admin": "/super-admin/dashboard",
  pharmacist: "/pharmacist/dashboard",
  specialist: "/specialist/dashboard",
  lab: "/lab/dashboard",
};

/**
 * Shared error boundary for all route groups.
 *
 * Consolidates the duplicated error boundary pattern across
 * (admin), (doctor), (patient), (receptionist), (super-admin),
 * (clinic-public), and the root error.tsx (audit DRY-01).
 *
 * Recovery affordances (UX hardening — the old version had only "retry",
 * which is useless when the failure is a server-side data fetch that will
 * fail again with the same input):
 *
 *   1. Retry      — re-run the segment (unchanged from before)
 *   2. Go back    — browser history fallback so the user is never stuck
 *   3. Go to dashboard — explicit recovery target keyed off `context`
 *   4. Error ID   — already shown; now also one-click copyable
 *   5. Dev details — in non-production, render the error message + stack
 *                     so the developer doesn't have to crack open devtools
 *
 * @param context  - Logging context label (e.g. "admin", "doctor"). Also
 *                   used to choose the "Go to dashboard" target.
 * @param variant  - "page" uses error.title / error.description (root-level);
 *                   "section" uses error.sectionTitle / error.sectionDescription
 * @param children - Optional extra actions rendered after the recovery row
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
  const router = useRouter();

  const titleKey = (
    variant === "page" ? "error.title" : "error.sectionTitle"
  ) as TranslationKey;
  const descKey = (
    variant === "page" ? "error.description" : "error.sectionDescription"
  ) as TranslationKey;

  const dashboardHref = useMemo(() => CONTEXT_DASHBOARD_MAP[context] ?? "/", [context]);

  useEffect(() => {
    // Was logger.warn — but a thrown render error is an *error*, not a
    // warning, and logging it as warn made it easy to miss in dashboards.
    logger.error("Clinic component render error", {
      context: `${context}-error`,
      digest: error.digest,
      message: error.message,
      // Stack only in dev to avoid leaking server paths.
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }, [error, context]);

  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-lg text-center">
        <CardContent className="p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" aria-hidden="true" />
          </div>
          <h2 className="mb-2 text-lg font-semibold">{t(locale, titleKey)}</h2>
          <p className="mb-6 text-sm text-muted-foreground">{t(locale, descKey)}</p>

          {error.digest && (
            <button
              type="button"
              onClick={() => {
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  navigator.clipboard.writeText(error.digest ?? "").catch(() => {
                    /* clipboard blocked — silently ignore, the digest is still visible */
                  });
                }
              }}
              className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title={t(locale, "error.copyId" as TranslationKey)}
            >
              <LifeBuoy className="h-3 w-3" aria-hidden="true" />
              {t(locale, "error.id" as TranslationKey)}: <code>{error.digest}</code>
            </button>
          )}

          {/* Primary recovery row — three options so the user is never stuck. */}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={reset} size="lg">
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              {t(locale, "error.retry")}
            </Button>
            <Button onClick={() => router.back()} size="lg" variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              {t(locale, "error.goBack" as TranslationKey)}
            </Button>
            <Button onClick={() => router.push(dashboardHref)} size="lg" variant="ghost">
              <Home className="mr-2 h-4 w-4" aria-hidden="true" />
              {t(locale, "error.goToDashboard" as TranslationKey)}
            </Button>
          </div>

          {/* Dev-only error details. Hidden in production so we don't leak
              internals to end users — they get the digest + recovery row. */}
          {isDev && (error.message || error.stack) && (
            <details className="mt-6 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-left text-xs">
              <summary className="cursor-pointer font-medium text-destructive">
                Dev: error details
              </summary>
              {error.message && (
                <p className="mt-2 font-mono break-all text-destructive">{error.message}</p>
              )}
              {error.stack && (
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[10px] text-muted-foreground">
                  {error.stack}
                </pre>
              )}
            </details>
          )}

          {children}
        </CardContent>
      </Card>
    </div>
  );
}
