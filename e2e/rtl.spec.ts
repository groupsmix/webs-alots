import { test, expect } from "@playwright/test";

// Derive the cookie domain and origin from the configured base URL so SSR-side
// RTL is exercised across environments. Hardcoding domain "localhost" meant the
// cookie was never sent when E2E_BASE_URL targeted a subdomain (CI uses
// demo.localhost) or a remote host, silently skipping the SSR path.
const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
const BASE_HOST = new URL(BASE_URL).hostname;

test.describe("RTL (Arabic) Layout Smoke Tests", () => {
  // Set both cookie and localStorage to trigger Arabic locale.
  // The server reads the cookie for SSR; the client reads localStorage.
  test.use({
    storageState: {
      cookies: [
        {
          name: "preferred-locale",
          value: "ar",
          domain: BASE_HOST,
          path: "/",
          httpOnly: false,
          secure: false,
          sameSite: "Lax",
          expires: -1,
        },
      ],
      origins: [
        {
          origin: BASE_URL,
          localStorage: [
            {
              name: "preferred-locale",
              value: "ar",
            },
          ],
        },
      ],
    },
  });

  test("Auth pages should render with RTL direction", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    // Wait for client-side hydration to apply dir attribute
    await page.waitForFunction(() => document.documentElement.dir === "rtl", null, {
      timeout: 10_000,
    });

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");

    // Register page (use trailing slash to avoid 308 redirect)
    await page.goto("/register/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForFunction(() => document.documentElement.dir === "rtl", null, {
      timeout: 10_000,
    });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("Booking flow should support RTL", async ({ page }) => {
    await page.goto("/book");
    await page.waitForLoadState("domcontentloaded");

    // Wait for client-side hydration
    await page.waitForFunction(() => document.documentElement.dir === "rtl", null, {
      timeout: 10_000,
    });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("Public page should support RTL", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Wait for client-side hydration
    await page.waitForFunction(() => document.documentElement.dir === "rtl", null, {
      timeout: 10_000,
    });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });
});
