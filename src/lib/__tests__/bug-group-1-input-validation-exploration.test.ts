/**
 * Bug Group 1: Input Validation and Injection Prevention
 * 
 * Bug Condition Exploration Test
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms bugs exist.
 * **DO NOT attempt to fix the test or the code when it fails.**
 * 
 * This test encodes the expected behavior after the fix is implemented.
 * When this test passes after implementing the fix, it confirms the bugs are resolved.
 * 
 * Covers:
 * - A1-03 (LOW): Slack markdown injection in registration notifications
 * - A1-04 (LOW): Open redirect surface in CMI payment URLs
 * - S5-06 (MEDIUM): Blog XSS - sanitize-html.ts not safe for user input
 * 
 * Bug Condition Functions:
 * ```
 * FUNCTION isBugCondition_SlackInjection(clinic_name)
 *   INPUT: clinic_name of type string
 *   OUTPUT: boolean
 *   
 *   RETURN clinic_name CONTAINS "<!channel>" OR
 *          clinic_name CONTAINS "<!here>" OR
 *          clinic_name CONTAINS "<@U" OR
 *          clinic_name CONTAINS "<http" AND
 *          slackMessage CONTAINS UNESCAPED clinic_name
 * END FUNCTION
 * 
 * FUNCTION isBugCondition_CMIOpenRedirect(success_url)
 *   INPUT: success_url of type string
 *   OUTPUT: boolean
 *   
 *   RETURN NOT isAllowlistedHostname(success_url) AND
 *          cmiPaymentRequest.successUrl = success_url
 * END FUNCTION
 * 
 * FUNCTION isBugCondition_BlogXSS(html_content)
 *   INPUT: html_content of type string
 *   OUTPUT: boolean
 *   
 *   RETURN sanitizer = "sanitize-html" AND
 *          NOT sanitizer = "DOMPurify"
 * END FUNCTION
 * ```
 * 
 * Expected Behavior Properties (from design 1.1, 1.2, 1.3):
 * - Property 1.1: System SHALL escape markdown special characters in Slack notifications
 * - Property 1.2: System SHALL validate CMI callback URLs against allowlist
 * - Property 1.3: System SHALL use DOMPurify for HTML sanitization
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3**
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { escapeSlackMrkdwn } from "@/lib/escape-slack";
import { createCmiPayment } from "@/lib/cmi";
import { sanitizeHtml } from "@/lib/sanitize-html";

describe("Bug Group 1: Input Validation Exploration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Bug Condition 1: Slack Markdown Injection (A1-03)", () => {
    it("should escape <!channel> mention in clinic name (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Test data with Slack mention injection
      const maliciousClinicName = "Test Clinic <!channel>";
      
      // EXPECTED BEHAVIOR AFTER FIX: Special characters should be escaped
      const escaped = escapeSlackMrkdwn(maliciousClinicName);
      
      // The escaped output should NOT contain the raw <!channel> mention
      // It should be escaped to &lt;!channel&gt;
      expect(escaped).not.toContain("<!channel>");
      expect(escaped).toContain("&lt;!channel&gt;");
    });

    it("should escape <!here> mention in doctor name (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      const maliciousDoctorName = "Dr. Evil <!here>";
      
      const escaped = escapeSlackMrkdwn(maliciousDoctorName);
      
      expect(escaped).not.toContain("<!here>");
      expect(escaped).toContain("&lt;!here&gt;");
    });

    it("should escape user mention <@U123> in specialty (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      const maliciousSpecialty = "Cardiology <@U123456>";
      
      const escaped = escapeSlackMrkdwn(maliciousSpecialty);
      
      expect(escaped).not.toContain("<@U123456>");
      expect(escaped).toContain("&lt;@U123456&gt;");
    });

    it("should escape link injection <https://evil.com|click> (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      const maliciousEmail = "test@clinic.ma <https://evil.com|click here>";
      
      const escaped = escapeSlackMrkdwn(maliciousEmail);
      
      // Should not contain unescaped angle brackets
      expect(escaped).not.toMatch(/<https:\/\/[^>]+>/);
      expect(escaped).toContain("&lt;https://evil.com|click here&gt;");
    });

    it("should escape ampersand before angle brackets (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Test that & is escaped first to prevent double-encoding
      const input = "Test & <script>";
      
      const escaped = escapeSlackMrkdwn(input);
      
      // Should be: "Test &amp; &lt;script&gt;"
      // NOT: "Test &amp;amp; &amp;lt;script&amp;gt;" (double-encoded)
      expect(escaped).toBe("Test &amp; &lt;script&gt;");
    });

    it("should handle null and undefined inputs gracefully (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      expect(escapeSlackMrkdwn(null)).toBe("");
      expect(escapeSlackMrkdwn(undefined)).toBe("");
    });
  });

  describe("Bug Condition 2: CMI Open Redirect (A1-04)", () => {
    beforeEach(() => {
      // Set up CMI configuration
      vi.stubEnv("CMI_MERCHANT_ID", "test-merchant");
      vi.stubEnv("CMI_SECRET_KEY", "test-secret-key-for-hmac-signing");
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("should REJECT non-allowlisted hostname in success_url (EXPECTED TO FAIL ON UNFIXED CODE)", async () => {
      // Attacker tries to redirect to their own domain
      const maliciousRequest = {
        amount: 100,
        orderId: "order-123",
        successUrl: "https://evil.com/steal-tokens",
        failUrl: "https://payment.cmi.co.ma/fail",
        callbackUrl: "https://myapp.com/api/webhooks/cmi",
      };

      // EXPECTED BEHAVIOR AFTER FIX: Should reject or sanitize non-allowlisted URLs
      // CURRENT BEHAVIOR (UNFIXED): Accepts any URL without validation
      const result = await createCmiPayment(maliciousRequest);
      
      // After fix, this should either:
      // 1. Return success: false with error about invalid URL
      // 2. Sanitize the URL to a safe default
      // 3. Throw an error
      
      // For now, we expect the function to validate and reject
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/allowlist|invalid|not permitted|hostname/i);
    });

    it("should REJECT non-allowlisted hostname in fail_url (EXPECTED TO FAIL ON UNFIXED CODE)", async () => {
      const maliciousRequest = {
        amount: 100,
        orderId: "order-124",
        successUrl: "https://payment.cmi.co.ma/success",
        failUrl: "https://attacker.com/phishing",
        callbackUrl: "https://myapp.com/api/webhooks/cmi",
      };

      const result = await createCmiPayment(maliciousRequest);
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/allowlist|invalid|not permitted|hostname/i);
    });

    it("should ACCEPT allowlisted CMI hostname (EXPECTED TO FAIL ON UNFIXED CODE)", async () => {
      // Valid CMI payment gateway URL
      const validRequest = {
        amount: 100,
        orderId: "order-125",
        successUrl: "https://payment.cmi.co.ma/success",
        failUrl: "https://payment.cmi.co.ma/fail",
        callbackUrl: "https://myapp.com/api/webhooks/cmi",
      };

      const result = await createCmiPayment(validRequest);
      
      // Should succeed for allowlisted hostname
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should ACCEPT allowlisted test CMI hostname (EXPECTED TO FAIL ON UNFIXED CODE)", async () => {
      const validRequest = {
        amount: 100,
        orderId: "order-126",
        successUrl: "https://testpayment.cmi.co.ma/success",
        failUrl: "https://testpayment.cmi.co.ma/fail",
        callbackUrl: "https://myapp.com/api/webhooks/cmi",
      };

      const result = await createCmiPayment(validRequest);
      
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should REJECT localhost redirect attempt (EXPECTED TO FAIL ON UNFIXED CODE)", async () => {
      const maliciousRequest = {
        amount: 100,
        orderId: "order-127",
        successUrl: "http://localhost:3000/admin",
        failUrl: "https://payment.cmi.co.ma/fail",
        callbackUrl: "https://myapp.com/api/webhooks/cmi",
      };

      const result = await createCmiPayment(maliciousRequest);
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/allowlist|invalid|not permitted|hostname/i);
    });

    it("should REJECT private IP redirect attempt (EXPECTED TO FAIL ON UNFIXED CODE)", async () => {
      const maliciousRequest = {
        amount: 100,
        orderId: "order-128",
        successUrl: "http://192.168.1.1/admin",
        failUrl: "https://payment.cmi.co.ma/fail",
        callbackUrl: "https://myapp.com/api/webhooks/cmi",
      };

      const result = await createCmiPayment(maliciousRequest);
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/allowlist|invalid|not permitted|hostname/i);
    });

    it("should REJECT subdomain takeover attempt (EXPECTED TO FAIL ON UNFIXED CODE)", async () => {
      // Attacker registers evil.cmi.co.ma or cmi.co.ma.evil.com
      const maliciousRequest = {
        amount: 100,
        orderId: "order-129",
        successUrl: "https://cmi.co.ma.evil.com/steal",
        failUrl: "https://payment.cmi.co.ma/fail",
        callbackUrl: "https://myapp.com/api/webhooks/cmi",
      };

      const result = await createCmiPayment(maliciousRequest);
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/allowlist|invalid|not permitted|hostname/i);
    });
  });

  describe("Bug Condition 3: Blog XSS - sanitize-html.ts not safe (S5-06)", () => {
    it("should use DOMPurify (not sanitize-html library) (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // This test verifies that we're using DOMPurify, not the "sanitize-html" library
      // which has a warning: "not safe for user input"
      
      // Test with a known XSS payload
      const xssPayload = '<img src=x onerror="alert(1)">';
      
      const sanitized = sanitizeHtml(xssPayload);
      
      // DOMPurify should strip the onerror handler
      expect(sanitized.toLowerCase()).not.toContain("onerror");
      expect(sanitized.toLowerCase()).not.toContain("alert(1)");
    });

    it("should strip script tags using DOMPurify (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      const xssPayload = '<p>Safe content</p><script>alert("XSS")</script>';
      
      const sanitized = sanitizeHtml(xssPayload);
      
      expect(sanitized.toLowerCase()).not.toContain("<script");
      expect(sanitized.toLowerCase()).not.toContain("alert");
      expect(sanitized).toContain("<p>Safe content</p>");
    });

    it("should strip nested script bypass (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Regex-based sanitizers can be bypassed with nested tags
      const xssPayload = '<scr<script>ipt>alert(1)</script>ipt>';
      
      const sanitized = sanitizeHtml(xssPayload);
      
      expect(sanitized.toLowerCase()).not.toContain("<script");
      expect(sanitized.toLowerCase()).not.toContain("</script");
    });

    it("should strip javascript: URLs (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      const xssPayload = '<a href="javascript:alert(1)">Click me</a>';
      
      const sanitized = sanitizeHtml(xssPayload);
      
      expect(sanitized.toLowerCase()).not.toContain("javascript:");
    });

    it("should strip data: URLs from links (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // data:text/html URLs can execute arbitrary HTML/JS
      const xssPayload = '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Click</a>';
      
      const sanitized = sanitizeHtml(xssPayload);
      
      expect(sanitized.toLowerCase()).not.toContain("data:text/html");
    });

    it("should strip SVG with onload handler (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      const xssPayload = '<svg onload="alert(1)"></svg>';
      
      const sanitized = sanitizeHtml(xssPayload);
      
      expect(sanitized.toLowerCase()).not.toContain("onload");
      expect(sanitized.toLowerCase()).not.toContain("alert(1)");
    });

    it("should strip event handlers with whitespace bypass (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Regex sanitizers can be bypassed with tabs/newlines around =
      const xssPayload = '<img src="x" onerror\n=\t"alert(1)" />';
      
      const sanitized = sanitizeHtml(xssPayload);
      
      expect(sanitized.toLowerCase()).not.toContain("onerror");
      expect(sanitized.toLowerCase()).not.toContain("alert(1)");
    });

    it("should preserve safe HTML tags (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      const safeHtml = '<h2>Title</h2><p>Some <strong>bold</strong> text and a <a href="https://example.com">link</a>.</p>';
      
      const sanitized = sanitizeHtml(safeHtml);
      
      // Safe tags should be preserved
      expect(sanitized).toContain("<h2>");
      expect(sanitized).toContain("<p>");
      expect(sanitized).toContain("<strong>");
      expect(sanitized).toContain("<a");
      expect(sanitized).toContain('href="https://example.com"');
    });

    it("should handle empty input (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      expect(sanitizeHtml("")).toBe("");
    });

    it("should enforce 1MB size limit (EXPECTED TO FAIL ON UNFIXED CODE)", () => {
      // Generate HTML larger than 1MB
      const largeHtml = "<p>" + "x".repeat(2 * 1024 * 1024) + "</p>"; // 2MB
      
      // Should throw error for oversized input
      expect(() => {
        sanitizeHtml(largeHtml);
      }).toThrow(/size|limit|too large/i);
    });
  });
});
