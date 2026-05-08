import * as Sentry from "@sentry/nextjs";
import { stripPhi, stripPhiFromBreadcrumb } from "@/lib/sentry-phi-filter";

// Regex to identify common PII/PHI keys in error contexts
const piiKeysRegex = /(email|phone|address|dob|prescription|diagnosis|patient|cin|password|token|secret|ssn|cnss|amu)/i;

// F-10: Regex to detect PII in URL query parameters
const piiUrlRegex = /[?&](phone|email|cin|dob|password|token|secret|ssn|cnss|name|address|patient)=/i;

// R-20 Fix: Per-route sampling configuration
// Higher sampling for critical paths, lower for read-only operations
const routeSamplingConfig = {
  // Critical paths: 100% sampling for webhooks, cron, payment
  webhooks: 1.0,
  cron: 1.0,
  payment: 1.0,
  // Mutations: 50% sampling for POST/PUT/PATCH/DELETE
  mutations: 0.5,
  // Read operations: 10% sampling for GET requests
  reads: 0.1,
};

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // R-20 Fix: Set sendDefaultPii to false explicitly
  // @sentry/nextjs@8 defaults this to true, which is a PII risk
  sendDefaultPii: false,

  // A41: Limit data capture to prevent PHI leakage
  maxBreadcrumbs: 50,
  maxValueLength: 250,

  // Performance monitoring: Sample 10% of transactions in production by default.
  // Critical paths (webhooks, cron, payment) use 100% via transaction hooks.
  // Mutations use 50%, reads use 10%.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Don't send errors in development unless explicitly enabled.
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // R-20 Fix: Per-transaction sampling for fine-grained control
  tracesSampler(samplingContext) {
    // Extract transaction name from context
    const transactionName = samplingContext.name || "";
    const transactionDescription = samplingContext.description || "";

    // Determine sampling rate based on route type
    const combinedContext = `${transactionName} ${transactionDescription}`.toLowerCase();

    // Critical paths: webhooks, cron, payment
    if (
      combinedContext.includes("webhook") ||
      combinedContext.includes("cron") ||
      combinedContext.includes("payment") ||
      combinedContext.includes("stripe") ||
      combinedContext.includes("notification")
    ) {
      return routeSamplingConfig.webhooks;
    }

    // Mutations: POST, PUT, PATCH, DELETE
    if (
      combinedContext.includes("post") ||
      combinedContext.includes("put") ||
      combinedContext.includes("patch") ||
      combinedContext.includes("delete") ||
      combinedContext.includes("booking") ||
      combinedContext.includes("appointment") ||
      combinedContext.includes("register")
    ) {
      return routeSamplingConfig.mutations;
    }

    // Reads: GET requests (default to 10%)
    return routeSamplingConfig.reads;
  },

  // F-10 + A41: Scrub PII/PHI from breadcrumbs on the server side
  beforeBreadcrumb: stripPhiFromBreadcrumb,

  // F-10 + A41: Strip PHI from all events before sending to Sentry
  beforeSend: stripPhi,
});
