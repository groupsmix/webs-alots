/**
 * GET  /api/admin/upload-policies — List upload policies for the clinic
 * POST /api/admin/upload-policies — Create or update a per-category limit
 * DELETE /api/admin/upload-policies — Delete a policy (reverts to platform default)
 *
 * Requires clinic_admin or super_admin role.
 * All operations are scoped to the authenticated user's clinic_id (tenant isolation).
 *
 * NOTE: `upload_policies` is not yet reflected in the generated database.ts types
 * (Docker Desktop is required to regenerate them locally). Until types are
 * regenerated, we cast the supabase client to `any` for these queries only.
 */

import { type NextRequest } from "next/server";
import { LIMITS_BY_CATEGORY, DEFAULT_UPLOAD_LIMIT, MAX_UPLOAD_BYTES } from "@/app/api/upload/route";
import { apiSuccess, apiError, apiInternalError, apiValidationError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { normalizePhiCategory } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import type { UserRole } from "@/lib/types/database";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["super_admin", "clinic_admin"];

/** Platform ceiling enforced in the CHECK constraint and here. */
const MAX_BYTES = MAX_UPLOAD_BYTES; // 25 MiB
const MIN_BYTES = 1024; // 1 KiB — anything smaller is not a real file

async function handleGet(_request: NextRequest, auth: AuthContext) {
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) {
    return apiError("Clinic context required", 403);
  }

  // Cast to any: upload_policies not yet in generated types (needs Docker for regen)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = auth.supabase as any;

  try {
    // nosemgrep: semgrep.tenant-scoping -- scoped by .eq("clinic_id", clinicId) below; the
    // `as any` cast (upload_policies not in generated types) hides it from the matcher.
    const { data, error } = await db
      .from("upload_policies")
      .select("id, category, max_upload_bytes, created_at, updated_at")
      .eq("clinic_id", clinicId)
      .order("category", { ascending: true });

    if (error) {
      logger.error("Failed to fetch upload policies", {
        context: "upload-policies",
        clinicId,
        error: error.message,
      });
      return apiInternalError("Failed to fetch upload policies");
    }

    // Annotate each row with the platform default for comparison
    const policies = (
      (data ?? []) as Array<{
        id: string;
        category: string;
        max_upload_bytes: number;
        created_at: string;
        updated_at: string;
      }>
    ).map((row) => ({
      ...row,
      platform_default_bytes: LIMITS_BY_CATEGORY[row.category] ?? DEFAULT_UPLOAD_LIMIT,
    }));

    return apiSuccess({ policies });
  } catch (err) {
    logger.error("Upload policies GET failed", {
      context: "upload-policies",
      error: err,
    });
    return apiInternalError();
  }
}

async function handlePost(request: NextRequest, auth: AuthContext) {
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) {
    return apiError("Clinic context required", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiValidationError("Invalid JSON body");
  }

  const { category, max_upload_bytes } = body as {
    category?: string;
    max_upload_bytes?: number;
  };

  if (!category || typeof category !== "string") {
    return apiValidationError("category is required (string)");
  }
  if (
    max_upload_bytes == null ||
    typeof max_upload_bytes !== "number" ||
    !Number.isInteger(max_upload_bytes)
  ) {
    return apiValidationError("max_upload_bytes is required (integer)");
  }
  if (max_upload_bytes < MIN_BYTES || max_upload_bytes > MAX_BYTES) {
    return apiValidationError(`max_upload_bytes must be between ${MIN_BYTES} and ${MAX_BYTES}`);
  }

  const normalizedCategory = normalizePhiCategory(category);

  // Cast to any: upload_policies not yet in generated types (needs Docker for regen)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = auth.supabase as any;

  try {
    // Upsert: create or update the policy for this (clinic, category) pair
    // nosemgrep: semgrep.tenant-scoping -- clinic_id is set in the upsert payload below; the
    // `as any` cast (upload_policies not in generated types) hides it from the matcher.
    const { data, error } = await db
      .from("upload_policies")
      .upsert(
        {
          clinic_id: clinicId,
          category: normalizedCategory,
          max_upload_bytes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "clinic_id,category" },
      )
      .select("id, category, max_upload_bytes, created_at, updated_at")
      .single();

    if (error) {
      logger.error("Failed to upsert upload policy", {
        context: "upload-policies",
        clinicId,
        category: normalizedCategory,
        error: error.message,
      });
      return apiInternalError("Failed to save upload policy");
    }

    await logAuditEvent({
      supabase: auth.supabase,
      action: "upload_policy_upsert",
      type: "config",
      clinicId,
      actor: auth.user.id,
      description: `Upload policy for "${normalizedCategory}" set to ${max_upload_bytes} bytes`,
      metadata: {
        category: normalizedCategory,
        max_upload_bytes,
        platform_default: LIMITS_BY_CATEGORY[normalizedCategory] ?? DEFAULT_UPLOAD_LIMIT,
      },
    });

    const row = data as {
      id: string;
      category: string;
      max_upload_bytes: number;
      created_at: string;
      updated_at: string;
    };

    return apiSuccess({
      policy: {
        ...row,
        platform_default_bytes: LIMITS_BY_CATEGORY[normalizedCategory] ?? DEFAULT_UPLOAD_LIMIT,
      },
    });
  } catch (err) {
    logger.error("Upload policies POST failed", {
      context: "upload-policies",
      error: err,
    });
    return apiInternalError();
  }
}

async function handleDelete(request: NextRequest, auth: AuthContext) {
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) {
    return apiError("Clinic context required", 403);
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  if (!category) {
    return apiValidationError("category query parameter is required");
  }

  const normalizedCategory = normalizePhiCategory(category);

  // Cast to any: upload_policies not yet in generated types (needs Docker for regen)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = auth.supabase as any;

  try {
    // nosemgrep: semgrep.tenant-scoping -- scoped by .eq("clinic_id", clinicId) below; the
    // `as any` cast (upload_policies not in generated types) hides it from the matcher.
    const { error } = await db
      .from("upload_policies")
      .delete()
      .eq("clinic_id", clinicId)
      .eq("category", normalizedCategory);

    if (error) {
      logger.error("Failed to delete upload policy", {
        context: "upload-policies",
        clinicId,
        category: normalizedCategory,
        error: error.message,
      });
      return apiInternalError("Failed to delete upload policy");
    }

    await logAuditEvent({
      supabase: auth.supabase,
      action: "upload_policy_delete",
      type: "config",
      clinicId,
      actor: auth.user.id,
      description: `Upload policy for "${normalizedCategory}" deleted (reverted to platform default)`,
      metadata: {
        category: normalizedCategory,
        reverted_to: LIMITS_BY_CATEGORY[normalizedCategory] ?? DEFAULT_UPLOAD_LIMIT,
      },
    });

    return apiSuccess({ deleted: true, category: normalizedCategory });
  } catch (err) {
    logger.error("Upload policies DELETE failed", {
      context: "upload-policies",
      error: err,
    });
    return apiInternalError();
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);
export const POST = withAuth(handlePost, ALLOWED_ROLES);
export const DELETE = withAuth(handleDelete, ALLOWED_ROLES);
