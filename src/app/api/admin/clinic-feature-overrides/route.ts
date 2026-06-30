/**
 * GET    /api/admin/clinic-feature-overrides?clinic_id=<uuid>
 * POST   /api/admin/clinic-feature-overrides
 * DELETE /api/admin/clinic-feature-overrides
 *
 * Manages per-clinic feature toggle overrides.
 * Restricted to super_admin role.
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiInternalError, apiValidationError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types/database";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["super_admin"];

async function handleGet(request: NextRequest, _auth: AuthContext) {
  try {
    const { searchParams } = new URL(request.url);
    const clinicId = searchParams.get("clinic_id");

    if (!clinicId) {
      return apiValidationError("clinic_id query parameter is required");
    }

    const supabase = createAdminClient("super_admin"); // nosemgrep: semgrep.admin-client-guard
    const { data, error } = await supabase
      .from("clinic_feature_overrides") // nosemgrep: semgrep.tenant-scoping
      .select("id, clinic_id, feature_key, enabled, created_at, updated_at")
      .eq("clinic_id", clinicId);

    if (error) {
      logger.error("Failed to fetch clinic feature overrides", {
        context: "clinic-feature-overrides",
        clinicId,
        error,
      });
      return apiInternalError();
    }

    return apiSuccess({ overrides: data ?? [] });
  } catch (error) {
    logger.error("Clinic feature overrides GET failed", {
      context: "clinic-feature-overrides",
      error,
    });
    return apiInternalError();
  }
}

async function handlePost(request: NextRequest, _auth: AuthContext) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiValidationError("Invalid JSON body");
    }

    const { clinic_id, feature_key, enabled } = body as {
      clinic_id?: string;
      feature_key?: string;
      enabled?: boolean;
    };

    if (!clinic_id || typeof clinic_id !== "string") {
      return apiValidationError("clinic_id is required and must be a string");
    }
    if (!feature_key || typeof feature_key !== "string") {
      return apiValidationError("feature_key is required and must be a string");
    }
    if (typeof enabled !== "boolean") {
      return apiValidationError("enabled is required and must be a boolean");
    }

    const supabase = createAdminClient("super_admin"); // nosemgrep: semgrep.admin-client-guard
    const { data, error } = await supabase
      .from("clinic_feature_overrides") // nosemgrep: semgrep.tenant-scoping
      .upsert(
        {
          clinic_id,
          feature_key,
          enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "clinic_id,feature_key" },
      )
      .select()
      .single();

    if (error) {
      logger.error("Failed to upsert clinic feature override", {
        context: "clinic-feature-overrides",
        clinic_id,
        feature_key,
        error,
      });
      return apiInternalError();
    }

    return apiSuccess({ override: data });
  } catch (error) {
    logger.error("Clinic feature overrides POST failed", {
      context: "clinic-feature-overrides",
      error,
    });
    return apiInternalError();
  }
}

async function handleDelete(request: NextRequest, _auth: AuthContext) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiValidationError("Invalid JSON body");
    }

    const { clinic_id, feature_key } = body as {
      clinic_id?: string;
      feature_key?: string;
    };

    if (!clinic_id || typeof clinic_id !== "string") {
      return apiValidationError("clinic_id is required and must be a string");
    }
    if (!feature_key || typeof feature_key !== "string") {
      return apiValidationError("feature_key is required and must be a string");
    }

    const supabase = createAdminClient("super_admin"); // nosemgrep: semgrep.admin-client-guard
    const { error } = await supabase
      .from("clinic_feature_overrides") // nosemgrep: semgrep.tenant-scoping
      .delete()
      .eq("clinic_id", clinic_id)
      .eq("feature_key", feature_key);

    if (error) {
      logger.error("Failed to delete clinic feature override", {
        context: "clinic-feature-overrides",
        clinic_id,
        feature_key,
        error,
      });
      return apiInternalError();
    }

    return apiSuccess({ deleted: true });
  } catch (error) {
    logger.error("Clinic feature overrides DELETE failed", {
      context: "clinic-feature-overrides",
      error,
    });
    return apiInternalError();
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);
export const POST = withAuth(handlePost, ALLOWED_ROLES);
export const DELETE = withAuth(handleDelete, ALLOWED_ROLES);
