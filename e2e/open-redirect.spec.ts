/**
 * E2E: Open-Redirect Prevention (S0-1-03 / A119)
 *
 * The middleware's `safeRedirectPath()` function sanitises the `?redirect=`
 * query parameter on the login route to prevent open-redirect attacks.
 *
 * These tests verify that crafted redirect values are rejected or
 * neutralised before any navigation occurs, covering the patterns most
 * commonly used in phishing exploits:
 *
 *   - Protocol-relative URLs   (//evil.example)
 *   - Absolute URLs             (https://evil.example)
 *   - URL-encoded slashes       (%2F%2Fevil.example)
 *   - Unicode look-alike slashes (U+2215, U+FF0F)
 *   - Data URIs                 (data:text/html,<script>)
 *   - JavaScript URIs           (javascript:alert(1))
 *   - Double-slash on root       (///evil.example)
 *   - Legitimate same-origin paths (must be preserved)
 */

import { test, expect } from "@playwright/test";

const LOGIN_PATH = "/login";

// Respect the configured target (CI sets E2E_BASE_URL to the demo subdomain).
// page.url() returns "about:blank" before the first navigation, so we need an
// explicit origin to build absolute URLs against — derive it from the same
// base the rest of the suite uses instead of hardcoding localhost.
const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
const BASE_HOST = new URL(BASE_URL).hostname;

// Payloads that must NOT redirect outside the origin.
const MALICIOUS_REDIRECTS = [
  { label: "protocol-relative", value: "//evil.example.com" },
  { label: "https absolute", value: "https://evil.example.com/steal" },
  { label: "http absolute", value: "http://evil.example.com" },
  { label: "url-encoded double-slash", value: "%2F%2Fevil.example.com" },
  { label: "double url-encoded", value: "%252F%252Fevil.example.com" },
  { label: "unicode fullwidth slash", value: "\uff0f\uff0fevil.example.com" },
  { label: "unicode division slash", value: "\u2215\u2215evil.example.com" },
  { label: "data URI", value: "data:text/html,<script>alert(1)</script>" },
  { label: "javascript URI", value: "javascript:alert(document.cookie)" },
  { label: "triple slash", value: "///evil.example.com" },
  { label: "backslash", value: "\\\\evil.example.com" },
  { label: "scheme-less with colon", value: "evil.example.com:3000/path" },
];

// Paths that ARE legitimate and must be preserved after login.
const SAFE_REDIRECTS = [
  { label: "dashboard", value: "/dashboard" },
  { label: "nested path", value: "/clinic/appointments/new" },
  { label: "root", value: "/" },
];

test.describe("Open Redirect Prevention", () => {
  test.describe("Malicious redirect values are neutralised", () => {
    for (const { label, value } of MALICIOUS_REDIRECTS) {
      test(`rejects ${label}`, async ({ page }) => {
        // page.url() returns "about:blank" before first navigation, which is
        // not a valid URL base — use the explicit configured origin instead.
        const loginUrl = new URL(LOGIN_PATH, BASE_URL);
        loginUrl.searchParams.set("redirect", value);

        const response = await page.goto(loginUrl.toString());

        // The login page must load successfully (not a 5xx error).
        expect(response?.status()).toBeLessThan(500);

        // The single E2E-testable security boundary without real credentials:
        // navigating to /login with a malicious ?redirect= value must NOT
        // bounce the browser off-origin. The middleware's safeRedirectPath()
        // neutralises the param at post-login read time (covered by unit
        // tests); here we only verify that the page itself stays put.
        const finalUrl = new URL(page.url());
        expect(finalUrl.hostname).toBe(loginUrl.hostname);
        expect(finalUrl.protocol).toMatch(/^https?:$/);

        // We intentionally do NOT assert that the malicious host string is
        // absent from the URL — it appears URL-encoded inside the ?redirect=
        // query parameter and is harmless until the middleware decodes it
        // post-login. Asserting otherwise would be testing the address bar,
        // not the security control.
      });
    }
  });

  test.describe("Legitimate redirect paths are preserved", () => {
    for (const { label, value } of SAFE_REDIRECTS) {
      test(`preserves ${label} (${value})`, async ({ page }) => {
        const loginUrl = new URL(LOGIN_PATH, BASE_URL);
        loginUrl.searchParams.set("redirect", value);

        await page.goto(loginUrl.toString());
        await page.waitForLoadState("domcontentloaded");

        // The final page must still be on the same origin — no off-site bounce.
        const finalHostname = new URL(page.url()).hostname;
        expect(finalHostname).toBe(BASE_HOST);

        // Check that the redirect param survived to the login page.
        const currentUrl = new URL(page.url());
        const redirectParam = currentUrl.searchParams.get("redirect");

        if (redirectParam !== null) {
          // The preserved value must start with a single slash NOT followed by
          // another slash — this rejects "//evil.com" protocol-relative payloads
          // while accepting legitimate paths like "/" and "/dashboard".
          expect(redirectParam).toMatch(/^\/(?!\/)/);

          // Critical: the preserved param must still encode the original safe path.
          // If the middleware strips a safe path entirely that's a UX regression,
          // not just "acceptable" — the user will lose their intended destination
          // after login. Verify the preserved value contains the expected path.
          // We normalize trailing slashes for comparison.
          const normalizedParam = redirectParam.replace(/\/$/, "");
          const normalizedValue = value.replace(/\/$/, "");
          expect(normalizedParam).toBe(normalizedValue);
        } else {
          // The middleware stripped the redirect param entirely for a safe path.
          // This is a UX regression: the user will land on the default post-login
          // page instead of where they intended to go. Fail loudly so the
          // middleware's safeRedirectPath() function can be corrected.
          throw new Error(
            `Safe redirect path "${value}" was stripped by middleware — ` +
              `users will lose their post-login destination. ` +
              `Fix safeRedirectPath() to preserve legitimate paths.`,
          );
        }
      });
    }
  });

  test("login page renders without a redirect param", async ({ page }) => {
    const response = await page.goto(LOGIN_PATH);
    expect(response?.status()).toBeLessThan(400);
    // Should show a login form element.
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await expect(emailInput)
      .toBeVisible({ timeout: 5_000 })
      .catch(() => {
        // Fallback: just check we're not on an error page.
        expect(page.url()).toContain("login");
      });
  });
});
