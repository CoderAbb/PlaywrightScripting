import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://rahulshettyacademy.com/seleniumPractise/#/');
  await page.getByRole('heading', { name: 'Brocolli - 1 Kg' }).click();
  await page.getByRole('button', { name: 'ADD TO CART' }).first().click({ timeout: 5000 });
  await page.getByRole('heading', { name: 'Cauliflower - 1 Kg' }).click();
  await page.getByRole('button', { name: 'ADD TO CART' }).nth(1).click({ timeout: 5000 });
  await page.getByRole('heading', { name: 'Cucumber - 1 Kg' }).click();
  await page.getByRole('button', { name: 'ADD TO CART' }).nth(1).click({ timeout: 5000 });
  await page.getByRole('heading', { name: 'Beetroot - 1 Kg' }).click();
  await page.getByRole('button', { name: 'ADD TO CART' }).nth(2).click({ timeout: 5000 });
  await page.getByRole('heading', { name: 'Beans - 1 Kg' }).click();
  await page.locator('div:nth-child(7) > .product-action > button').click();
  await page.getByRole('heading', { name: 'Tomato - 1 Kg' }).click();
  await page.getByRole('button', { name: 'ADD TO CART' }).nth(5).click({ timeout: 5000 });
  await page.getByRole('link', { name: 'Cart' }).click();
  await page.getByRole('button', { name: 'PROCEED TO CHECKOUT' }).click();
  await page.getByRole('button', { name: 'Place Order' }).click();
  await page.getByRole('combobox').selectOption('India');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Proceed' }).click({ timeout: 5000 });
  await page.goto('https://rahulshettyacademy.com/seleniumPractise/#/');
  await expect(page.getByRole('banner')).toContainText('GREENKART');
});