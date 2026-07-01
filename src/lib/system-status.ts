import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { isR2Configured } from "@/lib/r2";
import { createUntypedAdminClient } from "@/lib/supabase-server";

type PublicServiceStatus = "operational" | "degraded" | "down";

interface PublicStatusService {
  name: string;
  status: PublicServiceStatus;
  detail?: string;
  latencyMs?: number;
}

interface PublicStatusIncident {
  id: string;
  monitorName: string;
  eventType: "down" | "up" | "degraded";
  message: string | null;
  responseTimeMs: number | null;
  occurredAt: string;
}

export interface PublicStatusSnapshot {
  status: PublicServiceStatus;
  fetchedAt: string;
  services: PublicStatusService[];
  incidents: PublicStatusIncident[];
  uptime: Array<{
    monitorName: string;
    month: string;
    uptimePct: number | null;
    downtimeEvents: number;
  }>;
}

export interface SlaReportSnapshot {
  month: string;
  rows: Array<{
    monitorName: string;
    month: string;
    uptimePct: number | null;
    downtimeEvents: number;
    recoveryEvents: number;
  }>;
  incidents: PublicStatusIncident[];
  generatedAt: string;
}

async function probeDatabase(): Promise<PublicStatusService> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      name: "Database",
      status: "degraded",
      detail: "Supabase credentials not configured",
    };
  }

  const start = Date.now();
  const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);
  const { error } = await supabase.from("clinics").select("id").limit(1);
  const latencyMs = Date.now() - start;

  return error
    ? {
        name: "Database",
        status: "degraded",
        detail: "Database query failed",
        latencyMs,
      }
    : {
        name: "Database",
        status: "operational",
        latencyMs,
      };
}

function buildSyntheticServices(database: PublicStatusService): PublicStatusService[] {
  const rateLimitBackend = process.env.RATE_LIMIT_BACKEND || "auto";
  const hasKV = rateLimitBackend === "kv";
  const hasSupabase = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  return [
    database,
    {
      name: "Storage",
      status: isR2Configured() ? "operational" : "degraded",
      detail: isR2Configured() ? undefined : "R2 storage not configured",
    },
    {
      name: "Rate Limiter",
      status: hasKV || hasSupabase ? "operational" : "degraded",
      detail:
        hasKV || hasSupabase ? undefined : "Using in-memory fallback across isolates is not shared",
    },
  ];
}

export async function getPublicStatusSnapshot(): Promise<PublicStatusSnapshot> {
  const admin = createUntypedAdminClient("super_admin");

  const [database, uptimeRowsResult, incidentRowsResult] = await Promise.all([
    probeDatabase(),
    admin.from("uptime_sla_monthly").select("monitor_name, month, uptime_pct, downtime_events"),
    admin
      .from("uptime_events")
      .select("id, monitor_name, event_type, message, response_time_ms, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(10),
  ]);

  const services = buildSyntheticServices(database);
  const incidents = ((incidentRowsResult.data ?? []) as Array<Record<string, unknown>>).map(
    (row) => ({
      id: String(row.id),
      monitorName: String(row.monitor_name ?? "unknown"),
      eventType: (row.event_type as "down" | "up" | "degraded") ?? "degraded",
      message: typeof row.message === "string" ? row.message : null,
      responseTimeMs: typeof row.response_time_ms === "number" ? row.response_time_ms : null,
      occurredAt: typeof row.occurred_at === "string" ? row.occurred_at : new Date().toISOString(),
    }),
  );

  const uptime = ((uptimeRowsResult.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    monitorName: String(row.monitor_name ?? "unknown"),
    month: String(row.month ?? ""),
    uptimePct: typeof row.uptime_pct === "number" ? row.uptime_pct : null,
    downtimeEvents: typeof row.downtime_events === "number" ? row.downtime_events : 0,
  }));

  const overallStatus = services.some((service) => service.status === "down")
    ? "down"
    : services.some((service) => service.status === "degraded")
      ? "degraded"
      : "operational";

  return {
    status: overallStatus,
    fetchedAt: new Date().toISOString(),
    services,
    incidents,
    uptime,
  };
}

