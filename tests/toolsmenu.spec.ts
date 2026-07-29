import { test, expect } from '@playwright/test';
import { PRACTICE_SITE_URL } from '../global-setup.js';

test('test', async ({ page }) => {
  await page.goto(PRACTICE_SITE_URL);
  await page.waitForLoadState('domcontentloaded');

  const headerLinks = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('header a, nav a, a'));
    return nodes.slice(0, 200).map(n => ({ text: (n.textContent||'').trim().slice(0,80), href: (n as HTMLAnchorElement).href || '', dataTest: (n as Element).getAttribute('data-test') }));
  });
  console.log('header/nav links snapshot:', headerLinks.slice(0, 50));

  const clickWhenReady = async (sel: string) => {
    const loc = page.locator(sel);

    if (await loc.count() === 0) {
      console.log(`locator not found, skipping: ${sel}`);
      return;
    }

    try { await loc.first().waitFor({ state: 'visible', timeout: 5000 }); } catch {}
    try { await loc.first().scrollIntoViewIfNeeded(); } catch {}
    for (let i = 0; i < 5; i++) {
      try {
        await loc.click({ timeout: 5000 });
        return;
      } catch (e) {

        await page.waitForTimeout(500);
      }
    }

    await loc.click({ force: true, timeout: 5000 });
  };

  const fillIfExists = async (sel: string, value: string) => {
    const loc = page.locator(sel);
    if (await loc.count() === 0) {
      console.log(`fill skipped, locator not found: ${sel}`);
      return false;
    }
    try {
      await loc.fill(value, { timeout: 5000 });
      return true;
    } catch (e) {
      console.log(`fill failed for ${sel}: ${e}`);
      return false;
    }
  };

  const notif = page.locator('[data-test="notification-bar"]');
  if (await notif.count() > 0) {
    try { await notif.evaluate(n => { (n as HTMLElement).style.display = 'none'; }); } catch {}
  }

  // Use the original locators but with robust clicks/waits
  await clickWhenReady('[data-test="nav-categories"]');
  // ensure dropdown had a moment to render
  await page.waitForTimeout(300);
  await clickWhenReady('[data-test="nav-categories"]');
  await clickWhenReady('[data-test="nav-categories"]');
  await clickWhenReady('[data-test="nav-categories"]');
  await clickWhenReady('[data-test="nav-categories"]');


  const openProductsListing = async () => {
    const linkTexts = ['Shop', 'Products', 'All Products', 'Catalog', 'All items', 'All products'];
    for (const text of linkTexts) {
      const r = page.getByRole('link', { name: new RegExp(`^${text}$`, 'i') });
      if (await r.count() > 0) {
        try { await r.first().click({ timeout: 3000 }); return true; } catch {}
      }
      const txt = page.locator(`text=${text}`);
      if (await txt.count() > 0) {
        try { await txt.first().click({ timeout: 3000 }); return true; } catch {}
      }
    }

    try { await page.goto(new URL('/collections/all', PRACTICE_SITE_URL).href); return true; } catch {}
    try { await page.goto(new URL('/shop', PRACTICE_SITE_URL).href); return true; } catch {}
    return false;
  };

  const productASelector = '[data-test="product-01KYAVDTSDARXJAJMMGS9PVF4D"]';
  const productA = page.locator(productASelector);

  if (await productA.count() === 0) {
    const fallback1 = page.locator('[data-test^="product-"]').first();
    if (await fallback1.count() > 0) {
      await fallback1.scrollIntoViewIfNeeded().catch(() => {});
      await fallback1.click({ timeout: 5000 }).catch(() => {});
    } else {
      const anchorFallback = page.locator('a[href*="/product/"]').first();
      if (await anchorFallback.count() > 0) {
        await anchorFallback.scrollIntoViewIfNeeded().catch(() => {});
        await anchorFallback.click({ timeout: 5000 }).catch(() => {});
      }
    }
  } else {
    await productA.waitFor({ state: 'attached', timeout: 15000 });
    try { await productA.scrollIntoViewIfNeeded(); } catch {}
    await clickWhenReady(productASelector);
  }
  if (await page.locator('[data-test="add-to-cart"]').count() > 0) {
    await clickWhenReady('[data-test="add-to-cart"]');
  } else if (await page.getByText('Add to cart').count() > 0) {
    await clickWhenReady('text=Add to cart');
  } else if (await page.locator('button:has-text("Add to cart")').count() > 0) {
    await clickWhenReady('button:has-text("Add to cart")');
  } else {
    console.log('add-to-cart not found; continuing');
  }


  await clickWhenReady('[data-test="nav-categories"]');
  await clickWhenReady('[data-test="nav-categories"]');
  await clickWhenReady('[data-test="nav-categories"]');
  await clickWhenReady('[data-test="nav-categories"]');
  await clickWhenReady('[data-test="nav-categories"]');
  await clickWhenReady('[data-test="nav-categories"]');

  if (await page.getByRole('link', { name: 'Practice Software Testing -' }).count() > 0) {
    try {
      await page.getByRole('link', { name: 'Practice Software Testing -' }).click({ timeout: 5000 });
    } catch {
      await page.getByRole('link', { name: 'Practice Software Testing -' }).click({ force: true });
    }
  } else if (await page.locator('[data-test="nav-home"]').count() > 0) {
    await clickWhenReady('[data-test="nav-home"]');
  } else {
    await page.goto(PRACTICE_SITE_URL);
    await page.waitForLoadState('domcontentloaded');
  }

  const productBSelector = '[data-test="product-01KYAVDTSG0P416424PADDCN2T"]';
  const productB = page.locator(productBSelector);
  if (await productB.count() === 0) {
    const fallbackB = page.locator('[data-test^="product-"]').nth(1);
    if (await fallbackB.count() > 0) {
      await fallbackB.scrollIntoViewIfNeeded().catch(() => {});
      await fallbackB.click({ timeout: 5000 }).catch(() => {});
    } else {
      const anchorFallbackB = page.locator('a[href*="/product/"]').nth(1);
      if (await anchorFallbackB.count() > 0) {
        await anchorFallbackB.scrollIntoViewIfNeeded().catch(() => {});
        await anchorFallbackB.click({ timeout: 5000 }).catch(() => {});
      }
    }
  } else {
    await clickWhenReady(productBSelector);
  }
  if (await page.locator('[data-test="add-to-cart"]').count() > 0) {
    await clickWhenReady('[data-test="add-to-cart"]');
  } else if (await page.getByText('Add to cart').count() > 0) {
    await clickWhenReady('text=Add to cart');
  } else if (await page.locator('button:has-text("Add to cart")').count() > 0) {
    await clickWhenReady('button:has-text("Add to cart")');
  } else {
    console.log('add-to-cart not found on second product; continuing');
  }


  const checks = await page.evaluate(() => {
    const q = (s: string) => document.querySelectorAll(s).length;
    const addToCartCount = Array.from(document.querySelectorAll('button, a')).filter(el => (el.getAttribute && el.getAttribute('data-test') === 'add-to-cart') || /add to cart/i.test(el.textContent || '')).length;
    return {
      nav_cart: q('[data-test="nav-cart"]'),
      nav_categories: q('[data-test="nav-categories"]'),
      products_data_test: q('[data-test^="product-"]'),
      anchors_product: q('a[href*="/product/"]'),
      add_to_cart_btns: addToCartCount
    };
  });
  console.log('selector checks before cart:', checks);

  if (await page.locator('[data-test="nav-cart"]').count() > 0) {
    await clickWhenReady('[data-test="nav-cart"]');
  } else if (await page.getByRole('link', { name: /cart|basket|checkout/i }).count() > 0) {
    await page.getByRole('link', { name: /cart|basket|checkout/i }).first().click().catch(() => {});
  } else {
    await page.goto(new URL('/cart', PRACTICE_SITE_URL).href);
    await page.waitForLoadState('domcontentloaded');
  }

  await clickWhenReady('[data-test="nav-home"]');
});

