import { NextRequest, NextResponse } from "next/server";
import {
  dispatchNotification,
  defaultNotificationTemplates,
  type NotificationTrigger,
  type TemplateVariables,
} from "@/lib/notifications";
import type { UserRole } from "@/lib/types/database";
import { createClient } from "@/lib/supabase-server";

export const runtime = "edge";

const STAFF_ROLES: UserRole[] = ["super_admin", "clinic_admin", "receptionist", "doctor"];

/**
 * POST /api/notifications/trigger
 *
 * Triggers a notification for a specific event.
 * This is the main endpoint used by the booking system, payment system, etc.
 *
 * Body:
 * {
 *   trigger: NotificationTrigger,
 *   variables: TemplateVariables,
 *   recipients: Array<{ id: string; channels: ("whatsapp" | "in_app")[] }>
 * }
 *
 * Supported triggers:
 * - new_booking: When a new appointment is booked
 * - booking_confirmation: When an appointment is confirmed
 * - reminder_24h: 24 hours before appointment
 * - reminder_2h: 2 hours before appointment
 * - cancellation: When an appointment is cancelled
 * - no_show: When a patient doesn't show up
 * - prescription_ready: When a prescription is ready
 * - new_review: When a patient leaves a review
 * - payment_received: When a payment is confirmed
 * - new_patient_registered: When a new patient registers
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

    // Only staff roles can trigger notifications
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    if (!profile || !STAFF_ROLES.includes(profile.role as UserRole)) {
      return NextResponse.json({ error: "Forbidden \u2014 insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();

    const {
      trigger,
      variables,
      recipients,
    } = body as {
      trigger: NotificationTrigger;
      variables: TemplateVariables;
      recipients: Array<{ id: string; channels: ("whatsapp" | "in_app")[] }>;
    };

    if (!trigger || !recipients || recipients.length === 0) {
      return NextResponse.json(
        { error: "trigger and recipients are required" },
        { status: 400 },
      );
    }

    // Find the template for this trigger
    const template = defaultNotificationTemplates.find(
      (t) => t.trigger === trigger && t.enabled,
    );

    if (!template) {
      return NextResponse.json(
        { error: `No enabled template found for trigger: ${trigger}` },
        { status: 404 },
      );
    }

    // Dispatch to all recipients
    const allResults = [];

    for (const recipient of recipients) {
      const results = await dispatchNotification(
        trigger,
        variables || {},
        recipient.id,
        recipient.channels,
      );
      allResults.push({
        recipientId: recipient.id,
        results,
      });
    }

    return NextResponse.json({
      trigger,
      template: template.name,
      dispatched: allResults,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to trigger notification" },
      { status: 500 },
    );
  }
}
