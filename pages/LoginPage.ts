import { expect, type Page } from '@playwright/test';
import { SHOP_BASE_URL } from '../global-setup.js';

export class LoginPage {
  constructor(private page: Page) {}

  async openShop() {
    await this.page.goto(SHOP_BASE_URL);
  }

  async expectShopLoaded() {
    await this.page.locator('body').waitFor();
    await expect(this.page.locator('body')).toContainText(/shop|products|cart/i);
  }
}
