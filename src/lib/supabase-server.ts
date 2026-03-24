import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";
import { setTenantContext } from "@/lib/tenant-context";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Create a Supabase server client with cookie-based auth.
 * Use this for requests where tenant context will be set separately
 * (e.g. middleware, auth flows).
 *
 * NOTE: `cookies` is loaded via dynamic import to avoid pulling
 * `next/headers` into Client Components, Edge Middleware, and other
 * contexts where it is not available (Next.js 16 / Turbopack).
 */
export async function createClient() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  return createServerClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    },
  );
}

/**
 * Create a Supabase server client with tenant context set.
 *
 * Sets `app.current_clinic_id` as a PostgreSQL session variable so that
 * RLS policies can use it as an additional isolation check. This is the
 * preferred way to create a client for tenant-scoped operations.
 *
 * @param clinicId - The clinic UUID to scope all operations to
 * @throws Error if clinicId is missing/invalid or if setting context fails
 */
export async function createTenantClient(clinicId: string) {
  const client = await createClient();
  await setTenantContext(client, clinicId);
  return client;
}
