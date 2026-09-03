import { expect, type Page } from '@playwright/test';

export type ToolshopBillingAddress = {
  country: string;
  postalCode: string;
  houseNumber: string;
  street: string;
  city: string;
  state: string;
};

export type ToolshopPaymentMethod =
  | 'Bank Transfer'
  | 'Cash on Delivery'
  | 'Credit Card'
  | 'Buy Now Pay Later'
  | 'Gift Card';


export class ToolshopCheckoutPage {
  constructor(private page: Page) {}

  async continueAsGuest(email: string, firstName: string, lastName: string) {
    await this.page.getByRole('tab', { name: 'Continue as Guest' }).click();
    await this.page.locator('[data-test="guest-email"]').fill(email);
    await this.page.locator('[data-test="guest-first-name"]').fill(firstName);
    await this.page.locator('[data-test="guest-last-name"]').fill(lastName);
    await this.page.locator('[data-test="guest-submit"]').click();
    await expect(this.page.getByText(/Continuing as guest/i)).toBeVisible();
    await this.page.locator('[data-test="proceed-2-guest"]').click();
  }

  /**
   * selectOption(plainString) matches against the <option>'s `value`
   * attribute by default, not its visible text — country dropdowns almost
   * always store a short code as the value, not the full country name, so
   * a literal country name usually fails to match. This tries label match,
   * then value match, then a normalized partial-text match against
   * whatever options actually exist in the DOM right now. If none of those
   * work, it fails with the real list of available options instead of an
   * opaque timeout.
   */
  private async selectCountry(countryQuery: string) {
    const select = this.page.locator('[data-test="country"]');
    await expect(select).toBeVisible({ timeout: 10_000 });

    for (const attempt of [
      () => select.selectOption({ label: countryQuery }),
      () => select.selectOption({ value: countryQuery }),
      () => select.selectOption(countryQuery),
    ]) {
      try {
        await attempt();
        return;
      } catch {
        // try the next strategy
      }
    }

    const options = await select.locator('option').all();
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
    const normalizedQuery = normalize(countryQuery);

    for (const option of options) {
      const label = normalize((await option.textContent()) ?? '');
      const value = (await option.getAttribute('value')) ?? '';
      if (label && (label.includes(normalizedQuery) || normalizedQuery.includes(label))) {
        await select.selectOption({ value });
        return;
      }
    }

    const available = (await Promise.all(options.map((o) => o.textContent()))).filter(Boolean);
    throw new Error(
      `Could not find a country option matching "${countryQuery}". Available options: ${available.join(', ')}`,
    );
  }

  async fillBillingAddress(address: ToolshopBillingAddress) {
    await this.selectCountry(address.country);
    await this.page.locator('[data-test="postal_code"]').fill(address.postalCode);
    await this.page.locator('[data-test="house_number"]').fill(address.houseNumber);

    await expect(this.page.locator('[data-test="street"]')).not.toHaveValue('');
    await this.page.locator('[data-test="street"]').fill(address.street);
    await this.page.locator('[data-test="city"]').fill(address.city);
    await this.page.locator('[data-test="state"]').fill(address.state);

    await this.page.locator('[data-test="proceed-3"]').click();
  }

  async selectPaymentMethod(method: ToolshopPaymentMethod) {
    await this.page.locator('[data-test="payment-method"]').selectOption(method);
  }

  async confirmPayment() {
    await this.page.locator('[data-test="finish"]').click();
  }

  async expectPaymentSuccess() {
    await expect(this.page.locator('[data-test="payment-success-message"]')).toContainText(
      'Payment was successful'
    );
  }
}
