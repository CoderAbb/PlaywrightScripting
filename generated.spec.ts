import { test, expect } from '@playwright/test';

test('generated login flow', async ({ page }) => {
  await page.goto('https://practicesoftwaretesting.com');
  await page.locator('[data-test="email"]').fill('ab@example.com');
  await page.locator('[data-test="password"]').fill('test!');
  await page.locator('[data-test="login-submit"]').click();
});
