import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

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

  // S-35: Strip request bodies and known PHI fields from breadcrumbs to
  // prevent accidental PHI capture in Sentry payloads.
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === "xhr" || breadcrumb.category === "fetch") {
      delete breadcrumb.data?.["request_body"];
      delete breadcrumb.data?.["response_body"];
      // S-35: Scrub URL query params that may contain PHI
      if (breadcrumb.data?.["url"]) {
        try {
          const url = new URL(breadcrumb.data["url"], window.location.origin);
          const phiParams = ["phone", "email", "name", "patient", "patientId", "dob", "date_of_birth"];
          for (const param of phiParams) {
            if (url.searchParams.has(param)) {
              url.searchParams.set(param, "[REDACTED]");
            }
          }
          breadcrumb.data["url"] = url.toString();
        } catch {
          // URL parse failed — leave as-is
        }
      }
    }
    return breadcrumb;
  },
  // S-35 + Audit P1 #13: Strip PHI from events and disable Replay on PHI routes
  beforeSend(event) {
    // Strip request bodies from all events
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      // Redact PHI query params from the URL
      if (typeof event.request.query_string === "string") {
        event.request.query_string = event.request.query_string
          .replace(/(phone|email|name|patient|patientId|dob|date_of_birth)=[^&]*/gi, "$1=[REDACTED]");
      }
    }

    const url = event.request?.url ?? window.location.href;
    if (url.includes("/admin/") || url.includes("/doctor/") || url.includes("/patient/")) {
      delete event.exception?.values?.[0]?.mechanism?.handled;
      if (event.type === 'replay_event') return null; // Drop replay on PHI routes
    }
    return event;
  }
});
