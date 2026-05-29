import { test, expect } from "@playwright/test";

/**
 * E2E tests for telemedicine video consultation workflow.
 *
 * Adapted from MedCore's telemedicine E2E patterns — validates API
 * protection, session lifecycle, and page rendering.
 */

test.describe("Telemedicine — API access control", () => {
  test("GET /api/telemedicine returns 401 without auth", async ({ request }) => {
    const response = await request.get("/api/telemedicine");
    expect([401, 403, 404]).toContain(response.status());
  });

  test("POST /api/telemedicine rejects unauthenticated request", async ({ request }) => {
    const response = await request.post("/api/telemedicine", {
      data: {
        patient_id: "00000000-0000-0000-0000-000000000001",
        doctor_id: "00000000-0000-0000-0000-000000000002",
        scheduled_at: new Date().toISOString(),
      },
    });
    expect([401, 403, 404]).toContain(response.status());
  });

  test("PATCH /api/telemedicine/:id rejects unauthenticated update", async ({ request }) => {
    const response = await request.patch("/api/telemedicine/fake-id", {
      data: { status: "completed" },
    });
    expect([401, 403, 404]).toContain(response.status());
  });

  test("GET /api/telemedicine/:id rejects unauthenticated access", async ({ request }) => {
    const response = await request.get("/api/telemedicine/fake-id");
    expect([401, 403, 404]).toContain(response.status());
  });
});

test.describe("Telemedicine — Page smoke tests", () => {
  test("doctor telemedicine page requires authentication", async ({ page }) => {
    const response = await page.goto("/doctor/telemedicine");
    const url = page.url();
    const isProtected =
      url.includes("/login") ||
      url.includes("/auth") ||
      response?.status() === 401 ||
      response?.status() === 403 ||
      response?.status() === 404;
    expect(isProtected).toBeTruthy();
  });
});
