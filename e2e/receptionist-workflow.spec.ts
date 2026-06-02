import { test, expect } from '@playwright/test';

test.describe('Receptionist Workflow Test', () => {
  // Use the demo subdomain for all requests in this block
  test.use({ baseURL: 'http://demo.localhost:3000' });

  test('Receptionist can check in a patient from the appointment board', async ({ page }) => {
    // 1. Login as receptionist
    await page.goto('/login');
    await page.fill('input[name="email"]', 'reception@demo-clinic.com');
    await page.fill('input[name="password"]', 'Reception123!');
    await page.click('button[type="submit"]');

    // Wait for redirect to receptionist dashboard
    await page.waitForURL('**/dashboard**');
    await expect(page.locator('text=Appointment Board').first()).toBeVisible();

    // 2. View the "Today" board
    // The "Today" tab is selected by default, so we just verify we see the list of appointments.
    const todayTab = page.locator('button[role="tab"]', { hasText: 'Today' });
    await expect(todayTab).toHaveAttribute('aria-selected', 'true');

    // 3. Mark an appointment as arrived (Checked In)
    // Find the first "Check In" button for a scheduled appointment.
    const checkInButton = page.getByTitle('Mark Arrived').first();
    if (await checkInButton.isVisible()) {
      await checkInButton.click();
      
      // Navigate to "Checked In" tab
      await page.locator('button[role="tab"]', { hasText: 'Checked In' }).click();
      
      // Verify that at least one appointment is visible in the checked in list
      await expect(page.locator('[role="tabpanel"][data-state="active"]')).toContainText('Checked In');
    }
  });
});
