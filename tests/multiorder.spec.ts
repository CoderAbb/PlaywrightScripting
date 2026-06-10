import { test, expect, Page } from '@playwright/test';

async function addToCart(page: Page, productName: string) {
    const product = page.locator('.product').filter({ hasText: productName }).first();
    await expect(product).toBeVisible();
    await product.getByRole('button', { name: 'ADD TO CART' }).click();
}

test('multiorder @multipleitems', async ({ page }) => {
    await page.goto('https://rahulshettyacademy.com/seleniumPractise/#/');

    const items = ['Brocolli', 'Cauliflower', 'Cucumber', 'Beetroot', 'Beans', 'Tomato'];
    for (const item of items) {
        await addToCart(page, item);
    }

    await page.getByRole('link', { name: 'Cart' }).click({ timeout: 5000 });
    await page.getByRole('button', { name: 'PROCEED TO CHECKOUT' }).click();
    await page.getByRole('button', { name: 'Place Order' }).click();
    await page.getByRole('combobox').selectOption({ label: 'India' });
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Proceed' }).click();

    await page.goto('https://rahulshettyacademy.com/seleniumPractise/#/');
    await expect(page.getByRole('banner')).toContainText('GREENKART');
});