import { expect, type Page } from '@playwright/test';

export const ORANGEHRM_LOGIN_URL = 'https://opensource-demo.orangehrmlive.com/web/index.php/auth/login';

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
