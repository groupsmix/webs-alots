/**
 * PATCH /api/notifications/[id]/read
 *
 * Marks a single in-app notification as read in the database.
 * Only the owning user can mark their own notifications as read.
 */
import { type NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types/database";
import { withAuth } from "@/lib/with-auth";

const ALL_AUTHENTICATED_ROLES: UserRole[] = [
  "super_admin",
  "clinic_admin",
  "receptionist",
  "doctor",
  "patient",
];

export const PATCH = withAuth(
  async (
    _request: NextRequest,
    auth,
    routeCtx?: { params?: Promise<{ id: string }> },
  ): Promise<NextResponse> => {
    const params = await routeCtx?.params;
    const notificationId = params?.id;
    if (!notificationId) {
      return apiError("Notification ID is required", 400, "VALIDATION_ERROR");
    }

    const supabase = await createClient();

    // Verify the notification belongs to the requesting user (prevents cross-user marking).
    const { data: existing, error: fetchError } = await supabase
      .from("notifications")
      .select("id, user_id")
      .eq("id", notificationId)
      .eq("user_id", auth.profile.id)
      .maybeSingle();

    if (fetchError) {
      return apiError("Failed to fetch notification", 500, "INTERNAL_ERROR");
    }
    if (!existing) {
      return apiError("Notification not found", 404, "NOT_FOUND");
    }

    const { error: updateError } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("user_id", auth.profile.id);

    if (updateError) {
      return apiError("Failed to mark notification as read", 500, "INTERNAL_ERROR");
    }

    return apiSuccess({ id: notificationId, is_read: true });
  },
  ALL_AUTHENTICATED_ROLES,
);
