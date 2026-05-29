/**
 * Subdomain slug generation tests.
 *
 * Exercises the real `generateSubdomain` from `../generate-subdomain`:
 * diacritic stripping, prefix removal, non-alphanumeric collapsing, the
 * empty-name fallback, length capping, and the random anti-enumeration
 * suffix (CVE-003).
 */
import { describe, it, expect } from "vitest";
import { generateSubdomain } from "../generate-subdomain";

/** Split the trailing `-suffix` the function appends. */
function parts(value: string): { base: string; suffix: string } {
  const idx = value.lastIndexOf("-");
  return { base: value.slice(0, idx), suffix: value.slice(idx + 1) };
}

describe("generateSubdomain", () => {
  it("appends a random alphanumeric suffix", () => {
    const { suffix } = parts(generateSubdomain("Dr Ahmed"));
    expect(suffix).toMatch(/^[a-z0-9]{1,6}$/);
  });

  it("produces unique outputs for the same name (random suffix)", () => {
    expect(generateSubdomain("Dr Ahmed")).not.toBe(generateSubdomain("Dr Ahmed"));
  });

  it("strips diacritics and lowercases", () => {
    expect(parts(generateSubdomain("Clinique Dentaire Fès")).base).toBe("dentaire-fes");
  });

  it("strips common French prefixes when the remainder is meaningful", () => {
    expect(parts(generateSubdomain("Cabinet Dr Ahmed")).base).toBe("dr-ahmed");
    expect(parts(generateSubdomain("Pharmacie Ibn Sina")).base).toBe("ibn-sina");
  });

  it("keeps a short prefix-only name rather than stripping it away", () => {
    // "cabinet" alone is not long enough past the prefix to strip.
    expect(parts(generateSubdomain("Cabinet")).base).toBe("cabinet");
  });

  it("collapses runs of non-alphanumeric characters into single hyphens", () => {
    expect(parts(generateSubdomain("Dr.  Fatima   El  Amrani")).base).toBe("dr-fatima-el-amrani");
  });

  it("falls back to 'clinic' for a name with no usable characters", () => {
    expect(parts(generateSubdomain("!!! @@@")).base).toBe("clinic");
  });

  it("caps the slug base at 40 characters", () => {
    const { base } = parts(generateSubdomain("a".repeat(80)));
    expect(base.length).toBeLessThanOrEqual(40);
  });
});
