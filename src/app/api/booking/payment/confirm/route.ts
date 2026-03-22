import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { clinicConfig } from "@/config/clinic.config";
import type { UserRole } from "@/lib/types/database";

export const runtime = "edge";

const STAFF_ROLES: UserRole[] = ["super_admin", "clinic_admin", "receptionist", "doctor"];

/**
 * POST /api/booking/payment/confirm
 *
 * Confirm a pending payment.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();
    if (!profile || !STAFF_ROLES.includes(profile.role as UserRole)) {
      return NextResponse.json({ error: "Forbidden \u2014 insufficient permissions" }, { status: 403 });
    }

    const body = (await request.json()) as { paymentId: string };

    if (!body.paymentId) {
      return NextResponse.json({ error: "paymentId is required" }, { status: 400 });
    }

    // Fetch the payment
    const { data: payment, error: fetchError } = await supabase
      .from("payments")
      .select("id, status, appointment_id")
      .eq("id", body.paymentId)
      .eq("clinic_id", clinicConfig.clinicId)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.status !== "pending") {
      return NextResponse.json({ error: "Payment is not in pending state" }, { status: 400 });
    }

    // Mark payment as completed
    const { error: updateError } = await supabase
      .from("payments")
      .update({ status: "completed" })
      .eq("id", body.paymentId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Also confirm the associated appointment if it is still scheduled
    if (payment.appointment_id) {
      await supabase
        .from("appointments")
        .update({ status: "confirmed" })
        .eq("id", payment.appointment_id)
        .in("status", ["pending", "scheduled"]);
    }

    return NextResponse.json({ status: "confirmed", message: "Payment confirmed" });
  } catch {
    return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 });
  }
}
