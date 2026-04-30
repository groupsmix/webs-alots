/**
 * A108 / A109 / A110: AI-specific audit logging.
 *
 * Records every AI invocation with structured metadata so that:
 *   - Refusals vs. completions are distinguishable (A108)
 *   - Inputs and outputs are timestamped for Article 12 compliance (A109)
 *   - Metrics (latency, token usage, error rate) are queryable (A110 MEASURE)
 *
 * Uses the existing `logAuditEvent` from `@/lib/audit-log` with the new
 * "ai" event type, plus a structured logger fallback for non-tenant
 * contexts (e.g., the public chatbot).
 *
 * IMPORTANT: Never log raw PHI in audit records. Use the PII redactor
 * on any patient-derived text before passing it as metadata.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import type { Database, Json } from "@/lib/types/database";

// ── Types ────────────────────────────────────────────────────────────

export type AIOutcome =
  | "success"        // Model returned a usable response
  | "refusal"        // Model refused to answer (content policy, etc.)
  | "empty"          // Model returned empty/null content
  | "parse_error"    // Response could not be parsed (bad JSON, etc.)
  | "api_error"      // Upstream API returned non-2xx
  | "timeout"        // Request timed out
  | "rate_limited"   // Our rate limiter blocked the call
  | "disabled"       // AI feature flag is off
  | "not_configured" // API key missing
  | "error";         // Unexpected error

export interface AIAuditEntry {
  /** Which AI feature was invoked */
  feature:
    | "ai_prescription"
    | "ai_auto_suggest"
    | "ai_drug_check"
    | "ai_patient_summary"
    | "ai_manager"
    | "ai_whatsapp_receptionist"
    | "ai_chatbot";
  /** Outcome of the invocation */
  outcome: AIOutcome;
  /** Clinic ID (tenant scope) */
  clinicId: string;
  /** Actor (doctor/admin user ID, or "anonymous" for public chatbot) */
  actorId: string;
  /** Model used (e.g., "gpt-4o-mini") */
  model?: string;
  /** Latency in milliseconds */
  latencyMs?: number;
  /** HTTP status from upstream API */
  upstreamStatus?: number;
  /** Number of PII redactions applied to the input */
  piiRedactions?: number;
  /** Number of output guard issues found */
  outputGuardIssues?: number;
  /** Truncated input prompt (first 200 chars, for debugging — must be PII-redacted) */
  inputPreview?: string;
  /** Seed used for reproducibility (A111) */
  seed?: number;
  /** Additional metadata */
  extra?: Record<string, Json | undefined>;
}

// ── Deterministic seed for reproducibility (A111) ────────────────────

/**
 * Generate a deterministic seed for OpenAI API calls.
 *
 * A111: Without a seed, the same prompt can produce different outputs
 * across calls (even with temperature=0), making it impossible to
 * reproduce a doctor's report of a bad AI suggestion.
 *
 * We derive the seed from the current UTC date + clinic ID so that:
 *   - Same input on the same day produces the same output (reproducible)
 *   - Different days produce different seeds (avoids stale caching)
 *   - Different clinics get different seeds (isolation)
 *
 * OpenAI's `seed` parameter is best-effort — it improves but does not
 * guarantee determinism. Model updates upstream can still change output.
 */
export function generateAISeed(clinicId: string): number {
  const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const input = `${clinicId}:${dateStr}`;
  // Simple hash: sum of char codes * position, mod 2^31
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// ── Audit logger ─────────────────────────────────────────────────────

/**
 * Log an AI invocation for audit/compliance purposes.
 *
 * This writes to both:
 *   1. The `activity_logs` table (via logAuditEvent) for structured query
 *   2. The structured logger for real-time observability (Sentry, etc.)
 *
 * If the Supabase client is not available (e.g., during build or in
 * edge contexts without admin access), falls back to structured logging
 * only.
 */
export async function logAIAudit(
  entry: AIAuditEntry,
  supabase?: SupabaseClient<Database> | null,
): Promise<void> {
  const metadata: Record<string, Json | undefined> = {
    feature: entry.feature,
    outcome: entry.outcome,
    model: entry.model,
    latency_ms: entry.latencyMs,
    upstream_status: entry.upstreamStatus,
    pii_redactions: entry.piiRedactions,
    output_guard_issues: entry.outputGuardIssues,
    seed: entry.seed,
    ...entry.extra,
  };

  // Always write to structured logger (real-time observability)
  const logMethod = entry.outcome === "success" ? "info" : "warn";
  logger[logMethod](`AI ${entry.feature}: ${entry.outcome}`, {
    context: entry.feature,
    clinicId: entry.clinicId,
    actorId: entry.actorId,
    ...metadata,
  });

  // Write to activity_logs table if Supabase client available
  if (supabase) {
    try {
      const { logAuditEvent } = await import("@/lib/audit-log");
      await logAuditEvent({
        supabase,
        action: `ai.${entry.feature}.${entry.outcome}`,
        type: "ai",
        clinicId: entry.clinicId,
        actor: entry.actorId,
        description: `AI ${entry.feature} invocation: ${entry.outcome}${entry.latencyMs ? ` (${entry.latencyMs}ms)` : ""}`,
        metadata,
      });
    } catch (err) {
      // Don't fail the request if audit logging fails
      logger.warn("Failed to write AI audit event to activity_logs", {
        context: "ai-audit",
        clinicId: entry.clinicId,
        error: err,
      });
    }
  }
}
