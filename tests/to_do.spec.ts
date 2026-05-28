import { test, expect } from '@playwright/test';
import { Page } from '@playwright/test';

test('test', async ({ page }: { page: Page }) => {
  await page.goto('https://todomvc.com/examples/react/dist/');
  await page.getByTestId('text-input').click();
  await page.getByTestId('text-input').fill('buy grocery');
  await page.getByTestId('text-input').press('Enter');
  await page.getByTestId('text-input').fill('go for walk');
  await page.getByTestId('text-input').press('Enter');
  await page.getByTestId('text-input').fill('rest');
  await page.getByTestId('text-input').press('Enter');
  await page.getByTestId('text-input').fill('play');
  await page.getByTestId('text-input').press('Enter');
  await page.getByRole('listitem').filter({ hasText: 'rest' }).getByTestId('todo-item-toggle').check();
  await page.getByRole('listitem').filter({ hasText: 'buy grocery' }).getByTestId('todo-item-toggle').check();
  await page.getByRole('link', { name: 'Active' }).click();
  await page.getByRole('link', { name: 'Completed' }).click();
  await page.getByRole('link', { name: 'Active' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'play' }).getByTestId('todo-item-toggle')).toBeVisible();
  await expect(page.getByText('go for walk')).toBeVisible();
  await expect(page.getByTestId('todo-list')).toContainText('go for walk');
  await page.getByRole('button', { name: 'Clear completed' }).click();
  await page.getByRole('link', { name: 'All' }).click();
});