/**
 * GDPR Account Deletion API — Right to Erasure
 *
 * Soft-deletes a patient account with a 30-day grace period.
 * After 30 days, a cron job permanently purges the data.
 *
 * POST /api/patient/delete-account  — Request deletion
 * DELETE /api/patient/delete-account — Cancel pending deletion
 */

import { withAuth } from "@/lib/with-auth";
import { logger } from "@/lib/logger";
import { apiForbidden, apiInternalError, apiSuccess } from "@/lib/api-response";

export const POST = withAuth(async (_request, { supabase, profile }) => {
  // Fetch deletion status
  // NOTE: deletion_requested_at is not yet in the generated Supabase types
  // but exists in the DB schema (added via migration). Cast to access it.
  const { data: userRow } = await (supabase
    .from("users")
    .select("id, role, deletion_requested_at")
    .eq("id", profile.id)
    .maybeSingle() as unknown as Promise<{ data: { id: string; role: string; deletion_requested_at: string | null } | null }>);

  if (!userRow) {
    return apiInternalError("Profile lookup failed");
  }

  if (userRow.role !== "patient") {
    return apiForbidden("Only patient accounts can request self-deletion. Contact support for other roles.");
  }

  if (userRow.deletion_requested_at) {
    return apiSuccess({
      message: "Deletion already requested",
      deletionRequestedAt: userRow.deletion_requested_at,
      permanentDeletionAt: new Date(
        new Date(userRow.deletion_requested_at).getTime() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });
  }

  // Soft-delete: set deletion_requested_at timestamp
  const now = new Date().toISOString();
  const { error } = await (supabase
    .from("users")
    .update({ deletion_requested_at: now } as Record<string, unknown>)
    .eq("id", profile.id) as unknown as Promise<{ error: { message: string } | null }>);

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
}, ["patient"]);

export const DELETE = withAuth(async (_request, { supabase, profile }) => {
  const { data: userRow } = await (supabase
    .from("users")
    .select("id, deletion_requested_at")
    .eq("id", profile.id)
    .maybeSingle() as unknown as Promise<{ data: { id: string; deletion_requested_at: string | null } | null }>);

  if (!userRow) {
    return apiInternalError("Profile lookup failed");
  }

  if (!userRow.deletion_requested_at) {
    return apiSuccess({ message: "No pending deletion request" });
  }

  // Cancel deletion
  const { error } = await (supabase
    .from("users")
    .update({ deletion_requested_at: null } as Record<string, unknown>)
    .eq("id", profile.id) as unknown as Promise<{ error: { message: string } | null }>);

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
}, ["patient"]);
