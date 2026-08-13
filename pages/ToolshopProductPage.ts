import { expect, type Page } from '@playwright/test';
import { PRACTICE_SITE_URL } from '../global-setup.js';

/**
 * Page object for the Practice Software Testing "Toolshop" product
 * catalog (https://practicesoftwaretesting.com). Handles browsing,
 * searching, and adding products to the cart.
 */
export class ToolshopProductPage {
  constructor(private page: Page) {}

  async open() {
    await this.page.goto(PRACTICE_SITE_URL);
    await expect(this.page.locator('[data-test="search-query"]')).toBeVisible();
  }

  /** Search the catalog for a product by (partial) name. */
  async searchFor(productName: string) {
    await this.page.locator('[data-test="search-query"]').fill(productName);
    await this.page.locator('[data-test="search-submit"]').click();
  }

  /** Open a product's detail page by clicking its card in the current listing. */
  async openProductByName(productName: string) {
    await this.page
      .locator('[data-test^="product-"]')
      .filter({ hasText: productName })
      .first()
      .click();
    await expect(this.page.locator('[data-test="product-name"]')).toContainText(productName);
  }

  /** From a product detail page, set quantity and add the item to the cart. */
  async addToCart(quantity = 1) {
    if (quantity > 1) {
      const quantityInput = this.page.locator('[data-test="quantity"]');
      await quantityInput.fill(String(quantity));
    }
    await this.page.locator('[data-test="add-to-cart"]').click();
    // The header cart badge updates once the add-to-cart request resolves.
    await expect(this.page.locator('[data-test="cart-quantity"]')).toBeVisible();
  }

  /** Convenience: search, open, and add a single product to the cart by name. */
  async addProductToCartByName(productName: string, quantity = 1) {
    await this.searchFor(productName);
    await this.openProductByName(productName);
    await this.addToCart(quantity);
  }

  async expectCartQuantity(expected: number) {
    await expect(this.page.locator('[data-test="cart-quantity"]')).toHaveText(String(expected));
  }
}
