/**
 * Zod validation schemas for API route payloads.
 *
 * Centralised here so that every route validates `request.json()` through a
 * typed schema instead of trusting raw `as` type assertions.
 *
 * F-30: This 700+ LOC file should be split into domain-specific modules:
 *   - validations/booking.ts
 *   - validations/payments.ts
 *   - validations/patients.ts
 *   - validations/admin.ts
 *   - validations/chat.ts
 *   - validations/webhooks.ts
 *   - validations/index.ts (barrel re-export)
 *
 * When splitting, keep this file as the barrel (re-exporting everything)
 * to avoid breaking existing imports.
 */

import { z } from "zod";

// ── Reusable primitives ─────────────────────────────────────────────────

/** ISO date string YYYY-MM-DD */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

/** Time string HH:MM */
const timeHHMM = z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:MM");

// ── Booking ─────────────────────────────────────────────────────────────

export const bookingCancelSchema = z.object({
  appointmentId: z.string().min(1),
  reason: z.string().max(1000).optional(),
});

export const emergencySlotCreateSchema = z.object({
  action: z.literal("create"),
  doctorId: z.string().min(1),
  date: isoDate,
  startTime: timeHHMM,
  durationMin: z.number().int().min(1).max(480),
  reason: z.string().max(1000).optional(),
});

export const emergencySlotBookSchema = z.object({
  action: z.literal("book"),
  slotId: z.string().min(1),
  patientId: z.string().min(1),
  patientName: z.string().min(1).max(200),
  patientPhone: z.string().max(30).optional(),
  serviceId: z.string().optional(),
});

export const emergencySlotSchema = z.discriminatedUnion("action", [
  emergencySlotCreateSchema,
  emergencySlotBookSchema,
]);

export const recurringCreateSchema = z.object({
  action: z.literal("create"),
  patientId: z.string().min(1),
  patientName: z.string().min(1).max(200),
  patientPhone: z.string().max(30).optional(),
  doctorId: z.string().min(1),
  serviceId: z.string().optional(),
  date: isoDate,
  time: timeHHMM,
  pattern: z.enum(["weekly", "biweekly", "monthly"]),
  occurrences: z.number().int().min(1).max(52),
  isFirstVisit: z.boolean().optional(),
  hasInsurance: z.boolean().optional(),
});

export const recurringCancelSchema = z.object({
  action: z.literal("cancel"),
  groupId: z.string().optional(),
  cancelAll: z.boolean().optional(),
  appointmentId: z.string().optional(),
});

export const recurringSchema = z.discriminatedUnion("action", [
  recurringCreateSchema,
  recurringCancelSchema,
]);

export const rescheduleSchema = z.object({
  appointmentId: z.string().min(1),
  newDate: isoDate,
  newTime: timeHHMM,
});

export const waitingListSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().min(1).max(200),
  patientPhone: z.string().max(30).optional(),
  doctorId: z.string().min(1),
  preferredDate: isoDate,
  preferredTime: timeHHMM.optional(),
  serviceId: z.string().optional(),
  /** Honeypot field – hidden from real users, filled only by bots (Issue 51) */
  website: z.string().max(200).optional(),
});

export const paymentConfirmSchema = z.object({
  paymentId: z.string().min(1),
});

export const paymentInitiateSchema = z.object({
  appointmentId: z.string().min(1),
  patientId: z.string().min(1),
  patientName: z.string().min(1).max(200),
  amount: z.number().positive().finite(),
  paymentType: z.enum(["deposit", "full"]),
  method: z.enum(["cash", "card", "online", "insurance"]).optional(),
});

export const paymentRefundSchema = z.object({
  paymentId: z.string().min(1),
  amount: z.number().positive().finite().optional(),
});

// ── Payments ────────────────────────────────────────────────────────────

/**
 * Stripe webhook event schema — validates the parsed JSON body after
 * signature verification for defense-in-depth on payment events.
 */
const stripeWebhookEventObjectSchema = z.object({
  id: z.string().min(1),
  metadata: z.record(z.string(), z.string()).optional(),
  // AUDIT-05: Stripe PaymentIntent uses `amount`, while Checkout Session uses
  // `amount_total`. Both are optional since the event type determines which
  // field is present.
  /** PaymentIntent.amount — present on payment_intent.* events. */
  amount: z.number().optional(),
  /** Checkout Session.amount_total — present on checkout.session.* events. */
  amount_total: z.number().optional(),
  currency: z.string().optional(),
  payment_status: z.string().optional(),
  customer_email: z.string().optional(),
});

