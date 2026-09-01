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
    // CI's network conditions reaching this live third-party demo site, so this
    // is explicit and more generous here rather than relying on the default.
    await expect(this.page.locator('[data-test="product-title"]', { hasText: productName })).toBeVisible({
      timeout: 15_000,
    });
  }

  async expectItemCount(expected: number) {
    await expect(this.page.locator('[data-test="cart-quantity"]')).toHaveText(String(expected));
  }

  async proceedToCheckout() {
    const proceed = this.page.locator('[data-test="proceed-1"]').first();
    await expect(proceed).toBeVisible({ timeout: 10_000 });
    await expect(proceed).toBeEnabled({ timeout: 5_000 });
    await proceed.click();
  }
}
