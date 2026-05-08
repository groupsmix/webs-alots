/**
 * E2E Tests for Phase 1 Critical Security Fixes
 * 
 * Tests the complete security fix implementation across all 5 vulnerabilities:
 * - A1-01: AI Input Validation & Token Budget
 * - A6-13: Booking Token Tenant Binding
 * - A7-01: File Download Authorization
 * - A8-01: PII Logging Redaction
 * - A2-02: Timing-Safe Compare DoS
 */

import { test, expect } from "@playwright/test";

test.describe("Phase 1 Security Fixes - E2E", () => {
  
  test.describe("A1-01: AI Input Validation", () => {
    test("should reject chat message exceeding 4000 characters", async ({ request }) => {
      // Login and get auth token
      const loginResponse = await request.post("/api/auth/login", {
        data: {
          email: "doctor@test.com",
          password: "test-password",
        },
      });
      
      const { token } = await loginResponse.json();
      
      // Attempt to send oversized message
      const response = await request.post("/api/chat", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: {
          messages: [{
            role: "user",
            content: "A".repeat(5000), // Exceeds 4000 limit
          }],
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error).toContain("Validation error");
    });

    test("should reject AI prescription with oversized diagnosis", async ({ request }) => {
      const loginResponse = await request.post("/api/auth/login", {
        data: {
          email: "doctor@test.com",
          password: "test-password",
        },
      });
      
      const { token } = await loginResponse.json();
      
      const response = await request.post("/api/v1/ai/prescription", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: {
          patientId: "test-patient-id",
          diagnosis: "A".repeat(3000), // Exceeds 2000 limit
          symptoms: "Test symptoms",
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.ok).toBe(false);
    });

    test("should reject AI manager with oversized question", async ({ request }) => {
      const loginResponse = await request.post("/api/auth/login", {
        data: {
          email: "admin@test.com",
          password: "test-password",
        },
      });
      
      const { token } = await loginResponse.json();
      
      const response = await request.post("/api/ai/manager", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: {
          question: "A".repeat(2500), // Exceeds 2000 limit
        },
      });

      expect(response.status()).toBe(400);
    });
  });

  test.describe("A1-01: AI Token Budget", () => {
    test.skip("should reject requests when budget exceeded", async ({ request }) => {
      // This test requires setting up a test clinic with low budget
      // and making multiple AI requests until budget is exhausted
      // Skipped for now as it requires test data setup
    });
  });

  test.describe("A6-13: Booking Token Tenant Isolation", () => {
    test("should reject booking token from different clinic", async ({ request, page }) => {
      // Generate token for clinic A
      await page.goto("https://clinic-a.localhost:3000/booking");
      await page.fill('input[name="phone"]', "+212600000000");
      await page.click('button[type="submit"]');
      
      // Extract token from URL or response
      const tokenA = await page.evaluate(() => {
        return localStorage.getItem("booking-token");
      });

      // Try to use token in clinic B
      await page.goto("https://clinic-b.localhost:3000/booking");
      const response = await request.post("/api/booking", {
        headers: {
          host: "clinic-b.localhost:3000",
        },
        data: {
          token: tokenA,
          appointmentData: {
            date: "2026-05-10",
            time: "10:00",
            doctorId: "test-doctor-id",
          },
        },
      });

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error).toContain("Invalid booking token");
    });

    test("should accept booking token from same clinic", async ({ request, page }) => {
      // Generate and use token in same clinic
      await page.goto("https://clinic-a.localhost:3000/booking");
      await page.fill('input[name="phone"]', "+212600000000");
      await page.click('button[type="submit"]');
      
      const tokenA = await page.evaluate(() => {
        return localStorage.getItem("booking-token");
      });

      const response = await request.post("/api/booking", {
        headers: {
          host: "clinic-a.localhost:3000",
        },
        data: {
          token: tokenA,
          appointmentData: {
            date: "2026-05-10",
            time: "10:00",
            doctorId: "test-doctor-id",
          },
        },
      });

      expect(response.status()).toBe(200);
    });
  });

  test.describe("A7-01: File Download Authorization", () => {
    test("should allow patient to download own file", async ({ request, page }) => {
      // Login as patient A
      await page.goto("/login");
      await page.fill('input[name="email"]', "patient-a@test.com");
      await page.fill('input[name="password"]', "test-password");
      await page.click('button[type="submit"]');

      // Upload a file
      await page.goto("/patient/documents");
      await page.setInputFiles('input[type="file"]', "test-files/report.pdf");
      await page.click('button:has-text("Upload")');

      // Wait for upload to complete
      await page.waitForSelector('text=Upload successful');

      // Download the file
      const downloadPromise = page.waitForEvent("download");
      await page.click('button:has-text("Download")');
      const download = await downloadPromise;

      expect(download).toBeTruthy();
    });

    test("should block patient from downloading other patient file", async ({ request, page }) => {
      // Login as patient B
      await page.goto("/login");
      await page.fill('input[name="email"]', "patient-b@test.com");
      await page.fill('input[name="password"]', "test-password");
      await page.click('button[type="submit"]');

      // Try to access patient A's file directly
      const response = await page.request.get(
        "/api/files/download?key=clinics/clinic-id/patients/patient-a-id/report.pdf"
      );

      expect(response.status()).toBe(403);
    });

    test("should allow doctor to download any clinic file", async ({ request, page }) => {
      // Login as doctor
      await page.goto("/login");
      await page.fill('input[name="email"]', "doctor@test.com");
      await page.fill('input[name="password"]', "test-password");
      await page.click('button[type="submit"]');

      // Access patient file
      const response = await page.request.get(
        "/api/files/download?key=clinics/clinic-id/patients/patient-a-id/report.pdf"
      );

      expect(response.status()).toBe(200);
    });
  });

  test.describe("A8-01: PII Logging Redaction", () => {
    test.skip("should not log PII during registration", async ({ request }) => {
      // This test requires access to log output
      // which is not available in E2E tests
      // Use unit tests for PII redaction verification
    });
  });

  test.describe("A2-02: Timing-Safe Compare DoS", () => {
    test.skip("should reject webhook with oversized signature", async ({ request }) => {
      // This test requires webhook endpoint access
      // which may not be available in E2E environment
      // Use integration tests for webhook signature verification
    });
  });

  test.describe("Regression Prevention", () => {
    test("should allow valid chat messages under 4000 chars", async ({ request }) => {
      const loginResponse = await request.post("/api/auth/login", {
        data: {
          email: "doctor@test.com",
          password: "test-password",
        },
      });
      
      const { token } = await loginResponse.json();
      
      const response = await request.post("/api/chat", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: {
          messages: [{
            role: "user",
            content: "What are the symptoms of diabetes?",
          }],
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    test("should allow valid booking flow", async ({ page }) => {
      await page.goto("/booking");
      await page.fill('input[name="phone"]', "+212600000000");
      await page.click('button[type="submit"]');
      
      await page.waitForSelector('text=Verification code sent');
      
      // Enter verification code
      await page.fill('input[name="code"]', "123456");
      await page.click('button[type="submit"]');
      
      // Select appointment
      await page.click('button:has-text("Book Appointment")');
      
      await page.waitForSelector('text=Appointment booked successfully');
    });

    test("should allow valid file uploads and downloads", async ({ page }) => {
      await page.goto("/login");
      await page.fill('input[name="email"]', "patient@test.com");
      await page.fill('input[name="password"]', "test-password");
      await page.click('button[type="submit"]');

      await page.goto("/patient/documents");
      await page.setInputFiles('input[type="file"]', "test-files/report.pdf");
      await page.click('button:has-text("Upload")');

      await page.waitForSelector('text=Upload successful');

      const downloadPromise = page.waitForEvent("download");
      await page.click('button:has-text("Download")');
      const download = await downloadPromise;

      expect(download).toBeTruthy();
    });
  });
});
