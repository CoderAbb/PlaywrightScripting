import { test as base, expect, type Page } from '@playwright/test';
import { readFile } from 'fs/promises';
import path from 'path';

import { AUTH_FILE } from './global-setup.js';
import { LoginPage, OrangeHrmLoginPage } from './pages/LoginPage.js';

export const test = base.extend<{
  authenticatedPage: Page;
  loginPage: LoginPage;
  orangeHrmLoginPage: OrangeHrmLoginPage;
}>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  orangeHrmLoginPage: async ({ page }, use) => {
    await use(new OrangeHrmLoginPage(page));
  },
  authenticatedPage: async ({ browser }, use) => {
    let storageState: unknown = { cookies: [], origins: [] };

    try {
      const stateText = await readFile(path.resolve(AUTH_FILE), 'utf8');
      storageState = JSON.parse(stateText);
    } catch {
      storageState = { cookies: [], origins: [] };
    }

    const context = await browser.newContext({ storageState: storageState as any });
    const page = await context.newPage();

    await use(page);

    await context.close();
  },
});

export { expect };
