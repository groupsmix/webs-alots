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
    const errorOverlay = page.locator("#__next-build-error, [data-nextjs-dialog]");
    await expect(errorOverlay).toHaveCount(0);
  });

  test("displays all four subscription plans", async ({ page }) => {
    // Four plan cards, identified by a stable test id (not styling).
    await expect(page.locator('[data-testid="pricing-plan-card"]')).toHaveCount(4);
    // Plan names are fixed English brand names (locale-independent).
    const planNames = ["Free", "Starter", "Professional", "Enterprise"];
    for (const name of planNames) {
      await expect(page.locator("h3").filter({ hasText: name })).toBeVisible();
    }
  });

  test("highlights the Professional plan as popular", async ({ page }) => {
    // Locale-agnostic: assert the badge element on the professional card,
    // rather than matching translated "Populaire"/"Popular" text.
    const popularCard = page.locator(
      '[data-testid="pricing-plan-card"][data-plan-id="professional"]',
    );
    await expect(popularCard.locator('[data-testid="pricing-popular-badge"]')).toBeVisible();
  });

  test("free plan has a signup CTA", async ({ page }) => {
    // trailingSlash: true → Link renders href="/register/"
    const registerLinks = page.locator('a[href="/register/"]');
    await expect(registerLinks.first()).toBeVisible();
  });

  test("FAQ section is visible", async ({ page }) => {
    // The FAQ section should have exactly four questions (stable test id).
    await expect(page.locator('[data-testid="pricing-faq-item"]')).toHaveCount(4);
  });
});
