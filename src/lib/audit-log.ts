/**
 * Audit logging utility for healthcare compliance.
 *
 * Logs data mutations (appointment CRUD, patient changes, etc.) to the
 * `activity_logs` table. Failures are caught and logged to stderr so
 * they never break the calling endpoint.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

interface AuditLogParams {
  supabase: SupabaseClient<Database>;
  action: string;
  type: "booking" | "patient" | "payment" | "admin";
  actor?: string | null;
  clinicId?: string | null;
  clinicName?: string | null;
  description?: string | null;
}

export async function logAuditEvent({
  supabase,
  action,
  type,
  actor,
  clinicId,
  clinicName,
  description,
}: AuditLogParams): Promise<void> {
  try {
    await supabase.from("activity_logs").insert({
      action,
      type,
      actor: actor ?? null,
      clinic_id: clinicId ?? null,
      clinic_name: clinicName ?? null,
      description: description ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error(
      "[audit-log] Failed to write audit log:",
      err instanceof Error ? err.message : "Unknown error",
    );
  }
}
