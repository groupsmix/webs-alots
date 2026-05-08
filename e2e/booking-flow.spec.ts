import { test, expect } from "@playwright/test";

/**
 * E2E tests for the patient booking flow.
 *
 * These tests cover the core appointment booking journey that patients
 * go through on the public-facing website.
 */

test.describe("Booking flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/booking");
  });

  test("booking page shows service selection or appointment form", async ({
    page,
  }) => {
    // The booking page should render either a service picker or a
    // date/time selector — the exact UI depends on clinic config.
    const body = page.locator("body");
    await expect(body).not.toBeEmpty();

    // Should have at least one interactive element (button, input, or select)
    const interactiveCount = await page
      .locator("button, input, select, [role='button']")
      .count();
    expect(interactiveCount).toBeGreaterThan(0);
  });

  test("booking page does not expose server errors", async ({ page }) => {
    // Ensure no unhandled Next.js error overlay is shown
    const errorOverlay = page.locator("#__next-build-error, [data-nextjs-dialog]");
    await expect(errorOverlay).toHaveCount(0);
  });
});
