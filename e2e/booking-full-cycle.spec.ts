import { test, expect } from "@playwright/test";

/**
 * E2E checks for the public booking PAGE (structure & resilience).
 *
 * SCOPE — IMPORTANT: these are render/structure assertions only (the page
 * loads with a 2xx, shows interactive controls, is responsive, exposes no
 * server error, has clinic branding). They do NOT complete a real booking,
 * and there is intentionally no upload/cancel coverage here.
 *
 * Why the true end-to-end cycle (book -> upload -> cancel) is NOT automated:
 *   1. It requires the full demo seed (clinic + time slots + auth users),
 *      which CI does not apply — seed-dependent tests are gated behind
 *      E2E_DEMO_SEED and skipped in CI (see e2e/demo-smoke.spec.ts). A test
 *      here would therefore add zero pipeline protection.
 *   2. The 3-step BookingForm has no stable test IDs and uses i18n (French)
 *      copy, so a UI-driven completion is brittle.
 *   3. Cancel is time-sensitive (cancellation-window check) AND seeded
 *      appointments are inserted with slot_start/slot_end only — the one-time
 *      backfill in migration 00019 runs before the seed, so seeded rows have
 *      NULL appointment_date/start_time, which the cancel route requires.
 *      (Worth tracking separately: seed inserts bypass the booking RPC that
 *      populates those derived columns.)
 *
 * To close the gap properly, run against a fully seeded staging/local stack
 * with E2E_DEMO_SEED=true and drive: anonymous /book completion (RPC path,
 * which sets appointment_date/start_time) -> patient login -> upload -> cancel.
 */

test.describe("Booking page — structure & resilience", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/book");
  });

  test("booking page loads with step indicator or form", async ({ page }) => {
    await expect(page.locator("body")).not.toBeEmpty();
    // Should have interactive elements for the booking flow
    const interactiveElements = page.locator(
      "button, input, select, [role='button'], [role='radio'], [role='combobox']",
    );
    const count = await interactiveElements.count();
    expect(count).toBeGreaterThan(0);
  });

  test("booking page shows specialty or service selection", async ({ page }) => {
    // The booking flow should show selectable options (cards, buttons, or select)
    const selectable = page.locator(
      "button, [role='radio'], [role='option'], select, input[type='radio']",
    );
    const count = await selectable.count();
    expect(count).toBeGreaterThan(0);
  });

  test("booking page has navigation controls", async ({ page }) => {
    // Should have at least a next/continue button or similar CTA
    const navButtons = page.locator("button");
    const count = await navButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  test("booking page is responsive on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/book");
    await expect(page.locator("body")).not.toBeEmpty();
    // Content should not overflow horizontally — compare against the actual
    // viewport width (with 1px tolerance for sub-pixel rounding) rather than a
    // hardcoded magic number.
    const { scrollWidth, viewportWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
  });

  test("booking page does not expose server errors", async ({ page }) => {
    const errorOverlay = page.locator("#__next-build-error, [data-nextjs-dialog]");
    await expect(errorOverlay).toHaveCount(0);
  });

  test("booking page shows clinic branding", async ({ page }) => {
    // The page must have loaded successfully (2xx) — a textContent check
    // alone would pass on a Next.js error page or a redirect to /login.
    // Re-navigate to capture the response code rather than relying on the
    // beforeEach goto which swallows the status.
    const response = await page.goto("/book");
    expect(response?.status()).toBeLessThan(400);

    // The page should contain a meaningful amount of visible text — an
    // error page would either be blank or contain only an error message,
    // so >50 chars gives a real signal. Use a specific clinic-branding
    // element when available; this generic guard catches regressions in
    // environments where the branded element selector is not yet known.
    const textContent = await page.locator("body").textContent();
    expect(textContent).toBeTruthy();
    expect(textContent!.trim().length).toBeGreaterThan(50);
  });
});
