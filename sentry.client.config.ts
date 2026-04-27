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

  // Scrub sensitive healthcare data from breadcrumbs.
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === "xhr" || breadcrumb.category === "fetch") {
      delete breadcrumb.data?.["request_body"];
      delete breadcrumb.data?.["response_body"];
    }
    return breadcrumb;
  },
  // Audit P1 #13: Disable Replay entirely on PHI-heavy routes
  beforeSend(event) {
    const url = event.request?.url ?? window.location.href;
    if (url.includes("/admin/") || url.includes("/doctor/") || url.includes("/patient/")) {
      delete event.exception?.values?.[0]?.mechanism?.handled; // optional cleanup
      if (event.type === 'replay_event') return null; // Drop replay
    }
    return event;
  }
});