export const stripeWebhookEventSchema = z.object({
  type: z.string().min(1),
  data: z.object({
    object: stripeWebhookEventObjectSchema,
  }),
});

export type StripeWebhookEvent = z.infer<typeof stripeWebhookEventSchema>;

/**
 * CMI callback form data schema — validates the parsed form fields after
 * HMAC signature verification for defense-in-depth on payment callbacks.
 */
/**
 * S-06: CMI callback allow-list. Only known CMI parameters are accepted;
 * unknown parameters are rejected to prevent HMAC reconstruction with
 * attacker-injected fields.
 */
const CMI_ALLOWED_PARAMS = new Set([
  'oid', 'OID', 'amount', 'AMOUNT', 'currency', 'ProcReturnCode',
  'procreturncode', 'TransId', 'transid', 'AuthCode', 'authcode',
  'HASH', 'hash', 'encoding', 'hashAlgorithm', 'clientid',
  'okUrl', 'failUrl', 'callbackUrl', 'shopurl', 'TranType', 'lang',
  'BillToName', 'email', 'description', 'storeType', 'Response',
  'mdStatus', 'txstatus', 'iReqCode', 'iReqDetail', 'vendorCode',
  'PAResSyntaxOK', 'PAResVerified', 'cavv', 'cavvAlgorithm', 'eci',
  'xid', 'md', 'rnd', 'EXTRA.TRXDATE', 'EXTRA.CARDBRAND',
  'EXTRA.CARDISSUER', 'EXTRA.CARDTYPE', 'EXTRA.HOSTMSG',
]);

export const cmiCallbackFieldsSchema = z.object({
  oid: z.string().optional(),
  OID: z.string().optional(),
  amount: z.string().optional(),
  AMOUNT: z.string().optional(),
  ProcReturnCode: z.string().optional(),
  procreturncode: z.string().optional(),
  TransId: z.string().optional(),
  transid: z.string().optional(),
  AuthCode: z.string().optional(),
  authcode: z.string().optional(),
  HASH: z.string().optional(),
  hash: z.string().optional(),
}).passthrough().refine(
  (data) => Boolean(data.HASH || data.hash),
  { message: "Missing required HASH field" },
).refine(
  (data) => {
    // S-06: Reject any unknown parameters not in the CMI allow-list
    const keys = Object.keys(data);
    return keys.every((k) => CMI_ALLOWED_PARAMS.has(k) || k.startsWith('rnd_') || k.startsWith('EXTRA.'));
  },
  { message: "Unknown parameter in CMI callback — potential tampering" },
);

export type CmiCallbackFields = z.infer<typeof cmiCallbackFieldsSchema>;

export const cmiPaymentSchema = z.object({
  amount: z.number().positive().finite(),
  // S-16: Cap description length and restrict charset to prevent injection
  description: z.string().max(200).regex(/^[\w\s\-.,;:!?()éèêëàâôùûçïöüÉÈÊËÀÂÔÙÛÇÏÖÜ]*$/u, "Invalid characters in description").optional(),
  patientId: z.string().optional(),
  appointmentId: z.string().optional(),
  successUrl: z.string().url().optional(),
  failUrl: z.string().url().optional(),
});

