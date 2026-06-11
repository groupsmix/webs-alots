/**
 * GET /api/admin/ai-traces
 *
 * Returns AI trace data for the admin dashboard.
 * Supports query params: feature, provider, status, days (default 7).
 *
 * AUDIT P0-5: Previously this route only called requireTenant() (resolved
 * from the subdomain) and then queried with a service-role client — no user
 * session or role check at all. It is now wrapped in withAuth and restricted
 * to clinic_admin / super_admin, scoped to the caller's own clinic.
 */

import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import { requireTenant } from "@/lib/tenant";
import { withAuth, type AuthContext } from "@/lib/with-auth";

interface TraceRow {
  id: string;
  clinic_id: string | null;
  feature: string;
  provider: string;
  model: string;
  fallback_chain: Array<{ provider: string; error?: string }>;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  ttft_ms: number | null;
  status: string;
  error_code: string | null;
  cost_cents: number;
  created_at: string;
}

async function handler(request: NextRequest, auth: AuthContext) {
  // Clinic admins are scoped to their own clinic; super admins fall back to
  // the tenant resolved from the subdomain they are inspecting.
  let clinicId = auth.profile.clinic_id;
  if (!clinicId) {
    const tenant = await requireTenant();
    if (!tenant) {
      return apiError("Unauthorized", 401);
    }
    clinicId = tenant.clinicId;
  }

  const url = new URL(request.url);
  const feature = url.searchParams.get("feature");
  const provider = url.searchParams.get("provider");
  const status = url.searchParams.get("status");
  const days = Math.min(parseInt(url.searchParams.get("days") ?? "7", 10), 90);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const supabase = createUntypedAdminClient("ai-tracing");

  // Build query with clinic scope
  let query = supabase
    .from("ai_traces")
    .select("*")
    .eq("clinic_id", clinicId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);

  if (feature) query = query.eq("feature", feature);
  if (provider) query = query.eq("provider", provider);
  if (status) query = query.eq("status", status);

  const { data: rawTraces, error: tracesError } = await query;

  if (tracesError) {
    return apiError("Failed to fetch traces", 500);
  }

  const traces = (rawTraces ?? []) as TraceRow[];

  // Compute aggregations for charts
  const dailyCostByFeature: Record<string, Record<string, number>> = {};
  const fallbackRateByProvider: Record<string, { total: number; fallbacks: number }> = {};
  const latencies: number[] = [];

  for (const trace of traces) {
    const day = trace.created_at.slice(0, 10);
    const feat = trace.feature;
    if (!dailyCostByFeature[day]) dailyCostByFeature[day] = {};
    dailyCostByFeature[day][feat] =
      (dailyCostByFeature[day][feat] ?? 0) + Number(trace.cost_cents ?? 0);

    const prov = trace.provider;
    if (!fallbackRateByProvider[prov]) fallbackRateByProvider[prov] = { total: 0, fallbacks: 0 };
    fallbackRateByProvider[prov].total++;
    if (trace.fallback_chain && trace.fallback_chain.length > 0) {
      fallbackRateByProvider[prov].fallbacks++;
    }

    latencies.push(Number(trace.latency_ms ?? 0));
  }

  // Compute p95 latency
  latencies.sort((a, b) => a - b);
  const p95Index = Math.floor(latencies.length * 0.95);
  const p95Latency = latencies[p95Index] ?? 0;

  return apiSuccess({
    traces,
    aggregations: {
      dailyCostByFeature,
      fallbackRateByProvider,
      p95Latency,
      totalTraces: traces.length,
    },
  });
}

export const GET = withAuth(handler, ["clinic_admin", "super_admin"]);
