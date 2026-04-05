import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { setTenantContext, isValidClinicId } from "@/lib/tenant-context";
import { logger } from "@/lib/logger";

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
          } catch (err) {
            logger.warn("Cookie setAll called from Server Component", { context: "supabase-server", error: err });
          }
        },
      },
    },
  );
}

/**
 * HIGH-01 FIX: Validate tenant context before returning the client.
 * If the application layer has set x-clinic-id header but the value is
 * invalid (empty, malformed UUID, or NULL), reject the request immediately
 * to prevent RLS bypass attempts.
 */
export async function createTenantClient(clinicId: string) {
  if (!clinicId || !isValidClinicId(clinicId)) {
    logger.error("createTenantClient: invalid or missing clinicId", {
      context: "supabase-server",
      clinicId,
    });
    throw new Error(`createTenantClient: invalid clinicId: ${clinicId}`);
  }

  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  const client = createServerClient<Database>(
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
          } catch (err) {
            logger.warn("Cookie setAll called from Server Component", { context: "supabase-server/tenant", error: err });
          }
        },
      },
      global: {
        headers: { "x-clinic-id": clinicId },
      },
    },
  );

  // Best-effort: also set the session variable for same-transaction queries.
  // This is redundant with the header approach but provides defense-in-depth
  // for any SECURITY DEFINER functions that read app.current_clinic_id.
  try {
    await setTenantContext(client, clinicId);
  } catch (err) {
    logger.warn("setTenantContext RPC failed (header fallback active)", {
      context: "supabase-server",
      clinicId,
      error: err,
    });
  }

  return client;
}

/**
 * Create a Supabase admin client using the service role key.
 *
 * This client bypasses RLS and can perform admin operations such as
 * creating auth users via `supabase.auth.admin.createUser()`.
 *
 * Only use this for privileged server-side operations (e.g. super-admin
 * onboarding staff accounts). Never expose this client to the browser.
 *
 * @throws Error if SUPABASE_SERVICE_ROLE_KEY is not configured
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
