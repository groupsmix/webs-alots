import { test, expect } from "@playwright/test";

/**
 * CSP regression tests — verify that critical pages serve the enforced strict
 * Content-Security-Policy header and that the legacy Report-Only header has
 * been removed (Task 2.2).
 */

const CRITICAL_PAGES = [
  { name: "homepage", path: "/" },
  { name: "booking", path: "/book" },
  { name: "login", path: "/login" },
];

/**
 * `buildCsp` (src/lib/middleware/security-headers.ts) intentionally omits
 * `upgrade-insecure-requests`, `report-uri`, and `report-to` when
 * `NODE_ENV === "development"`. The Playwright config runs `next dev`
 * (development mode) for local runs and `next start` (production mode) only
 * in CI or when `E2E_BASE_URL` points at an external server.
 *
 * Mirror that gate here so production-only directives are asserted only when
 * the test target is actually a production build.
 */
const IS_PRODUCTION_TARGET = !!process.env.CI || !!process.env.E2E_BASE_URL;

test.describe("CSP header enforcement", () => {
  for (const { name, path } of CRITICAL_PAGES) {
    test(`${name} (${path}) serves enforced strict CSP`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response).not.toBeNull();
      expect(response!.status()).toBeLessThan(500);

      const csp = response!.headers()["content-security-policy"];
      expect(csp, "Content-Security-Policy header must be present").toBeTruthy();

      // Strict policy markers
      expect(csp).toContain("'strict-dynamic'");
      expect(csp).toContain("'nonce-");
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      if (IS_PRODUCTION_TARGET) {
        expect(csp).toContain("upgrade-insecure-requests");
      }

      // Legacy wildcards must NOT appear in the strict policy
      expect(csp).not.toContain("*.supabase.co");
      expect(csp).not.toContain("*.googleapis.com");
    });

    test(`${name} (${path}) does NOT serve Content-Security-Policy-Report-Only`, async ({
      page,
    }) => {
      const response = await page.goto(path);
      expect(response).not.toBeNull();

      const reportOnly = response!.headers()["content-security-policy-report-only"];
      expect(reportOnly, "Content-Security-Policy-Report-Only must not be present").toBeFalsy();
    });
  }

  test("CSP nonce rotates per request", async ({ page }) => {
    // Bust the HTTP cache per navigation so each request actually reaches the
    // server. Without a unique query param the second goto could be served
    // from the browser cache and return the *same* nonce, masking a real
    // "nonce never rotates" regression.
    const extractNonce = async () => {
      const response = await page.goto(`/?cb=${Date.now()}-${Math.random()}`);
      expect(response).not.toBeNull();

      // Verify the response was not served from a CDN/browser cache. A cached
      // response would carry the same nonce, making the rotation comparison
      // useless. Cloudflare Workers sets Cache-Control on HTML responses; if
      // the header says "private" or "no-store" we know the server generated
      // this response fresh.
      const cacheControl = response!.headers()["cache-control"] ?? "";
      const xCacheStatus = (
        response!.headers()["cf-cache-status"] ??
        response!.headers()["x-cache"] ??
        ""
      ).toLowerCase();

      // If the response was served from cache (HIT), the nonce comparison is
      // meaningless. Warn but don't hard-fail — the CDN layer is not present
      // in most test environments; the check is a safety net for CI runs
      // against production-like targets.
      if (xCacheStatus === "hit") {
        console.warn(
          "CSP nonce rotation: response served from CDN cache — nonce may not have rotated. " +
            "Ensure the HTML page is configured as Cache-Control: private or no-store.",
        );
      }

      const csp = response!.headers()["content-security-policy"] ?? "";
      const match = csp.match(/'nonce-([^']+)'/);
      return match?.[1] ?? "";
    };

    const nonce1 = await extractNonce();
    const nonce2 = await extractNonce();

    expect(nonce1).toBeTruthy();
    expect(nonce2).toBeTruthy();
    expect(nonce1).not.toBe(nonce2);
  });
});
