/**
 * Notification Engine
 *
 * Core notification system with template-based messaging,
 * variable substitution, and multi-channel delivery (WhatsApp + In-App).
 *
 * For the Meta Business API template approval workflow, variable mappings,
 * and submission guide, see {@link ../../../docs/whatsapp-template-approval.md}.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

// ---- Notification Trigger Types ----

export type NotificationTrigger =
  | "new_booking"
  | "booking_confirmation"
  | "reminder_24h"
  | "reminder_1h"
  | "reminder_2h"
  | "cancellation"
  | "no_show"
  | "prescription_ready"
  | "new_review"
  | "payment_received"
  | "new_patient_registered"
  | "rescheduled"
  | "doctor_assigned"
  | "follow_up";

export type NotificationChannel = "whatsapp" | "in_app" | "email" | "sms";

type NotificationPriority = "low" | "normal" | "high" | "urgent";

type NotificationStatus = "pending" | "sent" | "delivered" | "failed" | "read";

// ---- Template Variable Types ----

export interface TemplateVariables {
  patient_name?: string;
  doctor_name?: string;
  clinic_name?: string;
  clinic_phone?: string;
  clinic_address?: string;
  service_name?: string;
  date?: string;
  time?: string;
  amount?: string;
  currency?: string;
  booking_url?: string;
  manage_url?: string;
  cancellation_reason?: string;
  prescription_id?: string;
  review_stars?: string;
  review_comment?: string;
  payment_method?: string;
  invoice_id?: string;
  [key: string]: string | undefined;
}

// ---- Notification Template ----

export interface NotificationTemplate {
  id: string;
  trigger: NotificationTrigger;
  name: string;
  label: string;
  channels: NotificationChannel[];
  subject: string;
  body: string;
  whatsappBody: string;
  enabled: boolean;
  priority: NotificationPriority;
  recipientRoles: ("patient" | "doctor" | "receptionist" | "clinic_admin")[];
}

// ---- Notification Log Entry ----

export interface NotificationLogEntry {
  id: string;
  trigger: NotificationTrigger;
  channel: NotificationChannel;
  recipientId: string;
  recipientName: string;
  recipientRole: string;
  title: string;
  body: string;
  status: NotificationStatus;
  priority: NotificationPriority;
  metadata?: Record<string, string>;
  createdAt: string;
  sentAt?: string;
  readAt?: string;
  error?: string;
}

// ---- Template Variable Substitution Engine ----

/**
 * Replaces {{variable_name}} placeholders in a template string
 * with values from the variables object.
 */
export function substituteVariables(template: string, variables: TemplateVariables): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return variables[key] ?? match;
  });
}

// ---- Default Notification Templates ----

