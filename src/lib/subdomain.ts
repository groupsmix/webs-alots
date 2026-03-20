/**
 * Subdomain utilities for multi-tenant routing.
 *
 * Each clinic can be accessed at: clinicname.yourdomain.com
 * The ROOT_DOMAIN env var defines the base domain (e.g., "yourdomain.com").
 * For local dev, subdomains work via "clinicname.localhost:3000".
 */

/**
 * Extract the subdomain from a hostname.
 *
 * Examples:
 *   "demo.example.com"      → "demo"       (ROOT_DOMAIN = "example.com")
 *   "demo.localhost"         → "demo"       (localhost dev)
 *   "example.com"            → null         (root domain, no subdomain)
 *   "localhost"              → null
 *   "www.example.com"        → null         ("www" is ignored)
 */
export function extractSubdomain(
  hostname: string,
  rootDomain?: string,
): string | null {
  // Strip port if present
  const host = hostname.split(":")[0];

  // Local development: *.localhost
  if (host.endsWith(".localhost")) {
    const sub = host.replace(".localhost", "");
    if (sub && sub !== "www") return sub;
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
 * Check whether the current hostname is the root domain (no subdomain).
 */
export function isRootDomain(
  hostname: string,
  rootDomain?: string,
): boolean {
  return extractSubdomain(hostname, rootDomain) === null;
}
