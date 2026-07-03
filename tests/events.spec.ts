import { test, expect, Page } from '@playwright/test';

const openNavMenu = async (page: Page) => {
    await page.locator('span').nth(3).click();
};

const clickLinkByName = async (page: Page, name: string) => {
    await page.getByRole('link', { name }).click();
};

const openEvent = async (page: Page, eventLinkName: string) => {
    await openNavMenu(page);
    await clickLinkByName(page, '/ Events');
    await clickLinkByName(page, eventLinkName);
};

const goHome = async (page: Page) => {
    await openNavMenu(page);
    await clickLinkByName(page, '/ Home');
};

test('@events ', async ({ page }) => {
    await page.goto('https://qaautomationlabs.com/');

    await openEvent(page, 'Colombo Test Automation');
    await expect(page.locator('h3')).toContainText('Colombo Test Automation Conference (CTAC) 2024!');

    await goHome(page);

    await openEvent(page, 'SLASSCOM Quality Summit');
    await expect(page.locator('h1')).toContainText('SLASSCOM Quality Summit 2023');

    await goHome(page);
});