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

  test("GET /api/health returns a valid structured body with a real status", async ({
    request,
  }) => {
    const response = await request.get("/api/health");

    // The endpoint returns 503 only when a dependency is fully down
    // ("unhealthy"); "healthy" and "degraded" both return 200. Accept both
    // so a degraded-but-up environment (e.g. CI without R2/AI configured)
    // doesn't fail the smoke run, while a hard outage (503) is still allowed
    // to surface as a distinct state below.
    expect([200, 503]).toContain(response.status());

    // The body must be parseable JSON. A plain-text "OK" or empty response
    // would not be caught by downstream monitoring that expects structured output.
    const body = await response.json().catch(() => null);
    expect(body).not.toBeNull();

    // apiSuccess() always wraps the payload as { ok: true, data: {...} }, so
    // `body.ok` is the envelope flag — NOT the health verdict. The actual
    // health state lives in body.data.status; assert on that.
    expect(body).toHaveProperty("ok", true);
    expect(body).toHaveProperty("data");
    expect(["healthy", "degraded", "unhealthy"]).toContain(body.data.status);

    // The HTTP status and the reported health verdict must agree: a 503 must
    // correspond to "unhealthy", and a 200 must never report "unhealthy".
    if (response.status() === 503) {
      expect(body.data.status).toBe("unhealthy");
    } else {
      expect(body.data.status).not.toBe("unhealthy");
    }
  });
});
