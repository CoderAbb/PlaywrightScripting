import { test, expect, Page } from '@playwright/test';

const pressMultiple = async (page: Page, selector: string, key: string, times = 1) => {
    for (let i = 0; i < times; i++) await page.locator(selector).press(key);
};

test.describe('@Checkbox and @Radio Button tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('https://qaautomationlabs.com/');
        await page.locator('span').nth(3).click();
        await page.getByRole('link', { name: '/ Testing' }).click();
        await page.getByRole('link', { name: ' Dashboard' }).click();
    });

    test('@Checkbox test', async ({ page }) => {
        await page.getByRole('link', { name: ' CheckBox' }).click();

        await page.getByRole('checkbox', { name: 'Enable Checkbox 1' }).check();
        await page.getByRole('checkbox', { name: 'Checkbox 1', exact: true }).check();
        await page.getByRole('checkbox', { name: 'Checkbox 2', exact: true }).check();
    });

    test('@Radio button test', async ({ page }) => {
        await page.getByRole('link', { name: ' Radio Button' }).click();

        await page.getByRole('radio', { name: 'Male' }).first().check();
        await page.getByRole('button', { name: 'Show Selected Gender' }).click();
        await expect(page.locator('#result')).toContainText('You selected: Male');

        await page.getByRole('radio', { name: 'Radio Button 1' }).check();
        await page.getByText('Click on button to get the selected values from Gender and Age').click();

        await pressMultiple(page, 'body', 'ArrowDown', 8);

        await page.getByRole('radio', { name: 'Male' }).nth(2).check();
        await page.getByRole('radio', { name: 'Under' }).check();
        await page.getByRole('radio', { name: '-35' }).check();
        await page.getByRole('button', { name: 'Show Selected Values' }).click();
        await page.getByText('You selected: Gender = Male,').click();
        await expect(page.locator('#result3')).toContainText('You selected: Gender = Male, Age Group =18-35');

        await page.locator('section').click();
        await pressMultiple(page, 'body', 'ArrowUp', 12);

        await page.getByRole('button').filter({ hasText: /^$/ }).click();
        await page.getByRole('button').filter({ hasText: /^$/ }).click();
        await page.getByRole('complementary').getByRole('link', { name: 'QA Automation Labs' }).click();
    });
});