/**
 * AI Tracing — Phase E1
 *
 * Per-request metadata traces for every AI call.
 * No prompt/response bodies stored (PHI risk).
 * Writes are async (fire-and-forget) to avoid impacting response latency.
 */

import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";

type TraceStatus = "ok" | "validation_failed" | "all_providers_failed" | "rate_limited" | "error";

export interface AITrace {
  clinicId?: string | null;
  feature: string;
  provider: string;
  model: string;
  fallbackChain: Array<{ provider: string; error?: string }>;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  ttftMs?: number | null;
  status: TraceStatus;
  errorCode?: string | null;
  costCents: number;
}

/**
 * Write an AI trace row asynchronously. Never throws — errors are logged.
 */
export function recordAITrace(trace: AITrace): void {
  void (async () => {
    try {
      const supabase = createUntypedAdminClient("ai-tracing");

      await supabase.from("ai_traces").insert({
        clinic_id: trace.clinicId ?? null,
        feature: trace.feature,
        provider: trace.provider,
        model: trace.model,
        fallback_chain: trace.fallbackChain,
        input_tokens: trace.inputTokens,
        output_tokens: trace.outputTokens,
        latency_ms: trace.latencyMs,
        ttft_ms: trace.ttftMs ?? null,
        status: trace.status,
        error_code: trace.errorCode ?? null,
        cost_cents: trace.costCents,
      });
    } catch (err) {
      logger.warn("Failed to write AI trace", {
        context: "ai-tracing",
        feature: trace.feature,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();
}

/**
 * Helper to build a trace from a successful router response.
 */
export function traceFromSuccess(
  feature: string,
  opts: {
    clinicId?: string | null;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    costCents: number;
    fromFallback: boolean;
    fallbackChain?: Array<{ provider: string; error?: string }>;
  },
): AITrace {
  return {
    clinicId: opts.clinicId,
    feature,
    provider: opts.provider,
    model: opts.model,
    fallbackChain: opts.fallbackChain ?? [],
    inputTokens: opts.inputTokens,
    outputTokens: opts.outputTokens,
    latencyMs: opts.latencyMs,
    status: "ok",
    costCents: opts.costCents,
  };
}

// ── In-memory fallback rate tracker ──
// Tracks per-provider request + fallback counts over a rolling 1h window.
// When rate >30%, fires a platform_alert.

const ALERT_WINDOW_MS = 60 * 60 * 1000;
const ALERT_THRESHOLD = 0.3;

interface ProviderWindow {
  total: number;
  fallbacks: number;
  windowStart: number;
}

const providerWindows = new Map<string, ProviderWindow>();

export function checkFallbackAlert(
  provider: string,
  hadFallback: boolean,
  clinicId?: string | null,
): void {
  const now = Date.now();
  let win = providerWindows.get(provider);

  if (!win || now - win.windowStart > ALERT_WINDOW_MS) {
    win = { total: 0, fallbacks: 0, windowStart: now };
  }

  win.total++;
  if (hadFallback) win.fallbacks++;
  providerWindows.set(provider, win);

  if (win.total >= 10 && win.fallbacks / win.total > ALERT_THRESHOLD) {
    void fireHighFallbackAlert(provider, win, clinicId);
    // Reset window after alert
    providerWindows.set(provider, { total: 0, fallbacks: 0, windowStart: now });
  }
}

async function fireHighFallbackAlert(
  provider: string,
  win: ProviderWindow,
  clinicId?: string | null,
): Promise<void> {
  try {
    const supabase = createUntypedAdminClient("ai-tracing");
    const rate = ((win.fallbacks / win.total) * 100).toFixed(1);

    await supabase.from("platform_alerts").insert({
      clinic_id: clinicId ?? null,
      alert_type: "ai_high_fallback_rate",
      severity: "warning",
      title: `AI provider ${provider}: fallback rate ${rate}% (>${ALERT_THRESHOLD * 100}%)`,
      message: `Provider ${provider} had ${win.fallbacks}/${win.total} requests with fallbacks in the last hour.`,
      status: "active",
      metadata: { provider, fallbacks: win.fallbacks, total: win.total, rate },
    });

    logger.warn("AI high fallback rate alert fired", {
      context: "ai-tracing",
      provider,
      rate,
      fallbacks: win.fallbacks,
      total: win.total,
    });
  } catch (err) {
    logger.warn("Failed to fire fallback rate alert", {
      context: "ai-tracing",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Helper to build a trace from an all-providers-failed error.
 */
export function traceFromFailure(
  feature: string,
  opts: {
    clinicId?: string | null;
    latencyMs: number;
    fallbackChain: Array<{ provider: string; error?: string }>;
    errorCode?: string;
  },
): AITrace {
  return {
    clinicId: opts.clinicId,
    feature,
    provider: opts.fallbackChain[0]?.provider ?? "unknown",
    model: "none",
    fallbackChain: opts.fallbackChain,
    inputTokens: 0,
    outputTokens: 0,
    latencyMs: opts.latencyMs,
    status: "all_providers_failed",
    errorCode: opts.errorCode,
    costCents: 0,
  };
}
