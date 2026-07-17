const { test, expect } = require('@playwright/test');

test('kids shopping @Kidsshopping', async ({ page }) => {
  await page.goto('https://shop.qaautomationlabs.com/');
  await expect(page.locator('body')).toContainText(/shop|products|cart/i);

  await page.goto('https://shop.qaautomationlabs.com/kids-wear.php');
  await page.locator('button').filter({ hasText: /add to cart/i }).first().click();
  await page.locator('button').filter({ hasText: /add to cart/i }).nth(1).click();

  await page.locator('a[aria-label="Cart"], a[title="Cart"]').first().click();
  await expect(page.locator('body')).toContainText('Remove');
  await page.getByRole('link', { name: /proceed to checkout/i }).click();

  await page.getByPlaceholder('Enter First Name').fill('Testname');
  await page.getByPlaceholder('Enter Last Name').fill('Testlastname');
  await page.getByPlaceholder('example@email.com').fill('test@gmail.com');
  await page.getByPlaceholder('9876543210').fill('9726635421');
  await page.getByPlaceholder('Enter Address').fill('2890 Spring Drive');
  await page.getByPlaceholder('Enter State').fill('MI');
  await page.getByPlaceholder('Enter City').fill('Troy');
  await page.getByPlaceholder('Enter Pin Code').fill('89283');
  await page.getByRole('button', { name: /continue/i }).click();

  await expect(page).toHaveURL(/confirm\.php$/);
  await expect(page.locator('body')).toContainText('Confirm Details');
  await page.getByRole('link', { name: /place order/i }).click();
  await expect(page.locator('body')).toContainText('Thank You for Your Order');
});