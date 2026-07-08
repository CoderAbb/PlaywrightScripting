import { test, expect } from '@playwright/test';

test('contact form submission @contacts', async ({ page }) => {
  await page.goto('https://qaautomationlabs.com/');
  await page.getByRole('link', { name: 'Contacts' }).click();

  const nameField = page.getByRole('textbox', { name: 'Name' });
  const emailField = page.getByRole('textbox', { name: 'Email' });
  const messageField = page.getByRole('textbox', { name: 'Message' });
  const sendButton = page.getByRole('button', { name: 'Send a Message' });
  const resultArea = page.locator('#post-202');

  await nameField.fill('TestName');
  await nameField.press('Tab');

  await emailField.fill('test@gmail.com');
  await emailField.press('Tab');

  await messageField.fill('Test message');
  await sendButton.click();

  await messageField.fill('Test message for contacts');
  await sendButton.click();

  await expect(resultArea).toContainText(
    'Thank you for reaching out to. Please fill the form will connect with you soon.'
  );
});