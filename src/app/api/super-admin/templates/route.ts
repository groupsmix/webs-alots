/**
 * GET    /api/super-admin/templates        — List all document templates
 * POST   /api/super-admin/templates        — Create a new template
 * PUT    /api/super-admin/templates        — Update an existing template
 *                                            Body: { id, ...fields }
 * DELETE /api/super-admin/templates?id=… — Delete a template
 * PATCH  /api/super-admin/templates        — Toggle is_active
 *                                            Body: { id, active: boolean }
 *
 * Requires super_admin role.
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError, apiInternalError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import type { UserRole } from "@/lib/types/database";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const ALLOWED_ROLES: UserRole[] = ["super_admin"];

const templateFields = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional().default(""),
  type: z.enum(["prescription", "invoice", "report", "certificate", "consent", "letter"]),
  clinicType: z.enum(["all", "doctor", "dentist", "pharmacy"]).default("all"),
  content: z.string().min(1).max(50000),
});

const createSchema = templateFields;
const updateSchema = templateFields.extend({ id: z.string().uuid() });
const patchSchema = z.object({ id: z.string().uuid(), active: z.boolean() });

// ── GET ────────────────────────────────────────────────────────────────────

async function handleGet(_req: NextRequest, _auth: AuthContext) {
  try {
    const supabase = createUntypedAdminClient("super_admin");
    const { data, error } = await supabase
      .from("document_templates")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      logger.warn("Failed to fetch document templates", { error });
      return apiInternalError("Failed to load templates");
    }

    return apiSuccess({ templates: data ?? [] });
  } catch (err) {
    logger.error("Unexpected error GET /api/super-admin/templates", { error: err });
    return apiInternalError("Unexpected error");
  }
}

// ── POST — create ──────────────────────────────────────────────────────────

async function handlePost(req: NextRequest, _auth: AuthContext) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON", 400, "INVALID_JSON");
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400, "VALIDATION_ERROR");

  try {
    const supabase = createUntypedAdminClient("super_admin");
    const { data, error } = await supabase
      .from("document_templates")
      .insert({
        name: parsed.data.name,
        description: parsed.data.description || null,
        type: parsed.data.type,
        clinic_type: parsed.data.clinicType,
        content: parsed.data.content,
        usage_count: 0,
        is_active: true,
      })
      .select("*")
      .single();

    if (error) {
      logger.warn("Failed to create document template", { error });
      return apiInternalError("Failed to create template");
    }
    return apiSuccess({ template: data }, 201);
  } catch (err) {
    logger.error("Unexpected error POST /api/super-admin/templates", { error: err });
    return apiInternalError("Unexpected error");
  }
}

// ── PUT — update ───────────────────────────────────────────────────────────

async function handlePut(req: NextRequest, _auth: AuthContext) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON", 400, "INVALID_JSON");
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success)
    return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400, "VALIDATION_ERROR");

  try {
    const supabase = createUntypedAdminClient("super_admin");
    const { data, error } = await supabase
      .from("document_templates")
      .update({
        name: parsed.data.name,
        description: parsed.data.description || null,
        type: parsed.data.type,
        clinic_type: parsed.data.clinicType,
        content: parsed.data.content,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.id)
      .select("*")
      .single();

    if (error) {
      logger.warn("Failed to update document template", { error });
      return apiInternalError("Failed to update template");
    }
    return apiSuccess({ template: data });
  } catch (err) {
    logger.error("Unexpected error PUT /api/super-admin/templates", { error: err });
    return apiInternalError("Unexpected error");
  }
}

// ── PATCH — toggle active ──────────────────────────────────────────────────

async function handlePatch(req: NextRequest, _auth: AuthContext) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON", 400, "INVALID_JSON");
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success)
    return apiError(parsed.error.issues[0]?.message ?? "Invalid body", 400, "VALIDATION_ERROR");

  try {
    const supabase = createUntypedAdminClient("super_admin");
    const { error } = await supabase
      .from("document_templates")
      .update({ is_active: parsed.data.active, updated_at: new Date().toISOString() })
      .eq("id", parsed.data.id);

    if (error) return apiInternalError("Failed to toggle template");
    return apiSuccess({ ok: true });
  } catch (err) {
    logger.error("Unexpected error PATCH /api/super-admin/templates", { error: err });
    return apiInternalError("Unexpected error");
  }
}

// ── DELETE ─────────────────────────────────────────────────────────────────

async function handleDelete(req: NextRequest, _auth: AuthContext) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return apiError("Missing id", 400, "MISSING_ID");

  try {
    const supabase = createUntypedAdminClient("super_admin");
    const { error } = await supabase.from("document_templates").delete().eq("id", id);
    if (error) return apiInternalError("Failed to delete template");
    return apiSuccess({ ok: true });
  } catch (err) {
    logger.error("Unexpected error DELETE /api/super-admin/templates", { error: err });
    return apiInternalError("Unexpected error");
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);
export const POST = withAuth(handlePost, ALLOWED_ROLES);
export const PUT = withAuth(handlePut, ALLOWED_ROLES);
export const PATCH = withAuth(handlePatch, ALLOWED_ROLES);
export const DELETE = withAuth(handleDelete, ALLOWED_ROLES);
