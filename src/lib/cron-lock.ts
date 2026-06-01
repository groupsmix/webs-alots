/**
 * Q-23: Cron advisory lock to prevent concurrent cron runs.
 *
 * Uses pg_try_advisory_lock via the `try_cron_advisory_lock` RPC.
 * If a lock cannot be acquired (another instance holds it), the cron
 * should exit early with a 200 (success — nothing to do).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Attempt to acquire a session-level advisory lock for a cron job.
 * Returns true if the lock was acquired, false if another instance holds it.
 */
export async function tryCronLock(supabase: SupabaseClient, cronName: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("try_cron_advisory_lock", {
    cron_name: cronName,
  });

  if (error) {
    // If the RPC doesn't exist yet (migration not applied), allow execution
    // to avoid breaking existing behavior.
    return true;
  }

  return data === true;
}
