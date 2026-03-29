/**
 * Connection Pool Monitoring & Configuration
 *
 * Supabase uses PgBouncer for connection pooling by default.
 * This module provides utilities to monitor pool health and
 * document connection limits per pricing tier.
 *
 * Connection string formats:
 * - Direct:  postgresql://[user]:[password]@db.[ref].supabase.co:5432/postgres
 * - Pooled:  postgresql://[user]:[password]@db.[ref].supabase.co:6543/postgres
 *
 * Port 6543 = PgBouncer (transaction mode pooling)
 * Port 5432 = Direct connection (for migrations, subscriptions)
 */

import { createClient } from "@supabase/supabase-js";

// ── Connection Limits by Supabase Tier ──
export const CONNECTION_LIMITS = {
  free: {
    tier: "Free",
    directConnections: 60,
    poolerConnections: 200,
    maxConcurrentUsers: 500,
    note: "Shared infrastructure. Suitable for development and small clinics.",
  },
  pro: {
    tier: "Pro",
    directConnections: 60,
    poolerConnections: 200,
    maxConcurrentUsers: 5000,
    note: "Dedicated pooler. Recommended for production clinics.",
  },
  team: {
    tier: "Team",
    directConnections: 120,
    poolerConnections: 400,
    maxConcurrentUsers: 10000,
    note: "Higher limits for multi-clinic deployments.",
  },
  enterprise: {
    tier: "Enterprise",
    directConnections: "Custom",
    poolerConnections: "Custom",
    maxConcurrentUsers: "Unlimited",
    note: "Custom limits based on deployment. Contact Supabase.",
  },
} as const;

// ── Multi-tenant Connection Recommendations ──
export const POOL_RECOMMENDATIONS = {
  poolMode: "transaction",
  statementTimeout: "30s",
  idleTimeout: "60s",
  maxClientConnections: 200,
  defaultPoolSize: 15,
  reservePoolSize: 5,
  guidelines: [
    "Use pooled connection string (port 6543) for all application queries",
    "Use direct connection (port 5432) only for migrations and realtime subscriptions",
    "Enable statement_timeout to prevent long-running queries from exhausting pool",
    "Monitor active connections via pg_stat_activity",
    "Set application_name per tenant for easier debugging",
    "Use RLS instead of separate database users per tenant",
  ],
} as const;

/**
 * Query current connection pool statistics from pg_stat_activity.
 * Requires a Supabase client with appropriate permissions.
 */
export async function getConnectionStats(supabaseUrl: string, supabaseKey: string) {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Query pg_stat_activity for connection info
  const { data, error } = await supabase.rpc("get_connection_stats").maybeSingle();

  if (error) {
    // Fallback: return static info if RPC not available
    return {
      available: false,
      message: "Connection stats RPC not configured. See migration 00048 to enable.",
      recommendations: POOL_RECOMMENDATIONS,
      limits: CONNECTION_LIMITS,
    };
  }

  return {
    available: true,
    stats: data,
    recommendations: POOL_RECOMMENDATIONS,
    limits: CONNECTION_LIMITS,
  };
}

/**
 * Check if the application is using the pooled connection string.
 * Returns true if using port 6543 (PgBouncer).
 */
export function isUsingPooledConnection(): boolean {
  const dbUrl = process.env.DATABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return dbUrl.includes(":6543");
}

/**
 * Get connection pool health summary for monitoring dashboards.
 */
export function getPoolHealthSummary() {
  const isPooled = isUsingPooledConnection();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const hasSupabase = supabaseUrl.includes("supabase");

  return {
    provider: hasSupabase ? "Supabase (PgBouncer)" : "Unknown",
    poolingEnabled: isPooled || hasSupabase,
    connectionMode: isPooled ? "pooled (port 6543)" : "direct or Supabase default",
    poolMode: "transaction",
    recommendations: isPooled
      ? ["Connection pooling is properly configured via PgBouncer"]
      : [
          "Consider using the pooled connection string (port 6543) for better multi-tenant performance",
          "The Supabase JavaScript client uses HTTP by default, which doesn't consume persistent connections",
          "Direct PostgreSQL connections should only be used for migrations",
        ],
  };
}
