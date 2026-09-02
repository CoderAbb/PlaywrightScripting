import { test } from '@playwright/test';
import {
  TEST_EMAIL,
  CHECKOUT_FIRST_NAME,
  CHECKOUT_LAST_NAME,
  CHECKOUT_CITY,
  CHECKOUT_STATE,
  CHECKOUT_POST_CODE,
} from '../global-setup.js';
import { ToolshopProductPage } from '../pages/ToolshopProductPage.js';
import { ToolshopCartPage } from '../pages/ToolshopCartPage.js';
import { ToolshopCheckoutPage } from '../pages/ToolshopCheckoutPage.js';

test.describe('AutomationLabs', () => {
  test('homepageLink @homepage', async ({ page }) => {
    await page.goto('https://qaautomationlabs.com');
    await page.getByRole('link', { name: 'Home' }).first().click();
  });

  test('loginPage @login', async ({ page }) => {
    await page.goto('https://shop.qaautomationlabs.com');
    await page.waitForLoadState('domcontentloaded');
  });

  test('ShoppingCart @shoppingcart', async ({ page }) => {
    const productPage = new ToolshopProductPage(page);
    const cartPage = new ToolshopCartPage(page);
    const checkoutPage = new ToolshopCheckoutPage(page);

    await productPage.open();
    await productPage.addProductToCartByName('Combination Pliers');
    await productPage.open();
    await productPage.addProductToCartByName('Pliers');
    await productPage.expectCartQuantity(2);

    await cartPage.open();
    await cartPage.expectItemInCart('Combination Pliers');
    await cartPage.expectItemInCart('Pliers');
    await cartPage.proceedToCheckout();

    await checkoutPage.continueAsGuest(TEST_EMAIL, CHECKOUT_FIRST_NAME, CHECKOUT_LAST_NAME);
    await checkoutPage.fillBillingAddress({
      country: 'United States of America (the)',
      postalCode: CHECKOUT_POST_CODE,
      houseNumber: '123',
      street: '123 Straight Street',
      city: CHECKOUT_CITY,
      state: CHECKOUT_STATE,
    });

    await checkoutPage.selectPaymentMethod('Cash on Delivery');
    await checkoutPage.confirmPayment();
    await checkoutPage.expectPaymentSuccess();
  });
});

