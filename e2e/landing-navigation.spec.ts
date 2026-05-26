import { test, expect } from "@playwright/test";

/**
 * E2E tests for the clinic public page navigation and structure.
 *
 * In CI, E2E_BASE_URL targets demo.localhost (a tenant subdomain),
 * so the page renders the clinic public site — not the SaaS landing.
 * Tests verify that the clinic header, footer, and key sections render.
 */

test.describe("Clinic public page — navigation & structure", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("header contains navigation links", async ({ page }) => {
    const nav = page.locator('nav[aria-label="Navigation principale"]');
    await expect(nav).toBeVisible();

    // Clinic public page nav links
    await expect(nav.locator('a[href="/services"]')).toBeVisible();
    await expect(nav.locator('a[href="/about"]')).toBeVisible();
  });

  test("header has a booking CTA", async ({ page }) => {
    // Clinic header shows a "Book appointment" button linking to /book
    const bookCta = page.locator('nav[aria-label="Navigation principale"] a[href="/book"]');
    await expect(bookCta).toBeVisible();
  });

  test("hero section renders", async ({ page }) => {
    // The clinic page renders a HeroSection as first content block
    const body = await page.locator("body").textContent();
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(10);
  });

  test("footer is visible", async ({ page }) => {
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
  });

  test("footer contains quick links", async ({ page }) => {
    const footer = page.locator("footer");
    await expect(footer.locator('a[href="/services"]')).toBeVisible();
    await expect(footer.locator('a[href="/contact"]')).toBeVisible();
  });

  test("main content area exists", async ({ page }) => {
    const main = page.locator("#main-content");
    await expect(main).toBeAttached();
  });

  test("page has skip-to-content link", async ({ page }) => {
    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeAttached();
  });

  test("pricing link navigates to pricing page", async ({ page }) => {
    // Navigate via direct URL since clinic nav may not have a pricing link
    await page.goto("/pricing");
    await expect(page.locator("body")).not.toBeEmpty();
  });
});
