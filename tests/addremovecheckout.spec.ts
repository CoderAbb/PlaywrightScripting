import { test, expect, Page } from '@playwright/test';

test.describe('AutomationLabs', () => {
  test('homepageLink @homepage', async ({ page }) => {
    await page.goto('https://qaautomationlabs.com/');
    await expect(page.getByRole('link', { name: 'Home' }).first()).toBeVisible();
    await page.getByRole('link', { name: 'Home' }).first().click();
  });

  test('loginPage @login', async ({ page }) => {
    await page.goto('https://shop.qaautomationlabs.com/');
    await page.getByRole('button', { name: /autofill demo credentials/i }).click();
    await page.getByRole('button', { name: /login/i }).click();
    await expect(page).toHaveURL(/shop\.php$/);
  });

  test('ShoppingCart @shoppingcart', async ({ page }) => {
    await page.goto('https://shop.qaautomationlabs.com/');
    await page.getByRole('button', { name: /autofill demo credentials/i }).click();
    await page.getByRole('button', { name: /login/i }).click();
    await expect(page).toHaveURL(/shop\.php$/);

    await page.goto('https://shop.qaautomationlabs.com/mens-wear.php');
    await page.locator('button').filter({ hasText: /add to cart/i }).first().click();

    await page.goto('https://shop.qaautomationlabs.com/womens-wear.php');
    await page.locator('button').filter({ hasText: /add to cart/i }).first().click();

    await page.goto('https://shop.qaautomationlabs.com/kids-wear.php');
    await page.locator('button').filter({ hasText: /add to cart/i }).first().click();

    await page.locator('a[aria-label="Cart"], a[title="Cart"]').first().click();
    await expect(page.locator('body')).toContainText('Remove');

    await page.getByRole('button', { name: /remove/i }).first().click();
    await page.getByRole('link', { name: /proceed to checkout/i }).click();
    await checkout(page);
  });
});

async function checkout(page: Page) {
  await fillIfPresent(page, 'First Name', 'Test');
  await fillIfPresent(page, 'Last Name', 'User');
  await fillIfPresent(page, 'E-mail', 'example@example.com');
  await fillIfPresent(page, 'Mobile No.', '1234567890');
  await fillIfPresent(page, 'Address', '123 Straight Street');
  await fillIfPresent(page, 'State', 'Texas');
  await fillIfPresent(page, 'City', 'Dallas');
  await fillIfPresent(page, 'Pin Code', '75001');

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

