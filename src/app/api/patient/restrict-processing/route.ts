/**
 * A62-3: GDPR Art.18 (Restriction) / Art.21 (Objection) Request API.
 *
 * Allows patients to submit a request to restrict processing or object
 * to specific processing activities. Requests are logged to
 * `activity_logs` for audit and routed to support for manual review.
 *
 * POST /api/patient/restrict-processing — Submit a restriction/objection request
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { withAuth } from "@/lib/with-auth";

const restrictProcessingSchema = z.object({
  type: z.enum(["restriction", "objection"]),
  reason: z
    .string()
    .min(10, "Please provide a reason (minimum 10 characters)")
    .max(2000, "Reason must be under 2000 characters"),
  processingActivities: z
    .array(z.string().max(200))
    .min(1, "At least one processing activity must be specified")
    .max(20),
});

export const POST = withAuth(
  async (request: NextRequest, { supabase, profile }) => {
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

    if (profile.role !== "patient") {
      return apiError(
        "Only patients can submit restriction/objection requests. Staff: contact support directly.",
        403,
        "FORBIDDEN",
      );
    }

    try {
      await supabase.from("activity_logs").insert({
        action:
          type === "restriction"
            ? "processing_restriction_requested"
            : "processing_objection_requested",
        type: "patient",
        actor: profile.id,
        clinic_id: profile.clinic_id,
        description: `Patient submitted GDPR Art.${type === "restriction" ? "18 restriction" : "21 objection"} request. Activities: ${processingActivities.join(", ")}. Reason: ${reason}`,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.error("Failed to log restriction/objection request", {
        context: "patient/restrict-processing",
        error: err,
      });
      return apiInternalError("Failed to submit request");
    }

    return apiSuccess({
      message: `Your ${type} request has been submitted and will be reviewed by our data protection team within 30 days.`,
      type,
      processingActivities,
      submittedAt: new Date().toISOString(),
    });
  },
  ["patient"],
);
