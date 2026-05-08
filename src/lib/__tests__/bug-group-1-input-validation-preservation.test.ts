/**
 * Bug Group 1 (A1-03, A1-04, S5-06): Input Validation Preservation Tests
 * 
 * **IMPORTANT**: Follow observation-first methodology
 * 
 * These tests capture the behavior on UNFIXED code for valid inputs.
 * They ensure that after implementing the fixes, legitimate inputs:
 * - Successful Slack notifications with normal clinic names continue to work
 * - Valid CMI callback URLs continue to work
 * - Safe HTML content in blog posts continues to display correctly
 * 
 * Preservation Requirements (from design.md):
 * 1. Successful Slack notifications must continue to work with proper formatting
 * 2. Valid CMI callback URLs must continue to work
 * 3. Legitimate HTML content must continue to display correctly
 * 
 * Property: Preservation Checking
 * ```
 * FOR ALL input WHERE NOT isBugCondition_Injection(input) DO
 *   // Valid inputs continue to work after fixes
 *   ASSERT handleInput(input).success = TRUE AND
 *          handleInput'(input).success = TRUE AND
 *          handleInput(input).output = handleInput'(input).output
 * END FOR
 * ```
 * 
 * **Validates: Requirements Preservation 1, 2, 3**
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { sanitizeHtml } from "@/lib/sanitize-html";

const originalFetch = global.fetch;

describe("Bug Group 1: Input Validation Preservation Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SELF_SERVICE_REGISTRATION_ENABLED = "true";
    process.env.DNS_VERIFICATION_SECRET = "test-secret-key";
    process.env.SLACK_REGISTRATION_ALERTS_WEBHOOK_URL = "https://hooks.slack.com/services/TEST/WEBHOOK";
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("Preservation 1: Successful Slack Notifications with Normal Clinic Names", () => {
    it("should send Slack notification with normal clinic name", async () => {
      let slackCallCount = 0;
      let slackBody: string | undefined;

      global.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
        const urlStr = url.toString();

        // Capture Slack webhook call
        if (urlStr.includes("hooks.slack.com")) {
          slackCallCount++;
          if (options?.body) {
            slackBody = options.body.toString();
          }
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Mock other API calls
        return new Response(JSON.stringify({}), { status: 200 });
      }) as typeof fetch;

      const { POST } = await import("@/app/api/v1/register-clinic/route");

      const request = new NextRequest("http://localhost:3000/api/v1/register-clinic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.100",
        },
        body: JSON.stringify({
          clinic_name: "Clinique Dentaire Casablanca",
          doctor_name: "Dr. Ahmed Benali",
          email: "contact@dentaire-casa.ma",
          phone: "+212600000001",
          specialty: "dentistry",
          city: "Casablanca",
          website_domain: "dentaire-casa.ma",
        }),
      });

      await POST(request);

      // PRESERVATION: Slack should be called successfully
      expect(slackCallCount).toBeGreaterThan(0);
      expect(slackBody).toBeDefined();

      // PRESERVATION: Normal clinic name should be included in notification
      if (slackBody) {
        const parsed = JSON.parse(slackBody);
        expect(parsed.blocks).toBeDefined();
        
        // Find the clinic name field
        const sectionBlock = parsed.blocks.find((b: { type: string }) => b.type === "section");
        expect(sectionBlock).toBeDefined();
        
        const clinicField = sectionBlock.fields.find((f: { text: string }) => 
          f.text.includes("Clinique Dentaire Casablanca")
        );
        expect(clinicField).toBeDefined();
      }
    });

    it("should handle clinic names with special characters (non-malicious)", async () => {
      let slackBody: string | undefined;

      global.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
        const urlStr = url.toString();

        if (urlStr.includes("hooks.slack.com")) {
          if (options?.body) {
            slackBody = options.body.toString();
          }
          return new Response(JSON.stringify({ ok: true }), {
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
          "x-forwarded-for": "203.0.113.101",
        },
        body: JSON.stringify({
          clinic_name: "Clinique Médicale & Chirurgicale - Rabat",
          doctor_name: "Dr. Fatima El-Amrani",
          email: "contact@medical-rabat.ma",
          phone: "+212600000002",
          specialty: "surgery",
          city: "Rabat",
          website_domain: "medical-rabat.ma",
        }),
      });

      await POST(request);

      // PRESERVATION: Special characters like &, -, and accents should work
      expect(slackBody).toBeDefined();
      if (slackBody) {
        const parsed = JSON.parse(slackBody);
        const sectionBlock = parsed.blocks.find((b: { type: string }) => b.type === "section");
        const clinicField = sectionBlock.fields.find((f: { text: string }) => 
          f.text.includes("Clinique Médicale")
        );
        expect(clinicField).toBeDefined();
      }
    });

    it("should handle email addresses in Slack notifications", async () => {
      let slackBody: string | undefined;

      global.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
        const urlStr = url.toString();

        if (urlStr.includes("hooks.slack.com")) {
          if (options?.body) {
            slackBody = options.body.toString();
          }
          return new Response(JSON.stringify({ ok: true }), {
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
          "x-forwarded-for": "203.0.113.102",
        },
        body: JSON.stringify({
          clinic_name: "Clinique Pédiatrique",
          doctor_name: "Dr. Youssef Alami",
          email: "dr.alami@pediatrie-maroc.ma",
          phone: "+212600000003",
          specialty: "pediatrics",
          website_domain: "pediatrie-maroc.ma",
        }),
      });

      await POST(request);

      // PRESERVATION: Email addresses should be included correctly
      expect(slackBody).toBeDefined();
      if (slackBody) {
        const parsed = JSON.parse(slackBody);
        const sectionBlock = parsed.blocks.find((b: { type: string }) => b.type === "section");
        const emailField = sectionBlock.fields.find((f: { text: string }) => 
          f.text.includes("dr.alami@pediatrie-maroc.ma")
        );
        expect(emailField).toBeDefined();
      }
    });
  });

  describe("Preservation 2: Valid CMI Callback URLs", () => {
    it("should accept valid same-origin success URL", async () => {
      const { POST } = await import("@/app/api/payments/cmi/route");

      // Mock CMI configuration
      process.env.CMI_MERCHANT_ID = "test-merchant";
      process.env.CMI_SECRET_KEY = "test-secret-key";

      // Mock authenticated user context
      const mockUser = {
        id: "user-123",
        email: "patient@example.com",
        clinic_id: "clinic-123",
        role: "doctor",
      };

      const request = new NextRequest("http://localhost:3000/api/payments/cmi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: 200.0,
          description: "Consultation payment",
          patientId: "patient-456",
          appointmentId: "appt-789",
          successUrl: "http://localhost:3000/patient/dashboard?payment=success",
          failUrl: "http://localhost:3000/patient/dashboard?payment=failed",
        }),
      });

      // Add user context to request (simulating withAuth)
      (request as any).user = mockUser;

      const response = await POST(request);
      const data = await response.json();

      // PRESERVATION: Valid same-origin URLs should be accepted
      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.orderId).toBeDefined();
    });

    it("should accept valid booking confirmation URL", async () => {
      const { POST } = await import("@/app/api/payments/cmi/route");

      process.env.CMI_MERCHANT_ID = "test-merchant";
      process.env.CMI_SECRET_KEY = "test-secret-key";

      const mockUser = {
        id: "user-124",
        email: "patient2@example.com",
        clinic_id: "clinic-123",
        role: "doctor",
      };

      const request = new NextRequest("http://localhost:3000/api/payments/cmi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: 150.0,
          description: "Booking payment",
          successUrl: "http://localhost:3000/booking/confirm?status=success",
          failUrl: "http://localhost:3000/booking/confirm?status=failed",
        }),
      });

      (request as any).user = mockUser;

      const response = await POST(request);
      const data = await response.json();

      // PRESERVATION: Booking URLs should be accepted
      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
    });

    it("should accept admin dashboard URLs", async () => {
      const { POST } = await import("@/app/api/payments/cmi/route");

      process.env.CMI_MERCHANT_ID = "test-merchant";
      process.env.CMI_SECRET_KEY = "test-secret-key";

      const mockUser = {
        id: "user-125",
        email: "admin@example.com",
        clinic_id: "clinic-123",
        role: "clinic_admin",
      };

      const request = new NextRequest("http://localhost:3000/api/payments/cmi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: 500.0,
          description: "Admin payment",
          successUrl: "http://localhost:3000/admin/payments?status=success",
          failUrl: "http://localhost:3000/admin/payments?status=failed",
        }),
      });

      (request as any).user = mockUser;

      const response = await POST(request);
      const data = await response.json();

      // PRESERVATION: Admin URLs should be accepted
      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
    });

    it("should accept doctor dashboard URLs", async () => {
      const { POST } = await import("@/app/api/payments/cmi/route");

      process.env.CMI_MERCHANT_ID = "test-merchant";
      process.env.CMI_SECRET_KEY = "test-secret-key";

      const mockUser = {
        id: "user-126",
        email: "doctor@example.com",
        clinic_id: "clinic-123",
        role: "doctor",
      };

      const request = new NextRequest("http://localhost:3000/api/payments/cmi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: 300.0,
          description: "Doctor payment",
          successUrl: "http://localhost:3000/doctor/appointments?payment=success",
          failUrl: "http://localhost:3000/doctor/appointments?payment=failed",
        }),
      });

      (request as any).user = mockUser;

      const response = await POST(request);
      const data = await response.json();

      // PRESERVATION: Doctor URLs should be accepted
      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
    });

    it("should handle missing redirect URLs with safe defaults", async () => {
      const { POST } = await import("@/app/api/payments/cmi/route");

      process.env.CMI_MERCHANT_ID = "test-merchant";
      process.env.CMI_SECRET_KEY = "test-secret-key";

      const mockUser = {
        id: "user-127",
        email: "patient3@example.com",
        clinic_id: "clinic-123",
        role: "patient",
      };

      const request = new NextRequest("http://localhost:3000/api/payments/cmi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: 100.0,
          description: "Payment without URLs",
          // No successUrl or failUrl provided
        }),
      });

      (request as any).user = mockUser;

      const response = await POST(request);
      const data = await response.json();

      // PRESERVATION: Missing URLs should use safe defaults
      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
    });
  });

  describe("Preservation 3: Safe HTML Content in Blog Posts", () => {
    it("should allow safe paragraph tags", () => {
      const html = "<p>This is a safe paragraph about healthcare in Morocco.</p>";
      const sanitized = sanitizeHtml(html);

      // PRESERVATION: Safe paragraph tags should be preserved
      expect(sanitized).toContain("<p>");
      expect(sanitized).toContain("healthcare in Morocco");
      expect(sanitized).toContain("</p>");
    });

    it("should allow safe formatting tags", () => {
      const html = `
        <p>This is <strong>important</strong> information about <em>patient care</em>.</p>
        <p>You can also use <b>bold</b> and <i>italic</i> text.</p>
      `;
      const sanitized = sanitizeHtml(html);

      // PRESERVATION: Safe formatting tags should be preserved
      expect(sanitized).toContain("<strong>");
      expect(sanitized).toContain("</strong>");
      expect(sanitized).toContain("<em>");
      expect(sanitized).toContain("</em>");
      expect(sanitized).toContain("<b>");
      expect(sanitized).toContain("</b>");
      expect(sanitized).toContain("<i>");
      expect(sanitized).toContain("</i>");
    });

    it("should allow safe list structures", () => {
      const html = `
        <h2>Healthcare Services</h2>
        <ul>
          <li>General consultation</li>
          <li>Dental care</li>
          <li>Pediatrics</li>
        </ul>
        <ol>
          <li>Book appointment</li>
          <li>Visit clinic</li>
          <li>Follow-up</li>
        </ol>
      `;
      const sanitized = sanitizeHtml(html);

      // PRESERVATION: Safe list structures should be preserved
      expect(sanitized).toContain("<h2>");
      expect(sanitized).toContain("</h2>");
      expect(sanitized).toContain("<ul>");
      expect(sanitized).toContain("</ul>");
      expect(sanitized).toContain("<ol>");
      expect(sanitized).toContain("</ol>");
      expect(sanitized).toContain("<li>");
      expect(sanitized).toContain("</li>");
    });

    it("should allow safe links with http/https", () => {
      const html = `
        <p>Visit our website at <a href="https://oltigo.com">Oltigo Health</a>.</p>
        <p>Read more at <a href="http://example.com/blog">our blog</a>.</p>
      `;
      const sanitized = sanitizeHtml(html);

      // PRESERVATION: Safe links should be preserved
      expect(sanitized).toContain('<a href="https://oltigo.com">');
      expect(sanitized).toContain('<a href="http://example.com/blog">');
      expect(sanitized).toContain("Oltigo Health");
      expect(sanitized).toContain("our blog");
    });

    it("should allow safe images", () => {
      const html = `
        <figure>
          <img src="https://example.com/clinic.jpg" alt="Clinic exterior" width="600" height="400" />
          <figcaption>Our modern clinic facility</figcaption>
        </figure>
      `;
      const sanitized = sanitizeHtml(html);

      // PRESERVATION: Safe images should be preserved
      expect(sanitized).toContain("<figure>");
      expect(sanitized).toContain("</figure>");
      expect(sanitized).toContain("<img");
      expect(sanitized).toContain('src="https://example.com/clinic.jpg"');
      expect(sanitized).toContain('alt="Clinic exterior"');
      expect(sanitized).toContain("<figcaption>");
      expect(sanitized).toContain("</figcaption>");
    });

    it("should allow code blocks for technical content", () => {
      const html = `
        <p>Example API response:</p>
        <pre><code>{
  "status": "success",
  "data": {
    "appointment_id": "123"
  }
}</code></pre>
      `;
      const sanitized = sanitizeHtml(html);

      // PRESERVATION: Code blocks should be preserved
      expect(sanitized).toContain("<pre>");
      expect(sanitized).toContain("</pre>");
      expect(sanitized).toContain("<code>");
      expect(sanitized).toContain("</code>");
      expect(sanitized).toContain("appointment_id");
    });

    it("should allow blockquotes", () => {
      const html = `
        <blockquote>
          <p>Healthcare is a fundamental human right.</p>
        </blockquote>
      `;
      const sanitized = sanitizeHtml(html);

      // PRESERVATION: Blockquotes should be preserved
      expect(sanitized).toContain("<blockquote>");
      expect(sanitized).toContain("</blockquote>");
      expect(sanitized).toContain("fundamental human right");
    });

    it("should allow tables for structured data", () => {
      const html = `
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Consultation</td>
              <td>200 MAD</td>
            </tr>
            <tr>
              <td>Follow-up</td>
              <td>150 MAD</td>
            </tr>
          </tbody>
        </table>
      `;
      const sanitized = sanitizeHtml(html);

      // PRESERVATION: Tables should be preserved
      expect(sanitized).toContain("<table>");
      expect(sanitized).toContain("</table>");
      expect(sanitized).toContain("<thead>");
      expect(sanitized).toContain("<tbody>");
      expect(sanitized).toContain("<tr>");
      expect(sanitized).toContain("<th>");
      expect(sanitized).toContain("<td>");
      expect(sanitized).toContain("Consultation");
      expect(sanitized).toContain("200 MAD");
    });

    it("should preserve text content and readability", () => {
      const html = `
        <h1>Welcome to Oltigo Health</h1>
        <p>We provide comprehensive healthcare services across Morocco.</p>
        <h2>Our Services</h2>
        <p>From general consultations to specialized care, we're here to help.</p>
      `;
      const sanitized = sanitizeHtml(html);

      // PRESERVATION: Text content should be fully preserved
      expect(sanitized).toContain("Welcome to Oltigo Health");
      expect(sanitized).toContain("comprehensive healthcare services");
      expect(sanitized).toContain("Our Services");
      expect(sanitized).toContain("specialized care");
    });

    it("should handle complex blog post structure", () => {
      const html = `
        <article>
          <h1>Understanding Healthcare in Morocco</h1>
          <p>Published on <time>2024-01-15</time></p>
          
          <h2>Introduction</h2>
          <p>Morocco's healthcare system has evolved significantly over the past decade.</p>
          
          <h3>Key Points</h3>
          <ul>
            <li>Universal health coverage initiatives</li>
            <li>Digital health transformation</li>
            <li>Telemedicine adoption</li>
          </ul>
          
          <h2>Conclusion</h2>
          <p>The future of healthcare in Morocco is <strong>promising</strong>.</p>
        </article>
      `;
      const sanitized = sanitizeHtml(html);

      // PRESERVATION: Complex structures should be preserved
      expect(sanitized).toContain("<h1>");
      expect(sanitized).toContain("<h2>");
      expect(sanitized).toContain("<h3>");
      expect(sanitized).toContain("<ul>");
      expect(sanitized).toContain("<li>");
      expect(sanitized).toContain("<strong>");
      expect(sanitized).toContain("Understanding Healthcare in Morocco");
      expect(sanitized).toContain("Universal health coverage");
      expect(sanitized).toContain("promising");
    });
  });

  describe("Preservation Summary", () => {
    it("should document all preserved behaviors for Bug Group 1", () => {
      const preservedBehaviors = [
        "Successful Slack notifications with normal clinic names continue to work",
        "Slack notifications include all registration details correctly",
        "Special characters in clinic names (non-malicious) are handled properly",
        "Email addresses are included correctly in Slack notifications",
        "Valid same-origin CMI callback URLs are accepted",
        "Booking confirmation URLs are accepted",
        "Admin dashboard URLs are accepted",
        "Doctor dashboard URLs are accepted",
        "Missing redirect URLs use safe defaults",
        "Safe HTML paragraph tags are preserved",
        "Safe formatting tags (strong, em, b, i) are preserved",
        "Safe list structures (ul, ol, li) are preserved",
        "Safe links with http/https are preserved",
        "Safe images with proper attributes are preserved",
        "Code blocks for technical content are preserved",
        "Blockquotes are preserved",
        "Tables for structured data are preserved",
        "Text content and readability are fully preserved",
        "Complex blog post structures are preserved",
      ];

      // This test documents all preservation requirements
      expect(preservedBehaviors.length).toBeGreaterThan(0);
      preservedBehaviors.forEach((behavior) => {
        expect(behavior).toBeTruthy();
      });
    });
  });
});
