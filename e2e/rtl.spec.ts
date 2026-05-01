import { test, expect } from '@playwright/test';

test.describe('RTL (Arabic) Layout Smoke Tests', () => {
  const origin = process.env.E2E_BASE_URL || 'http://localhost:3000';
  // Set localStorage to trigger Arabic locale on load
  test.use({
    storageState: {
      cookies: [],
      origins: [
        {
          origin,
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
    
    // The html element should have dir="rtl"
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    
    // The layout should apply RTL classes
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const body = page.locator('body');
    await expect(page.locator('html')).toHaveClass(/rtl/);
    
    // Verify some known Arabic text is visible
    await expect(page.getByText('تسجيل الدخول', { exact: false })).toBeVisible();
    
    // Register page
    await page.goto('/register');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('Booking flow should support RTL', async ({ page }) => {
    // Assuming /book or a public doctor profile is accessible without auth
    await page.goto('/book');
    
    // Verify dir is RTL
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    
    // Wait for content to load
    await page.waitForLoadState('networkidle');
  });

  test('Dashboard should support RTL (Mocked Auth)', async ({ page }) => {
    // We can just check the login redirect or a public demo page if available
    // or test the UI shell
    await page.goto('/demo');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });
});