export const defaultNotificationTemplates: NotificationTemplate[] = [
  {
    id: "tpl_new_booking",
    trigger: "new_booking",
    name: "new_booking",
    label: "New Booking",
    channels: ["whatsapp", "in_app"],
    subject: "New Appointment Booked",
    body: "A new appointment has been booked for {{patient_name}} with {{doctor_name}} on {{date}} at {{time}} for {{service_name}}.",
    whatsappBody:
      "New booking: {{patient_name}} with {{doctor_name}} on {{date}} at {{time}}. Service: {{service_name}}.",
    enabled: true,
    priority: "normal",
    recipientRoles: ["receptionist", "doctor", "clinic_admin"],
  },
  {
    id: "tpl_booking_confirmation",
    trigger: "booking_confirmation",
    name: "booking_confirmation",
    label: "Booking Confirmation",
    channels: ["whatsapp", "in_app"],
    subject: "Appointment Confirmed",
    body: "Your appointment with {{doctor_name}} is confirmed for {{date}} at {{time}}. Service: {{service_name}}. {{clinic_name}}",
    whatsappBody:
      "Hello {{patient_name}}, your appointment with Dr. {{doctor_name}} is confirmed.\n\nDate: {{date}}\nTime: {{time}}\nService: {{service_name}}\nAddress: {{clinic_address}}\n\nManage/cancel: {{manage_url}}\n\n{{clinic_name}}",
    enabled: true,
    priority: "high",
    recipientRoles: ["patient"],
  },
  {
    id: "tpl_reminder_24h",
    trigger: "reminder_24h",
    name: "reminder_24h",
    label: "24-Hour Reminder",
    channels: ["whatsapp", "in_app"],
    subject: "Appointment Tomorrow",
    body: "Reminder: You have an appointment with {{doctor_name}} tomorrow at {{time}}. {{clinic_name}} — {{clinic_address}}",
    whatsappBody:
      "Reminder: You have an appointment with {{doctor_name}} tomorrow at {{time}}. {{clinic_name}} — {{clinic_address}}. Reply CONFIRM to confirm or CANCEL to cancel.",
    enabled: true,
    priority: "high",
    recipientRoles: ["patient"],
  },
  {
    id: "tpl_reminder_1h",
    trigger: "reminder_1h",
    name: "reminder_1h",
    label: "1-Hour Reminder",
    channels: ["whatsapp", "in_app"],
    subject: "Appointment in 1 Hour",
    body: "Your appointment with {{doctor_name}} is in 1 hour at {{time}}. Please arrive 10 minutes early. {{clinic_name}}",
    whatsappBody:
      "Your appointment with {{doctor_name}} is in 1 hour at {{time}}. Please arrive 10 minutes early. {{clinic_name}} — {{clinic_address}}",
    enabled: true,
    priority: "urgent",
    recipientRoles: ["patient"],
  },
  {
    id: "tpl_reminder_2h",
    trigger: "reminder_2h",
    name: "reminder_2h",
    label: "2-Hour Reminder",
    channels: ["whatsapp", "in_app"],
    subject: "Appointment in 2 Hours",
    body: "Your appointment with {{doctor_name}} is in 2 hours at {{time}}. Please arrive 10 minutes early. {{clinic_name}}",
    whatsappBody:
      "Your appointment with {{doctor_name}} is in 2 hours at {{time}}. Please arrive 10 minutes early. {{clinic_name}} — {{clinic_address}}",
    enabled: true,
    priority: "urgent",
    recipientRoles: ["patient"],
  },
  {
    id: "tpl_cancellation",
    trigger: "cancellation",
    name: "cancellation",
    label: "Cancellation Notice",
    channels: ["whatsapp", "in_app"],
    subject: "Appointment Cancelled",
    body: "Your appointment with {{doctor_name}} on {{date}} at {{time}} has been cancelled. Please contact us to reschedule.",
    whatsappBody:
      "Your appointment with {{doctor_name}} on {{date}} at {{time}} has been cancelled. Contact us at {{clinic_phone}} to reschedule.",
    enabled: true,
    priority: "high",
    recipientRoles: ["patient", "doctor", "receptionist"],
  },
  {
    id: "tpl_no_show",
    trigger: "no_show",
    name: "no_show",
    label: "No-Show Notification",
    channels: ["whatsapp", "in_app"],
    subject: "Missed Appointment",
    body: "You missed your appointment with {{doctor_name}} on {{date}} at {{time}}. Would you like to reschedule?",
    whatsappBody:
      "Hello {{patient_name}}, we noticed you missed your appointment on {{date}}. Would you like to reschedule? Contact us at {{clinic_phone}}.",
    enabled: true,
    priority: "normal",
    recipientRoles: ["patient"],
  },
  {
    id: "tpl_prescription_ready",
    trigger: "prescription_ready",
    name: "prescription_ready",
    label: "Prescription Ready",
    channels: ["whatsapp", "in_app"],
    subject: "Prescription Ready",
    body: "Your prescription from {{doctor_name}} is ready. You can view it in your patient portal or pick it up at {{clinic_name}}.",
    whatsappBody:
      "Hello {{patient_name}}, your prescription from {{doctor_name}} is ready for pickup at {{clinic_name}}. {{clinic_address}}",
    enabled: true,
    priority: "normal",
    recipientRoles: ["patient"],
  },
  {
    id: "tpl_new_review",
    trigger: "new_review",
    name: "new_review",
    label: "New Review Received",
    channels: ["in_app"],
    subject: "New Patient Review",
    body: '{{patient_name}} left a {{review_stars}}-star review: "{{review_comment}}"',
    whatsappBody: 'New review from {{patient_name}}: {{review_stars}} stars — "{{review_comment}}"',
    enabled: true,
    priority: "low",
    recipientRoles: ["doctor", "clinic_admin"],
  },
  {
    id: "tpl_payment_received",
    trigger: "payment_received",
    name: "payment_received",
    label: "Payment Received",
    channels: ["whatsapp", "in_app"],
    subject: "Payment Confirmed",
    body: "Payment of {{amount}} {{currency}} received via {{payment_method}} for your visit on {{date}}. Thank you!",
    whatsappBody:
      "Hello {{patient_name}}, we received your payment of {{amount}} {{currency}} via {{payment_method}}. Invoice: {{invoice_id}}. Thank you! — {{clinic_name}}",
    enabled: true,
    priority: "normal",
    recipientRoles: ["patient"],
  },
  {
    id: "tpl_new_patient_registered",
    trigger: "new_patient_registered",
    name: "new_patient_registered",
    label: "New Patient Registered",
    channels: ["in_app"],
    subject: "New Patient Registration",
    body: "A new patient has registered: {{patient_name}}. Phone: {{clinic_phone}}.",
    whatsappBody: "New patient registered: {{patient_name}}. Contact: {{clinic_phone}}.",
    enabled: true,
    priority: "low",
    recipientRoles: ["receptionist", "clinic_admin"],
  },
  {
    id: "tpl_rescheduled",
    trigger: "rescheduled",
    name: "rescheduled",
    label: "Appointment Rescheduled",
    channels: ["whatsapp", "in_app", "email"],
    subject: "Appointment Rescheduled",
    body: "Your appointment with {{doctor_name}} has been rescheduled to {{date}} at {{time}}. Service: {{service_name}}. {{clinic_name}}",
    whatsappBody:
      "Hello {{patient_name}}, your appointment with {{doctor_name}} has been rescheduled to {{date}} at {{time}}. Contact us at {{clinic_phone}} if you have questions. {{clinic_name}}",
    enabled: true,
    priority: "high",
    recipientRoles: ["patient", "doctor", "receptionist"],
  },
];

