/**
 * Subdomain utilities for multi-tenant routing.
 *
 * Each clinic can be accessed at: clinicname.yourdomain.com
 * The ROOT_DOMAIN env var defines the base domain (e.g., "yourdomain.com").
 * For local dev, subdomains work via "clinicname.localhost:3000".
 */

import { isReservedSubdomain } from "@/lib/reserved-subdomains";

/**
 * Extract the RAW subdomain label from a hostname, WITHOUT applying the
 * reserved-word filter. Returns null only for the root domain, "www",
 * multi-level subdomains, or when no root domain is configured.
 *
 * Use this when you must distinguish a *reserved* subdomain (e.g. "api",
 * "admin" — which must be actively BLOCKED so it can't serve the brand) from
 * the *root* domain (which legitimately serves marketing). {@link
 * extractSubdomain} collapses both to null — correct for tenant resolution,
 * but it hides exactly the distinction a security gate needs.
 *
 * Examples (ROOT_DOMAIN = "example.com"):
 *   "demo.example.com"  → "demo"
 *   "api.example.com"   → "api"   (reserved, but still returned here)
 *   "example.com"       → null    (root domain)
 *   "www.example.com"   → null    ("www" is ignored — has its own redirect)
 *   "a.b.example.com"   → null    (multi-level)
 */
export function extractRawSubdomain(hostname: string, rootDomain?: string): string | null {
  // Strip port if present
  const host = hostname.split(":")[0];

  // Local development: *.localhost
  if (host.endsWith(".localhost")) {
    const sub = host.replace(".localhost", "");
    if (sub && sub !== "www" && !sub.includes(".")) return sub;
    return null;
  }

  // If no root domain configured, cannot extract subdomain
  if (!rootDomain) return null;

  const root = rootDomain.split(":")[0];

  // Host must end with .rootDomain and be longer than rootDomain
  if (!host.endsWith(`.${root}`)) return null;

  const sub = host.slice(0, -(root.length + 1)); // remove ".rootDomain"

  // Ignore empty, "www", or multi-level subdomains (e.g., "a.b")
  if (!sub || sub === "www" || sub.includes(".")) return null;

  return sub;
}

/**
 * Extract the subdomain from a hostname for TENANT resolution.
 *
 * Returns null for the root domain, "www", multi-level subdomains, AND
 * reserved subdomains (admin, api, mail, staging, …) — reserved words must
 * never resolve as a tenant clinic. Callers that need to actively BLOCK
 * reserved hosts (rather than silently ignore them) must use
 * {@link extractRawSubdomain} together with {@link isReservedSubdomain};
 * otherwise a reserved host collapses to null here and is indistinguishable
 * from the root domain, which would serve the marketing site under e.g.
 * admin.oltigo.com.
 *
 * Examples:
 *   "demo.example.com"      → "demo"       (ROOT_DOMAIN = "example.com")
 *   "demo.localhost"         → "demo"       (localhost dev)
 *   "example.com"            → null         (root domain, no subdomain)
 *   "localhost"              → null
 *   "www.example.com"        → null         ("www" is ignored)
 *   "api.example.com"        → null         (reserved)
 */
export function extractSubdomain(hostname: string, rootDomain?: string): string | null {
  const sub = extractRawSubdomain(hostname, rootDomain);

  // Audit 8.3 / F-2 — Reserved subdomains must not resolve as tenant clinics.
  // The blocklist (admin, api, www, staging, mail, …) lives in the shared
  // `reserved-subdomains` module so resolution, the sitemap, the registration
  // endpoint, and the DB trigger all enforce exactly the same set. "staging"
  // in particular would otherwise collide with the staging environment route
  // (staging.oltigo.com) defined in wrangler.toml.
  if (sub && isReservedSubdomain(sub)) return null;

  return sub;
}

/**
 * Check whether the current hostname is the root domain (no subdomain).
 */
export function isRootDomain(hostname: string, rootDomain?: string): boolean {
  return extractSubdomain(hostname, rootDomain) === null;
}
