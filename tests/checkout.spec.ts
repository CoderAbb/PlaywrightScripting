import { test, expect } from '@playwright/test';
import { LAMBDA_ECOM_URL, TEST_EMAIL, CHECKOUT_FIRST_NAME, CHECKOUT_LAST_NAME, CHECKOUT_ADDRESS, CHECKOUT_CITY, CHECKOUT_POST_CODE, CHECKOUT_PHONE } from '../global-setup.js';

type GuestInfo = {
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
  address1: string;
  city: string;
  postCode: string;
  countryValue: string;
  zoneValue: string;
};

const GUEST: GuestInfo = {
  firstName: CHECKOUT_FIRST_NAME,
  lastName: CHECKOUT_LAST_NAME,
  email: TEST_EMAIL,
  telephone: CHECKOUT_PHONE,
  address1: CHECKOUT_ADDRESS,
  city: CHECKOUT_CITY,
  postCode: CHECKOUT_POST_CODE,
  countryValue: '223', // value attr for country select
  zoneValue: '3659',   // value attr for zone select
};

test('checkout @check', async ({ page }) => {
  await page.goto(LAMBDA_ECOM_URL);

  const searchBox = page.getByRole('textbox', { name: 'Search For Products' });
  await searchBox.fill('HP');
  await page.getByRole('link', { name: 'HP LP3065' }).nth(1).click();
  await page.getByRole('button', { name: 'Add to Cart' }).click();

  await page.getByRole('link', { name: 'View Cart ' }).click();
  await page.getByRole('link', { name: 'Checkout' }).click();

  await page.getByText('Guest Checkout').click();

  const fields: Array<[string, string]> = [
    ['First Name*', GUEST.firstName],
    ['Last Name*', GUEST.lastName],
    ['E-Mail*', TEST_EMAIL],
    ['Telephone*', GUEST.telephone],
    ['Address 1*', GUEST.address1],
    ['City*', GUEST.city],
    ['Post Code*', GUEST.postCode],
  ];

  for (const [label, value] of fields) {
    await page.getByRole('textbox', { name: label }).fill(value);
  }

  await page.locator('#input-payment-country').selectOption(GUEST.countryValue);
  await page.locator('#input-payment-zone').selectOption(GUEST.zoneValue);

  await page.getByText('I have read and agree to the Terms & Conditions').click();
  await page.getByRole('button', { name: 'Continue ' }).click();
  await page.getByRole('button', { name: 'Confirm Order ' }).click();

  await expect(page.locator('#content')).toContainText('Your order has been successfully processed!');
  await page.getByRole('link', { name: 'Continue' }).click();
});