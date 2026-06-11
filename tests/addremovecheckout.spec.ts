import { test, expect, Page } from '@playwright/test';


test.describe('AutomationLabs', () => {
  test('homepageLink @homepage', async ({ page }) => {
    await page.goto('https://qaautomationlabs.com/');
    await expect(page.getByRole('link', { name: 'QA Automation Labs' })).toBeVisible();
    await page.getByRole('link', { name: 'QA Automation Labs' }).click();
  });

  test('loginPage @login', async ({ page }) => {
    await page.goto('https://qaautomationlabs.com/');
    // Open the login form via the header icon/span which is present on the site
    await page.locator('span').nth(3).click();
    await page.getByRole('link', { name: '/ Shop' }).click();
    await page.getByRole('textbox', { name: 'Email' }).click();
    await page.getByRole('textbox', { name: 'Email' }).fill('demo@demo.com');
    await page.getByRole('textbox', { name: 'Email' }).press('Tab');
    await page.getByRole('textbox', { name: 'Password' }).fill('demo');
    await page.getByRole('button', { name: 'Login' }).click();
  });

test('ShoppingCart @shoppingcart', async ({ page }) => {

  // Navigate to site
  await page.goto('https://qaautomationlabs.com/');

  // Login
  await page.locator('span').nth(3).click();
  await page.getByRole('link', { name: '/ Shop' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill('demo@demo.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('demo');
  await page.getByRole('button', { name: 'Login' }).click();

  // Navigate to Men Fashion
  await page.getByText('Save 20% Men Fashion Shop Now').click();
  await page.getByRole('link', { name: 'Shop Now' }).first().click();

  // Add products
  await page.getByRole('img', { name: 'Black T-Shirt' }).click();
  await page.getByRole('button', { name: ' Add to Cart' }).first().click();

  await page.getByRole('img', { name: 'White T-Shirt' }).click();
  await page.getByRole('button', { name: ' Add to Cart' }).nth(1).click();

  await page.getByRole('img', { name: 'Green Shirt' }).click();
  await page.getByRole('button', { name: ' Add to Cart' }).nth(2).click();

  // Open cart
  await page.getByRole('link', { name: '' }).click();
  await expect(page.getByRole('columnheader', { name: 'Remove' })).toBeVisible();

  // Remove one item
  // The following selector assumes that the 'Remove' button is inside the row containing 'Black T-Shirt'.
  // If the table structure changes, update this selector accordingly for robustness.

await page.getByRole('row', { name: 'Black T-Shirt $150 1 $150 ' })
    .getByRole('button')
    .click();

  // Proceed to checkout
  await page.getByRole('link', { name: 'Proceed To Checkout' }).click();

  // Fill checkout form
  await checkout(page);
});

async function checkout(page: Page) {
  await fillIfPresent(page, 'First Name', 'Test');
  await fillIfPresent(page, 'Last Name', 'User');
  await fillIfPresent(page, 'Email', 'example@example.com');
  await fillIfPresent(page, 'Address', '123 Straight Street');
  await fillIfPresent(page, 'City', 'Dallas');
  await fillIfPresent(page, 'Zip', '75001');

  // Some pages show a "Continue" button instead of "Place Order" — accept either.
  if (await page.getByRole('button', { name: 'Place Order' }).count()) {
    await page.getByRole('button', { name: 'Place Order' }).first().click();
  } else {
    // Fallback to a CSS text-based selector
    await page.locator('button:has-text("Continue"), button:has-text("Place Order")').first().click();
  }
}

async function fillIfPresent(page: Page, placeholderOrLabel: string, value: string) {
  // Try placeholder first, then label, then role-based textbox lookup for robustness.
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

});
