"use client";

/**
 * Core infrastructure for client-side Supabase data fetching.
 *
 * This module contains shared helpers (fetchRows, ensureLookups, caches)
 * used by all domain-specific data modules.
 */

import { createClient, createTenantClient } from "@/lib/supabase-client";
import { logger } from "@/lib/logger";
import type { Database } from "@/lib/types/database";

/**
 * Booking configuration that callers must provide from the tenant's DB
 * config instead of relying on static clinicConfig values.
 * Use getClinicConfig() on the server, or pass these values from a
 * server component / API response to the client.
 */
export interface ClientBookingConfig {
  slotDuration: number;
  bufferTime: number;
  maxPerSlot: number;
}

export type TableName = keyof Database["public"]["Tables"];

// ── re-export the browser client for direct use ──
export { createClient };

// ── current user helpers ──

export interface ClinicUser {
  id: string;
  auth_id: string;
  clinic_id: string | null;
  role: string;
  name: string;
  phone: string | null;
  email: string | null;
}

let _cachedUser: ClinicUser | null | undefined;
let _cachedUserAt = 0;

/** Cache TTL in milliseconds (5 minutes). */
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getCurrentUser(): Promise<ClinicUser | null> {
  if (_cachedUser !== undefined && Date.now() - _cachedUserAt < CACHE_TTL_MS) return _cachedUser;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    _cachedUser = null;
    return null;
  }
  const { data } = await supabase
    .from("users")
    .select("id, auth_id, clinic_id, role, name, phone, email")
    .eq("auth_id", user.id)
    .single();
  _cachedUser = (data as ClinicUser) ?? null;
  _cachedUserAt = Date.now();
  return _cachedUser;
}

export function clearUserCache() {
  _cachedUser = undefined;
  _cachedUserAt = 0;
}

// ── Generic fetch helper ──

export async function fetchRows<T>(
  table: TableName,
  opts?: {
    select?: string;
    eq?: [string, unknown][];
    order?: [string, { ascending: boolean }];
    limit?: number;
    gte?: [string, unknown];
    lte?: [string, unknown];
    inFilter?: [string, unknown[]];
    /** When set, the x-clinic-id header is sent so anonymous RLS policies can resolve the tenant. */
    tenantClinicId?: string;
  },
): Promise<T[]> {
  const supabase = opts?.tenantClinicId
    ? createTenantClient(opts.tenantClinicId)
    : createClient();
  let q = supabase.from(table).select(opts?.select ?? "*");
  if (opts?.eq) {
    for (const [col, val] of opts.eq) {
      q = q.eq(col, val as string);
    }
  }
  if (opts?.inFilter) {
    q = q.in(opts.inFilter[0], opts.inFilter[1] as string[]);
  }
  if (opts?.gte) q = q.gte(opts.gte[0] as string, opts.gte[1]);
  if (opts?.lte) q = q.lte(opts.lte[0] as string, opts.lte[1]);
  if (opts?.order) q = q.order(opts.order[0], opts.order[1]);
  // Apply an upper-bound limit to prevent unbounded result sets.
  // Callers can override with a smaller value via opts.limit.
  q = q.limit(opts?.limit ?? 1000);
  const { data, error } = await q;
  if (error) {
    logger.error("Query failed", { context: "data/client", table, error });
    return [];
  }
  return (data ?? []) as T[];
}

// ── Lookup caches (shared across domain modules) ──

// lookup maps keyed by clinicId to prevent cross-tenant stale data
interface LookupCache {
  userMap: Map<string, { name: string; phone: string; email: string }>;
  serviceMap: Map<string, { name: string; price: number }>;
  builtAt: number;
}
let _lookupCache: Map<string, LookupCache> = new Map();

/** Expose the current user map for internal mappers (read-only). */
export let _activeUserMap: Map<string, { name: string; phone: string; email: string }> | null = null;
export let _activeServiceMap: Map<string, { name: string; price: number }> | null = null;

export async function ensureLookups(clinicId: string): Promise<void> {
  const existing = _lookupCache.get(clinicId);
  if (existing && Date.now() - existing.builtAt < CACHE_TTL_MS) {
    _activeUserMap = existing.userMap;
    _activeServiceMap = existing.serviceMap;
    return;
  }
  const supabase = createClient();
  const [usersRes, servicesRes] = await Promise.all([
    supabase.from("users").select("id, name, phone, email").eq("clinic_id", clinicId),
    supabase.from("services").select("id, name, price").eq("clinic_id", clinicId),
  ]);
  const userMap = new Map(
    ((usersRes.data ?? []) as { id: string; name: string; phone: string; email: string }[]).map((u) => [
      u.id,
      { name: u.name, phone: u.phone ?? "", email: u.email ?? "" },
    ]),
  );
  const serviceMap = new Map(
    ((servicesRes.data ?? []) as { id: string; name: string; price: number }[]).map((s) => [
      s.id,
      { name: s.name, price: s.price },
    ]),
  );
  _lookupCache.set(clinicId, { userMap, serviceMap, builtAt: Date.now() });
  _activeUserMap = userMap;
  _activeServiceMap = serviceMap;
}

export function clearLookupCache() {
  _lookupCache = new Map();
  _activeUserMap = null;
  _activeServiceMap = null;
}

// ── Mutation result type ──

/**
 * Discriminated union for mutation outcomes.
 *
 * On success the result carries `data` of type `T` (defaults to `void` for
 * mutations that don't return a payload).  On failure it carries a structured
 * `error` object.  Using a discriminated union (`success: true` vs
 * `success: false`) lets callers narrow the type with a simple `if` check:
 *
 * ```ts
 * const res = await createPayment({ ... });
 * if (res.success) {
 *   console.log(res.data.id); // TS knows `data` exists
 * } else {
 *   console.error(res.error.message); // TS knows `error` exists
 * }
 * ```
 */
export type MutationResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };
