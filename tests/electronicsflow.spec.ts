import { test } from '@playwright/test';
import { TEST_EMAIL, CHECKOUT_FIRST_NAME, CHECKOUT_LAST_NAME, CHECKOUT_ELECTRONICS_PHONE, CHECKOUT_ELECTRONICS_ADDRESS, CHECKOUT_ELECTRONICS_STATE, CHECKOUT_ELECTRONICS_CITY, CHECKOUT_ELECTRONICS_POST_CODE } from '../global-setup.js';
import { ShopPage } from '../pages/ShopPage.js';
import { CheckoutPage } from '../pages/CheckoutPage.js';

test('electronicsFlow @electronics', async ({ page }) => {
    const shopPage = new ShopPage(page);
    const checkoutPage = new CheckoutPage(page);

    await shopPage.openShop();
    await shopPage.expectShopLoaded();

    await shopPage.openCategory('electronics.php');
    await shopPage.addFirstProductToCart();

    await page.goto('https://shop.qaautomationlabs.com/cart.php');
    await checkoutPage.expectSuccess(/Total: \$150|cart|checkout/i);
    await page.getByRole('link', { name: /proceed to checkout/i }).click();

    await checkoutPage.fillField('Enter First Name', CHECKOUT_FIRST_NAME);
    await checkoutPage.fillField('Enter Last Name', CHECKOUT_LAST_NAME);
    await checkoutPage.fillField('example@email.com', TEST_EMAIL);
    await checkoutPage.fillField('9876543210', CHECKOUT_ELECTRONICS_PHONE);
    await checkoutPage.fillField('Enter Address', CHECKOUT_ELECTRONICS_ADDRESS);
    await checkoutPage.fillField('Enter State', CHECKOUT_ELECTRONICS_STATE);
    await checkoutPage.fillField('Enter City', CHECKOUT_ELECTRONICS_CITY);
    await checkoutPage.fillField('Enter Pin Code', CHECKOUT_ELECTRONICS_POST_CODE);
    await checkoutPage.submit();

    await checkoutPage.expectSuccess('Confirm Details');
    await page.getByRole('link', { name: /place order/i }).click();
    await checkoutPage.expectSuccess('Thank You for Your Order');
});