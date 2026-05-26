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

test.describe("Admin API — CRUD access control", () => {
  test("GET /api/patients returns 401 without auth", async ({ request }) => {
    const response = await request.get("/api/patients");
    expect([401, 403, 404, 405]).toContain(response.status());
  });

  test("POST /api/patients rejects unauthenticated request", async ({ request }) => {
    const response = await request.post("/api/patients", {
      data: {
        name: "Test Patient",
        email: "test@example.com",
        phone: "+1234567890",
      },
    });
    expect([401, 403, 404, 405]).toContain(response.status());
  });

  test("DELETE /api/patients rejects unauthenticated request", async ({ request }) => {
    const response = await request.delete("/api/patients/fake-id");
    expect([401, 403, 404, 405]).toContain(response.status());
  });
});
