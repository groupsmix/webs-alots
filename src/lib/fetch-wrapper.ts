/**
 * Safe fetch wrapper with egress allowlist enforcement.
 *
 * When EGRESS_ALLOWLIST_ENFORCE=true, blocks requests to domains
 * not in the ALLOWED_DOMAINS list. This prevents compromised
 * dependencies from making arbitrary external API calls.
 *
 * Usage:
 *   import { safeFetch } from "@/lib/fetch-wrapper";
 *   const res = await safeFetch("https://api.stripe.com/...");
 */

import { logger } from "@/lib/logger";

const ALLOWED_DOMAINS = [
  // Infrastructure
  "supabase.co",
  "supabase.in",

  // Payment providers
  "api.stripe.com",
  "cmi.co.ma",

  // AI providers
  "api.anthropic.com",
  "api.openai.com",
  "api.elevenlabs.io",

  // Communication
  "api.twilio.com",
  "graph.facebook.com", // WhatsApp Business API
  "api.resend.com",

  // Analytics & Monitoring
  "plausible.io",
  "sentry.io",
  "api.sentry.io",

  // CDN & Assets
  "cloudflare.com",
];

/**
 * Check if a hostname is allowed by the egress allowlist.
 */
function isHostnameAllowed(hostname: string): boolean {
  return ALLOWED_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

/**
 * Safe fetch with egress allowlist enforcement.
 *
 * @param url - Full URL to fetch
 * @param init - Fetch options (headers, method, body, etc.)
 * @returns Fetch Response
 * @throws Error if URL is blocked by allowlist
 */
export async function safeFetch(url: string | URL, init?: RequestInit): Promise<Response> {
  const urlObj = typeof url === "string" ? new URL(url) : url;
  const hostname = urlObj.hostname;

  // Check if enforcement is enabled
  const enforce = process.env.EGRESS_ALLOWLIST_ENFORCE === "true";

  if (enforce && !isHostnameAllowed(hostname)) {
    const error = new Error(
      `Egress blocked: ${hostname} is not in the allowlist. ` +
        `Add to ALLOWED_DOMAINS in src/lib/fetch-wrapper.ts if this is a legitimate external service.`,
    );

    logger.error("Egress allowlist violation", {
      context: "fetch-wrapper",
      hostname,
      url: url.toString(),
      allowlist: ALLOWED_DOMAINS,
    });

    throw error;
  }

  // Log outbound requests for audit purposes (redact sensitive data)
  if (enforce) {
    logger.info("Outbound API call", {
      context: "fetch-wrapper",
      hostname,
      method: init?.method ?? "GET",
      // Do NOT log full URL (may contain API keys)
    });
  }

  return fetch(url, init);
}

/**
 * Check if a URL would be allowed without actually fetching.
 * Useful for validation before making a request.
 */
export function wouldEgressBeAllowed(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return isHostnameAllowed(urlObj.hostname);
  } catch {
    return false; // Invalid URL
  }
}
