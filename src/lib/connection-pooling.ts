/**
 * Database connection pooling configuration and verification.
 *
 * Supabase provides built-in connection pooling via Supavisor (pgbouncer
 * replacement since 2024). All PostgREST requests through the Supabase
 * JS client automatically use the connection pooler.
 *
 * For this application:
 * - All Supabase JS client calls go through PostgREST, which uses the pooler.
 * - The pooler URL is: https://<project-ref>.supabase.co (same as NEXT_PUBLIC_SUPABASE_URL).
 * - Direct database connections (e.g., for migrations) should use the pooler
 *   port 6543 instead of 5432 for better connection management.
 *
 * Configuration:
 * - Transaction mode (default): Each query gets a connection from the pool,
 *   returned after the transaction completes. Best for serverless (Cloudflare Workers).
 * - Session mode: Connection held for the entire session. Only needed for
 *   features like LISTEN/NOTIFY or prepared statements.
 *
 * Supabase Dashboard Settings:
 *   Project Settings → Database → Connection Pooling
 *   - Mode: Transaction (recommended for serverless)
 *   - Pool Size: Default (15 for free tier, scales with plan)
 *
 * @see https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler
 */

import { logger } from "@/lib/logger";

/** Expected pooling configuration for serverless deployment. */
export const POOLING_CONFIG = {
  mode: "transaction" as const,
  defaultPoolSize: 15,
  maxClientConnections: 200,
  statementTimeout: 30_000,
} as const;

/**
 * Verify that the Supabase URL is using the pooler endpoint.
 *
 * The pooler endpoint for Supabase is always `https://<ref>.supabase.co`,
 * which is what NEXT_PUBLIC_SUPABASE_URL should be set to.
 * Direct connections bypass the pooler and can exhaust database connections
 * on serverless platforms like Cloudflare Workers.
 */
export function verifyPoolerEndpoint(): {
  isPooled: boolean;
  url: string | undefined;
  recommendation: string | null;
} {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    return {
      isPooled: false,
      url: undefined,
      recommendation: "NEXT_PUBLIC_SUPABASE_URL is not set",
    };
  }

  // Supabase JS client always uses PostgREST (pooled). Direct DB URLs
  // (port 5432/6543) are only used by migration tools / pg_dump.
  const isSupabaseHosted = url.includes(".supabase.co");
  const isPooled = isSupabaseHosted;

  if (!isPooled) {
    logger.warn("Supabase URL may not be using connection pooler", {
      context: "connection-pooling",
      url,
    });
  }

  return {
    isPooled,
    url,
    recommendation: isPooled
      ? null
      : "Use the Supabase pooler URL (https://<ref>.supabase.co) for NEXT_PUBLIC_SUPABASE_URL",
  };
}

/**
 * Verify that the direct database URL uses the pooler port.
 *
 * SUPABASE_DB_URL is used for migrations and backups. It should use
 * port 6543 (pooler) instead of 5432 (direct) in production to avoid
 * connection exhaustion during migration runs.
 */
export function verifyDirectDbPooler(): {
  isPooled: boolean;
  recommendation: string | null;
} {
  const dbUrl = process.env.SUPABASE_DB_URL;

  if (!dbUrl) {
    return { isPooled: false, recommendation: null };
  }

  const usesPoolerPort = dbUrl.includes(":6543");
  const usesDirectPort = dbUrl.includes(":5432");

  return {
    isPooled: usesPoolerPort,
    recommendation:
      usesDirectPort && !usesPoolerPort
        ? "Consider using port 6543 (pooler) instead of 5432 (direct) for SUPABASE_DB_URL in production"
        : null,
  };
}
