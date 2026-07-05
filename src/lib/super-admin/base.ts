import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";

/**
 * Cookie-scoped Supabase client for super-admin server actions.
 *
 * This authenticates via the caller's session and enforces the
 * `super_admin` role before returning the client.
 */
export type SuperAdminClient = Awaited<ReturnType<typeof createClient>>;

export async function rawClient(): Promise<SuperAdminClient> {
  await requireRole("super_admin");
  return createClient();
}
