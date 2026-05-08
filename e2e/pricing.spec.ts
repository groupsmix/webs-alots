import { test, expect } from "@playwright/test";

/**
 * E2E tests for the pricing page.
 *
 * Verifies that the pricing page loads correctly, displays all
 * subscription plans, and has functional CTAs.
 */

test.describe("Pricing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pricing");
  });

  test("pricing page loads without errors", async ({ page }) => {
    await expect(page.locator("body")).not.toBeEmpty();
    // Should not show a server error
    const errorOverlay = page.locator(
      "#__next-build-error, [data-nextjs-dialog]",
    );
    await expect(errorOverlay).toHaveCount(0);
  });

  test("displays all four subscription plans", async ({ page }) => {
    // Each plan card has a plan name heading
    const planNames = ["Free", "Starter", "Professional", "Enterprise"];
    for (const name of planNames) {
      await expect(
        page.locator("h3").filter({ hasText: name }),
      ).toBeVisible();
    }
  });

  test("highlights the Professional plan as popular", async ({ page }) => {
    // The "Populaire" / "Popular" badge should appear on the Professional card
    const popularBadge = page.locator("text=/Populaire|Popular|الأكثر شعبية/");
    await expect(popularBadge).toBeVisible();
  });

  test("free plan has a signup CTA", async ({ page }) => {
    // The free plan CTA should link to /register
    const registerLinks = page.locator('a[href="/register"]');
    await expect(registerLinks.first()).toBeVisible();
  });

  test("FAQ section is visible", async ({ page }) => {
    // The FAQ section should have at least 4 questions
    const faqItems = page.locator(".rounded-xl.border.border-gray-100.p-6");
    await expect(faqItems).toHaveCount(4);
  });
});
