/**
 * §3.5 — Subdomain → clinic resolution with in-memory cache.
 *
 * Extracted from middleware.ts to keep the orchestrator under ~300 lines.
 */

// Type-only import — available in CF Workers environment
type KVNamespace = {
  get<T>(key: string, type: "json"): Promise<T | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

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
  kvNamespace?: KVNamespace,
): Promise<CachedClinic | undefined> {
  const cached = subdomainCache.get(subdomain);
  const negativeCached = negativeSubdomainCache.get(subdomain);

  if (cached && Date.now() - cached.cachedAt < SUBDOMAIN_CACHE_TTL_MS) {
    return cached;
  }

  // KV-01: Check Cloudflare KV before hitting Supabase DB
  if (kvNamespace) {
    try {
      const kvVal = await kvNamespace.get<CachedClinic>(`subdomain:${subdomain}`, "json");
      if (kvVal && Date.now() - kvVal.cachedAt < SUBDOMAIN_CACHE_TTL_MS) {
        setSubdomainCache(subdomain, kvVal); // warm in-memory too
        return kvVal;
      }
    } catch {
      // KV unavailable — fall through to DB
    }
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

    // Write to KV for cross-isolate sharing
    if (kvNamespace) {
      try {
        await kvNamespace.put(`subdomain:${subdomain}`, JSON.stringify(clinic), {
          expirationTtl: 300, // 5 minutes
        });
      } catch {
        // KV write failure is non-fatal
      }
    }

    return clinic;
  }

  // Evict stale entry if the subdomain was previously valid
  subdomainCache.delete(subdomain);
  setNegativeSubdomainCache(subdomain);
  return undefined;
}
