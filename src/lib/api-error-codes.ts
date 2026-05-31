/**
 * Q-31: Central error code registry.
 *
 * All `code` parameters passed to `apiError()` must come from this enum.
 * This prevents typo-drift across routes and enables client-side exhaustive
 * matching for localized error messages.
 *
 * Add new codes here — never use raw string literals in apiError(_, _, code).
 */
export const API_ERROR_CODES = Object.freeze({
  // ── Auth ──
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  SESSION_EXPIRED: "SESSION_EXPIRED",

  // ── Validation ──
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_TENANT: "INVALID_TENANT",
  INVALID_TOKEN: "INVALID_TOKEN",

  // ── Resource ──
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  ALREADY_EXISTS: "ALREADY_EXISTS",

  // ── Rate limiting / quotas ──
  RATE_LIMITED: "RATE_LIMITED",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",

  // ── AI ──
  AI_DISABLED: "AI_DISABLED",
  AI_CONFIG_ERROR: "AI_CONFIG_ERROR",
  AI_QUOTA_EXCEEDED: "AI_QUOTA_EXCEEDED",

  // ── Booking ──
  APPOINTMENT_CONFLICT: "APPOINTMENT_CONFLICT",
  SLOT_FULL: "SLOT_FULL",
  SLOT_OVERFLOW: "SLOT_OVERFLOW",

  // ── Server ──
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  TIMEOUT: "TIMEOUT",

  // ── Billing ──
  PAYMENT_REQUIRED: "PAYMENT_REQUIRED",
  SUBSCRIPTION_EXPIRED: "SUBSCRIPTION_EXPIRED",

  // ── File handling ──
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
} as const);

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];
