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
    const addToCartButton = this.page.locator('button').filter({ hasText: /add to cart/i }).first();
    if (await addToCartButton.count()) {
      await addToCartButton.click();
    }
  }

  async expectShopLoaded() {
    await expect(this.page.locator('body')).toContainText(/shop|products|cart/i);
  }
}
