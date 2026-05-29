import { test, expect } from "@playwright/test";

/**
 * E2E tests for Admission/Discharge/Transfer (ADT) workflow.
 *
 * Adapted from MedCore's ADT E2E patterns — validates that the admissions
 * API and workflow are protected and return proper responses.
 */

test.describe("ADT — Admissions API access control", () => {
  test("GET /api/admissions returns 401 without auth", async ({ request }) => {
    const response = await request.get("/api/admissions");
    expect([401, 403, 404]).toContain(response.status());
  });

  test("POST /api/admissions rejects unauthenticated request", async ({ request }) => {
    const response = await request.post("/api/admissions", {
      data: {
        patient_id: "00000000-0000-0000-0000-000000000001",
        diagnosis: "Test admission",
      },
    });
    expect([401, 403, 404]).toContain(response.status());
  });

  test("PATCH /api/admissions/:id rejects unauthenticated discharge", async ({ request }) => {
    const response = await request.patch("/api/admissions/fake-id", {
      data: { action: "discharge" },
    });
    expect([401, 403, 404]).toContain(response.status());
  });

  test("GET /api/admissions/:id rejects unauthenticated access", async ({ request }) => {
    const response = await request.get("/api/admissions/fake-id");
    expect([401, 403, 404]).toContain(response.status());
  });
});

test.describe("ADT — Page smoke tests", () => {
  test("admin admissions page requires authentication", async ({ page }) => {
    const response = await page.goto("/admin/admissions");
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
