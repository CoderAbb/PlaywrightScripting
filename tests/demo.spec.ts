import { test, expect } from '@playwright/test';
import { PLAYWRIGHT_URL } from '../global-setup.js';

test('hastitle @title', async ({ page }) => {
  await page.goto(PLAYWRIGHT_URL);

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Playwright/);
});

test('getstarted @link', async ({ page }) => {
  await page.goto(PLAYWRIGHT_URL);

  // Click the get started link.
  await page.getByRole('link', { name: 'Get started' }).click();

  // Expects page to have a heading with the name of Installation.
  await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
});
