import { expect, type Page } from '@playwright/test';

export const DASHBOARD_WIDGETS = [
  'Time at Work',
  'My Actions',
  'Quick Launch',
  'Employees on Leave Today',
  'Employee Distribution by Sub Unit',
  'Employee Distribution by Location',
] as const;

export class OrangeHrmDashboardPage {
  constructor(private page: Page) {}

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/web\/index\.php\/dashboard\/index$/);
    await expect(this.page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  }

  async expectWidgetsVisible() {
    for (const widget of DASHBOARD_WIDGETS) {
      await expect(this.page.getByText(widget, { exact: true })).toBeVisible();
    }
  }

  async expectQuickActionsVisible() {
    await expect(this.page.getByRole('button', { name: 'Assign Leave' })).toBeVisible();
    await expect(this.page.getByRole('link', { name: 'PIM' })).toBeVisible();
  }

  async openPim() {
    await this.page.getByRole('link', { name: 'PIM' }).click();
    await expect(this.page).toHaveURL(/\/web\/index\.php\/pim\/viewEmployeeList$/);
    await expect(this.page.getByRole('heading', { name: 'PIM' })).toBeVisible();
  }

  async returnToDashboard() {
    await this.page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(this.page).toHaveURL(/\/web\/index\.php\/dashboard\/index$/);
    await expect(this.page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  }

  async openDirectory() {
    await this.page.getByRole('link', { name: 'Directory' }).click();
    await expect(this.page).toHaveURL(/\/web\/index\.php\/directory\/viewDirectory$/);
    await expect(this.page.getByRole('heading', { name: 'Directory', level: 5 })).toBeVisible();
    await expect(this.page.getByText(/\(\d+\) Records Found/)).toBeVisible();
    await expect(this.page.locator('.orangehrm-directory-card-header').first()).toBeVisible();
  }

  async logout() {
    await this.page.getByRole('banner').locator('.oxd-userdropdown-tab').click();
    await this.page.getByText('Logout', { exact: true }).click();
    await expect(this.page).toHaveURL(/\/web\/index\.php\/auth\/login$/);
    await expect(this.page.getByRole('heading', { name: 'Login' })).toBeVisible();
  }
}
