import { test, expect } from "@playwright/test";

/**
 * E2E tests for the login flow.
 *
 * Covers email + password login, error states, and navigation to
 * forgot-password and registration pages.
 */

test.describe("Login flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("login page renders with email and password fields", async ({ page }) => {
    const body = page.locator("body");
    await expect(body).not.toBeEmpty();

    // Should have email and password inputs
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test("login page has a submit button", async ({ page }) => {
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
  });

  test("shows validation error for empty email submission", async ({ page }) => {
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Browser-native or custom validation should prevent submission
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const isInvalid =
      (await emailInput.getAttribute("aria-invalid")) === "true" ||
      (await emailInput.evaluate((el) => !(el as HTMLInputElement).checkValidity()));
    expect(isInvalid).toBe(true);
  });

  test("shows error for invalid credentials", async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');

    await emailInput.fill("invalid@example.com");
    await passwordInput.fill("wrongpassword123");

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Wait for an error message to appear
    const errorMessage = page.locator('[role="alert"], .text-red-500, .text-destructive, [data-testid="error"]');
    await expect(errorMessage.first()).toBeVisible({ timeout: 10_000 });
  });

  test("has link to registration page", async ({ page }) => {
    const registerLink = page.locator('a[href="/register"]');
    await expect(registerLink).toBeVisible();
  });

  test("password field masks input", async ({ page }) => {
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    const inputType = await passwordInput.getAttribute("type");
    expect(inputType).toBe("password");
  });

  test("login page does not expose server errors", async ({ page }) => {
    const errorOverlay = page.locator("#__next-build-error, [data-nextjs-dialog]");
    await expect(errorOverlay).toHaveCount(0);
  });
});
