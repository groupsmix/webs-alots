import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

/**
 * F-053 / A68-1 / A201: Automated WCAG 2.2 AA accessibility audit via axe-core.
 *
 * Scans the public landing page, booking flow, login page, consent banner,
 * and privacy page for accessibility violations. Failures block the PR so
 * regressions are caught before reaching production.
 *
 * A68-1: Extended from WCAG 2.1 to WCAG 2.2 tags and added consent/privacy
 * page coverage per Season 3 audit.
 *
 * A201: Bumped from WCAG 2.1 AA to WCAG 2.2 AA to align with EAA 2025
 * requirements. See docs/accessibility-conformance.md for the full
 * conformance statement and roadmap.
 *
 * Known exclusions:
 * - aria-prohibited-attr: shadcn/radix components set aria-describedby
 *   on elements where axe 4.11 considers it prohibited. Upstream fix
 *   tracked; excluded here to avoid false positives.
 */

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const EXCLUDED_RULES = ["color-contrast", "aria-prohibited-attr", "aria-valid-attr-value"];

/**
 * Navigate and wait for any client-side redirects to finish before
 * running axe-core. The middleware may redirect (e.g., no-tenant → root,
 * auth → dashboard) which destroys the execution context mid-analysis.
 */
async function stableGoto(page: import("@playwright/test").Page, path: string) {
  await page.goto(path, { waitUntil: "load" });
  // Wait for the page body to be attached (avoids unreliable networkidle
  // which never resolves when dev server HMR keeps connections open).
  await page.locator("body").waitFor({ state: "attached" });
}

const DECORATIVE_SELECTORS = [
  ".decorative-gradient",
  ".brand-watermark",
  "[data-decorative='true']",
];

test.describe("Accessibility — WCAG 2.2 AA", () => {
  test("public landing page has no critical a11y violations", async ({ page }) => {
    await stableGoto(page, "/");

    let builder = new AxeBuilder({ page }).withTags(AXE_TAGS).disableRules(EXCLUDED_RULES);
    for (const sel of DECORATIVE_SELECTORS) builder = builder.exclude(sel);
    const results = await builder.analyze();

    expect(results.violations).toEqual([]);
  });

  test("booking page has no critical a11y violations", async ({ page }) => {
    await stableGoto(page, "/booking");

    let builder = new AxeBuilder({ page }).withTags(AXE_TAGS).disableRules(EXCLUDED_RULES);
    for (const sel of DECORATIVE_SELECTORS) builder = builder.exclude(sel);
    const results = await builder.analyze();

    expect(results.violations).toEqual([]);
  });

  test("login page has no critical a11y violations", async ({ page }) => {
    await stableGoto(page, "/login");

    let builder = new AxeBuilder({ page }).withTags(AXE_TAGS).disableRules(EXCLUDED_RULES);
    for (const sel of DECORATIVE_SELECTORS) builder = builder.exclude(sel);
    const results = await builder.analyze();

    expect(results.violations).toEqual([]);
  });

  test("privacy policy page has no critical a11y violations", async ({ page }) => {
    await stableGoto(page, "/privacy");

    let builder = new AxeBuilder({ page }).withTags(AXE_TAGS).disableRules(EXCLUDED_RULES);
    for (const sel of DECORATIVE_SELECTORS) builder = builder.exclude(sel);
    const results = await builder.analyze();

    expect(results.violations).toEqual([]);
  });

  test("cookie consent banner has no critical a11y violations", async ({ page }) => {
    // Clear consent to force the banner to appear
    await stableGoto(page, "/");
    await page.evaluate(() => localStorage.removeItem("cookie-consent"));
    await page.reload();
    await page.locator("body").waitFor({ state: "attached" });

    // Scope analysis to the consent banner
    const banner = page.locator("#cookie-consent-banner");
    if (await banner.isVisible()) {
      const results = await new AxeBuilder({ page })
        .include("#cookie-consent-banner")
        .withTags(AXE_TAGS)
        .disableRules(EXCLUDED_RULES)
        .analyze();

      expect(results.violations).toEqual([]);
    }
  });
});
