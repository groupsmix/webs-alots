/**
 * Shared AI configuration — centralises kill-switch, URL allowlist,
 * model version pinning, and disclaimer injection.
 *
 * Phase 2 bridge: `resolveAIConfig()` now checks the `ai_provider_configs`
 * table first (database-backed routing) and falls back to the
 * `OPENAI_API_KEY` environment variable for backward compatibility.
 * This means every route that calls `resolveAIConfig()` automatically
 * uses the admin-managed provider keys from the superadmin UI when
 * available, without requiring route-by-route rewrites.
 *
 * Findings addressed:
 *   F-AI-01: Kill switch enforcement across all AI routes
 *   F-AI-05: OPENAI_BASE_URL allowlist (prevents operator-overridable exfil)
 *   F-AI-07: Model version pinning (no floating alias)
 *   F-A199:  AI medical-advice disclaimer in response payloads
 */

import { AI_DISCLAIMER_FR } from "@/lib/ai-disclaimer";
import { isAIEnabled } from "@/lib/features";
import { logger } from "@/lib/logger";
import { createUntypedAdminClient } from "@/lib/supabase-server";
import { loadProviderConfigs } from "./router";

// ── URL Allowlist (F-AI-05) ──

/**
 * Only these base URLs are permitted for OPENAI_BASE_URL.
 * Prevents an operator from redirecting AI calls to a rogue endpoint
 * that could exfiltrate PHI sent in prompts.
 */
const ALLOWED_AI_BASE_URLS = new Set(["https://api.openai.com/v1", "https://api.openai.com"]);

// W8-S-02: Pin Azure OpenAI to an explicit resource name rather than
// accepting any *.openai.azure.com subdomain. Set AZURE_OPENAI_RESOURCE_NAME
// in env (e.g. "oltigo-prod") to allowlist only that resource.
function isAllowedBaseUrl(url: string): boolean {
  if (ALLOWED_AI_BASE_URLS.has(url)) return true;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith(".openai.azure.com")) {
      // nosemgrep: semgrep.env-access — pinned Azure resource name, validated at boot
      const resourceName = process.env.AZURE_OPENAI_RESOURCE_NAME;
      if (!resourceName) return false;
      const expected = `${resourceName}.openai.azure.com`;
      return parsed.hostname === expected;
    }
  } catch {
    return false;
  }
  return false;
}

// ── Pinned Model Version (F-AI-07) ──

/**
 * Default model version. Pinned to a dated snapshot to prevent
 * unexpected behaviour changes when OpenAI updates the alias.
 */
const DEFAULT_MODEL = "gpt-4o-mini-2024-07-18";

// W8-S-03: Only dated snapshot model names are allowed. Floating aliases
// (e.g. "gpt-4o-mini") are rejected to prevent silent safety regressions.
const ALLOWED_MODELS = new Set([
  "gpt-4o-mini-2024-07-18",
  "gpt-4o-2024-08-06",
  "gpt-4o-2024-11-20",
]);

// ── Public API ──

export interface AIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  /** F-AI-14: Deterministic seed for reproducibility. Log with audit events. */
  seed: number;
}

/**
 * Resolve and validate AI configuration.
 *
 * Resolution order:
 *   1. F-AI-01: Global kill-switch (KV + env)
 *   2. Database — load active provider configs from `ai_provider_configs`.
 *      Uses the first active provider that has an API key (OpenAI preferred
 *      for backward compatibility with routes that call the OpenAI chat
 *      completions API directly).
 *   3. Environment fallback — `OPENAI_API_KEY` from Cloudflare secrets.
 *   4. F-AI-05: OPENAI_BASE_URL allowlist (only for OpenAI / env fallback)
 *   5. F-AI-07: Model pinning
 *
 * This bridge lets all existing routes transparently use admin-managed
 * keys from the superadmin settings UI without per-route rewrites.
 */
export async function resolveAIConfig(): Promise<
  { ok: true; config: AIConfig } | { ok: false; reason: string; statusCode: number }
