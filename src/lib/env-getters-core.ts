/**
 * Core platform env getters (P11 split from `src/lib/env.ts`).
 *
 * Supabase URL/keys, root domain, site URL, and platform secrets
 * (CRON_SECRET, BOOKING_TOKEN_SECRET, PROFILE_HEADER_HMAC_KEY, PHI/backup
 * encryption keys, pooler URL). Each getter is the authoritative read point
 * for its variable — consumers import via the `@/lib/env` barrel, never
 * `process.env` directly. See `.semgrep/env-access.yml`.
 */

/**
 * Supabase public URL (HTTPS PostgREST origin). Returns "" when unset so
 * callers can guard with `if (url)`; `validateEnv()` enforces presence in
 * production at startup. This is a non-throwing accessor by design.
 */
export function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

/** Supabase anon key. */
export function getSupabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

/** Supabase service-role key — server only. */
export function getSupabaseServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/** CRON_SECRET — used by cron-auth middleware. */
export function getCronSecret(): string {
  return process.env.CRON_SECRET ?? "";
}

/** Timestamp of last CRON_SECRET rotation (ISO 8601). */
export function getCronSecretRotatedAt(): string | undefined {
  return process.env.CRON_SECRET_ROTATED_AT;
}

/** PHI encryption key (AES-256-GCM base64). */
export function getPhiEncryptionKey(): string | undefined {
  return process.env.PHI_ENCRYPTION_KEY;
}

/** PHI encryption key rotation — old key for decrypt-and-re-encrypt migration. */
export function getPhiEncryptionKeyOld(): string | undefined {
  return process.env.PHI_ENCRYPTION_KEY_OLD;
}

/** Backup encryption key (AES-256-GCM). */
export function getBackupEncryptionKey(): string | undefined {
  return process.env.BACKUP_ENCRYPTION_KEY;
}

/** Booking token HMAC secret. */
export function getBookingTokenSecret(): string | undefined {
  return process.env.BOOKING_TOKEN_SECRET;
}

/** Root domain (e.g. oltigo.com). */
export function getRootDomain(): string {
  return process.env.ROOT_DOMAIN ?? "";
}

/** Public site URL (e.g. https://oltigo.com). */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "";
}

/**
 * Public URL for the landing-page "Demo" CTA. `NEXT_PUBLIC_*` so the value is
 * inlined into the client bundle at build time. Falls back to the production
 * demo host when unset.
 */
export function getDemoUrl(): string {
  return process.env.NEXT_PUBLIC_DEMO_URL || "https://demo.oltigo.com";
}

/** Rate-limit backend selection. */
export function getRateLimitBackend(): string {
  return process.env.RATE_LIMIT_BACKEND ?? "kv";
}

/** Profile-header HMAC key. */
export function getProfileHeaderHmacKey(): string | undefined {
  return process.env.PROFILE_HEADER_HMAC_KEY;
}

/**
 * Supabase connection-pooler URL (PgBouncer/Supavisor on port 6543).
 * Set as a Cloudflare Workers secret. Falls back to the direct URL
 * when unset (local dev, CI without pooler).
 * Consumed by `src/lib/supabase-server.ts`.
 */
export function getSupabasePoolerUrl(): string | undefined {
  const value = process.env.SUPABASE_POOLER_URL?.trim();
  return value ? value : undefined;
}
