/**
 * Standardized API error codes (F-A91-01).
 *
 * Every apiError() call should include one of these codes as the third
 * argument so that clients can map codes to locale-specific messages
 * without parsing the English/French error string.
 *
 * Usage:
 *   import { ERROR_CODES } from "@/lib/error-codes";
 *   return apiError("Doctor not found", 404, ERROR_CODES.NOT_FOUND);
 *
 * Client-side mapping:
 *   The `code` field in the error response body can be used as a key
 *   into the i18n translation files:
 *     t(locale, `error.${response.code}`)  // e.g. t("fr", "error.NOT_FOUND")
 */

export const ERROR_CODES = {
  // ── Validation (4xx) ──────────────────────────────────────────────
  /** 400 - Request body or query params failed Zod validation */
  VALIDATION_ERROR: "VALIDATION_ERROR",
  /** 400 - Request JSON could not be parsed */
  INVALID_JSON: "INVALID_JSON",
  /** 400 - Booking slot would overflow past midnight */
  SLOT_OVERFLOW: "SLOT_OVERFLOW",

  // ── Authentication / Authorization ────────────────────────────────
  /** 401 - No valid session or API key */
  UNAUTHORIZED: "UNAUTHORIZED",
  /** 403 - Authenticated but insufficient role */
  FORBIDDEN: "FORBIDDEN",
  /** 403 - Booking token mismatch (phone or clinic) */
  TOKEN_MISMATCH: "TOKEN_MISMATCH",
  /** 403 - Tenant isolation violation */
  INVALID_TENANT: "INVALID_TENANT",

  // ── Resource State ────────────────────────────────────────────────
  /** 404 - Requested resource does not exist */
  NOT_FOUND: "NOT_FOUND",
  /** 409 - Resource already exists (unique constraint) */
  CONFLICT: "CONFLICT",
  /** 409 - Booking slot is full (maxPerSlot exceeded) */
  SLOT_FULL: "SLOT_FULL",

  // ── Rate Limiting ─────────────────────────────────────────────────
  /** 429 - IP-based or user-based rate limit exceeded */
  RATE_LIMITED: "RATE_LIMITED",
  /** 429 - Per-user authenticated rate limit */
  USER_RATE_LIMIT: "USER_RATE_LIMIT",

  // ── Server ────────────────────────────────────────────────────────
  /** 500 - Unhandled server error (details never exposed to client) */
  INTERNAL_ERROR: "INTERNAL_ERROR",
  /** 503 - Feature disabled or service temporarily unavailable */
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
