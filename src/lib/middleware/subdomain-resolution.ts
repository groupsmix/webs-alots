/**
 * §3.5 — Subdomain → clinic resolution with in-memory cache.
 *
 * Extracted from middleware.ts to keep the orchestrator under ~300 lines.
 */
import { createServerClient } from "@supabase/ssr";
import {
  subdomainCache,
  SUBDOMAIN_CACHE_TTL_MS,
  setSubdomainCache,
  negativeSubdomainCache,
  NEGATIVE_CACHE_TTL_MS,
  setNegativeSubdomainCache,
} from "@/lib/subdomain-cache";

export interface CachedClinic {
  id: string;
  name: string;
  subdomain: string;
  type: string;
  tier: string;
  patient_message_locale?: string;
  cachedAt: number;
}

/**
 * Resolve a subdomain to a clinic record, using an in-memory cache
 * with TTL and negative-cache to avoid redundant Supabase queries.
 *
 * Returns `undefined` if the subdomain is unknown or invalid.
 */
export async function resolveSubdomainClinic(
  subdomain: string,
  supabaseUrl: string,
  supabaseAnonKey: string,
): Promise<CachedClinic | undefined> {
  const cached = subdomainCache.get(subdomain);
  const negativeCached = negativeSubdomainCache.get(subdomain);

  if (cached && Date.now() - cached.cachedAt < SUBDOMAIN_CACHE_TTL_MS) {
    return cached;
  }

  if (negativeCached && Date.now() - negativeCached.cachedAt < NEGATIVE_CACHE_TTL_MS) {
    return undefined;
  }

  // Use a separate anon-only Supabase client (no user session cookies)
  // for subdomain resolution. The RLS policy on `clinics` allows
  // unauthenticated reads (auth.uid() IS NULL) for active clinics,
  // but blocks authenticated users whose clinic_id doesn't match.
  const anonSupabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        /* no-op */
      },
    },
  });

  // S-07 (migration 00068): anon callers read from the narrower
  // `public_clinic_directory` view instead of `clinics` directly.
  const { data } = await anonSupabase
    .from("public_clinic_directory")
    .select("id, name, type, tier, subdomain, patient_message_locale")
    .eq("subdomain", subdomain)
    .single();

  if (data) {
    const clinic: CachedClinic = {
      ...data,
      subdomain: data.subdomain ?? subdomain,
      cachedAt: Date.now(),
    };
    setSubdomainCache(subdomain, clinic);
    return clinic;
  }

  // Evict stale entry if the subdomain was previously valid
  subdomainCache.delete(subdomain);
  setNegativeSubdomainCache(subdomain);
  return undefined;
}
