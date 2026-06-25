import { test, expect } from "@playwright/test";

/**
 * E2E smoke tests for the patient booking page.
 *
 * These are the minimal "is the page alive?" checks. For deeper booking-flow
 * assertions (multi-step, mobile viewport, branding) see booking-full-cycle.spec.ts.
 */

test.describe("Booking flow — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/book");
  });

  test("booking page loads with a 2xx status and has interactive elements", async ({ page }) => {
    // Re-navigate to capture the response code (beforeEach swallows it).
    const response = await page.goto("/book");
    expect(response?.status()).toBeLessThan(400);

    await expect(page.locator("body")).not.toBeEmpty();

    // The page must render at least one interactive element — a blank or
    // error page would have none.
    const interactiveCount = await page.locator("button, input, select, [role='button']").count();
    expect(interactiveCount).toBeGreaterThan(0);
  });

  test("booking page does not expose server errors", async ({ page }) => {
    // Ensure no unhandled Next.js error overlay is shown
    const errorOverlay = page.locator("#__next-build-error, [data-nextjs-dialog]");
    await expect(errorOverlay).toHaveCount(0);
  });
});
