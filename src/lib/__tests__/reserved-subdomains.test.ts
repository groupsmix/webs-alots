/**
 * Regression lock-in for Audit F-2.
 *
 * These assert the shared reserved/slug rules so a future change can't silently
 * let `admin.oltigo.com`, punycode homographs, or malformed slugs back in.
 */
import { describe, it, expect } from "vitest";
import {
  assertAllowedSubdomain,
  checkSubdomain,
  isAllowedSubdomain,
  isReservedSubdomain,
  isValidSubdomainSlug,
  OPERATIONAL_SUBDOMAINS,
  RESERVED_SUBDOMAINS,
} from "../reserved-subdomains";

describe("isValidSubdomainSlug", () => {
  it.each([
    "dr-ahmed",
    "clinique-dentaire-fes",
    "dr-ahmed-x7k2p9",
    "3m-clinique", // RFC 1123: a leading digit is allowed
    "cabinet123",
    "abc",
  ])("accepts valid slug %s", (slug) => {
    expect(isValidSubdomainSlug(slug)).toBe(true);
  });

  it.each([
    ["", "empty"],
    ["ab", "too short (< 3)"],
    ["a".repeat(41), "too long (> 40)"],
    ["-leading", "leading hyphen"],
    ["trailing-", "trailing hyphen"],
    ["double--hyphen", "consecutive hyphens"],
    ["UPPER", "uppercase"],
    ["café", "non-ASCII"],
    ["xn--80ak6aa92e", "punycode"],
    ["has space", "whitespace"],
    ["under_score", "underscore"],
  ])("rejects %s (%s)", (slug) => {
    expect(isValidSubdomainSlug(slug)).toBe(false);
  });
});

describe("isReservedSubdomain", () => {
  it.each(["admin", "api", "www", "staging", "mail", "auth", "oltigo", "webhook", "billing"])(
    "treats %s as reserved",
    (slug) => {
      expect(isReservedSubdomain(slug)).toBe(true);
    },
  );

  it("is case-insensitive", () => {
    expect(isReservedSubdomain("ADMIN")).toBe(true);
    expect(isReservedSubdomain("Api")).toBe(true);
  });

  it("never treats operational tenants (demo/test) as reserved", () => {
    expect(isReservedSubdomain("demo")).toBe(false);
    expect(isReservedSubdomain("test")).toBe(false);
  });

  it("does not treat normal clinic slugs as reserved", () => {
    expect(isReservedSubdomain("dr-ahmed")).toBe(false);
    expect(isReservedSubdomain("clinique-dentaire-fes")).toBe(false);
  });

  it("keeps the operational and reserved sets disjoint", () => {
    for (const op of OPERATIONAL_SUBDOMAINS) {
      expect(RESERVED_SUBDOMAINS.has(op)).toBe(false);
    }
  });
});

describe("isAllowedSubdomain", () => {
  it("allows valid, non-reserved slugs", () => {
    expect(isAllowedSubdomain("dr-ahmed-x7k2p9")).toBe(true);
  });

  it("allows operational tenants demo/test", () => {
    expect(isAllowedSubdomain("demo")).toBe(true);
    expect(isAllowedSubdomain("test")).toBe(true);
  });

  it("blocks reserved subdomains", () => {
    for (const slug of ["admin", "api", "www", "mail", "auth"]) {
      expect(isAllowedSubdomain(slug)).toBe(false);
    }
  });

  it("blocks malformed slugs (uppercase, punycode, hyphen abuse)", () => {
    for (const slug of ["BadCase", "xn--abc", "--bad", "a"]) {
      expect(isAllowedSubdomain(slug)).toBe(false);
    }
  });
});

describe("checkSubdomain", () => {
  it("returns 'reserved' for reserved words", () => {
    expect(checkSubdomain("admin")).toBe("reserved");
  });

  it("returns 'invalid_format' for malformed slugs", () => {
    expect(checkSubdomain("xn--abc")).toBe("invalid_format");
    expect(checkSubdomain("BadCase")).toBe("invalid_format");
  });

  it("returns null for allowed slugs and operational tenants", () => {
    expect(checkSubdomain("dr-ahmed-x7k2p9")).toBeNull();
    expect(checkSubdomain("demo")).toBeNull();
  });
});

describe("assertAllowedSubdomain", () => {
  it("throws for reserved and malformed slugs", () => {
    expect(() => assertAllowedSubdomain("admin")).toThrow(/reserved/i);
    expect(() => assertAllowedSubdomain("xn--abc")).toThrow(/valid/i);
  });

  it("does not throw for allowed slugs or operational tenants", () => {
    expect(() => assertAllowedSubdomain("dr-ahmed-x7k2p9")).not.toThrow();
    expect(() => assertAllowedSubdomain("demo")).not.toThrow();
  });
});
