/**
 * AI configuration helpers.
 *
 * Centralises OpenAI base URL validation and model version pinning
 * so every AI route uses the same safe defaults.
 */

import { logger } from "@/lib/logger";

/**
 * A115-5: Allowlist of known-good OpenAI-compatible base URLs.
 * If OPENAI_BASE_URL is set to a value not in this list, the request
 * is rejected to prevent silent prompt exfiltration via misconfiguration.
 */
const ALLOWED_OPENAI_BASE_URLS = [
  "https://api.openai.com/v1",
  "https://api.openai.com",
  // Azure OpenAI endpoints follow this pattern
  // Add additional trusted endpoints here as needed
];

/**
 * Returns the validated OpenAI base URL.
 *
 * - If OPENAI_BASE_URL is not set, defaults to "https://api.openai.com/v1".
 * - If set, validates against the allowlist in production.
 * - In non-production, logs a warning but allows any URL for dev flexibility.
 *
 * @throws {Error} in production if the URL is not in the allowlist.
 */
export function getOpenAIBaseUrl(): string {
  const defaultUrl = "https://api.openai.com/v1";
  const configured = process.env.OPENAI_BASE_URL;

  if (!configured) return defaultUrl;

  // Normalise: strip trailing slash for comparison
  const normalised = configured.replace(/\/+$/, "");

  // Check allowlist
  const isAllowed =
    ALLOWED_OPENAI_BASE_URLS.includes(normalised) ||
    // Allow Azure OpenAI endpoints (*.openai.azure.com/*) with proper hostname boundary
    /^https:\/\/[a-z0-9-]+\.openai\.azure\.com(\/|$|:)/i.test(normalised);

  if (!isAllowed) {
    if (process.env.NODE_ENV === "production") {
      logger.error("OPENAI_BASE_URL is not in the allowed list -- rejecting", {
        context: "ai-config",
        configured: normalised,
      });
      throw new Error(
        `OPENAI_BASE_URL "${normalised}" is not in the allowed list. ` +
        "Update ALLOWED_OPENAI_BASE_URLS in src/lib/ai/config.ts or fix the env var.",
      );
    }
    // Dev/staging: warn but allow
    logger.warn("OPENAI_BASE_URL is not in the allowed list -- allowing in non-production", {
      context: "ai-config",
      configured: normalised,
    });
  }

  return normalised;
}

/**
 * A115-7: Returns the pinned model identifier.
 *
 * Prefers OPENAI_MODEL env var. Falls back to a dated snapshot alias
 * to avoid silent upstream model rotations breaking eval baselines.
 */
export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL || "gpt-4o-mini-2024-07-18";
}
