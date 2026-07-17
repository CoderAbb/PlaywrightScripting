const { chromium } = require('@playwright/test');
const { mkdir, writeFile } = require('fs/promises');
const path = require('path');

const authDir = path.join(process.cwd(), '.auth');
const authFile = path.join(authDir, 'shop-auth.json');

async function globalSetup(_config) {
  await mkdir(authDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto('https://shop.qaautomationlabs.com/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /autofill demo credentials/i }).click();
    await page.getByRole('button', { name: /login/i }).click();
    await page.waitForURL(/shop\.php$/);

    const storageState = await page.context().storageState();
    await writeFile(authFile, JSON.stringify(storageState, null, 2));
  } finally {
    await browser.close();
  }
}

module.exports = globalSetup;
