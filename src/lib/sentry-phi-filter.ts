/**
 * Sentry PHI Filter
 * 
 * A41: Phase 2 Infrastructure Hardening - Observability Privacy
 * 
 * This module provides PHI/PII stripping for Sentry events to prevent
 * Protected Health Information from being captured in error monitoring.
 * 
 * Used in beforeSend hooks across all Sentry configurations:
 * - sentry.server.config.ts
 * - sentry.client.config.ts
 * - sentry.edge.config.ts
 */

import type { Event, EventHint } from "@sentry/types";

/**
 * Regex patterns to identify PHI/PII fields in Sentry events.
 * Matches common healthcare and personal data field names.
 */
const PHI_FIELD_REGEX = /(email|phone|address|dob|date_of_birth|prescription|diagnosis|patient|patient_name|patient_email|patient_phone|cin|password|token|secret|ssn|cnss|amu|full_name|doctor_name|clinic_name|owner_name|emergency_contact|next_of_kin|patient_address|medical_history|allergies|medications|symptoms|insurance_id|insurance_number|national_id|passport|license_number|credit_card|bank_account|iban|swift|hostname|r2key|r2_key)/i;

/**
 * Regex to detect PHI in URL query parameters.
 */
const PHI_URL_REGEX = /[?&](phone|email|cin|dob|date_of_birth|password|token|secret|ssn|cnss|name|address|patient|patient_name|hostname)=/i;

/**
 * Recursively redact PHI/PII fields from an object.
 * 
 * @param obj - Object to redact PHI from
 * @returns Redacted object with PHI fields replaced with [REDACTED_PHI]
 */
function redactPhiFromObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => redactPhiFromObject(item));
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (PHI_FIELD_REGEX.test(key)) {
      redacted[key] = "[REDACTED_PHI]";
    } else if (typeof value === "object" && value !== null) {
      redacted[key] = redactPhiFromObject(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

/**
 * Scrub PHI from URL query parameters.
 * 
 * @param url - URL string to scrub
 * @returns URL with PHI query parameters redacted
 */
function scrubPhiFromUrl(url: string): string {
  return url.replace(
    /([?&])(phone|email|cin|dob|date_of_birth|password|token|secret|ssn|cnss|name|address|patient|patient_name|hostname)=[^&]*/gi,
    "$1$2=[REDACTED_PHI]",
  );
}

/**
 * Strip PHI from a Sentry event before sending.
 * 
 * This function is designed to be used in the beforeSend hook of Sentry.init().
 * It removes or redacts PHI from:
 * - Request data (body, query params, headers)
 * - Event contexts
 * - Event extra data
 * - User information
 * - Tags
 * - Breadcrumbs
 * - Stack frame variables
 * 
 * @param event - Sentry event to filter
 * @param hint - Event hint (unused but required by Sentry API)
 * @returns Filtered event with PHI removed, or null to drop the event
 * 
 * @example
 * ```typescript
 * Sentry.init({
 *   dsn: process.env.SENTRY_DSN,
 *   beforeSend: stripPhi,
 * });
 * ```
 */
export function stripPhi(event: Event, hint?: EventHint): Event | null {
  // Scrub request data
  if (event.request) {
    // Remove request body entirely (may contain PHI in form data)
    if (event.request.data) {
      event.request.data = redactPhiFromObject(event.request.data);
    }

    // Scrub URL query parameters
    if (event.request.url) {
      event.request.url = scrubPhiFromUrl(event.request.url);
    }
    if (event.request.query_string) {
      event.request.query_string = scrubPhiFromUrl("?" + event.request.query_string).slice(1);
    }

    // Scrub headers (may contain PHI in custom headers)
    if (event.request.headers) {
      event.request.headers = redactPhiFromObject(event.request.headers) as Record<string, string>;
    }

    // Remove cookies entirely (may contain session tokens with PHI)
    delete event.request.cookies;
  }

  // Scrub contexts (runtime, device, OS, etc.)
  if (event.contexts) {
    for (const key in event.contexts) {
      event.contexts[key] = redactPhiFromObject(event.contexts[key]) as Record<string, unknown>;
    }
  }

  // Scrub extra data
  if (event.extra) {
    event.extra = redactPhiFromObject(event.extra) as Record<string, unknown>;
  }

  // Scrub user information
  if (event.user) {
    if (event.user.email) event.user.email = "[REDACTED_PHI]";
    if (event.user.ip_address) event.user.ip_address = "[REDACTED_PHI]";
    if (event.user.username) event.user.username = "[REDACTED_PHI]";
    // Keep user.id if it's a UUID (safe identifier)
    // Remove any other user fields that might contain PHI
    const { id, ...otherUserFields } = event.user;
    event.user = { id };
  }

  // Scrub tags
  if (event.tags) {
    event.tags = redactPhiFromObject(event.tags) as Record<string, string>;
  }

  // Scrub breadcrumbs
  if (event.breadcrumbs) {
    for (const breadcrumb of event.breadcrumbs) {
      // Scrub breadcrumb data
      if (breadcrumb.data) {
        breadcrumb.data = redactPhiFromObject(breadcrumb.data) as Record<string, unknown>;
      }
      // Scrub breadcrumb message URLs
      if (breadcrumb.message && PHI_URL_REGEX.test(breadcrumb.message)) {
        breadcrumb.message = scrubPhiFromUrl(breadcrumb.message);
      }
    }
  }

  // Scrub stack frame variables
  if (event.exception?.values) {
    for (const exception of event.exception.values) {
      if (exception.stacktrace?.frames) {
        for (const frame of exception.stacktrace.frames) {
          if (frame.vars) {
            frame.vars = redactPhiFromObject(frame.vars) as Record<string, string>;
          }
        }
      }
    }
  }

  return event;
}

/**
 * Strip PHI from a Sentry breadcrumb before adding.
 * 
 * This function is designed to be used in the beforeBreadcrumb hook of Sentry.init().
 * 
 * @param breadcrumb - Sentry breadcrumb to filter
 * @returns Filtered breadcrumb with PHI removed, or null to drop the breadcrumb
 * 
 * @example
 * ```typescript
 * Sentry.init({
 *   dsn: process.env.SENTRY_DSN,
 *   beforeBreadcrumb: stripPhiFromBreadcrumb,
 * });
 * ```
 */
export function stripPhiFromBreadcrumb(breadcrumb: any): any {
  if (breadcrumb.data) {
    breadcrumb.data = redactPhiFromObject(breadcrumb.data) as Record<string, unknown>;
  }

  // Scrub URLs in breadcrumb messages
  if (breadcrumb.message && PHI_URL_REGEX.test(breadcrumb.message)) {
    breadcrumb.message = scrubPhiFromUrl(breadcrumb.message);
  }

  // Scrub breadcrumb category "fetch" / "xhr" URLs
  if (breadcrumb.data?.url && typeof breadcrumb.data.url === "string") {
    breadcrumb.data.url = scrubPhiFromUrl(breadcrumb.data.url);
  }

  return breadcrumb;
}
