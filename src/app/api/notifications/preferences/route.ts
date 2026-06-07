import { z } from "zod";
import { apiSuccess } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferenceSettings,
} from "@/lib/notification-preferences";
import {
  getNotificationPreferences,
  saveNotificationPreferences,
} from "@/lib/notification-preferences-server";
import { withAuthValidation } from "@/lib/api-validate";
import { withAuth } from "@/lib/with-auth";
import type { UserRole } from "@/lib/types/database";

const ALL_AUTHENTICATED_ROLES: UserRole[] = [
  "super_admin",
  "clinic_admin",
  "receptionist",
  "doctor",
  "patient",
];

const preferencesSchema = z.object({
  whatsapp_enabled: z.boolean(),
  email_enabled: z.boolean(),
  in_app_enabled: z.boolean(),
  appointment_reminders: z.boolean(),
  booking_confirmations: z.boolean(),
  payment_receipts: z.boolean(),
  prescription_updates: z.boolean(),
  marketing_updates: z.boolean(),
});

type PreferencesPayload = z.infer<typeof preferencesSchema>;

export const GET = withAuth(async (_request, auth) => {
  const preferences = await getNotificationPreferences(auth.profile.id);
  return apiSuccess({
    preferences: {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...preferences,
    },
  });
}, ALL_AUTHENTICATED_ROLES);

export const PATCH = withAuthValidation(
  preferencesSchema,
  async (data: PreferencesPayload, _request, auth) => {
    const preferences = await saveNotificationPreferences(
      auth.profile.id,
      auth.profile.clinic_id,
      data as Partial<NotificationPreferenceSettings>,
    );

    await logAuditEvent({
      supabase: auth.supabase,
      action: "notification_preferences_updated",
      type: "config",
      clinicId: auth.profile.clinic_id ?? "system",
      actor: auth.user.id,
      description: "Notification preferences updated",
      metadata: { userId: auth.profile.id },
    });

    return apiSuccess({ preferences });
  },
  ALL_AUTHENTICATED_ROLES,
);
