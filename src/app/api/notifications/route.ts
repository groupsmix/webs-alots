import { NextRequest, NextResponse } from "next/server";
import {
  dispatchNotification,
  type NotificationTrigger,
  type NotificationChannel,
  type TemplateVariables,
} from "@/lib/notifications";
import { createClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types/database";

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
    if (!profile || !allowedRoles.includes(profile.role)) {
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
 * Query params: userId, channel, trigger, status, limit
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "userId is required" },
      { status: 400 },
    );
  }

  // TODO: Fetch from Supabase notifications table
  // For now, return empty array (demo data is rendered client-side)
  return NextResponse.json({ notifications: [], total: 0 });
}
