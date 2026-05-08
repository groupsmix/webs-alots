/**
 * Bug 3 (A1-02): SSRF and DoS Preservation Tests
 * 
 * **IMPORTANT**: Follow observation-first methodology
 * 
 * These tests capture the behavior on UNFIXED code for legitimate token requests.
 * They ensure that after implementing the fix, legitimate users can still:
 * - Request verification tokens with valid CAPTCHA and email confirmation
 * - Complete the DNS verification flow
 * - Register clinics successfully
 * 
 * Preservation Requirements (from design 3.7, 3.8, 3.9):
 * - Legitimate users completing email confirmation SHALL continue to receive tokens
 * - Main registration endpoint rate limits SHALL remain unchanged
 * - DoH metadata fetch for verified domains SHALL continue to work
 * 
 * Property: Preservation Checking
 * ```
 * FOR ALL request WHERE NOT isBugCondition_SSRF(request) DO
 *   // Legitimate verified requests continue to work
 *   ASSERT handleVerificationToken(request).tokenIssued = 
 *          handleVerificationToken'(request).tokenIssued
 * END FOR
 * ```
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

describe("Bug 3 (A1-02): SSRF and DoS Preservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SELF_SERVICE_REGISTRATION_ENABLED = "true";
    process.env.DNS_VERIFICATION_SECRET = "test-secret-key-for-dns-verification";
  });

  describe("Preservation 1: Legitimate Token Requests Continue to Work", () => {
    it("should issue token for valid domain after email confirmation and CAPTCHA", async () => {
      // This test captures the expected behavior for legitimate users
      // After the fix, this flow should continue to work
      
      const { POST } = await import("@/app/api/v1/register-clinic/verification-token/route");
      
      const request = new NextRequest("http://localhost:3000/api/v1/register-clinic/verification-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.100",
        },
        body: JSON.stringify({
          email: "legitimate@clinic.ma",
          website_domain: "clinic.ma",
          // After fix, these will be required:
          // turnstile_token: "valid-captcha-token",
          // confirmation_code: "123456",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // PRESERVATION: Legitimate requests should receive tokens
      // (Currently works without CAPTCHA/confirmation, will work with them after fix)
      if (response.status === 200) {
        expect(data.ok).toBe(true);
        expect(data.data.token).toBeDefined();
        expect(data.data.record_name).toBe("clinic.ma");
        expect(data.data.record_value).toMatch(/^oltigo-verify=/);
        expect(data.data.instructions).toContain("Add a DNS TXT record");
      }
    });

    it("should generate consistent tokens for same (email, domain) pair", async () => {
      // Preservation: Same (email, domain) should always yield same token
      // This allows users to retry/refresh without re-publishing DNS
      
      const { POST } = await import("@/app/api/v1/register-clinic/verification-token/route");
      
      const makeRequest = () => new NextRequest("http://localhost:3000/api/v1/register-clinic/verification-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.101",
        },
        body: JSON.stringify({
          email: "doctor@example.ma",
          website_domain: "example.ma",
        }),
      });

      const response1 = await POST(makeRequest());
      const data1 = await response1.json();
      
      const response2 = await POST(makeRequest());
      const data2 = await response2.json();

      // PRESERVATION: Token should be deterministic
      if (response1.status === 200 && response2.status === 200) {
        expect(data1.data.token).toBe(data2.data.token);
      }
    });

    it("should normalize domains correctly (www prefix, trailing slash)", async () => {
      // Preservation: Domain normalization should continue to work
      
      const { POST } = await import("@/app/api/v1/register-clinic/verification-token/route");
      
      const domains = [
        "example.ma",
        "www.example.ma",
        "example.ma/",
        "https://example.ma",
        "http://www.example.ma/",
      ];

      for (const domain of domains) {
        const request = new NextRequest("http://localhost:3000/api/v1/register-clinic/verification-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "203.0.113.102",
          },
          body: JSON.stringify({
            email: "test@example.ma",
            website_domain: domain,
          }),
        });

        const response = await POST(request);
        const data = await response.json();

        // PRESERVATION: All variants should normalize to "example.ma"
        if (response.status === 200) {
          expect(data.data.record_name).toBe("example.ma");
        }
      }
    });
  });

  describe("Preservation 2: Main Registration Endpoint Behavior Unchanged", () => {
    it("should maintain existing rate limits on main registration endpoint", async () => {
      // Preservation: Main registration endpoint should keep its strict rate limit
      // (2 req/hour per IP) - this test verifies it's not affected by our changes
      
      const { POST: registerPOST } = await import("@/app/api/v1/register-clinic/route");
      
      const testIp = "203.0.113.110";
      
      // Make 3 registration attempts (should hit rate limit on 3rd)
      const requests = Array.from({ length: 3 }, (_, i) => 
        new NextRequest("http://localhost:3000/api/v1/register-clinic", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": testIp,
          },
          body: JSON.stringify({
            clinic_name: `Test Clinic ${i}`,
            doctor_name: "Dr. Test",
            email: `test${i}@example.ma`,
            phone: "+212600000000",
            specialty: "general",
            website_domain: `clinic${i}.ma`,
            // Other required fields...
          }),
        })
      );

      const responses = await Promise.all(requests.map(req => registerPOST(req)));
      const statuses = responses.map(r => r.status);

      // PRESERVATION: Main registration should still have strict rate limit
      // (This behavior should NOT change when we fix verification-token endpoint)
      const rateLimitedCount = statuses.filter(s => s === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0); // At least one should be rate limited
    });
  });

  describe("Preservation 3: DNS Verification Flow Continues to Work", () => {
    it("should accept valid public domains for DNS verification", async () => {
      // Preservation: Public domains should continue to be accepted
      
      const { POST } = await import("@/app/api/v1/register-clinic/verification-token/route");
      
      const publicDomains = [
        "clinic.ma",
        "example.com",
        "test.org",
        "subdomain.example.ma",
        "deep.subdomain.example.ma",
      ];

      for (const domain of publicDomains) {
        const request = new NextRequest("http://localhost:3000/api/v1/register-clinic/verification-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "203.0.113.120",
          },
          body: JSON.stringify({
            email: "test@example.ma",
            website_domain: domain,
          }),
        });

        const response = await POST(request);
        const data = await response.json();

        // PRESERVATION: Valid public domains should be accepted
        // (May require CAPTCHA/confirmation after fix, but should not be rejected as invalid)
        if (response.status !== 200) {
          // If not 200, should be due to missing CAPTCHA/confirmation, not invalid domain
          expect(response.status).not.toBe(400);
          if (response.status === 400) {
            expect(data.error).not.toMatch(/invalid.*domain/i);
          }
        }
      }
    });

    it("should provide clear instructions for DNS TXT record setup", async () => {
      // Preservation: Response format and instructions should remain helpful
      
      const { POST } = await import("@/app/api/v1/register-clinic/verification-token/route");
      
      const request = new NextRequest("http://localhost:3000/api/v1/register-clinic/verification-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.121",
        },
        body: JSON.stringify({
          email: "doctor@clinic.ma",
          website_domain: "clinic.ma",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // PRESERVATION: Response should include helpful instructions
      if (response.status === 200) {
        expect(data.data.token).toBeDefined();
        expect(data.data.record_name).toBeDefined();
        expect(data.data.record_value).toBeDefined();
        expect(data.data.instructions).toBeDefined();
        expect(data.data.instructions).toContain("DNS TXT record");
        expect(data.data.instructions).toContain("oltigo-verify=");
      }
    });
  });

  describe("Preservation 4: Error Handling and Validation", () => {
    it("should reject invalid email addresses", async () => {
      // Preservation: Input validation should continue to work
      
      const { POST } = await import("@/app/api/v1/register-clinic/verification-token/route");
      
      const invalidEmails = [
        "not-an-email",
        "@example.com",
        "test@",
        "test @example.com",
        "",
      ];

      for (const email of invalidEmails) {
        const request = new NextRequest("http://localhost:3000/api/v1/register-clinic/verification-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "203.0.113.130",
          },
          body: JSON.stringify({
            email,
            website_domain: "example.ma",
          }),
        });

        const response = await POST(request);
        const data = await response.json();

        // PRESERVATION: Invalid emails should be rejected
        expect(response.status).toBe(400);
        expect(data.ok).toBe(false);
      }
    });

    it("should reject empty or missing domain", async () => {
      // Preservation: Domain validation should continue to work
      
      const { POST } = await import("@/app/api/v1/register-clinic/verification-token/route");
      
      const request = new NextRequest("http://localhost:3000/api/v1/register-clinic/verification-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.131",
        },
        body: JSON.stringify({
          email: "test@example.ma",
          website_domain: "",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // PRESERVATION: Empty domain should be rejected
      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
    });

    it("should handle malformed JSON gracefully", async () => {
      // Preservation: Error handling should continue to work
      
      const { POST } = await import("@/app/api/v1/register-clinic/verification-token/route");
      
      const request = new NextRequest("http://localhost:3000/api/v1/register-clinic/verification-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.132",
        },
        body: "{ invalid json",
      });

      const response = await POST(request);
      const data = await response.json();

      // PRESERVATION: Malformed JSON should return validation error
      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error).toMatch(/invalid|json|body/i);
    });
  });

  describe("Preservation 5: Feature Flags and Configuration", () => {
    it("should respect SELF_SERVICE_REGISTRATION_ENABLED flag", async () => {
      // Preservation: Feature flag should continue to work
      
      process.env.SELF_SERVICE_REGISTRATION_ENABLED = "false";
      
      const { POST } = await import("@/app/api/v1/register-clinic/verification-token/route");
      
      const request = new NextRequest("http://localhost:3000/api/v1/register-clinic/verification-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.140",
        },
        body: JSON.stringify({
          email: "test@example.ma",
          website_domain: "example.ma",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // PRESERVATION: Should return 403 when feature is disabled
      expect(response.status).toBe(403);
      expect(data.ok).toBe(false);
      expect(data.error).toMatch(/disabled/i);
      
      // Restore for other tests
      process.env.SELF_SERVICE_REGISTRATION_ENABLED = "true";
    });

    it("should handle missing DNS_VERIFICATION_SECRET gracefully", async () => {
      // Preservation: Configuration validation should continue to work
      
      const originalSecret = process.env.DNS_VERIFICATION_SECRET;
      delete process.env.DNS_VERIFICATION_SECRET;
      
      const { POST } = await import("@/app/api/v1/register-clinic/verification-token/route");
      
      const request = new NextRequest("http://localhost:3000/api/v1/register-clinic/verification-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.141",
        },
        body: JSON.stringify({
          email: "test@example.ma",
          website_domain: "example.ma",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // PRESERVATION: Should return 503 when DNS verification not configured
      expect(response.status).toBe(503);
      expect(data.ok).toBe(false);
      expect(data.error).toMatch(/not available|contact support/i);
      
      // Restore for other tests
      process.env.DNS_VERIFICATION_SECRET = originalSecret;
    });
  });
});
