/**
 * GET /api/admin/health
 *
 * System health check endpoint for the super-admin dashboard.
 * Checks database connectivity and returns app version.
 *
 * Requires super_admin role.
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { withAuth, type AuthContext } from "@/lib/with-auth";

async function handler(_request: NextRequest, auth: AuthContext) {
  const timestamp = new Date().toISOString();

  let databaseStatus = "disconnected";
  try {
    const { error } = await auth.supabase.rpc("version" as never);

    if (error) {
      // Super-admin health-check: intentionally queries across all tenants to verify
      // database connectivity. No patient data is returned (head:true, count only).
      // Access is restricted to super_admin role via withAuth.
      const { error: fallbackError } = await auth.supabase
        .from("users") // nosemgrep: semgrep.tenant-scoping
        .select("id", { count: "exact", head: true });
      databaseStatus = fallbackError ? "disconnected" : "connected";
    } else {
      databaseStatus = "connected";
    }
  } catch (err) {
    logger.error("Health check database probe failed", {
      context: "api/admin/health",
      error: err,
    });
    databaseStatus = "disconnected";
  }

  let version = "0.1.0";
  try {
    const pkg = await import("../../../../../package.json");
    version = (pkg as { version?: string }).version ?? "0.1.0";
  } catch {
    logger.warn("Could not read package.json version", {
      context: "api/admin/health",
    });
  }

  let nextVersion: string | null = null;
  try {
    const nextPkg = await import("next/package.json");
    nextVersion = (nextPkg as { version?: string }).version ?? null;
  } catch {
    logger.warn("Could not read Next.js package version", {
      context: "api/admin/health",
    });
  }

  if (databaseStatus === "disconnected") {
    return apiError("Database unreachable", 503, "DB_UNREACHABLE");
  }

  return apiSuccess({
    status: "ok",
    database: databaseStatus,
    version,
    // Surface the server runtime version so the System Status "Platform Info"
    // panel can populate "Node.js Version" — a client component cannot read
    // process.version reliably. Null on runtimes that do not expose it.
    nodeVersion: typeof process !== "undefined" ? (process.version ?? null) : null,
    // Surface the Next.js version from the installed package.
    nextVersion,
    timestamp,
  });
}

export const GET = withAuth(handler, ["super_admin"]);
