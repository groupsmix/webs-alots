/**
 * Shared, framework-agnostic monitoring primitives.
 *
 * This module is the single source of truth for how the super-admin
 * Operations pages (System Status, Uptime SLA, Health Metrics) interpret
 * service health. It exists to fix the QA finding that the System Status
 * and Uptime SLA pages "don't share the same health source" — both pages
 * now derive status through the pure helpers below, so they can no longer
 * drift apart (e.g. one page showing the database "Down" while another
 * shows it "Operational").
 *
 * Keep this file free of client-only APIs (fetch, performance, supabase)
 * so it is safe to import from both server and client components and is
 * trivially unit-testable.
 */

export type ServiceStatus = "operational" | "degraded" | "down";

/**
 * Canonical always-on services that the platform monitors in real time.
 *
 * Used so "Services Tracked" reflects what is actually being monitored even
 * when the historical `uptime_sla_monthly` aggregation table has not been
 * populated yet (the QA report observed "Services Tracked: 0" despite three
 * live services being monitored).
 */
export const MONITORED_SERVICES = [
  { key: "web", name: "Web App (Next.js)" },
  { key: "database", name: "Database (Supabase)" },
  { key: "auth", name: "Auth (Supabase Auth)" },
] as const;

/** Shape returned by `GET /api/admin/health` inside the `data` envelope. */
export interface HealthApiData {
  status: string;
  database: string;
  version: string;
  /** Server runtime version (e.g. "v22.13.0"); null when unavailable. */
  nodeVersion?: string | null;
  /** Next.js framework version (e.g. "16.2.9"); null when unavailable. */
  nextVersion?: string | null;
  timestamp: string;
}

/**
 * Normalised outcome of a call to `GET /api/admin/health`.
 *
 * - `ok`            — HTTP 200 with a well-formed `{ ok: true, data }` body.
 * - `bad-json`      — HTTP 200 but the body was not the expected envelope.
 * - `http-error`    — the server responded but with a non-2xx status. The
 *                     health route returns 503 when the database is
 *                     unreachable, so this path must mark the DB as "down".
 * - `network-error` — the request threw (server unreachable).
 */
export type HealthFetchOutcome =
  | { kind: "ok"; data: HealthApiData }
  | { kind: "bad-json" }
  | { kind: "http-error" }
  | { kind: "network-error" };

export interface DerivedHealth {
  webApp: ServiceStatus;
  database: ServiceStatus;
  version: string;
  nodeVersion: string | null;
  nextVersion: string | null;
}

const DEFAULT_VERSION = "0.1.0";

/**
 * Derive Web App + Database status from a health-check outcome.
 *
 * This is the heart of the "unify monitoring data" fix. Previously the
 * Uptime SLA page only updated the database status on the success path and
 * left it at its initial "operational" value when the health endpoint
 * returned an error — so a 503 (database unreachable) showed the DB as
 * "Operational" on Uptime SLA while System Status correctly showed "Down".
 * Centralising the logic here guarantees both pages agree.
 */
export function deriveHealthStatus(outcome: HealthFetchOutcome): DerivedHealth {
  switch (outcome.kind) {
    case "ok":
      return {
        webApp: "operational",
        database: outcome.data.database === "connected" ? "operational" : "down",
        version: outcome.data.version || DEFAULT_VERSION,
        nodeVersion: outcome.data.nodeVersion ?? null,
        nextVersion: outcome.data.nextVersion ?? null,
      };
    case "bad-json":
    case "http-error":
      // The app server responded but the health probe failed. The most
      // common cause is the database being unreachable (the route returns
      // 503 / DB_UNREACHABLE), so the web app is degraded and the DB is down.
      return {
        webApp: "degraded",
        database: "down",
        version: DEFAULT_VERSION,
        nodeVersion: null,
        nextVersion: null,
      };
    case "network-error":
    default:
      // Could not reach the app at all.
      return {
        webApp: "down",
        database: "down",
        version: DEFAULT_VERSION,
        nodeVersion: null,
        nextVersion: null,
      };
  }
}

/**
 * Roll a set of individual service statuses up into a single overall status,
 * using worst-wins precedence: any "down" => down, else any "degraded" =>
 * degraded, else operational.
 */
export function computeOverallStatus(statuses: ServiceStatus[]): ServiceStatus {
  if (statuses.some((s) => s === "down")) return "down";
  if (statuses.some((s) => s === "degraded")) return "degraded";
  return "operational";
}
