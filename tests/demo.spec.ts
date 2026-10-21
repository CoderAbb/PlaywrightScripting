import { test, expect } from '@playwright/test';
import { PLAYWRIGHT_URL } from '../pages/LoginPage.js';

test('hastitle @title', async ({ page }) => {
  await page.goto(PLAYWRIGHT_URL);

  await expect(page).toHaveTitle(/Playwright/);
});

test('getstarted @link', async ({ page }) => {
  await page.goto(PLAYWRIGHT_URL);

  await page.getByRole('link', { name: 'Get started' }).click();

  await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
});
