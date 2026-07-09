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
    const endpoints = ["/api/staff-invitations", "/api/clinic-owner/insurance-claims"];

    for (const endpoint of endpoints) {
      const response = await request.get(endpoint);
      // Tenant-scoped collections MUST deny an anonymous caller with an auth
      // error (401/403). Auth runs before any body parsing or data access, so:
      //   - 200 is a data leak — real failure
      //   - 5xx is a crash — real failure
      //   - 404 would mean the route no longer exists and is no longer guarded
      //   - 422 would mean auth was skipped and validation ran first
      // Only 401/403 is acceptable here.
      expect([401, 403]).toContain(response.status());
      const body = await response.json();
      expect(body).toHaveProperty("error");
    }
  });

  test("POST endpoints are auth-gated before body parsing", async ({ request }) => {
    // Auth (withAuth / withAuthValidation) runs before Zod validation, so an
    // unauthenticated POST must be denied with 401 or 403 — never 422
    // (validation ran, meaning auth was skipped) or 200/5xx.
    // Playwright's request API sends no Origin header, so CSRF middleware may
    // also fire first and return 403 — that is equally acceptable.
    const endpoints = ["/api/staff-invitations", "/api/clinic-owner/insurance-claims"];

    for (const endpoint of endpoints) {
      const response = await request.post(endpoint, { data: {} });
      const status = response.status();
      // 401 = auth required, 403 = CSRF or forbidden. Both are correct.
      // 404/422/5xx would indicate a real regression.
      expect([401, 403]).toContain(status);
    }
  });
});

test.describe("Healthcare API — PATCH endpoints are auth-gated", () => {
  test("PATCH is denied before ID or body validation runs", async ({ request }) => {
    // withAuth / withAuthValidation rejects an anonymous caller (401/403)
    // BEFORE the route reads the id or body. A 404 (route missing), 422
    // (validation ran, auth was skipped), or 5xx (crash) would all be
    // real regressions.
    const patchEndpoints = ["/api/clinic-owner/insurance-claims/not-a-uuid"];

    for (const endpoint of patchEndpoints) {
      const response = await request.patch(endpoint, {
        data: { status: "completed" },
      });
      expect([401, 403]).toContain(response.status());
    }
  });
});

test.describe("Healthcare API — GET individual resources are auth-gated", () => {
  test("GET by UUID is denied before any data access", async ({ request }) => {
    // Auth runs first — anonymous caller must never reach DB (200 leak) or
    // trigger a server crash (5xx). 404 is also rejected because a missing
    // route would indicate the protection prefix was silently removed.
    const endpoints = ["/api/clinic-owner/insurance-claims/00000000-0000-0000-0000-000000000000"];

    for (const endpoint of endpoints) {
      const response = await request.get(endpoint);
      expect([401, 403]).toContain(response.status());
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