// ---- Trigger Metadata ----

export const triggerMetadata: Record<
  NotificationTrigger,
  { label: string; description: string; icon: string }
> = {
  new_booking: {
    label: "New Booking",
    description: "When a new appointment is booked",
    icon: "CalendarPlus",
  },
  booking_confirmation: {
    label: "Booking Confirmation",
    description: "When an appointment is confirmed",
    icon: "CalendarCheck",
  },
  reminder_24h: {
    label: "24-Hour Reminder",
    description: "24 hours before the appointment",
    icon: "Clock",
  },
  reminder_1h: {
    label: "1-Hour Reminder",
    description: "1 hour before the appointment",
    icon: "AlarmClock",
  },
  reminder_2h: {
    label: "2-Hour Reminder",
    description: "2 hours before the appointment",
    icon: "AlarmClock",
  },
  cancellation: {
    label: "Cancellation",
    description: "When an appointment is cancelled",
    icon: "CalendarX",
  },
  no_show: {
    label: "No-Show",
    description: "When a patient misses their appointment",
    icon: "UserX",
  },
  prescription_ready: {
    label: "Prescription Ready",
    description: "When a prescription is ready for pickup",
    icon: "Pill",
  },
  new_review: {
    label: "New Review",
    description: "When a patient leaves a review",
    icon: "Star",
  },
  payment_received: {
    label: "Payment Received",
    description: "When a payment is confirmed",
    icon: "CreditCard",
  },
  new_patient_registered: {
    label: "New Patient",
    description: "When a new patient registers",
    icon: "UserPlus",
  },
  rescheduled: {
    label: "Rescheduled",
    description: "When an appointment is rescheduled",
    icon: "CalendarClock",
  },
  doctor_assigned: {
    label: "Doctor Assigned",
    description: "When a doctor is assigned to a patient",
    icon: "Stethoscope",
  },
  follow_up: {
    label: "Follow-up",
    description: "Follow-up reminder after a visit",
    icon: "RefreshCw",
  },
};

