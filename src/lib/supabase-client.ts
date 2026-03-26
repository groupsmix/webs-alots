import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";

// Access NEXT_PUBLIC_* env vars via static property access so that Next.js
// can inline them at build time.  Dynamic access (process.env[name]) is NOT
// guaranteed to work in the browser bundle.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function createClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing Supabase environment variables. " +
      "Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set at build time.",
    );
  }
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/**
 * Create a browser Supabase client that includes the x-clinic-id header.
 *
 * Anonymous (not-logged-in) queries against tables with RLS policies that
 * call `get_request_clinic_id()` need this header so PostgREST can
 * resolve the current tenant.  Authenticated sessions already carry
 * clinic context via `get_user_clinic_id()`, so the header is only
 * strictly necessary for anonymous access.
 */
export function createTenantClient(clinicId: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing Supabase environment variables. " +
      "Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set at build time.",
    );
  }
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { "x-clinic-id": clinicId } },
  });
}
