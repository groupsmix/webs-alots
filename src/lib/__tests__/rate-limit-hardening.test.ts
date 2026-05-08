/**
 * Unit tests for Task 3.4: Public Endpoint Hardening (A36)
 * 
 * Tests IP validation and global rate-limit fallback functionality.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { extractClientIp, rateLimitRules, TRUSTED_PROXIES } from "@/lib/rate-limit";
import { NextRequest } from "next/server";

describe("Task 3.4: Public Endpoint Hardening", () => {
  describe("TRUSTED_PROXIES constant", () => {
    it("should include Cloudflare IPv4 ranges", () => {
      expect(TRUSTED_PROXIES).toContain("103.21.244.0/22");
      expect(TRUSTED_PROXIES).toContain("104.16.0.0/13");
      expect(TRUSTED_PROXIES).toContain("172.64.0.0/13");
    });

    it("should include Cloudflare IPv6 ranges", () => {
      expect(TRUSTED_PROXIES).toContain("2400:cb00::/32");
      expect(TRUSTED_PROXIES).toContain("2606:4700::/32");
    });

    it("should have at least 20 IP ranges", () => {
      expect(TRUSTED_PROXIES.length).toBeGreaterThanOrEqual(20);
    });
  });

  describe("IP extraction with CF-Connecting-IP validation", () => {
    it("should prioritize CF-Connecting-IP header", () => {
      const request = new NextRequest("https://example.com/api/test", {
        headers: {
          "cf-connecting-ip": "203.0.113.1",
          "x-forwarded-for": "198.51.100.1, 192.0.2.1",
          "x-real-ip": "198.51.100.2",
        },
      });

      const ip = extractClientIp(request);
      expect(ip).toBe("203.0.113.1");
    });

    it("should fall back to X-Forwarded-For when CF-Connecting-IP is absent", () => {
      const request = new NextRequest("https://example.com/api/test", {
        headers: {
          "x-forwarded-for": "198.51.100.1, 192.0.2.1",
          "x-real-ip": "198.51.100.2",
        },
      });

      const ip = extractClientIp(request);
      expect(ip).toBe("198.51.100.1");
    });

    it("should fall back to X-Real-IP when CF-Connecting-IP and XFF are absent", () => {
      const request = new NextRequest("https://example.com/api/test", {
        headers: {
          "x-real-ip": "198.51.100.2",
        },
      });

      const ip = extractClientIp(request);
      expect(ip).toBe("198.51.100.2");
    });

    it("should return 'unknown' when no IP headers are present", () => {
      const request = new NextRequest("https://example.com/api/test");

      const ip = extractClientIp(request);
      expect(ip).toBe("unknown");
    });

    it("should reject obviously forged IP values (control characters)", () => {
      const request = new NextRequest("https://example.com/api/test", {
        headers: {
          "x-forwarded-for": "198.51.100.1\x00malicious",
        },
      });

      const ip = extractClientIp(request);
      expect(ip).toBe("unknown");
    });

    it("should reject overly long IP strings", () => {
      const request = new NextRequest("https://example.com/api/test", {
        headers: {
          "x-forwarded-for": "a".repeat(100),
        },
      });

      const ip = extractClientIp(request);
      expect(ip).toBe("unknown");
    });

    it("should accept valid IPv6 addresses", () => {
      const request = new NextRequest("https://example.com/api/test", {
        headers: {
          "x-forwarded-for": "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
        },
      });

      const ip = extractClientIp(request);
      expect(ip).toBe("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
    });

    it("should accept valid IPv4 addresses", () => {
      const request = new NextRequest("https://example.com/api/test", {
        headers: {
          "x-forwarded-for": "192.168.1.1",
        },
      });

      const ip = extractClientIp(request);
      expect(ip).toBe("192.168.1.1");
    });

    it("should reject IP values with protocol prefixes", () => {
      const request = new NextRequest("https://example.com/api/test", {
        headers: {
          "x-forwarded-for": "http://198.51.100.1",
        },
      });

      const ip = extractClientIp(request);
      expect(ip).toBe("unknown");
    });

    it("should handle empty X-Forwarded-For header", () => {
      const request = new NextRequest("https://example.com/api/test", {
        headers: {
          "x-forwarded-for": "",
        },
      });

      const ip = extractClientIp(request);
      expect(ip).toBe("unknown");
    });

    it("should handle X-Forwarded-For with only commas", () => {
      const request = new NextRequest("https://example.com/api/test", {
        headers: {
          "x-forwarded-for": ",,,",
        },
      });

      const ip = extractClientIp(request);
      expect(ip).toBe("unknown");
    });
  });

  describe("Global rate-limit fallback", () => {
    it("should have a /* catch-all rule at the end of rateLimitRules", () => {
      const catchAllRule = rateLimitRules.find((rule) => rule.prefix === "/*");
      expect(catchAllRule).toBeDefined();
      expect(catchAllRule?.max).toBe(100);
      expect(catchAllRule?.windowMs).toBe(60_000);
    });

    it("should have /* rule as the last rule (lowest priority)", () => {
      const lastRule = rateLimitRules[rateLimitRules.length - 1];
      expect(lastRule?.prefix).toBe("/*");
    });

    it("should have more specific rules before the catch-all", () => {
      const apiAuthIndex = rateLimitRules.findIndex((r) => r.prefix === "/api/auth/");
      const catchAllIndex = rateLimitRules.findIndex((r) => r.prefix === "/*");
      
      expect(apiAuthIndex).toBeGreaterThanOrEqual(0);
      expect(catchAllIndex).toBeGreaterThanOrEqual(0);
      expect(apiAuthIndex).toBeLessThan(catchAllIndex);
    });

    it("should ensure no endpoint is unprotected by rate limiting", () => {
      // The /* rule ensures that even if all other rules are removed,
      // there's still a global rate limit in place
      const catchAllRule = rateLimitRules.find((rule) => rule.prefix === "/*");
      expect(catchAllRule).toBeDefined();
      expect(catchAllRule?.limiter).toBeDefined();
    });
  });

  describe("Rate limit rule ordering", () => {
    it("should match specific rules before general rules", () => {
      // More specific rules should come before less specific ones
      const authIndex = rateLimitRules.findIndex((r) => r.prefix === "/api/auth/");
      const apiIndex = rateLimitRules.findIndex((r) => r.prefix === "/api/");
      const catchAllIndex = rateLimitRules.findIndex((r) => r.prefix === "/*");

      expect(authIndex).toBeLessThan(apiIndex);
      expect(apiIndex).toBeLessThan(catchAllIndex);
    });

    it("should have all API-specific rules before the /api/ catch-all", () => {
      const apiCatchAllIndex = rateLimitRules.findIndex((r) => r.prefix === "/api/");
      
      const specificApiRules = [
        "/api/auth/",
        "/api/v1/register-clinic",
        "/api/checkin",
        "/api/booking/waiting-list",
        "/api/book",
        "/api/upload",
        "/api/chat",
        "/api/webhooks",
      ];

      specificApiRules.forEach((prefix) => {
        const ruleIndex = rateLimitRules.findIndex((r) => r.prefix === prefix);
        expect(ruleIndex).toBeGreaterThanOrEqual(0);
        expect(ruleIndex).toBeLessThan(apiCatchAllIndex);
      });
    });
  });
});
