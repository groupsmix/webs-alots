import { test, expect } from '@playwright/test';

test.describe('RTL (Arabic) Layout Smoke Tests', () => {
  // Set both cookie and localStorage to trigger Arabic locale.
  // The server reads the cookie for SSR; the client reads localStorage.
  test.use({
    storageState: {
      cookies: [
        {
          name: 'preferred-locale',
          value: 'ar',
          domain: 'localhost',
          path: '/',
          httpOnly: false,
          secure: false,
          sameSite: 'Lax',
          expires: -1,
        }
      ],
      origins: [
        {
          origin: process.env.E2E_BASE_URL || 'http://localhost:3000',
          localStorage: [
            {
              name: 'preferred-locale',
              value: 'ar'
            }
          ]
        }
      ]
    }
  });

  test('Auth pages should render with RTL direction', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    // Wait for client-side hydration to apply dir attribute
    await page.waitForFunction(() => document.documentElement.dir === 'rtl', null, { timeout: 10_000 });

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');

    // Register page (use trailing slash to avoid 308 redirect)
    await page.goto('/register/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => document.documentElement.dir === 'rtl', null, { timeout: 10_000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('Booking flow should support RTL', async ({ page }) => {
    await page.goto('/book');
    await page.waitForLoadState('domcontentloaded');

    // Wait for client-side hydration
    await page.waitForFunction(() => document.documentElement.dir === 'rtl', null, { timeout: 10_000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('Public page should support RTL', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for client-side hydration
    await page.waitForFunction(() => document.documentElement.dir === 'rtl', null, { timeout: 10_000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });
});
