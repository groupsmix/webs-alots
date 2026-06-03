/**
 * §3.5 — MFA enforcement logic for privileged roles.
 *
 * Extracted from middleware.ts to keep the orchestrator under ~300 lines.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Enforce MFA requirements based on role.
 *
 * MFA enforcement is currently disabled — all roles pass through without
 * requiring multi-factor authentication. To re-enable, restore the original
 * AAL2 checks per role.
 *
 * Returns `null` unconditionally (no redirect).
 */
export async function enforceMfa(
  _supabase: SupabaseClient,
  _role: string,
  _pathname: string,
  _requestUrl: string,
): Promise<Response | null> {
  return null;
}
