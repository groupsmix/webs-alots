/**
 * Barrel re-export for validation schemas.
 *
 * This file preserves backward compatibility — existing imports from
 * `@/lib/validations` continue to work. New code should import directly from
 * the domain module (e.g. `@/lib/validations/booking`).
 *
 * ADR 0013 (operations-first scope enforcement): clinical, ADT, non-healthcare
 * vertical, and now removed super-admin AI/marketplace/pilot schemas are not
 * re-exported from the barrel. Gated API route handlers must still enforce
 * scope through `isApiGroupEnabled()` or equivalent.
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

export { labReportSchema, uploadConfirmSchema } from "./clinical";

export { chatRequestSchema, CHAT_MESSAGE_CONTENT_MAX, aiManagerRequestSchema } from "./chat";

export { v1AppointmentCreateSchema, v1PatientCreateSchema } from "./v1";

export {
  aiTeamChatSchema,
  aiTeamTaskUpdateSchema,
  aiTeamAlertReadSchema,
  aiTeamGenerateSchema,
} from "./ai-team";

export { faqSearchSchema } from "./support";
export { safeParse } from "./helpers";

export { passwordPolicySchema, evaluatePasswordStrength } from "./password-policy";

export { timelineQuerySchema, TIMELINE_EVENT_TYPES } from "./patient-timeline";

export {
  clinicProvisionSchema,
  churnPredictionQuerySchema,
  revenueForecastQuerySchema,
} from "./super-admin";

export {
  oneClickCheckinSchema,
  phoneHandlerLookupSchema,
  attestationCreateSchema,
  attestationSignSchema,
  familyLinkCreateSchema,
  doctorDelayUpdateSchema,
  inventoryItemCreateSchema,
  inventoryItemUpdateSchema,
  inventoryTransactionSchema,
} from "./batch4c";

export {
  invoiceCreateSchema,
  invoiceUpdateSchema,
  paymentPlanCreateSchema,
  installmentUpdateSchema,
  reminderSendSchema,
  revenueInsightsQuerySchema,
} from "./billing";
