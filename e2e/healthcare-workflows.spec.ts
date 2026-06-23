import { test, expect } from "@playwright/test";

/**
 * Comprehensive E2E tests for healthcare workflows.
 *
 * Adapted from MedCore's 40-spec Playwright suite — covers cross-cutting
 * concerns: API consistency, error handling, RBAC enforcement, and
 * response shape validation across all new healthcare endpoints.
 */

test.describe("Healthcare API — Response shape consistency", () => {
  test("all new endpoints deny anonymous access with a standard { ok, error } shape", async ({
    request,
  }) => {
    const endpoints = ["/api/admissions", "/api/staff-invitations", "/api/insurance-claims"];

    for (const endpoint of endpoints) {
      const response = await request.get(endpoint);
      // Tenant-scoped collections MUST deny an anonymous caller. Assert this
      // unconditionally — a 200 (data leak) or 5xx (crash) is a real failure,
      // not a case to silently skip. Without this guard the body-shape check
      // below would never run on a leaking endpoint, masking the exact bug
      // this suite exists to catch.
      expect([401, 403]).toContain(response.status());
      const body = await response.json();
      expect(body).toHaveProperty("error");
    }
  });

  test("POST endpoints reject empty body gracefully", async ({ request }) => {
    const endpoints = ["/api/admissions", "/api/staff-invitations", "/api/insurance-claims"];

    for (const endpoint of endpoints) {
      const response = await request.post(endpoint, { data: {} });
      const status = response.status();
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(500);
    }
  });
});

test.describe("Healthcare API — PATCH endpoints require valid IDs", () => {
  test("PATCH with non-UUID ID returns 4xx", async ({ request }) => {
    const patchEndpoints = ["/api/admissions/not-a-uuid", "/api/insurance-claims/not-a-uuid"];

    for (const endpoint of patchEndpoints) {
      const response = await request.patch(endpoint, {
        data: { status: "completed" },
      });
      expect(response.status()).toBeGreaterThanOrEqual(400);
    }
  });
});

test.describe("Healthcare API — GET individual resources", () => {
  test("GET with non-existent UUID returns 4xx", async ({ request }) => {
    const endpoints = [
      "/api/admissions/00000000-0000-0000-0000-000000000000",
      "/api/insurance-claims/00000000-0000-0000-0000-000000000000",
    ];

    for (const endpoint of endpoints) {
      const response = await request.get(endpoint);
      expect(response.status()).toBeGreaterThanOrEqual(400);
    }
  });
});

test.describe("Healthcare pages — No server errors", () => {
  const pages = ["/", "/book", "/login"];

  for (const path of pages) {
    test(`${path} does not expose server errors`, async ({ page }) => {
      await page.goto(path);
      const errorOverlay = page.locator("#__next-build-error, [data-nextjs-dialog]");
      await expect(errorOverlay).toHaveCount(0);
    });
  }
});
