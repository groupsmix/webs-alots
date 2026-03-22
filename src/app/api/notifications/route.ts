import { NextRequest, NextResponse } from "next/server";
import {
  dispatchNotification,
  type NotificationTrigger,
  type NotificationChannel,
  type TemplateVariables,
} from "@/lib/notifications";
import type { NotificationChannel as DBNotificationChannel, UserRole } from "@/lib/types/database";
import { createClient } from "@/lib/supabase-server";

export const runtime = "edge";

/**
 * POST /api/notifications
 *
 * Dispatches a notification across configured channels.
 * Body: { trigger, variables, recipientId, channels }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify the caller is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Only admins and staff roles can dispatch notifications
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    const allowedRoles: UserRole[] = ["super_admin", "clinic_admin", "receptionist", "doctor"];
    if (!profile || !allowedRoles.includes(profile.role as UserRole)) {
      return NextResponse.json({ error: "Forbidden — insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();

    const {
      trigger,
      variables,
      recipientId,
      channels,
    } = body as {
      trigger: NotificationTrigger;
      variables: TemplateVariables;
      recipientId: string;
      channels: NotificationChannel[];
    };

    if (!trigger || !recipientId || !channels || channels.length === 0) {
      return NextResponse.json(
        { error: "trigger, recipientId, and channels are required" },
        { status: 400 },
      );
    }

    const results = await dispatchNotification(
      trigger,
      variables || {},
      recipientId,
      channels,
    );

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: "Failed to dispatch notification" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/notifications
 *
 * Returns notification history for a user.
 * Query params: userId, channel, type, limit, offset
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const requestedUserId = searchParams.get("userId");

  try {
    const supabase = await createClient();

    // Verify the caller is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Resolve the caller's profile
    const { data: profile } = await supabase
      .from("users")
      .select("id, role")
      .eq("auth_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const staffRoles: UserRole[] = ["super_admin", "clinic_admin", "receptionist", "doctor"];
    const isStaff = staffRoles.includes(profile.role as UserRole);

    // Non-staff users can only read their own notifications
    const userId = isStaff && requestedUserId ? requestedUserId : profile.id;

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
      console.error("[GET /api/notifications] Query error:", error.message);
      return NextResponse.json(
        { error: "Failed to fetch notifications" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      notifications: notifications ?? [],
      total: count ?? 0,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 },
    );
  }
}
