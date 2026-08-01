import { test, expect } from '@playwright/test';
import { QA_BASE_URL, SHOP_BASE_URL, TEST_EMAIL, CHECKOUT_FIRST_NAME, CHECKOUT_LAST_NAME, CHECKOUT_PHONE, CHECKOUT_ADDRESS, CHECKOUT_CITY, CHECKOUT_STATE, CHECKOUT_POST_CODE } from '../global-setup.js';
import { ShopPage } from '../pages/ShopPage.js';
import { CheckoutPage } from '../pages/CheckoutPage.js';

test.describe('AutomationLabs', () => {
  test('homepageLink @homepage', async ({ page }) => {
    await page.goto(QA_BASE_URL);
    await expect(page.getByRole('link', { name: 'Home' }).first()).toBeVisible();
    await page.getByRole('link', { name: 'Home' }).first().click();
  });

  test('loginPage @login', async ({ page }) => {
    const shopPage = new ShopPage(page);
    await shopPage.openShop();
    await shopPage.expectShopLoaded();
  });

  test('ShoppingCart @shoppingcart', async ({ page }) => {
    const shopPage = new ShopPage(page);
    const checkoutPage = new CheckoutPage(page);

    await shopPage.openShop();
    await shopPage.expectShopLoaded();

    await shopPage.openCategory('mens-wear.php');
    await shopPage.addFirstProductToCart();

    await shopPage.openCategory('womens-wear.php');
    await shopPage.addFirstProductToCart();

    await shopPage.openCategory('kids-wear.php');
    await shopPage.addFirstProductToCart();

    await page.goto(`${SHOP_BASE_URL}/cart.php`);
    await expect(page.locator('body')).toContainText('Remove');

    await page.getByRole('button', { name: /remove/i }).first().click();
    await page.getByRole('link', { name: /proceed to checkout/i }).click();

    await checkoutPage.fillField('First Name', CHECKOUT_FIRST_NAME);
    await checkoutPage.fillField('Last Name', CHECKOUT_LAST_NAME);
    await checkoutPage.fillField('E-mail', TEST_EMAIL);
    await checkoutPage.fillField('Mobile No.', CHECKOUT_PHONE);
    await checkoutPage.fillField('Address', CHECKOUT_ADDRESS);
    await checkoutPage.fillField('State', CHECKOUT_STATE);
    await checkoutPage.fillField('City', CHECKOUT_CITY);
    await checkoutPage.fillField('Pin Code', CHECKOUT_POST_CODE);
    await checkoutPage.submit();
  });
});

