/**
 * SEED-01: Runtime guard against seed user authentication in production.
 *
 * Seed users must be blocked by data, not by hardcoded UUIDs in application
 * code. This module reads the service-role-only `seed_user_blocklist` table so
 * recreated accounts with new auth IDs can still be blocked by email.
 */

import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";

const SEED_GUARD_CACHE_TTL_MS = 5 * 60 * 1000;

const seedGuardCache = new Map<string, { blocked: boolean; expiresAt: number }>();

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function normalizeIdentifier(identifier: string | null | undefined): string | null {
  const value = identifier?.trim();
  if (!value) return null;
  return value.includes("@") ? value.toLowerCase() : value;
}

function cacheKey(identifier: string): string {
  return identifier.includes("@") ? `email:${identifier}` : `auth:${identifier}`;
}

function getCached(identifier: string): boolean | null {
  const hit = seedGuardCache.get(cacheKey(identifier));
  if (!hit) return null;
  if (Date.now() >= hit.expiresAt) {
    seedGuardCache.delete(cacheKey(identifier));
    return null;
  }
  return hit.blocked;
}

function setCached(identifier: string, blocked: boolean) {
  seedGuardCache.set(cacheKey(identifier), {
    blocked,
    expiresAt: Date.now() + SEED_GUARD_CACHE_TTL_MS,
  });
}

type SeedUserCandidate =
  | string
  | {
      id?: string | null;
      authId?: string | null;
      email?: string | null;
    }
  | null
  | undefined;

function normalizeCandidate(candidate: SeedUserCandidate): {
  authId: string | null;
  email: string | null;
} {
  if (!candidate) {
    return { authId: null, email: null };
  }
  if (typeof candidate === "string") {
    const normalized = normalizeIdentifier(candidate);
    return normalized?.includes("@")
      ? { authId: null, email: normalized }
      : { authId: normalized, email: null };
  }
  return {
    authId: normalizeIdentifier(candidate.authId ?? candidate.id),
    email: normalizeIdentifier(candidate.email),
  };
}

export async function isSeedUserBlocked(candidate: SeedUserCandidate): Promise<boolean> {
  const { authId, email } = normalizeCandidate(candidate);
  if (!authId && !email) return false;
  if (!isProduction()) return false;

  const cachedAuth = authId ? getCached(authId) : null;
  if (cachedAuth === true) return true;
  const cachedEmail = email ? getCached(email) : null;
  if (cachedEmail === true) return true;
  if ((authId ? cachedAuth === false : true) && (email ? cachedEmail === false : true)) {
    return false;
  }

  try {
    const admin = createUntypedAdminClient("seed-guard");
    const queryBlocklist = async (column: "auth_id" | "email", value: string): Promise<boolean> => {
      const { data, error } = await admin
        .from("seed_user_blocklist")
        .select("id")
        .limit(1)
        .eq(column, value);

      if (error) {
        logger.warn("Seed user blocklist lookup failed", {
          context: "seed-guard",
          identifier: column === "email" ? value : undefined,
          error: error.message,
        });
        return false;
      }

      return Array.isArray(data) && data.length > 0;
    };

    if (authId && cachedAuth == null) {
      const blocked = await queryBlocklist("auth_id", authId);
      setCached(authId, blocked);
      if (blocked) {
        if (email) setCached(email, true);
        return true;
      }
    }

    if (email && cachedEmail == null) {
      const blocked = await queryBlocklist("email", email);
      setCached(email, blocked);
      if (authId) setCached(authId, blocked);
      return blocked;
    }

    return false;
  } catch (error) {
    logger.warn("Seed user guard fallback triggered", {
      context: "seed-guard",
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function listBlockedSeedEmails(): Promise<string[]> {
  if (!isProduction()) return [];

  try {
    const admin = createUntypedAdminClient("seed-guard");
    const { data, error } = await admin.from("seed_user_blocklist").select("email");

    if (error) {
      logger.warn("Failed to load seed user blocklist emails", {
        context: "seed-guard",
        error: error.message,
      });
      return [];
    }

    return ((data ?? []) as Array<{ email: string | null }>)
      .map((row) => row.email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email));
  } catch (error) {
    logger.warn("Seed user email list lookup failed", {
      context: "seed-guard",
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export function clearSeedGuardCacheForTests() {
  seedGuardCache.clear();
}
