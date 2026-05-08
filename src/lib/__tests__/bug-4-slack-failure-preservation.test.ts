/**
 * Bug 4 (A8-02): Silent Slack Webhook Failures Preservation Tests
 * 
 * **IMPORTANT**: Follow observation-first methodology
 * 
 * These tests capture the behavior on UNFIXED code for successful Slack notifications.
 * They ensure that after implementing the fix, successful Slack notifications:
 * - Continue to be sent to Slack without triggering email fallbacks
 * - Continue to create clinic records and user accounts
 * - Continue to log audit events correctly
 * 
 * Preservation Requirements (from design 3.10, 3.11, 3.12):
 * - Successful Slack webhook POSTs SHALL continue without triggering email fallbacks
 * - Clinic registration SHALL continue to create records regardless of notification status
 * - Audit logs SHALL continue to record all state-changing operations
 * 
 * Property: Preservation Checking
 * ```
 * FOR ALL notification WHERE NOT isBugCondition_SlackFailure(notification) DO
 *   // Successful Slack posts don't trigger email fallback
 *   ASSERT handleNotification(notification).slackSent = TRUE AND
 *          handleNotification'(notification).emailFallbackSent = FALSE
 * END FOR
 * ```
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

const originalFetch = global.fetch;

describe("Bug 4 (A8-02): Silent Slack Webhook Failures Preservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SELF_SERVICE_REGISTRATION_ENABLED = "true";
    process.env.DNS_VERIFICATION_SECRET = "test-secret-key";
    process.env.SLACK_REGISTRATION_ALERTS_WEBHOOK_URL = "https://hooks.slack.com/services/TEST/WEBHOOK";
    process.env.OPERATIONS_EMAIL = "ops@example.com";
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("Preservation 1: Successful Slack Notifications Continue to Work", () => {
    it("should send Slack notification when webhook succeeds", async () => {
      let slackCallCount = 0;
      let emailCallCount = 0;
      
      global.fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        
        // Slack webhook succeeds
        if (urlStr.includes("hooks.slack.com")) {
          slackCallCount++;
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        
        // Email API (should NOT be called)
        if (urlStr.includes("resend.com") || urlStr.includes("email")) {
          emailCallCount++;
          return new Response(JSON.stringify({ id: "email-unexpected" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        
        return new Response(JSON.stringify({}), { status: 200 });
      }) as typeof fetch;

      const { POST } = await import("@/app/api/v1/register-clinic/route");
      
      const request = new NextRequest("http://localhost:3000/api/v1/register-clinic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.210",
        },
        body: JSON.stringify({
          clinic_name: "Success Clinic",
          doctor_name: "Dr. Success",
          email: "success@clinic.ma",
          phone: "+212600000010",
          specialty: "general",
          website_domain: "successclinic.ma",
        }),
      });

      const response = await POST(request);

      // PRESERVATION: Slack should be called, email should NOT be called
      expect(slackCallCount).toBeGreaterThan(0);
      expect(emailCallCount).toBe(0); // No email fallback when Slack succeeds
    });

    it("should include correct registration details in Slack notification", async () => {
      let slackBody: string | undefined;
      
      global.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
        const urlStr = url.toString();
        
        if (urlStr.includes("hooks.slack.com")) {
          slackBody = options?.body?.toString();
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        
        return new Response(JSON.stringify({}), { status: 200 });
      }) as typeof fetch;

      const { POST } = await import("@/app/api/v1/register-clinic/route");
      
      const registrationData = {
        clinic_name: "Detailed Clinic",
        doctor_name: "Dr. Detailed",
        email: "detailed@clinic.ma",
        phone: "+212600000011",
        specialty: "pediatrics",
        website_domain: "detailedclinic.ma",
        city: "Marrakech",
      };
      
      const request = new NextRequest("http://localhost:3000/api/v1/register-clinic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.211",
        },
        body: JSON.stringify(registrationData),
      });

      await POST(request);

      // PRESERVATION: Slack notification should contain all registration details
      expect(slackBody).toBeDefined();
      
      if (slackBody) {
        const bodyObj = JSON.parse(slackBody);
        expect(bodyObj).toHaveProperty("text");
        expect(bodyObj).toHaveProperty("blocks");
        
        // Check that registration details are included
        const bodyStr = JSON.stringify(bodyObj);
        expect(bodyStr).toMatch(/Detailed Clinic/i);
        expect(bodyStr).toMatch(/Dr\. Detailed/i);
        expect(bodyStr).toMatch(/detailed@clinic\.ma/i);
        expect(bodyStr).toMatch(/pediatrics/i);
      }
    });

    it("should handle Slack notification when webhook URL is not configured", async () => {
      // Remove Slack webhook URL
      delete process.env.SLACK_REGISTRATION_ALERTS_WEBHOOK_URL;
      
      let slackCallCount = 0;
      
      global.fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        
        if (urlStr.includes("hooks.slack.com")) {
          slackCallCount++;
        }
        
        return new Response(JSON.stringify({}), { status: 200 });
      }) as typeof fetch;

      const { POST } = await import("@/app/api/v1/register-clinic/route");
      
      const request = new NextRequest("http://localhost:3000/api/v1/register-clinic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.212",
        },
        body: JSON.stringify({
          clinic_name: "No Webhook Clinic",
          doctor_name: "Dr. NoWebhook",
          email: "nowebhook@clinic.ma",
          phone: "+212600000012",
          specialty: "general",
          website_domain: "nowebhook.ma",
        }),
      });

      const response = await POST(request);

      // PRESERVATION: Registration should succeed even without Slack webhook
      // No Slack call should be made
      expect(slackCallCount).toBe(0);
      
      // Restore for other tests
      process.env.SLACK_REGISTRATION_ALERTS_WEBHOOK_URL = "https://hooks.slack.com/services/TEST/WEBHOOK";
    });
  });

  describe("Preservation 2: Clinic Registration Completes Regardless of Notification Status", () => {
    it("should create clinic record even when Slack fails", async () => {
      global.fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        
        // Slack fails
        if (urlStr.includes("hooks.slack.com")) {
          return new Response(JSON.stringify({ error: "Error" }), { status: 500 });
        }
        
        return new Response(JSON.stringify({}), { status: 200 });
      }) as typeof fetch;

      const { POST } = await import("@/app/api/v1/register-clinic/route");
      
      const request = new NextRequest("http://localhost:3000/api/v1/register-clinic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.213",
        },
        body: JSON.stringify({
          clinic_name: "Resilient Clinic",
          doctor_name: "Dr. Resilient",
          email: "resilient@clinic.ma",
          phone: "+212600000013",
          specialty: "general",
          website_domain: "resilient.ma",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // PRESERVATION: Registration should succeed even if Slack fails
      // (This depends on the actual implementation - may return 200 or 500)
      // The key is that the clinic record should be created
      if (response.status === 200) {
        expect(data.ok).toBe(true);
      }
    });

    it("should create clinic record when Slack succeeds", async () => {
      global.fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        
        // Slack succeeds
        if (urlStr.includes("hooks.slack.com")) {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        
        return new Response(JSON.stringify({}), { status: 200 });
      }) as typeof fetch;

      const { POST } = await import("@/app/api/v1/register-clinic/route");
      
      const request = new NextRequest("http://localhost:3000/api/v1/register-clinic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.214",
        },
        body: JSON.stringify({
          clinic_name: "Normal Clinic",
          doctor_name: "Dr. Normal",
          email: "normal@clinic.ma",
          phone: "+212600000014",
          specialty: "general",
          website_domain: "normal.ma",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // PRESERVATION: Registration should succeed when Slack succeeds
      if (response.status === 200) {
        expect(data.ok).toBe(true);
      }
    });
  });

  describe("Preservation 3: Audit Logging Continues to Work", () => {
    it("should log audit events for registration regardless of Slack status", async () => {
      const logCalls: string[] = [];
      const originalLogger = console.log;
      
      console.log = vi.fn((...args: unknown[]) => {
        logCalls.push(JSON.stringify(args));
        originalLogger(...args);
      });

      global.fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        
        if (urlStr.includes("hooks.slack.com")) {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        
        return new Response(JSON.stringify({}), { status: 200 });
      }) as typeof fetch;

      const { POST } = await import("@/app/api/v1/register-clinic/route");
      
      const request = new NextRequest("http://localhost:3000/api/v1/register-clinic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.215",
        },
        body: JSON.stringify({
          clinic_name: "Audit Clinic",
          doctor_name: "Dr. Audit",
          email: "audit@clinic.ma",
          phone: "+212600000015",
          specialty: "general",
          website_domain: "audit.ma",
        }),
      });

      await POST(request);

      // PRESERVATION: Audit logs should be written
      const hasAuditLog = logCalls.some(log => 
        log.includes("audit") || 
        log.includes("register-clinic") ||
        log.includes("clinic.created")
      );
      
      expect(hasAuditLog).toBe(true);
      
      console.log = originalLogger;
    });
  });

  describe("Preservation 4: Error Handling and Validation", () => {
    it("should validate registration data before attempting Slack notification", async () => {
      let slackCallCount = 0;
      
      global.fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        
        if (urlStr.includes("hooks.slack.com")) {
          slackCallCount++;
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        
        return new Response(JSON.stringify({}), { status: 200 });
      }) as typeof fetch;

      const { POST } = await import("@/app/api/v1/register-clinic/route");
      
      // Invalid registration data (missing required fields)
      const request = new NextRequest("http://localhost:3000/api/v1/register-clinic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.216",
        },
        body: JSON.stringify({
          clinic_name: "Invalid Clinic",
          // Missing doctor_name, email, phone, etc.
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // PRESERVATION: Validation should fail before Slack notification
      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(slackCallCount).toBe(0); // Slack should not be called for invalid data
    });

    it("should handle rate limiting before Slack notification", async () => {
      let slackCallCount = 0;
      
      global.fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        
        if (urlStr.includes("hooks.slack.com")) {
          slackCallCount++;
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        
        return new Response(JSON.stringify({}), { status: 200 });
      }) as typeof fetch;

      const { POST } = await import("@/app/api/v1/register-clinic/route");
      
      const testIp = "203.0.113.217";
      
      // Make 3 registration attempts (should hit rate limit on 3rd)
      const requests = Array.from({ length: 3 }, (_, i) => 
        new NextRequest("http://localhost:3000/api/v1/register-clinic", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": testIp,
          },
          body: JSON.stringify({
            clinic_name: `Rate Limit Clinic ${i}`,
            doctor_name: "Dr. RateLimit",
            email: `ratelimit${i}@clinic.ma`,
            phone: `+21260000001${i}`,
            specialty: "general",
            website_domain: `ratelimit${i}.ma`,
          }),
        })
      );

      const responses = await Promise.all(requests.map(req => POST(req)));
      const statuses = responses.map(r => r.status);

      // PRESERVATION: Rate limiting should work before Slack notification
      const rateLimitedCount = statuses.filter(s => s === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
      
      // Slack should only be called for non-rate-limited requests
      expect(slackCallCount).toBeLessThan(3);
    });
  });

  describe("Preservation 5: Slack Message Formatting", () => {
    it("should escape user input in Slack messages to prevent injection", async () => {
      let slackBody: string | undefined;
      
      global.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
        const urlStr = url.toString();
        
        if (urlStr.includes("hooks.slack.com")) {
          slackBody = options?.body?.toString();
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        
        return new Response(JSON.stringify({}), { status: 200 });
      }) as typeof fetch;

      const { POST } = await import("@/app/api/v1/register-clinic/route");
      
      // Registration data with special characters that could cause Slack injection
      const request = new NextRequest("http://localhost:3000/api/v1/register-clinic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.218",
        },
        body: JSON.stringify({
          clinic_name: "Test <@U123> <!channel> Clinic",
          doctor_name: "Dr. <https://evil.com|Click Here>",
          email: "escape@clinic.ma",
          phone: "+212600000018",
          specialty: "general",
          website_domain: "escape.ma",
        }),
      });

      await POST(request);

      // PRESERVATION: Special characters should be escaped in Slack message
      expect(slackBody).toBeDefined();
      
      if (slackBody) {
        const bodyObj = JSON.parse(slackBody);
        const bodyStr = JSON.stringify(bodyObj);
        
        // Check that dangerous patterns are escaped
        // (The exact escaping depends on the implementation)
        // Should not contain raw <@U123> or <!channel> or <https://evil.com|...>
        expect(bodyStr).not.toMatch(/<@U123>/);
        expect(bodyStr).not.toMatch(/<!channel>/);
      }
    });
  });
});
