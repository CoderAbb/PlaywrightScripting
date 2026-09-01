import { test, expect } from '@playwright/test';
import { RAHUL_SHETTY_URL } from '../global-setup.js';

test('searchflights @flights', async ({ page }) => {
  const SLOW_CLICK_TIMEOUT = 8000;
  await page.goto(RAHUL_SHETTY_URL);
  const page1Promise = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Flight Booking' }).click();
  const page1 = await page1Promise;
  await page1.locator('#ctl00_mainContent_ddl_originStation1_CTXT').click();
  await page1.locator('#ctl00_mainContent_ddl_destinationStation1_CTXT').click();

  await fillifpresent(page1, 'Chennai (MAA)', { timeout: SLOW_CLICK_TIMEOUT });
  await fillifpresent(page1, 'Bengaluru (BLR)', { timeout: SLOW_CLICK_TIMEOUT });

  async function fillifpresent(page: any, text: string, options?: { timeout?: number }) {
    try {
      const timeout = options?.timeout ?? SLOW_CLICK_TIMEOUT;
      const link = page.getByRole('link', { name: text });
      if (await link.isVisible({ timeout })) {
        await link.waitFor({ state: 'visible', timeout });
        await link.click({ timeout });
      }
    } catch (e) {
      // Ignore: optional item didn't appear in time.
    }
  }

  const first12 = page1.getByRole('link', { name: '12' }).first();
  await first12.waitFor({ state: 'visible', timeout: SLOW_CLICK_TIMEOUT });
  await first12.click({ timeout: SLOW_CLICK_TIMEOUT });

  await page1.getByRole('button').nth(1).click();

  const first19 = page1.getByRole('link', { name: '19' }).first();
  await first19.waitFor({ state: 'visible', timeout: SLOW_CLICK_TIMEOUT });
  await first19.click({ timeout: SLOW_CLICK_TIMEOUT });

  const iaf = page1.getByRole('checkbox', { name: 'Indian Armed Forces' });
  await iaf.waitFor({ state: 'visible', timeout: SLOW_CLICK_TIMEOUT });
  await iaf.check({ timeout: SLOW_CLICK_TIMEOUT });

  await page1.getByRole('button', { name: 'Search' }).click();
});