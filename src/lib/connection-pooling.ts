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

import { getSupabasePoolerUrl } from "@/lib/env";
import { logger } from "@/lib/logger";

/** Expected pooling configuration for serverless deployment. */
export const POOLING_CONFIG = {
  mode: "transaction" as const,
  defaultPoolSize: 15,
  maxClientConnections: 200,
  statementTimeout: 30_000,
} as const;

/**
 * Verify that the server runtime is configured to prefer pooled Supabase access.
 *
 * For browser/PostgREST calls, `NEXT_PUBLIC_SUPABASE_URL` should be the hosted
 * Supabase HTTPS origin. For server-side code in Workers, `SUPABASE_POOLER_URL`
 * is preferred when present so bursts do not fall back to direct database
 * connections accidentally.
 */
export function verifyPoolerEndpoint(): {
  isPooled: boolean;
  url: string | undefined;
  recommendation: string | null;
} {
  const poolerUrl = getSupabasePoolerUrl();
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined;

  if (poolerUrl) {
    const isPooler = poolerUrl.includes(".pooler.supabase.com") || poolerUrl.includes(":6543");

    if (!isPooler) {
      logger.warn("SUPABASE_POOLER_URL does not look like a pooler endpoint", {
        context: "connection-pooling",
        url: poolerUrl,
      });
    }

    return {
      isPooled: isPooler,
      url: poolerUrl,
      recommendation: isPooler
        ? null
        : "Set SUPABASE_POOLER_URL to the Supabase pooler endpoint on port 6543",
    };
  }

  if (!publicUrl) {
    return {
      isPooled: false,
      url: undefined,
      recommendation: "Neither SUPABASE_POOLER_URL nor NEXT_PUBLIC_SUPABASE_URL is set",
    };
  }

  const isSupabaseHosted = publicUrl.includes(".supabase.co");

  if (!isSupabaseHosted) {
    logger.warn("NEXT_PUBLIC_SUPABASE_URL may not be using hosted Supabase", {
      context: "connection-pooling",
      url: publicUrl,
    });
  }

  return {
    isPooled: isSupabaseHosted,
    url: publicUrl,
    recommendation: isSupabaseHosted
      ? "SUPABASE_POOLER_URL is not set; server code will fall back to the public Supabase URL"
      : "Use hosted Supabase for NEXT_PUBLIC_SUPABASE_URL and set SUPABASE_POOLER_URL for server-side pooling",
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
