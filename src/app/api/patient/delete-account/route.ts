/**
 * GDPR Account Deletion API — Right to Erasure
 *
 * Soft-deletes a patient account with a 30-day grace period.
 * After 30 days, a cron job permanently purges the data.
 *
 * POST /api/patient/delete-account  — Request deletion
 * DELETE /api/patient/delete-account — Cancel pending deletion
 *
 * X-1: Replaced `as unknown as {...}` casts with properly-typed
 * SupabaseClient<Database> from database-extended.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { apiForbidden, apiInternalError, apiSuccess } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import type { Database } from "@/lib/types/database-extended";
import { withAuth } from "@/lib/with-auth";

type ExtendedClient = SupabaseClient<Database>;

export const POST = withAuth(
  async (_request, { supabase, profile }) => {
    const typed = supabase as ExtendedClient;

    const { data: userRow } = await typed
      .from("users")
      .select("id, role, deletion_requested_at")
      .eq("id", profile.id)
      .eq("clinic_id", profile.clinic_id)
      .maybeSingle();

    if (!userRow) {
      return apiInternalError("Profile lookup failed");
    }

    if (userRow.role !== "patient") {
      return apiForbidden(
        "Only patient accounts can request self-deletion. Contact support for other roles.",
      );
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

    const now = new Date().toISOString();
    const { error } = await typed
      .from("users")
      .update({ deletion_requested_at: now })
      .eq("id", profile.id)
      .eq("clinic_id", profile.clinic_id);

    if (error) {
      return apiInternalError("Failed to request deletion");
    }

    const permanentDeletionAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    try {
      await supabase.from("activity_logs").insert({
        action: "patient_deletion_requested",
        type: "patient",
        actor: profile.id,
        clinic_id: profile.clinic_id,
        description: `Patient requested account deletion. Permanent deletion scheduled for ${permanentDeletionAt}`,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.warn("Failed to log deletion request audit event", {
        context: "patient/delete-account",
        error: err,
      });
    }

    return apiSuccess({
      message: "Account deletion requested. You have 30 days to cancel.",
      deletionRequestedAt: now,
      permanentDeletionAt,
    });
  },
  ["patient"],
);

export const DELETE = withAuth(
  async (_request, { supabase, profile }) => {
    const typed = supabase as ExtendedClient;

    const { data: userRow } = await typed
      .from("users")
      .select("id, deletion_requested_at")
      .eq("id", profile.id)
      .eq("clinic_id", profile.clinic_id)
      .maybeSingle();

    if (!userRow) {
      return apiInternalError("Profile lookup failed");
    }

    if (!userRow.deletion_requested_at) {
      return apiSuccess({ message: "No pending deletion request" });
    }

    const { error } = await typed
      .from("users")
      .update({ deletion_requested_at: null })
      .eq("id", profile.id)
      .eq("clinic_id", profile.clinic_id);

    if (error) {
      return apiInternalError("Failed to cancel deletion");
    }

    try {
      await supabase.from("activity_logs").insert({
        action: "patient_deletion_cancelled",
        type: "patient",
        actor: profile.id,
        clinic_id: profile.clinic_id,
        description: "Patient cancelled pending account deletion request",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.warn("Failed to log deletion cancellation audit event", {
        context: "patient/delete-account",
        error: err,
      });
    }

    return apiSuccess({ message: "Account deletion cancelled successfully." });
  },
  ["patient"],
);
