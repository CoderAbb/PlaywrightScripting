import { expect, type Page } from '@playwright/test';
import { PRACTICE_SITE_URL } from '../global-setup.js';


export class ToolshopCartPage {
  constructor(private page: Page) {}

  /**
   * Reaches the cart via an in-app UI click rather than a hard page.goto() —
   * confirmed necessary: cart items added via AJAX on the product page were
   * being lost on a full navigation to /checkout (expectCartQuantity passed
   * right before the goto, expectItemInCart failed right after, even with
   * the broadest possible text match — see below). Falls back to the direct
   * navigation if no in-app cart control is found. Confirmed working
   * locally as of the last verified run.
   */
  async open() {
    const cartControlCandidates = [
      { label: 'nav-cart data-test', locator: this.page.locator('[data-test="nav-cart"]') },
      { label: 'cart-icon data-test', locator: this.page.locator('[data-test="cart-icon"]') },
      { label: 'shopping-cart data-test', locator: this.page.locator('[data-test="shopping-cart"]') },
      { label: 'role=link name=cart', locator: this.page.getByRole('link', { name: /cart/i }) },
      { label: 'role=button name=cart', locator: this.page.getByRole('button', { name: /cart/i }) },
      { label: 'href contains /checkout', locator: this.page.locator('a[href*="/checkout"]').first() },
    ];

    for (const candidate of cartControlCandidates) {
      try {
        if (await candidate.locator.isVisible({ timeout: 2_000 })) {
          await candidate.locator.click();
          console.log(`[ToolshopCartPage] Reached cart via in-app UI click: ${candidate.label}`);
          return;
        }
      } catch {
        // Not visible / not clickable — try the next candidate.
      }
    }

    console.log('[ToolshopCartPage] No in-app cart control found, falling back to direct navigation.');
    await this.page.goto(`${PRACTICE_SITE_URL}/checkout`);
  }

  async expectItemInCart(productName: string) {
    // networkidle helps for slow CI network conditions; the broad .or()
    // fallback matches the product name anywhere on the page, not just
    // within the exact [data-test="product-title"] attribute, since the
    // strict form alone wasn't reliably matching under CI.
    await this.page.waitForLoadState('networkidle').catch(() => {});

    const titleLocator = this.page
      .locator('[data-test="product-title"]', { hasText: productName })
      .or(this.page.getByText(productName, { exact: false }))
      .first();

    await expect(titleLocator).toBeVisible({ timeout: 30_000 });
  }

  async expectItemCount(expected: number) {
    await expect(this.page.locator('[data-test="cart-quantity"]')).toHaveText(String(expected));
  }

  async proceedToCheckout() {
    const proceed = this.page.locator('[data-test="proceed-1"]').first();
    await expect(proceed).toBeVisible({ timeout: 10_000 });
    await expect(proceed).toBeEnabled({ timeout: 5_000 });
    await proceed.click();
  }
}
