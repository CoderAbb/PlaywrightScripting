import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { QA_BASE_URL, SHOP_BASE_URL, TEST_EMAIL, CHECKOUT_FIRST_NAME, CHECKOUT_LAST_NAME, CHECKOUT_PHONE, CHECKOUT_ADDRESS, CHECKOUT_CITY, CHECKOUT_STATE, CHECKOUT_POST_CODE } from '../global-setup.js';

test.describe('AutomationLabs', () => {
  test('homepageLink @homepage', async ({ page }) => {
    await page.goto(QA_BASE_URL);
    await expect(page.getByRole('link', { name: 'Home' }).first()).toBeVisible();
    await page.getByRole('link', { name: 'Home' }).first().click();
  });

  test('loginPage @login', async ({ page }) => {
    await page.goto(SHOP_BASE_URL);
    await expect(page.locator('body')).toContainText(/shop|products|cart/i);
  });

  test('ShoppingCart @shoppingcart', async ({ page }) => {
    await page.goto(SHOP_BASE_URL);
    await expect(page.locator('body')).toContainText(/shop|products|cart/i);

    await page.goto(`${SHOP_BASE_URL}/mens-wear.php`);
    await page.locator('button').filter({ hasText: /add to cart/i }).first().click();

    await page.goto(`${SHOP_BASE_URL}/womens-wear.php`);
    await page.locator('button').filter({ hasText: /add to cart/i }).first().click();

    await page.goto(`${SHOP_BASE_URL}/kids-wear.php`);
    await page.locator('button').filter({ hasText: /add to cart/i }).first().click();

    await page.locator('a[aria-label="Cart"], a[title="Cart"]').first().click();
    await expect(page.locator('body')).toContainText('Remove');

    await page.getByRole('button', { name: /remove/i }).first().click();
    await page.getByRole('link', { name: /proceed to checkout/i }).click();
    await checkout(page);
  });
});

async function checkout(page: Page) {
  await fillIfPresent(page, 'First Name', CHECKOUT_FIRST_NAME);
  await fillIfPresent(page, 'Last Name', CHECKOUT_LAST_NAME);
  await fillIfPresent(page, 'E-mail', TEST_EMAIL);
  await fillIfPresent(page, 'Mobile No.', CHECKOUT_PHONE);
  await fillIfPresent(page, 'Address', CHECKOUT_ADDRESS);
  await fillIfPresent(page, 'State', CHECKOUT_STATE);
  await fillIfPresent(page, 'City', CHECKOUT_CITY);
  await fillIfPresent(page, 'Pin Code', CHECKOUT_POST_CODE);

  const continueButton = page.getByRole('button', { name: /continue/i });
  if (await continueButton.count()) {
    await continueButton.first().click();
  } else {
    await page.locator('button:has-text("Continue"), button:has-text("Place Order")').first().click();
  }
}

async function fillIfPresent(page: Page, placeholderOrLabel: string, value: string) {
  let locator = page.getByPlaceholder(placeholderOrLabel);
  if (await locator.count() === 0) {
    locator = page.getByLabel(placeholderOrLabel);
  }
  if (await locator.count() === 0) {
    locator = page.getByRole('textbox', { name: placeholderOrLabel });
  }

  if (await locator.count()) {
    await locator.fill(value);
  }
}

