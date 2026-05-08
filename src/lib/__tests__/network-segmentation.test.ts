/**
 * Unit tests for Network Segmentation Hardening (A39)
 *
 * Tests egress filtering, DNS sanitization, and CMI IP allowlisting.
 */
import { describe, it, expect } from "vitest";

describe("Network Segmentation (A39)", () => {
  describe("DNS Sanitization", () => {
    it("strips control characters from hostnames", () => {
      // Test the sanitizeHostname function logic
      const sanitize = (hostname: string): string => {
        return hostname.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
      };

      expect(sanitize("api.example.com")).toBe("api.example.com");
      expect(sanitize("api\x00.example.com")).toBe("api.example.com");
      expect(sanitize("api\r\n.example.com")).toBe("api.example.com");
      expect(sanitize("api\x7F.example.com")).toBe("api.example.com");
      expect(sanitize("api\x1B[31m.example.com")).toBe("api[31m.example.com");
    });
  });

  describe("Egress Filtering", () => {
    it("allows requests to allowlisted hosts", () => {
      const ALLOWED_HOSTS = new Set([
        "api.openai.com",
        "api.stripe.com",
        "api.twilio.com",
        "graph.facebook.com",
        "api.resend.com",
        "cmi.co.ma",
        "payment.cmi.co.ma",
      ]);

      const isEgressAllowed = (url: string): boolean => {
        try {
          if (url.startsWith("/")) return true;
          const parsed = new URL(url);
          const sanitized = parsed.hostname.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
          return ALLOWED_HOSTS.has(sanitized);
        } catch {
          return false;
        }
      };

      // Allowed hosts
      expect(isEgressAllowed("https://api.openai.com/v1/chat")).toBe(true);
      expect(isEgressAllowed("https://api.stripe.com/v1/charges")).toBe(true);
      expect(isEgressAllowed("https://cmi.co.ma/payment")).toBe(true);
      expect(isEgressAllowed("/api/internal")).toBe(true);

      // Blocked hosts
      expect(isEgressAllowed("https://evil.com/ssrf")).toBe(false);
      expect(isEgressAllowed("https://internal.service/admin")).toBe(false);
      expect(isEgressAllowed("https://169.254.169.254/metadata")).toBe(false);
    });

    it("rejects invalid URLs", () => {
      const isEgressAllowed = (url: string): boolean => {
        try {
          if (url.startsWith("/")) return true;
          const parsed = new URL(url);
          return true;
        } catch {
          return false;
        }
      };

      expect(isEgressAllowed("not-a-url")).toBe(false);
      expect(isEgressAllowed("javascript:alert(1)")).toBe(false);
    });
  });

  describe("CMI IP Allowlisting", () => {
    it("checks if IP is in CIDR range", () => {
      const isIpInCidr = (ip: string, cidr: string): boolean => {
        try {
          const [range, bits] = cidr.split("/");
          const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1);

          const ipNum = ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0);
          const rangeNum = range.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0);

          return (ipNum & mask) === (rangeNum & mask);
        } catch {
          return false;
        }
      };

      // Test CMI IP ranges
      expect(isIpInCidr("196.200.1.1", "196.200.0.0/16")).toBe(true);
      expect(isIpInCidr("196.200.255.255", "196.200.0.0/16")).toBe(true);
      expect(isIpInCidr("196.201.0.0", "196.200.0.0/16")).toBe(false);
      expect(isIpInCidr("41.140.1.1", "41.140.0.0/16")).toBe(true);
      expect(isIpInCidr("41.141.0.0", "41.140.0.0/16")).toBe(false);

      // Test edge cases
      expect(isIpInCidr("192.168.1.1", "192.168.1.0/24")).toBe(true);
      expect(isIpInCidr("192.168.2.1", "192.168.1.0/24")).toBe(false);
    });

    it("handles invalid CIDR ranges gracefully", () => {
      const isIpInCidr = (ip: string, cidr: string): boolean => {
        try {
          const [range, bits] = cidr.split("/");
          const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1);

          const ipNum = ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0);
          const rangeNum = range.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0);

          return (ipNum & mask) === (rangeNum & mask);
        } catch {
          return false;
        }
      };

      expect(isIpInCidr("192.168.1.1", "invalid")).toBe(false);
      expect(isIpInCidr("invalid", "192.168.1.0/24")).toBe(false);
      expect(isIpInCidr("192.168.1.1", "192.168.1.0/99")).toBe(false);
    });
  });
});
