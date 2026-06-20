/**
 * GET  /api/admin/working-hours  — Load doctor weekly schedules from clinics.config
 * PUT  /api/admin/working-hours  — Save doctor weekly schedules into clinics.config
 *
 * Requires clinic_admin role.
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createTenantClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types/database";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["clinic_admin"];

const dayScheduleSchema = z.object({
  open: z.string().regex(/^\d{2}:\d{2}$/),
  close: z.string().regex(/^\d{2}:\d{2}$/),
  enabled: z.boolean(),
});

const putBodySchema = z.object({
  doctorSchedules: z.record(
    z.string().uuid(),
    z.record(z.string().regex(/^[0-6]$/), dayScheduleSchema),
  ),
});

// ── GET ────────────────────────────────────────────────────────────────────

async function handleGet(_req: NextRequest, auth: AuthContext) {
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) return apiError("No clinic context", 400, "NO_CLINIC");

  try {
    const supabase = await createTenantClient(clinicId);
    const { data: clinic, error } = await supabase
      .from("clinics")
      .select("config")
      .eq("id", clinicId)
      .single();

    if (error || !clinic) {
      return apiInternalError("Failed to load clinic");
    }

    const cfg = (clinic.config ?? {}) as Record<string, unknown>;
    return apiSuccess({
      doctorSchedules: (cfg.doctorSchedules ?? {}) as Record<
        string,
        Record<string, { open: string; close: string; enabled: boolean }>
      >,
    });
  } catch (err) {
    logger.error("Unexpected error in GET /api/admin/working-hours", { error: err });
    return apiInternalError("Unexpected error");
  }
}

// ── PUT ────────────────────────────────────────────────────────────────────

async function handlePut(req: NextRequest, auth: AuthContext) {
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) return apiError("No clinic context", 400, "NO_CLINIC");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400, "INVALID_JSON");
  }

  const parsed = putBodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400, "VALIDATION_ERROR");
  }

  try {
    const supabase = await createTenantClient(clinicId);
    // Merge into existing config to avoid clobbering other config keys
    const { data: current } = await supabase
      .from("clinics")
      .select("config")
      .eq("id", clinicId)
      .single();

    const currentConfig = (current?.config ?? {}) as Record<string, unknown>;
    await supabase
      .from("clinics")
      .update({ config: { ...currentConfig, doctorSchedules: parsed.data.doctorSchedules } })
      .eq("id", clinicId);

    return apiSuccess({ ok: true });
  } catch (err) {
    logger.error("Unexpected error in PUT /api/admin/working-hours", { error: err });
    return apiInternalError("Failed to save schedules");
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);
export const PUT = withAuth(handlePut, ALLOWED_ROLES);
