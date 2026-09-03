import { expect, type Page } from '@playwright/test';
import { PRACTICE_SITE_URL } from '../global-setup.js';

export class ToolshopCartPage {
  constructor(private page: Page) {}

  async open() {
    await this.page.goto(`${PRACTICE_SITE_URL}/checkout`);
  }

  async expectItemInCart(productName: string) {

    await expect(this.page.locator('[data-test="product-title"]', { hasText: productName })).toBeVisible();
  }

  async expectItemCount(expected: number) {
    await expect(this.page.locator('[data-test="cart-quantity"]')).toHaveText(String(expected));
  }

  async proceedToCheckout() {
    await this.page.locator('[data-test="proceed-1"]').click();
  }
}
