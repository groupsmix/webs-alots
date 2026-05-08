/**
 * Per-Tenant Cost Metering
 *
 * A80-F1: Track AI tokens, WhatsApp sends, and email sends per clinic
 * using Cloudflare KV as a distributed counter store.
 *
 * Without per-tenant metering:
 * - Impossible to attribute costs to specific clinics for billing
 * - Cannot detect token/send abuse by a single tenant
 * - No alerting when a clinic approaches their quota
 *
 * Metric keys (KV):
 *   clinic:{clinicId}:openai_tokens:{YYYY-MM}  → integer (cumulative tokens)
 *   clinic:{clinicId}:wa_sends:{YYYY-MM}        → integer (WhatsApp sends)
 *   clinic:{clinicId}:email_sends:{YYYY-MM}     → integer (email sends)
 *   clinic:{clinicId}:sms_sends:{YYYY-MM}       → integer (SMS sends)
 *
 * Usage:
 *   import { incrementClinicMetric } from "@/lib/cost-metering";
 *   await incrementClinicMetric(kv, clinicId, "openai_tokens", tokensUsed);
 *
 * The `kv` parameter is the Cloudflare KV binding (RATE_LIMIT_KV).
 * In development/test, pass undefined and the function is a no-op.
 */

import { logger } from "./logger";

/** Metric names tracked per clinic per month. */
export type ClinicMetric =
  | "openai_tokens"
  | "wa_sends"
  | "email_sends"
  | "sms_sends"
  | "ai_drug_checks"
  | "ai_prescriptions"
  | "ai_patient_summaries"
  | "patient_file_uploads_mb";

/** KV interface (Cloudflare Workers KV) */
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

/**
 * Build the KV key for a clinic metric.
 * Format: clinic:{clinicId}:{metric}:{YYYY-MM}
 */
function buildMetricKey(clinicId: string, metric: ClinicMetric): string {
  const now = new Date();
  const monthYear = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `clinic:${clinicId}:${metric}:${monthYear}`;
}

/**
 * Atomically increment a clinic metric in KV.
 *
 * KV doesn't support native atomic increment, so we use read-modify-write
 * with a 90-day TTL. In rare concurrent cases, the count may be slightly
 * under-counted (last writer wins), but this is acceptable for cost estimation.
 * For exact billing, use the Supabase ai_token_usage table instead.
 *
 * @param kv - Cloudflare KV binding (undefined = no-op in dev)
 * @param clinicId - Clinic UUID
 * @param metric - Which metric to increment
 * @param amount - Amount to add (default: 1)
 */
export async function incrementClinicMetric(
  kv: KVNamespace | undefined,
  clinicId: string,
  metric: ClinicMetric,
  amount = 1,
): Promise<void> {
  if (!kv || amount <= 0) return;

  const key = buildMetricKey(clinicId, metric);

  try {
    const current = await kv.get(key);
    const currentVal = current ? parseInt(current, 10) : 0;
    const newVal = isNaN(currentVal) ? amount : currentVal + amount;

    // 90-day TTL — gives a ~3-month window of metric history in KV
    await kv.put(key, String(newVal), { expirationTtl: 90 * 24 * 60 * 60 });
  } catch (err) {
    // Non-fatal: metering failure must never block the primary operation
    logger.warn("Failed to increment clinic metric", {
      context: "cost-metering",
      clinicId,
      metric,
      amount,
      error: err,
    });
  }
}

/**
 * Get the current value of a clinic metric for the current month.
 *
 * @param kv - Cloudflare KV binding
 * @param clinicId - Clinic UUID
 * @param metric - Which metric to read
 * @returns Current count for this month (0 if not found)
 */
export async function getClinicMetric(
  kv: KVNamespace | undefined,
  clinicId: string,
  metric: ClinicMetric,
): Promise<number> {
  if (!kv) return 0;

  const key = buildMetricKey(clinicId, metric);

  try {
    const value = await kv.get(key);
    if (!value) return 0;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 0 : parsed;
  } catch {
    return 0;
  }
}

/**
 * Get a summary of all tracked metrics for a clinic for the current month.
 * Used by the admin billing dashboard.
 */
export async function getClinicMetricSummary(
  kv: KVNamespace | undefined,
  clinicId: string,
): Promise<Record<ClinicMetric, number>> {
  const metrics: ClinicMetric[] = [
    "openai_tokens",
    "wa_sends",
    "email_sends",
    "sms_sends",
    "ai_drug_checks",
    "ai_prescriptions",
    "ai_patient_summaries",
    "patient_file_uploads_mb",
  ];

  const values = await Promise.all(
    metrics.map((m) => getClinicMetric(kv, clinicId, m)),
  );

  return Object.fromEntries(
    metrics.map((m, i) => [m, values[i]]),
  ) as Record<ClinicMetric, number>;
}
