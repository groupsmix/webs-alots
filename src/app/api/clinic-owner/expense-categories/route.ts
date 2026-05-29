/**
 * GET/POST/PATCH /api/clinic-owner/expense-categories
 *
 * CRUD for expense categories. Requires clinic_admin role.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { apiSuccess, apiError, apiInternalError, apiSupabaseError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import type { UserRole } from "@/lib/types/database";
import type { Database } from "@/lib/types/database-extended";
import {
  expenseCategoryCreateSchema,
  expenseCategoryUpdateSchema,
} from "@/lib/validations/clinic-owner";
import { safeParse } from "@/lib/validations/helpers";
import { withAuth, type AuthContext } from "@/lib/with-auth";

type ExtendedClient = SupabaseClient<Database>;

const ALLOWED_ROLES: UserRole[] = ["clinic_admin"];

async function handleGet(_request: NextRequest, auth: AuthContext) {
  try {
    const supabase = auth.supabase as unknown as ExtendedClient;
    const { profile } = auth;
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiInternalError("Missing clinic context");

    const { data, error } = await supabase
      .from("expense_categories")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("name");

    if (error) return apiSupabaseError(error, "expense-categories/list");

    return apiSuccess({ categories: data ?? [] });
  } catch (err) {
    logger.error("Failed to fetch expense categories", {
      context: "clinic-owner/expense-categories",
      error: err,
    });
    return apiInternalError("Failed to fetch expense categories");
  }
}

async function handlePost(request: NextRequest, auth: AuthContext) {
  try {
    const supabase = auth.supabase as unknown as ExtendedClient;
    const { profile, user } = auth;
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiInternalError("Missing clinic context");

    const body = await request.json();
    const parsed = safeParse(expenseCategoryCreateSchema, body);
    if (!parsed.success) return apiError(parsed.error, 422, "VALIDATION_ERROR");

    const { name, type, description } = parsed.data;

    const { data, error } = await supabase
      .from("expense_categories")
      .insert({
        clinic_id: clinicId,
        name,
        type,
        description: description ?? null,
      })
      .select()
      .single();

    if (error) return apiSupabaseError(error, "expense-categories/create");

    await logAuditEvent({
      supabase,
      action: "expense_category_created",
      type: "admin",
      clinicId,
      actor: user.id,
      description: `Expense category created: ${name}`,
    });

    return apiSuccess({ category: data }, 201);
  } catch (err) {
    logger.error("Failed to create expense category", {
      context: "clinic-owner/expense-categories",
      error: err,
    });
    return apiInternalError("Failed to create expense category");
  }
}

async function handlePatch(request: NextRequest, auth: AuthContext) {
  try {
    const supabase = auth.supabase as unknown as ExtendedClient;
    const { profile, user } = auth;
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiInternalError("Missing clinic context");

    const body = await request.json();
    const parsed = safeParse(expenseCategoryUpdateSchema, body);
    if (!parsed.success) return apiError(parsed.error, 422, "VALIDATION_ERROR");

    const { id, ...updates } = parsed.data;

    const updatePayload: Database["public"]["Tables"]["expense_categories"]["Update"] = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) updatePayload.name = updates.name;
    if (updates.type !== undefined) updatePayload.type = updates.type;
    if (updates.description !== undefined) updatePayload.description = updates.description;
    if (updates.is_active !== undefined) updatePayload.is_active = updates.is_active;

    const { data, error } = await supabase
      .from("expense_categories")
      .update(updatePayload)
      .eq("id", id)
      .eq("clinic_id", clinicId)
      .select()
      .single();

    if (error) return apiSupabaseError(error, "expense-categories/update");

    await logAuditEvent({
      supabase,
      action: "expense_category_updated",
      type: "admin",
      clinicId,
      actor: user.id,
      description: `Expense category updated: ${id}`,
    });

    return apiSuccess({ category: data });
  } catch (err) {
    logger.error("Failed to update expense category", {
      context: "clinic-owner/expense-categories",
      error: err,
    });
    return apiInternalError("Failed to update expense category");
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);
export const POST = withAuth(handlePost, ALLOWED_ROLES);
export const PATCH = withAuth(handlePatch, ALLOWED_ROLES);