export const stripeCheckoutSchema = z.object({
  amount: z.number().positive().finite(),
  currency: z.string().min(1).max(10).optional(),
  description: z.string().max(500).optional(),
  patientId: z.string().optional(),
  appointmentId: z.string().optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

// ── Notifications ───────────────────────────────────────────────────────

const notificationChannelEnum = z.enum(["whatsapp", "in_app", "sms", "email"]);

export const notificationDispatchSchema = z.object({
  trigger: z.string().min(1),
  variables: z.record(z.string(), z.unknown()).optional().default({}),
  recipientId: z.string().min(1),
  channels: z.array(notificationChannelEnum).min(1),
});

export const notificationTriggerSchema = z.object({
  trigger: z.string().min(1),
  variables: z.record(z.string(), z.unknown()).optional().default({}),
  recipients: z
    .array(
      z.object({
        id: z.string().min(1),
        channels: z.array(notificationChannelEnum).min(1),
      }),
    )
    .min(1),
});

// ── Onboarding ──────────────────────────────────────────────────────────

export const onboardingSchema = z.object({
  clinic_type_key: z.string().min(1).max(100),
  category: z.string().max(100).optional(),
  clinic_name: z.string().min(1).max(200),
  owner_name: z.string().min(1).max(200),
  phone: z.string().min(1).max(30),
  email: z.string().email().max(254).optional(),
  city: z.string().max(200).optional(),
});

// ── Impersonate ─────────────────────────────────────────────────────────

export const impersonateSchema = z.object({
  clinicId: z.string().min(1),
  clinicName: z.string().max(200).optional(),
  password: z.string().min(1, "Password is required for impersonation"),
  reason: z.string().min(3, "A reason is required for impersonation").max(500),
});

// ── Custom Fields ───────────────────────────────────────────────────────

export const customFieldCreateSchema = z.object({
  clinic_type_key: z.string().min(1).max(100),
  entity_type: z.string().min(1).max(100),
  field_key: z.string().min(1).max(100),
  field_type: z.string().min(1).max(50),
  label_fr: z.string().min(1).max(200),
  label_ar: z.string().max(200).optional().default(""),
  description: z.string().max(500).nullable().optional().default(null),
  placeholder: z.string().max(200).nullable().optional().default(null),
  is_required: z.boolean().optional().default(false),
  sort_order: z.number().int().optional().default(0),
  options: z.array(z.unknown()).optional().default([]),
  validation: z.record(z.string(), z.unknown()).optional().default({}),
  default_value: z.unknown().nullable().optional().default(null),
});

export const customFieldUpdateSchema = z.object({
  id: z.string().min(1),
  label_fr: z.string().min(1).max(200).optional(),
  label_ar: z.string().max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  placeholder: z.string().max(200).nullable().optional(),
  is_required: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  options: z.array(z.unknown()).optional(),
  validation: z.record(z.string(), z.unknown()).optional(),
  default_value: z.unknown().nullable().optional(),
  is_active: z.boolean().optional(),
});

export const customFieldValuesSchema = z.object({
  /** @deprecated Ignored by the server — clinic_id is derived from the authenticated user's profile. Remove after v2 API migration (all clients updated). */
  clinic_id: z.string().optional(),
  entity_type: z.string().min(1).max(100),
  entity_id: z.string().min(1),
  field_values: z.record(z.string(), z.unknown()),
});

// ── Lab ─────────────────────────────────────────────────────────────────

export const labReportSchema = z.object({
  orderId: z.string().min(1),
  /** @deprecated Ignored by the server — clinicId is derived from the authenticated user's profile. Remove after v2 API migration (all clients updated). */
  clinicId: z.string().optional(),
  patientName: z.string().min(1).max(200),
  orderNumber: z.string().min(1).max(100),
  results: z
    .array(
      z.object({
        testName: z.string().min(1),
        value: z.string().nullable(),
        unit: z.string().nullable(),
        referenceMin: z.number().nullable(),
        referenceMax: z.number().nullable(),
        flag: z.string().nullable(),
      }),
    )
    .min(1),
});

// ── Radiology ───────────────────────────────────────────────────────────

export const radiologyOrderCreateSchema = z.object({
  /** @deprecated Ignored by the server — clinicId is derived from the authenticated user's profile. Remove after v2 API migration (all clients updated). */
  clinicId: z.string().optional(),
  patientId: z.string().min(1),
  modality: z.string().min(1).max(100),
  bodyPart: z.string().max(200).optional(),
  clinicalIndication: z.string().max(1000).optional(),
  priority: z.string().max(50).optional(),
  scheduledAt: z.string().optional(),
  orderingDoctorId: z.string().optional(),
});

const radiologyStatusUpdateSchema = z.object({
  orderId: z.string().min(1),
  action: z.literal("status"),
  status: z.string().min(1),
});

const radiologyReportSaveSchema = z.object({
  orderId: z.string().min(1),
  action: z.literal("report"),
  findings: z.string().optional(),
  impression: z.string().optional(),
  reportText: z.string().optional(),
  templateId: z.string().optional(),
  radiologistId: z.string().optional(),
});

export const radiologyOrderPatchSchema = z.discriminatedUnion("action", [
  radiologyStatusUpdateSchema,
  radiologyReportSaveSchema,
]);

export const radiologyReportPdfSchema = z.object({
  orderId: z.string().min(1),
  /** @deprecated Ignored by the server — clinicId is derived from the authenticated user's profile. Remove after v2 API migration (all clients updated). */
  clinicId: z.string().optional(),
  patientName: z.string().min(1).max(200),
  modality: z.string().min(1).max(100),
  bodyPart: z.string().max(200).optional(),
  findings: z.string().optional(),
  impression: z.string().optional(),
  reportText: z.string().optional(),
  radiologistName: z.string().max(200).optional(),
});

// ── V1 Public API ───────────────────────────────────────────────────────

export const v1AppointmentCreateSchema = z.object({
  patient_id: z.string().min(1).max(100),
  doctor_id: z.string().min(1).max(100),
  appointment_date: z.string().min(1).max(10),
  start_time: z.string().min(1).max(8),
  end_time: z.string().max(8).optional(),
  status: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
});

export const v1PatientCreateSchema = z.object({
  full_name: z.string().min(1).max(200),
  email: z.string().email().max(254).optional().or(z.literal("")),
  phone: z.string().max(30).optional(),
  date_of_birth: z.string().optional(),
  gender: z.string().max(20).optional(),
  insurance_type: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
});

// ── AI Prescription ──────────────────────────────────────────────────────

export const aiPrescriptionRequestSchema = z.object({
  patientId: z.string().min(1),
  diagnosis: z.string().min(1).max(2000),
  symptoms: z.string().max(2000).optional(),
  patientContext: z.object({
    age: z.number().int().min(0).max(150).optional(),
    gender: z.enum(["M", "F"]).optional(),
    allergies: z.array(z.string().max(200)).optional(),
    currentMedications: z.array(z.string().max(200)).optional(),
    chronicConditions: z.array(z.string().max(200)).optional(),
    weight: z.number().positive().max(500).optional(),
  }).optional(),
});

export type AiPrescriptionRequest = z.infer<typeof aiPrescriptionRequestSchema>;

// ── Chat ────────────────────────────────────────────────────────────────

/**
 * D-1 (STRIDE): bound the chat payload at the schema level so a single
 * request cannot exhaust LLM token budgets or memory before it ever
 * reaches the route handler. The route's runtime checks
 * (`MAX_HISTORY_LENGTH`, `MAX_MESSAGE_LENGTH`) remain as defense-in-depth.
 */
export const CHAT_MESSAGE_MAX_LENGTH = 4000;
export const CHAT_HISTORY_MAX_MESSAGES = 20;

export const chatRequestSchema = z.object({
  clinicId: z.string().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(CHAT_MESSAGE_MAX_LENGTH),
      }),
    )
    .min(1)
    .max(CHAT_HISTORY_MAX_MESSAGES),
});

