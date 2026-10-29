import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { SHOP_BASE_URL } from '../config/urls.js';

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
