/**
 * DNS verification token helper for self-service clinic registration (R-12).
 *
 * Tokens are deterministically derived from (email, domain) via HMAC with a
 * server-side secret. The client cannot guess or supply the token: they must
 * request it from the server, publish it as a TXT record on their domain, and
 * then call the registration endpoint. The server independently re-derives the
 * expected token and verifies it against DNS, so an attacker cannot bypass
 * verification by supplying their own token alongside their own domain.
 *
 * Why HMAC-derived (not random + stored)?
 *   - Stateless: no KV/DB write on token request
 *   - Deterministic: same (email, domain) always yields the same token, so a
 *     user who refreshes the request page can re-fetch the same token instead
 *     of being forced to re-publish DNS
 *   - Unforgeable: without the server secret, the token is computationally
 *     infeasible to guess
 */

import { createHmac } from "crypto";

const TOKEN_PREFIX = "oltigo";

/**
 * Returns the secret used to sign DNS verification tokens, or `null` if no
 * secret is configured. Callers MUST treat `null` as "verification is not
 * available" and refuse to issue tokens or pass DNS verification — never
 * substitute a literal fallback (which would let attackers compute tokens).
 *
 * Prefers a dedicated `DNS_VERIFICATION_SECRET` so a leak does not compromise
 * other HMAC keys, and falls back to `BOOKING_TOKEN_SECRET` for deployments
 * that have not provisioned the dedicated key yet.
 */
function getDnsVerificationSecret(): string | null {
  const dedicated = process.env.DNS_VERIFICATION_SECRET;
  if (dedicated && dedicated.length > 0) return dedicated;
  const fallback = process.env.BOOKING_TOKEN_SECRET;
  if (fallback && fallback.length > 0) return fallback;
  return null;
}

export function isDnsVerificationConfigured(): boolean {
  return getDnsVerificationSecret() !== null;
}

/**
 * Check if a hostname is a private/internal address that should be blocked
 * to prevent SSRF attacks.
 * 
 * Blocks:
 * - Private IP ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
 * - Loopback addresses (127.0.0.0/8, ::1)
 * - Link-local addresses (169.254.0.0/16, fe80::/10)
 * - Localhost
 * - .local domains (mDNS)
 * - Cloud metadata services
 * 
 * @param hostname - The hostname to check
 * @returns True if the hostname should be blocked for SSRF protection
 */
function isPrivateOrInternalDomain(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  // Block localhost and loopback
  if (lower === "localhost" || lower.startsWith("127.") || lower === "::1") {
    return true;
  }

  // Block .local domains (mDNS)
  if (lower.endsWith(".local")) {
    return true;
  }

  // Block cloud metadata services
  const metadataServices = [
    "metadata.google.internal",
    "169.254.169.254", // AWS/Azure/GCP metadata
    "metadata.azure.com",
    "metadata.packet.net",
  ];
  if (metadataServices.includes(lower)) {
    return true;
  }

  // Check for private IP ranges
  // This is a basic check - for production, consider using a library like 'ip-address'
  const ipv4Match = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1).map(Number);
    const [a, b] = octets;

    // 10.0.0.0/8
    if (a === 10) return true;

    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;

    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) return true;

    // 127.0.0.0/8 (loopback)
    if (a === 127) return true;
  }

  return false;
}

/**
 * Normalize a domain (URL or hostname) to a canonical hostname suitable for
 * use as HMAC input and for DNS lookup.
 *
 * @returns The lowercased hostname without `www.` or trailing dots, or `null`
 *          if the input is not a valid domain.
 */
export function normalizeDomain(domain: string): string | null {
  if (!domain) return null;
  let hostname: string;
  try {
    hostname = new URL(domain).hostname;
  } catch {
    hostname = domain;
  }
  hostname = hostname.replace(/^www\./i, "").replace(/\.$/, "").toLowerCase();
  if (!hostname || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(hostname)) return null;
  return hostname;
}

/**
 * Normalize and validate a domain for DNS verification, with SSRF protection.
 * 
 * This function extends normalizeDomain() with additional security checks:
 * - Requires FQDN (at least one dot)
 * - Blocks private/internal IP addresses
 * - Blocks localhost and .local domains
 * - Blocks cloud metadata services
 * 
 * @param domain - The domain to normalize and validate
 * @returns The normalized hostname, or `null` if invalid or blocked for security
 */
export function normalizeDomainWithSSRFProtection(domain: string): string | null {
  const hostname = normalizeDomain(domain);
  if (!hostname) return null;

  // Require FQDN (at least one dot)
  if (!hostname.includes(".")) {
    return null;
  }

  // Block private/internal domains (SSRF protection)
  if (isPrivateOrInternalDomain(hostname)) {
    return null;
  }

  return hostname;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Derive the DNS verification token for a given (email, domain) pair.
 *
 * Returns `null` if no server-side secret is configured or if the domain is
 * not a valid hostname. The token is stable across requests with the same
 * inputs, so a user who lost their token can re-fetch the same value.
 *
 * The full TXT record value the user must publish is
 * `oltigo-verify=<returned-token>`.
 */
export function generateDnsVerificationToken(email: string, domain: string): string | null {
  const secret = getDnsVerificationSecret();
  if (!secret) return null;
  const hostname = normalizeDomain(domain);
  if (!hostname) return null;
  const normalizedEmail = normalizeEmail(email);
  return createHmac("sha256", secret)
    .update(`${TOKEN_PREFIX}:${normalizedEmail}:${hostname}`)
    .digest("hex")
    .slice(0, 32);
}
