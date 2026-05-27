import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

/**
 * F-053: Automated WCAG 2.1 AA accessibility audit via axe-core.
 *
 * Scans the public landing page, booking flow, and login page for
 * accessibility violations. Failures block the PR so regressions are
 * caught before reaching production.
 *
 * Known exclusions:
 * - color-contrast: Some brand colours are intentionally low-contrast
 *   on decorative elements; the core content meets AA. We exclude the
 *   rule here and rely on manual design review for contrast.
 * - aria-prohibited-attr: shadcn/radix components set aria-describedby
 *   on elements where axe 4.11 considers it prohibited. Upstream fix
 *   tracked; excluded here to avoid false positives.
 */

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test.describe("Accessibility — WCAG 2.1 AA", () => {
  test("public landing page has no critical a11y violations", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(AXE_TAGS)
      .disableRules(["color-contrast", "aria-prohibited-attr"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("booking page has no critical a11y violations", async ({ page }) => {
    await page.goto("/booking");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(AXE_TAGS)
      .disableRules(["color-contrast", "aria-prohibited-attr"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("login page has no critical a11y violations", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(AXE_TAGS)
      .disableRules(["color-contrast", "aria-prohibited-attr"])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
