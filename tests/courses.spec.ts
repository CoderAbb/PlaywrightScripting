import { test, expect, Page } from '@playwright/test';

async function clickSpan(page: Page, index: number) {
    await page.locator('span').nth(index).click();
}

async function clickSpans(page: Page, indexes: number[]) {
    for (const i of indexes) await clickSpan(page, i);
}

async function openHome(page: Page) {
    await page.goto('https://qaautomationlabs.com/');
}

async function openCourses(page: Page) {
    await clickSpan(page, 5);
    await page.getByRole('link', { name: '/ Courses' }).click();
}

async function openCourseByHeading(page: Page, heading: string) {
    await page.getByRole('heading', { name: heading }).click();
}

async function assertH3Contains(page: Page, expected: string) {
    await expect(page.locator('h3')).toContainText(expected);
}

test('courses navigation @courseSelection', async ({ page }) => {
    await openHome(page);
    await openCourses(page);

    await openCourseByHeading(page, 'Starting with Cypress: A');
    await assertH3Contains(page, 'Starting with Cypress: A Beginner’s Path to Test Automation');

    await clickSpan(page, 4);
    await clickSpan(page, 0); 
    await page.locator('h3').click();
    await page.getByText('Introduction to Cypress &').click();
});