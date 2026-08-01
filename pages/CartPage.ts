import { expect, type Page } from '@playwright/test';

export class CartPage {
  constructor(private page: Page) {}

  async openCart() {
    await this.page.goto('https://shop.qaautomationlabs.com/cart.php');
  }

  async proceedToCheckout() {
    const checkoutLink = this.page.getByRole('link', { name: /proceed to checkout/i }).or(this.page.getByRole('link', { name: /checkout/i }));
    if (await checkoutLink.count()) {
      await checkoutLink.first().evaluate((element) => {
        (element as HTMLElement).click();
      });
    }
  }

  async expectCartView() {
    await this.page.locator('body').waitFor();
    await expect(this.page.locator('body')).toContainText(/cart|checkout/i);
  }
}
