/**
 * A39.2: Egress fetch allowlist.
 *
 * Cloudflare Workers allow arbitrary outbound fetch() by default. A
 * compromised dependency could exfiltrate data to any host. This module
 * provides a guarded `fetchAllowlisted()` wrapper that only allows
 * requests to known-good external hosts.
 *
 * Usage:
 *   import { fetchAllowlisted } from "@/lib/egress-allowlist";
 *   const res = await fetchAllowlisted("https://api.openai.com/v1/chat", { ... });
 *
 * When `EGRESS_ALLOWLIST_ENFORCE` is set to "true" in production, requests
 * to non-allowlisted hosts are rejected with an error. Otherwise the
 * allowlist is logged-only (monitor mode) for safe rollout.
 */

import { logger } from "@/lib/logger";

/**
 * Hosts that the Worker is permitted to make outbound requests to.
 * Each entry is matched against the hostname of the target URL.
 * Wildcards are not supported — add each specific hostname.
 */
const ALLOWED_EGRESS_HOSTS = new Set([
  // Supabase (derived at runtime below)
  // OpenAI / AI providers
  "api.openai.com",
  // Stripe
  "api.stripe.com",
  // CMI (Moroccan interbank gateway)
  "payment.cmi.co.ma",
  "testpayment.cmi.co.ma",
  // WhatsApp / Meta
  "graph.facebook.com",
  // Resend (email)
  "api.resend.com",
  // Slack (webhook notifications)
  "hooks.slack.com",
  // Cloudflare DNS (DoH)
  "cloudflare-dns.com",
  // Sentry
  "sentry.io",
  // Plausible analytics
  "plausible.io",
]);

/** Lazily populated from NEXT_PUBLIC_SUPABASE_URL */
let _supabaseHost: string | null | undefined;

function getSupabaseHost(): string | null {
  if (_supabaseHost !== undefined) return _supabaseHost;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url) {
    try {
      _supabaseHost = new URL(url).hostname;
      return _supabaseHost;
    } catch {
      // fall through
    }
  }
  _supabaseHost = null;
  return null;
}

/**
 * Check whether a URL targets an allowlisted egress host.
 */
export function isEgressAllowed(url: string | URL): boolean {
  try {
    const parsed = typeof url === "string" ? new URL(url) : url;
    const hostname = parsed.hostname;

    if (ALLOWED_EGRESS_HOSTS.has(hostname)) return true;

    // Dynamic: Supabase project host
    const sbHost = getSupabaseHost();
    if (sbHost && hostname === sbHost) return true;

    // Allow subdomains of known hosts (e.g. o12345.sentry.io)
    for (const allowed of ALLOWED_EGRESS_HOSTS) {
      if (hostname.endsWith(`.${allowed}`)) return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Guarded fetch wrapper. In enforce mode, rejects requests to
 * non-allowlisted hosts. In monitor mode, logs a warning and proceeds.
 */
export async function fetchAllowlisted(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  if (!isEgressAllowed(url)) {
    const hostname = (() => {
      try {
        return new URL(url).hostname;
      } catch {
        return "<unparseable>";
      }
    })();

    const enforce = process.env.EGRESS_ALLOWLIST_ENFORCE === "true";

    logger.warn("Egress fetch to non-allowlisted host", {
      context: "egress-allowlist",
      hostname,
      enforce,
    });

    if (enforce) {
      throw new Error(
        `A39.2: Egress blocked — ${hostname} is not in the allowlist. ` +
          "Add it to ALLOWED_EGRESS_HOSTS in src/lib/egress-allowlist.ts if legitimate.",
      );
    }
  }

  return fetch(input, init);
}
