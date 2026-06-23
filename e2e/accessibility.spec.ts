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
 * Known exclusions (EXCLUDED_RULES) — each must be justified here:
 * - color-contrast: clinic admins can set arbitrary brand colors at runtime,
 *   so contrast cannot be asserted statically against fixed expected values in
 *   this generic crawl. The server enforces WCAG AA contrast via
 *   `meetsWCAG_AA` + `WCAG_SAFE_DEFAULTS` (src/lib/contrast.ts), which is
 *   unit-tested. Re-enable here once tests run against a fixed-palette tenant.
 * - aria-prohibited-attr: shadcn/radix components set aria-describedby on
 *   elements where axe 4.11 considers it prohibited (upstream false positive).
 * - aria-valid-attr-value: same shadcn/radix source; transient values during
 *   hydration trip this rule before the DOM settles.
 *
 * TODO(a11y): track removing these exclusions in docs/accessibility-conformance.md.
 */

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const EXCLUDED_RULES = ["color-contrast", "aria-prohibited-attr", "aria-valid-attr-value"];

/**
 * Navigate and wait for any client-side redirects to finish before
 * running axe-core. The middleware may redirect (e.g., no-tenant → root,
 * auth → dashboard) which destroys the execution context mid-analysis.
 */
async function stableGoto(page: import("@playwright/test").Page, path: string) {
  // Navigate and wait for the full page load including server-side redirects.
  await page.goto(path, { waitUntil: "load" });
  // Wait for React hydration to complete and any client-side redirects to
  // settle. The middleware or Next.js Router may navigate after hydration,
  // destroying the execution context if axe-core starts mid-navigation.
  // Poll until no navigation occurs within a 500ms window.
  let lastUrl = page.url();
  let stable = false;
  for (let i = 0; i < 6 && !stable; i++) {
    await page.waitForTimeout(250);
    const currentUrl = page.url();
    if (currentUrl === lastUrl) {
      stable = true;
    }
    lastUrl = currentUrl;
  }
}

/**
 * Run axe-core analysis with retry on navigation-destroyed contexts.
 * Next.js client-side routing may trigger a navigation even after
 * stableGoto, destroying the execution context mid-analyze().
 */
async function analyzeWithRetry(
  page: import("@playwright/test").Page,
  options?: { include?: string },
) {
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      let builder = new AxeBuilder({ page }).withTags(AXE_TAGS).disableRules(EXCLUDED_RULES);
      if (options?.include) {
        builder = builder.include(options.include);
      } else {
        for (const sel of DECORATIVE_SELECTORS) builder = builder.exclude(sel);
      }
      return await builder.analyze();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Execution context was destroyed") && attempt < maxRetries - 1) {
        // Wait for the new page to finish loading after navigation
        await page.waitForLoadState("load");
        await page.waitForTimeout(300);
        continue;
      }
      throw err;
    }
  }
  throw new Error("analyzeWithRetry: exhausted retries");
}

const DECORATIVE_SELECTORS = [
  ".decorative-gradient",
  ".brand-watermark",
  "[data-decorative='true']",
];

test.describe("Accessibility — WCAG 2.2 AA", () => {
  test("public landing page has no critical a11y violations", async ({ page }) => {
    await stableGoto(page, "/");
    const results = await analyzeWithRetry(page);
    expect(results.violations).toEqual([]);
  });

  test("booking page has no critical a11y violations", async ({ page }) => {
    await stableGoto(page, "/book");
    const results = await analyzeWithRetry(page);
    expect(results.violations).toEqual([]);
  });

  test("login page has no critical a11y violations", async ({ page }) => {
    await stableGoto(page, "/login");
    const results = await analyzeWithRetry(page);
    expect(results.violations).toEqual([]);
  });

  test("privacy policy page has no critical a11y violations", async ({ page }) => {
    await stableGoto(page, "/privacy");
    const results = await analyzeWithRetry(page);
    expect(results.violations).toEqual([]);
  });

  test("cookie consent banner has no critical a11y violations", async ({ page }) => {
    // Clear consent to force the banner to appear.
    // Navigate to root and wait for any redirects to finish before
    // interacting with localStorage (avoids context-destroyed errors).
    await stableGoto(page, "/");
    // Retry localStorage clear in case a late navigation fires.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await page.evaluate(() => localStorage.removeItem("cookie-consent"));
        break;
      } catch {
        await page.waitForLoadState("load");
        await page.waitForTimeout(300);
      }
    }
    // Reload can race with a late middleware/auth redirect that detaches
    // the frame (ERR_ABORTED). Retry once after a brief settle so the
    // redirect lands before we reload.
    try {
      await page.reload({ waitUntil: "load" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/ERR_ABORTED|frame was detached/i.test(msg)) {
        await page.waitForLoadState("load").catch(() => {});
        await page.waitForTimeout(500);
        await page.reload({ waitUntil: "load" });
      } else {
        throw err;
      }
    }
    await page.waitForFunction(() => document.readyState === "complete");

    // Scope analysis to the consent banner. We cleared consent and reloaded
    // above, so the banner MUST be present — assert its visibility rather than
    // guarding the analysis behind an `if`, which would let the test pass
    // without checking anything if the banner ever stopped rendering.
    const banner = page.locator("#cookie-consent-banner");
    await expect(banner).toBeVisible();
    const results = await analyzeWithRetry(page, { include: "#cookie-consent-banner" });
    expect(results.violations).toEqual([]);
  });
});
