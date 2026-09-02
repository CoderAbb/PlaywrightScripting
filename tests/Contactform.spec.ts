import { test, expect } from '@playwright/test';
import { QA_BASE_URL } from '../config/urls.js';
import { TEST_EMAIL } from '../config/testData.js';

test('contact form submission @contacts', async ({ page }) => {
  await page.goto(`${QA_BASE_URL}/contacts/`);

  const nameField = page.getByRole('textbox', { name: 'Name' });
  const emailField = page.getByRole('textbox', { name: 'Email' });
  const messageField = page.getByRole('textbox', { name: 'Message' });
  const sendButton = page.getByRole('button', { name: 'Send a Message' });
  const resultArea = page.locator('#post-202');

  await nameField.fill('TestName');
  await emailField.fill(TEST_EMAIL);
  await messageField.fill('Test message');
  await sendButton.click();

  await expect(resultArea).toContainText(/Invalid form\.|Please enable JavaScript/i);
});