import { expect, type Page } from '@playwright/test';

export const QA_BASE_URL = 'https://qaautomationlabs.com';
export const SHOP_BASE_URL = 'https://shop.qaautomationlabs.com';
export const PRACTICE_SITE_URL = 'https://practicesoftwaretesting.com';
export const LAMBDA_ECOM_URL = 'https://ecommerce-playground.lambdatest.io';
export const RAHUL_SHETTY_URL = 'https://rahulshettyacademy.com/seleniumPractise/#/';
export const PLAYWRIGHT_URL = 'https://playwright.dev/';
export const TODO_URL = 'https://todomvc.com/examples/react/dist/';
export const ORANGEHRM_LOGIN_URL =
  'https://opensource-demo.orangehrmlive.com/web/index.php/auth/login';

export const VALID_CREDENTIALS = {
  username: 'Admin',
  password: 'admin123',
} as const;

export const INVALID_CREDENTIALS = {
  username: 'Admin',
  password: 'invalid-password',
} as const;

export type OrangeHrmCredentials = {
  username: string;
  password: string;
};

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

export class OrangeHrmLoginPage {
  constructor(private page: Page) {}

  async open() {
    await this.page.goto(ORANGEHRM_LOGIN_URL);
  }

  async expectDemoCredentialsVisible() {
    await expect(this.page.getByText('Username : Admin', { exact: true })).toBeVisible();
    await expect(this.page.getByText('Password : admin123', { exact: true })).toBeVisible();
  }

  async login(credentials: OrangeHrmCredentials = VALID_CREDENTIALS) {
    await this.page.getByRole('textbox', { name: 'Username' }).fill(credentials.username);
    await this.page.getByRole('textbox', { name: 'Password' }).fill(credentials.password);
    await this.page.getByRole('button', { name: 'Login' }).click();
  }

  async expectInvalidCredentialsError() {
    await expect(this.page.getByText('Invalid credentials', { exact: true })).toBeVisible();
    await expect(this.page).toHaveURL(/\/web\/index\.php\/auth\/login$/);
  }
}
