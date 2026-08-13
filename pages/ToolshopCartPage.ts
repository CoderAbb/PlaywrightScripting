import { expect, type Page } from '@playwright/test';
import { PRACTICE_SITE_URL } from '../global-setup.js';

/**
 * Page object for the Toolshop cart step (first step of /checkout on
 * https://practicesoftwaretesting.com).
 */
export class ToolshopCartPage {
  constructor(private page: Page) {}

  async open() {
    await this.page.goto(`${PRACTICE_SITE_URL}/checkout`);
  }

  async expectItemInCart(productName: string) {
    // [data-test="product-title"] rows render slightly after navigation completes,
    // so rely on Playwright's auto-retrying assertion rather than a fixed wait.
    await expect(this.page.locator('[data-test="product-title"]', { hasText: productName })).toBeVisible();
  }

  async expectItemCount(expected: number) {
    await expect(this.page.locator('[data-test="cart-quantity"]')).toHaveText(String(expected));
  }

  async proceedToCheckout() {
    await this.page.locator('[data-test="proceed-1"]').click();
  }
}
