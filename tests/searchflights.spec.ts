import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://rahulshettyacademy.com/seleniumPractise/#/');
  const page1Promise = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Flight Booking' }).click();
  const page1 = await page1Promise;
  await page1.locator('#ctl00_mainContent_ddl_originStation1_CTXT').click();
  await page1.getByRole('link', { name: 'Bengaluru (BLR)' }).isVisible().then(async () => {
    await page1.getByRole('link', { name: 'Bengaluru (BLR)' }).click();
    });
   // await page1.getByRole('link', { name: 'Delhi (DEL)' }).click();
    if (await page1.getByRole('link', { name: 'Adampur (AIP)' }).isVisible()) {
    await page1.getByRole('link', { name: 'Adampur (AIP)' }).click();
    }
    if (await page1.getByRole('link', { name: 'Bhopal (BHO)' }).isVisible()) {
    await page1.getByRole('link', { name: 'Bhopal (BHO)' }).click();
    }
    if (await page1.getByRole('link', { name: 'Chennai (MAA)' }).isVisible()) {
    await page1.getByRole('link', { name: 'Chennai (MAA)' }).click();
    }
  await page1.getByRole('link', { name: '12' }).first().click();
  await page1.getByRole('button').nth(1).click();
  await page1.getByRole('link', { name: '19' }).first().click();
  await page1.getByRole('checkbox', { name: 'Indian Armed Forces' }).check();
  await page1.getByRole('button', { name: 'Search' }).click();
});