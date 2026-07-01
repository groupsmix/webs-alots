/**
 * Barrel re-export for all validation schemas.
 *
 * This file preserves backward compatibility — existing imports from
 * `@/lib/validations` continue to work unchanged. New code should import
 * directly from the domain module (e.g. `@/lib/validations/booking`).
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

export {
  labReportSchema,
  radiologyOrderCreateSchema,
  radiologyOrderPatchSchema,
  radiologyReportPdfSchema,
  uploadConfirmSchema,
  petProfileCreateSchema,
  petProfileUpdateSchema,
} from "./clinical";

export { chatRequestSchema, CHAT_MESSAGE_CONTENT_MAX, aiManagerRequestSchema } from "./chat";

export { v1AppointmentCreateSchema, v1PatientCreateSchema } from "./v1";

export { restaurantOrderCreateSchema, restaurantOrderUpdateSchema } from "./restaurant";

export {
  smartScheduleSchema,
  smartScheduleConfirmSchema,
  sendRemindersSchema,
  waitlistAddSchema,
  waitlistNotifySchema,
  waitlistPromoteSchema,
  noShowMarkSchema,
} from "./receptionist-ai";

export {
  aiTeamChatSchema,
  aiTeamTaskUpdateSchema,
  aiTeamAlertReadSchema,
  aiTeamGenerateSchema,
  AI_AGENT_TYPES,
} from "./ai-team";
export { safeParse } from "./helpers";

export {
  faqCreateSchema,
  faqUpdateSchema,
  faqDeleteSchema,
  faqSearchSchema,
  ticketCreateSchema,
  ticketUpdateSchema,
  ticketRatingSchema,
  ticketMessageSchema,
  whatsappInboundSchema,
  SUPPORTED_LANGUAGES,
  FAQ_CATEGORIES,
  TICKET_CHANNELS,
  TICKET_STATUSES,
  TICKET_PRIORITIES,
} from "./support";
export { passwordPolicySchema, evaluatePasswordStrength } from "./password-policy";
export {
  qrCheckinGenerateSchema,
  qrCheckinScanSchema,
  waitingQueueUpdateSchema,
  npsSurveyResponseSchema,
} from "./patient-experience";

export { timelineQuerySchema, TIMELINE_EVENT_TYPES } from "./patient-timeline";
export {
  expenseCategoryCreateSchema,
  expenseCategoryUpdateSchema,
  expenseCreateSchema,
  expenseUpdateSchema,
  campaignCreateSchema,
  campaignUpdateSchema,
  patientAcquisitionCreateSchema,
  insuranceClaimCreateSchema,
  insuranceClaimUpdateSchema,
  revenueQuerySchema,
} from "./clinic-owner";

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

export { admissionCreateSchema, dischargeSchema, transferSchema } from "./adt";

export {
  staffInviteSchema,
  staffInviteAcceptSchema,
  staffInviteRevokeSchema,
  staffInviteQuerySchema,
} from "./staff-invitations";

export { insuranceClaimQuerySchema } from "./insurance-claims";
