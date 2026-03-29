/**
 * GDPR Account Deletion API — Right to Erasure
 *
 * Soft-deletes a patient account with a 30-day grace period.
 * After 30 days, a cron job permanently purges the data.
 *
 * POST /api/patient/delete-account  — Request deletion
 * DELETE /api/patient/delete-account — Cancel pending deletion
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Service unavailable" },
      { status: 503 },
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        /* read-only */
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from("users")
    .select("id, role, deletion_requested_at")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (profile.role !== "patient") {
    return NextResponse.json(
      { error: "Only patient accounts can request self-deletion. Contact support for other roles." },
      { status: 403 },
    );
  }

  if (profile.deletion_requested_at) {
    return NextResponse.json(
      {
        message: "Deletion already requested",
        deletionRequestedAt: profile.deletion_requested_at,
        permanentDeletionAt: new Date(
          new Date(profile.deletion_requested_at).getTime() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      },
      { status: 200 },
    );
  }

  // Soft-delete: set deletion_requested_at timestamp
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("users")
    .update({ deletion_requested_at: now })
    .eq("id", profile.id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to request deletion" },
      { status: 500 },
    );
  }

  const permanentDeletionAt = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Log the deletion request for GDPR/Loi 09-08 audit trail
  try {
    await supabase.from("activity_logs").insert({
      action: "patient_deletion_requested",
      type: "patient",
      actor: profile.id,
      clinic_id: null,
      description: `Patient requested account deletion. Permanent deletion scheduled for ${permanentDeletionAt}`,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn("Failed to log deletion request audit event", { context: "patient/delete-account", error: err });
  }

  return NextResponse.json({
    message: "Account deletion requested. You have 30 days to cancel.",
    deletionRequestedAt: now,
    permanentDeletionAt,
  });
}

export async function DELETE(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Service unavailable" },
      { status: 503 },
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        /* read-only */
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, deletion_requested_at")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (!profile.deletion_requested_at) {
    return NextResponse.json(
      { message: "No pending deletion request" },
      { status: 200 },
    );
  }

  // Cancel deletion
  const { error } = await supabase
    .from("users")
    .update({ deletion_requested_at: null })
    .eq("id", profile.id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to cancel deletion" },
      { status: 500 },
    );
  }

  // Log the cancellation for audit trail
  try {
    await supabase.from("activity_logs").insert({
      action: "patient_deletion_cancelled",
      type: "patient",
      actor: profile.id,
      clinic_id: null,
      description: "Patient cancelled pending account deletion request",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn("Failed to log deletion cancellation audit event", { context: "patient/delete-account", error: err });
  }

  return NextResponse.json({
    message: "Account deletion cancelled successfully.",
  });
}
