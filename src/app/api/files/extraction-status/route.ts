/**
 * GET /api/files/extraction-status?fileId=UUID
 *
 * Polls the AI extraction lifecycle for a single patient file.
 * Returns the current extraction_status, extracted_data, and extracted_at
 * so the frontend can reflect progress and render results once complete.
 *
 * Authorization:
 *   - Requires an authenticated session via `withAuth`.
 *   - Allowed roles: doctor, clinic_admin, receptionist.
 *   - Tenant isolation: query is always scoped to the caller's clinic_id.
 *
 * Rate-limited by the clinic-level AI ceiling (aiClinicCeilingLimiter)
 * to prevent polling abuse that could inflate per-clinic counters.
 *
 * OWASP notes:
 *   - A01: withAuth enforces authentication + RBAC.
 *   - A03: fileId is validated as a UUID before it touches the DB.
 *   - A04: no PHI is logged — only IDs and status strings.
 *   - A05: tenant scoping via .eq("clinic_id", clinicId) on every query.
 */

import type { NextRequest } from "next/server";
import { type NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiInternalError, apiRateLimited, apiSuccess } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { aiClinicCeilingLimiter } from "@/lib/rate-limit";
import { withAuth, type AuthContext } from "@/lib/with-auth";

// ── Validation ────────────────────────────────────────────────────────────────

const fileIdSchema = z.string().uuid();

// ── Typed query result ────────────────────────────────────────────────────────
// patient_files is not yet in the generated Database types (see database-extended.ts).
// We manually describe the columns we need.

interface ExtractionStatusRow {
  id: string;
  extraction_status: "pending" | "processing" | "completed" | "failed" | null;
  extracted_data: Record<string, unknown> | null;
  extracted_at: string | null;
}

// ── Handler ───────────────────────────────────────────────────────────────────

async function handler(
  request: NextRequest,
  { supabase, profile }: AuthContext,
): Promise<NextResponse> {
  const clinicId = profile.clinic_id;

  // Patients do not use this endpoint — staff only.
  if (!clinicId) {
    return apiError("No clinic associated with this account", 403, "NO_CLINIC");
  }

  // ── Rate limit per clinic to prevent polling storms ──
  const ceilingAllowed = await aiClinicCeilingLimiter.check(`ai-ceiling:${clinicId}`);
  if (!ceilingAllowed) {
    return apiRateLimited("Limite quotidienne de la clinique atteinte. Réessayez demain.");
  }

  // ── Validate fileId query param ──
  const rawFileId = request.nextUrl.searchParams.get("fileId");
  const parseResult = fileIdSchema.safeParse(rawFileId);
  if (!parseResult.success) {
    return apiError("fileId must be a valid UUID", 400, "INVALID_FILE_ID");
  }
  const fileId = parseResult.data;

  // ── Fetch extraction status (tenant-scoped) ──
  try {
    // patient_files new columns are not in the generated types yet; cast once
    // at the boundary and type the result explicitly.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rawData, error } = await (supabase as any)
      .from("patient_files")
      .select("id, extraction_status, extracted_data, extracted_at")
      .eq("id", fileId)
      .eq("clinic_id", clinicId) // CRITICAL: tenant isolation
      .maybeSingle();

    const data = rawData as ExtractionStatusRow | null;

    if (error) {
      logger.error("Failed to query extraction status", {
        context: "api/files/extraction-status",
        fileId,
        error: error.message,
      });
      return apiInternalError("Failed to retrieve extraction status");
    }

    if (!data) {
      return apiError("File not found", 404, "FILE_NOT_FOUND");
    }

    // Audit completed extractions so PHI access is traceable (Law 09-08)
    if (data.extraction_status === "completed") {
      await logAuditEvent({
        supabase,
        action: "extraction_status_viewed",
        type: "patient",
        clinicId,
        actor: profile.id,
        description: `Viewed AI extraction results for file ${fileId}`,
        metadata: { fileId, role: profile.role },
      }).catch((err) => {
        logger.warn("Failed to log extraction status audit event", {
          context: "api/files/extraction-status",
          error: err,
        });
      });
    }

    return apiSuccess({
      status: data.extraction_status ?? "pending",
      extractedData: data.extracted_data,
      extractedAt: data.extracted_at,
    });
  } catch (err) {
    logger.error("Unexpected error in extraction-status route", {
      context: "api/files/extraction-status",
      fileId,
      error: err,
    });
    return apiInternalError();
  }
}

export const GET = withAuth(handler, ["doctor", "clinic_admin", "receptionist"]);
