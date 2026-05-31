/**
 * A62-F1 / A62-F2: GDPR Art.18 (Restriction) & Art.21 (Objection) Enforcement.
 *
 * Allows patients to:
 *   - Art.18: Request restriction of ALL processing while a complaint is pending.
 *   - Art.21: Object to specific processing activities under Art.6(1)(f)
 *             (legitimate interest) — e.g., WhatsApp reminders, AI summaries.
 *
 * This endpoint now BOTH logs the request AND writes the restriction/objection
 * flag to the `users` row so that:
 *   - withAuth middleware can enforce it on every subsequent request.
 *   - The notification cron skips sending to restricted/objecting patients.
 *   - AI routes skip generation for restricted patients.
 *
 * POST /api/patient/restrict-processing — Submit a restriction/objection request
 * DELETE /api/patient/restrict-processing — Withdraw a restriction/objection
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, apiInternalError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { withAuth } from "@/lib/with-auth";

const restrictProcessingSchema = z.object({
  type: z.enum(["restriction", "objection"]),
  reason: z
    .string()
    .min(10, "Please provide a reason (minimum 10 characters)")
    .max(2000, "Reason must be under 2000 characters"),
  /** For Art.21 objection: list the specific processing activities being objected to */
  processingActivities: z
    .array(z.string().max(200))
    .min(1, "At least one processing activity must be specified")
    .max(20),
});

const withdrawSchema = z.object({
  type: z.enum(["restriction", "objection"]),
  reason: z.string().min(5).max(1000).optional(),
});

// ---------------------------------------------------------------------------
// POST — submit a new restriction or objection
// ---------------------------------------------------------------------------
export const POST = withAuth(
  async (request: NextRequest, { supabase, profile }) => {
    if (profile.role !== "patient") {
      return apiError(
        "Only patients can submit restriction/objection requests. Staff: contact support directly.",
        403,
        "FORBIDDEN",
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError("Invalid JSON body", 400, "INVALID_JSON");
    }

    const parsed = restrictProcessingSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return apiError(msg, 422, "VALIDATION_ERROR");
    }

    const { type, reason, processingActivities } = parsed.data;

    // ── Write the enforcement flag to the users row ──────────────────────
    // This is the critical step that was missing in the original
    // implementation. The audit log entry alone is not enforcement.
    let updateError: unknown = null;

    if (type === "restriction") {
      // Art.18: suspend all non-essential processing for this user.
      // The processing_restricted_* columns are added by migration 00126 but
      // not yet in the generated Database types; cast through `never` (the
      // established Supabase escape hatch for excess-property rejection).
      const { error } = await supabase
        .from("users")
        .update({
          processing_restricted: true,
          processing_restricted_at: new Date().toISOString(),
          processing_restriction_reason: reason,
        } as never)
        .eq("id", profile.id);
      updateError = error;
    } else {
      // Art.21: object to specific legitimate-interest processing activities.
      // Same generated-types caveat as above.
      const { error } = await supabase
        .from("users")
        .update({
          processing_objection_active: true,
          processing_objection_at: new Date().toISOString(),
          processing_objection_activities: processingActivities,
        } as never)
        .eq("id", profile.id);
      updateError = error;
    }

    if (updateError) {
      logger.error("Failed to set restriction/objection flag on user", {
        context: "patient/restrict-processing",
        userId: profile.id,
        type,
        error: updateError,
      });
      return apiInternalError("Failed to record your request. Please try again.");
    }

    // ── Audit log ────────────────────────────────────────────────────────
    await logAuditEvent({
      supabase,
      type: "patient",
      action:
        type === "restriction"
          ? "gdpr_art18_restriction_requested"
          : "gdpr_art21_objection_requested",
      actor: profile.id,
      clinicId: profile.clinic_id ?? "system",
      metadata: {
        processingActivities,
        reason: reason.slice(0, 200), // truncate for audit log
        enforcedAt: new Date().toISOString(),
      },
    });

    return apiSuccess({
      message:
        type === "restriction"
          ? "Processing restriction applied immediately. All non-essential processing for your account has been suspended pending DPO review."
          : `Objection recorded. The following processing activities will be stopped: ${processingActivities.join(", ")}.`,
      type,
      processingActivities,
      submittedAt: new Date().toISOString(),
      reviewPeriodDays: 30,
    });
  },
  ["patient"],
);

// ---------------------------------------------------------------------------
// DELETE — withdraw an existing restriction or objection
// ---------------------------------------------------------------------------
export const DELETE = withAuth(
  async (request: NextRequest, { supabase, profile }) => {
    if (profile.role !== "patient") {
      return apiError(
        "Only patients can withdraw restriction/objection requests.",
        403,
        "FORBIDDEN",
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError("Invalid JSON body", 400, "INVALID_JSON");
    }

    const parsed = withdrawSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid request body", 422, "VALIDATION_ERROR");
    }

    const { type, reason } = parsed.data;

    let updateError: unknown = null;

    if (type === "restriction") {
      const { error } = await supabase
        .from("users")
        .update({
          processing_restricted: false,
          processing_restricted_at: null,
          processing_restriction_reason: null,
        } as never)
        .eq("id", profile.id);
      updateError = error;
    } else {
      const { error } = await supabase
        .from("users")
        .update({
          processing_objection_active: false,
          processing_objection_at: null,
          processing_objection_activities: [],
        } as never)
        .eq("id", profile.id);
      updateError = error;
    }

    if (updateError) {
      logger.error("Failed to clear restriction/objection flag", {
        context: "patient/restrict-processing",
        userId: profile.id,
        type,
        error: updateError,
      });
      return apiInternalError("Failed to withdraw your request.");
    }

    await logAuditEvent({
      supabase,
      type: "patient",
      action:
        type === "restriction"
          ? "gdpr_art18_restriction_withdrawn"
          : "gdpr_art21_objection_withdrawn",
      actor: profile.id,
      clinicId: profile.clinic_id ?? "system",
      metadata: { reason: reason?.slice(0, 200), withdrawnAt: new Date().toISOString() },
    });

    return apiSuccess({
      message: `Your ${type} request has been withdrawn. Processing has resumed.`,
      type,
      withdrawnAt: new Date().toISOString(),
    });
  },
  ["patient"],
);
