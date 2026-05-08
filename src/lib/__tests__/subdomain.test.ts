import { describe, it, expect } from "vitest";
import { extractSubdomain, isRootDomain } from "../subdomain";

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
