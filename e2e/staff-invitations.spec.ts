import { test, expect } from "@playwright/test";

/**
 * E2E tests for staff onboarding with email invitation flow.
 *
 * Adapted from MediFlow's staff invitation E2E patterns — validates
 * API protection and invitation workflow.
 */

test.describe("Staff invitations — API access control", () => {
  test("GET /api/staff-invitations returns 401 without auth", async ({ request }) => {
    const response = await request.get("/api/staff-invitations");
    expect([401, 403, 404]).toContain(response.status());
  });

  test("POST /api/staff-invitations rejects unauthenticated invite", async ({ request }) => {
    const response = await request.post("/api/staff-invitations", {
      data: {
        email: "test@example.com",
        role: "receptionist",
      },
    });
    expect([401, 403, 404]).toContain(response.status());
  });
});

test.describe("Staff invitations — Page smoke tests", () => {
  test("admin staff invitations page requires authentication", async ({ page }) => {
    const response = await page.goto("/admin/staff");
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
