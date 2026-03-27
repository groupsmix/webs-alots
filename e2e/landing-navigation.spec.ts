import { test, expect } from "@playwright/test";

/**
 * E2E tests for landing page navigation and structure.
 *
 * Verifies that the SaaS landing page (root domain) renders all
 * key sections and that navigation links work correctly.
 */

test.describe("Landing page — navigation & structure", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("header contains navigation links", async ({ page }) => {
    const nav = page.locator('nav[aria-label="Navigation principale"]');
    await expect(nav).toBeVisible();

    // Should have links to key sections
    await expect(nav.locator('a[href="/#fonctionnalites"]')).toBeVisible();
    await expect(nav.locator('a[href="/#comment-ca-marche"]')).toBeVisible();
    await expect(nav.locator('a[href="/#demo"]')).toBeVisible();
    await expect(nav.locator('a[href="/pricing"]')).toBeVisible();
  });

  test("header has login and signup CTAs", async ({ page }) => {
    await expect(page.locator('a[href="/login"]').first()).toBeVisible();
    await expect(page.locator('a[href="/register"]').first()).toBeVisible();
  });

  test("hero section renders with CTA buttons", async ({ page }) => {
    // Primary CTA (register)
    const registerCta = page.locator('a[href="/register"]').first();
    await expect(registerCta).toBeVisible();

    // Secondary CTA (how it works anchor)
    const howCta = page.locator('a[href="#comment-ca-marche"]');
    await expect(howCta).toBeVisible();
  });

  test("features section has anchor id", async ({ page }) => {
    const features = page.locator("#fonctionnalites");
    await expect(features).toBeAttached();
  });

  test("how-it-works section has anchor id", async ({ page }) => {
    const howSection = page.locator("#comment-ca-marche");
    await expect(howSection).toBeAttached();
  });

  test("demo section has anchor id", async ({ page }) => {
    const demo = page.locator("#demo");
    await expect(demo).toBeAttached();
  });

  test("footer contains key links", async ({ page }) => {
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();

    await expect(footer.locator('a[href="/about"]')).toBeVisible();
    await expect(footer.locator('a[href="/pricing"]')).toBeVisible();
    await expect(footer.locator('a[href="/contact"]')).toBeVisible();
    await expect(footer.locator('a[href="/login"]')).toBeVisible();
  });

  test("pricing link navigates to pricing page", async ({ page }) => {
    const pricingLink = page
      .locator('nav[aria-label="Navigation principale"]')
      .locator('a[href="/pricing"]');
    await pricingLink.click();
    await page.waitForURL("/pricing");
    await expect(page.locator("h1")).toBeVisible();
  });
});
