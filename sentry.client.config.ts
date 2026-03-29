import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring: sample 10% of transactions in production.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Session replay: capture 1% of sessions, 100% on error.
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration(),
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
});