// ── Branding ────────────────────────────────────────────────────────────

export const brandingUpdateSchema = z.object({
  primary_color: z.string().max(20).optional(),
  secondary_color: z.string().max(20).optional(),
  heading_font: z.string().max(100).optional(),
  body_font: z.string().max(100).optional(),
  name: z.string().max(200).optional(),
  tagline: z.string().max(500).optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  template_id: z.string().max(50).optional(),
  section_visibility: z.record(z.string(), z.boolean()).optional(),
});

export const applyPresetSchema = z.object({
  presetId: z.string().min(1).max(100),
});

// ── Upload ──────────────────────────────────────────────────────────────

export const uploadPresignedSchema = z.object({
  filename: z.string().min(1).max(500),
  contentType: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  clinicId: z.string().optional(),
});

export const uploadConfirmSchema = z.object({
  key: z.string().min(1).max(1000),
  contentType: z.string().min(1).max(200),
});

// ── Consent ─────────────────────────────────────────────────────────────

export const consentSchema = z.object({
  consentType: z.enum([
    "cookies_accepted",
    "cookies_declined",
    "data_processing",
    "marketing_emails",
    "terms_accepted",
    "privacy_policy_accepted",
  ]),
  granted: z.boolean(),
});

// ── Clinic Features ─────────────────────────────────────────────────────

