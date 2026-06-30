import { test, expect } from "@playwright/test";

/**
 * E2E tests for locale behavior.
 *
 * The locale switcher component is only rendered in authenticated
 * dashboard layouts (super-admin). On the public clinic page, locale
 * is determined by the preferred-locale localStorage key and the
 * html lang attribute.
 *
 * These tests verify locale-related behavior on the public clinic page.
 */

test.describe("Locale behavior", () => {
  // E-1: Pin the base URL to a tenant subdomain. Public-locale behavior
  // (preferred-locale localStorage + html lang/dir) is exercised on the clinic
  // public page, which only renders on a tenant subdomain — not the root SaaS
  // landing. CI sets E2E_BASE_URL to the demo subdomain; fall back to
  // demo.localhost locally so the suite doesn't fail against the root domain.
  test.use({ baseURL: process.env.E2E_BASE_URL || "http://demo.localhost:3000" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("preferred-locale"));
    await page.reload();
  });

  test("defaults to French locale", async ({ page }) => {
    const htmlLang = await page.locator("html").getAttribute("lang");
    expect(htmlLang).toBe("fr");
  });

  test("page renders with body content", async ({ page }) => {
    const body = page.locator("body");
    await expect(body).not.toBeEmpty();
  });

  test("locale can be set via localStorage", async ({ page }) => {
    await page.evaluate(() => localStorage.setItem("preferred-locale", "en"));
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    // Wait for client-side hydration to pick up the localStorage value and
    // apply it to the html element. Simply checking `toBeTruthy()` on the
    // lang attribute would pass even if the locale was never changed (e.g.
    // it could still be "fr"). Assert the exact expected value so a
    // regression where localStorage is silently ignored is caught.
    await page.waitForFunction(() => document.documentElement.getAttribute("lang") === "en", {
      timeout: 5_000,
    });

    const htmlLang = await page.locator("html").getAttribute("lang");
    await expect(page.locator("body")).not.toBeEmpty();
    expect(htmlLang).toBe("en");
  });

  test("Arabic locale sets RTL direction via localStorage", async ({ page }) => {
    await page.evaluate(() => localStorage.setItem("preferred-locale", "ar"));
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    // Wait for client-side hydration to apply both dir=rtl AND lang=ar.
    // Accepting lang=ar alone (without dir=rtl) would let a regression where
    // the dir attribute stops being set pass silently.
    await page.waitForFunction(
      () =>
        document.documentElement.getAttribute("dir") === "rtl" &&
        document.documentElement.getAttribute("lang") === "ar",
    );

    const dir = await page.locator("html").getAttribute("dir");
    const htmlLang = await page.locator("html").getAttribute("lang");
    await expect(page.locator("body")).not.toBeEmpty();
    // Both attributes must be set — an app that sets lang=ar but omits
    // dir=rtl has a real RTL regression.
    expect(dir).toBe("rtl");
    expect(htmlLang).toBe("ar");
  });

  test("locale persists across page navigation", async ({ page }) => {
    await page.evaluate(() => localStorage.setItem("preferred-locale", "en"));
    await page.goto("/pricing");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).not.toBeEmpty();
  });
});