// ---- Retry Helper ----

/**
 * Sleep for the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff.
 *
 * Callers don't need to worry about transient failures — the helper
 * retries up to `maxRetries` times with exponentially increasing
 * delays (1s, 2s, 4s …). If all attempts fail the last error is
 * re-thrown so the caller can handle it.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      await sleep(Math.pow(2, i) * 1000);
    }
  }
  // Unreachable but satisfies the type checker
  throw new Error("withRetry: exhausted all attempts");
}

// ---- Notification Dispatch Engine ----

export interface DispatchResult {
  channel: NotificationChannel;
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Dispatches a notification across all configured channels.
 * Integrates with WhatsApp API (whatsapp.ts) and Supabase notifications table.
 */
export async function dispatchNotification(
  trigger: NotificationTrigger,
  variables: TemplateVariables,
  recipientId: string,
  channels: NotificationChannel[],
  templates: NotificationTemplate[] = defaultNotificationTemplates,
): Promise<DispatchResult[]> {
  const template = templates.find((t) => t.trigger === trigger && t.enabled);
  if (!template) {
    return [{ channel: "in_app", success: false, error: "Template not found or disabled" }];
  }

  const results: DispatchResult[] = [];

  // FIX (HIGH-01): Pre-fetch recipient contact info once instead of
  // creating a new Supabase client per channel (N+1 problem).
  const needsContactInfo = channels.some(
    (ch) => ch === "whatsapp" || ch === "email" || ch === "sms",
  );
  let recipientPhone: string | null = null;
  let recipientEmail: string | null = null;

  if (needsContactInfo) {
    const { createClient } = await import("@/lib/supabase-server");
    const supabase = await createClient();
    const { data: recipientData } = await supabase
      .from("users")
      .select("phone, email")
      .eq("id", recipientId)
      .single();
    recipientPhone = recipientData?.phone ?? null;
    recipientEmail = recipientData?.email ?? null;
  }

  for (const channel of channels) {
    if (!template.channels.includes(channel)) continue;

    try {
      switch (channel) {
        case "whatsapp": {
          const body = substituteVariables(template.whatsappBody, variables);

          if (!recipientPhone) {
            results.push({
              channel: "whatsapp",
              success: false,
              error: "Recipient has no phone number on file",
            });
            break;
          }

          // Enqueue for reliable delivery with retry instead of fire-and-forget
          const { enqueueNotification } = await import("./notification-queue");
          const queueId = await enqueueNotification({
            clinicId: variables.clinic_id ?? "",
            channel: "whatsapp",
            recipient: recipientPhone,
            body,
            trigger,
            metadata: { recipient_id: recipientId },
          });
          results.push({
            channel: "whatsapp",
            success: !!queueId,
            messageId: queueId ?? undefined,
            error: queueId ? undefined : "Failed to enqueue notification",
          });
          break;
        }
        case "in_app": {
          const title = substituteVariables(template.subject, variables);
          const body = substituteVariables(template.body, variables);
          const { insertInAppNotification } = await import("./notification-persist");
          const inAppResult = await withRetry(() =>
            insertInAppNotification({
              userId: recipientId,
              trigger,
              title,
              message: body,
              priority: template.priority,
            }),
          );
          if (!inAppResult.success) {
            logger.error("In-app notification failed after retries", {
              context: "notification-dispatch",
              channel: "in_app",
              trigger,
              recipientId,
              error: inAppResult.error,
            });
            // Persist to dead letter queue for manual review
            const { enqueueNotification } = await import("./notification-queue");
            await enqueueNotification({
              clinicId: variables.clinic_id ?? "",
              channel: "in_app",
              recipient: recipientId,
              body,
              trigger,
              metadata: {
                recipient_id: recipientId,
                dead_letter: "true",
                failure_reason: inAppResult.error ?? "unknown",
              },
              maxAttempts: 1, // Already retried — mark as dead letter immediately
            });
          }
          results.push({
            channel: "in_app",
            success: inAppResult.success,
            messageId: inAppResult.id,
            error: inAppResult.error,
          });
          break;
        }
        case "email": {
          const subject = substituteVariables(template.subject, variables);
          const body = substituteVariables(template.body, variables);

          if (!recipientEmail) {
            results.push({
              channel: "email",
              success: false,
              error: "Recipient has no email address on file",
            });
            break;
          }

          const { sendNotificationEmail } = await import("./email");
          const emailResult = await withRetry(() =>
            sendNotificationEmail(recipientEmail, subject, body, variables.clinic_name),
          );
          if (!emailResult.success) {
            logger.error("Email notification failed after retries", {
              context: "notification-dispatch",
              channel: "email",
              trigger,
              recipientId,
              error: emailResult.error,
            });
            // Persist to dead letter queue for manual review
            const { enqueueNotification: enqueueDeadLetter } = await import("./notification-queue");
            await enqueueDeadLetter({
              clinicId: variables.clinic_id ?? "",
              channel: "email",
              recipient: recipientEmail,
              body,
              trigger,
              metadata: {
                recipient_id: recipientId,
                dead_letter: "true",
                failure_reason: emailResult.error ?? "unknown",
              },
              maxAttempts: 1, // Already retried — mark as dead letter immediately
            });
          }
          results.push({
            channel: "email",
            success: emailResult.success,
            messageId: emailResult.messageId,
            error: emailResult.error,
          });
          break;
        }
        case "sms": {
          const body = substituteVariables(template.whatsappBody, variables);

          if (!recipientPhone) {
            results.push({
              channel: "sms",
              success: false,
              error: "Recipient has no phone number on file",
            });
            break;
          }

          // Enqueue for reliable delivery with retry instead of fire-and-forget
          const { enqueueNotification: enqueueSms } = await import("./notification-queue");
          const smsQueueId = await enqueueSms({
            clinicId: variables.clinic_id ?? "",
            channel: "sms",
            recipient: recipientPhone,
            body,
            trigger,
            metadata: { recipient_id: recipientId },
          });
          results.push({
            channel: "sms",
            success: !!smsQueueId,
            messageId: smsQueueId ?? undefined,
            error: smsQueueId ? undefined : "Failed to enqueue SMS notification",
          });
          break;
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      logger.error("Notification dispatch failed", {
        context: "notification-dispatch",
        channel,
        trigger,
        recipientId,
        error: err,
      });
      results.push({
        channel,
        success: false,
        error: errorMsg,
      });
    }
  }

  return results;
}

// ---- Template-Based Enqueue (PR #950 cron handlers) ----

/**
 * Cron-handler-friendly notification templates.
 *
 * The MVA cron handlers (lab-triage, license-check, health-tips, and the
 * automation/appointment-confirmation helper) enqueue notifications by
 * `templateName` + `templateData` rather than by NotificationTrigger.
 * These templates are intentionally narrower than `defaultNotificationTemplates`:
 * they encode just the message body and a generic trigger mapping for the
 * queue, so the existing notification-queue infrastructure can deliver them
 * unchanged.
 *
 * Bodies use the same `{{variable}}` substitution as the main template
 * engine. Add new entries here when a new templateName is introduced.
 */
const CRON_NOTIFICATION_TEMPLATES: Record<string, { body: string; trigger: NotificationTrigger }> =
  {
    critical_lab_alert: {
      body: "Alerte critique: résultat de laboratoire {{lab_id}} — {{alerts}}",
      trigger: "follow_up",
    },
    license_expiry_warning: {
      body:
        "Dr. {{doctor_name}}, votre licence {{license_number}} expire dans " +
        "{{days_remaining}} jour(s) ({{expiry_date}}). Merci de la renouveler.",
      trigger: "follow_up",
    },
    health_tip_darija: {
      body: "Salam {{patient_name}}, conseil santé du jour: {{tip_content}}",
      trigger: "follow_up",
    },
    appointment_confirmation_darija: {
      body:
        "Salam {{patient_name}}, votre rendez-vous avec {{doctor_name}} est " +
        "confirmé le {{date}} à {{time}}.",
      trigger: "booking_confirmation",
    },
  };

/**
 * Channel name used by the cron handlers. They write the in-app channel as
 * "in-app" (kebab-case) but the internal contract uses the underscored
 * NotificationChannel ("in_app"). Accept both for ergonomics.
 */
export type CronNotificationChannel = NotificationChannel | "in-app";

export interface EnqueueTemplateParams {
  clinicId: string;
  /** ID of the user (patient, doctor, or staff) the notification targets. */
  patientId: string;
  channel: CronNotificationChannel;
  templateName: string;
  templateData: Record<string, string | number | undefined | null>;
  appointmentId?: string | null;
  priority?: "low" | "normal" | "high" | "urgent";
}

/**
 * Shape of the user-contact row we look up. Kept narrow so we don't have
 * to thread the full Supabase row type through this helper.
 */
interface UserContactRow {
  phone?: string | null;
  email?: string | null;
}

/**
 * Template-based enqueue: looks up the recipient's contact info, renders
 * the message body from {@link CRON_NOTIFICATION_TEMPLATES}, and hands off
 * to the underlying notification-queue helper.
 *
 * Returns the queue entry ID on success, or null if:
 *   - The named template is not registered.
 *   - The recipient has no usable contact for the requested channel.
 *   - The queue insert itself failed (the underlying helper already logs).
 *
 * Used by the PR #950 MVA cron handlers; the lower-level
 * `enqueueNotification` in `@/lib/notification-queue` remains the canonical
 * API for callsites that already know the recipient + rendered body.
 */
export async function enqueueNotification(
  supabase: SupabaseClient,
  params: EnqueueTemplateParams,
): Promise<string | null> {
  const template = CRON_NOTIFICATION_TEMPLATES[params.templateName];
  if (!template) {
    logger.warn("enqueueNotification: unknown templateName — skipping", {
      templateName: params.templateName,
      clinicId: params.clinicId,
      patientId: params.patientId,
    });
    return null;
  }

  // Normalize the cron handlers' "in-app" alias to the internal value.
  const channel: NotificationChannel = params.channel === "in-app" ? "in_app" : params.channel;

  // Resolve the recipient. For channels that need an external address
  // (whatsapp/sms/email) we look up the user row; for in_app we use the
  // user ID itself as the recipient identifier.
  let recipient = params.patientId;
  if (channel === "whatsapp" || channel === "sms" || channel === "email") {
    // The Supabase client returns `unknown` for the row when the schema
    // generic isn't supplied. We've explicitly selected `phone, email`
    // above so the cast to UserContactRow is safe.
    const { data: rawUser, error: lookupError } = await supabase
      .from("users")
      .select("phone, email")
      .eq("id", params.patientId)
      .maybeSingle();
    const user = rawUser as UserContactRow | null;
    if (lookupError) {
      logger.warn("enqueueNotification: recipient lookup failed", {
        templateName: params.templateName,
        patientId: params.patientId,
        error: String(lookupError),
      });
      return null;
    }
    const candidate = channel === "email" ? user?.email : user?.phone;
    if (!candidate) {
      logger.warn("enqueueNotification: recipient has no contact for channel — skipping", {
        templateName: params.templateName,
        patientId: params.patientId,
        channel,
      });
      return null;
    }
    recipient = candidate;
  }

  // Render the body. `substituteVariables` falls back to the literal
  // placeholder if a key is missing, so we stringify everything up front
  // and drop nullish values to keep the rendered body clean.
  const stringified: TemplateVariables = {};
  for (const [k, v] of Object.entries(params.templateData)) {
    if (v !== null && v !== undefined) stringified[k] = String(v);
  }
  const body = substituteVariables(template.body, stringified);

  // Defer to the existing queue infra. Dynamic import keeps the cyclic
  // notifications ↔ notification-queue dependency module-graph-safe at
  // build time (same pattern used by `dispatchNotification` above).
  const { enqueueNotification: enqueueQueue } = await import("./notification-queue");

  const metadata: Record<string, string> = {
    template_name: params.templateName,
    patient_id: params.patientId,
  };
  if (params.appointmentId) metadata.appointment_id = params.appointmentId;
  if (params.priority) metadata.priority = params.priority;

  return enqueueQueue({
    clinicId: params.clinicId,
    channel,
    recipient,
    body,
    trigger: template.trigger,
    metadata,
  });
}
