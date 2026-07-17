import { test, expect } from '@playwright/test';

test('electronicsFlow @electronics', async ({ page }) => {
    const fillTextbox = async (placeholderOrLabel: string, value: string, keyToPress?: string) => {
        const locator = page.getByPlaceholder(placeholderOrLabel)
            .or(page.getByLabel(placeholderOrLabel))
            .or(page.getByRole('textbox', { name: placeholderOrLabel }));
        await locator.first().click();
        await locator.first().fill(value);
        if (keyToPress) await locator.first().press(keyToPress);
    };

    await page.goto('https://shop.qaautomationlabs.com/');
    await expect(page.locator('body')).toContainText(/shop|products|cart/i);

    await page.goto('https://shop.qaautomationlabs.com/electronics.php');
    await page.locator('button').filter({ hasText: /add to cart/i }).first().click();

    await page.locator('a[aria-label="Cart"], a[title="Cart"]').first().click();
    await expect(page.locator('body')).toContainText('Total: $150');
    await page.getByRole('link', { name: /proceed to checkout/i }).click();

    await fillTextbox('Enter First Name', 'Test', 'Tab');
    await fillTextbox('Enter Last Name', 'User');
    await fillTextbox('example@email.com', 'test@gmail.com');
    await fillTextbox('9876543210', '9098726735');
    await fillTextbox('Enter Address', '1234 test street');
    await fillTextbox('Enter State', 'Michigan');
    await fillTextbox('Enter City', 'Troy');
    await fillTextbox('Enter Pin Code', '78234');
    await page.getByRole('button', { name: /continue/i }).click();

    await expect(page).toHaveURL(/confirm\.php$/);
    await expect(page.locator('body')).toContainText('Confirm Details');
    await page.getByRole('link', { name: /place order/i }).click();
    await expect(page.locator('body')).toContainText('Thank You for Your Order');
});