/**
 * Shared AI configuration — centralises kill-switch, URL allowlist,
 * model version pinning, and disclaimer injection.
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
}

/**
 * Resolve and validate AI configuration from environment variables.
 * Returns null with an error reason if AI cannot be used.
 *
 * Checks (in order):
 * 1. F-AI-01: Global kill-switch via KV
 * 2. OPENAI_API_KEY must be set
 * 3. F-AI-05: OPENAI_BASE_URL must be in allowlist
 * 4. F-AI-07: Model is pinned (falls back to DEFAULT_MODEL)
 */
export async function resolveAIConfig(): Promise<
  { ok: true; config: AIConfig } | { ok: false; reason: string; statusCode: number }
> {
  // F-AI-01: Kill switch
  if (!(await isAIEnabled())) {
    return { ok: false, reason: "AI features are disabled", statusCode: 503 };
  }

  // nosemgrep: semgrep.env-access — secret read at runtime; not in env.ts to avoid eager import
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      reason: "AI service not configured. Please set OPENAI_API_KEY.",
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

  return { ok: true, config: { apiKey, baseUrl, model } };
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
