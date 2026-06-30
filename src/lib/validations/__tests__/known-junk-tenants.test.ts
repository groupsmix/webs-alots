/**
 * Regression lock-in for Audit F-2 (item 2): the known-junk-tenant matcher that
 * lets the super-admin "Abonnements" view separate quarantined keyboard-mash
 * (migration 00173) from real suspensions, so the suspended count stops reading
 * as catastrophic churn.
 *
 * The matcher MUST faithfully replicate the migration's SQL:
 *   lower(subdomain) = j  OR  lower(subdomain) LIKE j || '-%'
 *
 * The acceptance cases (must NOT match) are the load-bearing half: this list
 * gates how a row is *labelled*, never whether data is mutated, but a false
 * positive would still mislabel a legitimate suspended clinic as "junk".
 */
import { describe, it, expect } from "vitest";
import { KNOWN_JUNK_TENANT_SLUGS, isKnownJunkSubdomain } from "../known-junk-tenants";

describe("isKnownJunkSubdomain — matches quarantined junk (migration 00173)", () => {
  it.each([
    "aagmzzd", // exact base slug
    "aagmzzdlp", // own exact entry (NOT via the aagmzzd-% rule)
    "aagmzzdlpok", // own exact entry
    "fffffff", // single-letter mash
    "rtqz", // no-vowel mash
    "hq", // short test slug
    "test-clinic-devin", // multi-hyphen test slug
    "devin-test-clinic", // multi-hyphen test slug
  ])("matches exact slug %j", (value) => {
    expect(isKnownJunkSubdomain(value)).toBe(true);
  });

  it.each([
    "fffffff-a1b2c3", // base + generateSubdomain() suffix
    "aagmzzd-x9y8z7",
    "staf-abc123",
    "hq-000111",
    "devin-test-clinic-zz99aa",
  ])("matches base + random suffix %j", (value) => {
    expect(isKnownJunkSubdomain(value)).toBe(true);
  });

  it("is case-insensitive (mirrors SQL lower())", () => {
    expect(isKnownJunkSubdomain("AAGMZZD")).toBe(true);
    expect(isKnownJunkSubdomain("Fffffff-A1B2C3")).toBe(true);
  });
});

describe("isKnownJunkSubdomain — does NOT match legitimate / unrelated subdomains", () => {
  it.each([
    "stafford", // 'staf' + 'ford' with NO hyphen -> legit, must not match
    "aagmzzdxx", // 'aagmzzd' + 'xx' with NO hyphen -> not a listed slug
    "hquarters", // 'hq' + 'uarters' with NO hyphen
    "ahmed-benali-clinic", // real-looking name
    "cabinet-dr-ahmed",
    "clinique-dentaire-fes",
    "pharmacie-ibn-sina",
  ])("does not match %j", (value) => {
    expect(isKnownJunkSubdomain(value)).toBe(false);
  });

  it.each([null, undefined, ""])("returns false for empty input %j", (value) => {
    expect(isKnownJunkSubdomain(value)).toBe(false);
  });
});

describe("sync contract with migration 00173", () => {
  it("enumerates the exact reviewed junk set (no accidental edits)", () => {
    // If this number changes, the migration's `junk` array must change too.
    expect(KNOWN_JUNK_TENANT_SLUGS).toHaveLength(23);
    // Spot-check the overlapping-prefix trio that exercises the hyphen rule.
    expect(KNOWN_JUNK_TENANT_SLUGS).toEqual(
      expect.arrayContaining(["aagmzzd", "aagmzzdlp", "aagmzzdlpok"]),
    );
  });
});
