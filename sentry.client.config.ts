import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring: sample 10% of transactions in production.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

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
          .replace(/(?:phone|email|name|patient|patientId|dob|date_of_birth)=[^&]*/gi, "$1=[REDACTED]");
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
