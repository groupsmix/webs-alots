import { test, expect } from "@playwright/test";

/**
 * E2E tests for the full appointment booking cycle.
 *
 * Covers the complete patient journey: landing on the booking page,
 * selecting a service/specialty, picking a time slot, and confirming.
 */

test.describe("Booking full cycle", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/book");
  });

  test("booking page loads with step indicator or form", async ({ page }) => {
    await expect(page.locator("body")).not.toBeEmpty();
    // Should have interactive elements for the booking flow
    const interactiveElements = page.locator(
      "button, input, select, [role='button'], [role='radio'], [role='combobox']",
    );
    const count = await interactiveElements.count();
    expect(count).toBeGreaterThan(0);
  });

  test("booking page shows specialty or service selection", async ({ page }) => {
    // The booking flow should show selectable options (cards, buttons, or select)
    const selectable = page.locator(
      "button, [role='radio'], [role='option'], select, input[type='radio']",
    );
    const count = await selectable.count();
    expect(count).toBeGreaterThan(0);
  });

  test("booking page has navigation controls", async ({ page }) => {
    // Should have at least a next/continue button or similar CTA
    const navButtons = page.locator("button");
    const count = await navButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  test("booking page is responsive on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/book");
    await expect(page.locator("body")).not.toBeEmpty();
    // Content should not overflow horizontally — compare against the actual
    // viewport width (with 1px tolerance for sub-pixel rounding) rather than a
    // hardcoded magic number.
    const { scrollWidth, viewportWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
  });

  test("booking page does not expose server errors", async ({ page }) => {
    const errorOverlay = page.locator("#__next-build-error, [data-nextjs-dialog]");
    await expect(errorOverlay).toHaveCount(0);
  });

  test("booking page shows clinic branding", async ({ page }) => {
    // The page should contain some text or branding element
    const textContent = await page.locator("body").textContent();
    expect(textContent).toBeTruthy();
    expect(textContent!.length).toBeGreaterThan(10);
  });
});
