/**
 * Notification Persistence
 *
 * Inserts in-app notifications into the Supabase `notifications` table
 * so they appear in the user's notification feed.
 */

import { createClient } from "@/lib/supabase-server";
import type { NotificationTrigger } from "./notifications";
import { logger } from "@/lib/logger";

interface InsertNotificationParams {
  userId: string;
  trigger: NotificationTrigger;
  title: string;
  message: string;
  priority?: string;
}

interface InsertResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Insert an in-app notification into the Supabase notifications table.
 */
export async function insertInAppNotification(
  params: InsertNotificationParams,
): Promise<InsertResult> {
  try {
    const supabase = await createClient();

    // Look up the user to get their clinic_id
    const { data: user } = await supabase
      .from("users")
      .select("clinic_id")
      .eq("id", params.userId)
      .single();

    const clinicId = user?.clinic_id;
    if (!clinicId) {
      return { success: false, error: "User not found or missing clinic_id" };
    }

    const { data, error } = await supabase
      .from("notifications")
      .insert({
        clinic_id: clinicId,
        user_id: params.userId,
        type: params.trigger,
        channel: "in_app" as const,
        title: params.title,
        body: params.message,
        is_read: false,
        sent_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      logger.error("Failed to insert in-app notification", { context: "notification-persist", error });
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("Notification persistence failed", { context: "notification-persist", error: err });
    return { success: false, error: message };
  }
}
