/**
 * Audit F-2 (item 2 — "Sitemap still contains 25+ junk tenants"): the
 * authoritative, human-reviewed list of historical junk / test tenants that
 * migration `00173_quarantine_known_junk_tenants.sql` suspended.
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * Migration 00173 quarantined these tenants by setting `status = 'suspended'`
 * (reversible, not deleted) — but it added NO tag, reason column, or flag to
 * distinguish "suspended because it's quarantined junk" from "suspended for a
 * legitimate business reason". As a result the super-admin "Abonnements" view
 * shows a suspended count dominated by keyboard-mash, which reads as
 * catastrophic churn (the audit observed ~74%) when it is actually test cruft.
 *
 * This module re-exposes the migration's exact, reviewed enumeration to the
 * application layer so the UI can label those rows as "quarantined" rather than
 * counting them as real suspensions. It is NOT a heuristic and NOT a spelling
 * guess: suspending or re-labelling real user data on a guess is unacceptable
 * (see name-quality.ts, which deliberately refuses to judge short real names).
 * The only safe signal is this same explicit list the migration itself used.
 *
 * SYNC CONTRACT
 * -------------
 * `KNOWN_JUNK_TENANT_SLUGS` MUST stay byte-for-byte in sync with the `junk`
 * array in `supabase/migrations/00173_quarantine_known_junk_tenants.sql`. The
 * regression test in `__tests__/known-junk-tenants.test.ts` locks the matching
 * behaviour; if the migration list ever changes, update both together.
 *
 * MATCHING — mirrors the migration's SQL exactly:
 *   lower(subdomain) = j  OR  lower(subdomain) LIKE j || '-%'
 * i.e. an exact base-slug match, OR the base slug followed by a literal hyphen
 * and the random 6-char suffix that `generateSubdomain()` appends
 * (e.g. `fffffff-a1b2c3`). The hyphen is required, so `staf` matches but
 * `stafford` does not, and `aagmzzdlp` matches only via its own exact entry
 * (never via the `aagmzzd-%` rule, which needs a hyphen after `aagmzzd`).
 *
 * Pure + side-effect free.
 */

/**
 * Exact junk/test base slugs called out in the 2026-06-09 audit and quarantined
 * by migration 00173. Keep in sync with that migration's `junk` array.
 */
export const KNOWN_JUNK_TENANT_SLUGS: readonly string[] = [
  "ahhhhhe",
  "fffffff",
  "jgjjrjrj",
  "abod",
  "cabinite",
  "kjook",
  "vdsvv",
  "rtqz",
  "staf",
  "saara",
  "aagmzzd",
  "aagmzzdlp",
  "aagmzzdlpok",
  "ahmedlokf",
  "ahmed151",
  "ahmed15153",
  "azar",
  "azarr",
  "hq",
  "test-clinic-devin",
  "testclinic",
  "testclinic2",
  "devin-test-clinic",
] as const;

const JUNK_SLUG_SET: ReadonlySet<string> = new Set(KNOWN_JUNK_TENANT_SLUGS);

/**
 * True when `subdomain` is one of the known-junk tenants quarantined by
 * migration 00173. Faithfully replicates the migration's SQL match:
 * `lower(subdomain) = j OR lower(subdomain) LIKE j || '-%'`.
 *
 * Returns false for null/undefined/empty input (a tenant with no subdomain
 * cannot be one of the named junk slugs).
 */
export function isKnownJunkSubdomain(subdomain: string | null | undefined): boolean {
  if (!subdomain) return false;
  const s = subdomain.toLowerCase();
  if (JUNK_SLUG_SET.has(s)) return true;
  for (const slug of KNOWN_JUNK_TENANT_SLUGS) {
    // `LIKE slug || '-%'` — base slug followed by a literal hyphen + suffix.
    if (s.startsWith(`${slug}-`)) return true;
  }
  return false;
}
