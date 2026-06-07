import { test, expect, Page } from '@playwright/test';

const TODO_URL = 'https://todomvc.com/examples/react/dist/';
const inputLocator = (page: Page) => page.getByTestId('text-input');
const todoItemToggle = (page: Page, text: string) =>
  page.getByRole('listitem').filter({ hasText: text }).getByTestId('todo-item-toggle');

async function addTask(page: Page, task: string) {
  const input = inputLocator(page);
  await input.click();
  await input.fill(task);
  await input.press('Enter');
}

async function addTasks(page: Page, tasks: string[]) {
  for (const t of tasks) await addTask(page, t);
}

async function toggleTasks(page: Page, tasks: string[]) {
  for (const t of tasks) await todoItemToggle(page, t).check();
}

async function nav(page: Page, label: 'All' | 'Active' | 'Completed') {
  await page.getByRole('link', { name: label }).click();
}

test('test @dailytasks', async ({ page }: { page: Page }) => {
  const tasks = ['buy grocery', 'go for walk', 'rest', 'play'];

  await page.goto(TODO_URL);
  await addTasks(page, tasks);

  // mark some tasks completed
  await toggleTasks(page, ['rest', 'buy grocery']);

  // navigate around filters
  await nav(page, 'Active');
  await nav(page, 'Completed');
  await nav(page, 'Active');

  // assertions
  await expect(todoItemToggle(page, 'play')).toBeVisible();
  await expect(page.getByText('go for walk')).toBeVisible();
  await expect(page.getByTestId('todo-list')).toContainText('go for walk');

  // clear completed and return to All
  await page.getByRole('button', { name: 'Clear completed' }).click();
  await nav(page, 'All');
});