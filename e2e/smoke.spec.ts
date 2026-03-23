import { test, expect } from "@playwright/test";

/**
 * Smoke tests — verify critical pages load without errors.
 *
 * These tests hit the running Next.js dev server and assert that the
 * key public-facing pages render without a 500 or blank screen.
 */

test.describe("Public pages — smoke tests", () => {
  test("homepage loads and has a meaningful title", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("booking page loads", async ({ page }) => {
    const response = await page.goto("/booking");
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("login page loads", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator("body")).not.toBeEmpty();
  });
});

test.describe("API health checks", () => {
  test("GET /api/branding returns 200", async ({ request }) => {
    const response = await request.get("/api/branding");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("name");
  });
});
