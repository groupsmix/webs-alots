/**
 * Reserved subdomain blocklist + slug validation (Audit F-2).
 *
 * This module is the single source of truth for which subdomains may never
 * be served as a tenant clinic, and what shape a valid tenant slug must take.
 * It is intentionally dependency-free (no Next.js / Node-only imports) so it
 * can run in every context that needs it:
 *
 *   - Edge middleware + `extractSubdomain()` (request resolution)
 *   - The public sitemap (defense-in-depth filtering)
 *   - The self-service registration endpoint (reject bad slugs)
 *   - The `scripts/check-orphan-subdomains.mjs` CI guard (Node)
 *
 * Why a blocklist matters: without it, `admin.oltigo.com`, `api.oltigo.com`,
 * `www.oltigo.com`, etc. resolve as if they were tenant clinics. That is an
 * SEO / duplicate-content problem at best and a phishing / reserved-name
 * takeover problem at worst.
 */

/**
 * Operational subdomains that ARE real, Oltigo-operated tenants and therefore
 * must keep resolving normally. These are created by seeds / super-admin, not
 * by public registration, so they are deliberately NOT in the reserved set.
 *
 * `demo` in particular backs the public demo site (the "Voir la démo" CTA
 * points at https://demo.oltigo.com) — blocking it would break that flow.
 */
export const OPERATIONAL_SUBDOMAINS: ReadonlySet<string> = new Set(["demo", "test"]);

/**
 * Subdomains that must never be served as a tenant and must never be
 * registrable. Grouped only for readability — order is irrelevant.
 *
 * Anything added here is enforced at request resolution, in the sitemap, in
 * the registration endpoint, and by the database trigger (migration 00171).
 */
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  // ── Infrastructure / DNS ──────────────────────────────────────────
  "www",
  "api",
  "app",
  "cdn",
  "assets",
  "static",
  "media",
  "uploads",
  "files",
  "img",
  "images",
  "ns1",
  "ns2",
  "ns3",
  "mx",
  "mail",
  "email",
  "smtp",
  "imap",
  "pop",
  "pop3",
  "mta-sts",
  "ftp",
  "sftp",
  "vpn",
  "proxy",
  "gateway",
  "edge",
  "origin",
  "host",
  "server",

  // ── Environments ──────────────────────────────────────────────────
  // NB: `demo`/`test` are intentionally NOT here (see OPERATIONAL_SUBDOMAINS).
  "staging",
  "stage",
  "dev",
  "develop",
  "development",
  "preview",
  "sandbox",
  "qa",
  "uat",
  "prod",
  "production",

  // ── Platform / brand ──────────────────────────────────────────────
  "oltigo",
  "root",
  "system",
  "internal",
  "console",
  "panel",
  "portal",
  "platform",
  "core",

  // ── Auth / security ───────────────────────────────────────────────
  "admin",
  "administrator",
  "superadmin",
  "super-admin",
  "auth",
  "oauth",
  "sso",
  "login",
  "logout",
  "signin",
  "sign-in",
  "signup",
  "sign-up",
  "register",
  "account",
  "accounts",
  "secure",
  "security",
  "password",
  "reset",
  "verify",
  "verification",

  // ── Product surfaces ──────────────────────────────────────────────
  "dashboard",
  "support",
  "help",
  "helpdesk",
  "docs",
  "documentation",
  "blog",
  "news",
  "status",
  "about",
  "contact",
  "pricing",
  "billing",
  "pay",
  "payment",
  "payments",
  "checkout",
  "invoice",
  "invoices",
  "webhook",
  "webhooks",
  "callback",
  "callbacks",
  "cron",
  "jobs",
  "queue",

  // ── Observability / tooling ───────────────────────────────────────
  "sentry",
  "grafana",
  "metrics",
  "monitoring",
  "logs",
  "git",
  "ci",
  "cd",

  // ── Generic role / medical words (squatting / impersonation) ──────
  "staff",
  "team",
  "doctor",
  "doctors",
  "patient",
  "patients",
  "pharmacy",
  "pharmacist",
  "receptionist",
  "nurse",
  "clinic",
  "clinics",
  "cabinet",
  "medical",
  "health",
  "sante",
  "hopital",
  "hospital",
]);

