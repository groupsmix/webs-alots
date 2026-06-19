"use client";

import { logger } from "@/lib/logger";
import { createClient, fetchRows } from "./_core";

// ─────────────────────────────────────────────
// Family members (patient-managed)
//
// Backed by the `family_members` table. The RLS policy
// `family_members_manage_own` requires every row to satisfy
// `primary_user_id = get_my_user_id()` AND `clinic_id = get_user_clinic_id()`,
// and `clinic_id` is NOT NULL (migrations 00029 / 00068). Writes must therefore
// include both the caller's user id and clinic id, or the row is rejected by RLS.
//
// The table stores name / relationship / phone only. The previous UI also
// collected age / gender / insurance, but there are no columns for those — they
// were dropped rather than silently discarded on save (which looked like it
// persisted but did not).
// ─────────────────────────────────────────────

export interface FamilyMemberView {
  id: string;
  name: string;
  relationship: string;
  phone: string | null;
}

interface FamilyMemberRaw {
  id: string;
  name: string;
  relationship: string;
  phone: string | null;
}

const SELECT_COLS = "id, name, relationship, phone";

function mapFamilyMember(raw: FamilyMemberRaw): FamilyMemberView {
  return {
    id: raw.id,
    name: raw.name,
    relationship: raw.relationship,
    phone: raw.phone ?? null,
  };
}

export async function fetchFamilyMembers(primaryUserId: string): Promise<FamilyMemberView[]> {
  const rows = await fetchRows<FamilyMemberRaw>("family_members", {
    select: SELECT_COLS,
    eq: [["primary_user_id", primaryUserId]],
    order: ["name", { ascending: true }],
  });
  return rows.map(mapFamilyMember);
}

export async function createFamilyMember(input: {
  primaryUserId: string;
  clinicId: string;
  name: string;
  relationship: string;
  phone?: string | null;
}): Promise<FamilyMemberView | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("family_members")
    .insert({
      primary_user_id: input.primaryUserId,
      clinic_id: input.clinicId,
      name: input.name,
      relationship: input.relationship,
      phone: input.phone ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generated types omit clinic_id, which the DB requires (added in migrations 00029/00068)
    } as any)
    .select(SELECT_COLS)
    .single();
  if (error || !data) {
    logger.warn("Failed to create family member", { context: "data/client/family", error });
    return null;
  }
  return mapFamilyMember(data as FamilyMemberRaw);
}

export async function updateFamilyMember(
  id: string,
  input: { name: string; relationship: string; phone?: string | null },
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("family_members")
    .update({
      name: input.name,
      relationship: input.relationship,
      phone: input.phone ?? null,
    })
    .eq("id", id);
  if (error) {
    logger.warn("Failed to update family member", { context: "data/client/family", error });
    return false;
  }
  return true;
}

export async function deleteFamilyMember(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("family_members").delete().eq("id", id);
  if (error) {
    logger.warn("Failed to delete family member", { context: "data/client/family", error });
    return false;
  }
  return true;
}
