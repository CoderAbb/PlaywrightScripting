import { test, expect } from '@playwright/test';
import { SHOP_BASE_URL, TEST_EMAIL, CHECKOUT_FIRST_NAME, CHECKOUT_LAST_NAME, CHECKOUT_ELECTRONICS_PHONE, CHECKOUT_ELECTRONICS_ADDRESS, CHECKOUT_ELECTRONICS_STATE, CHECKOUT_ELECTRONICS_CITY, CHECKOUT_ELECTRONICS_POST_CODE } from '../global-setup.js';

test('electronicsFlow @electronics', async ({ page }) => {
    const fillTextbox = async (placeholderOrLabel: string, value: string, keyToPress?: string) => {
        const locator = page.getByPlaceholder(placeholderOrLabel)
            .or(page.getByLabel(placeholderOrLabel))
            .or(page.getByRole('textbox', { name: placeholderOrLabel }));
        await locator.first().click();
        await locator.first().fill(value);
        if (keyToPress) await locator.first().press(keyToPress);
    };

    await page.goto(SHOP_BASE_URL);
    await expect(page.locator('body')).toContainText(/shop|products|cart/i);

    await page.goto(`${SHOP_BASE_URL}/electronics.php`);
    await page.locator('button').filter({ hasText: /add to cart/i }).first().click();

    await page.locator('a[aria-label="Cart"], a[title="Cart"]').first().click();
    await expect(page.locator('body')).toContainText('Total: $150');
    await page.getByRole('link', { name: /proceed to checkout/i }).click();

    await fillTextbox('Enter First Name', CHECKOUT_FIRST_NAME, 'Tab');
    await fillTextbox('Enter Last Name', CHECKOUT_LAST_NAME);
    await fillTextbox('example@email.com', TEST_EMAIL);
    await fillTextbox('9876543210', CHECKOUT_ELECTRONICS_PHONE);
    await fillTextbox('Enter Address', CHECKOUT_ELECTRONICS_ADDRESS);
    await fillTextbox('Enter State', CHECKOUT_ELECTRONICS_STATE);
    await fillTextbox('Enter City', CHECKOUT_ELECTRONICS_CITY);
    await fillTextbox('Enter Pin Code', CHECKOUT_ELECTRONICS_POST_CODE);
    await page.getByRole('button', { name: /continue/i }).click();

    await expect(page).toHaveURL(/confirm\.php$/);
    await expect(page.locator('body')).toContainText('Confirm Details');
    await page.getByRole('link', { name: /place order/i }).click();
    await expect(page.locator('body')).toContainText('Thank You for Your Order');
});