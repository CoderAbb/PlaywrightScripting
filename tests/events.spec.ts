import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { QA_BASE_URL } from '../config/urls.js';

const clickLinkByName = async (page: Page, name: string) => {
    const normalizedName = name.replace(/^\/\s*/, '').trim();
    await page.locator('header a.menu-link, header a, nav a')
        .filter({ hasText: normalizedName })
        .first()
        .click();
};

const openEventPage = async (page: Page, eventTitle: string) => {
    await clickLinkByName(page, 'Events');
    await expect(page.locator('body')).toContainText(eventTitle);
};

const goHome = async (page: Page) => {
    await clickLinkByName(page, 'Home');
    await expect(page).toHaveURL(/qaautomationlabs\.com\/?$/);
};

test('@events ', async ({ page }) => {
    await page.goto(QA_BASE_URL);

    await openEventPage(page, 'Colombo Test Automation Conference (CTAC) 2024');
    await goHome(page);

    await openEventPage(page, 'SLASSCOM Quality Summit');
    await goHome(page);
});