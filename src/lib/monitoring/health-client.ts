"use client";

/**
 * Client-side health probe shared by the super-admin System Status and
 * Uptime SLA pages. Both pages call {@link fetchCoreHealth} so they always
 * compute Web App / Database / Auth status from the exact same source and
 * the same rules (see {@link deriveHealthStatus}).
 */

import {
  deriveHealthStatus,
  type HealthApiData,
  type HealthFetchOutcome,
  type ServiceStatus,
} from "@/lib/monitoring/services";
import { createClient } from "@/lib/supabase-client";

export interface CoreHealthSnapshot {
  webApp: ServiceStatus;
  database: ServiceStatus;
  auth: ServiceStatus;
  version: string;
  nodeVersion: string | null;
  nextVersion: string | null;
  /** Round-trip time of the /api/admin/health call, in ms (null on failure). */
  responseTimeMs: number | null;
  checkedAt: Date;
  /**
   * I1 fix: true when the health API responded with GEO_RESTRICTED (403).
   * The platform itself is healthy; the admin is connecting from a location
   * outside the allowed geography (e.g. travelling or on a VPN). The UI
   * should show a specific "access restricted from your location" banner
   * rather than a generic API-error or false "all operational" state.
   */
  geoBlocked: boolean;
}

/**
 * Try to read the error code from a non-ok Response body without consuming
 * it (uses clone so the original can still be read if needed).
 *
 * Returns `"GEO_RESTRICTED"` when the response matches the Cloudflare
 * geo-block JSON `{ code: "GEO_RESTRICTED" }`, null otherwise.
 */
async function readErrorCode(res: Response): Promise<string | null> {
  try {
    const json = (await res.clone().json()) as { code?: string };
    return typeof json.code === "string" ? json.code : null;
  } catch {
    return null;
  }
}

/**
 * Probe platform health once and return a normalised snapshot.
 *
 * Never throws: any failure is mapped onto a {@link ServiceStatus}.
 */
export async function fetchCoreHealth(): Promise<CoreHealthSnapshot> {
  const checkedAt = new Date();
  const start = performance.now();

  let outcome: HealthFetchOutcome = { kind: "network-error" };
  let responseTimeMs: number | null = null;
  let geoBlocked = false;

  try {
    const res = await fetch("/api/admin/health", { credentials: "include" });
    responseTimeMs = Math.round(performance.now() - start);

    if (res.ok) {
      const json = (await res.json()) as { ok?: boolean; data?: HealthApiData };
      outcome = json?.ok && json.data ? { kind: "ok", data: json.data } : { kind: "bad-json" };
    } else {
      // I1: Distinguish geo-block from other server errors so the UI can
      // render a specific "access restricted from your location" message
      // instead of a generic API failure or false "all operational" state.
      const errorCode = await readErrorCode(res);
      if (errorCode === "GEO_RESTRICTED") {
        outcome = { kind: "geo-blocked" };
        geoBlocked = true;
      } else {
        outcome = { kind: "http-error" };
      }
    }
  } catch {
    outcome = { kind: "network-error" };
    responseTimeMs = null;
  }

  const derived = deriveHealthStatus(outcome);

  // Auth is probed independently of the database/web-app health check so an
  // auth outage is reported even when the rest of the platform is healthy.
  let auth: ServiceStatus = "operational";
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.getUser();
    auth = error ? "degraded" : "operational";
  } catch {
    auth = "down";
  }

  return {
    webApp: derived.webApp,
    database: derived.database,
    auth,
    version: derived.version,
    nodeVersion: derived.nodeVersion,
    nextVersion: derived.nextVersion,
    responseTimeMs,
    checkedAt,
    geoBlocked,
  };
}
