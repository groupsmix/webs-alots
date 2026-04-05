/**
 * AI Revenue Agent E2E Tests
 * 
 * Tests the complete AI workflow from dashboard to action execution
 */

import { test, expect } from '@playwright/test';

test.describe('AI Revenue Agent', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'test-password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin');
  });

  test('should display AI dashboard', async ({ page }) => {
    await page.goto('/admin/ai');
    
    // Check dashboard tab is visible
    await expect(page.locator('text=Dashboard')).toBeVisible();
    
    // Check key metrics are displayed
    await expect(page.locator('text=Total Actions')).toBeVisible();
    await expect(page.locator('text=Revenue Generated')).toBeVisible();
  });

  test('should navigate between tabs', async ({ page }) => {
    await page.goto('/admin/ai');
    
    // Click Approvals tab
    await page.click('text=Approvals');
    await expect(page.locator('text=Pending Actions')).toBeVisible();
    
    // Click Notifications tab
    await page.click('text=Notifications');
    await expect(page.locator('text=Notifications')).toBeVisible();
    
    // Click Health Score tab
    await page.click('text=Health Score');
    await expect(page.locator('text=Business Health Score')).toBeVisible();
    
    // Click Insights tab
    await page.click('text=Insights');
    await expect(page.locator('text=AI Insights')).toBeVisible();
    
    // Click Learning tab
    await page.click('text=Learning');
    await expect(page.locator('text=Learning Progress')).toBeVisible();
    
    // Click Settings tab
    await page.click('text=Settings');
    await expect(page.locator('text=AI Configuration')).toBeVisible();
  });

  test('should enable AI in settings', async ({ page }) => {
    await page.goto('/admin/ai?tab=settings');
    
    // Find and toggle AI enable switch
    const enableSwitch = page.locator('input[type="checkbox"]').first();
    await enableSwitch.click();
    
    // Save settings
    await page.click('button:has-text("Save")');
    
    // Check for success message
    await expect(page.locator('text=Settings saved')).toBeVisible({ timeout: 5000 });
  });

  test('should run manual analysis', async ({ page }) => {
    await page.goto('/admin/ai');
    
    // Click run analysis button
    await page.click('button:has-text("Run Analysis")');
    
    // Wait for analysis to complete
    await expect(page.locator('text=Analysis complete')).toBeVisible({ timeout: 30000 });
  });

  test('should display pending actions in approval queue', async ({ page }) => {
    await page.goto('/admin/ai?tab=approvals');
    
    // Check if approval queue is visible
    await expect(page.locator('text=Pending Actions')).toBeVisible();
    
    // Check for action cards or empty state
    const hasActions = await page.locator('[data-testid="action-card"]').count();
    if (hasActions > 0) {
      // Check action details are visible
      await expect(page.locator('text=Risk Level')).toBeVisible();
      await expect(page.locator('text=Confidence')).toBeVisible();
    } else {
      await expect(page.locator('text=No pending actions')).toBeVisible();
    }
  });

  test('should approve an action', async ({ page }) => {
    await page.goto('/admin/ai?tab=approvals');
    
    // Check if there are any pending actions
    const actionCount = await page.locator('[data-testid="action-card"]').count();
    
    if (actionCount > 0) {
      // Click approve button on first action
      await page.locator('button:has-text("Approve")').first().click();
      
      // Check for success message
      await expect(page.locator('text=Action approved')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should display notifications', async ({ page }) => {
    await page.goto('/admin/ai?tab=notifications');
    
    // Check notifications panel is visible
    await expect(page.locator('text=Notifications')).toBeVisible();
    
    // Check for filter buttons
    await expect(page.locator('button:has-text("All")')).toBeVisible();
    await expect(page.locator('button:has-text("Unread")')).toBeVisible();
  });

  test('should display health score', async ({ page }) => {
    await page.goto('/admin/ai?tab=health');
    
    // Check health score is visible
    await expect(page.locator('text=Business Health Score')).toBeVisible();
    
    // Check for score display
    await expect(page.locator('text=Category Breakdown')).toBeVisible();
  });

  test('should display insights', async ({ page }) => {
    await page.goto('/admin/ai?tab=insights');
    
    // Check insights panel is visible
    await expect(page.locator('text=AI Insights')).toBeVisible();
    
    // Check for filter buttons
    await expect(page.locator('button:has-text("All")')).toBeVisible();
    await expect(page.locator('button:has-text("Pending")')).toBeVisible();
  });

  test('should display learning metrics', async ({ page }) => {
    await page.goto('/admin/ai?tab=learning');
    
    // Check learning metrics are visible
    await expect(page.locator('text=Learning Progress')).toBeVisible();
    
    // Check for key metrics
    await expect(page.locator('text=Total Outcomes')).toBeVisible();
    await expect(page.locator('text=Success Rate')).toBeVisible();
  });

  test('should create a campaign', async ({ page }) => {
    await page.goto('/admin/ai');
    
    // Navigate to campaigns (if there's a campaigns section)
    const hasCampaigns = await page.locator('text=Campaigns').count();
    
    if (hasCampaigns > 0) {
      await page.click('text=Campaigns');
      
      // Click create campaign button
      await page.click('button:has-text("Create Campaign")');
      
      // Fill campaign form
      await page.fill('input[name="name"]', 'Test Campaign');
      await page.selectOption('select[name="type"]', 'reengagement');
      
      // Submit form
      await page.click('button:has-text("Create")');
      
      // Check for success
      await expect(page.locator('text=Campaign created')).toBeVisible({ timeout: 5000 });
    }
  });
});
