import * as Sentry from "@sentry/nextjs";
import { stripPhi, stripPhiFromBreadcrumb } from "@/lib/sentry-phi-filter";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // A41: Limit data capture to prevent PHI leakage
  maxBreadcrumbs: 50,
  maxValueLength: 250,

  // AUDIT F-07: Per-route client-side sampling (mirrors sentry.server.config.ts).
  // Critical user flows (booking, payment, auth) get 100% sampling in production;
  // other navigations get 10%.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  tracesSampler(samplingContext) {
    const name = (samplingContext.name || "").toLowerCase();
    // Critical booking/payment/auth flows: 100% in production
    if (
      name.includes("/book") ||
      name.includes("/booking") ||
      name.includes("/payment") ||
      name.includes("/checkout") ||
      name.includes("/login") ||
      name.includes("/register") ||
      name.includes("/checkin")
    ) {
      return 1.0;
    }
    // Dashboard navigations: 20%
    if (
      name.includes("/dashboard") ||
      name.includes("/admin") ||
      name.includes("/doctor") ||
      name.includes("/patient")
    ) {
      return process.env.NODE_ENV === "production" ? 0.2 : 1.0;
    }
    // Everything else: 10% in production, 100% in dev
    return process.env.NODE_ENV === "production" ? 0.1 : 1.0;
  },

  // Session replay: capture 1% of sessions, 100% on error.
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      // Audit P1 #13: Prevent PHI from leaking into Session Replays
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    }),
    Sentry.browserTracingIntegration(),
  ],

  // Don't send errors in development unless explicitly enabled.
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // S-35 + A41: Strip request bodies and known PHI fields from breadcrumbs to
  // prevent accidental PHI capture in Sentry payloads.
  beforeBreadcrumb: stripPhiFromBreadcrumb,

  // S-35 + Audit P1 #13 + A41: Strip PHI from events and disable Replay on PHI routes
  beforeSend: stripPhi,
});
