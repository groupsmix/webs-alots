import "server-only";

import type { NotificationChannel, NotificationTrigger } from "@/lib/notifications";
import {
  canSendNotification,
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferenceSettings,
} from "@/lib/notification-preferences";
import { createUntypedAdminClient } from "@/lib/supabase-server";

interface NotificationPreferenceRow extends NotificationPreferenceSettings {
  user_id: string;
  clinic_id: string | null;
}

export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferenceSettings> {
  const supabase = createUntypedAdminClient("notification");
  const { data } = await supabase
    .from("notification_preferences")
    .select(
      "user_id, clinic_id, whatsapp_enabled, email_enabled, in_app_enabled, appointment_reminders, booking_confirmations, payment_receipts, prescription_updates, marketing_updates",
    )
    .eq("user_id", userId)
    .maybeSingle();

  const row = (data ?? null) as NotificationPreferenceRow | null;

  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(row
      ? {
          whatsapp_enabled: row.whatsapp_enabled,
          email_enabled: row.email_enabled,
          in_app_enabled: row.in_app_enabled,
          appointment_reminders: row.appointment_reminders,
          booking_confirmations: row.booking_confirmations,
          payment_receipts: row.payment_receipts,
          prescription_updates: row.prescription_updates,
          marketing_updates: row.marketing_updates,
        }
      : {}),
  };
}

export async function saveNotificationPreferences(
  userId: string,
  clinicId: string | null,
  updates: Partial<NotificationPreferenceSettings>,
): Promise<NotificationPreferenceSettings> {
  const supabase = createUntypedAdminClient("notification");
  const current = await getNotificationPreferences(userId);
  const next = {
    ...current,
    ...updates,
  };

  const { error } = await supabase.from("notification_preferences").upsert(
    {
      user_id: userId,
      clinic_id: clinicId,
      ...next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(`Failed to save notification preferences: ${error.message}`);
  }

  return next;
}

export async function shouldDeliverNotification(
  userId: string,
  channel: NotificationChannel,
  trigger: NotificationTrigger,
): Promise<boolean> {
  const preferences = await getNotificationPreferences(userId);
  return canSendNotification(preferences, channel, trigger);
}
