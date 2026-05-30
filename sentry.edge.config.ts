import * as Sentry from "@sentry/nextjs";

// A8-01: PII/PHI field regex — matches common sensitive keys that must not
// leave the edge runtime in error events.
const piiKeysRegex =
  /(email|phone|address|dob|prescription|diagnosis|patient|cin|password|token|secret|ssn|cnss|amu)/i;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring: sample 10% of transactions in production.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Don't send errors in development unless explicitly enabled.
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // A8-01: Strip PII/PHI from edge error events before forwarding to Sentry.
  // The edge runtime executes middleware — every request passes through here,
  // including those carrying auth headers, x-auth-profile-* role claims, and
  // clinic-scoped context. All of that must be scrubbed before transmission.
  beforeSend(event) {
    // Scrub security-sensitive and PHI-bearing request headers.
    if (event.request?.headers) {
      const sensitiveHeaders = [
        "authorization",
        "cookie",
        "x-cron-secret",
        "x-booking-token",
        "x-auth-profile-role",
        "x-auth-profile-id",
        "x-tenant-clinic-id",
      ];
      for (const h of sensitiveHeaders) {
        if (event.request.headers[h]) {
          event.request.headers[h] = "[REDACTED]";
        }
      }
    }

    // Scrub PHI from the request body (e.g. form submissions, JSON payloads).
    if (event.request?.data) {
      event.request.data = redactPII(event.request.data);
    }

    // Scrub PHI query params from the request URL.
    if (event.request?.url) {
      event.request.url = scrubUrl(event.request.url);
    }
    if (event.request?.query_string) {
      event.request.query_string = scrubUrl("?" + event.request.query_string).slice(1);
    }

    // Scrub arbitrary context blobs (e.g. extra data attached by middleware).
    if (event.contexts) {
      for (const key in event.contexts) {
        event.contexts[key] = redactPII(event.contexts[key]) as Record<string, unknown>;
      }
    }
    if (event.extra) {
      event.extra = redactPII(event.extra) as Record<string, unknown>;
    }

    // Scrub user identity fields — IP and email must not reach Sentry.
    if (event.user) {
      if (event.user.email) event.user.email = "[REDACTED_PII]";
      if (event.user.ip_address) event.user.ip_address = "[REDACTED_PII]";
      if (event.user.username) event.user.username = "[REDACTED_PII]";
    }

    // Scrub stack frame local variables (may contain decrypted request context).
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
 * Scrub known PHI query parameter names from a URL string.
 */
function scrubUrl(url: string): string {
  return url.replace(
    /([?&])(phone|email|cin|dob|password|token|secret|ssn|cnss|name|address|patient)=[^&]*/gi,
    "$1$2=[REDACTED_PII]",
  );
}

/**
 * Recursively redact any object key that matches the PII regex.
 */
function redactPII(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => redactPII(item));
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (piiKeysRegex.test(key)) {
      redacted[key] = "[REDACTED_PII]";
    } else if (typeof value === "object" && value !== null) {
      redacted[key] = redactPII(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}
