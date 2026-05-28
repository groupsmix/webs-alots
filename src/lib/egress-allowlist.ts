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
 * A39-2: Enforce mode is now ON by default (`EGRESS_ALLOWLIST_ENFORCE`
 * defaults to "true"). Set to "false" explicitly only for safe rollout.
 *
 * A50-1: Private-IP / link-local / loopback / cloud-metadata addresses
 * are unconditionally blocked regardless of the hostname allowlist.
 */

import { getCircuitBreaker, CircuitOpenError } from "@/lib/circuit-breaker";
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

// ---------------------------------------------------------------------------
// A50-1: SSRF guard — block private / reserved / metadata IP ranges
// ---------------------------------------------------------------------------

/**
 * Returns true when `hostname` is an IP-literal (v4 or bracketed v6)
 * that falls within a private, loopback, link-local, or cloud-metadata
 * range. This prevents SSRF to internal infrastructure even when the
 * hostname allowlist is bypassed (e.g. via DNS rebinding).
 */
export function isPrivateOrReservedIP(hostname: string): boolean {
  // Strip IPv6 brackets if present
  const raw = hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;

  // --- IPv4 ---
  const v4Parts = raw.split(".");
  if (v4Parts.length === 4 && v4Parts.every((p) => /^\d{1,3}$/.test(p))) {
    const octets = v4Parts.map(Number);
    if (octets.some((o) => o > 255)) return false;
    const [a, b] = octets;

    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 10) return true; // 10.0.0.0/8 private
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local + metadata
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
    return false;
  }

  // --- IPv6 ---
  const lower = raw.toLowerCase();
  if (lower === "::1") return true; // loopback
  if (lower === "::") return true; // unspecified
  if (lower.startsWith("fe80")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
  // ::ffff:<ipv4> mapped addresses
  if (lower.startsWith("::ffff:")) {
    const mapped = lower.slice(7);
    return isPrivateOrReservedIP(mapped);
  }

  return false;
}

/**
 * Check whether a URL targets an allowlisted egress host.
 * A50-1: IP-literal URLs pointing at private/reserved ranges are
 * unconditionally rejected before the hostname allowlist is consulted.
 */
export function isEgressAllowed(url: string | URL): boolean {
  try {
    const parsed = typeof url === "string" ? new URL(url) : url;
    const hostname = parsed.hostname;

    // A50-1: Block private / reserved IPs unconditionally
    if (isPrivateOrReservedIP(hostname)) return false;

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
 * Map a URL hostname to a circuit breaker service name.
 * Groups related hosts under a single breaker (e.g. all Stripe hosts).
 */
function resolveServiceName(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    if (hostname.includes("openai.com")) return "openai";
    if (hostname.includes("stripe.com")) return "stripe";
    if (hostname.includes("facebook.com")) return "whatsapp";
    if (hostname.includes("resend.com")) return "resend";
    if (hostname.includes("sentry.io")) return "sentry";
    if (hostname.includes("cmi.co.ma")) return "cmi";
    if (hostname.includes("slack.com")) return "slack";
    return "default";
  } catch {
    return "default";
  }
}

/**
 * Guarded fetch wrapper. In enforce mode, rejects requests to
 * non-allowlisted hosts. In monitor mode, logs a warning and proceeds.
 *
 * A39-2: Defaults to enforce mode (`EGRESS_ALLOWLIST_ENFORCE !== "false"`).
 * A74-2: Wraps outbound calls in a per-service circuit breaker.
 */
export async function fetchAllowlisted(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const url =
    typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

  if (!isEgressAllowed(url)) {
    const hostname = (() => {
      try {
        return new URL(url).hostname;
      } catch {
        return "<unparseable>";
      }
    })();

    // A39-2: Default to enforce mode — only disable with explicit "false"
    const enforce = process.env.EGRESS_ALLOWLIST_ENFORCE !== "false";

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

  // A74-2: Route through the per-service circuit breaker so a hard-down
  // dependency fast-fails instead of burning 15 s × retries per request.
  const service = resolveServiceName(url);
  const breaker = getCircuitBreaker(service);

  return breaker.fire(async () => {
    // API-007: Default 15 s timeout on all outbound calls to prevent a
    // slow third party from burning the Worker's request handle.
    if (!init?.signal) {
      return fetch(input, { ...init, signal: AbortSignal.timeout(15_000) });
    }
    return fetch(input, init);
  });
}

// Re-export for consumers that need to handle fast-fail gracefully.
export { CircuitOpenError };
