import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { QA_BASE_URL } from '../global-setup.js';

test.describe('@Checkbox and @Radio Button tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(QA_BASE_URL);
    });

    test('@Checkbox test', async ({ page }) => {
        await page.getByRole('link', { name: /checkbox/i }).first().click();

        await page.locator('#chk1').check();
        await expect(page.locator('#chk1')).toBeChecked();

        await page.locator('#toggleBtn').click();
        await page.locator('#chk2').check();
        await expect(page.locator('#chk2')).toBeChecked();
        await expect(page.locator('#chk3')).toBeDisabled();
        await expect(page.locator('#chk4')).toBeDisabled();
    });

    test('@Radio button test', async ({ page }) => {
        await page.getByRole('link', { name: /radio button/i }).first().click();

        await page.locator("input[name='gender']").first().check();
        await expect(page.locator("input[name='gender']").first()).toBeChecked();

        await page.getByRole('button', { name: 'Show Selected Gender' }).click();
        await expect(page.locator('#result')).toContainText('Male');

        await page.locator("input[name='gender']").nth(1).check();
        await page.getByRole('button', { name: 'Show Selected Gender' }).click();
        await expect(page.locator('#result')).toContainText('Female');

        await page.locator("input[name='gender1']").first().check();
        await page.locator("input[name='age1']").first().check();
        await page.getByRole('button', { name: 'Show Selected Values' }).click();
        await expect(page.locator('#result3')).toContainText('Gender');
    });
});