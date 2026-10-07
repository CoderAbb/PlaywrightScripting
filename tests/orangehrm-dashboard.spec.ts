import { test } from '@playwright/test';
import { OrangeHrmDashboardPage } from '../pages/OrangeHrmDashboardPage.js';
import {
  INVALID_CREDENTIALS,
  OrangeHrmLoginPage,
  VALID_CREDENTIALS,
} from '../pages/OrangeHrmLoginPage.js';

test.use({
  locale: 'en-US',
  storageState: { cookies: [], origins: [] },
});

test('admin can log in and view the OrangeHRM dashboard', async ({ page }) => {
  const loginPage = new OrangeHrmLoginPage(page);
  const dashboardPage = new OrangeHrmDashboardPage(page);

  await loginPage.open();
  await loginPage.expectDemoCredentialsVisible();
  await loginPage.login(VALID_CREDENTIALS);

  await dashboardPage.expectLoaded();
  await dashboardPage.expectWidgetsVisible();
  await dashboardPage.expectQuickActionsVisible();
});

test('invalid credentials keep the user on the login page', async ({ page }) => {
  const loginPage = new OrangeHrmLoginPage(page);

  await loginPage.open();
  await loginPage.login(INVALID_CREDENTIALS);
  await loginPage.expectInvalidCredentialsError();
});

test('admin can open PIM from the dashboard and return to the dashboard', async ({ page }) => {
  const loginPage = new OrangeHrmLoginPage(page);
  const dashboardPage = new OrangeHrmDashboardPage(page);

  await loginPage.open();
  await loginPage.login(VALID_CREDENTIALS);

  await dashboardPage.expectLoaded();
  await dashboardPage.openPim();
  await dashboardPage.returnToDashboard();
});

test('admin can view employee records in Directory', async ({ page }) => {
  const loginPage = new OrangeHrmLoginPage(page);
  const dashboardPage = new OrangeHrmDashboardPage(page);

  await loginPage.open();
  await loginPage.login(VALID_CREDENTIALS);

  await dashboardPage.expectLoaded();
  await dashboardPage.openDirectory();
});

test('admin can log out from the profile menu', async ({ page }) => {
  const loginPage = new OrangeHrmLoginPage(page);
  const dashboardPage = new OrangeHrmDashboardPage(page);

  await loginPage.open();
  await loginPage.login(VALID_CREDENTIALS);

  await dashboardPage.expectLoaded();
  await dashboardPage.logout();
});
