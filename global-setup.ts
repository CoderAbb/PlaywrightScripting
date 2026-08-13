import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

export const QA_BASE_URL = 'https://qaautomationlabs.com';
export const SHOP_BASE_URL = 'https://shop.qaautomationlabs.com';
export const PRACTICE_SITE_URL = 'https://practicesoftwaretesting.com';
export const LAMBDA_ECOM_URL = 'https://ecommerce-playground.lambdatest.io';
export const RAHUL_SHETTY_URL = 'https://rahulshettyacademy.com/seleniumPractise/#/';
export const PLAYWRIGHT_URL = 'https://playwright.dev/';
export const TODO_URL = 'https://todomvc.com/examples/react/dist/';

export const TEST_EMAIL = 'test@gmail.com';
export const CHECKOUT_FIRST_NAME = 'Test';
export const CHECKOUT_LAST_NAME = 'User';
export const CHECKOUT_PHONE = '1234567890';
export const CHECKOUT_ADDRESS = '123 Straight Street';
export const CHECKOUT_CITY = 'Dallas';
export const CHECKOUT_STATE = 'Texas';
export const CHECKOUT_POST_CODE = '75001';
export const CHECKOUT_GUEST_FIRST_NAME = 'testfirst';
export const CHECKOUT_GUEST_LAST_NAME = 'testlast';
export const CHECKOUT_ELECTRONICS_PHONE = '9098726735';
export const CHECKOUT_ELECTRONICS_ADDRESS = '1234 test street';
export const CHECKOUT_ELECTRONICS_STATE = 'Michigan';
export const CHECKOUT_ELECTRONICS_CITY = 'Troy';
export const CHECKOUT_ELECTRONICS_POST_CODE = '78234';
export const CHECKOUT_KIDS_FIRST_NAME = 'Testname';
export const CHECKOUT_KIDS_LAST_NAME = 'Testlastname';
export const CHECKOUT_KIDS_PHONE = '9726635421';
export const CHECKOUT_KIDS_ADDRESS = '2890 Spring Drive';
export const CHECKOUT_KIDS_CITY = 'Troy';
export const CHECKOUT_KIDS_STATE = 'MI';
export const CHECKOUT_KIDS_POST_CODE = '89283';

const authDir = path.join(process.cwd(), '.auth');
export const AUTH_DIR = authDir;
export const AUTH_FILE = path.join(authDir, 'shop-auth.json');

async function globalSetup(_config: any) {
  await mkdir(authDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(SHOP_BASE_URL, { waitUntil: 'domcontentloaded' });

    // shop.qaautomationlabs.com sometimes shows a brief Cloudflare
    // "checking your browser" interstitial before the real login page
    // renders. Wait for the actual login form instead of racing it -
    // clicking immediately after domcontentloaded can land on the
    // interstitial and silently no-op.
    const autofillButton = page.getByRole('button', { name: /autofill demo credentials/i });
    await autofillButton.waitFor({ state: 'visible', timeout: 30_000 });
    await autofillButton.click();

    await page.getByRole('button', { name: /login/i }).click();
    await page.waitForURL(/shop\.php$/, { timeout: 30_000 });

    const storageState = await page.context().storageState();
    await writeFile(AUTH_FILE, JSON.stringify(storageState, null, 2));
  } catch (error) {
    // Don't let a flaky/unreachable demo site block the entire local run.
    // Tests that don't depend on the `authenticatedPage` fixture (e.g. ones
    // targeting other sites) should still be able to execute; fixtures.ts
    // already falls back to an empty storage state if this file is missing
    // or unparsable, so writing one explicitly here keeps that path in sync.
    console.warn(
      `[global-setup] Could not authenticate against ${SHOP_BASE_URL}, continuing without a stored session: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    await writeFile(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }, null, 2));
  } finally {
    await browser.close();
  }
}

export default globalSetup;
