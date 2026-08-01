import { expect, type Page } from '@playwright/test';

export class CheckoutPage {
  constructor(private page: Page) {}

  async fillField(placeholderOrLabel: string, value: string) {
    const locator = this.page.getByPlaceholder(placeholderOrLabel)
      .or(this.page.getByLabel(placeholderOrLabel))
      .or(this.page.getByRole('textbox', { name: placeholderOrLabel }));

    if (await locator.count()) {
      await locator.first().fill(value);
    }
  }

  async submit() {
    const continueButton = this.page.getByRole('button', { name: /continue/i });
    if (await continueButton.count()) {
      await continueButton.first().click();
      return;
    }

    const fallback = this.page.locator('button:has-text("Continue"), button:has-text("Place Order")').first();
    if (await fallback.count()) {
      await fallback.click();
    }
  }

  async expectSuccess(text: RegExp | string) {
    await expect(this.page.locator('body')).toContainText(text);
  }
}
