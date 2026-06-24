import { test, expect } from "@playwright/test";

/**
 * E2E tests for insurance claim review workflow.
 *
 * Adapted from Health-Pay's claim review E2E patterns — validates
 * API protection, CNSS/CNOPS/AMO/RAMED claim lifecycle.
 */

test.describe("Insurance claims — API access control", () => {
  test("GET /api/insurance-claims returns 401 without auth", async ({ request }) => {
    const response = await request.get("/api/insurance-claims");
    expect([401, 403]).toContain(response.status());
  });

  test("POST /api/insurance-claims rejects unauthenticated request", async ({ request }) => {
    const response = await request.post("/api/insurance-claims", {
      data: {
        patient_id: "00000000-0000-0000-0000-000000000001",
        insurance_type: "CNSS",
        claimed_amount_centimes: 50000,
        line_items: [{ description: "Consultation", quantity: 1, unit_price_centimes: 50000 }],
      },
    });
    expect([401, 403]).toContain(response.status());
  });

  test("PATCH /api/insurance-claims/:id rejects unauthenticated review", async ({ request }) => {
    // withAuth short-circuits to 401 (or 403) before the id/validation logic
    // runs, so a missing route (404) would be a real regression — assert tightly.
    const response = await request.patch("/api/insurance-claims/fake-id", {
      data: { status: "approved", approved_amount_centimes: 50000 },
    });
    expect([401, 403]).toContain(response.status());
  });

  test("GET /api/insurance-claims/:id rejects unauthenticated access", async ({ request }) => {
    const response = await request.get("/api/insurance-claims/fake-id");
    expect([401, 403]).toContain(response.status());
  });
});

test.describe("Insurance claims — Page smoke tests", () => {
  test("admin insurance claims page requires authentication", async ({ page }) => {
    const response = await page.goto("/admin/insurance-claims");
    const url = page.url();
    // /admin/* is a PROTECTED_PREFIXES route, so middleware redirects an
    // anonymous caller to /login before a 404 can be returned. 404 is
    // rejected so a prefix-protection regression can't pass silently.
    const isProtected =
      url.includes("/login") ||
      url.includes("/auth") ||
      response?.status() === 401 ||
      response?.status() === 403;
    expect(isProtected).toBeTruthy();
  });
});
