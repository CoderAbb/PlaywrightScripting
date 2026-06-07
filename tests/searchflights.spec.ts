import { test, expect } from '@playwright/test';

test('searchflights @flights', async ({ page }) => {
  await page.goto('https://rahulshettyacademy.com/seleniumPractise/#/');
  const page1Promise = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Flight Booking' }).click();
  const page1 = await page1Promise;
  await page1.locator('#ctl00_mainContent_ddl_originStation1_CTXT').click();
  await page1.locator('#ctl00_mainContent_ddl_destinationStation1_CTXT').click();

  fillifpresent(page1, 'Chennai (MAA)', { timeout: 2000 });
  fillifpresent(page1, 'Bengaluru (BLR)', { timeout: 2000 });

  async function fillifpresent(page: any, text: string, options?: { timeout?: number }) {
  if (await page.getByRole('link', { name: text }).isVisible({ timeout: options?.timeout })) {
    await page.getByRole('link', { name: text }).click();
  }
  }

  await page1.getByRole('link', { name: '12' }).first().click();
  await page1.getByRole('button').nth(1).click();
  await page1.getByRole('link', { name: '19' }).first().click();
  await page1.getByRole('checkbox', { name: 'Indian Armed Forces' }).check();
  await page1.getByRole('button', { name: 'Search' }).click();
});