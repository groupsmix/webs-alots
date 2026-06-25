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
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(/\S/);
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("booking page loads", async ({ page }) => {
    const response = await page.goto("/book");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("login page loads", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).not.toBeEmpty();
  });
});

test.describe("API health checks", () => {
  test("GET /api/branding returns 200", async ({ request }) => {
    const response = await request.get("/api/branding");
    expect(response.status()).toBe(200);
    const body = await response.json();
    // The API returns { ok: true, data: { name, ... } } via apiSuccess()
    expect(body).toHaveProperty("ok", true);
    expect(body).toHaveProperty("data");
    expect(body.data).toHaveProperty("name");
  });

  test("GET /api/health returns 200 with a valid structured body", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);

    // The body must be parseable JSON. A plain-text "OK" or empty response
    // would not be caught by downstream monitoring that expects structured output.
    const body = await response.json().catch(() => null);
    expect(body).not.toBeNull();

    // The health endpoint must explicitly report ok:true. A 200 with
    // { ok: false } (e.g. degraded DB connectivity) must be surfaced so
    // alerting tools that only check the HTTP status don't miss it.
    expect(body).toHaveProperty("ok", true);
  });
});
