"use client";

/**
 * Patient family-members data layer.
 *
 * Read + write helpers for the `family_members` table that a patient manages
 * under their own account. All access is RLS-scoped: the
 * `family_members_manage_own` policy restricts rows to
 * `primary_user_id = get_my_user_id()` AND `clinic_id = get_user_clinic_id()`,
 * so these run safely against the authenticated browser client.
 */

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-client";
import type { Database } from "@/lib/types/database";
import { fetchRows, type MutationResult } from "./_core";

export interface FamilyMemberView {
  id: string;
  name: string;
  relationship: string;
  phone: string | null;
}

/** Fetch the family members linked to a patient (RLS scopes to the caller). */
export async function fetchFamilyMembers(primaryUserId: string): Promise<FamilyMemberView[]> {
  return fetchRows<FamilyMemberView>("family_members", {
    select: "id, name, relationship, phone",
    eq: [["primary_user_id", primaryUserId]],
    order: ["created_at", { ascending: true }],
  });
}

export async function createFamilyMember(input: {
  primaryUserId: string;
  clinicId: string;
  name: string;
  relationship: string;
  phone?: string | null;
}): Promise<MutationResult<FamilyMemberView>> {
  const supabase = createClient();
  // NOTE: the generated database types lag migration 00068, which added
  // clinic_id (NOT NULL) to family_members. RLS (family_members_manage_own)
  // also requires it, so we send it explicitly via getCurrentUser().clinic_id.
  const { data, error } = await supabase
    .from("family_members")
    .insert({
      primary_user_id: input.primaryUserId,
      clinic_id: input.clinicId,
      name: input.name,
      relationship: input.relationship,
      phone: input.phone || null,
    } as Database["public"]["Tables"]["family_members"]["Insert"])
    .select("id, name, relationship, phone")
    .single();
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return { success: false, error: { code: error.code, message: error.message } };
  }
  return {
    success: true,
    data: {
      id: data.id,
      name: data.name,
      relationship: data.relationship,
      phone: data.phone,
    },
  };
}

export async function updateFamilyMember(
  id: string,
  input: { name: string; relationship: string; phone?: string | null },
): Promise<MutationResult<FamilyMemberView>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("family_members")
    .update({
      name: input.name,
      relationship: input.relationship,
      phone: input.phone || null,
    } as Database["public"]["Tables"]["family_members"]["Update"])
    .eq("id", id)
    .select("id, name, relationship, phone")
    .single();
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return { success: false, error: { code: error.code, message: error.message } };
  }
  return {
    success: true,
    data: {
      id: data.id,
      name: data.name,
      relationship: data.relationship,
      phone: data.phone,
    },
  };
}

export async function deleteFamilyMember(id: string): Promise<MutationResult<{ id: string }>> {
  const supabase = createClient();
  const { error } = await supabase.from("family_members").delete().eq("id", id);
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return { success: false, error: { code: error.code, message: error.message } };
  }
  return { success: true, data: { id } };
}
