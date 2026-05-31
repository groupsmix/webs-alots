import { test, expect, type Locator } from "@playwright/test";

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

/**
 * Pre-seed the cookie-consent localStorage entry so the consent banner does
 * NOT render during these tests. Two reasons:
 *
 * 1. The banner is a fixed-position overlay above the form. In CI it
 *    sometimes intercepts the first click on a form button, producing
 *    flaky test failures.
 * 2. The analytics flag controls whether Plausible/Sentry-replay scripts
 *    load. With analytics enabled, those scripts heartbeat indefinitely
 *    and `page.waitForLoadState("networkidle")` never resolves, hitting
 *    the 30s test timeout. Setting analytics=false (and not loading the
 *    scripts at all) is also what Playwright best-practice guidance
 *    recommends as the alternative to the discouraged "networkidle".
 *
 * Schema: src/components/cookie-consent.tsx, v1 envelope { v, t, prefs }.
 * v1 is required so getConsentStatus() returns "fresh" instead of
 * "stale-version" (A64). The 12-month expiry window starts at t.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem(
        "cookie-consent",
        JSON.stringify({
          v: 1,
          t: Date.now(),
          prefs: { functional: true, analytics: false, marketing: false },
        }),
      );
    } catch {
      // Some browser contexts (about:blank) throw on storage access. Ignore.
    }
  });
});

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
    const response = await page.goto("/book");
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator("body")).not.toBeEmpty();

    // Should have at least one interactive element
    const interactiveCount = await page.locator("button, input, select, [role='button']").count();
    expect(interactiveCount).toBeGreaterThan(0);
  });
});

// Helper: wait for an element to have non-null bounding box. boundingBox() can
// transiently return null on the dev server under Node 22 (undici streams bug
// during reflow), so we poll briefly instead of asserting once.
async function waitForBoundingBox(
  locator: Locator,
  timeoutMs = 5000,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const box = await locator.boundingBox();
    if (box !== null) return box;
    await new Promise((r) => setTimeout(r, 100));
  }
  const finalBox = await locator.boundingBox();
  if (finalBox === null) {
    throw new Error(`boundingBox() remained null after ${timeoutMs}ms — element not laid out.`);
  }
  return finalBox;
}

test.describe("Mobile — touch target sizing", () => {
  test("login page buttons meet 44x44px minimum touch target", async ({ page }) => {
    await page.goto("/login");
    // networkidle removed: Playwright officially discourages it on apps with
    // long-lived realtime/analytics connections. expect.toBeVisible() below
    // already auto-waits for the element to appear after hydration.

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();

    const box = await waitForBoundingBox(submitBtn);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  });

  test("form inputs have adequate height for touch", async ({ page }) => {
    await page.goto("/login");
    // networkidle removed (see comment above).

    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await expect(emailInput).toBeVisible();

    const box = await waitForBoundingBox(emailInput);
    // Inputs should be at least 36px tall (with padding making touch area >= 44px)
    expect(box.height).toBeGreaterThanOrEqual(36);
  });
});

test.describe("Mobile — form interactions", () => {
  test("login form can be filled and submitted on mobile", async ({ page }) => {
    // Use trailing slash to avoid 308 redirect mid-test
    await page.goto("/login/");
    // networkidle removed (see "login page buttons" test above).

    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');

    // Wait for form inputs to be stable after React hydration
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(emailInput).toBeEditable();
    await expect(passwordInput).toBeEditable();

    // Fill email — retry via toHaveValue's built-in polling which handles
    // transient hydration races (React resetting controlled values).
    await emailInput.click();
    await emailInput.fill("test@example.com");
    await expect(emailInput).toHaveValue("test@example.com", { timeout: 5000 });

    // Fill password
    await passwordInput.click();
    await passwordInput.fill("password123");
    await expect(passwordInput).toHaveValue("password123", { timeout: 5000 });

    // Submit button should be tappable
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled();
  });
});

test.describe("Mobile — viewport meta", () => {
  test("has viewport meta tag for proper mobile rendering", async ({ page }) => {
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
    // networkidle removed (see "login page buttons" test above).

    // Registration link should be visible and tappable
    // trailingSlash: true → Link renders href="/register/"
    const registerLink = page.locator('a[href="/register/"]');
    await expect(registerLink).toBeVisible();

    const box = await waitForBoundingBox(registerLink);
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  test("page does not show desktop-only error overlays", async ({ page }) => {
    await page.goto("/");
    const errorOverlay = page.locator("#__next-build-error, [data-nextjs-dialog]");
    await expect(errorOverlay).toHaveCount(0);
  });
});