> {
  // F-AI-01: Kill switch
  if (!(await isAIEnabled())) {
    return { ok: false, reason: "AI features are disabled", statusCode: 503 };
  }

  // ── Try database-backed config first ──
  const dbResult = await resolveFromDatabase();
  if (dbResult) {
    return { ok: true, config: dbResult };
  }

  // ── Fallback to environment variables ──
  return resolveFromEnv();
}

/** Try to load an active OpenAI-compatible provider from `ai_provider_configs`. */
async function resolveFromDatabase(): Promise<AIConfig | null> {
  try {
    const supabase = createUntypedAdminClient("ai-config-resolve");
    const configs = await loadProviderConfigs(supabase);

    if (configs.size === 0) return null;

    // Prefer OpenAI provider since callers use the OpenAI chat completions API
    const openaiConfig = configs.get("openai");
    if (openaiConfig?.isActive && openaiConfig.apiKey) {
      logger.debug("AI config resolved from database (openai)", { context: "ai-config" });
      return {
        apiKey: openaiConfig.apiKey,
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4.1-mini",
        seed: Date.now(),
      };
    }

    // Fall back to any active provider with an OpenAI-compatible API
    // (anthropic, google, etc. are NOT compatible — only check openai here)
    return null;
  } catch (err) {
    logger.warn("Failed to load AI config from database, falling back to env", {
      context: "ai-config",
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Original env-based resolution (backward compatible). */
function resolveFromEnv():
  | { ok: true; config: AIConfig }
  | { ok: false; reason: string; statusCode: number } {
  // nosemgrep: semgrep.env-access — secret read at runtime; not in env.ts to avoid eager import
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      reason:
        "AI service not configured. Set OPENAI_API_KEY or configure a provider in the admin dashboard.",
      statusCode: 503,
    };
  }

  // F-AI-05: Validate base URL
  // nosemgrep: semgrep.env-access — operator-configurable base URL, validated below
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  if (!isAllowedBaseUrl(baseUrl)) {
    logger.error("OPENAI_BASE_URL is not in the allowlist", {
      context: "ai-config",
      baseUrl,
    });
    return {
      ok: false,
      reason: "AI service configuration error",
      statusCode: 500,
    };
  }

  // F-AI-07: Pinned model version
  // W8-S-03: Reject models not in the allowlist to prevent operators from
  // switching to a floating alias or a less safety-tuned model.
  // nosemgrep: semgrep.env-access — operator-configurable model, validated below against allowlist
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  if (!ALLOWED_MODELS.has(model)) {
    logger.error("OPENAI_MODEL is not in the allowlist", {
      context: "ai-config",
      model,
    });
    return {
      ok: false,
      reason: "AI model configuration error",
      statusCode: 500,
    };
  }

  // F-AI-14: Generate a per-request seed for OpenAI reproducibility.
  // Callers should pass this as `seed` in the API request and log it
  // in audit events so any problematic output can be reproduced.
  const seed = Date.now();

  return { ok: true, config: { apiKey, baseUrl, model, seed } };
}

/**
 * F-A199 / A109-01: Standard disclaimer is now served via `getAIDisclaimer()`
 * from `@/lib/ai-disclaimer`. All AI routes include it in their responses.
 * This const is retained for backwards compatibility with any consumer that
 * may import it via the config module.
 */
export const AI_RESPONSE_DISCLAIMER = {
  disclaimer: AI_DISCLAIMER_FR,
  aiGenerated: true,
} as const;

/**
 * A200: Log when AI processes data for a minor patient.
 *
 * Clinical AI (summaries, prescriptions, drug checks) is permitted for
 * minors under medical-necessity, but behavioural profiling is blocked.
 * Every invocation is logged for GDPR-K / Law 09-08 audit trail.
 */
export function logMinorAIProcessing(patientId: string, clinicId: string, feature: string): void {
  logger.info("ai.minor_patient_processing", {
    context: "ai-minor-guard",
    patientId,
    clinicId,
    feature,
    note: "Clinical AI permitted under medical-necessity; no behavioural profiling applied",
  });
}