export async function getSlaReportSnapshot(month: string): Promise<SlaReportSnapshot> {
  const admin = createUntypedAdminClient("super_admin");
  const monthStart = `${month}-01`;
  const nextMonthStart = new Date(`${month}-01T00:00:00.000Z`);
  nextMonthStart.setUTCMonth(nextMonthStart.getUTCMonth() + 1);

  const [rowsResult, incidentsResult] = await Promise.all([
    admin
      .from("uptime_sla_monthly")
      .select("monitor_name, month, uptime_pct, downtime_events, recovery_events")
      .eq("month", monthStart)
      .order("monitor_name", { ascending: true }),
    admin
      .from("uptime_events")
      .select("id, monitor_name, event_type, message, response_time_ms, occurred_at")
      .gte("occurred_at", `${month}-01T00:00:00.000Z`)
      .lt("occurred_at", nextMonthStart.toISOString())
      .order("occurred_at", { ascending: false })
      .limit(100),
  ]);

  const rows = ((rowsResult.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    monitorName: String(row.monitor_name ?? "unknown"),
    month: String(row.month ?? monthStart),
    uptimePct: typeof row.uptime_pct === "number" ? row.uptime_pct : null,
    downtimeEvents: typeof row.downtime_events === "number" ? row.downtime_events : 0,
    recoveryEvents: typeof row.recovery_events === "number" ? row.recovery_events : 0,
  }));

  const incidents = ((incidentsResult.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    monitorName: String(row.monitor_name ?? "unknown"),
    eventType: (row.event_type as "down" | "up" | "degraded") ?? "degraded",
    message: typeof row.message === "string" ? row.message : null,
    responseTimeMs: typeof row.response_time_ms === "number" ? row.response_time_ms : null,
    occurredAt: typeof row.occurred_at === "string" ? row.occurred_at : new Date().toISOString(),
  }));

  return {
    month,
    rows,
    incidents,
    generatedAt: new Date().toISOString(),
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildSlaReportHtml(report: SlaReportSnapshot): string {
  const rowsHtml = report.rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.monitorName)}</td>
          <td>${escapeHtml(report.month)}</td>
          <td>${row.uptimePct == null ? "—" : `${row.uptimePct}%`}</td>
          <td>${row.downtimeEvents}</td>
          <td>${row.recoveryEvents}</td>
        </tr>`,
    )
    .join("");

  const incidentsHtml = report.incidents
    .slice(0, 20)
    .map(
      (incident) => `
        <tr>
          <td>${escapeHtml(incident.monitorName)}</td>
          <td>${escapeHtml(incident.eventType)}</td>
          <td>${escapeHtml(new Date(incident.occurredAt).toLocaleString("fr-MA"))}</td>
          <td>${escapeHtml(incident.message ?? "—")}</td>
        </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>SLA Report ${escapeHtml(report.month)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 32px; color: #0f172a; }
      h1, h2 { margin-bottom: 8px; }
      p { color: #475569; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 24px; }
      th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 14px; }
      th { background: #f8fafc; }
      .muted { color: #64748b; font-size: 12px; }
    </style>
  </head>
  <body>
    <h1>SLA Report — ${escapeHtml(report.month)}</h1>
    <p>Generated at ${escapeHtml(new Date(report.generatedAt).toLocaleString("fr-MA"))}</p>

    <h2>Monthly uptime</h2>
    <table>
      <thead>
        <tr>
          <th>Service</th>
          <th>Month</th>
          <th>Uptime</th>
          <th>Downtime events</th>
          <th>Recovery events</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="5">No SLA rows found for this month.</td></tr>'}
      </tbody>
    </table>

    <h2>Recent incidents</h2>
    <table>
      <thead>
        <tr>
          <th>Service</th>
          <th>Event</th>
          <th>Occurred at</th>
          <th>Message</th>
        </tr>
      </thead>
      <tbody>
        ${incidentsHtml || '<tr><td colspan="4">No incidents recorded for this month.</td></tr>'}
      </tbody>
    </table>

    <p class="muted">This report is generated from uptime events captured in Oltigo Health.</p>
  </body>
</html>`;
}

export function getLatestReportMonth(uptime: PublicStatusSnapshot["uptime"]): string {
  return uptime[0]?.month?.slice(0, 7) ?? new Date().toISOString().slice(0, 7);
}
