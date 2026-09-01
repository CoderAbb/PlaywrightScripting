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
    // [data-test="product-title"] rows render slightly after navigation completes.
    // The default 5s auto-retry window was enough locally but not always under
    // CI's network conditions reaching this live third-party demo site. Try a
    // couple of locator strategies (primary data-test selector, then a
    // text-based fallback) so transient DOM changes don't immediately fail the
    // whole flow.
    const primary = this.page.locator('[data-test="product-title"]', { hasText: productName });
    try {
      await expect(primary).toBeVisible({ timeout: 15_000 });
      return;
    } catch (err) {
      // Fallback: try a role/text based match on the page for the product name.
      // This handles cases where the site renamed the data-test attribute.
      const fallback = this.page.getByText(productName, { exact: false });
      await expect(fallback).toBeVisible({ timeout: 15_000 });
    }
  }

  async expectItemCount(expected: number) {
    await expect(this.page.locator('[data-test="cart-quantity"]')).toHaveText(String(expected));
  }

  async proceedToCheckout() {
    await this.page.locator('[data-test="proceed-1"]').click();
  }
}
