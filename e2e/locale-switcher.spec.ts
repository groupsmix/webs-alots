import { test, expect } from "@playwright/test";

/**
 * E2E tests for the locale switcher.
 *
 * Verifies that the language switcher works on the landing page,
 * translates content correctly, and persists the locale choice.
 */

test.describe("Locale switcher", () => {
  test.beforeEach(async ({ page }) => {
    // Clear any stored locale preference
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("preferred-locale"));
    await page.reload();
  });

  test("locale switcher is visible in the header", async ({ page }) => {
    const switcher = page.locator('button[aria-label="Switch language"]');
    await expect(switcher).toBeVisible();
  });

  test("defaults to French locale", async ({ page }) => {
    // The page should be in French by default
    const htmlLang = await page.locator("html").getAttribute("lang");
    expect(htmlLang).toBe("fr");
  });

  test("switching to English translates the hero", async ({ page }) => {
    // Open locale switcher
    const switcher = page.locator('button[aria-label="Switch language"]');
    await switcher.click();

    // Select English
    const englishOption = page.locator("button").filter({ hasText: "English" });
    await englishOption.click();

    // Verify English content appears
    await expect(
      page.locator("text=The complete platform to manage your"),
    ).toBeVisible();

    // HTML lang attribute should update
    const htmlLang = await page.locator("html").getAttribute("lang");
    expect(htmlLang).toBe("en");
  });

  test("switching to Arabic sets RTL direction", async ({ page }) => {
    // Open locale switcher
    const switcher = page.locator('button[aria-label="Switch language"]');
    await switcher.click();

    // Select Arabic
    const arabicOption = page
      .locator("button")
      .filter({ hasText: "العربية" });
    await arabicOption.click();

    // HTML dir attribute should be RTL
    const dir = await page.locator("html").getAttribute("dir");
    expect(dir).toBe("rtl");

    // HTML lang should be "ar"
    const htmlLang = await page.locator("html").getAttribute("lang");
    expect(htmlLang).toBe("ar");
  });

  test("locale choice persists across page navigation", async ({ page }) => {
    // Switch to English
    const switcher = page.locator('button[aria-label="Switch language"]');
    await switcher.click();
    const englishOption = page.locator("button").filter({ hasText: "English" });
    await englishOption.click();

    // Navigate to pricing page
    await page.goto("/pricing");

    // Should still be in English
    const htmlLang = await page.locator("html").getAttribute("lang");
    expect(htmlLang).toBe("en");

    // Pricing page content should be in English (or at least rendered)
    await expect(page.locator("body")).not.toBeEmpty();
  });
});
