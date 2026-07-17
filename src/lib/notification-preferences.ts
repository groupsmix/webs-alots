import type { NotificationChannel, NotificationTrigger } from "@/lib/notifications";

export interface NotificationPreferenceSettings {
  whatsapp_enabled: boolean;
  email_enabled: boolean;
  in_app_enabled: boolean;
  appointment_reminders: boolean;
  booking_confirmations: boolean;
  payment_receipts: boolean;
  prescription_updates: boolean;
  marketing_updates: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferenceSettings = {
  whatsapp_enabled: true,
  email_enabled: true,
  in_app_enabled: true,
  appointment_reminders: true,
  booking_confirmations: true,
  payment_receipts: true,
  prescription_updates: true,
  marketing_updates: false,
};

export function isChannelEnabled(
  preferences: NotificationPreferenceSettings,
  channel: NotificationChannel,
): boolean {
  switch (channel) {
    case "whatsapp":
      return preferences.whatsapp_enabled;
    case "email":
      return preferences.email_enabled;
    case "in_app":
      return preferences.in_app_enabled;
    case "sms":
      return preferences.whatsapp_enabled;
    default:
      return true;
  }
}

export function isTriggerEnabled(
  preferences: NotificationPreferenceSettings,
  trigger: NotificationTrigger,
): boolean {
  switch (trigger) {
    case "reminder_24h":
    case "reminder_1h":
    case "reminder_2h":
    case "follow_up":
      return preferences.appointment_reminders;
    case "booking_confirmation":
    case "new_booking":
    case "cancellation":
    case "no_show":
    case "rescheduled":
    case "doctor_assigned":
    case "new_patient_registered":
      return preferences.booking_confirmations;
    case "payment_received":
      return preferences.payment_receipts;
    case "prescription_ready":
      return preferences.prescription_updates;
    case "new_review":
    case "recall":
      return preferences.marketing_updates;
    default:
      return true;
  }
}

export function canSendNotification(
  preferences: NotificationPreferenceSettings,
  channel: NotificationChannel,
  trigger: NotificationTrigger,
): boolean {
  return isChannelEnabled(preferences, channel) && isTriggerEnabled(preferences, trigger);
}
