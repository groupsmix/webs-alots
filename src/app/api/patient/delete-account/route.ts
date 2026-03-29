/**
 * GDPR Account Deletion API — Right to Erasure
 *
 * Soft-deletes a patient account with a 30-day grace period.
 * After 30 days, a cron job permanently purges the data.
 *
 * POST /api/patient/delete-account  — Request deletion
 * DELETE /api/patient/delete-account — Cancel pending deletion
 */

import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { logger } from "@/lib/logger";
import { apiError, apiForbidden, apiInternalError, apiNotFound, apiSuccess, apiUnauthorized } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return apiError("Service unavailable", 503);
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
    return apiUnauthorized();
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from("users")
    .select("id, role, deletion_requested_at")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!profile) {
    return apiNotFound("Profile not found");
  }

  if (profile.role !== "patient") {
    return apiForbidden("Only patient accounts can request self-deletion. Contact support for other roles.");
  }

  if (profile.deletion_requested_at) {
    return apiSuccess({
      message: "Deletion already requested",
      deletionRequestedAt: profile.deletion_requested_at,
      permanentDeletionAt: new Date(
        new Date(profile.deletion_requested_at).getTime() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });
  }

  // Soft-delete: set deletion_requested_at timestamp
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("users")
    .update({ deletion_requested_at: now })
    .eq("id", profile.id);

  if (error) {
    return apiInternalError("Failed to request deletion");
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

  return apiSuccess({
    message: "Account deletion requested. You have 30 days to cancel.",
    deletionRequestedAt: now,
    permanentDeletionAt,
  });
}

export async function DELETE(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return apiError("Service unavailable", 503);
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
    return apiUnauthorized();
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, deletion_requested_at")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!profile) {
    return apiNotFound("Profile not found");
  }

  if (!profile.deletion_requested_at) {
    return apiSuccess({ message: "No pending deletion request" });
  }

  // Cancel deletion
  const { error } = await supabase
    .from("users")
    .update({ deletion_requested_at: null })
    .eq("id", profile.id);

  if (error) {
    return apiInternalError("Failed to cancel deletion");
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

  return apiSuccess({ message: "Account deletion cancelled successfully." });
}
