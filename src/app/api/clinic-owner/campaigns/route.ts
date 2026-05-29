/**
 * GET/POST/PATCH/DELETE /api/clinic-owner/campaigns
 *
 * CRUD for marketing campaigns. Requires clinic_admin role.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { apiSuccess, apiError, apiInternalError, apiSupabaseError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import type { UserRole } from "@/lib/types/database";
import type { Database } from "@/lib/types/database-extended";
import { campaignCreateSchema, campaignUpdateSchema } from "@/lib/validations/clinic-owner";
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
      .from("marketing_campaigns")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false });

    if (error) return apiSupabaseError(error, "campaigns/list");

    return apiSuccess({ campaigns: data ?? [] });
  } catch (err) {
    logger.error("Failed to fetch campaigns", {
      context: "clinic-owner/campaigns",
      error: err,
    });
    return apiInternalError("Failed to fetch campaigns");
  }
}

async function handlePost(request: NextRequest, auth: AuthContext) {
  try {
    const supabase = auth.supabase as unknown as ExtendedClient;
    const { profile, user } = auth;
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiInternalError("Missing clinic context");

    const body = await request.json();
    const parsed = safeParse(campaignCreateSchema, body);
    if (!parsed.success) return apiError(parsed.error, 422, "VALIDATION_ERROR");

    const { name, channel, budget, spend, start_date, end_date, status, notes } = parsed.data;

    const { data, error } = await supabase
      .from("marketing_campaigns")
      .insert({
        clinic_id: clinicId,
        name,
        channel,
        budget,
        spend: spend ?? 0,
        start_date,
        end_date: end_date ?? null,
        status: status ?? "active",
        notes: notes ?? null,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) return apiSupabaseError(error, "campaigns/create");

    await logAuditEvent({
      supabase,
      action: "campaign_created",
      type: "admin",
      clinicId,
      actor: user.id,
      description: `Campaign created: ${name} (${channel})`,
    });

    return apiSuccess({ campaign: data }, 201);
  } catch (err) {
    logger.error("Failed to create campaign", { context: "clinic-owner/campaigns", error: err });
    return apiInternalError("Failed to create campaign");
  }
}

async function handlePatch(request: NextRequest, auth: AuthContext) {
  try {
    const supabase = auth.supabase as unknown as ExtendedClient;
    const { profile, user } = auth;
    const clinicId = profile.clinic_id;
    if (!clinicId) return apiInternalError("Missing clinic context");

    const body = await request.json();
    const parsed = safeParse(campaignUpdateSchema, body);
    if (!parsed.success) return apiError(parsed.error, 422, "VALIDATION_ERROR");

    const { id, ...updates } = parsed.data;

    const updatePayload: Database["public"]["Tables"]["marketing_campaigns"]["Update"] = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) updatePayload.name = updates.name;
    if (updates.channel !== undefined) updatePayload.channel = updates.channel;
    if (updates.budget !== undefined) updatePayload.budget = updates.budget;
    if (updates.spend !== undefined) updatePayload.spend = updates.spend;
    if (updates.start_date !== undefined) updatePayload.start_date = updates.start_date;
    if (updates.end_date !== undefined) updatePayload.end_date = updates.end_date;
    if (updates.status !== undefined) updatePayload.status = updates.status;
    if (updates.notes !== undefined) updatePayload.notes = updates.notes;

    const { data, error } = await supabase
      .from("marketing_campaigns")
      .update(updatePayload)
      .eq("id", id)
      .eq("clinic_id", clinicId)
      .select()
      .single();

    if (error) return apiSupabaseError(error, "campaigns/update");

    await logAuditEvent({
      supabase,
      action: "campaign_updated",
      type: "admin",
      clinicId,
      actor: user.id,
      description: `Campaign updated: ${id}`,
    });

    return apiSuccess({ campaign: data });
  } catch (err) {
    logger.error("Failed to update campaign", { context: "clinic-owner/campaigns", error: err });
    return apiInternalError("Failed to update campaign");
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
    if (!id) return apiError("Missing campaign id", 400);

    const { error } = await supabase
      .from("marketing_campaigns")
      .delete()
      .eq("id", id)
      .eq("clinic_id", clinicId);

    if (error) return apiSupabaseError(error, "campaigns/delete");

    await logAuditEvent({
      supabase,
      action: "campaign_deleted",
      type: "admin",
      clinicId,
      actor: user.id,
      description: `Campaign deleted: ${id}`,
    });

    return apiSuccess({ deleted: true });
  } catch (err) {
    logger.error("Failed to delete campaign", { context: "clinic-owner/campaigns", error: err });
    return apiInternalError("Failed to delete campaign");
  }
}

export const GET = withAuth(handleGet, ALLOWED_ROLES);
export const POST = withAuth(handlePost, ALLOWED_ROLES);
export const PATCH = withAuth(handlePatch, ALLOWED_ROLES);
export const DELETE = withAuth(handleDelete, ALLOWED_ROLES);
