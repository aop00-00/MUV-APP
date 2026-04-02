import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('should load the landing page', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('should redirect unauthenticated users from admin', async ({ page }) => {
    await page.goto('http://localhost:5173/admin/schedule');
    // Without auth, should not show admin content
    await expect(page).not.toHaveURL(/\/admin\/schedule/);
  });
});
