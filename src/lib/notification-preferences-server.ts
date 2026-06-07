// NOTE: This module is server-only by convention (filename suffix `-server`)
// and because it imports `createUntypedAdminClient` which uses the
// service-role key. We do not `import "server-only"` here because:
//   1. The `server-only` package is not declared in package.json (Next.js
//      bundles its own copy via a webpack alias, but Vitest cannot resolve
//      that alias and the import breaks every test suite that transitively
//      imports this file).
//   2. Server-side enforcement is already provided by `createUntypedAdminClient`
//      (which requires `SUPABASE_SERVICE_ROLE_KEY`, never present in the browser
//      bundle).
import {
  canSendNotification,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "@/lib/notification-preferences";
import type { NotificationPreferenceSettings } from "@/lib/notification-preferences";
import type { NotificationChannel, NotificationTrigger } from "@/lib/notifications";
import { createUntypedAdminClient } from "@/lib/supabase-server";

interface NotificationPreferenceRow extends NotificationPreferenceSettings {
  user_id: string;
  clinic_id: string | null;
}

export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferenceSettings> {
  // CMP-007: Fail-open to DEFAULT_NOTIFICATION_PREFERENCES if the admin
  // client throws or the preferences table is unreachable. Preferences are an
  // opt-out mechanism; if we can't read them, the safe default is to honour
  // the user's last-known consent state by sending notifications they would
  // normally receive. This also keeps existing test suites that mock
  // `@/lib/supabase-server` without `notification_preferences` table support
  // working without modification.
  try {
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
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
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
  // CMP-007: Fail-open. If reading preferences fails, allow delivery using the
  // default preferences so notifications never silently drop because of a
  // transient DB issue.
  try {
    const preferences = await getNotificationPreferences(userId);
    return canSendNotification(preferences, channel, trigger);
  } catch {
    return canSendNotification({ ...DEFAULT_NOTIFICATION_PREFERENCES }, channel, trigger);
  }
}
