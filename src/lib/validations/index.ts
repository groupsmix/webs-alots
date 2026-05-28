/**
 * Barrel re-export for all validation schemas.
 *
 * This file preserves backward compatibility — existing imports from
 * `@/lib/validations` continue to work unchanged. New code should import
 * directly from the domain module (e.g. `@/lib/validations/booking`).
 */

export { normalizeText, safeText, safeName } from "./primitives";
export { isoDate, timeHHMM, phoneNumber } from "./primitives";

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
export type { StripeWebhookEvent, CmiCallbackFields, SubscriptionWebhookEvent } from "./payments";

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
  clinicFeaturesQuerySchema,
  verifyEmailSendSchema,
  verifyEmailConfirmSchema,
} from "./admin";

export {
  labReportSchema,
  radiologyOrderCreateSchema,
  radiologyOrderPatchSchema,
  radiologyReportPdfSchema,
  uploadPresignedSchema,
  uploadConfirmSchema,
  petProfileCreateSchema,
  petProfileUpdateSchema,
} from "./clinical";

export {
  chatRequestSchema,
  CHAT_MESSAGE_CONTENT_MAX,
  aiPrescriptionRequestSchema,
  aiPatientSummaryRequestSchema,
  aiDrugCheckRequestSchema,
  aiDrugCheckOverrideSchema,
  aiManagerRequestSchema,
  aiAutoSuggestRequestSchema,
} from "./chat";
export type {
  AiPrescriptionRequest,
  AiPatientSummaryRequest,
  AiDrugCheckRequest,
  AiDrugCheckOverride,
  AiManagerRequest,
  AiAutoSuggestRequest,
} from "./chat";

export { v1AppointmentCreateSchema, v1PatientCreateSchema } from "./v1";

export {
  menuCreateSchema,
  menuUpdateSchema,
  menuItemCreateSchema,
  menuItemUpdateSchema,
  restaurantTableCreateSchema,
  restaurantTableUpdateSchema,
  restaurantOrderCreateSchema,
  restaurantOrderUpdateSchema,
} from "./restaurant";

export { safeParse } from "./helpers";
