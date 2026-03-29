/**
 * Notification Engine
 *
 * Core notification system with template-based messaging,
 * variable substitution, and multi-channel delivery (WhatsApp + In-App).
 */

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

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export type NotificationStatus = "pending" | "sent" | "delivered" | "failed" | "read";

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

// ---- In-App Notification ----

export interface InAppNotification {
  id: string;
  userId: string;
  trigger: NotificationTrigger;
  title: string;
  message: string;
  channel: "in_app";
  status: NotificationStatus;
  priority: NotificationPriority;
  metadata?: Record<string, string>;
  createdAt: string;
  readAt?: string;
}

// ---- WhatsApp Message ----

export interface WhatsAppMessage {
  id: string;
  to: string;
  trigger: NotificationTrigger;
  body: string;
  status: NotificationStatus;
  sentAt: string;
  deliveredAt?: string;
  error?: string;
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

// ---- User Notification Preferences ----

export interface NotificationPreferences {
  userId: string;
  channels: {
    whatsapp: boolean;
    in_app: boolean;
    email: boolean;
    sms: boolean;
  };
  triggers: Partial<Record<NotificationTrigger, boolean>>;
  quietHours?: {
    enabled: boolean;
    start: string; // "22:00"
    end: string; // "08:00"
  };
}

// ---- Template Variable Substitution Engine ----

/**
 * Replaces {{variable_name}} placeholders in a template string
 * with values from the variables object.
 */
export function substituteVariables(
  template: string,
  variables: TemplateVariables,
): string {
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
    whatsappBody: "New booking: {{patient_name}} with {{doctor_name}} on {{date}} at {{time}}. Service: {{service_name}}.",
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
    whatsappBody: "Hello {{patient_name}}, your appointment with Dr. {{doctor_name}} is confirmed.\n\nDate: {{date}}\nTime: {{time}}\nService: {{service_name}}\nAddress: {{clinic_address}}\n\nManage/cancel: {{manage_url}}\n\n{{clinic_name}}",
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
    whatsappBody: "Reminder: You have an appointment with {{doctor_name}} tomorrow at {{time}}. {{clinic_name}} — {{clinic_address}}. Reply CONFIRM to confirm or CANCEL to cancel.",
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
    whatsappBody: "Your appointment with {{doctor_name}} is in 1 hour at {{time}}. Please arrive 10 minutes early. {{clinic_name}} — {{clinic_address}}",
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
    whatsappBody: "Your appointment with {{doctor_name}} is in 2 hours at {{time}}. Please arrive 10 minutes early. {{clinic_name}} — {{clinic_address}}",
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
    whatsappBody: "Your appointment with {{doctor_name}} on {{date}} at {{time}} has been cancelled. Contact us at {{clinic_phone}} to reschedule.",
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
    whatsappBody: "Hello {{patient_name}}, we noticed you missed your appointment on {{date}}. Would you like to reschedule? Contact us at {{clinic_phone}}.",
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
    whatsappBody: "Hello {{patient_name}}, your prescription from {{doctor_name}} is ready for pickup at {{clinic_name}}. {{clinic_address}}",
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
    body: "{{patient_name}} left a {{review_stars}}-star review: \"{{review_comment}}\"",
    whatsappBody: "New review from {{patient_name}}: {{review_stars}} stars — \"{{review_comment}}\"",
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
    whatsappBody: "Hello {{patient_name}}, we received your payment of {{amount}} {{currency}} via {{payment_method}}. Invoice: {{invoice_id}}. Thank you! — {{clinic_name}}",
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
    whatsappBody: "Hello {{patient_name}}, your appointment with {{doctor_name}} has been rescheduled to {{date}} at {{time}}. Contact us at {{clinic_phone}} if you have questions. {{clinic_name}}",
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

          const { sendTextMessage } = await import("./whatsapp");
          const waResult = await sendTextMessage(recipientPhone, body);
          results.push({
            channel: "whatsapp",
            success: waResult.success,
            messageId: waResult.messageId,
            error: waResult.error,
          });
          break;
        }
        case "in_app": {
          const title = substituteVariables(template.subject, variables);
          const body = substituteVariables(template.body, variables);
          const { insertInAppNotification } = await import("./notification-persist");
          const inAppResult = await insertInAppNotification({
            userId: recipientId,
            trigger,
            title,
            message: body,
            priority: template.priority,
          });
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
          const emailResult = await sendNotificationEmail(
            recipientEmail,
            subject,
            body,
            variables.clinic_name,
          );
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

          const { sendSms } = await import("./sms");
          const smsResult = await sendSms(recipientPhone, body);
          results.push({
            channel: "sms",
            success: smsResult.success,
            messageId: smsResult.messageId,
            error: smsResult.error,
          });
          break;
        }
      }
    } catch (err) {
      results.push({
        channel,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return results;
}

// ---- Demo data has been moved to @/lib/__fixtures__/notifications.fixtures.ts ----
// Re-export for backward compatibility.
export { demoNotificationLog, demoInAppNotifications } from "@/lib/__fixtures__/notifications.fixtures";
