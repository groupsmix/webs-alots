import { apiForbidden, apiInternalError, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { logger } from "@/lib/logger";
import {
  dispatchNotification,
  type NotificationTrigger,
  type NotificationChannel,
  type TemplateVariables,
} from "@/lib/notifications";
import type { NotificationChannel as DBNotificationChannel, UserRole } from "@/lib/types/database";
import { notificationDispatchSchema } from "@/lib/validations";
import { withAuth } from "@/lib/with-auth";

/** Roles allowed to read notifications (all authenticated users). */
const ALL_AUTHENTICATED_ROLES: UserRole[] = [
  "super_admin",
  "clinic_admin",
  "receptionist",
  "doctor",
  "patient",
];
/**
 * POST /api/notifications
 *
 * Dispatches a notification across configured channels.
 * Body: { trigger, variables, recipientId, channels }
 */

export const POST = withAuthValidation(notificationDispatchSchema, async (body, request, { supabase, profile }) => {
    const { trigger, variables, recipientId, channels } = body as {
      trigger: NotificationTrigger;
      variables: TemplateVariables;
      recipientId: string;
      channels: NotificationChannel[];
    };

    // Tenant isolation: verify the recipient belongs to the same clinic
    // as the authenticated user (super_admin bypasses this check).
    if (profile.role !== "super_admin" && profile.clinic_id) {
      const { data: recipient } = await supabase
        .from("users")
        .select("clinic_id")
        .eq("id", recipientId)
        .single();

      if (!recipient || recipient.clinic_id !== profile.clinic_id) {
        return apiForbidden("Recipient not found in your clinic");
      }
    }

    const results = await dispatchNotification(
      trigger,
      variables || {},
      recipientId,
      channels,
    );

    return apiSuccess({ results });
}, STAFF_ROLES);

/**
 * GET /api/notifications
 *
 * Returns notification history for a user.
 * Query params: userId, channel, type, limit, offset
 *
 * FIX: Previously restricted to STAFF_ROLES which prevented patients from
 * reading their own notifications. Now uses ALL_AUTHENTICATED_ROLES so
 * patients can access their own notification history. Staff can still
 * query other users' notifications within their clinic via the userId param.
 */
export const GET = withAuth(async (request, { supabase, profile }) => {
  const searchParams = request.nextUrl.searchParams;
  const requestedUserId = searchParams.get("userId");

  try {
    const isStaff = STAFF_ROLES.includes(profile.role);

    // Non-staff users can only read their own notifications
    const userId = isStaff && requestedUserId ? requestedUserId : profile.id;

    // Tenant isolation: staff can only read notifications of users in the same clinic
    if (isStaff && requestedUserId && profile.role !== "super_admin" && profile.clinic_id) {
      const { data: targetUser } = await supabase
        .from("users")
        .select("clinic_id")
        .eq("id", requestedUserId)
        .single();

      if (!targetUser || targetUser.clinic_id !== profile.clinic_id) {
        return apiForbidden("User not found in your clinic");
      }
    }

    const channel = searchParams.get("channel");
    const type = searchParams.get("type");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 100);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10) || 0;

    let query = supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", userId);

    if (channel) {
      query = query.eq("channel", channel as DBNotificationChannel);
    }

    if (type) {
      query = query.eq("type", type);
    }

    query = query
      .order("sent_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: notifications, error, count } = await query;

    if (error) {
      logger.warn("Operation failed", { context: "notifications", error });
      return apiInternalError("Failed to fetch notifications");
    }

    return apiSuccess({
      notifications: notifications ?? [],
      total: count ?? 0,
    });
  } catch (err) {
    logger.warn("Operation failed", { context: "notifications", error: err });
    return apiInternalError("Failed to fetch notifications");
  }
}, ALL_AUTHENTICATED_ROLES);
