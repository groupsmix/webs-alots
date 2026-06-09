import { describe, it, expect } from "vitest";
import { extractRawSubdomain, extractSubdomain, isRootDomain } from "../subdomain";

describe("extractSubdomain", () => {
  it("extracts subdomain from localhost", () => {
    expect(extractSubdomain("demo.localhost")).toBe("demo");
  });

  it("extracts subdomain from localhost with port", () => {
    expect(extractSubdomain("demo.localhost:3000")).toBe("demo");
  });

  it("returns null for bare localhost", () => {
    expect(extractSubdomain("localhost")).toBe(null);
  });

  it("returns null for www.localhost", () => {
    expect(extractSubdomain("www.localhost")).toBe(null);
  });

  it("extracts subdomain from production domain", () => {
    expect(extractSubdomain("demo.example.com", "example.com")).toBe("demo");
  });

  it("returns null for root domain", () => {
    expect(extractSubdomain("example.com", "example.com")).toBe(null);
  });

  it("returns null for www subdomain", () => {
    expect(extractSubdomain("www.example.com", "example.com")).toBe(null);
  });

  it("returns null for multi-level subdomains", () => {
    expect(extractSubdomain("a.b.example.com", "example.com")).toBe(null);
  });

  it("returns null when no root domain configured", () => {
    expect(extractSubdomain("demo.example.com")).toBe(null);
  });

  it("returns null when host does not match root domain", () => {
    expect(extractSubdomain("demo.other.com", "example.com")).toBe(null);
  });

  it("handles root domain with port", () => {
    expect(extractSubdomain("demo.example.com:3000", "example.com:3000")).toBe("demo");
  });

  it("returns null for empty subdomain part", () => {
    expect(extractSubdomain(".example.com", "example.com")).toBe(null);
  });

  // F-2: reserved subdomains must NOT resolve as tenants (null), so they are
  // never served as a clinic. The hard block that stops them from instead
  // falling through to marketing lives in middleware (see extractRawSubdomain).
  it.each(["api", "admin", "mail", "auth", "login", "support", "app", "staging"])(
    "returns null for reserved subdomain %s",
    (sub) => {
      expect(extractSubdomain(`${sub}.example.com`, "example.com")).toBe(null);
    },
  );

  it("returns null for reserved subdomain on localhost", () => {
    expect(extractSubdomain("admin.localhost")).toBe(null);
  });

  // Operational subdomains (demo/test) are intentionally NOT reserved and
  // still resolve as real tenants.
  it("still resolves operational subdomains (demo/test) as tenants", () => {
    expect(extractSubdomain("demo.example.com", "example.com")).toBe("demo");
    expect(extractSubdomain("test.example.com", "example.com")).toBe("test");
  });
});

describe("extractRawSubdomain", () => {
  it("returns the raw label for a normal subdomain", () => {
    expect(extractRawSubdomain("demo.example.com", "example.com")).toBe("demo");
  });

  // The key difference from extractSubdomain: reserved labels are RETURNED
  // here (not collapsed to null), so middleware can detect a reserved host
  // and actively block it (404) instead of letting it fall through to the
  // marketing site — the phishing fix.
  it.each(["api", "admin", "mail", "auth", "login", "support", "app", "staging"])(
    "returns the raw label for reserved subdomain %s (unlike extractSubdomain)",
    (sub) => {
      expect(extractRawSubdomain(`${sub}.example.com`, "example.com")).toBe(sub);
    },
  );

  it("returns reserved label on localhost too", () => {
    expect(extractRawSubdomain("admin.localhost")).toBe("admin");
  });

  it("returns null for the root domain", () => {
    expect(extractRawSubdomain("example.com", "example.com")).toBe(null);
  });

  it("returns null for www (handled by its own redirect)", () => {
    expect(extractRawSubdomain("www.example.com", "example.com")).toBe(null);
  });

  it("returns null for multi-level subdomains", () => {
    expect(extractRawSubdomain("a.b.example.com", "example.com")).toBe(null);
  });

  it("returns null when no root domain is configured", () => {
    expect(extractRawSubdomain("api.example.com")).toBe(null);
  });

  it("returns null when host does not match root domain", () => {
    expect(extractRawSubdomain("api.other.com", "example.com")).toBe(null);
  });

  it("strips the port", () => {
    expect(extractRawSubdomain("api.example.com:3000", "example.com:3000")).toBe("api");
  });
});

describe("isRootDomain", () => {
  it("returns true for root domain", () => {
    expect(isRootDomain("example.com", "example.com")).toBe(true);
  });

  it("returns false for subdomain", () => {
    expect(isRootDomain("demo.example.com", "example.com")).toBe(false);
  });

  it("returns true for bare localhost", () => {
    expect(isRootDomain("localhost")).toBe(true);
  });

  it("returns false for subdomain on localhost", () => {
    expect(isRootDomain("demo.localhost")).toBe(false);
  });

  it("returns true for www (treated as root)", () => {
    expect(isRootDomain("www.example.com", "example.com")).toBe(true);
  });
});
