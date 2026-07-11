/**
 * Barrel re-export for all validation schemas.
 *
 * This file preserves backward compatibility — existing imports from
 * `@/lib/validations` continue to work unchanged. New code should import
 * directly from the domain module (e.g. `@/lib/validations/booking`).
 *
 * ADR 0013 (operations-first scope enforcement): Clinical, ADT, restaurant,
 * and veterinary schemas have been removed from this barrel as their API
 * routes were dropped in migration 00187. Remaining clinical schemas are
 * used by active upload validation and legacy schema tests only. Gated API
 * route handlers must still enforce scope through `isApiGroupEnabled()` or
 * an equivalent gate; `scripts/check-scope-enforcement.mjs` verifies this.
 */

export { normalizeText, safeText, safeName } from "./primitives";

export { looksLikeGibberish, GIBBERISH_NAME_MESSAGE } from "./name-quality";

export {
  bookingCancelSchema,
  emergencySlotSchema,
  recurringSchema,
  rescheduleSchema,
  waitingListSchema,
  waitingListDeleteSchema,
  doctorUnavailabilitySchema,
  checkinConfirmSchema,
} from "./booking";

export {
  paymentConfirmSchema,
  paymentInitiateSchema,
  paymentRefundSchema,
  stripeWebhookEventSchema,
  cmiCallbackFieldsSchema,
  cmiPaymentSchema,
  stripeCheckoutSchema,
  subscriptionWebhookEventSchema,
  subscriptionCheckoutSchema,
  subscriptionPortalSchema,
} from "./payments";
export type { StripeWebhookEvent, SubscriptionWebhookEvent } from "./payments";

export { notificationDispatchSchema, notificationTriggerSchema } from "./notifications";

export {
  onboardingSchema,
  impersonateSchema,
  customFieldCreateSchema,
  customFieldUpdateSchema,
  customFieldValuesSchema,
  brandingUpdateSchema,
  applyPresetSchema,
  consentSchema,
  verifyEmailSendSchema,
  verifyEmailConfirmSchema,
} from "./admin";

// ── LIMITED: Clinical/PHI and Veterinary routes deleted (P9 — ADR-0013 commit) ──────────────
// Most clinical/veterinary route schemas are intentionally not exported from the barrel because
// their API routes were removed after migration 00187 dropped the underlying tables. The schemas
// below remain exported for active upload validation and legacy schema tests only.
export { labReportSchema, uploadConfirmSchema } from "./clinical";

export { chatRequestSchema, CHAT_MESSAGE_CONTENT_MAX, aiManagerRequestSchema } from "./chat";

export { v1AppointmentCreateSchema, v1PatientCreateSchema } from "./v1";

// ── REMOVED: Restaurant routes deleted (P9 — ADR-0013 commit) ───────────────────────────────
// The restaurant-orders/menus/restaurant-tables API routes were removed because the
// underlying database tables were dropped in migration 00187.

export { safeParse } from "./helpers";

export { faqSearchSchema } from "./support";

// ── REMOVED: ADT and insurance-claims routes deleted (P9 — ADR-0013 commit) ─────────────────
// The admissions and insurance-claims API routes were removed because the underlying
// database tables were dropped in migration 00187.
