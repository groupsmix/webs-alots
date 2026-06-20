/**
 * GET   /api/super-admin/me   — Return current super_admin user profile (including metadata)
 * PATCH /api/super-admin/me   — Merge a key into user metadata
 *                               Body: { metadataKey: string, value: Record<string, unknown> }
 *
 * Requires super_admin role.
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types/database";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["super_admin"];

const patchBodySchema = z.object({
  metadataKey: z.string().min(1).max(100),
  value: z.record(z.unknown()),
});

// ── GET ────────────────────────────────────────────────────────────────────

async function handleGet(_req: NextRequest, auth: AuthContext) {
  try {
    const supabase = await createClient();
    // nosemgrep: tenant-scoping — self-service read of the authenticated super_admin's own row (.eq("id", auth.profile.id)); RLS enforces ownership
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, role, metadata")
      .eq("id", auth.profile.id)
      .single();

    if (error || !data) {
      return apiInternalError("Failed to load profile");
    }
    return apiSuccess({ ...data });
  } catch (err) {
    logger.error("Unexpected error GET /api/super-admin/me", { error: err });
    return apiInternalError("Unexpected error");
  }
}

// ── PATCH ──────────────────────────────────────────────────────────────────

async function handlePatch(req: NextRequest, auth: AuthContext) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400, "INVALID_JSON");
  }

  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400, "VALIDATION_ERROR");
  }

  try {
    const supabase = await createClient();

    // Fetch current metadata to merge
    // nosemgrep: tenant-scoping — self-service read of the authenticated super_admin's own row (.eq("id", auth.profile.id)); RLS enforces ownership
    const { data: current, error: fetchErr } = await supabase
      .from("users")
      .select("metadata")
      .eq("id", auth.profile.id)
      .single();

    if (fetchErr || !current) {
      return apiInternalError("Failed to fetch user");
    }

    const currentMeta = (current.metadata ?? {}) as Record<string, unknown>;
    const newMeta = { ...currentMeta, [parsed.data.metadataKey]: parsed.data.value };

    // nosemgrep: tenant-scoping — self-service update of the authenticated super_admin's own row (.eq("id", auth.profile.id)); RLS enforces ownership
    const { error: updateErr } = await supabase
      .from("users")
      .update({ metadata: newMeta, updated_at: new Date().toISOString() })
      .eq("id", auth.profile.id);

    if (updateErr) {
      logger.warn("Failed to update user metadata", {
        context: "super-admin/me",
        error: updateErr,
      });
      return apiInternalError("Failed to save settings");
    }

    return apiSuccess({ ok: true });
  } catch (err) {
    logger.error("Unexpected error PATCH /api/super-admin/me", { error: err });
    return apiInternalError("Unexpected error");
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);
export const PATCH = withAuth(handlePatch, ALLOWED_ROLES);
