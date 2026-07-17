import { test, expect, type Page } from '@playwright/test';

async function openHome(page: Page) {
    await page.goto('https://qaautomationlabs.com/');
}

async function openCourses(page: Page) {
    await page.getByRole('link', { name: 'Courses' }).first().click();
}

test('courses navigation @courseSelection', async ({ page }) => {
    await openHome(page);
    await openCourses(page);

    await expect(page.locator('body')).toContainText(/courses/i);
    await page.getByRole('link', { name: /playwright/i }).first().click();
    await expect(page.locator('body')).toContainText(/playwright/i);
});