/**
 * Maximum length of a tenant subdomain label. DNS labels max out at 63 chars;
 * we stay well under that to leave room and keep URLs readable.
 */
export const MAX_SUBDOMAIN_LENGTH = 40;
export const MIN_SUBDOMAIN_LENGTH = 3;

/**
 * True when `slug` is structurally a valid tenant subdomain label.
 *
 * Rules (Audit F-2, aligned to the RFC 1123 host-label grammar):
 *   - lowercase ASCII letters, digits, and single hyphens only
 *   - must start and end with a letter or digit
 *   - no leading/trailing hyphen, no consecutive hyphens
 *   - length between MIN_SUBDOMAIN_LENGTH and MAX_SUBDOMAIN_LENGTH
 *   - no punycode (`xn--`) — blocks IDN homograph / homoglyph attacks
 *
 * Note: the audit suggested `^[a-z]…` (must start with a letter). We allow a
 * leading digit instead, matching RFC 1123, so legitimate clinics whose name
 * starts with a number (e.g. "3M Clinique") are not rejected. Every abuse
 * vector the audit targets (reserved words, hyphen abuse, punycode, uppercase,
 * non-ASCII) is still blocked.
 *
 * This does NOT check the reserved blocklist — use {@link isReservedSubdomain}
 * or {@link assertAllowedSubdomain} for that.
 */
export function isValidSubdomainSlug(slug: string): boolean {
  if (typeof slug !== "string") return false;
  const value = slug.normalize("NFC");
  if (value.length < MIN_SUBDOMAIN_LENGTH || value.length > MAX_SUBDOMAIN_LENGTH) {
    return false;
  }
  // Punycode / IDN — reject outright to avoid homograph confusion attacks.
  if (value.includes("xn--")) return false;
  // No consecutive hyphens.
  if (value.includes("--")) return false;
  // Start/end alphanumeric, hyphens only in the middle.
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(value);
}

/**
 * True when `slug` is on the reserved blocklist (case-insensitive).
 * Operational tenants (demo/test) are never treated as reserved.
 */
export function isReservedSubdomain(slug: string): boolean {
  if (typeof slug !== "string") return false;
  const value = slug.trim().toLowerCase();
  if (OPERATIONAL_SUBDOMAINS.has(value)) return false;
  return RESERVED_SUBDOMAINS.has(value);
}

/**
 * True when `slug` may be served / registered as a tenant: structurally valid
 * AND not reserved. Operational tenants (demo/test) are allowed.
 *
 * Validity is case-sensitive — a tenant slug must already be canonical
 * lowercase (the DB trigger enforces the same), so `"BadCase"` is rejected
 * rather than silently normalized. Reserved-ness stays case-insensitive.
 */
export function isAllowedSubdomain(slug: string): boolean {
  if (typeof slug !== "string") return false;
  const value = slug.trim();
  if (OPERATIONAL_SUBDOMAINS.has(value.toLowerCase())) return true;
  return isValidSubdomainSlug(value) && !isReservedSubdomain(value);
}

/** Reason codes returned by {@link checkSubdomain}. */
export type SubdomainRejection = "invalid_format" | "reserved";

/**
 * Validate a subdomain, returning a machine-readable rejection reason or null
 * when it is allowed. Useful where you want to branch on the reason (API
 * responses, logging) instead of a thrown error.
 */
export function checkSubdomain(slug: string): SubdomainRejection | null {
  const value = (slug ?? "").trim();
  if (OPERATIONAL_SUBDOMAINS.has(value.toLowerCase())) return null;
  if (!isValidSubdomainSlug(value)) return "invalid_format";
  if (isReservedSubdomain(value)) return "reserved";
  return null;
}

/**
 * Throwing variant for code paths that should hard-fail on a bad slug
 * (e.g. just before an INSERT). The message is safe to surface to operators
 * but intentionally generic for end users.
 */
export function assertAllowedSubdomain(slug: string): void {
  const reason = checkSubdomain(slug);
  if (reason === "reserved") {
    throw new Error(`Subdomain "${slug}" is reserved and cannot be used.`);
  }
  if (reason === "invalid_format") {
    throw new Error(`Subdomain "${slug}" is not a valid tenant slug.`);
  }
}
