import * as Sentry from "@sentry/nextjs";

// Regex to identify common PII/PHI keys in error contexts
const piiKeysRegex = /(email|phone|address|dob|prescription|diagnosis|patient|cin|password|token|secret|ssn|cnss|amu)/i;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring: sample 10% of transactions in production.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Don't send errors in development unless explicitly enabled.
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Audit 4.3 Fix: Sentry PII / PHI scrubber.
  // Recursively redacts any object properties matching the PII regex
  // before the event is sent to Sentry.
  beforeSend(event) {
    if (event.request && event.request.data) {
      event.request.data = redactPII(event.request.data);
    }
    
    if (event.contexts) {
      for (const key in event.contexts) {
        event.contexts[key] = redactPII(event.contexts[key]) as Record<string, unknown>;
      }
    }
    
    if (event.extra) {
      event.extra = redactPII(event.extra) as Record<string, unknown>;
    }

    return event;
  },
});

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
