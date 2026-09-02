import { test } from '@playwright/test';
import {
  TEST_EMAIL,
  CHECKOUT_FIRST_NAME,
  CHECKOUT_LAST_NAME,
  CHECKOUT_CITY,
  CHECKOUT_STATE,
  CHECKOUT_POST_CODE,
} from '../config/testData.js';
import { ToolshopProductPage } from '../pages/ToolshopProductPage.js';
import { ToolshopCartPage } from '../pages/ToolshopCartPage.js';
import { ToolshopCheckoutPage } from '../pages/ToolshopCheckoutPage.js';
test('add items to cart, guest checkout, and place order @toolshop-checkout', async ({ page }) => {
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

test('single item cart reaches checkout billing step @toolshop-checkout', async ({ page }) => {
  const productPage = new ToolshopProductPage(page);
  const cartPage = new ToolshopCartPage(page);
  const checkoutPage = new ToolshopCheckoutPage(page);

  await productPage.open();
  await productPage.addProductToCartByName('Bolt Cutters');
  await productPage.expectCartQuantity(1);

  await cartPage.open();
  await cartPage.expectItemInCart('Bolt Cutters');
  await cartPage.proceedToCheckout();

  await checkoutPage.continueAsGuest(TEST_EMAIL, CHECKOUT_FIRST_NAME, CHECKOUT_LAST_NAME);
});
