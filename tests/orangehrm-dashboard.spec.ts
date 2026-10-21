import { test } from '../fixtures.js';
import { OrangeHrmDashboardPage } from '../pages/OrangeHrmDashboardPage.js';
import {
  INVALID_CREDENTIALS,
  VALID_CREDENTIALS,
} from '../pages/LoginPage.js';

test.use({
  locale: 'en-US',
  storageState: { cookies: [], origins: [] },
});

test('admin can log in and view the OrangeHRM dashboard', async ({
  page,
  orangeHrmLoginPage: loginPage,
}) => {
  const dashboardPage = new OrangeHrmDashboardPage(page);

  await loginPage.open();
  await loginPage.expectDemoCredentialsVisible();
  await loginPage.login(VALID_CREDENTIALS);

  await dashboardPage.expectLoaded();
  await dashboardPage.expectWidgetsVisible();
  await dashboardPage.expectQuickActionsVisible();
});

test('invalid credentials keep the user on the login page', async ({
  orangeHrmLoginPage: loginPage,
}) => {
  await loginPage.open();
  await loginPage.login(INVALID_CREDENTIALS);
  await loginPage.expectInvalidCredentialsError();
});

test('admin can open PIM from the dashboard and return to the dashboard', async ({
  page,
  orangeHrmLoginPage: loginPage,
}) => {
  const dashboardPage = new OrangeHrmDashboardPage(page);

  await loginPage.open();
  await loginPage.login(VALID_CREDENTIALS);

  await dashboardPage.expectLoaded();
  await dashboardPage.openPim();
  await dashboardPage.returnToDashboard();
});

test('admin can view employee records in Directory', async ({
  page,
  orangeHrmLoginPage: loginPage,
}) => {
  const dashboardPage = new OrangeHrmDashboardPage(page);

  await loginPage.open();
  await loginPage.login(VALID_CREDENTIALS);

  await dashboardPage.expectLoaded();
  await dashboardPage.openDirectory();
});

test('admin can log out from the profile menu', async ({
  page,
  orangeHrmLoginPage: loginPage,
}) => {
  const dashboardPage = new OrangeHrmDashboardPage(page);

  await loginPage.open();
  await loginPage.login(VALID_CREDENTIALS);

  await dashboardPage.expectLoaded();
  await dashboardPage.logout();
});
