/**
 * Zod validation schemas for API route payloads.
 *
 * Centralised here so that every route validates `request.json()` through a
 * typed schema instead of trusting raw `as` type assertions.
 */

import { z } from "zod";

// ── Reusable primitives ─────────────────────────────────────────────────

/** UUID-like string (basic format check, not cryptographic) */
const _uuid = z.string().min(1).max(100);

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

export const cmiPaymentSchema = z.object({
  amount: z.number().positive().finite(),
  description: z.string().max(500).optional(),
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
  clinic_id: z.string().min(1),
  entity_type: z.string().min(1).max(100),
  entity_id: z.string().min(1),
  field_values: z.record(z.string(), z.unknown()),
});

// ── Lab ─────────────────────────────────────────────────────────────────

export const labReportSchema = z.object({
  orderId: z.string().min(1),
  clinicId: z.string().min(1),
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
  clinicId: z.string().min(1),
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
  clinicId: z.string().min(1),
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

// ── Chat ────────────────────────────────────────────────────────────────

export const chatRequestSchema = z.object({
  clinicId: z.string().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      }),
    )
    .min(1),
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
