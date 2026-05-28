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
 * Returns the dedicated DNS verification secret, or `null` if not configured.
 *
 * SEC-001: The BOOKING_TOKEN_SECRET fallback has been removed. NIST SP 800-57
 * §5.2 requires distinct keys per HMAC purpose. A leaked DNS verification
 * token must not be replayable as a booking token (or vice versa).
 *
 * If `DNS_VERIFICATION_SECRET` is unset, callers MUST treat the return as
 * "verification is not available" and refuse to issue tokens.
 */
function getDnsVerificationSecret(): string | null {
  const dedicated = process.env.DNS_VERIFICATION_SECRET;
  if (dedicated && dedicated.length > 0) return dedicated;
  return null;
}

export function isDnsVerificationConfigured(): boolean {
  return getDnsVerificationSecret() !== null;
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
  hostname = hostname
    .replace(/^www\./i, "")
    .replace(/\.$/, "")
    .toLowerCase();
  if (!hostname || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(hostname)) return null;
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