export const clinicFeaturesQuerySchema = z.object({
  type_key: z.string().min(1).max(100),
});

// ── Verify Email ────────────────────────────────────────────────────────

export const verifyEmailSendSchema = z.object({
  email: z.string().email().max(254),
});

export const verifyEmailConfirmSchema = z.object({
  email: z.string().email().max(254),
  code: z.string().length(6),
});

// ── AI Patient Summary ──────────────────────────────────────────────────

export const aiPatientSummaryRequestSchema = z.object({
  patientId: z.string().min(1),
  forceRefresh: z.boolean().optional().default(false),
});

export type AiPatientSummaryRequest = z.infer<typeof aiPatientSummaryRequestSchema>;

// ── AI Drug Interaction Checker ─────────────────────────────────────────

export const aiDrugCheckRequestSchema = z.object({
  medications: z.array(z.string().min(1).max(200)).min(1).max(50),
  patientId: z.string().min(1).optional(),
  patientAllergies: z.array(z.string().max(200)).optional(),
  useAiFallback: z.boolean().optional().default(true),
});

export type AiDrugCheckRequest = z.infer<typeof aiDrugCheckRequestSchema>;

export const aiDrugCheckOverrideSchema = z.object({
  patientId: z.string().min(1).optional(),
  alertId: z.string().min(1),
  alertSeverity: z.enum(["dangerous", "caution"]),
  alertTitle: z.string().max(500),
  reason: z.string().min(1).max(2000),
  medications: z.array(z.string()).min(1),
});

export type AiDrugCheckOverride = z.infer<typeof aiDrugCheckOverrideSchema>;

// ── Doctor Unavailability ────────────────────────────────────────────────

export const doctorUnavailabilitySchema = z.object({
  doctorId: z.string().min(1),
  /** AUDIT F-01: clinicId is now optional — subdomain-derived tenant is authoritative.
   *  If provided, it is validated against the subdomain in the route handler. */
  clinicId: z.string().min(1).optional(),
  startDate: isoDate,
  endDate: isoDate,
  reason: z.string().max(1000).optional(),
});

// ── Check-in ────────────────────────────────────────────────────────────

export const checkinConfirmSchema = z.object({
  appointmentId: z.string().min(1),
  /** AUDIT F-04: clinicId is now optional — subdomain-derived tenant is authoritative.
   *  If provided, it is validated against the subdomain in the route handler. */
  clinicId: z.string().min(1).optional(),
});

// ── Waiting List Delete ─────────────────────────────────────────────────

export const waitingListDeleteSchema = z.object({
  entryId: z.string().min(1),
});

// ── Billing (Subscription) ───────────────────────────────────────────────

