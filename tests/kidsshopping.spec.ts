import { test, expect } from '@playwright/test';
import { SHOP_BASE_URL, TEST_EMAIL, CHECKOUT_KIDS_FIRST_NAME, CHECKOUT_KIDS_LAST_NAME, CHECKOUT_KIDS_PHONE, CHECKOUT_KIDS_ADDRESS, CHECKOUT_KIDS_CITY, CHECKOUT_KIDS_STATE, CHECKOUT_KIDS_POST_CODE } from '../global-setup.js';

test('kids shopping @Kidsshopping', async ({ page }) => {
  await page.goto(SHOP_BASE_URL);
  await expect(page.locator('body')).toContainText(/shop|products|cart/i);

  await page.goto(`${SHOP_BASE_URL}/kids-wear.php`);
  await page.locator('button').filter({ hasText: /add to cart/i }).first().click();
  await page.locator('button').filter({ hasText: /add to cart/i }).nth(1).click();

  await page.locator('a[aria-label="Cart"], a[title="Cart"]').first().click();
  await expect(page.locator('body')).toContainText('Remove');
  await page.getByRole('link', { name: /proceed to checkout/i }).click();

  await page.getByPlaceholder('Enter First Name').fill(CHECKOUT_KIDS_FIRST_NAME);
  await page.getByPlaceholder('Enter Last Name').fill(CHECKOUT_KIDS_LAST_NAME);
  await page.getByPlaceholder('example@email.com').fill(TEST_EMAIL);
  await page.getByPlaceholder('9876543210').fill(CHECKOUT_KIDS_PHONE);
  await page.getByPlaceholder('Enter Address').fill(CHECKOUT_KIDS_ADDRESS);
  await page.getByPlaceholder('Enter State').fill(CHECKOUT_KIDS_STATE);
  await page.getByPlaceholder('Enter City').fill(CHECKOUT_KIDS_CITY);
  await page.getByPlaceholder('Enter Pin Code').fill(CHECKOUT_KIDS_POST_CODE);
  await page.getByRole('button', { name: /continue/i }).click();

  await expect(page).toHaveURL(/confirm\.php$/);
  await expect(page.locator('body')).toContainText('Confirm Details');
  await page.getByRole('link', { name: /place order/i }).click();
  await expect(page.locator('body')).toContainText('Thank You for Your Order');
});