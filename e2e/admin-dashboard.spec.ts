import { test, expect } from "@playwright/test";

/**
 * E2E tests for admin dashboard pages.
 *
 * Since these pages require authentication, we test that:
 * 1. Unauthenticated access redirects to login
 * 2. Dashboard pages exist and respond correctly
 * 3. API endpoints return proper auth errors for unauthorized access
 */

test.describe("Admin dashboard — access control", () => {
  test("admin dashboard redirects unauthenticated users to login", async ({ page }) => {
    const response = await page.goto("/admin/dashboard");
    const url = page.url();
    const isRedirected = url.includes("/login") || url.includes("/auth");
    const isBlocked = response?.status() === 401 || response?.status() === 403;
    expect(isRedirected || isBlocked).toBeTruthy();
  });

  test("admin patients page requires authentication", async ({ page }) => {
    const response = await page.goto("/admin/patients");
    const url = page.url();
    const isProtected =
      url.includes("/login") ||
      url.includes("/auth") ||
      response?.status() === 401 ||
      response?.status() === 403;
    expect(isProtected).toBeTruthy();
  });

  test("admin appointments page requires authentication", async ({ page }) => {
    const response = await page.goto("/admin/appointments");
    const url = page.url();
    const isProtected =
      url.includes("/login") ||
      url.includes("/auth") ||
      response?.status() === 401 ||
      response?.status() === 403;
    expect(isProtected).toBeTruthy();
  });
});

test.describe("Admin API — patient-data access control", () => {
  // NOTE: there is no `/api/patients` REST collection — staff patient data is
  // served by the auth-gated `/api/patient/*` routes. These tests target the
  // real endpoints so a regression in their auth gating is actually caught.
  test("GET /api/patient/timeline returns auth error without auth", async ({ request }) => {
    const response = await request.get("/api/patient/timeline");
    expect([401, 403]).toContain(response.status());
  });

  test("GET /api/patient/insurance-profile requires auth", async ({ request }) => {
    const response = await request.get("/api/patient/insurance-profile");
    expect([401, 403]).toContain(response.status());
  });

  test("POST /api/patient/insurance-profile rejects unauthenticated request", async ({
    request,
  }) => {
    const response = await request.post("/api/patient/insurance-profile", {
      data: {
        insurance_type: "CNSS",
        policy_number: "TEST123",
      },
    });
    expect([401, 403]).toContain(response.status());
  });
});
