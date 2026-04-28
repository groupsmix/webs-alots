import * as Sentry from "@sentry/nextjs";

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

  // F-10: Scrub PII from breadcrumbs on the server side
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.data) {
      breadcrumb.data = redactPII(breadcrumb.data) as Record<string, unknown>;
    }
    // Scrub URLs in breadcrumb messages
    if (breadcrumb.message && piiUrlRegex.test(breadcrumb.message)) {
      breadcrumb.message = breadcrumb.message.replace(
        /([?&])(phone|email|cin|dob|password|token|secret|ssn|cnss|name|address|patient)=[^&]*/gi,
        "$1$2=[REDACTED_PII]",
      );
    }
    // Scrub breadcrumb category "fetch" / "xhr" URLs
    if (breadcrumb.data?.url && typeof breadcrumb.data.url === "string") {
      breadcrumb.data.url = scrubUrl(breadcrumb.data.url);
    }
    return breadcrumb;
  },

  beforeSend(event) {
    // Scrub request data
    if (event.request?.data) {
      event.request.data = redactPII(event.request.data);
    }

    // Scrub request URL query params
    if (event.request?.url) {
      event.request.url = scrubUrl(event.request.url);
    }
    if (event.request?.query_string) {
      event.request.query_string = scrubUrl("?" + event.request.query_string).slice(1);
    }
    
    // Scrub contexts
    if (event.contexts) {
      for (const key in event.contexts) {
        event.contexts[key] = redactPII(event.contexts[key]) as Record<string, unknown>;
      }
    }
    
    // Scrub extra
    if (event.extra) {
      event.extra = redactPII(event.extra) as Record<string, unknown>;
    }

    // F-10: Scrub event.user
    if (event.user) {
      if (event.user.email) event.user.email = "[REDACTED_PII]";
      if (event.user.ip_address) event.user.ip_address = "[REDACTED_PII]";
      if (event.user.username) event.user.username = "[REDACTED_PII]";
    }

    // F-10: Scrub event.tags
    if (event.tags) {
      event.tags = redactPII(event.tags) as Record<string, string>;
    }

    // F-10: Scrub stack frame vars
    if (event.exception?.values) {
      for (const exception of event.exception.values) {
        if (exception.stacktrace?.frames) {
          for (const frame of exception.stacktrace.frames) {
            if (frame.vars) {
              frame.vars = redactPII(frame.vars) as Record<string, string>;
            }
          }
        }
      }
    }

    return event;
  },
});

/**
 * Scrub PII query parameters from a URL string.
 */
function scrubUrl(url: string): string {
  return url.replace(
    /([?&])(phone|email|cin|dob|password|token|secret|ssn|cnss|name|address|patient)=[^&]*/gi,
    "$1$2=[REDACTED_PII]",
  );
}

/**
 * Recursively redacts sensitive PII/PHI keys from an object.
 */
function redactPII(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactPII(item));
  }

  const redactedObj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (piiKeysRegex.test(key)) {
      redactedObj[key] = "[REDACTED_PII]";
    } else if (typeof value === "object" && value !== null) {
      redactedObj[key] = redactPII(value);
    } else {
      redactedObj[key] = value;
    }
  }
  return redactedObj;
}
