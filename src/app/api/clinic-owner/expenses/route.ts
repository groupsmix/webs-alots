/**
 * GET/POST /api/clinic-owner/expenses
 *
 * CRUD for clinic expenses. Requires clinic_admin role.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { apiSuccess, apiError, apiInternalError, apiSupabaseError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import type { UserRole } from "@/lib/types/database";
import type { Database } from "@/lib/types/database-extended";
import { expenseCreateSchema, expenseUpdateSchema } from "@/lib/validations/clinic-owner";
import { safeParse } from "@/lib/validations/helpers";
import { withAuth, type AuthContext } from "@/lib/with-auth";

type ExtendedClient = SupabaseClient<Database>;

const ALLOWED_ROLES: UserRole[] = ["clinic_admin"];

async function handleGet(request: NextRequest, auth: AuthContext) {
  try {
    const supabase = auth.supabase as unknown as ExtendedClient;
    const { profile } = auth;
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiInternalError("Missing clinic context");

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const categoryId = searchParams.get("category_id");

    let query = supabase
      .from("clinic_expenses")
      .select("*, expense_categories(id, name, type)")
      .eq("clinic_id", clinicId)
      .order("expense_date", { ascending: false });

    if (month) {
      const start = `${month}-01`;
      const [y, m] = month.split("-").map(Number);
      const endDate = new Date(y, m, 0);
      const end = `${y}-${String(m).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
      query = query.gte("expense_date", start).lte("expense_date", end);
    }

    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }

    const { data, error } = await query.limit(500);
    if (error) return apiSupabaseError(error, "expenses/list");

    return apiSuccess({ expenses: data ?? [] });
  } catch (err) {
    logger.error("Failed to fetch expenses", { context: "clinic-owner/expenses", error: err });
    return apiInternalError("Failed to fetch expenses");
  }
}

async function handlePost(request: NextRequest, auth: AuthContext) {
  try {
    const supabase = auth.supabase as unknown as ExtendedClient;
    const { profile, user } = auth;
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiInternalError("Missing clinic context");

    const body = await request.json();
    const parsed = safeParse(expenseCreateSchema, body);
    if (!parsed.success) return apiError(parsed.error, 422, "VALIDATION_ERROR");

    const {
      description,
      amount,
      category_id,
      expense_date,
      is_recurring,
      recurring_interval,
      notes,
    } = parsed.data;

    const { data, error } = await supabase
      .from("clinic_expenses")
      .insert({
        clinic_id: clinicId,
        category_id: category_id ?? null,
        description,
        amount,
        expense_date,
        is_recurring: is_recurring ?? false,
        recurring_interval: recurring_interval ?? null,
        notes: notes ?? null,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) return apiSupabaseError(error, "expenses/create");

    await logAuditEvent({
      supabase,
      action: "expense_created",
      type: "admin",
      clinicId,
      actor: user.id,
      description: `Expense created: ${description} (${amount} centimes)`,
    });

    return apiSuccess({ expense: data }, 201);
  } catch (err) {
    logger.error("Failed to create expense", { context: "clinic-owner/expenses", error: err });
    return apiInternalError("Failed to create expense");
  }
}

async function handlePatch(request: NextRequest, auth: AuthContext) {
  try {
    const supabase = auth.supabase as unknown as ExtendedClient;
    const { profile, user } = auth;
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiInternalError("Missing clinic context");

    const body = await request.json();
    const parsed = safeParse(expenseUpdateSchema, body);
    if (!parsed.success) return apiError(parsed.error, 422, "VALIDATION_ERROR");

    const { id, ...updates } = parsed.data;

    const updatePayload: Database["public"]["Tables"]["clinic_expenses"]["Update"] = {
      updated_at: new Date().toISOString(),
    };
    if (updates.description !== undefined) updatePayload.description = updates.description;
    if (updates.amount !== undefined) updatePayload.amount = updates.amount;
    if (updates.category_id !== undefined) updatePayload.category_id = updates.category_id;
    if (updates.expense_date !== undefined) updatePayload.expense_date = updates.expense_date;
    if (updates.is_recurring !== undefined) updatePayload.is_recurring = updates.is_recurring;
    if (updates.recurring_interval !== undefined)
      updatePayload.recurring_interval = updates.recurring_interval;
    if (updates.notes !== undefined) updatePayload.notes = updates.notes;

    const { data, error } = await supabase
      .from("clinic_expenses")
      .update(updatePayload)
      .eq("id", id)
      .eq("clinic_id", clinicId)
      .select()
      .single();

    if (error) return apiSupabaseError(error, "expenses/update");

    await logAuditEvent({
      supabase,
      action: "expense_updated",
      type: "admin",
      clinicId,
      actor: user.id,
      description: `Expense updated: ${id}`,
    });

    return apiSuccess({ expense: data });
  } catch (err) {
    logger.error("Failed to update expense", { context: "clinic-owner/expenses", error: err });
    return apiInternalError("Failed to update expense");
  }
}

async function handleDelete(request: NextRequest, auth: AuthContext) {
  try {
    const supabase = auth.supabase as unknown as ExtendedClient;
    const { profile, user } = auth;
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiInternalError("Missing clinic context");

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return apiError("Missing expense id", 400);

    const { error } = await supabase
      .from("clinic_expenses")
      .delete()
      .eq("id", id)
      .eq("clinic_id", clinicId);

    if (error) return apiSupabaseError(error, "expenses/delete");

    await logAuditEvent({
      supabase,
      action: "expense_deleted",
      type: "admin",
      clinicId,
      actor: user.id,
      description: `Expense deleted: ${id}`,
    });

    return apiSuccess({ deleted: true });
  } catch (err) {
    logger.error("Failed to delete expense", { context: "clinic-owner/expenses", error: err });
    return apiInternalError("Failed to delete expense");
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);
export const POST = withAuth(handlePost, ALLOWED_ROLES);
export const PATCH = withAuth(handlePatch, ALLOWED_ROLES);
export const DELETE = withAuth(handleDelete, ALLOWED_ROLES);
