import { test, expect } from '@playwright/test';

test('electronics flow', async ({ page }) => {
    const byRole = (role: Parameters<typeof page.getByRole>[0], opts?: any) =>
        page.getByRole(role as any, opts);
    const textbox = (name: string) => byRole('textbox', { name });
    const buttonRole = (name: string) => byRole('button', { name });
    const linkRole = (name: string) => byRole('link', { name });

    const fillTextbox = async (name: string, value: string, keyToPress?: string) => {
        await textbox(name).click();
        await textbox(name).fill(value);
        if (keyToPress) await textbox(name).press(keyToPress);
    };

    await page.goto('https://qaautomationlabs.com/');

    await page.locator('span').nth(5).click();
    await linkRole('/ Shop').click();
    await fillTextbox('Email', 'demo@demo.com', 'Tab');
    await textbox('Password').fill('demo');
    await buttonRole('Login').click();

  
    await linkRole('Shop ').click();
    await linkRole('Shop ').click();
    await linkRole('Electronics').click();
    await page.getByRole('button', { name: ' Add to Cart' }).nth(2).click();

    await linkRole('').click();
    await page.getByText('Total: $').click();
    await expect(page.locator('#totalPrice')).toContainText('Total: $200');
    await linkRole('Proceed To Checkout').click();

    await fillTextbox('Enter First Name', 'Test', 'Tab');
    await fillTextbox('Enter Middle Name', 'M', 'Tab');
    await fillTextbox('Enter Last Name', 'Name');

    await page.getByRole('textbox', { name: 'example@email.com' }).click();
    await page.getByRole('textbox', { name: 'example@email.com' }).fill('test@gmail.com');

    await page.getByPlaceholder('9876543210').click();
    await page.getByPlaceholder('9876543210').fill('9098726735');

    await textbox('Enter Address').click();
    await textbox('Enter Address').fill('1234 test street');
    await textbox('Enter Address').press('ArrowDown');

    await page.locator('div').filter({ hasText: 'State*' }).nth(5).click();
    await textbox('Enter State').fill('Michigan');
    await textbox('Enter State').press('Tab');

    await textbox('Enter City').fill('Troy');
    await textbox('Enter City').press('Tab');

    await page.getByPlaceholder('Enter Pin Code').fill('78234');
    await buttonRole('Continue').click();

    await expect(page.locator('#userForm')).toContainText('Confirm Details');
    await linkRole('Place Order').click();
    await expect(page.locator('h1')).toContainText('🎉 Thank You for Your Order!');
    await linkRole('Shop Again').click();
});