import { NextResponse } from "next/server";
import {
  dispatchNotification,
  type NotificationTrigger,
  type NotificationChannel,
  type TemplateVariables,
} from "@/lib/notifications";
import type { NotificationChannel as DBNotificationChannel } from "@/lib/types/database";
import { withAuth } from "@/lib/with-auth";
import { STAFF_ROLES } from "@/lib/auth-roles";
import { logger } from "@/lib/logger";
import { notificationDispatchSchema, safeParse } from "@/lib/validations";

export const runtime = "edge";

/**
 * POST /api/notifications
 *
 * Dispatches a notification across configured channels.
 * Body: { trigger, variables, recipientId, channels }
 */

export const POST = withAuth(async (request, { supabase, profile }) => {
  try {
    const raw = await request.json();
    const parsed = safeParse(notificationDispatchSchema, raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { trigger, variables, recipientId, channels } = parsed.data as {
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
        return NextResponse.json(
          { error: "Recipient not found in your clinic" },
          { status: 403 },
        );
      }
    }

    const results = await dispatchNotification(
      trigger,
      variables || {},
      recipientId,
      channels,
    );

    return NextResponse.json({ results });
  } catch (err) {
    logger.warn("Operation failed", { context: "notifications", error: err });
    return NextResponse.json(
      { error: "Failed to dispatch notification" },
      { status: 500 },
    );
  }
}, STAFF_ROLES);

/**
 * GET /api/notifications
 *
 * Returns notification history for a user.
 * Query params: userId, channel, type, limit, offset
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
        return NextResponse.json(
          { error: "User not found in your clinic" },
          { status: 403 },
        );
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
      return NextResponse.json(
        { error: "Failed to fetch notifications" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      notifications: notifications ?? [],
      total: count ?? 0,
    });
  } catch (err) {
    logger.warn("Operation failed", { context: "notifications", error: err });
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 },
    );
  }
}, STAFF_ROLES);
