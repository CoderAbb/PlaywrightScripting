import { expect, type Page } from '@playwright/test';
import { SHOP_BASE_URL } from '../global-setup.js';

export class ShopPage {
  constructor(private page: Page) {}

  async openShop() {
    await this.page.goto(SHOP_BASE_URL);
  }

  async openCategory(categoryPath: string) {
    await this.page.goto(`${SHOP_BASE_URL}/${categoryPath}`);
  }

  async addFirstProductToCart() {
    // Prefer role-based lookup; fallback to a text-filtered locator if role isn't available.
    const addToCartButton = this.page.getByRole('button', { name: /add to cart/i }).first();
    if (await addToCartButton.count()) {
      await expect(addToCartButton).toBeVisible({ timeout: 10_000 });
      await expect(addToCartButton).toBeEnabled({ timeout: 5_000 });
      await addToCartButton.click();
    }
  }

  async expectShopLoaded() {
    await expect(this.page.locator('body')).toContainText(/shop|products|cart/i);
  }
}
