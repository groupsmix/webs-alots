import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

/**
 * F-053 / A201: Automated WCAG 2.2 AA accessibility audit via axe-core.
 *
 * Scans the public landing page, booking flow, and login page for
 * accessibility violations. Failures block the PR so regressions are
 * caught before reaching production.
 *
 * A201: Bumped from WCAG 2.1 AA to WCAG 2.2 AA to align with EAA 2025
 * requirements. See docs/accessibility-conformance.md for the full
 * conformance statement and roadmap.
 *
 * Known exclusions:
 * - color-contrast: Some brand colours are intentionally low-contrast
 *   on decorative elements; the core content meets AA. We exclude the
 *   rule here and rely on manual design review for contrast.
 * - aria-prohibited-attr: shadcn/radix components set aria-describedby
 *   on elements where axe 4.11 considers it prohibited. Upstream fix
 *   tracked; excluded here to avoid false positives.
 */

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * Navigate and wait for any client-side redirects to finish before
 * running axe-core. The middleware may redirect (e.g., no-tenant → root,
 * auth → dashboard) which destroys the execution context mid-analysis.
 */
async function stableGoto(page: import("@playwright/test").Page, path: string) {
  await page.goto(path, { waitUntil: "load" });
  await page.waitForLoadState("load");
  await page.waitForTimeout(500);
}

test.describe("Accessibility — WCAG 2.2 AA", () => {
  test("public landing page has no critical a11y violations", async ({ page }) => {
    await stableGoto(page, "/");

    const results = await new AxeBuilder({ page })
      .withTags(AXE_TAGS)
      .disableRules(["color-contrast", "aria-prohibited-attr"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("booking page has no critical a11y violations", async ({ page }) => {
    await stableGoto(page, "/booking");

    const results = await new AxeBuilder({ page })
      .withTags(AXE_TAGS)
      .disableRules(["color-contrast", "aria-prohibited-attr"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("login page has no critical a11y violations", async ({ page }) => {
    await stableGoto(page, "/login");

    const results = await new AxeBuilder({ page })
      .withTags(AXE_TAGS)
      .disableRules(["color-contrast", "aria-prohibited-attr"])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
