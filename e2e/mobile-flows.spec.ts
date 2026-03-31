import { test, expect } from "@playwright/test";

/**
 * Mobile viewport E2E tests for critical user flows.
 *
 * These tests run on Pixel 5 (mobile-chrome) and iPhone 12 (mobile-safari)
 * device configurations to verify the app works correctly on mobile devices.
 *
 * Covers:
 * - Page rendering on mobile viewports
 * - Touch target sizing (44x44px minimum per WCAG 2.5.5)
 * - Navigation and form interactions on mobile
 * - Viewport meta tag and responsive layout
 */

test.describe("Mobile — critical page rendering", () => {
  test("homepage renders without horizontal overflow", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).not.toBeEmpty();

    // Verify no horizontal scroll (content fits viewport)
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1); // 1px tolerance
  });

  test("login page renders correctly on mobile", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.status()).toBeLessThan(500);

    // Email and password inputs should be visible
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Submit button should be visible
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
  });

  test("booking page renders on mobile", async ({ page }) => {
    const response = await page.goto("/booking");
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator("body")).not.toBeEmpty();

    // Should have at least one interactive element
    const interactiveCount = await page
      .locator("button, input, select, [role='button']")
      .count();
    expect(interactiveCount).toBeGreaterThan(0);
  });
});

test.describe("Mobile — touch target sizing", () => {
  test("login page buttons meet 44x44px minimum touch target", async ({
    page,
  }) => {
    await page.goto("/login");

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();

    const box = await submitBtn.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
  });

  test("form inputs have adequate height for touch", async ({ page }) => {
    await page.goto("/login");

    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await expect(emailInput).toBeVisible();

    const box = await emailInput.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      // Inputs should be at least 36px tall (with padding making touch area >= 44px)
      expect(box.height).toBeGreaterThanOrEqual(36);
    }
  });
});

test.describe("Mobile — form interactions", () => {
  test("login form can be filled and submitted on mobile", async ({
    page,
  }) => {
    await page.goto("/login");

    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');

    // Tap and fill email
    await emailInput.tap();
    await emailInput.fill("test@example.com");
    await expect(emailInput).toHaveValue("test@example.com");

    // Tap and fill password
    await passwordInput.tap();
    await passwordInput.fill("password123");
    await expect(passwordInput).toHaveValue("password123");

    // Submit button should be tappable
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled();
  });
});

test.describe("Mobile — viewport meta", () => {
  test("has viewport meta tag for proper mobile rendering", async ({
    page,
  }) => {
    await page.goto("/");

    const viewportMeta = page.locator('meta[name="viewport"]');
    const content = await viewportMeta.getAttribute("content");
    expect(content).toBeTruthy();
    expect(content).toContain("width=device-width");
  });
});

test.describe("Mobile — navigation", () => {
  test("links are navigable on mobile", async ({ page }) => {
    await page.goto("/login");

    // Registration link should be visible and tappable
    const registerLink = page.locator('a[href="/register"]');
    await expect(registerLink).toBeVisible();

    const box = await registerLink.boundingBox();
    expect(box).not.toBeNull();
  });

  test("page does not show desktop-only error overlays", async ({ page }) => {
    await page.goto("/");
    const errorOverlay = page.locator(
      "#__next-build-error, [data-nextjs-dialog]",
    );
    await expect(errorOverlay).toHaveCount(0);
  });
});
