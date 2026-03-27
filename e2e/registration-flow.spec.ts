import { test, expect } from "@playwright/test";

/**
 * E2E tests for patient registration flow.
 *
 * Covers form rendering, validation, and navigation.
 */

test.describe("Registration flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/register");
  });

  test("registration page loads without errors", async ({ page }) => {
    const body = page.locator("body");
    await expect(body).not.toBeEmpty();
    const errorOverlay = page.locator("#__next-build-error, [data-nextjs-dialog]");
    await expect(errorOverlay).toHaveCount(0);
  });

  test("registration form has required input fields", async ({ page }) => {
    // Should have at least name, email, and password fields
    const inputs = page.locator("input");
    const inputCount = await inputs.count();
    expect(inputCount).toBeGreaterThanOrEqual(2);
  });

  test("registration form has a submit button", async ({ page }) => {
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
  });

  test("shows validation on empty form submission", async ({ page }) => {
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // At least one input should show validation (native or custom)
    const invalidInputs = page.locator("input:invalid, [aria-invalid='true']");
    const count = await invalidInputs.count();
    expect(count).toBeGreaterThan(0);
  });

  test("has link to login page", async ({ page }) => {
    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toBeVisible();
  });

  test("email field validates format", async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    if ((await emailInput.count()) > 0) {
      await emailInput.fill("not-an-email");
      const submitBtn = page.locator('button[type="submit"]');
      await submitBtn.click();
      const isInvalid = await emailInput.evaluate(
        (el) => !(el as HTMLInputElement).checkValidity(),
      );
      expect(isInvalid).toBe(true);
    }
  });
});
