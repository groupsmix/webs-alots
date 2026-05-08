/**
 * Bug 4 (A8-02): Silent Slack Webhook Failures
 * 
 * Bug Condition Exploration Test
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists.
 * **DO NOT attempt to fix the test or the code when it fails.**
 * 
 * This test encodes the expected behavior after the fix is implemented.
 * When this test passes after implementing the fix, it confirms the bug is resolved.
 * 
 * Bug Condition Function:
 * ```
 * FUNCTION isBugCondition_SlackFailure(notification)
 *   INPUT: notification of type SlackNotification
 *   OUTPUT: boolean
 *   
 *   RETURN notification.slackPostSuccess = FALSE AND
 *          notification.emailFallbackSent = FALSE AND
 *          notification.metricEmitted = FALSE
 * END FUNCTION
 * ```
 * 
 * Expected Behavior Properties (from design 2.10, 2.11, 2.12):
 * - System SHALL send email fallback notification to operations team
 * - System SHALL emit `slack.post.failure` metric for monitoring
 * - Email SHALL include registration details (clinic name, email, website, timestamp, error)
 * - System SHALL log both Slack failure and email fallback status
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock fetch globally
const originalFetch = global.fetch;

describe("Bug 4 (A8-02): Silent Slack Webhook Failures Exploration", () => {
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

  describe("Bug Condition 1: No Email Fallback on Slack Failure", () => {
    it("should send EMAIL FALLBACK when Slack webhook returns 500 error (EXPECTED TO FAIL ON UNFIXED CODE)", async () => {
      // Mock fetch to simulate Slack webhook failure
      let slackCallCount = 0;
      let emailCallCount = 0;
      
      global.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
        const urlStr = url.toString();
        
        // Slack webhook fails with 500
        if (urlStr.includes("hooks.slack.com")) {
          slackCallCount++;
          return new Response(JSON.stringify({ error: "Internal Server Error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        
        // Email API (Resend or SMTP relay)
        if (urlStr.includes("resend.com") || urlStr.includes("email")) {
          emailCallCount++;
          return new Response(JSON.stringify({ id: "email-123" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        
        // Default response for other calls
        return new Response(JSON.stringify({}), { status: 200 });
      }) as typeof fetch;

      const { POST } = await import("@/app/api/v1/register-clinic/route");
      
      const request = new NextRequest("http://localhost:3000/api/v1/register-clinic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.200",
        },
        body: JSON.stringify({
          clinic_name: "Test Clinic",
          doctor_name: "Dr. Test",
          email: "doctor@testclinic.ma",
          phone: "+212600000001",
          specialty: "general",
          website_domain: "testclinic.ma",
          city: "Casablanca",
          // Assume DNS verification passes
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // EXPECTED BEHAVIOR AFTER FIX: Email fallback should be sent
      // CURRENT BEHAVIOR (UNFIXED): Only logger.error() is called, no email sent
      expect(slackCallCount).toBeGreaterThan(0); // Slack was attempted
      expect(emailCallCount).toBeGreaterThan(0); // Email fallback should be sent
      
      // Verify email fallback was sent to operations team
      const emailCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
        call => call[0].toString().includes("resend.com") || call[0].toString().includes("email")
      );
      
      expect(emailCalls.length).toBeGreaterThan(0);
      
      // Email should include registration details
      if (emailCalls.length > 0) {
        const emailBody = emailCalls[0][1]?.body;
        if (emailBody) {
          const bodyStr = emailBody.toString();
          expect(bodyStr).toMatch(/Test Clinic|doctor@testclinic\.ma|testclinic\.ma/i);
        }
      }
    });

    it("should send EMAIL FALLBACK when Slack webhook times out (EXPECTED TO FAIL ON UNFIXED CODE)", async () => {
      // Mock fetch to simulate Slack webhook timeout
      let emailCallCount = 0;
      
      global.fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        
        // Slack webhook times out
        if (urlStr.includes("hooks.slack.com")) {
          throw new Error("Request timeout");
        }
        
        // Email API succeeds
        if (urlStr.includes("resend.com") || urlStr.includes("email")) {
          emailCallCount++;
          return new Response(JSON.stringify({ id: "email-124" }), {
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
          "x-forwarded-for": "203.0.113.201",
        },
        body: JSON.stringify({
          clinic_name: "Timeout Test Clinic",
          doctor_name: "Dr. Timeout",
          email: "timeout@clinic.ma",
          phone: "+212600000002",
          specialty: "pediatrics",
          website_domain: "timeoutclinic.ma",
        }),
      });

      await POST(request);

      // EXPECTED BEHAVIOR AFTER FIX: Email fallback sent on timeout
      expect(emailCallCount).toBeGreaterThan(0);
    });

    it("should send EMAIL FALLBACK when Slack webhook returns non-200 status (EXPECTED TO FAIL ON UNFIXED CODE)", async () => {
      // Test various non-200 status codes
      const statusCodes = [400, 403, 404, 429, 502, 503];
      
      for (const statusCode of statusCodes) {
        let emailCallCount = 0;
        
        global.fetch = vi.fn(async (url: string | URL | Request) => {
          const urlStr = url.toString();
          
          if (urlStr.includes("hooks.slack.com")) {
            return new Response(JSON.stringify({ error: "Error" }), {
              status: statusCode,
              headers: { "Content-Type": "application/json" },
            });
          }
          
          if (urlStr.includes("resend.com") || urlStr.includes("email")) {
            emailCallCount++;
            return new Response(JSON.stringify({ id: "email-125" }), {
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
            "x-forwarded-for": "203.0.113.202",
          },
          body: JSON.stringify({
            clinic_name: `Status ${statusCode} Clinic`,
            doctor_name: "Dr. Status",
            email: `status${statusCode}@clinic.ma`,
            phone: "+212600000003",
            specialty: "general",
            website_domain: `status${statusCode}.ma`,
          }),
        });

        await POST(request);

        // EXPECTED BEHAVIOR AFTER FIX: Email fallback sent for all non-200 statuses
        expect(emailCallCount).toBeGreaterThan(0);
      }
    });
  });

  describe("Bug Condition 2: No Metrics Emitted on Slack Failure", () => {
    it("should emit 'slack.post.failure' metric when Slack fails (EXPECTED TO FAIL ON UNFIXED CODE)", async () => {
      // Mock metrics collection
      const metrics: Array<{ name: string; value: number; tags?: Record<string, string> }> = [];
      
      // Mock a metrics library (if one exists) or check logger calls
      const originalLogger = console.log;
      const logCalls: string[] = [];
      
      console.log = vi.fn((...args: unknown[]) => {
        logCalls.push(JSON.stringify(args));
        originalLogger(...args);
      });

      global.fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        
        if (urlStr.includes("hooks.slack.com")) {
          return new Response(JSON.stringify({ error: "Error" }), {
            status: 500,
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
          "x-forwarded-for": "203.0.113.203",
        },
        body: JSON.stringify({
          clinic_name: "Metrics Test Clinic",
          doctor_name: "Dr. Metrics",
          email: "metrics@clinic.ma",
          phone: "+212600000004",
          specialty: "general",
          website_domain: "metricsclinic.ma",
        }),
      });

      await POST(request);

      // EXPECTED BEHAVIOR AFTER FIX: Metric should be emitted
      // Check if any log contains metric emission
      const hasMetric = logCalls.some(log => 
        log.includes("slack.post.failure") || 
        log.includes("metric") && log.includes("slack")
      );
      
      expect(hasMetric).toBe(true);
      
      console.log = originalLogger;
    });

    it("should emit 'email.fallback.success' metric when email sent (EXPECTED TO FAIL ON UNFIXED CODE)", async () => {
      const logCalls: string[] = [];
      const originalLogger = console.log;
      
      console.log = vi.fn((...args: unknown[]) => {
        logCalls.push(JSON.stringify(args));
        originalLogger(...args);
      });

      global.fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        
        if (urlStr.includes("hooks.slack.com")) {
          return new Response(JSON.stringify({ error: "Error" }), { status: 500 });
        }
        
        if (urlStr.includes("resend.com") || urlStr.includes("email")) {
          return new Response(JSON.stringify({ id: "email-126" }), { status: 200 });
        }
        
        return new Response(JSON.stringify({}), { status: 200 });
      }) as typeof fetch;

      const { POST } = await import("@/app/api/v1/register-clinic/route");
      
      const request = new NextRequest("http://localhost:3000/api/v1/register-clinic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.204",
        },
        body: JSON.stringify({
          clinic_name: "Email Metric Clinic",
          doctor_name: "Dr. Email",
          email: "emailmetric@clinic.ma",
          phone: "+212600000005",
          specialty: "general",
          website_domain: "emailmetric.ma",
        }),
      });

      await POST(request);

      // EXPECTED BEHAVIOR AFTER FIX: Email fallback success metric emitted
      const hasMetric = logCalls.some(log => 
        log.includes("email.fallback.success") || 
        log.includes("metric") && log.includes("email") && log.includes("fallback")
      );
      
      expect(hasMetric).toBe(true);
      
      console.log = originalLogger;
    });

    it("should emit 'email.fallback.failure' metric when both Slack and email fail (EXPECTED TO FAIL ON UNFIXED CODE)", async () => {
      const logCalls: string[] = [];
      const originalLogger = console.log;
      
      console.log = vi.fn((...args: unknown[]) => {
        logCalls.push(JSON.stringify(args));
        originalLogger(...args);
      });

      global.fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        
        // Both Slack and email fail
        if (urlStr.includes("hooks.slack.com") || urlStr.includes("resend.com") || urlStr.includes("email")) {
          return new Response(JSON.stringify({ error: "Service Unavailable" }), { status: 503 });
        }
        
        return new Response(JSON.stringify({}), { status: 200 });
      }) as typeof fetch;

      const { POST } = await import("@/app/api/v1/register-clinic/route");
      
      const request = new NextRequest("http://localhost:3000/api/v1/register-clinic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.205",
        },
        body: JSON.stringify({
          clinic_name: "Both Fail Clinic",
          doctor_name: "Dr. Fail",
          email: "bothfail@clinic.ma",
          phone: "+212600000006",
          specialty: "general",
          website_domain: "bothfail.ma",
        }),
      });

      await POST(request);

      // EXPECTED BEHAVIOR AFTER FIX: Critical metric emitted when both channels fail
      const hasMetric = logCalls.some(log => 
        log.includes("email.fallback.failure") || 
        log.includes("critical") && log.includes("email") && log.includes("slack")
      );
      
      expect(hasMetric).toBe(true);
      
      console.log = originalLogger;
    });
  });

  describe("Bug Condition 3: Missing Registration Details in Fallback", () => {
    it("should include ALL registration details in email fallback (EXPECTED TO FAIL ON UNFIXED CODE)", async () => {
      let emailBody: string | undefined;
      
      global.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
        const urlStr = url.toString();
        
        if (urlStr.includes("hooks.slack.com")) {
          return new Response(JSON.stringify({ error: "Error" }), { status: 500 });
        }
        
        if (urlStr.includes("resend.com") || urlStr.includes("email")) {
          // Capture email body
          emailBody = options?.body?.toString();
          return new Response(JSON.stringify({ id: "email-127" }), { status: 200 });
        }
        
        return new Response(JSON.stringify({}), { status: 200 });
      }) as typeof fetch;

      const { POST } = await import("@/app/api/v1/register-clinic/route");
      
      const registrationData = {
        clinic_name: "Complete Data Clinic",
        doctor_name: "Dr. Complete",
        email: "complete@clinic.ma",
        phone: "+212600000007",
        specialty: "cardiology",
        website_domain: "completeclinic.ma",
        city: "Rabat",
      };
      
      const request = new NextRequest("http://localhost:3000/api/v1/register-clinic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.206",
        },
        body: JSON.stringify(registrationData),
      });

      await POST(request);

      // EXPECTED BEHAVIOR AFTER FIX: Email should contain all registration details
      expect(emailBody).toBeDefined();
      
      if (emailBody) {
        // Check for all key registration details
        expect(emailBody).toMatch(/Complete Data Clinic/i);
        expect(emailBody).toMatch(/Dr\. Complete/i);
        expect(emailBody).toMatch(/complete@clinic\.ma/i);
        expect(emailBody).toMatch(/\+212600000007/i);
        expect(emailBody).toMatch(/cardiology/i);
        expect(emailBody).toMatch(/completeclinic\.ma/i);
        expect(emailBody).toMatch(/Rabat/i);
        
        // Should also include error details
        expect(emailBody).toMatch(/error|failed|slack/i);
      }
    });

    it("should include timestamp in email fallback (EXPECTED TO FAIL ON UNFIXED CODE)", async () => {
      let emailBody: string | undefined;
      
      global.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
        const urlStr = url.toString();
        
        if (urlStr.includes("hooks.slack.com")) {
          return new Response(JSON.stringify({ error: "Error" }), { status: 500 });
        }
        
        if (urlStr.includes("resend.com") || urlStr.includes("email")) {
          emailBody = options?.body?.toString();
          return new Response(JSON.stringify({ id: "email-128" }), { status: 200 });
        }
        
        return new Response(JSON.stringify({}), { status: 200 });
      }) as typeof fetch;

      const { POST } = await import("@/app/api/v1/register-clinic/route");
      
      const request = new NextRequest("http://localhost:3000/api/v1/register-clinic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.207",
        },
        body: JSON.stringify({
          clinic_name: "Timestamp Clinic",
          doctor_name: "Dr. Time",
          email: "timestamp@clinic.ma",
          phone: "+212600000008",
          specialty: "general",
          website_domain: "timestamp.ma",
        }),
      });

      await POST(request);

      // EXPECTED BEHAVIOR AFTER FIX: Email should include timestamp
      expect(emailBody).toBeDefined();
      
      if (emailBody) {
        // Check for timestamp (ISO format or human-readable)
        expect(emailBody).toMatch(/\d{4}-\d{2}-\d{2}|\d{1,2}:\d{2}|timestamp|time|date/i);
      }
    });
  });
});