export const subscriptionCheckoutSchema = z.object({
  planId: z.enum(["starter", "professional", "enterprise"]),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export const subscriptionPortalSchema = z.object({
  returnUrl: z.string().url().optional(),
});

/**
 * Stripe subscription webhook event schema — validates the parsed JSON body
 * after signature verification for defense-in-depth on subscription events.
 */
const subscriptionWebhookObjectSchema = z.object({
  id: z.string().min(1),
  metadata: z.record(z.string(), z.string()).optional(),
  amount_total: z.number().optional(),
  amount_paid: z.number().optional(),
  currency: z.string().optional(),
  payment_status: z.string().optional(),
  customer_email: z.string().optional(),
  customer: z.string().optional(),
  subscription: z.string().optional(),
  status: z.string().optional(),
  current_period_end: z.number().optional(),
  items: z.object({
    data: z.array(z.object({
      price: z.object({ id: z.string() }).optional(),
    })),
  }).optional(),
});

export const subscriptionWebhookEventSchema = z.object({
  type: z.string().min(1),
  data: z.object({
    object: subscriptionWebhookObjectSchema,
  }),
});

export type SubscriptionWebhookEvent = z.infer<typeof subscriptionWebhookEventSchema>;

// ── AI Manager (Smart Dashboard Assistant) ──────────────────────────────

export const aiManagerRequestSchema = z.object({
  question: z.string().min(1).max(2000),
  conversationHistory: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ).max(20).optional().default([]),
});

export type AiManagerRequest = z.infer<typeof aiManagerRequestSchema>;

// ── AI Auto-Suggest (Smart Prescription Suggestions) ────────────────────

export const aiAutoSuggestRequestSchema = z.object({
  diagnosis: z.string().min(1).max(2000),
  patientId: z.string().min(1).optional(),
  patientContext: z.object({
    age: z.number().int().min(0).max(150).optional(),
    gender: z.enum(["M", "F"]).optional(),
    allergies: z.array(z.string().max(200)).optional(),
    currentMedications: z.array(z.string().max(200)).optional(),
    chronicConditions: z.array(z.string().max(200)).optional(),
    weight: z.number().positive().max(500).optional(),
  }).optional(),
});

export type AiAutoSuggestRequest = z.infer<typeof aiAutoSuggestRequestSchema>;

// ── Pet Profiles (Veterinary) ────────────────────────────────────────────

const petSpeciesEnum = z.enum([
  "dog", "cat", "bird", "rabbit", "hamster", "fish",
  "reptile", "horse", "cattle", "sheep", "goat", "other",
]);

export const petProfileCreateSchema = z.object({
  name: z.string().min(1).max(200),
  species: petSpeciesEnum,
  breed: z.string().max(200).optional(),
  weight_kg: z.number().positive().max(10000).optional(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD").optional(),
  photo_url: z.string().url().max(2000).optional(),
  notes: z.string().max(5000).optional(),
  owner_id: z.string().min(1),
});

export const petProfileUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  species: petSpeciesEnum.optional(),
  breed: z.string().max(200).nullable().optional(),
  weight_kg: z.number().positive().max(10000).nullable().optional(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD").nullable().optional(),
  photo_url: z.string().url().max(2000).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  is_active: z.boolean().optional(),
});

// ── Menu Management (Restaurant) ────────────────────────────────────────

export const menuCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().optional().default(0),
});

export const menuUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

export const menuItemCreateSchema = z.object({
  menu_id: z.string().min(1),
  category: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.number().min(0).finite(),
  photo_url: z.string().url().max(2000).optional(),
  is_available: z.boolean().optional().default(true),
  allergens: z.array(z.string().max(100)).optional().default([]),
  is_halal: z.boolean().optional().default(true),
  sort_order: z.number().int().optional().default(0),
});

export const menuItemUpdateSchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1).max(200).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  price: z.number().min(0).finite().optional(),
  photo_url: z.string().url().max(2000).nullable().optional(),
  is_available: z.boolean().optional(),
  allergens: z.array(z.string().max(100)).optional(),
  is_halal: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

// ── Table Management (Restaurant) ───────────────────────────────────────

export const restaurantTableCreateSchema = z.object({
  name: z.string().min(1).max(200),
  capacity: z.number().int().min(1).max(100),
  zone: z.string().max(200).optional(),
  is_active: z.boolean().optional().default(true),
});

export const restaurantTableUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  capacity: z.number().int().min(1).max(100).optional(),
  zone: z.string().max(200).nullable().optional(),
  is_active: z.boolean().optional(),
});

// ── Orders (Restaurant) ─────────────────────────────────────────────────

const orderItemSchema = z.object({
  menu_item_id: z.string().min(1),
  name: z.string().min(1).max(200),
  quantity: z.number().int().min(1).max(999),
  unit_price: z.number().min(0).finite(),
  notes: z.string().max(500).optional(),
});

export const restaurantOrderCreateSchema = z.object({
  table_id: z.string().min(1).optional(),
  appointment_id: z.string().min(1).optional(),
  items: z.array(orderItemSchema).min(1),
  notes: z.string().max(2000).optional(),
});

export const restaurantOrderUpdateSchema = z.object({
  id: z.string().min(1),
  status: z.enum([
    "pending", "confirmed", "preparing", "ready", "served", "paid", "cancelled",
  ]).optional(),
  items: z.array(orderItemSchema).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

// ── Helper: parse with friendly error response ──────────────────────────

/**
 * Parse a value with a Zod schema and return the parsed data or a
 * formatted error message suitable for an API response.
 */
export function safeParse<T>(
  schema: z.ZodType<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const message = result.error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
  return { success: false, error: `Validation error: ${message}` };
}
