import { expect, test } from '@playwright/test';

test.use({
  storageState: { cookies: [], origins: [] },
});

test('admin can log in and view the OrangeHRM dashboard', async ({ page }) => {
  await page.goto('https://opensource-demo.orangehrmlive.com/web/index.php/auth/login');

  await expect(page.getByText('Username : Admin', { exact: true })).toBeVisible();
  await expect(page.getByText('Password : admin123', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Username' }).fill('Admin');
  await page.getByRole('textbox', { name: 'Password' }).fill('admin123');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page).toHaveURL(/\/web\/index\.php\/dashboard\/index$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  for (const widget of [
    'Time at Work',
    'My Actions',
    'Quick Launch',
    'Employees on Leave Today',
    'Employee Distribution by Sub Unit',
    'Employee Distribution by Location',
  ]) {
    await expect(page.getByText(widget, { exact: true })).toBeVisible();
  }

  await expect(page.getByRole('button', { name: 'Assign Leave' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'PIM' })).toBeVisible();
});

test('invalid credentials keep the user on the login page', async ({ page }) => {
  await page.goto('https://opensource-demo.orangehrmlive.com/web/index.php/auth/login');

  await page.getByRole('textbox', { name: 'Username' }).fill('Admin');
  await page.getByRole('textbox', { name: 'Password' }).fill('invalid-password');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/web\/index\.php\/auth\/login$/);
});

test('admin can open PIM from the dashboard and return to the dashboard', async ({ page }) => {
  await page.goto('https://opensource-demo.orangehrmlive.com/web/index.php/auth/login');
  await page.getByRole('textbox', { name: 'Username' }).fill('Admin');
  await page.getByRole('textbox', { name: 'Password' }).fill('admin123');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page).toHaveURL(/\/web\/index\.php\/dashboard\/index$/);
  await page.getByRole('link', { name: 'PIM' }).click();

  await expect(page).toHaveURL(/\/web\/index\.php\/pim\/viewEmployeeList$/);
  await expect(page.getByRole('heading', { name: 'PIM' })).toBeVisible();

  await page.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page).toHaveURL(/\/web\/index\.php\/dashboard\/index$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('admin can view employee records in Directory', async ({ page }) => {
  await page.goto('https://opensource-demo.orangehrmlive.com/web/index.php/auth/login');
  await page.getByRole('textbox', { name: 'Username' }).fill('Admin');
  await page.getByRole('textbox', { name: 'Password' }).fill('admin123');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page).toHaveURL(/\/web\/index\.php\/dashboard\/index$/);
  await page.getByRole('link', { name: 'Directory' }).click();

  await expect(page).toHaveURL(/\/web\/index\.php\/directory\/viewDirectory$/);
  await expect(page.getByRole('heading', { name: 'Directory', level: 5 })).toBeVisible();
  await expect(page.getByText(/\(\d+\) Records Found/)).toBeVisible();
  await expect(
    page.locator('.orangehrm-directory-card-header').filter({ hasText: /Admin\s+admin/i }),
  ).toBeVisible();
});

test('admin can log out from the profile menu', async ({ page }) => {
  await page.goto('https://opensource-demo.orangehrmlive.com/web/index.php/auth/login');
  await page.getByRole('textbox', { name: 'Username' }).fill('Admin');
  await page.getByRole('textbox', { name: 'Password' }).fill('admin123');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page).toHaveURL(/\/web\/index\.php\/dashboard\/index$/);
  await page.getByRole('banner').getByText('Admin admin').click();
  await page.getByText('Logout', { exact: true }).click();

  await expect(page).toHaveURL(/\/web\/index\.php\/auth\/login$/);
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
});
