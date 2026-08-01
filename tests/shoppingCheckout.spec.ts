import { test } from '../fixtures.js';
import { LoginPage } from '../pages/LoginPage.js';
import { CartPage } from '../pages/CartPage.js';

test('shopping checkout flow via page objects', async ({ authenticatedPage }) => {
  const loginPage = new LoginPage(authenticatedPage);
  const cartPage = new CartPage(authenticatedPage);

  await loginPage.openShop();
  await loginPage.expectShopLoaded();

  await cartPage.openCart();
  await cartPage.expectCartView();

  await cartPage.proceedToCheckout();
});
