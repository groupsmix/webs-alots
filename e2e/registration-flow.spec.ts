import { test, expect } from "@playwright/test";

/**
 * E2E tests for patient registration flow.
 *
 * Covers form rendering, validation, and navigation.
 */

test.describe("Registration flow", () => {
  test.beforeEach(async ({ page }) => {
    // Pre-seed cookie-consent so the consent banner does not render and
    // intercept the first click on form controls. The banner is a fixed
    // overlay above the auth form; without this seed, the test
    // "shows validation on empty form submission" intermittently observes
    // 0 invalid inputs because the click hits the banner instead of the
    // submit button. Schema: src/components/cookie-consent.tsx, v1
    // envelope { v, t, prefs } (A64). v1 ensures getConsentStatus()
    // returns "fresh" rather than "stale-version".
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
        // about:blank or storage-disabled context. Ignore.
      }
    });
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

    // At least one input should show validation (native or custom).
    // Web-first assertion (auto-retrying) instead of a one-shot count():
    // the old count() raced the service-worker first-install reload
    // (sw-register.tsx) and intermittently observed an empty DOM while
    // the page was reloading / re-hydrating.
    const invalidInputs = page.locator("input:invalid, [aria-invalid='true']");
    await expect(invalidInputs.first()).toBeVisible();
  });

  test("has link to login page", async ({ page }) => {
    // trailingSlash: true → Link renders href="/login/"
    const loginLink = page.locator('a[href="/login/"]');
    await expect(loginLink).toBeVisible();
  });

  test("email field validates format", async ({ page }) => {
    // The registration form always renders a type="email" input; assert it is
    // present (rather than guarding with `if count > 0`, which would silently
    // pass if the field were missing) and then verify native format validation.
    const emailInput = page.locator('input[type="email"]').first();
    await expect(emailInput).toBeVisible();
    await emailInput.fill("not-an-email");
    // Check browser-level validity on the email input itself
    const isInvalid = await emailInput.evaluate((el) => !(el as HTMLInputElement).validity.valid);
    expect(isInvalid).toBe(true);
  });
});
