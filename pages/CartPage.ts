import { expect, type Page } from '@playwright/test';

export class CartPage {
  constructor(private page: Page) {}

  async openCart() {
    await this.page.goto('https://shop.qaautomationlabs.com/cart.php');
  }

  async proceedToCheckout() {
    const checkoutLink = this.page
      .getByRole('link', { name: /proceed to checkout/i })
      .or(this.page.getByRole('link', { name: /checkout/i }))
      .first();

    if (await checkoutLink.count()) {
      await expect(checkoutLink).toBeVisible({ timeout: 10_000 });
      // Click via Playwright action rather than evaluate to be more robust.
      await checkoutLink.click();
    }
  }

  async expectCartView() {
    await this.page.locator('body').waitFor();
    await expect(this.page.locator('body')).toContainText(/cart|checkout/i);
  }
}
