import * as Sentry from "@sentry/nextjs";
import { stripPhi, stripPhiFromBreadcrumb } from "@/lib/sentry-phi-filter";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // A41: Limit data capture to prevent PHI leakage
  maxBreadcrumbs: 50,
  maxValueLength: 250,

  // Performance monitoring: sample 10% of transactions in production.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Don't send errors in development unless explicitly enabled.
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // A41: Strip PHI from breadcrumbs and events
  beforeBreadcrumb: stripPhiFromBreadcrumb,
  beforeSend: stripPhi,
});
