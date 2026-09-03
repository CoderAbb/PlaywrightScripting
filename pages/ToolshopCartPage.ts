import { expect, type Page } from '@playwright/test';
import { PRACTICE_SITE_URL } from '../global-setup.js';


export class ToolshopCartPage {
  constructor(private page: Page) {}

  async open() {
    await this.page.goto(`${PRACTICE_SITE_URL}/checkout`);
  }

  async expectItemInCart(productName: string) {
    // Ensure the page has settled; networkidle helps for slow CI network conditions.
    await this.page.waitForLoadState('networkidle').catch(() => {});

    const titleLocator = this.page
      .locator('[data-test="product-title"]', { hasText: productName })
      .or(this.page.getByText(productName, { exact: false }))
      .first();

    await expect(titleLocator).toBeVisible({ timeout: 30_000 });
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
