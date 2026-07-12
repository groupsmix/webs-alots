"use client";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-client";
import type { Database } from "@/lib/types/database";
import { clearLookupCache, type MutationResult } from "./_core";
export type { MutationResult } from "./_core";

// ─────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────

export async function updateAppointmentStatus(
  appointmentId: string,
  status: string,
): Promise<MutationResult<{ id: string; status: string }>> {
  const supabase = createClient();
  // Explicit mapping from UI status names to DB column values (Issue 40).
  // Using a lookup object instead of fragile string replace.
  const STATUS_MAP: Record<string, string> = {
    "no-show": "no_show",
    "in-progress": "in_progress",
    "checked-in": "checked_in",
    "follow-up": "follow_up",
  };
  const dbStatus = STATUS_MAP[status] ?? status;
  const updateData: Database["public"]["Tables"]["appointments"]["Update"] = { status: dbStatus };
  if (dbStatus === "cancelled") {
    updateData.cancelled_at = new Date().toISOString();
  }
  // Issue 45: Return updated entity data via .select()
  const { data: updated, error } = await supabase
    .from("appointments")
    .update(updateData)
    .eq("id", appointmentId)
    .select("id, status")
    .single();
  if (error) {
    logger.warn("Query failed", { context: "data/client", error });
    return { success: false, error: { code: error.code, message: error.message } };
  }
  clearLookupCache();
  return { success: true, data: { id: updated.id, status: updated.status } };
}
