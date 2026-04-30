/**
 * Centralized OpenAI / LLM configuration.
 *
 * Addresses audit findings:
 *   - A103:  Egress allowlist for OPENAI_BASE_URL (prevents SSRF / exfiltration)
 *   - A107:  Model version pinning (prevents silent snapshot rotation)
 *   - A107-1: AI kill-switch enforcement helper
 *
 * Every AI route should call `getAIConfig()` instead of reading env vars
 * directly. The function validates the base URL against an allowlist and
 * returns a pinned model identifier.
 */

import type { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { isAIEnabled } from "@/lib/features";
import { logger } from "@/lib/logger";

// ── Egress allowlist (A103) ──────────────────────────────────────────

/**
 * Allowed origin prefixes for outbound LLM API calls.
 * Operators may extend via the comma-separated env var
 * `OPENAI_BASE_URL_ALLOWLIST`.
 *
 * Any OPENAI_BASE_URL that does not start with one of these prefixes
 * is rejected at config-read time, preventing SSRF and prompt
 * exfiltration to attacker-controlled proxies.
 */
const DEFAULT_ALLOWED_ORIGINS: readonly string[] = [
  "https://api.openai.com",
  "https://oai.azure.com",
  "https://gateway.ai.cloudflare.com",
  "https://api.cloudflare.com",
];

function getAllowedOrigins(): string[] {
  const extra = process.env.OPENAI_BASE_URL_ALLOWLIST;
  const origins = [...DEFAULT_ALLOWED_ORIGINS];
  if (extra) {
    for (const raw of extra.split(",")) {
      const trimmed = raw.trim();
      if (trimmed.startsWith("https://")) {
        origins.push(trimmed);
      }
    }
  }
  return origins;
}

/**
 * Validate that a base URL is within the egress allowlist.
 * Returns `true` when the URL's origin matches an allowed prefix.
 * Guards against prefix-confusion attacks (e.g. `https://api.openai.com.evil.com`)
 * by requiring the URL to either exactly match or be followed by `/` or `?`.
 */
export function isAllowedBaseUrl(url: string): boolean {
  const allowed = getAllowedOrigins();
  return allowed.some((origin) => {
    if (!url.startsWith(origin)) return false;
    // Ensure the match ends at a boundary — not in the middle of a hostname
    const rest = url.slice(origin.length);
    return rest.length === 0 || rest[0] === "/" || rest[0] === "?";
  });
}

// ── Default pinned model (A107, LLM05) ──────────────────────────────

/**
 * Pinned model snapshot. Using an alias like `gpt-4o-mini` lets OpenAI
 * silently rotate the underlying weights, breaking eval baselines.
 * Always default to a dated snapshot.
 */
const DEFAULT_PINNED_MODEL = "gpt-4o-mini-2024-07-18";

// ── Public API ───────────────────────────────────────────────────────

export interface AIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export type AIConfigError = {
  kind: "disabled" | "not_configured" | "egress_blocked";
  response: NextResponse;
};

export type AIConfigResult =
  | { ok: true; config: AIConfig }
  | { ok: false; error: AIConfigError };

/**
 * Read and validate AI configuration from environment.
 *
 * 1. Checks the global AI kill-switch (A107-1).
 * 2. Requires OPENAI_API_KEY.
 * 3. Validates OPENAI_BASE_URL against the egress allowlist (A103).
 * 4. Pins the model to a dated snapshot by default (A107 / LLM05).
 *
 * Returns either `{ ok: true, config }` or `{ ok: false, error }` with
 * a ready-to-return `Response` that the caller can propagate directly.
 */
export async function getAIConfig(): Promise<AIConfigResult> {
  // A107-1: Global kill-switch
  if (!(await isAIEnabled())) {
    return {
      ok: false,
      error: {
        kind: "disabled",
        response: apiError(
          "Les fonctionnalités IA sont temporairement désactivées.",
          503,
          "AI_DISABLED",
        ),
      },
    };
  }

  // API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: {
        kind: "not_configured",
        response: apiError(
          "AI service not configured. Please set OPENAI_API_KEY.",
          503,
          "AI_NOT_CONFIGURED",
        ),
      },
    };
  }

  // Egress allowlist (A103)
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  if (!isAllowedBaseUrl(baseUrl)) {
    logger.error("OPENAI_BASE_URL blocked by egress allowlist", {
      context: "ai-config",
      baseUrl,
    });
    return {
      ok: false,
      error: {
        kind: "egress_blocked",
        response: apiError(
          "AI service configuration error. Contact your administrator.",
          503,
          "AI_CONFIG_ERROR",
        ),
      },
    };
  }

  // Model pinning (A107 / LLM05)
  const model = process.env.OPENAI_MODEL || DEFAULT_PINNED_MODEL;

  return { ok: true, config: { apiKey, baseUrl, model } };
}
