/**
 * Helper for accessing new tables not yet in the generated Supabase types.
 *
 * The voice_notes, prescription_drafts, and drug_interaction_alerts tables
 * are created by migration 00109_batch4a_doctor_ai.sql but the Supabase
 * type generator has not yet been run. Once types are regenerated, callers
 * should switch to the typed `.from()` calls.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedFrom = SupabaseClient<any, any, any>["from"];

/**
 * Access a table that is not yet in the generated Database type.
 * Cast the supabase client to bypass type checking for new tables.
 */
export function fromUntyped(
  supabase: SupabaseClient,
  table: "voice_notes" | "prescription_drafts" | "drug_interaction_alerts",
): ReturnType<UntypedFrom> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as SupabaseClient<any, any, any>).from(table);
}
