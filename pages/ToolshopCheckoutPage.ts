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

/**
 * Page object for steps 2-4 of the Toolshop checkout wizard on
 * https://practicesoftwaretesting.com/checkout:
 *   2. Sign in / Continue as Guest
 *   3. Billing Address
 *   4. Payment
 */
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
   * Fills the billing address form. NOTE: the app auto-fills street/city/state
   * once postal code + house number are entered, overwriting anything already
   * typed in those fields. This method fills postal code/house number first,
   * waits for the auto-fill, then overwrites street/city/state with the
   * requested values so the final state is deterministic.
   */
  async fillBillingAddress(address: ToolshopBillingAddress) {
    await this.page.locator('[data-test="country"]').selectOption(address.country);
    await this.page.locator('[data-test="postal_code"]').fill(address.postalCode);
    await this.page.locator('[data-test="house_number"]').fill(address.houseNumber);

    // Let the app's address auto-fill run, then overwrite with deterministic values.
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
